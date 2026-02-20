# Bridge v0.1 — Architecture

Bridge is a structured micro-group formation app for college students. Users browse activities, join or create pods of up to 4 people, meet up, and chat within their pod. This document explains how everything is built and why.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Repository Structure](#2-repository-structure)
3. [Backend Structure](#3-backend-structure)
4. [Database Models](#4-database-models)
5. [API Routes](#5-api-routes)
6. [Auth Flow](#6-auth-flow)
7. [Pod Lifecycle](#7-pod-lifecycle)
8. [Frontend Structure](#8-frontend-structure)
9. [Navigation Structure](#9-navigation-structure)
10. [State Management](#10-state-management)
11. [How Frontend Talks to Backend](#11-how-frontend-talks-to-backend)
12. [API Request Lifecycle](#12-api-request-lifecycle)
13. [Chat — Polling Architecture](#13-chat--polling-architecture)
14. [Key Design Decisions](#14-key-design-decisions)

---

## 1. High-Level Overview

```
┌─────────────────────────────────────────────────────┐
│                  React Native App                   │
│              (Expo SDK 54, TypeScript)               │
│                                                     │
│  AuthContext  →  api.ts  →  fetch()                 │
└─────────────────────┬───────────────────────────────┘
                      │  HTTP/JSON over localhost:3000
                      │  Authorization: Bearer <jwt>
┌─────────────────────▼───────────────────────────────┐
│                Express Server                       │
│              (Node.js, TypeScript)                  │
│                                                     │
│  middleware/auth.ts  →  routes/  →  Prisma Client   │
└─────────────────────────────────┬───────────────────┘
                                  │  Prisma ORM
┌─────────────────────────────────▼───────────────────┐
│              SQLite Database (dev.db)               │
│         5 tables: User, Activity, Pod,              │
│                   PodMember, Message                │
└─────────────────────────────────────────────────────┘
```

The frontend and backend are separate workspaces within the same repo. They communicate over a local HTTP connection. There is no WebSocket layer — chat uses polling.

---

## 2. Repository Structure

```
Bridge/                        ← git repo root
  .gitignore
  README.md
  ARCHITECTURE.md
  backend/
    src/
      server.ts                ← Express app entry point
      prisma.ts                ← Singleton PrismaClient
      middleware/
        auth.ts                ← JWT verification middleware
      routes/
        auth.ts                ← POST /auth/register, /login
        activities.ts          ← GET /activities
        pods.ts                ← GET /pods, POST /pods/join, GET /pods/:id
        messages.ts            ← GET/POST /pods/:id/messages
    prisma/
      schema.prisma            ← Database schema
      seed.ts                  ← Activity seed data
      dev.db                   ← SQLite database file (gitignored)
      migrations/              ← Prisma migration history
    package.json
    tsconfig.json
  frontend/
    App.tsx                    ← Navigation root + AuthProvider
    index.ts                   ← Expo entry point
    src/
      api.ts                   ← All HTTP calls to backend
      types.ts                 ← Shared TypeScript interfaces
      context/
        AuthContext.tsx         ← JWT + user session state
      screens/
        LoginScreen.tsx
        RegisterScreen.tsx
        ActivityListScreen.tsx
        PodListScreen.tsx
        PodScreen.tsx
    package.json
    tsconfig.json
```

---

## 3. Backend Structure

The backend is a flat Express application. No microservices, no separate layers — just a single server with four route files.

### Entry Point — `server.ts`

```
express.json()           ← parse JSON request bodies
  ├─ /auth              ← authRoutes
  ├─ /activities        ← activitiesRoutes
  ├─ /pods              ← podsRoutes
  ├─ /pods/:id/messages ← messagesRoutes (mergeParams: true)
  └─ /health            ← { status: 'ok' }
```

The messages router is mounted separately at `/pods/:id/messages` with `mergeParams: true`. This allows the messages route handler to read `:id` from the parent path, even though the router itself only defines `/` and `/`.

### Prisma Singleton — `prisma.ts`

```typescript
const prisma = new PrismaClient();
export default prisma;
```

A single `PrismaClient` instance is created once and imported by every route file. Creating multiple instances in a Node process causes connection pool exhaustion; the singleton pattern prevents this.

### Auth Middleware — `middleware/auth.ts`

Every protected route passes through `requireAuth` before the handler runs. It reads the JWT from the `Authorization` header, verifies it, and attaches `req.user = { userId, email }` to the request object. The extended `AuthRequest` type makes `req.user` available with TypeScript type safety in route handlers.

---

## 4. Database Models

The schema lives in `prisma/schema.prisma` with SQLite as the provider.

```
┌──────────┐       ┌──────────┐       ┌───────────┐
│   User   │       │ Activity │       │    Pod    │
├──────────┤       ├──────────┤       ├───────────┤
│ id (PK)  │       │ id (PK)  │       │ id (PK)   │
│ name     │       │ title    │       │ activityId│──→ Activity
│ email    │       │ desc     │       │ meetupTime│
│ password │       │ location │       │ location  │
│ createdAt│       │ createdAt│       │ status    │
└────┬─────┘       └──────────┘       │ createdAt │
     │                                └─────┬─────┘
     │         ┌──────────────┐             │
     └────────→│  PodMember   │←────────────┘
               ├──────────────┤
               │ id (PK)      │
               │ podId (FK)   │
               │ userId (FK)  │
               │ joinedAt     │
               │ UNIQUE(pod,  │
               │   user)      │
               └──────────────┘

     ┌──────────────────────────────┐
     │           Message            │
     ├──────────────────────────────┤
     │ id (PK)                      │
     │ podId (FK) ─────────────────→ Pod
     │ userId (FK) ────────────────→ User
     │ content                      │
     │ createdAt                    │
     └──────────────────────────────┘
```

### Key constraints

- `User.email` has a `@unique` index — no duplicate accounts
- `PodMember` has `@@unique([podId, userId])` — a user can only be in a given pod once; the database enforces this, not just the application
- `Pod.status` is a plain `String` field (not an enum). SQLite does not support Prisma enums. Valid values are enforced in application code as the constants `"FORMING"`, `"LOCKED"`, and `"COMPLETED"`
- All primary keys are UUIDs generated by the application (`@default(uuid())`), not auto-increment integers. This is safer for distributed systems and avoids leaking record counts

### Seed data

`prisma/seed.ts` inserts 5 activities on first run (Morning Coffee Walk, Study Group Sprint, Frisbee on the Lawn, Lunch Together, Evening Campus Walk). The seed is idempotent: it checks if any activities exist before inserting. The Prisma `"seed"` script in `package.json` means `prisma migrate dev` runs the seed automatically after applying migrations.

---

## 5. API Routes

All routes except `/auth/register` and `/auth/login` require a valid JWT.

```
Auth
  POST /auth/register         body: { name, email, password }
  POST /auth/login            body: { email, password }

Activities
  GET  /activities            → Activity[]

Pods
  GET  /pods?activityId=      → Pod[] (all pods for an activity)
  POST /pods/join             body: { podId }      → join existing pod
                              body: { activityId } → create new pod
  GET  /pods/:id              → Pod (with lazy COMPLETED check)

Messages
  GET  /pods/:id/messages     → Message[]
  POST /pods/:id/messages     body: { content } → Message
```

### Response shapes

Every successful response returns JSON. Errors return `{ error: string }` with an appropriate HTTP status code. Pod responses always include the nested `activity` object and `members` array (each member includes `user.id` and `user.name`). Message responses include `user.id` and `user.name`. Passwords are never returned.

---

## 6. Auth Flow

```
Register / Login
       │
       ▼
  POST /auth/register or /auth/login
       │
       ├─ register: hash password (bcrypt, salt 10)
       │            create User row
       │
       ├─ login:    find user by email
       │            bcrypt.compare(password, hash)
       │
       └─ both: jwt.sign({ userId, email }, secret, { expiresIn: '7d' })
                return { token, user: { id, name, email } }

Client receives token
       │
       ▼
  AuthContext.signIn(token, user)
       ├─ AsyncStorage.multiSet(['token', ...], ['user', ...])
       ├─ setToken(token)  ← injects into api.ts module scope
       └─ setUser(user)    ← triggers navigation re-render to app screens

Every subsequent request
       │
       ▼
  api.ts request() function
       └─ headers['Authorization'] = `Bearer ${authToken}`

Server receives request
       │
       ▼
  requireAuth middleware
       ├─ reads Authorization header
       ├─ jwt.verify(token, secret)
       ├─ attaches req.user = { userId, email }
       └─ calls next() → route handler runs
```

On app launch, `AuthContext` runs `AsyncStorage.multiGet(['token', 'user'])`. If both exist, the session is restored: `setToken()` is called (so `api.ts` has the token in memory) and `setUser()` is called (so navigation shows app screens instead of auth screens). The `isLoading` flag prevents any screen from rendering until this check completes, avoiding a flash of the login screen for already-authenticated users.

JWT secret defaults to `'bridge_dev_secret'` if the `JWT_SECRET` environment variable is not set, so no `.env` file is required to run locally.

---

## 7. Pod Lifecycle

A pod moves through three states in one direction only — it never goes backward.

```
         User creates pod
               │
               ▼
          ┌─────────┐
          │ FORMING │  ← open, 1–3 members, anyone can join
          └────┬────┘
               │  4th member joins
               ▼
          ┌────────┐
          │ LOCKED │  ← closed, no new members, chat active
          └────┬───┘
               │  meetupTime < now  (checked lazily on GET /pods/:id)
               ▼
         ┌───────────┐
         │ COMPLETED │  ← meetup happened, read-only
         └───────────┘
```

### FORMING → LOCKED (eager, on join)

When `POST /pods/join` adds a member, it immediately counts total members with `prisma.podMember.count()`. If the count reaches 4, it runs `prisma.pod.update({ status: 'LOCKED' })` in the same request before returning. The locking is synchronous within the request — the response the client receives already reflects the locked state.

### LOCKED → COMPLETED (lazy, on read)

There is no background job or cron. Instead, `GET /pods/:id` checks:

```typescript
if (pod.status === 'LOCKED' && pod.meetupTime < new Date()) {
  pod = await prisma.pod.update({ status: 'COMPLETED', ... });
}
```

The transition happens the first time any client fetches the pod after the meetup time passes. This is called lazy evaluation — state is updated on demand rather than proactively. It is simpler to reason about and requires no scheduler, at the cost of the status being slightly stale until someone reads it.

### One active pod per activity per user

Both join paths in `POST /pods/join` check for an existing active membership before proceeding:

```typescript
prisma.podMember.findFirst({
  where: {
    userId,
    pod: { activityId, status: { in: ['FORMING', 'LOCKED'] } }
  }
})
```

If a match is found, the request returns 409 Conflict. A user can be in multiple pods across different activities, but only one active pod per activity.

---

## 8. Frontend Structure

### File responsibilities

| File | Responsibility |
|------|---------------|
| `App.tsx` | Navigation container, route definitions, auth gate |
| `src/types.ts` | TypeScript interfaces matching backend response shapes |
| `src/api.ts` | All HTTP calls, token injection, error normalization |
| `src/context/AuthContext.tsx` | Session persistence, sign in/out, `useAuth()` hook |
| `src/screens/LoginScreen.tsx` | Email + password login form |
| `src/screens/RegisterScreen.tsx` | Name + email + password registration form |
| `src/screens/ActivityListScreen.tsx` | Browse all activities |
| `src/screens/PodListScreen.tsx` | All pods for one activity, create/join actions |
| `src/screens/PodScreen.tsx` | Pod detail, member list, chat with polling |

### Screen responsibilities

**ActivityListScreen** — fetches and lists all activities. Each card is tappable and navigates to `PodListScreen`, passing `activityId` and `activityTitle` as params. No join logic here — this screen is purely a directory.

**PodListScreen** — fetches all pods for the given activity. Sorts them FORMING → LOCKED → COMPLETED. Renders a "Create a New Pod" button at the top and a card for each pod. Each card shows the status, member count, member name chips with empty "open" slots for remaining spots, meetup time, and location. The action button on a card adapts: "Join Pod" if joinable, "View Pod →" if already a member, nothing if full or not FORMING.

**PodScreen** — the core experience screen. On mount, fetches pod info and messages in parallel, then starts a 3-second polling interval for messages. The interval is stored in a `useRef` and cleaned up in the `useEffect` return function when the component unmounts. Chat messages are displayed in a `FlatList` with auto-scroll on new content. Sending a message optimistically appends it to local state while the API call is in flight.

---

## 9. Navigation Structure

React Navigation v7 with a single native stack navigator. The stack is conditionally populated based on whether a `user` exists in `AuthContext`.

```
App
 └─ AuthProvider
      └─ AppNavigator
           └─ NavigationContainer
                └─ Stack.Navigator
                      │
                      ├─ [user === null]
                      │    ├─ Login         (no header)
                      │    └─ Register
                      │
                      └─ [user !== null]
                           ├─ ActivityList  (no header — custom header in component)
                           ├─ PodList       (header title = activityTitle param)
                           └─ Pod           (header title = "Your Pod")
```

### Route params

```typescript
type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ActivityList: undefined;
  PodList: { activityId: string; activityTitle: string };
  Pod: { podId: string };
};
```

Params are typed end-to-end: passing wrong params or missing a required param is a TypeScript compile error. Each screen declares its props as `NativeStackScreenProps<RootStackParamList, 'ScreenName'>`, which gives typed access to both `navigation` and `route.params`.

### Auth gate mechanism

`AppNavigator` reads `user` from `AuthContext`. When `user` is `null`, only `Login` and `Register` exist in the stack — there is no way to navigate to app screens. When `user` is set (after sign-in or session restore), only `ActivityList`, `PodList`, and `Pod` exist. React Navigation automatically shows the first screen in whichever set is active. This means there is no explicit `navigate('Login')` or `navigate('ActivityList')` call on auth state change — the navigator re-renders with a different set of screens and snaps to the first one.

### `navigation.replace` vs `navigation.navigate`

After joining or creating a pod, `PodListScreen` uses `navigation.replace('Pod', ...)` instead of `navigation.navigate`. This replaces the current screen in the stack rather than pushing on top of it, so pressing back from the Pod screen returns to the Activity List instead of the Pod List. This prevents the user from accidentally pressing back and re-joining.

---

## 10. State Management

Bridge uses no external state management library (no Redux, no Zustand). All state is local React state or React Context.

### AuthContext

The only piece of truly global state is the authenticated session. It is stored in `AuthContext` because it needs to be read in two completely different places: `AppNavigator` (to decide which screens to show) and individual screens (to get `user.id` for identifying your own messages or the current user's name).

`AuthContext` also bridges two different storage systems:
- `AsyncStorage` — persistent across app restarts (the source of truth on disk)
- `api.ts` module variable `authToken` — the token in memory that gets injected into every HTTP request

Both are kept in sync by `signIn` and `signOut`.

### Local component state

Everything else is local `useState` in each screen:
- `activities`, `pods`, `messages` — data fetched from the API
- `loading`, `refreshing`, `sending` — UI state for loading indicators
- `joiningId`, `actionId` — which item is currently being acted on (for per-button loading states)
- `messageText` — the controlled input value for the chat box

### No prop drilling

Screens access `useAuth()` directly rather than receiving user data as props. API functions are imported directly rather than injected. This keeps screens self-contained and easy to reason about.

---

## 11. How Frontend Talks to Backend

All communication goes through `src/api.ts`. No screen ever calls `fetch()` directly.

### The `request()` function

```typescript
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data as T;
}
```

This wrapper handles three things:
1. **Base URL** — `API_BASE` is `http://localhost:3000`. Change it to your machine's LAN IP when testing on a physical device
2. **Auth injection** — if `authToken` is set in module scope, it is added to every request automatically. Screens do not need to pass the token manually
3. **Error normalization** — non-2xx responses throw a JS `Error` with the server's error message. Screens catch this and show an `Alert`

### Token lifecycle in module scope

`authToken` is a module-level variable in `api.ts`, not React state. This means it does not trigger re-renders when it changes, which is the desired behavior — token changes should affect HTTP calls, not component trees. `AuthContext` calls `setToken()` to write into this variable whenever the user signs in or out.

---

## 12. API Request Lifecycle

A complete trace of what happens when a user taps "Join Pod":

```
1. User taps "Join Pod" button in PodListScreen
   └─ setActionId(pod.id)  ← disables button, shows spinner

2. joinPod(pod.id) called in api.ts
   └─ request<Pod>('/pods/join', { method: 'POST', body: JSON.stringify({ podId }) })

3. fetch() sends:
   POST http://localhost:3000/pods/join
   Content-Type: application/json
   Authorization: Bearer eyJhbGci...
   Body: { "podId": "abc-123" }

4. Express receives request
   └─ express.json() parses body
   └─ router matches POST /pods/join
   └─ requireAuth middleware runs:
        ├─ reads Authorization header
        ├─ jwt.verify(token, secret) → { userId, email }
        ├─ req.user = { userId, email }
        └─ next()

5. Route handler runs (pods.ts)
   ├─ reads podId from req.body
   ├─ prisma.pod.findUnique(podId) → validates pod exists, is FORMING, has room
   ├─ prisma.podMember.findFirst() → validates user not already in active pod
   ├─ prisma.podMember.create({ podId, userId }) → adds user
   ├─ prisma.podMember.count() → if 4, update pod status to LOCKED
   └─ prisma.pod.findUnique() → fetch full pod with activity + members

6. Response sent:
   HTTP 201 Created
   { id, activityId, status: "LOCKED", members: [...], activity: {...}, ... }

7. fetch() resolves in api.ts
   └─ res.ok → return data as Pod

8. joinPod() resolves in PodListScreen
   └─ navigation.replace('Pod', { podId: pod.id })

9. PodScreen mounts
   └─ fetches pod + messages
   └─ starts 3-second polling interval
```

---

## 13. Chat — Polling Architecture

Bridge uses HTTP polling rather than WebSockets. Every 3 seconds, `PodScreen` calls `GET /pods/:id/messages` and replaces the local messages array with the server response.

```
PodScreen mounts
    │
    ▼
useEffect runs
    ├─ fetchPod()      → GET /pods/:id
    ├─ fetchMessages() → GET /pods/:id/messages
    └─ setInterval(fetchMessages, 3000)
              │
              │  every 3 seconds:
              ▼
         fetchMessages()
              └─ GET /pods/:id/messages
              └─ setMessages(data)  ← replaces entire array

PodScreen unmounts
    └─ clearInterval(pollRef.current)
```

### Why the full array is replaced, not merged

`setMessages(data)` replaces the entire array on every poll rather than diffing and merging. This keeps the logic simple and correct: if a message is deleted on the server (unlikely in v0.1 but possible), it disappears from the client automatically. The downside is a brief re-render every 3 seconds even if nothing changed. For a pod of 4 people with modest message history, this is not a performance concern.

### Sending a message

When the user taps Send, the message is immediately appended to local state (`setMessages(prev => [...prev, msg])`) after the API confirms it was saved. The input is cleared before the API call resolves so the UI feels instant. If the call fails, the input text is restored. The next poll will also confirm the message is present (or not, if it failed).

---

## 14. Key Design Decisions

### SQLite over PostgreSQL

SQLite requires zero setup — no server, no connection string, no environment variables. The database is a single file at `prisma/dev.db`. This removes an entire category of setup friction for local development. Switching to PostgreSQL later only requires changing `provider` and `url` in `schema.prisma` and running a migration.

### No Prisma enums (string status field)

Prisma enums are not supported with the SQLite provider. `Pod.status` is a plain `String` with valid values enforced in application code via constants (`FORMING`, `LOCKED`, `COMPLETED`). The tradeoff is that the database will accept any string — there is no DB-level constraint. For a v0.1 MVP where the only writer is this application, that is an acceptable tradeoff.

### Lazy COMPLETED transition (no cron job)

The LOCKED → COMPLETED transition happens when `GET /pods/:id` is called after `meetupTime` has passed. This avoids the need for a background scheduler entirely. The tradeoff is that the status update is not instantaneous — it happens the first time someone reads the pod. In practice, the pod's own members will be polling messages every 3 seconds, so the transition will be detected quickly.

### `POST /pods/join` handles both create and join

Rather than two separate endpoints (`POST /pods` for create, `POST /pods/:id/join` for join), both actions go through `POST /pods/join`. The presence or absence of `podId` in the request body determines which path executes. This keeps the API surface minimal (a PRD constraint) while supporting both user actions.

### JWT secret has a dev default

`JWT_SECRET` defaults to `'bridge_dev_secret'` if the environment variable is not set. This means the app runs out of the box with no configuration. In production, `JWT_SECRET` should be set to a long random string — tokens signed with the dev secret could be forged by anyone who reads this codebase.

### Navigation auth gate via conditional stacks

Rather than a dedicated redirect or protected-route component, the navigator conditionally renders different screen sets based on `user !== null`. When `user` becomes non-null (sign in), React Navigation automatically navigates to the first screen of the authenticated set (`ActivityList`). This is idiomatic React Navigation and avoids imperative navigation calls on auth state changes.

### `api.ts` token as module-level variable (not React state)

The JWT token lives in a plain module variable, not in `useState` or `useContext`. This means it can be read synchronously inside `request()` without hooks. `AuthContext` is the source of truth for React (it drives navigation and component rendering); `api.ts` maintains its own copy purely for injection into HTTP headers. They are kept in sync by `setToken()` being called inside `AuthContext.signIn()` and `signOut()`.

### `@types/express` pinned to v4 (not v5)

The runtime is Express 4, but `npm install` was initially pulling `@types/express@5`, which changed the type of `req.params` values from `string` to `string | string[]`. This broke TypeScript compilation. The fix was pinning `"@types/express": "^4.17.21"` in `package.json`. Always match your `@types` version to your runtime version.
