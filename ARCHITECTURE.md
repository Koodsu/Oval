# Bridge — Architecture Guide

**Who is this for?** Junior developers, computer science students, or anyone new to full-stack mobile development. If you've taken an intro programming course and know the basics of variables, functions, and maybe a bit of web development, you're in the right place.

**What is Bridge?** A mobile app for college students to find small groups (2–10 people) for activities like coffee walks, study sessions, or pickup basketball. Users browse activities, create or join "pods" (groups), and chat with their pod members.

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

### What Are We Building?

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
│  Tables: User, Activity, Pod, PodMember, Message, Block     │
└─────────────────────────────────────────────────────────────┘
```

**Key idea:** The app never talks to the database directly. It always goes through the server. The server is the gatekeeper.

---

## Part 2: Project Structure

```
Bridge/
├── backend/          ← Server code (Node.js)
│   ├── src/
│   │   ├── server.ts       ← Starts the server, mounts routes
│   │   ├── prisma.ts       ← Database connection (one shared instance)
│   │   ├── middleware/
│   │   │   └── auth.ts     ← Checks JWT before protected routes
│   │   ├── routes/
│   │   │   ├── auth.ts     ← Register, login
│   │   │   ├── activities.ts  ← List activities, get locations
│   │   │   ├── pods.ts     ← Create/join pods, lock/unlock, leave
│   │   │   ├── messages.ts ← Get/send chat messages
│   │   │   └── users.ts    ← Block/unblock users
│   │   ├── config/
│   │   │   └── locations.ts  ← OSU building names per category
│   │   └── lib/
│   │       └── blocks.ts   ← Blocking logic (who can't see whom)
│   └── prisma/
│       ├── schema.prisma   ← Database table definitions
│       ├── seed.ts         ← Sample activities (47 items)
│       └── migrations/    ← Schema change history
│
├── frontend/         ← Mobile app (React Native)
│   ├── App.tsx            ← Navigation + auth gate
│   ├── src/
│   │   ├── api.ts         ← All HTTP calls to backend
│   │   ├── types.ts       ← TypeScript interfaces
│   │   ├── theme.ts       ← Colors, spacing, fonts (design system)
│   │   ├── context/
│   │   │   └── AuthContext.tsx  ← Stores JWT + user, persists to storage
│   │   ├── components/    ← Reusable UI pieces
│   │   └── screens/       ← Full screens (Login, Explore, Pod, etc.)
│   └── package.json
│
└── ARCHITECTURE.md   ← You are here
```

---

## Part 3: How a Request Flows (Example: "Join Pod")

Let's trace what happens when a user taps "Join Pod":

1. **User taps "Join Pod"** on a pod card.
2. **PodListScreen** calls `joinPod(podId)` from `api.ts`.
3. **api.ts** sends `POST /pods/join` with `{ podId }` and `Authorization: Bearer <jwt>`.
4. **Express** receives the request. `express.json()` parses the body.
5. **requireAuth middleware** runs:
   - Reads the `Authorization` header
   - Verifies the JWT with `jwt.verify()`
   - If valid: attaches `req.user = { userId, email }` and calls `next()`
   - If invalid: returns 401 Unauthorized
6. **Route handler** (in `pods.ts`) runs:
   - Checks the pod exists, is FORMING, has room
   - Checks user isn't already in an active pod for this activity
   - Checks no blocking relationship with pod members
   - Creates `PodMember` row
   - If pod is now full, updates status to LOCKED
   - Returns the updated pod as JSON
7. **api.ts** receives the response, returns it to the screen.
8. **PodListScreen** calls `navigation.replace('Pod', { podId })` — user sees the pod chat.

---

## Part 4: Authentication (Login Flow)

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
        └─ setUser(user)   ← Navigation shows app screens
```

**Session restore:** On app launch, `AuthContext` reads from AsyncStorage. If token and user exist, it restores the session so the user doesn't have to log in again.

**Validation:** Registration requires name (≥2 chars), valid email format, and password (≥8 chars). Login validates email format.

---

## Part 5: Database Models (Simplified)

| Table | Purpose |
|-------|---------|
| **User** | id, name, email, hashed password |
| **Activity** | id, title, description, category, defaultLocation (e.g. "Morning Coffee Walk") |
| **Pod** | id, activityId, meetupTime, location, minMembers, maxMembers, status (FORMING/LOCKED/COMPLETED), creatorId |
| **PodMember** | Links users to pods (who's in which pod) |
| **Message** | Chat messages: podId, userId, content, createdAt |
| **Block** | blockerId, blockedId — blocked users can't join each other's pods or see messages |

**Pod status flow:** FORMING → (auto when full, or creator locks) → LOCKED → (when meetupTime passes, checked on read) → COMPLETED

---

## Part 6: API Routes Quick Reference

All routes except `/auth/register` and `/auth/login` require a valid JWT.

| Method | Path | Purpose |
|--------|------|---------|
| POST | /auth/register | Create account |
| POST | /auth/login | Log in |
| GET | /activities | List activities (optional ?category=) |
| GET | /activities/locations?category= | Get locations for a category |
| GET | /activities/:id/locations | Get locations for an activity's category |
| GET | /pods/mine | My pods |
| GET | /pods?activityId=&sort= | Pods for an activity (FORMING only) |
| POST | /pods/join | Join pod (`{ podId }`) or create pod (`{ activityId, ... }`) |
| POST | /pods/:id/lock | Lock pod (creator only) |
| POST | /pods/:id/unlock | Unlock pod (creator only) |
| POST | /pods/:id/leave | Leave pod |
| GET | /pods/:id | Get pod details |
| GET | /pods/:id/messages | Get messages |
| POST | /pods/:id/messages | Send message |
| POST | /users/:id/block | Block user |
| DELETE | /users/:id/block | Unblock user |
| GET | /health | Health check |

---

## Part 7: Frontend Architecture

### Navigation

- **Not logged in:** Login and Register screens only.
- **Logged in:** Main tabs (Explore, My Activities, Search, Profile) + stack screens (PodList, CreatePod, Pod, UserProfile).

React Navigation conditionally renders different screen sets based on `user !== null`. No manual redirect — when `user` is set, the navigator shows the app screens.

### State

- **AuthContext:** Global. Holds `user`, `token`, `signIn`, `signOut`, `isLoading`. Persists to AsyncStorage.
- **api.ts:** Module-level `authToken` variable. `request()` adds it to every request. Not React state — no re-renders.
- **Screens:** Local `useState` for activities, pods, messages, loading, etc. Each screen fetches its own data.

### Design System (theme.ts)

All colors, spacing, font sizes, and shadows live in one file. Screens import from `theme.ts` — no hardcoded hex values. Change the primary color in one place and it updates everywhere.

---

## Part 8: Chat — Polling (Not WebSockets)

Every 3 seconds, `PodScreen` calls `GET /pods/:id/messages` and replaces the local messages array. Simple and reliable. No live connection to maintain.

**Why polling?** WebSockets require extra infrastructure and handling for reconnects. For small groups and modest message volume, polling every 3 seconds is sufficient and easier to debug.

---

## Part 9: Key Design Decisions (Why We Did It This Way)

| Decision | Reason |
|----------|--------|
| **SQLite** | Zero setup. Single file. Easy for local dev. Can switch to PostgreSQL later. |
| **JWT with 7-day expiry** | Stateless auth. Server doesn't store sessions. Token proves identity. |
| **Activities require auth** | Per architecture: all routes except auth need JWT. Keeps catalog behind login. |
| **CORS enabled** | Allows requests from different origins (e.g. Expo web, different ports). |
| **Message max 2000 chars** | Prevents abuse. Frontend limits to 500; backend enforces 2000. |
| **Password min 8 chars** | Basic security. Email format validated. |
| **Block model** | Users can block others. Blocked users can't join shared pods or see messages. |
| **Graceful shutdown** | On SIGTERM/SIGINT, server closes connections and Prisma disconnects cleanly. |

---

## Part 10: Running the Project

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

For physical device testing, change `API_BASE` in `frontend/src/api.ts` to your machine's LAN IP (e.g. `http://192.168.1.100:3000`).

---

## Part 11: Testing

- **Backend:** Vitest. Run `cd backend && npm run test`. Tests use a separate SQLite DB (`test.db`), seeded before each run.
- **Frontend:** Jest. Run `cd frontend && npm run test`. Mocks expo-haptics and expo-linear-gradient.

---

## Summary

Bridge is a **client–server** app: the mobile client (React Native) talks to an Express server over HTTP. The server uses Prisma to read/write SQLite. Auth is JWT-based. All protected routes go through `requireAuth` middleware. The frontend uses a single `api.ts` module for all HTTP calls, with the token injected automatically. Chat uses polling. The design system lives in `theme.ts`. Blocking prevents unwanted interactions between users.

If you're new: start by reading `server.ts`, then `routes/auth.ts`, then `api.ts` and `AuthContext.tsx`. Trace one flow (e.g. login or join pod) from UI tap to database and back.
