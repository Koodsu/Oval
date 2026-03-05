# Bridge — Architecture Guide

**Who is this for?** Junior developers, computer science students, or anyone new to full-stack mobile development. If you've taken an intro programming course and know the basics of variables, functions, and maybe a bit of web development, you're in the right place.

**What is Bridge?** A mobile app for college students to find small groups (2–10 people) for activities like coffee walks, study sessions, or pickup basketball. Users browse activities, create or join "pods" (groups), chat with their pod members, and can report or block users when needed.

---

## Table of Contents

1. [Glossary](#glossary--terms-youll-need)
2. [The Big Picture](#part-1-the-big-picture)
3. [Project Structure](#part-2-project-structure)
4. [Database Models](#part-3-database-models)
5. [API Routes](#part-4-api-routes)
6. [Authentication](#part-5-authentication)
7. [Request Flow Example](#part-6-request-flow-example-join-pod)
8. [Pod Lifecycle](#part-7-pod-lifecycle)
9. [Create Pod Flow](#part-8-create-pod-flow)
10. [Chat & Polling](#part-9-chat--polling)
11. [Blocking](#part-10-blocking)
12. [Reports & Moderation](#part-11-reports--moderation)
13. [Push Notifications](#part-12-push-notifications)
14. [Community Guidelines](#part-13-community-guidelines)
15. [Frontend Architecture](#part-14-frontend-architecture)
16. [Key Design Decisions](#part-15-key-design-decisions)
17. [Running the Project](#part-16-running-the-project)
18. [Testing](#part-17-testing)

---

## Glossary — Terms You'll Need

| Term | Plain English |
|------|----------------|
| **API** | A way for programs to talk to each other. The app sends requests (e.g. "give me my pods") and the server sends back data (JSON). |
| **Endpoint** | A specific URL + HTTP method. Example: `GET /pods/mine` means "fetch my pods." |
| **JWT** | JSON Web Token. A secure string that proves you're logged in. Like a temporary badge — you show it with every request. |
| **ORM** | Object-Relational Mapping. Prisma turns database rows into JavaScript objects so we don't write raw SQL. |
| **Middleware** | Code that runs before your main handler. `requireAuth` checks your JWT before letting you access a route. |
| **Polling** | Asking "any new messages?" every few seconds instead of keeping a live connection (WebSocket). |
| **PK / FK** | Primary Key (unique ID) and Foreign Key (reference to another table's row). |

---

## Part 1: The Big Picture

Bridge has **three layers** that work together:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: MOBILE APP (Frontend)                             │
│  React Native + Expo — runs on your phone                   │
│  Shows screens, handles taps, displays data                 │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTP requests (fetch)
                           │  "GET /pods/mine" with JWT in header
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: SERVER (Backend)                                  │
│  Express + Node.js — runs on a computer                     │
│  Validates JWT, reads/writes database, returns JSON         │
└──────────────────────────┬──────────────────────────────────┘
                           │  Prisma ORM
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: DATABASE                                          │
│  SQLite — a file (dev.db) that stores users, pods, etc.     │
│  Tables: User, Activity, Pod, PodMember, Message, Block, Report │
└─────────────────────────────────────────────────────────────┘
```

**Key idea:** The app never talks to the database directly. It always goes through the server. The server is the gatekeeper.

---

## Part 2: Project Structure

```
Bridge/
├── backend/          ← Server code (Node.js)
│   ├── src/
│   │   ├── server.ts       ← Starts the server, mounts routes, rate limiters
│   │   ├── prisma.ts       ← Database connection (one shared instance)
│   │   ├── middleware/
│   │   │   ├── auth.ts     ← Checks JWT before protected routes
│   │   │   └── admin.ts    ← Checks user is in ADMIN_USER_IDS for admin routes
│   │   ├── routes/
│   │   │   ├── auth.ts     ← Register, login
│   │   │   ├── activities.ts  ← List activities, get locations by category
│   │   │   ├── pods.ts     ← Create/join pods, lock/unlock, leave
│   │   │   ├── messages.ts ← Get/send chat messages
│   │   │   ├── users.ts    ← Block/unblock, push token, notification prefs
│   │   │   ├── reports.ts  ← Create report, list my reports
│   │   │   └── adminReports.ts ← Admin: list/update reports (requires admin)
│   │   ├── services/
│   │   │   └── reportService.ts  ← Report creation and admin logic
│   │   ├── config/
│   │   │   └── locations.ts  ← OSU building names per activity category
│   │   └── lib/
│   │       ├── blocks.ts   ← Blocking logic (who can't see whom)
│   │       ├── reportReasons.ts  ← Valid report reasons and statuses
│   │       ├── NotificationService.ts  ← Expo push notifications
│   │       └── reminderScheduler.ts  ← Cron job for meetup reminders
│   └── prisma/
│       ├── schema.prisma   ← Database table definitions
│       ├── seed.ts         ← Sample activities (~47 items)
│       └── migrations/     ← Schema change history
│
├── frontend/         ← Mobile app (React Native)
│   ├── App.tsx            ← Navigation + auth gate
│   ├── src/
│   │   ├── api.ts         ← All HTTP calls to backend
│   │   ├── types.ts       ← TypeScript interfaces
│   │   ├── theme.ts       ← Colors, spacing, fonts (design system)
│   │   ├── constants/
│   │   │   └── categories.ts  ← Category metadata (icons, colors)
│   │   ├── context/
│   │   │   └── AuthContext.tsx  ← JWT, user, guidelines, persists to storage
│   │   ├── components/    ← Reusable UI (Avatar, PodCard, ReportModal, etc.)
│   │   └── screens/       ← Full screens (Login, Explore, Pod, Profile, etc.)
│   └── package.json
│
└── ARCHITECTURE.md   ← You are here
```

---

## Part 3: Database Models

| Table | Purpose |
|-------|---------|
| **User** | id, name, email, hashed password, pushToken, notificationPreferences (JSON) |
| **Activity** | id, title, description, category, defaultLocation |
| **Pod** | id, activityId, meetupTime, location, locationType, minMembers, maxMembers, status, creatorId |
| **PodMember** | Links users to pods (who's in which pod). One user per pod max. |
| **Message** | Chat: podId, userId, content, createdAt |
| **Block** | blockerId, blockedId — blocked users can't join each other's pods or see messages |
| **Report** | reporterId, targetUserId?, podId?, messageId?, reason, details, status, adminNotes |

**Pod status flow:** FORMING → (auto when full, or creator locks) → LOCKED → (when meetupTime passes, checked on read) → COMPLETED

**Report statuses:** OPEN, REVIEWING, RESOLVED, DISMISSED

---

## Part 4: API Routes

All routes except `/auth/register` and `/auth/login` require a valid JWT.

### Auth
| Method | Path | Purpose |
|--------|------|---------|
| POST | /auth/register | Create account (name, email, password) |
| POST | /auth/login | Log in (email, password) |

### Activities
| Method | Path | Purpose |
|--------|------|---------|
| GET | /activities | List activities (optional ?category=) |
| GET | /activities/locations?category= | Get OSU buildings for a category |
| GET | /activities/:id/locations | Get locations for an activity's category |

### Pods
| Method | Path | Purpose |
|--------|------|---------|
| GET | /pods/mine | My pods (excludes pods with blocked users) |
| GET | /pods?activityId=&sort= | Pods for an activity (FORMING only). sort: date_posted, starting_soon, most_members |
| POST | /pods/join | Join pod `{ podId }` or create pod `{ activityId, minMembers?, maxMembers?, meetupTime?, location? }` |
| POST | /pods/:id/lock | Lock pod (creator only) |
| POST | /pods/:id/unlock | Unlock pod (creator only) |
| POST | /pods/:id/leave | Leave pod |
| GET | /pods/:id | Get pod details |

### Messages
| Method | Path | Purpose |
|--------|------|---------|
| GET | /pods/:id/messages | Get messages |
| POST | /pods/:id/messages | Send message `{ content }` |

### Users
| Method | Path | Purpose |
|--------|------|---------|
| POST | /users/push-token | Register Expo push token `{ token }` |
| PATCH | /users/notifications | Update notification prefs `{ podJoin?, newMessage?, meetupReminder? }` |
| POST | /users/:id/block | Block user |
| DELETE | /users/:id/block | Unblock user |

### Reports
| Method | Path | Purpose |
|--------|------|---------|
| POST | /reports | Create report (podId?, messageId?, targetUserId?, reason, details?) |
| GET | /reports/mine | List my reports |

### Admin (requires ADMIN_USER_IDS env)
| Method | Path | Purpose |
|--------|------|---------|
| GET | /admin/reports | List reports (?status=, ?limit=, ?cursor=) |
| PATCH | /admin/reports/:id | Update report (status, adminNotes) |

### Health
| Method | Path | Purpose |
|--------|------|---------|
| GET | /health | Health check |

---

## Part 5: Authentication

```
User enters email + password
        │
        ▼
POST /auth/login  { email, password }
        │
        ├─ Find user by email
        ├─ bcrypt.compare(password, storedHash)
        ├─ If valid: jwt.sign({ userId, email }, secret, { expiresIn: '7d' })
        └─ Return { token, user: { id, name, email } }
        │
        ▼
AuthContext.signIn(token, user)
        ├─ AsyncStorage.multiSet(['token', token], ['user', JSON.stringify(user)])
        ├─ setToken(token)  ← api.ts uses this for every request
        ├─ setUser(user)    ← Navigation shows app screens
        └─ registerForPushNotifications()  ← Best-effort, doesn't block
```

**Session restore:** On app launch, AuthContext reads from AsyncStorage. If token and user exist, it restores the session so the user doesn't have to log in again.

**401 handling:** If any request returns 401 (expired/invalid token), `api.ts` calls `onUnauthorized`, which triggers `signOut` in AuthContext. User is sent back to login.

**Validation:** Registration requires name (≥2 chars), valid email format, password (≥8 chars). Login validates email format.

---

## Part 6: Request Flow Example (Join Pod)

1. **User taps "Join Pod"** on a pod card (after accepting guidelines if first time).
2. **PodListScreen** calls `joinPod(podId)` from `api.ts`.
3. **api.ts** sends `POST /pods/join` with `{ podId }` and `Authorization: Bearer <jwt>`.
4. **Express** receives the request. `express.json()` parses the body. Rate limiter allows it.
5. **requireAuth middleware** runs: verifies JWT, attaches `req.user`, or returns 401.
6. **Route handler** (in `pods.ts`):
   - Checks pod exists, is FORMING, has room
   - Checks user isn't already in an active pod for this activity
   - Checks no blocking relationship with any pod member
   - Creates PodMember row
   - If pod is now full, updates status to LOCKED
   - Calls `NotificationService.notifyPodJoin()` for the creator
   - Returns the updated pod
7. **api.ts** receives the response, returns it to the screen.
8. **PodListScreen** calls `navigation.replace('Pod', { podId })` — user sees the pod chat.

---

## Part 7: Pod Lifecycle

```
         User creates pod
               │
               ▼
          ┌─────────┐
          │ FORMING │  ← open, anyone can join (until full)
          └────┬────┘
               │  Auto-lock: memberCount >= maxMembers
               │  Manual lock: creator taps "Lock Pod" when memberCount >= minMembers
               ▼
          ┌────────┐
          │ LOCKED │  ← closed, hidden from browse list, chat active
          └────┬───┘
               │  Creator can unlock (if memberCount < maxMembers) → back to FORMING
               │  meetupTime < now (checked lazily on GET /pods/:id)
               ▼
         ┌───────────┐
         │ COMPLETED │  ← meetup happened, read-only (final state)
         └───────────┘
```

**One active pod per activity per user:** You can't join a second FORMING/LOCKED pod for the same activity. The server returns 409 Conflict.

**Browse list shows only FORMING pods:** Locked pods disappear from `GET /pods?activityId=`.

**Leave pod:** When you leave, you're removed from the pod. If you were the last member, the pod is deleted. If you were the creator, the next member by join date becomes creator.

---

## Part 8: Create Pod Flow

When a user taps "Start a Pod" on PodListScreen:

1. Navigate to **CreatePodScreen** with activityId, activityTitle, activityCategory.
2. User selects:
   - **Group size** — preset chips (2–3, 2–4, 3–6, etc., up to 5–10)
   - **Meetup time** — date/time picker, max 1 week out
   - **Location** — OSU building chips from `GET /activities/:id/locations`
3. Submit → `POST /pods/join` with `{ activityId, minMembers, maxMembers, meetupTime, location }`.
4. Server creates Pod, adds creator as first member, returns pod.
5. Navigate to Pod screen.

Locations come from `config/locations.ts`, which maps each activity category to a list of OSU buildings.

---

## Part 9: Chat — Polling

Every 3 seconds, **PodScreen** calls `GET /pods/:id/messages` and replaces the local messages array. Simple and reliable. No WebSocket.

**Why polling?** WebSockets require extra infrastructure and reconnection handling. For small groups and modest message volume, polling every 3 seconds is sufficient and easier to debug.

**Message limits:** Frontend suggests 500 chars; backend enforces 2000 max.

**Blocking:** If you've blocked (or been blocked by) any pod member, you can't view or send messages in that pod. The server returns 403.

---

## Part 10: Blocking

Users can block other users from **UserProfileScreen** (reached by tapping a member's avatar in PodScreen or PodCard).

**What happens when you block someone:**
- Both users are removed from any shared pods
- If a pod becomes empty, it's deleted
- If the creator was removed, the next member by join date becomes creator
- Blocked users can't join each other's pods (checked on join)
- Blocked users can't view or send messages in shared pods

Blocking is **bidirectional** for visibility: if A blocks B, both A and B are considered "blocked" for the purpose of hiding pods and messages. Neither sees the other in pod lists or chat.

---

## Part 11: Reports & Moderation

Users can report **messages**, **pods**, or **users** from:
- **PodScreen** — long-press a message → Report, or Report pod from header
- **UserProfileScreen** — Report User button

**Report reasons:** HARASSMENT, HATE, SPAM, NUDITY_SEXUAL, VIOLENCE_THREATS, SELF_HARM, SCAM_FRAUD, ILLEGAL, OTHER.

**Flow:**
1. User opens ReportModal, selects reason, optionally adds details.
2. `POST /reports` creates a Report row (status OPEN).
3. User can view their reports in **My Reports** (Profile → My Reports).
4. Admins (users whose IDs are in `ADMIN_USER_IDS` env) can:
   - `GET /admin/reports` — list reports with filters
   - `PATCH /admin/reports/:id` — update status (OPEN, REVIEWING, RESOLVED, DISMISSED) and adminNotes

---

## Part 12: Push Notifications

**Registration:** After sign-in, AuthContext calls `registerForPushNotifications()` which requests permission, gets an Expo push token, and sends it via `POST /users/push-token`. Best-effort — never blocks sign-in.

**Notification types:**
| Type | When | Recipients |
|------|------|------------|
| Pod join | Someone joins your pod | Pod creator (if joiner ≠ creator) |
| New message | Someone sends a message in a pod | All other pod members |
| Meetup reminder | 1 hour before meetup | All pod members (LOCKED pods only) |

**Preferences:** Users can toggle each type in Profile → Notifications. Stored as JSON in `User.notificationPreferences`. Default: all on.

**Meetup reminders:** A cron job in `reminderScheduler.ts` runs every 5 minutes. It finds LOCKED pods whose meetupTime is 55–65 minutes from now and sends reminders to members who have `meetupReminder: true`.

---

## Part 13: Community Guidelines

Before joining or creating a pod for the first time, users must accept community guidelines via **GuidelinesModal** (shown on PodListScreen). Guidelines cover: be respectful, show up, keep it safe, stay on topic, report issues.

**Persistence:** `hasAcceptedGuidelines` is stored in AsyncStorage (`guidelinesAccepted`). Once accepted, the modal is not shown again.

---

## Part 14: Frontend Architecture

### Navigation

- **Not logged in:** Login and Register screens only.
- **Logged in:** Main tabs (Explore, My Activities, Search, Profile) + stack screens (PodList, CreatePod, Pod, UserProfile, MyReports).

### Screens Overview

| Screen | Purpose |
|--------|---------|
| LoginScreen / RegisterScreen | Auth |
| ActivityListScreen (Explore) | Browse activities, category filter |
| MyActivitiesScreen | User's pods grouped as Active / Past |
| SearchScreen | Filter activities by text + category |
| ProfileScreen | User info, stats, notification prefs, My Reports link, sign out |
| PodListScreen | Pods for one activity, sort options, Start a Pod, Join Pod |
| CreatePodScreen | Form: group size, meetup time, location |
| PodScreen | Pod detail, chat, Lock/Unlock (creator), Leave, Report |
| UserProfileScreen | View another user, Block, Report |
| MyReportsScreen | List of reports user has submitted |

### State

- **AuthContext:** Global. Holds `user`, `token`, `signIn`, `signOut`, `updateUser`, `isLoading`, `hasAcceptedGuidelines`, `acceptGuidelines`. Persists to AsyncStorage.
- **api.ts:** Module-level `authToken`. `request()` adds it to every request. Not React state.
- **Screens:** Local `useState` for data. Each screen fetches its own data.

### Design System (theme.ts)

All colors, spacing, font sizes, and shadows live in one file. Screens import from `theme.ts` — no hardcoded hex values.

---

## Part 15: Key Design Decisions

| Decision | Reason |
|----------|--------|
| **SQLite** | Zero setup. Single file. Easy for local dev. Can switch to PostgreSQL later. |
| **JWT with 7-day expiry** | Stateless auth. Server doesn't store sessions. Token proves identity. |
| **Rate limiting** | Auth: 20 req/15 min. API: 120 req/min. Prevents abuse. |
| **Activities require auth** | All routes except auth need JWT. Keeps catalog behind login. |
| **CORS enabled** | Allows requests from different origins (Expo web, different ports). |
| **Message max 2000 chars** | Prevents abuse. Frontend limits to 500; backend enforces 2000. |
| **Block model** | Users can block others. Blocked users can't join shared pods or see messages. |
| **Report model** | Users can report messages, pods, or users. Admins review via ADMIN_USER_IDS. |
| **Expo push** | Cross-platform push notifications without separate FCM/APNs setup. |
| **Graceful shutdown** | On SIGTERM/SIGINT, server closes connections and Prisma disconnects cleanly. |

---

## Part 16: Running the Project

```bash
# Backend
cd backend
npm install
npx prisma migrate dev   # Create DB, run migrations, seed
npm run dev             # Start server on port 3000

# Frontend (separate terminal)
cd frontend
npm install
npm start               # Expo dev server
```

**Environment:** Copy `backend/.env.example` to `backend/.env`. Set `JWT_SECRET` (required in production). Optionally set `ADMIN_USER_IDS` (comma-separated user IDs) for report moderation.

For physical device testing, change `API_BASE` in `frontend/src/api.ts` to your machine's LAN IP (e.g. `http://192.168.1.100:3000`).

---

## Part 17: Testing

- **Backend:** Vitest. Run `cd backend && npm run test`. Tests use a separate SQLite DB (`test.db`), seeded before each run.
- **Frontend:** Jest. Run `cd frontend && npm run test`. Mocks expo-haptics and expo-linear-gradient.

---

## Summary

Bridge is a **client–server** app: the mobile client (React Native) talks to an Express server over HTTP. The server uses Prisma to read/write SQLite. Auth is JWT-based. All protected routes go through `requireAuth` middleware. The frontend uses a single `api.ts` module for all HTTP calls, with the token injected automatically. Chat uses polling. Push notifications cover pod joins, new messages, and meetup reminders. Users can block and report others; admins can review reports. The design system lives in `theme.ts`.

**Suggested reading order:** `server.ts` → `routes/auth.ts` → `api.ts` and `AuthContext.tsx` → trace one flow (e.g. login or join pod) from UI tap to database and back.
