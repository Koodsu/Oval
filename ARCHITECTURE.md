# Bridge — Architecture Guide

> **For AI sessions and agents:** Start with [Part 0: AI Quick Reference](#part-0-ai-quick-reference). It gives you exact file exports, function signatures, types, and patterns so you can make changes without reading every source file. Human-oriented background starts at [Part 1](#part-1-the-big-picture).

> **For humans:** This doc covers the full system — how pieces connect, design decisions, and how to read the code. Every major file is described.

---

## Table of Contents

0. [AI Quick Reference](#part-0-ai-quick-reference)
1. [The Big Picture](#part-1-the-big-picture)
2. [Project Structure](#part-2-project-structure)
3. [Database Models](#part-3-database-models)
4. [API Routes](#part-4-api-routes)
5. [Authentication & Session](#part-5-authentication--session)
6. [Request Flow Example](#part-6-request-flow-example-join-a-pod)
7. [Pod Lifecycle](#part-7-pod-lifecycle)
8. [Create Pod Flow](#part-8-create-pod-flow)
9. [Chat & Polling](#part-9-chat--polling)
10. [Friends & Direct Messages](#part-10-friends--direct-messages)
11. [Blocking](#part-11-blocking)
12. [Reports & Moderation](#part-12-reports--moderation)
13. [Push Notifications](#part-13-push-notifications)
14. [Community Guidelines](#part-14-community-guidelines)
15. [Frontend Architecture](#part-15-frontend-architecture)
16. [Backend Patterns](#part-16-backend-patterns)
17. [Security Overview](#part-17-security-overview)
18. [Key Design Decisions](#part-18-key-design-decisions)
19. [Running the Project](#part-19-running-the-project)
20. [Testing](#part-20-testing)

---

## Part 0: AI Quick Reference

Everything an AI session needs to work in this codebase without reading every file.

---

### 0.1 — Stack at a glance

| Layer | Technology |
|-------|-----------|
| Mobile app | React Native + Expo (TypeScript) |
| HTTP client | `fetch()` via `frontend/src/api.ts` |
| Backend | Express + Node.js (TypeScript) |
| ORM | Prisma → PostgreSQL (Supabase) |
| Auth | JWT (7-day expiry), signed with `JWT_SECRET` |
| Token storage | `expo-secure-store` (iOS Keychain / Android Keystore) |
| Push notifications | Expo Push API |
| Email | Resend (`RESEND_API_KEY`) |

---

### 0.2 — Backend file map

Every file, what it exports, and what to use it for.

#### `backend/src/server.ts`
App entry point. Mounts all middleware and routes. Exports `app` (default). Do not add business logic here — only wiring.

Middleware order (top to bottom):
1. `helmet` (security headers; CSP disabled, `crossOriginResourcePolicy: 'cross-origin'`)
2. `cors` (origin from `CORS_ORIGIN` env; defaults to `http://localhost:3000` in dev; throws in prod if unset)
3. `morgan` (skipped in `NODE_ENV=test`; `'dev'` format in dev, `'combined'` in prod)
4. `webRoutes` (mounted before `express.json()` so web routes bypass body parsing)
5. `express.static` (`/uploads` → `../uploads/`)
6. `express.json({ limit: '64kb' })`
7. Rate limiters + all route routers
8. 404 handler
9. Centralized error handler (4-arg `(err, req, res, next)`)

Route mounting in `server.ts`:
```
/auth           → authLimiter   + routes/auth.ts
/activities     → apiLimiter    + routes/activities.ts
/pods           → apiLimiter    + routes/pods.ts
/pods           → apiLimiter    + routes/attendance.ts
/users          → apiLimiter    + routes/users.ts
/reports        → apiLimiter    + routes/reports.ts
/admin/reports  → apiLimiter    + routes/adminReports.ts
/friends        → apiLimiter    + routes/friends.ts
/messages       → apiLimiter    + routes/directMessages.ts
/pods           → apiLimiter    + routes/podInvites.ts    (before messages to avoid :id conflict)
/pods/:id/messages → apiLimiter + routes/messages.ts     (mergeParams)
```

Rate limits: `authLimiter` = 20 req/15 min, `apiLimiter` = 120 req/60 sec. Both skip when `NODE_ENV=test`.

---

#### `backend/src/config/jwt.ts`
```typescript
export function getJwtSecret(): string
// Reads process.env.JWT_SECRET.
// NODE_ENV === 'test'  → returns 'bridge_test_secret_do_not_use_in_prod'
// Anything else        → throws if JWT_SECRET is missing
```

---

#### `backend/src/middleware/auth.ts`
```typescript
export interface AuthRequest extends Request {
  user?: { userId: string; email: string };
}
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void
// Reads "Authorization: Bearer <token>", verifies JWT, attaches req.user.
// Returns 401 if missing or invalid.
```

#### `backend/src/middleware/admin.ts`
```typescript
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void
// Checks req.user.userId against ADMIN_USER_IDS env var (comma-separated UUIDs).
// Returns 403 if not in list. Must be used after requireAuth.
```

---

#### `backend/src/lib/asyncHandler.ts`
```typescript
export const asyncHandler =
  (fn: (req, res, next) => Promise<unknown>) =>
  (req, res, next): void => fn(req, res, next).catch(next);
// Wrap every async route handler with this. Forwards thrown errors to the
// centralized error middleware. Usage:
//   router.get('/path', requireAuth, asyncHandler(async (req, res) => { ... }));
```

---

#### `backend/src/lib/blocks.ts`
```typescript
export async function hasBlockingRelationship(userIdA: string, userIdB: string): Promise<boolean>
// Returns true if A blocked B OR B blocked A.

export async function getBlockedUserIds(userId: string): Promise<Set<string>>
// Returns all user IDs that have any blocking relationship with userId (either direction).
```

---

#### `backend/src/lib/friendUtils.ts`
```typescript
export function normalizeUserPair(idA: string, idB: string): [string, string]
// Returns [smaller, larger] lexicographically. Use for Friendship and
// DirectMessageThread uniqueness — ensures (A,B) and (B,A) produce the same key.

export async function areFriends(userIdA: string, userIdB: string): Promise<boolean>
// Returns true if a Friendship row exists (order-independent).
```

---

#### `backend/src/lib/typingStore.ts`
In-memory map: `podId/threadId → Set<userId>` with 5-second TTL per entry. Not persisted. Resets on server restart. Used by pod messages and DM threads.

---

#### `backend/src/lib/NotificationService.ts`
Wraps Expo Push API. All methods are fire-and-forget (don't await in route handlers — they don't block the response).

```typescript
// Key methods (all return Promise<void>):
notifyPodJoin(pod, joiner)         // → pod creator
notifyNewPodMessage(pod, sender)   // → all other pod members
sendMeetupReminders(pod)           // → all pod members
notifyDMMessage(thread, sender)    // → the other thread participant
```

---

#### `backend/src/lib/maintenanceJobs.ts`
```typescript
export async function runMaintenanceJobs()
// Invoked by GET /cron/maintenance from Vercel Cron every five minutes.
// Runs pod expiry, one-hour meetup reminders, and stale
// waitlist promotion outside the request-serving process.
```

---

#### `backend/src/lib/emailService.ts`
```typescript
// Sends verification emails via Resend.
// Uses RESEND_API_KEY and RESEND_FROM_EMAIL env vars.
// Fire-and-forget in auth routes — failures are logged, not thrown.
```

---

#### `backend/src/services/friendService.ts`
All friend request business logic. Called by `routes/friends.ts`.

```typescript
export async function sendFriendRequest(senderId, receiverId): Promise<FriendRequest>
// Checks: no existing request, not already friends, not blocked, not self.

export async function acceptFriendRequest(requestId, acceptingUserId): Promise<void>
// Atomic transaction: updates FriendRequest status, creates Friendship row,
// creates DirectMessageThread row (normalized pair).

export async function declineFriendRequest(requestId, userId): Promise<void>
export async function cancelFriendRequest(requestId, userId): Promise<void>
export async function unfriend(userIdA, userIdB): Promise<void>
// Deletes Friendship row; does NOT delete the DirectMessageThread.
```

---

#### `backend/src/services/reportService.ts`
```typescript
export async function createReport(reporterId, payload): Promise<{ reportId, status }>
export async function getMyReports(userId): Promise<Report[]>
export async function listReports(filters): Promise<{ reports, nextCursor }>
export async function updateReport(reportId, updates): Promise<Report>
```

---

#### `backend/src/prisma.ts`
```typescript
export default prisma  // PrismaClient singleton. Import this everywhere.
```

---

### 0.3 — How to throw HTTP errors from route handlers

Service functions and route handlers throw errors with a `status` property that the centralized error middleware reads:

```typescript
// In a service or route handler:
throw Object.assign(new Error('Pod is full'), { status: 409 });
// → client receives: HTTP 409 { "error": "Pod is full" }

// Using asyncHandler, any unhandled throw becomes a 500:
throw new Error('Something unexpected');
// → client receives: HTTP 500 { "error": "Something unexpected" }
```

---

### 0.4 — Adding a new backend route (checklist)

1. Create handler file in `backend/src/routes/yourRoute.ts`
2. Use `asyncHandler` on every async handler
3. Use `requireAuth` on every protected handler
4. Mount in `backend/src/server.ts` with appropriate limiter
5. Add TypeScript types for request body — cast `req.body` explicitly
6. Access authenticated user as `(req as AuthRequest).user!.userId`

---

### 0.5 — Frontend file map

#### `frontend/src/api.ts`
Single module for all HTTP calls. **All API functions live here.** Do not call `fetch()` directly in screens.

Key module-level exports:
```typescript
export const API_BASE: string                    // from EXPO_PUBLIC_API_URL env var
export function resolveAvatarUrl(url): string    // converts relative /uploads/... paths to full URLs
export function setToken(token: string | null)   // called by AuthContext on sign-in/out
export function getToken(): string | null
export function setOnUnauthorized(cb: () => void | null) // called by AuthContext for 401 handling
```

All API functions — organized by domain:

**Auth**
```typescript
register(name, email, password)    → { token: string, user: User }
login(email, password)             → { token: string, user: User }
verifyEmail(code)                  → { user: User }
resendVerification()               → { message: string }
```

**Activities**
```typescript
getActivities(category?, signal?)        → Activity[]
getActivityLocations(activityId)         → string[]
getLocationsByCategory(category)         → string[]
```

**Pods**
```typescript
getMyPods(signal?)                       → Pod[]
fetchFeed(params?, signal?)              → Pod[]    // params: { category?, limit? }
getPodsByActivity(activityId, sort?)     → Pod[]
joinPod(podId)                           → Pod
createPod(activityId, options?)          → Pod      // options: CreatePodOptions
lockPod(podId)                           → Pod
unlockPod(podId)                         → Pod
leavePod(podId)                          → LeavePodResponse
getPod(podId, signal?)                   → Pod
```

**Pod Messages**
```typescript
getMessages(podId, signal?)              → GetMessagesResponse  // { messages: Message[], typingUserIds: string[] }
sendMessage(podId, content, replyToId?)  → Message
sendPodTyping(podId)                     → { ok: boolean }
addPodMessageReaction(podId, msgId, emoji)    → Message
removePodMessageReaction(podId, msgId, emoji) → Message
```

**Direct Messages**
```typescript
getMessageThreads()                              → DirectMessageThread[]
getThreadByUser(userId)                          → { id, otherUser: FriendUser, updatedAt }
getThreadMessages(threadId)                      → GetThreadMessagesResponse
markDMThreadRead(threadId)                       → { ok: boolean }
sendDMTyping(threadId)                           → { ok: boolean }
sendDirectMessage(threadId, content, replyToId?) → DirectMessage
addDMReaction(threadId, msgId, emoji)            → DirectMessage
removeDMReaction(threadId, msgId, emoji)         → DirectMessage
```

**Friends**
```typescript
getFriends()                            → FriendUser[]
getFriendRequests()                     → { incoming: FriendRequest[], outgoing: FriendRequest[] }
getFriendRelationship(userId)           → FriendRelationship
sendFriendRequest(receiverId)           → FriendRequest
acceptFriendRequest(id)                 → { ok: boolean }
declineFriendRequest(id)                → { ok: boolean }
cancelFriendRequest(id)                 → void
unfriend(userId)                        → void
```

**Pod Invites**
```typescript
getPodInvites()                         → PodInvite[]
sendPodInvite(podId, receiverId)        → PodInvite
acceptPodInvite(id)                     → Pod
declinePodInvite(id)                    → void
```

**Users**
```typescript
getMe()                                 → User
getUserProfile(userId, signal?)         → PublicProfile
searchUsers(q)                          → FriendUser[]
uploadAvatar(uri)                       → { avatarUrl: string }    // multipart, not JSON
deleteAvatar()                          → { avatarUrl: null }
registerPushToken(token)                → { success: boolean }
getNotificationPreferences()            → { preferences: NotificationPreferences }
updateNotificationPreferences(prefs)    → { preferences: NotificationPreferences }
blockUser(userId)                       → { success: boolean, blockId?, createdAt? }
unblockUser(userId)                     → { success?: boolean }
```

**Reports & Attendance**
```typescript
createReport(payload: CreateReportPayload)     → { reportId: string, status: string }
getMyReports()                                 → MyReport[]
confirmAttendance(podId)                       → { confirmedAt: string }
reportNoShow(podId, userId)                    → { reported: boolean }
```

---

#### `frontend/src/types.ts`
All TypeScript interfaces. These are the shapes returned by the backend and consumed by screens.

```typescript
// Core domain types
interface User           { id, name, email, verifiedUniversity, avatarUrl?, joinedAt }
interface PublicProfile  { id, name, verifiedUniversity, avatarUrl?, podsJoined, podsAttended, reliabilityScore, joinedAt, friendCount? }
interface Activity       { id, title, description, category, defaultLocation, createdAt, _count? }
interface PodMember      { id, userId, joinedAt, confirmedAt?, user: { id, name, avatarUrl? } }
interface Pod            { id, activityId, meetupTime, location, locationType, minMembers, maxMembers,
                           status, creatorId?, createdAt, activity?, creator?, members: PodMember[],
                           noShowUserIds?, recommended? }
interface Message        { id, podId, userId, content, createdAt, user: { id, name, avatarUrl? },
                           reactions?: MessageReaction[], replyTo?: MessageReplyTo | null }
interface MessageReaction        { emoji: string, userId: string }
interface MessageReplyTo         { id, content, userId, user: { id, name } }

// Social types
interface FriendUser           { id, name, avatarUrl?, verifiedUniversity }
type FriendRelationshipStatus = 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS' | 'BLOCKED' | 'SELF'
interface FriendRelationship   { status: FriendRelationshipStatus, requestId? }
interface FriendRequest        { id, senderId, receiverId, status, createdAt, respondedAt?, sender?, receiver? }
interface DirectMessageThread  { id, otherUser: FriendUser, lastMessage?, updatedAt, hasUnread? }
interface DirectMessage        { id, threadId, senderId, content, createdAt, sender: { id, name, avatarUrl? },
                                 reactions?: DirectMessageReaction[], replyTo?: DirectMessageReplyTo | null }
interface DirectMessageReaction { emoji: string, userId: string }
interface PodInvite            { id, podId, senderId, receiverId, status, createdAt, respondedAt?,
                                 pod?, sender?, receiver? }

// api.ts-only interfaces (not in types.ts)
interface CreatePodOptions            { minMembers?, maxMembers?, meetupTime?, location? }
interface LeavePodResponse            { left: boolean, podDeleted: boolean, pod?: Pod }
interface GetMessagesResponse         { messages: Message[], typingUserIds: string[] }
interface GetThreadMessagesResponse   { messages: DirectMessage[], typingUserIds: string[], otherLastReadAt: string | null }
interface NotificationPreferences     { podJoin: boolean, newMessage: boolean, meetupReminder: boolean }
interface CreateReportPayload         { podId?, messageId?, targetUserId?, reason: string, details? }
interface MyReport                    { id, reason, status, createdAt, podId?, messageId?, targetUserId? }
```

---

#### `frontend/src/context/AuthContext.tsx`
Global auth state. Provided at app root in `App.tsx`.

```typescript
// Consumed via:
const { user, token, signIn, signOut, updateUser,
        isLoading, hasAcceptedGuidelines, acceptGuidelines } = useAuth();

// user: User | null          → null if not logged in or still loading
// token: string | null       → JWT (in-memory mirror of SecureStore value)
// isLoading: boolean         → true during session restore on app launch
// signIn(token, user)        → writes to SecureStore + AsyncStorage, sets state
// signOut()                  → clears SecureStore + AsyncStorage, clears state
// updateUser(partial)        → merges partial into user, persists to AsyncStorage
// acceptGuidelines()         → sets guidelinesAccepted=true in AsyncStorage
```

Token is stored in `expo-secure-store` (key: `'auth_token'`). User object is stored in `AsyncStorage` (key: `'user'`). Legacy migration from old plaintext AsyncStorage `'token'` key runs automatically on first launch.

---

#### `frontend/src/utils/format.ts`
All date/time formatters. **Import from here — do not define formatters inline in screens.**

```typescript
formatPodTime(iso: string): string       // "Sat, Mar 15, 2:00 PM"  — full datetime
formatMeetupTime(iso: string): string    // "Today 2:00 PM" / "Tomorrow 2:00 PM" / "Sat 2:00 PM" / "Mar 15 2:00 PM"
formatThreadTime(dateStr: string): string // "2:34 PM" (today) or "Mar 12" (past)
formatInviteTime(dateStr: string): string // "Mar 15, 2:00 PM"
formatChatDateLabel(iso: string): string  // "Today" / "Yesterday" / "Mon, Mar 10"
```

---

#### `frontend/src/components/ErrorBoundary.tsx`
```typescript
export class ErrorBoundary extends React.Component<PropsWithChildren<{}>, { hasError: boolean }>
// Wraps root of app in App.tsx. Catches render-phase errors and shows a
// "Something went wrong / Try again" fallback instead of a blank screen.
// Must be a class component — hooks cannot catch render errors.
```

---

#### `frontend/App.tsx`
Root component. Structure:
```
<ErrorBoundary>          → catches render errors
  <AuthProvider>         → provides auth context
    <AppNavigator>       → renders login stack or main tab navigator based on auth state
```

Navigation type exports used throughout the app:
```typescript
export type MainTabParamList  // { Today, MyActivities, Search, Messages, Profile }
export type RootStackParamList // all screen names + their params
```

---

#### `frontend/src/theme.ts`
Design system. Import colors, spacing, radii, typography, shadows from here. No hardcoded hex values in screens.

---

### 0.6 — Conventions

**Error responses (backend):** Always `{ error: string }`. Never expose stack traces.

**Happy-path response shape:** No envelope — the backend returns the resource directly (e.g., `res.json(pod)`, `res.json(messages)`), not `{ data: pod }`. The frontend `request<T>()` function returns `data as T` directly.

**Reactions:** Only 5 emoji allowed: 👍 ❤️ 😂 😮 😢. Enforced by composite unique constraint `(messageId, userId, emoji)` in DB.

**UUID validation for route params:** Validate `:id` params before passing to Prisma. Prisma throws cryptic DB errors on non-UUID strings. Pattern: `const UUID_RE = /^[0-9a-f]{8}-...-[0-9a-f]{12}$/i; if (!UUID_RE.test(id)) return res.status(400).json({ error: '...' });`

**Friendship/thread normalization:** Always use `normalizeUserPair(a, b)` before querying `Friendship` or `DirectMessageThread`. This ensures (A,B) and (B,A) resolve to the same row.

**AbortController pattern in screens:**
```typescript
useEffect(() => {
  const controller = new AbortController();
  getSomeData(controller.signal).then(setData).catch(err => {
    if (err.name !== 'AbortError') setError(err);
  });
  return () => controller.abort();
}, []);
```

**Pod status enum:** `'FORMING' | 'LOCKED' | 'COMPLETED'`

**Notification preferences shape:** `{ podJoin: boolean, newMessage: boolean, meetupReminder: boolean }`. Stored as JSON string in `User.notificationPreferences`. Default: all true.

**Email domain validation (backend):** Must match `/^[^@]+@(buckeyemail\.)?osu\.edu$/i`.

**Avatar uploads:** Multipart form (not JSON). Max 5MB, `image/*` MIME type only. Files stored at `backend/uploads/avatars/{userId}-{timestamp}.jpg`. Served statically at `/uploads/avatars/...`.

**Pod meetup time constraints:** Must be ≥1 day and ≤7 days in the future (validated server-side in `routes/pods.ts`).

---

### 0.7 — Environment variables

| Variable | Where | Required | Default | Notes |
|----------|-------|----------|---------|-------|
| `JWT_SECRET` | backend | Yes (non-test) | throws | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `DATABASE_URL` | backend | Yes | — | Supabase pooler URL (for transactions) |
| `DIRECT_URL` | backend | Yes | — | Supabase direct URL (for migrations) |
| `CORS_ORIGIN` | backend | Yes (prod) | `http://localhost:3000` | Throws at startup if missing in production |
| `RESEND_API_KEY` | backend | Yes | — | Email sending |
| `RESEND_FROM_EMAIL` | backend | Yes | — | Verified sender domain |
| `ADMIN_USER_IDS` | backend | No | — | Comma-separated UUIDs for admin access |
| `PORT` | backend | No | `3000` | |
| `NODE_ENV` | backend | No | — | `'test'` skips rate limiting + morgan + requires test JWT secret |
| `EXPO_PUBLIC_API_URL` | frontend | No | `http://localhost:3000` | Inlined at Expo build time |

---

## Part 1: The Big Picture

Bridge has **three layers** that work together:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: MOBILE APP (Frontend)                             │
│  React Native + Expo — runs on the user's phone             │
│  Shows screens, handles taps, displays data                 │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTP requests via fetch()
                           │  "GET /pods/mine" + Authorization: Bearer <jwt>
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: SERVER (Backend)                                  │
│  Express + Node.js — runs on a server                       │
│  Validates JWT → runs business logic → reads/writes DB      │
└──────────────────────────┬──────────────────────────────────┘
                           │  Prisma ORM (parameterized queries, no raw SQL)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: DATABASE                                          │
│  PostgreSQL via Supabase                                    │
│  Tables: User, Pod, PodMember, Message, Block, Friend,      │
│          DirectMessage, Report, PodInvite, NoShowReport…    │
└─────────────────────────────────────────────────────────────┘
```

**Key rule:** The app never talks to the database directly. Every read or write goes through the server, which validates that the request is authorized first.

---

## Part 2: Project Structure

```
Bridge/
├── backend/
│   ├── src/
│   │   ├── server.ts            ← App entry point: middleware, route mounting, error handlers
│   │   ├── prisma.ts            ← Shared Prisma client singleton (one DB connection)
│   │   ├── config/
│   │   │   ├── jwt.ts           ← Reads JWT_SECRET; throws at startup if missing (non-test)
│   │   │   └── locations.ts     ← OSU building names per activity category
│   │   ├── middleware/
│   │   │   ├── auth.ts          ← requireAuth: verifies JWT, attaches req.user
│   │   │   └── admin.ts         ← requireAdmin: checks user ID is in ADMIN_USER_IDS
│   │   ├── routes/
│   │   │   ├── auth.ts          ← Register, login, verify email, resend code
│   │   │   ├── activities.ts    ← List activities, get locations
│   │   │   ├── pods.ts          ← Create/join/leave/lock/unlock pods, feed, pod detail
│   │   │   ├── messages.ts      ← Pod chat: get/send messages, reactions, typing
│   │   │   ├── directMessages.ts← DM threads: list, get, send, mark read, reactions, typing
│   │   │   ├── friends.ts       ← Friend requests, accept/decline, unfriend, relationship
│   │   │   ├── podInvites.ts    ← Invite friend to pod, accept/decline invite
│   │   │   ├── attendance.ts    ← RSVP for locked pod, report no-show
│   │   │   ├── users.ts         ← Profile, avatar, push token, notifications, block, search
│   │   │   ├── reports.ts       ← Create report, list my reports
│   │   │   ├── adminReports.ts  ← Admin: list/update reports
│   │   │   └── web.ts           ← Apple/Android universal link files + pod invite landing page
│   │   ├── services/
│   │   │   ├── friendService.ts ← Friend request business logic (send, accept, decline…)
│   │   │   └── reportService.ts ← Report creation, listing, admin update
│   │   ├── lib/
│   │   │   ├── asyncHandler.ts  ← Wraps async route handlers; forwards errors to middleware
│   │   │   ├── blocks.ts        ← hasBlockingRelationship(), getBlockedUserIds()
│   │   │   ├── friendUtils.ts   ← areFriends(), normalizeUserPair()
│   │   │   ├── emailService.ts  ← Resend email (verification codes)
│   │   │   ├── NotificationService.ts ← Expo push notifications
│   │   │   ├── reminderScheduler.ts   ← Cron: meetup reminders 1 hr before meetup
│   │   │   ├── typingStore.ts   ← In-memory typing indicators (5s TTL, not persisted)
│   │   │   └── reportReasons.ts ← Enum of valid report reasons
│   │   └── test/
│   │       ├── setup.ts         ← Global test setup
│   │       ├── env.ts           ← Sets TEST_DATABASE_URL for test runs
│   │       └── helpers.ts       ← Test utilities (createTestUser, etc.)
│   └── prisma/
│       ├── schema.prisma        ← All table definitions and relationships
│       ├── seed.ts              ← Seeds ~47 sample activities
│       └── migrations/          ← Full schema change history
│
├── frontend/
│   ├── App.tsx                  ← Root: ErrorBoundary + AuthProvider + navigation
│   ├── src/
│   │   ├── api.ts               ← All HTTP calls to backend (single module, token auto-injected)
│   │   ├── types.ts             ← TypeScript interfaces matching backend response shapes
│   │   ├── theme.ts             ← Design system: colors, spacing, typography, shadows
│   │   ├── constants/
│   │   │   └── categories.ts    ← Activity category metadata (icons, colors, labels)
│   │   ├── context/
│   │   │   └── AuthContext.tsx  ← Global auth state; JWT in SecureStore, user in AsyncStorage
│   │   ├── components/
│   │   │   ├── ErrorBoundary.tsx ← Catches render errors; shows fallback instead of blank screen
│   │   │   ├── PodCard.tsx
│   │   │   ├── Avatar.tsx / AvatarStack.tsx
│   │   │   ├── GuidelinesModal.tsx
│   │   │   ├── ReportModal.tsx
│   │   │   └── chat/            ← Chat-specific components (DateSeparator, MessageBubble, etc.)
│   │   ├── screens/
│   │   │   ├── LoginScreen.tsx / RegisterScreen.tsx / VerifyEmailScreen.tsx
│   │   │   ├── ActivityListScreen.tsx  ← Browse activities by category
│   │   │   ├── TodayScreen.tsx         ← "My Activities" — active + past pods
│   │   │   ├── FindAGroupScreen.tsx    ← Discovery feed across all activities
│   │   │   ├── SearchScreen.tsx        ← Filter activities by text + category
│   │   │   ├── ProfileScreen.tsx       ← User info, notification prefs, sign out
│   │   │   ├── PodListScreen.tsx       ← Pods for one activity, sort + join/create
│   │   │   ├── CreatePodScreen.tsx     ← Form: group size, time, location
│   │   │   ├── PodScreen.tsx           ← Pod detail + live chat (polls every 3s)
│   │   │   ├── UserProfileScreen.tsx   ← View another user, friend/block/report
│   │   │   ├── FriendsScreen.tsx       ← Friends list
│   │   │   ├── FriendRequestsScreen.tsx
│   │   │   ├── UserSearchScreen.tsx    ← Search users to send friend requests
│   │   │   ├── MessagesInboxScreen.tsx ← DM thread list
│   │   │   ├── DirectMessageThreadScreen.tsx
│   │   │   ├── PodInvitesScreen.tsx    ← Pending pod invites
│   │   │   └── MyReportsScreen.tsx
│   │   └── utils/
│   │       └── format.ts        ← Shared date/time formatters (import from here, never define inline)
│   └── .env                     ← EXPO_PUBLIC_API_URL (inlined at Expo build time)
│
└── ARCHITECTURE.md              ← This file
```

---

## Part 3: Database Models

All IDs are UUIDs. All tables have `createdAt` / `updatedAt` timestamps unless noted.

### Core models

| Table | Key fields | Notes |
|-------|------------|-------|
| **User** | id, name, email, passwordHash, emailVerified, verificationCode, verificationCodeExpiry, pushToken, avatarUrl, notificationPreferences (JSON string) | Email must be `@osu.edu` or `@buckeyemail.osu.edu` |
| **Activity** | id, title, description, category, defaultLocation | Seeded at startup (50 activities) |
| **Pod** | id, activityId, creatorId, meetupTime, location, locationType, minMembers, maxMembers, status | status: `FORMING` → `LOCKED` → `COMPLETED` |
| **PodMember** | podId + userId (composite PK), joinedAt, confirmedAt | One row per user per pod |
| **Message** | id, podId, userId, content, replyToId?, createdAt | Max 2000 chars |
| **MessageReaction** | messageId + userId + emoji (composite unique) | Only 5 emoji: 👍 ❤️ 😂 😮 😢 |

### Social models

| Table | Key fields | Notes |
|-------|------------|-------|
| **Block** | blockerId + blockedId (composite unique) | Bidirectional by convention in business logic |
| **FriendRequest** | id, senderId, receiverId, status | status: `PENDING` → `ACCEPTED` / `DECLINED` / `CANCELLED` |
| **Friendship** | userAId + userBId (composite unique, pair normalized: userA < userB) | Created atomically with DirectMessageThread when request accepted |
| **DirectMessageThread** | id, userAId, userBId (pair normalized), lastReadAtA, lastReadAtB | One thread per pair |
| **DirectMessage** | id, threadId, senderId, content, replyToId? | Max 2000 chars |
| **DirectMessageReaction** | messageId + userId + emoji (composite unique) | Same 5 emoji |

### Moderation models

| Table | Key fields | Notes |
|-------|------------|-------|
| **PodInvite** | id, podId, inviterId, inviteeId, status | status: `PENDING` → `ACCEPTED` / `DECLINED` / `EXPIRED` |
| **Report** | id, reporterId, targetUserId?, podId?, messageId?, reason, details, status, adminNotes | status: `OPEN` → `REVIEWING` → `RESOLVED` / `DISMISSED` |
| **NoShowReport** | podId + reportedById + reportedUserId (unique) | Upserted; tracks unreliable users |

---

## Part 4: API Routes

All routes require `Authorization: Bearer <token>` except: `POST /auth/register`, `POST /auth/login`, `GET /pod/:podId`, `GET /.well-known/*`.

### Auth (`/auth` — authLimiter: 20 req/15 min)
| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/auth/register` | `{ name, email, password }` | `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` |
| POST | `/auth/verify-email` | `{ code }` | `{ user }` |
| POST | `/auth/resend-verification` | — | `{ message }` |

### Activities
| Method | Path | Query | Returns |
|--------|------|-------|---------|
| GET | `/activities` | `?category=` | `Activity[]` |
| GET | `/activities/locations` | `?category=` | `string[]` |
| GET | `/activities/:id/locations` | — | `string[]` |

### Pods
| Method | Path | Body / Query | Returns |
|--------|------|-------------|---------|
| GET | `/pods/mine` | — | `Pod[]` |
| GET | `/pods/feed` | `?category=&limit=` | `Pod[]` |
| GET | `/pods` | `?activityId=&sort=` | `Pod[]` |
| POST | `/pods/join` | `{ podId }` OR `{ activityId, minMembers?, maxMembers?, meetupTime?, location? }` | `Pod` |
| POST | `/pods/:id/lock` | — | `Pod` |
| POST | `/pods/:id/unlock` | — | `Pod` |
| POST | `/pods/:id/leave` | — | `LeavePodResponse` |
| POST | `/pods/:id/typing` | — | `{ ok }` |
| GET | `/pods/:id` | — | `Pod` |

### Pod Invites
| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/pods/:id/invite` | `{ receiverId }` | `PodInvite` |
| GET | `/pods/invites` | — | `PodInvite[]` |
| POST | `/pods/invites/:id/accept` | — | `Pod` |
| POST | `/pods/invites/:id/decline` | — | `void` |

### Attendance
| Method | Path | Returns |
|--------|------|---------|
| POST | `/pods/:id/confirm` | `{ confirmedAt }` |
| POST | `/pods/:id/no-show/:userId` | `{ reported }` |

### Pod Messages
| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/pods/:id/messages` | — | `{ messages: Message[], typingUserIds: string[] }` |
| POST | `/pods/:id/messages` | `{ content, replyToId? }` | `Message` |
| POST | `/pods/:id/messages/:msgId/reactions` | `{ emoji }` | `Message` |
| DELETE | `/pods/:id/messages/:msgId/reactions` | `?emoji=` | `Message` |

### Direct Messages
| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/messages/threads` | — | `DirectMessageThread[]` |
| GET | `/messages/threads/:id` | — | `{ messages, typingUserIds, otherLastReadAt }` |
| PATCH | `/messages/threads/:id/read` | — | `{ ok }` |
| POST | `/messages/threads/:id/typing` | — | `{ ok }` |
| POST | `/messages/threads/:id/messages` | `{ content, replyToId? }` | `DirectMessage` |
| POST | `/messages/threads/:id/messages/:msgId/reactions` | `{ emoji }` | `DirectMessage` |
| DELETE | `/messages/threads/:id/messages/:msgId/reactions` | `?emoji=` | `DirectMessage` |
| GET | `/messages/threads/by-user/:userId` | — | `{ id, otherUser, updatedAt }` |

### Friends
| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/friends` | — | `FriendUser[]` |
| GET | `/friends/requests` | — | `{ incoming: FriendRequest[], outgoing: FriendRequest[] }` |
| POST | `/friends/requests` | `{ receiverId }` | `FriendRequest` |
| POST | `/friends/requests/:id/accept` | — | `{ ok }` |
| POST | `/friends/requests/:id/decline` | — | `{ ok }` |
| DELETE | `/friends/requests/:id` | — | `void` |
| DELETE | `/friends/:userId` | — | `void` |
| GET | `/friends/relationship/:userId` | — | `FriendRelationship` |

### Users
| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/users/me` | — | `User` |
| PATCH | `/users/me/avatar` | multipart `avatar` file | `{ avatarUrl }` |
| DELETE | `/users/me/avatar` | — | `{ avatarUrl: null }` |
| POST | `/users/push-token` | `{ token }` | `{ success }` |
| GET | `/users/notifications` | — | `{ preferences: NotificationPreferences }` |
| PATCH | `/users/notifications` | `Partial<NotificationPreferences>` | `{ preferences }` |
| GET | `/users/search` | `?q=` | `FriendUser[]` |
| GET | `/users/:id` | — | `PublicProfile` |
| POST | `/users/:id/block` | — | `{ success, blockId?, createdAt? }` |
| DELETE | `/users/:id/block` | — | `{ success? }` |

### Reports
| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/reports` | `{ podId?, messageId?, targetUserId?, reason, details? }` | `{ reportId, status }` |
| GET | `/reports/mine` | — | `MyReport[]` |

### Admin (requires `requireAdmin` middleware — user ID in `ADMIN_USER_IDS`)
| Method | Path | Returns |
|--------|------|---------|
| GET | `/admin/reports` | reports with cursor pagination |
| PATCH | `/admin/reports/:id` | updated report |

### Web / System
| Method | Path | Returns |
|--------|------|---------|
| GET | `/.well-known/apple-app-site-association` | JSON for iOS Universal Links |
| GET | `/.well-known/assetlinks.json` | JSON for Android App Links |
| GET | `/pod/:podId` | HTML pod invite landing page (UUID-validated; public) |
| GET | `/health` | `{ status: 'ok' }` |

---

## Part 5: Authentication & Session

### Login flow

```
User submits email + password
        │
        ▼
POST /auth/login
        ├─ Find user by email in DB
        ├─ bcrypt.compare(password, storedHash)
        ├─ jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' })
        └─ Return { token, user }
        │
        ▼
AuthContext.signIn(token, user)
        ├─ SecureStore.setItemAsync('auth_token', token)   ← encrypted device storage
        ├─ AsyncStorage.setItem('user', JSON.stringify(user)) ← non-sensitive, plain
        ├─ setToken(token)  → api.ts injects into every request's Authorization header
        └─ registerForPushNotifications()  ← best-effort, never blocks sign-in
```

### Email verification

```
POST /auth/register → creates user, sends 6-digit code via Resend email
POST /auth/verify-email { code } → marks emailVerified = true
POST /auth/resend-verification → sends new code (previous expires in 10 minutes)
```

### Session restore (on every app launch)

```
migrateTokenToSecureStore()     ← one-time migration: moves old AsyncStorage token to SecureStore
SecureStore.getItemAsync('auth_token') + AsyncStorage.getItem('user')
        ├─ Both exist + user object valid → restore session (no login needed)
        └─ Missing or corrupted → clear storage, show login screen
```

### 401 handling

`api.ts` calls `onUnauthorized()` when any request returns 401. AuthContext registers `signOut` as the callback. User is sent back to login.

### Protecting routes (server-side)

```typescript
requireAuth middleware:
    ├─ Read "Authorization: Bearer <token>" header
    ├─ jwt.verify(token, JWT_SECRET)
    ├─ Valid → attach req.user = { userId, email }, call next()
    └─ Missing/invalid/expired → 401 { error: "..." }
```

---

## Part 6: Request Flow Example (Join a Pod)

1. User taps "Join Pod" in `PodListScreen`
2. `PodListScreen` calls `joinPod(podId)` from `api.ts`
3. `api.ts` sends: `POST /pods/join` with JWT header + `{ podId }`
4. Express: morgan logs it, `express.json()` parses body, `apiLimiter` checks IP
5. `requireAuth` verifies JWT → attaches `req.user`
6. Route handler in `pods.ts` (wrapped in `asyncHandler`):
   - Checks pod exists, is FORMING, has room
   - Checks user isn't already in a pod for this activity
   - Checks no blocking relationship with any current member (`hasBlockingRelationship`)
   - Creates `PodMember` row
   - If pod is now at `maxMembers`, auto-locks it (status → LOCKED)
   - Sends push notification to creator (fire-and-forget)
   - Returns updated pod
7. `api.ts` returns pod to screen
8. `PodListScreen` navigates to `PodScreen`

If step 6 throws, `asyncHandler` catches it → error middleware returns `{ error: "..." }`.

---

## Part 7: Pod Lifecycle

```
         User creates pod (POST /pods/join with activityId)
                      │
                      ▼
                ┌─────────┐
                │ FORMING │  Open. Anyone can browse and join.
                └────┬────┘  Visible in GET /pods?activityId=
                     │
          Two ways to lock:
          1. Auto-lock when memberCount reaches maxMembers
          2. Creator manually locks (POST /pods/:id/lock)
             — requires memberCount >= minMembers
                     │
                     ▼
                ┌────────┐
                │ LOCKED │  Closed. Hidden from browse list.
                └────┬───┘  Chat active. Can RSVP (confirm attendance).
                     │
          Creator can unlock → back to FORMING (if memberCount < maxMembers)
                     │
          meetupTime passes — detected lazily on next GET /pods/:id
                     │
                     ▼
              ┌───────────┐
              │ COMPLETED │  Read-only. Members can report no-shows.
              └───────────┘
```

**Constraints:** One active pod per activity per user. Leave behavior: empty pod is deleted; creator transferred to earliest remaining member.

---

## Part 8: Create Pod Flow

1. "Start a Pod" → navigate to `CreatePodScreen` (receives activityId + category)
2. User selects: group size chips, meetup time (1–7 days out), location (OSU buildings from `GET /activities/:id/locations`)
3. Submit → `POST /pods/join` with `{ activityId, minMembers, maxMembers, meetupTime, location }`
4. Server creates Pod + adds creator as first PodMember
5. Navigate to `PodScreen`

Locations are defined in `backend/src/config/locations.ts` — a map of `category → string[]`.

---

## Part 9: Chat & Polling

`PodScreen` polls `GET /pods/:id/messages` every **3 seconds** and replaces the local messages array.

**Typing indicators:** `POST /pods/:id/typing` stores userId in `typingStore` with 5s TTL. Returned with the next messages fetch. Not persisted — resets on server restart.

**Message limits:** 2000 chars server-side. Frontend recommends 500.

**Reactions:** 5 allowed emoji (👍 ❤️ 😂 😮 😢). Composite unique constraint prevents duplicate reactions per user per emoji.

**Blocking + access:** 403 returned if you or any pod member have a blocking relationship. Can't join blocked users' pods.

---

## Part 10: Friends & Direct Messages

### Friend request flow

```
A sends request → POST /friends/requests { receiverId: B }
B accepts      → POST /friends/requests/:id/accept
                 ← atomic transaction creates:
                    1. Friendship row (normalizedPair: A<B → userAId=A, userBId=B)
                    2. DirectMessageThread row (same normalized pair)
```

**Blocking cancels friendship:** Creating a block cancels pending requests + removes Friendship.

**Relationship states:** `'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS' | 'BLOCKED' | 'SELF'`. Returned by `GET /friends/relationship/:userId`. Used by `UserProfileScreen` to show the correct button.

### DM requirements

DMs require an existing friendship (checked in `directMessages.ts` using `areFriends()`). The thread is created when the request is accepted — not on first message.

---

## Part 11: Blocking

Block: `POST /users/:id/block` from `UserProfileScreen`.

**What happens on block (atomic server logic):**
1. Cancel pending friend requests between the two users
2. Delete Friendship (if exists)
3. Remove both users from any shared pods
4. If a pod empties → delete pod
5. If creator removed → transfer to earliest remaining member

**After blocking:** No shared pod access, no messaging, no friend requests. Symmetric for visibility.

---

## Part 12: Reports & Moderation

**Create:** `POST /reports { podId?, messageId?, targetUserId?, reason, details? }` → status OPEN.

**Reasons:** `HARASSMENT | HATE | SPAM | NUDITY_SEXUAL | VIOLENCE_THREATS | SELF_HARM | SCAM_FRAUD | ILLEGAL | OTHER`

**Admin:** Users whose IDs are in `ADMIN_USER_IDS` env var. No DB role column.

**Admin workflow:** `GET /admin/reports?status=OPEN` → `PATCH /admin/reports/:id { status, adminNotes }`.

---

## Part 13: Push Notifications

**Registration:** After sign-in, `registerForPushNotifications()` gets permission → Expo token → `POST /users/push-token`. Best-effort, never blocks sign-in.

| Type | Trigger | Recipients |
|------|---------|-----------|
| Pod join | Someone joins | Creator (if not joiner) |
| New message | Message sent | All other pod members |
| Meetup reminder | 1 hr before meetup | All LOCKED pod members |

**Cron:** `reminderScheduler.ts` runs every 5 minutes, finds LOCKED pods with `meetupTime` 55–65 minutes from now.

**Fire and forget:** Notification sends are not awaited. Failures are logged, not thrown.

---

## Part 14: Community Guidelines

`GuidelinesModal` shown on `PodListScreen` before first pod action. Stored in `AsyncStorage` as `guidelinesAccepted`. Once accepted, never shown again.

---

## Part 15: Frontend Architecture

### Error Boundary

```
App
└── ErrorBoundary          ← catches render errors → shows "Try again" screen
    └── AuthProvider       ← provides auth context app-wide
        └── AppNavigator   ← login stack or main tab navigator
```

Must be a class component — hooks cannot catch render errors.

### Navigation structure

```
Not logged in:    Login → Register → VerifyEmail

Logged in (Root Stack):
  MainTabs (bottom tab bar):
    Today / MyActivities / Search / Messages / Profile
  Stack screens:
    PodList, CreatePod, Pod, UserProfile, FindAGroup,
    Friends, FriendRequests, UserSearch,
    DirectMessageThread, PodInvites, MyReports
```

`RootStackParamList` and `MainTabParamList` are exported from `App.tsx` and used throughout for type-safe navigation.

### State management

| What | Where | Storage |
|------|-------|---------|
| Auth (user, token) | `AuthContext` | Token: SecureStore. User: AsyncStorage. |
| HTTP token (in-flight) | `api.ts` module variable | Memory only — set by `setToken()` |
| Screen data | Local `useState` | Memory |
| Guidelines accepted | `AuthContext` | AsyncStorage `guidelinesAccepted` |

No Redux or Zustand.

---

## Part 16: Backend Patterns

### asyncHandler

```typescript
// Wrap every async route handler:
router.get('/path', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique(...);
  res.json(user);
  // If this throws, asyncHandler's .catch(next) sends it to the error middleware
}));
```

### Throwing HTTP errors

```typescript
throw Object.assign(new Error('Pod is full'), { status: 409 });
// → error middleware returns HTTP 409 { "error": "Pod is full" }
```

### Centralized error middleware (bottom of server.ts)

```typescript
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message, err.stack);
  res.status(err.status ?? 500).json({ error: err.message || 'Internal server error' });
});
```

### Service layer

Long business logic with multiple DB steps lives in `src/services/`. Routes stay thin (HTTP concerns only). Services throw errors with a `status` property that the error middleware reads.

### Request logging

Morgan: `'dev'` format in dev, `'combined'` in prod, skipped in test.

---

## Part 17: Security Overview

| Layer | Measure |
|-------|---------|
| Auth | JWT signed with `JWT_SECRET`. Throws at startup if missing. No dev fallback. |
| Token storage | `expo-secure-store` (iOS Keychain / Android Keystore). |
| CORS | Locked to `CORS_ORIGIN` env. Defaults to `localhost:3000` in dev. Throws in prod if unset. Never wildcards. |
| Passwords | bcryptjs, 10 salt rounds. Never stored in plaintext. |
| SQL injection | Impossible — Prisma parameterized queries only, no raw SQL. |
| XSS | Pod landing page: `podId` UUID-validated and `JSON.stringify`'d before embedding in JS template. |
| Rate limiting | Auth: 20/15 min. API: 120/60 sec. Skipped in test. |
| Input validation | Email must be OSU domain. Name ≥ 2 chars, password ≥ 8 chars, messages ≤ 2000 chars. |
| File uploads | Image/* only, 5MB max, UUID-named. |
| Admin access | Checked via `ADMIN_USER_IDS` env var — no DB role column. |
| Error messages | Generic to clients. Detailed logs server-side only (no stack traces in responses). |

---

## Part 18: Key Design Decisions

| Decision | Reason |
|----------|--------|
| **PostgreSQL via Supabase** | Managed hosting, connection pooling, free tier. Prisma abstracts provider. |
| **JWT, stateless auth** | No server-side session storage. Any instance can validate any token. |
| **SecureStore for JWT** | AsyncStorage is plaintext. JWTs are bearer credentials — hardware-backed storage is correct. |
| **Polling for chat** | WebSockets require more infra and reconnect logic. Polling every 3s is fine for small pods. |
| **In-memory typing store** | Typing indicators are ephemeral. No DB persistence needed. Simple TTL map. |
| **Lazy COMPLETED transition** | No background job needed. Status flips on first `GET /pods/:id` after meetupTime. |
| **`EXPO_PUBLIC_API_URL`** | Inlined at build time. Supports dev/staging/prod without code changes. |
| **ErrorBoundary** | Blank white screen in production on uncaught render errors. Boundary catches and recovers. |
| **Normalized friendship pairs** | `userA < userB` always. One row per pair, trivial uniqueness constraint. |
| **asyncHandler + error middleware** | Eliminates copy-paste try-catch. One place handles all unexpected errors. |
| **Fire-and-forget notifications** | Push failures never block API responses. Logged but not retried. |
| **Graceful shutdown** | SIGTERM/SIGINT → `server.close()` → `prisma.$disconnect()` → `process.exit(0)`. |

---

## Part 19: Running the Project

```bash
# Backend
cd backend
cp .env.example .env        # fill in JWT_SECRET, DATABASE_URL, etc.
npm install
npx prisma migrate dev      # run migrations
npx prisma db seed          # seed activities
npm run dev                 # server on port 3000

# Frontend (new terminal)
cd frontend
cp .env.example .env        # set EXPO_PUBLIC_API_URL=http://localhost:3000
npm install
npm start                   # Expo dev server
```

**Physical device:** Set `EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000` in `frontend/.env`.

**Generating a JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Part 20: Testing

- **Backend:** Vitest. `cd backend && npm test`. Connects to `TEST_DATABASE_URL`. `NODE_ENV=test` disables rate limiting, morgan, and accepts the hardcoded test JWT secret.
- **Frontend:** Jest. `cd frontend && npm test`. Mocks native modules.

---

## Suggested Reading Order

**For understanding the system:**
1. `backend/prisma/schema.prisma` — data model first
2. `backend/src/server.ts` — middleware + route wiring
3. `backend/src/middleware/auth.ts` → `backend/src/config/jwt.ts`
4. `backend/src/routes/auth.ts` — register/login handlers
5. `frontend/src/context/AuthContext.tsx` — how token is stored and used
6. `frontend/src/api.ts` — how every call is made
7. Trace one full flow (e.g. join pod: screen → api.ts → route → DB → response)

**For AI sessions:** Start with [Part 0](#part-0-ai-quick-reference) and look up the specific file/function you need.
