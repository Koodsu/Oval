# Bridge — Architecture

Bridge is a structured micro-group formation app for college students. Users browse activities, join or create pods (small groups of 2–10 people), meet up, and chat within their pod. When creating a pod, users can customize group size, meetup time (up to 1 week out), and location (public OSU buildings or a private address). This document explains how everything is built and why — it assumes you've taken an intro CS course and are comfortable with concepts like APIs, databases, and React.

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
9. [Design System](#9-design-system)
10. [Component Library](#10-component-library)
11. [Screen-by-Screen UI](#11-screen-by-screen-ui)
12. [Navigation Structure](#12-navigation-structure)
13. [State Management](#13-state-management)
14. [How Frontend Talks to Backend](#14-how-frontend-talks-to-backend)
15. [API Request Lifecycle](#15-api-request-lifecycle)
16. [Chat — Polling Architecture](#16-chat--polling-architecture)
17. [Key Design Decisions](#17-key-design-decisions)

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
│         5 tables: User, Activity, Pod,               │
│                   PodMember, Message                │
└─────────────────────────────────────────────────────┘
```

The frontend and backend are separate workspaces within the same repo. They communicate over a local HTTP connection. There is no WebSocket layer — chat uses polling (the app asks the server for new messages every few seconds instead of keeping a live connection).

**Terms you'll see in this doc:** *JWT* = JSON Web Token, a string that proves you're logged in (like a temporary pass); *ORM* = Object-Relational Mapping, e.g. Prisma turns database rows into JavaScript objects; *endpoint* = a URL + HTTP method (e.g. `GET /pods`) that the server responds to.

---

## 2. Repository Structure

```
Bridge/                          ← project root
  .gitignore
  README.md
  ARCHITECTURE.md                ← this file
  backend/
    src/
      server.ts                  ← Express app entry point
      prisma.ts                  ← Singleton PrismaClient
      config/
        locations.ts             ← OSU building names by activity category (editable)
      middleware/
        auth.ts                  ← JWT verification middleware
      routes/
        auth.ts                  ← POST /auth/register, /login
        activities.ts            ← GET /activities, GET /activities?category=, GET /activities/:id/locations
        pods.ts                  ← GET /pods/mine, GET /pods?activityId=&sort=&locationType=,
                                   POST /pods/join, POST /pods/:id/lock, POST /pods/:id/unlock,
                                   GET /pods/:id
        messages.ts              ← GET/POST /pods/:id/messages
    prisma/
      schema.prisma              ← Database schema
      seed.ts                    ← Activity seed data
      dev.db                     ← SQLite database file (gitignored)
      migrations/                ← Prisma migration history
    package.json
    tsconfig.json
  frontend/
    App.tsx                      ← Navigation root + AuthProvider + bottom tab bar
    index.ts                     ← Expo entry point
    app.json                     ← Expo config
    src/
      api.ts                     ← All HTTP calls to backend
      types.ts                   ← Shared TypeScript interfaces
      theme.ts                   ← Design system: colors, spacing, typography, shadows
      constants/
        categories.ts            ← Category names and metadata (icons, colors)
      context/
        AuthContext.tsx           ← JWT + user session state
      components/
        Avatar.tsx               ← Initials-based colored avatar circles + AvatarStack
        GradientButton.tsx       ← Primary action button with linear gradient
        StatusBadge.tsx          ← Colored pill for pod status (FORMING/LOCKED/COMPLETED)
        ActivityCard.tsx         ← Rich card for an activity (icon, title, category, location)
        CategoryFilter.tsx       ← Horizontal scrollable category filter chips
        PodCard.tsx              ← Rich card for a pod (avatars, progress bar, actions)
        FadeIn.tsx               ← Staggered fade+slide entrance animation wrapper
      screens/
        LoginScreen.tsx          ← Email + password login (gradient background, glass card)
        RegisterScreen.tsx       ← Name + email + password registration
        ActivityListScreen.tsx   ← Explore tab: browse activities with category filter
        MyActivitiesScreen.tsx   ← My Activities tab: user's pods grouped by status
        SearchScreen.tsx         ← Search tab: filter activities by text + category
        ProfileScreen.tsx        ← Profile tab: user info, stats, sign out
        PodListScreen.tsx        ← Pods for one activity (create/join, sort + location filter)
        CreatePodScreen.tsx      ← Form to create a pod (group size, time, location)
        PodScreen.tsx            ← Pod detail + chat (collapsible header, Lock/Unlock, gradient bubbles)
    package.json
    tsconfig.json
```

### What changed from earlier versions

The original frontend was 5 screen files, `api.ts`, `types.ts`, and `AuthContext.tsx` — no design system, no reusable components, just inline `StyleSheet.create()` with hardcoded hex colors in every screen. The redesign added:

- `theme.ts` — a single source of truth for all visual constants
- `components/` — 7 reusable components (including `CategoryFilter`) that screens compose instead of inlining
- `constants/categories.ts` — category metadata (icons, colors) for the 10 activity categories
- New dependencies for gradients, icons, haptics, and blur

Later updates expanded activities from 5 to ~47 across 10 categories, added category filtering on Explore and Search, and added pod sorting (Starting Soon, Date Posted, Most Members) on PodList. A major update added pod customization: min/max members (preset chips like 2–4, 3–6), meetup time picker (max 1 week out), public vs private location with OSU building dropdowns, a dedicated CreatePodScreen, lock/unlock controls for pod creators, and location filtering when browsing pods.

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

### Location config — `config/locations.ts`

This file maps each activity category (e.g., "Sports & Fitness", "Food & Drink") to a list of Ohio State University building names. When a user creates a pod for an activity, the frontend fetches `GET /activities/:id/locations`, which returns the buildings for that activity's category. The user picks one from a dropdown (or chips) for public locations, or types a custom address for private locations.

**Why a separate config file?** So you can add or change OSU buildings without touching route logic. Edit `LOCATION_BY_CATEGORY` in `locations.ts` — it's a plain object: `{ "Sports & Fitness": ["RPAC", "North Rec", ...], "Food & Drink": ["Traditions at Scott", ...], ... }`.

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
│ password │       │ category │       │ location  │
│ createdAt│       │ defaultLoc│       │ locationType│  "public" | "private"
└────┬─────┘       │ createdAt│       │ minMembers │  2–10 (default 2)
     │             └──────────┘       │ maxMembers │  2–10 (default 4)
     │                               │ status    │
     │                               │ creatorId │──→ User (who created it)
     │                               │ createdAt │
     │                               └─────┬─────┘
     │                                     │
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

### Pod customization fields (added in v0.2)

Pods now store more than just meetup time and location:
- **locationType** — `"public"` means the location is an OSU building from a predefined list; `"private"` means the creator typed a custom address
- **minMembers** and **maxMembers** — the pod locks when it has between min and max people (creator can manually lock); it auto-locks when full (reaches maxMembers)
- **creatorId** — the user who created the pod; only they can lock or unlock it (when the pod isn't full). If the database has old pods without creatorId, the app falls back to the first member by join date

### Seed data

`prisma/seed.ts` inserts ~47 activities across 10 categories on first run. Categories include Sports & Fitness, Food & Drink, Academic, Arts & Creative, Social, Outdoors, Music & Entertainment, Wellness, Gaming, and Volunteering. The seed clears existing activities (and cascading pods/messages) before re-inserting, so running `npx prisma db seed` resets the catalog. The Prisma `"seed"` script in `package.json` means `prisma migrate dev` runs the seed automatically after applying migrations.

---

## 5. API Routes

All routes except `/auth/register` and `/auth/login` require a valid JWT.

```
Auth
  POST /auth/register         body: { name, email, password }
  POST /auth/login            body: { email, password }

Activities
  GET  /activities              → Activity[] (all activities)
  GET  /activities?category=    → Activity[] (filtered by category)
  GET  /activities/:id/locations → string[] (OSU building names for this activity's category)

Pods
  GET  /pods/mine               → Pod[] (all pods the current user is a member of)
  GET  /pods?activityId=        → Pod[] (FORMING pods only — locked pods are hidden from browse)
  GET  /pods?activityId=&sort=  → sort: date_posted | starting_soon | most_members
  GET  /pods?activityId=&locationType= → filter: all | public | private
  POST /pods/join                body: { podId }      → join existing pod
                                 body: { activityId, minMembers?, maxMembers?, meetupTime?,
                                         locationType?, location? } → create new pod
  POST /pods/:id/lock            → Lock pod (creator only, requires memberCount >= minMembers)
  POST /pods/:id/unlock          → Unlock pod (creator only, requires memberCount < maxMembers)
  GET  /pods/:id                 → Pod (with lazy COMPLETED check)

Messages
  GET  /pods/:id/messages     → Message[]
  POST /pods/:id/messages     body: { content } → Message
```

### Response shapes

Every successful response returns JSON. Errors return `{ error: string }` with an appropriate HTTP status code. Pod responses include the nested `activity` object, `members` array (each with `user.id` and `user.name`), and `creator` (or `creatorId`) so the frontend can show Lock/Unlock only to the creator. They also include `minMembers`, `maxMembers`, and `locationType`. Message responses include `user.id` and `user.name`. Passwords are never returned.

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

A pod moves through three states. Unlike v0.1, LOCKED is now reachable both automatically (when full) and manually (when the creator chooses).

```
         User creates pod
               │
               ▼
          ┌─────────┐
          │ FORMING │  ← open, anyone can join (until full)
          └────┬────┘
               │  Auto-lock: memberCount >= maxMembers (e.g. 4th person joins a 2–4 pod)
               │  Manual lock: creator taps "Lock Pod" when memberCount >= minMembers
               ▼
          ┌────────┐
          │ LOCKED │  ← closed, hidden from browse list, chat active
          └────┬───┘
               │  Creator can unlock (if memberCount < maxMembers) → back to FORMING
               │  meetupTime < now  (checked lazily on GET /pods/:id)
               ▼
         ┌───────────┐
         │ COMPLETED │  ← meetup happened, read-only (final state)
         └───────────┘
```

### FORMING → LOCKED (two ways)

1. **Auto-lock (on join)** — When someone joins and the pod reaches `maxMembers` (e.g., 4th person in a 2–4 pod), the server immediately sets `status = 'LOCKED'` in the same request.
2. **Manual lock (creator only)** — The creator can tap "Lock Pod" anytime the pod has at least `minMembers` (e.g., 2 people in a 2–4 pod). This hides the pod from the browse list so no one else can join, but chat stays active. Use case: "We have enough people, let's lock it and plan."

### LOCKED → FORMING (manual unlock)

If the pod is locked but not full, the creator can tap "Unlock Pod" to reopen it. It will reappear in the browse list. You cannot unlock a full pod (that would be confusing).

### LOCKED → COMPLETED (lazy, on read)

There is no background job or cron. Instead, `GET /pods/:id` checks:

```typescript
if (pod.status === 'LOCKED' && pod.meetupTime < new Date()) {
  pod = await prisma.pod.update({ status: 'COMPLETED', ... });
}
```

The transition happens the first time any client fetches the pod after the meetup time passes. This is called **lazy evaluation** — the server updates state only when someone asks for it, instead of running a scheduler. Simpler to build, at the cost of the status being slightly stale until someone reads it.

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

### Browse list shows only FORMING pods

When you list pods for an activity (`GET /pods?activityId=`), the server only returns pods with `status === 'FORMING'`. Locked pods disappear from that list — they still exist, and members can still see them in "My Activities" and chat, but new people cannot find or join them.

---

## 8. Frontend Structure

### Dependencies

These are the key packages and what they do. All versions are pinned for Expo SDK 54 compatibility.

| Package | What it does |
|---------|-------------|
| `expo` ~54.0.33 | Framework and build toolchain |
| `react` 19.1.0 / `react-native` 0.81.5 | UI runtime |
| `@react-navigation/native` ^7 | Screen navigation and routing |
| `@react-navigation/native-stack` ^7 | Native stack navigator (iOS UINavigationController, Android Fragment) |
| `@react-navigation/bottom-tabs` ^7 | Bottom tab bar navigator for the four main app tabs |
| `@react-native-async-storage/async-storage` | Persistent key-value storage for JWT token and user session |
| `@react-native-community/datetimepicker` | Native date/time picker for meetup time in CreatePodScreen |
| `expo-linear-gradient` | `<LinearGradient>` component for gradient backgrounds and buttons |
| `expo-blur` | Frosted-glass blur effects |
| `expo-haptics` | Tactile vibration feedback on button presses |
| `@expo/vector-icons` | Ionicons, MaterialIcons, and other icon sets bundled with Expo |

### File responsibilities

| File | What it does |
|------|-------------|
| `App.tsx` | Navigation container, bottom tab bar, route definitions, auth gate, global screen styling |
| `src/types.ts` | TypeScript interfaces matching backend response shapes (`User`, `Activity` with `category`, `Pod`, `PodMember`, `Message`) |
| `src/api.ts` | All HTTP calls to the backend, token injection into headers, error normalization |
| `src/theme.ts` | Design system — every color, spacing value, font size, border radius, and shadow used in the app |
| `src/context/AuthContext.tsx` | Session persistence (AsyncStorage), sign in/out functions, `useAuth()` hook |
| `src/components/Avatar.tsx` | Initials-based colored circle + `AvatarStack` (overlapping row of avatars) |
| `src/components/GradientButton.tsx` | Primary action button with gradient fill, supports loading/disabled/icon/outline variants |
| `src/components/StatusBadge.tsx` | Colored pill showing pod status (green FORMING, blue LOCKED, gray COMPLETED) |
| `src/components/ActivityCard.tsx` | Tappable card for one activity — icon, title, category label, description, location (icons/colors from category) |
| `src/components/CategoryFilter.tsx` | Horizontal scrollable row of category chips; "All" plus one per category; selection drives filtered activity list |
| `src/components/PodCard.tsx` | Card for one pod — avatar stack, progress bar, meetup info, contextual action button |
| `src/components/FadeIn.tsx` | Animation wrapper — children fade in and slide up with a spring, optional delay for staggering |
| `src/screens/LoginScreen.tsx` | Login form on a gradient background with a white card |
| `src/screens/RegisterScreen.tsx` | Registration form, same visual style as login |
| `src/screens/ActivityListScreen.tsx` | Explore tab — custom header, category filter, animated list of activity cards (filtered by selected category) |
| `src/screens/MyActivitiesScreen.tsx` | My Activities tab — user's pods grouped into "Active" and "Past" sections |
| `src/screens/SearchScreen.tsx` | Search tab — category filter + real-time text filtering of activities by name, description, or location |
| `src/screens/ProfileScreen.tsx` | Profile tab — user avatar/name/email, pod stats, sign out with confirmation |
| `src/screens/PodListScreen.tsx` | All pods for one activity — "Start a Pod" (navigates to CreatePod), location filter (All/Public/Private), sort options, pod cards |
| `src/screens/CreatePodScreen.tsx` | Form to create a pod — group size presets (2–3, 2–4, 3–6, etc.), meetup date/time picker (max 1 week out), public/private location with OSU building chips or address input |
| `src/screens/PodScreen.tsx` | Pod detail + chat — collapsible header, Lock/Unlock buttons (creator only), member count (e.g. 3/6), gradient message bubbles, pill input |

---

## 9. Design System

All visual constants live in `src/theme.ts`. Every screen and component imports from this file — there are zero hardcoded colors or font sizes in `StyleSheet.create()` calls. If you want to change the look of the entire app (say, switch to a dark theme), you only need to edit `theme.ts`.

### Colors

```
Primary gradient:    #6366f1 (indigo) → #8b5cf6 (violet)
Background:          #f8f9fb (very light gray, almost white)
Card surface:        #ffffff
Primary text:        #0f172a (near-black)
Secondary text:      #64748b (medium gray)
Tertiary text:       #94a3b8 (light gray, used for timestamps and hints)
Border:              #e2e8f0
```

Status colors — each pod state has a foreground color and a light background:

```
FORMING:   green (#22c55e) on light green (#dcfce7)
LOCKED:    blue  (#3b82f6) on light blue  (#dbeafe)
COMPLETED: gray  (#94a3b8) on light gray  (#f1f5f9)
```

Chat bubble colors:

```
"Me" bubbles:    gradient from #6366f1 → #7c3aed (indigo to purple)
"Them" bubbles:  #f1f5f9 (light gray)
```

Avatar palette — 8 vibrant colors. Which color a user gets is determined by hashing their name, so the same person always gets the same color:

```
#6366f1  #ec4899  #f59e0b  #22c55e  #3b82f6  #8b5cf6  #14b8a6  #f97316
```

### Spacing

An 8-point grid. Every margin, padding, and gap in the app is one of these values:

```
xs: 4    sm: 8    md: 16    lg: 24    xl: 32    xxl: 40    xxxl: 56
```

### Typography

A scale of named text styles that screens spread into their StyleSheets:

```
hero:     34px, weight 800, tight letter spacing  — brand name on auth screens
h1:       28px, weight 700                        — (reserved for future large headings)
h2:       22px, weight 700                        — screen-level headings ("Hey, Brady")
h3:       17px, weight 600                        — card titles
body:     15px, weight 400, 22px line height      — paragraph text, chat messages
bodyBold: 15px, weight 600                        — emphasized body text
caption:  13px, weight 500, secondary color       — metadata (location, time, descriptions)
tiny:     11px, weight 500, tertiary color        — timestamps, small labels
label:    12px, weight 700, uppercase, tracked    — section headers ("EXPLORE ACTIVITIES")
```

### Border radii

```
sm: 8    md: 12    lg: 16    xl: 20    pill: 999
```

Cards use `lg` (16). Buttons use `md` (12). Chips and avatars use `pill` (999, which makes any rectangle into a circle/capsule).

### Shadows

Three tiers, defined per-platform (iOS uses `shadowColor`/`shadowOpacity`/`shadowRadius`, Android uses `elevation`):

```
sm:  subtle, barely visible     — input bars, info sections
md:  standard card shadow       — activity cards, pod cards, logo circle
lg:  prominent, floating feel   — auth card (the white card on the gradient background)
```

---

## 10. Component Library

The `src/components/` directory contains 6 reusable building blocks. None of them call the API or manage data — they are pure presentational components that receive props and render UI.

### Avatar + AvatarStack

`Avatar` renders a colored circle with the first letter of a person's name. The background color is deterministic: a hash of the name string picks from an 8-color palette, so "Alice" is always the same color everywhere in the app.

Props: `name` (string), `size` (number, default 36), `isYou` (boolean, adds a white ring).

`AvatarStack` renders multiple avatars overlapping horizontally (like GitHub's collaborator row). Each avatar overlaps the previous one by 30% of its width. Renders up to `max` avatars (default 4).

Props: `members` (array of `{ id, user: { id, name } }`), `currentUserId` (highlights your avatar), `size`, `max`.

### GradientButton

The primary call-to-action button. Renders a `LinearGradient` (indigo → violet) with white text inside a `TouchableOpacity`. When disabled or loading, the gradient is replaced with a flat gray. Every press triggers a medium haptic impact via `expo-haptics`.

Props: `title`, `onPress`, `loading`, `disabled`, `icon` (Ionicons name), `variant` (`'primary'` or `'outline'`), `size` (`'md'` or `'lg'`).

The `outline` variant renders a bordered button with the primary color instead of a gradient fill.

### StatusBadge

A small pill that shows a pod's current state. It has a colored dot on the left and an uppercase label on the right. The background is a light tint of the status color (green for FORMING, blue for LOCKED, gray for COMPLETED).

Props: `status` (string), `size` (`'sm'` or `'md'`).

### ActivityCard

A tappable card representing one activity. Layout:

```
┌──────────────────────────────────────────┐
│  [icon]  Title              Category  › │
│          Description                     │
│          📍 Location                     │
└──────────────────────────────────────────┘
```

The icon circle's color and icon come from `CATEGORY_META` in `constants/categories.ts`, keyed by `activity.category`. Each category (e.g., Sports & Fitness, Food & Drink) has an icon and accent color. Unknown categories fall back to a sparkle icon and primary color. The category appears as a small colored label next to the title.

Pressing a card triggers a light haptic impact.

### CategoryFilter

A horizontally scrollable row of pill-shaped chips. The first chip is "All" (shows all activities); the rest are the 10 categories from `constants/categories.ts`. Each chip shows an icon and label. The selected chip is highlighted (colored background); unselected chips have a light gray border. Tapping a chip updates the selected category; the scroll position stays put. No scroll-to-start behavior on selection.

### PodCard

A card representing one pod. Layout:

```
┌──────────────────────────────────────────┐
│  [avatar] [avatar] [avatar]    [FORMING] │
│  ████████████░░░░░░░░░░░░░               │
│  2/6 members · 4 spots open             │  ← uses pod.maxMembers (not hardcoded 4)
│  🕐 Sat, Feb 22, 3:00 PM               │
│  🏢 RPAC  (or 📍 123 Main St for private)│  ← icon differs by locationType
│                          [Join Pod]      │
└──────────────────────────────────────────┘
```

The top row shows an `AvatarStack` on the left and a `StatusBadge` on the right. The progress bar uses `memberCount / pod.maxMembers` — pods can have different max sizes (2–10). The location icon is a building icon for public locations, a pin for private. The action area adapts: if you're a member, "View Pod →"; if joinable, "Join Pod"; if full, "Pod is full".

### FadeIn

A lightweight animation wrapper using React Native's built-in `Animated` API. On mount, the children fade from opacity 0 → 1 and slide up 14px → 0px, using a spring animation. An optional `delay` prop (in milliseconds) enables staggered entrances when wrapping items in a list — each item can delay by `index * 70ms` so they cascade in one after another.

This replaces the `react-native-reanimated` library (which was removed because its native binary version must match the Expo Go client exactly, and mismatches cause crashes at launch).

---

## 11. Screen-by-Screen UI

### LoginScreen + RegisterScreen

Both auth screens share the same visual structure:

```
┌─────────────────────────────────────┐
│     Soft gradient background        │
│     (light indigo → light violet)   │
│                                     │
│         [Bridge logo circle]        │
│            Bridge                   │
│     Meet new people, one pod        │
│           at a time                 │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Welcome back                 │  │
│  │                               │  │
│  │  [📧] Email                   │  │
│  │  [🔒] Password          [👁]  │  │
│  │                               │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │        Log In           │  │  │
│  │  └─────────────────────────┘  │  │
│  │                               │  │
│  │  Don't have an account?       │  │
│  │  Sign up                      │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

The background is a `LinearGradient` from `#eef2ff` → `#e0e7ff` → `#f5f3ff` (very soft indigo/violet tones). The white card in the center has `radii.xl` (20px) rounded corners and a `shadows.lg` shadow for a floating effect.

Each input field is a row: an Ionicons icon on the left (`mail-outline`, `lock-closed-outline`, `person-outline`), a `TextInput` in the middle, and for the password field, a show/hide eye toggle on the right. The whole row has a light background (`colors.bg`) with a 1px border.

The submit button is a `GradientButton`. Below it, a link navigates between Login and Register.

The whole screen is wrapped in a `KeyboardAvoidingView` + `ScrollView` so the card scrolls up when the keyboard opens on small devices.

### ActivityListScreen (Explore Tab)

```
┌─────────────────────────────────────┐
│  [avatar] Hey, Brady                │
│           Find your next crew       │
│                                     │
│  EXPLORE ACTIVITIES                 │
│  [All] [Sports & Fitness] [Food…]  │  ← horizontal category filter
│                                     │
│  ┌─────────────────────────────────┐│
│  │ [☕] Morning Coffee Walk   Food › ││
│  │     Meet at a campus café...     ││
│  │     📍 Memorial Union            ││
│  └─────────────────────────────────┘│
│  ...                                │
├─────────────────────────────────────┤
│ [🧭] Explore  [📅] My  [🔍] [👤] │
└─────────────────────────────────────┘
```

This screen opts out of React Navigation's native header (`headerShown: false`) and renders its own. The custom header shows the user's `Avatar` (initials circle) on the left with a greeting and subtitle.

Below the header is a `FlatList` whose `ListHeaderComponent` contains the "EXPLORE ACTIVITIES" label and a `CategoryFilter` (horizontal scrollable category chips). Tapping a category fetches activities for that category via `GET /activities?category=`. The filter scroll position is preserved when switching categories. The list of `ActivityCard` components follows, each wrapped in `FadeIn` with a staggered delay.

Pull-to-refresh is enabled with a tinted refresh indicator (indigo instead of the default gray).

### MyActivitiesScreen (My Activities Tab)

```
┌─────────────────────────────────────┐
│  My Activities                      │
│  Pods you've joined                 │
│                                     │
│  ACTIVE PODS                        │
│  ┌─────────────────────────────────┐│
│  │ [A][B][C]           [FORMING]  ││
│  │ ████████████░░░░░░░░           ││
│  │ 3/4 members                    ││
│  │ 🕐 Sat, Feb 22, 3:00 PM       ││
│  │ 📍 Memorial Union              ││
│  │                    View Pod →  ││
│  └─────────────────────────────────┘│
│                                     │
│  PAST PODS                          │
│  ...                                │
├─────────────────────────────────────┤
│ [🧭] Explore  [📅] My  [🔍] [👤] │
└─────────────────────────────────────┘
```

Fetches all pods the current user is a member of via `GET /pods/mine`. Pods are grouped into two sections: "Active Pods" (FORMING and LOCKED) and "Past Pods" (COMPLETED). Each pod is rendered as a `PodCard` with `isMember: true`, so the action area shows "View Pod →" instead of a join button. Tapping navigates to the Pod detail/chat screen. An empty state with a people icon is shown if the user has no pods yet.

### SearchScreen (Search Tab)

```
┌─────────────────────────────────────┐
│  Search                             │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 🔍 Search activities, loc...   ││
│  └─────────────────────────────────┘│
│  [All] [Sports & Fitness] [Food…]  │  ← category filter
│                                     │
│  ┌─────────────────────────────────┐│
│  │ [☕] Morning Coffee Walk      › ││
│  │     ...                         ││
│  └─────────────────────────────────┘│
│  ...                                │
├─────────────────────────────────────┤
│ [🧭] Explore  [📅] My  [🔍] [👤] │
└─────────────────────────────────────┘
```

Loads activities on mount (optionally filtered by selected category via `GET /activities?category=`). Filters them in real-time as the user types — matching is case-insensitive against the activity title, description, and location. A `CategoryFilter` sits below the search bar; category and text filters combine. Results are rendered as `ActivityCard` components — tapping one navigates to `PodList`. A clear button (×) appears in the search bar when there is input. The search bar is styled as a bordered pill with a search icon.

### ProfileScreen (Profile Tab)

```
┌─────────────────────────────────────┐
│  Profile                            │
│                                     │
│  ┌─────────────────────────────────┐│
│  │         [Large Avatar]          ││
│  │          Brady Smith            ││
│  │       brady@school.edu          ││
│  └─────────────────────────────────┘│
│                                     │
│  STATS                              │
│  ┌─────────┐┌─────────┐┌─────────┐ │
│  │ [👥]    ││ [✓]     ││ [★]     │ │
│  │   2     ││   3     ││   5     │ │
│  │ Active  ││ Done    ││ Total   │ │
│  └─────────┘└─────────┘└─────────┘ │
│                                     │
│  ┌─────────────────────────────────┐│
│  │          Sign Out               ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│ [🧭] Explore  [📅] My  [🔍] [👤] │
└─────────────────────────────────────┘
```

Shows the user's avatar (large, 72px), name, and email in a white card. Below is a stats row with three cards showing active pods, completed pods, and total pods — data fetched from `GET /pods/mine`. The sign-out button is an outline-variant `GradientButton` that shows a confirmation `Alert` before signing out.

### PodListScreen

```
┌─────────────────────────────────────┐
│  ← Morning Coffee Walk              │  ← native navigation header
│                                     │
│  ┌─────────────────────────────────┐│
│  │  ⊕  Start a Pod                ││  ← navigates to CreatePodScreen
│  └─────────────────────────────────┘│
│  [All] [Public] [Private]            ← location filter (which pods to show)
│  [Starting Soon] [Date Posted] [Most Members]  ← sort options
│                                     │
│  ┌─────────────────────────────────┐│
│  │ [A][B][C]           [FORMING]  ││
│  │ ████████████░░░░░░░░           ││
│  │ 3/6 members · 3 spots open     ││
│  │ 🕐 Sat, Feb 22, 3:00 PM       ││
│  │ 🏢 RPAC                        ││
│  │                    [Join Pod]   ││
│  └─────────────────────────────────┘│
│  ...                                │
└─────────────────────────────────────┘
```

Uses the native navigation header (title from route params). "Start a Pod" navigates to `CreatePodScreen` — it does not create a pod immediately. Below that are two filter rows: **location** (All, Public, Private) and **sort** (Starting Soon, Date Posted, Most Members). Both are passed to `GET /pods?activityId=&locationType=&sort=`.

Each pod is a `PodCard`. When a user taps "Join Pod", the button shows a loading spinner; after joining, `navigation.replace('Pod', ...)` replaces the current screen (see Navigation section for why).

### CreatePodScreen

```
┌─────────────────────────────────────┐
│  ← Create Pod                        │
│                                     │
│  ACTIVITY                            │
│  Morning Coffee Walk                 │
│                                     │
│  GROUP SIZE                          │
│  [2–3] [2–4] [3–4] [3–6] [4–6] ...  │  ← preset chips (one tap picks min+max)
│                                     │
│  MEETUP TIME                         │
│  [📅 Sat, Feb 23, 12:00 PM      ›]  │  ← tap to open date/time picker (max 1 week out)
│                                     │
│  LOCATION                            │
│  [Public] [Private]                  │  ← toggle
│  [RPAC] [North Rec] [Jesse Owens…]  │  ← if Public: horizontal chips of OSU buildings
│  or [Enter address_____________]     │  ← if Private: text input
│                                     │
│  ┌─────────────────────────────────┐│
│  │         Create Pod              ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

A dedicated form screen. Group size uses **preset chips** (2–3, 2–4, 3–6, etc.) instead of sliders — each chip sets both min and max in one tap, avoiding the "sliders moving each other" problem. Meetup time uses `@react-native-community/datetimepicker`; the maximum selectable time is 1 week from now (same weekday at 11:59 PM). For location, the user picks Public (dropdown of OSU buildings from `GET /activities/:id/locations`) or Private (freeform address). On submit, `createPod(activityId, { minMembers, maxMembers, meetupTime, locationType, location })` is called, then `navigation.replace('Pod', { podId })`.

### PodScreen (Chat)

```
┌─────────────────────────────────────┐
│  ← Your Pod                         │  ← native navigation header
│                                     │
│  ┌─────────────────────────────────┐│  ← collapsible info header
│  │ Morning Coffee Walk  [LOCKED] ▼││
│  │ 🕐 Sat, Feb 22, 3:00 PM       ││
│  │ 🏢 RPAC  (or 📍 123 Main St)  ││
│  │ Members 3/6    [A][B][C]       ││  ← uses pod.maxMembers
│  │ [Lock Pod]  or  [Unlock Pod]   ││  ← only if you're the creator
│  └─────────────────────────────────┘│
│                                     │
│           Alice                     │
│  [A]  ┌──────────────┐             │
│       │ Hey everyone! │             │
│       └──────────────┘             │
│              2m ago                 │
│                                     │
│       ┌────────────────────┐        │
│       │ Super excited to   │  [me]  │
│       │ meet up tomorrow!  │        │
│       └────────────────────┘        │
│                    just now         │
│                                     │
│  ┌──────────────────────┐ ┌──────┐  │
│  │ Message...           │ │ send │  │
│  └──────────────────────┘ └──────┘  │
└─────────────────────────────────────┘
```

The screen is split into three vertical sections:

**Collapsible info header** — a `TouchableOpacity` at the top. When tapped, it toggles between showing just the activity title + status badge, or the full detail (meetup time, location, member avatar stack with count like "3/6"). If you're the pod creator, you may also see **Lock Pod** (when FORMING and you have at least minMembers) or **Unlock Pod** (when LOCKED and not full). The expand/collapse is animated with `LayoutAnimation.easeInEaseOut`. A chevron icon (up/down) hints that it's tappable.

**Chat message list** — a `FlatList` of messages. Messages from the current user ("me") render as indigo-to-purple gradient bubbles aligned to the right. Messages from others ("them") render as light gray bubbles aligned to the left, with a small `Avatar` and sender name. Consecutive messages from the same person are grouped: the avatar and name only show on the first message in a group, and the timestamp (relative, like "2m ago") only shows on the last message in a group. Bubble corners are adjusted within groups — the tail corner is rounded for middle messages and flat for the last message, creating a modern grouped-bubble effect.

**Input bar** — a pill-shaped `TextInput` on the left, and a circular gradient send button on the right. The send button's gradient turns to flat gray when disabled (empty input or sending in progress). Pressing send triggers a medium haptic impact. On failure, the typed text is restored into the input.

---

## 12. Navigation Structure

React Navigation v7 with a native stack navigator wrapping a bottom tab navigator. The stack is conditionally populated based on whether a `user` exists in `AuthContext`. When authenticated, the first screen in the stack is a 4-tab bottom tab bar.

```
App
 └─ AuthProvider
      └─ AppNavigator
           └─ NavigationContainer
                └─ Stack.Navigator
                      │
                      ├─ [user === null]
                      │    ├─ Login              (no header)
                      │    └─ Register           (no header)
                      │
                      └─ [user !== null]
                           ├─ MainTabs           (Tab.Navigator, no stack header)
                           │    ├─ Explore        → ActivityListScreen  (🧭 compass)
                           │    ├─ MyActivities   → MyActivitiesScreen  (📅 calendar)
                           │    ├─ Search         → SearchScreen        (🔍 search)
                           │    └─ Profile        → ProfileScreen       (👤 person)
                           ├─ PodList             (header title = activityTitle param)
                           ├─ CreatePod           (header title = "Create Pod"; reached from PodList)
                           └─ Pod                 (header title = "Your Pod", blur effect)
```

### Tab bar

The tab bar lives at the bottom of the screen and is always visible on the four main tabs. When a user navigates to `PodList` or `Pod`, those screens push on top of the tab bar (they are in the parent stack, not inside the tab navigator), so the tab bar is hidden during detail views.

Tab bar styling:
- White background (`colors.surface`) with a subtle top border (`colors.border`, 0.5px)
- Active tab: indigo (`colors.primary`), filled icon variant (e.g. `compass`)
- Inactive tab: light gray (`colors.textTertiary`), outline icon variant (e.g. `compass-outline`)
- Labels: 11px, weight 600
- iOS: upward shadow for depth. Android: elevation 8

### Tab icons

Each tab has a filled (active) and outline (inactive) icon from Ionicons:

| Tab | Active icon | Inactive icon |
|-----|------------|---------------|
| Explore | `compass` | `compass-outline` |
| My Activities | `calendar` | `calendar-outline` |
| Search | `search` | `search-outline` |
| Profile | `person` | `person-outline` |

### Global stack screen options

All stack screens share these defaults set on `Stack.Navigator`:

- `headerStyle`: background matches `colors.bg` (the off-white app background)
- `headerTintColor`: `colors.primary` (indigo) — this colors the back arrow
- `headerTitleStyle`: weight 700, `colors.text` — bold dark title text
- `headerShadowVisible: false` — no border line under the header
- `headerBackButtonDisplayMode: 'minimal'` — back arrow only, no title text next to it
- `contentStyle`: background matches `colors.bg` so there is no white flash during transitions
- `animation: 'slide_from_right'` — iOS-style push/pop transition

### Route params

```typescript
type MainTabParamList = {
  Explore: undefined;
  MyActivities: undefined;
  Search: undefined;
  Profile: undefined;
};

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  PodList: { activityId: string; activityTitle: string; activityCategory?: string };
  CreatePod: { activityId: string; activityTitle: string; activityCategory: string };
  Pod: { podId: string };
};
```

Params are typed end-to-end: passing wrong params or missing a required param is a TypeScript compile error. Screens inside the tab navigator that need to navigate to parent stack screens (e.g., from Explore to PodList) use `useNavigation<NativeStackNavigationProp<RootStackParamList>>()`. React Navigation automatically bubbles `navigate()` calls up to the parent stack when the tab navigator does not have a matching screen name.

### Auth gate mechanism

`AppNavigator` reads `user` from `AuthContext`. When `user` is `null`, only `Login` and `Register` exist in the stack — there is no way to navigate to app screens. When `user` is set (after sign-in or session restore), `MainTabs`, `PodList`, and `Pod` exist. React Navigation automatically shows the first screen in whichever set is active (`MainTabs`, which starts on the Explore tab). This means there is no explicit `navigate('Login')` or `navigate('MainTabs')` call on auth state change — the navigator re-renders with a different set of screens and snaps to the first one.

### `navigation.replace` vs `navigation.navigate`

After joining a pod (or after creating one in `CreatePodScreen`), the app uses `navigation.replace('Pod', ...)` instead of `navigation.navigate`. Replace swaps the current screen for the new one rather than pushing on top — so pressing back from the Pod screen returns to the Explore tab (or wherever you came from), not the Pod List or Create Pod form. This prevents accidentally going back and re-joining or re-submitting the create form.

---

## 13. State Management

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
- `selectedCategory` — which category filter is active on Explore/Search (null = "All")
- `locationFilter` — pod location filter on PodListScreen (all, public, private)
- `sortBy` — pod sort option on PodListScreen (starting_soon, date_posted, most_members)
- `loading`, `refreshing`, `sending` — UI state for loading indicators
- `actionId` — which item is currently being acted on (for per-button loading states)
- `messageText` — the controlled input value for the chat box
- `headerExpanded` — whether the PodScreen info header is expanded or collapsed

### No prop drilling

Screens access `useAuth()` directly rather than receiving user data as props. API functions are imported directly rather than injected. This keeps screens self-contained and easy to reason about.

---

## 14. How Frontend Talks to Backend

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

## 15. API Request Lifecycle

A complete trace of what happens when a user taps "Join Pod" (the create-flow is similar: user fills CreatePodScreen, taps "Create Pod", `POST /pods/join` with `activityId` and optional `minMembers`, `maxMembers`, `meetupTime`, `locationType`, `location`):

```
1. User taps "Join Pod" button on a PodCard in PodListScreen
   └─ PodCard calls onJoin prop
   └─ PodListScreen.handleJoin runs
   └─ setActionId(pod.id)  ← disables all buttons, shows spinner on this one
   └─ Haptics.impactAsync(Medium)  ← tactile feedback

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
   ├─ prisma.pod.findUnique(podId) → validates pod exists, is FORMING, has room (memberCount < pod.maxMembers)
   ├─ prisma.podMember.findFirst() → validates user not already in active pod
   ├─ prisma.podMember.create({ podId, userId }) → adds user
   ├─ prisma.podMember.count() → if count >= pod.maxMembers, update pod status to LOCKED
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

## 16. Chat — Polling Architecture

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

When the user taps the send button, the input is cleared immediately so the UI feels instant. A medium haptic impact fires. After the API confirms the message was saved, it is appended to local state (`setMessages(prev => [...prev, msg])`). If the call fails, the typed text is restored into the input and an alert is shown. The next poll will also confirm the message is present (or not, if it failed).

---

## 17. Key Design Decisions

### SQLite over PostgreSQL

SQLite requires zero setup — no server, no connection string, no environment variables. The database is a single file at `prisma/dev.db`. This removes an entire category of setup friction for local development. Switching to PostgreSQL later only requires changing `provider` and `url` in `schema.prisma` and running a migration.

### No Prisma enums (string status field)

Prisma enums are not supported with the SQLite provider. `Pod.status` is a plain `String` with valid values enforced in application code via constants (`FORMING`, `LOCKED`, `COMPLETED`). The tradeoff is that the database will accept any string — there is no DB-level constraint. For a v0.1 MVP where the only writer is this application, that is an acceptable tradeoff.

### Lazy COMPLETED transition (no cron job)

The LOCKED → COMPLETED transition happens when `GET /pods/:id` is called after `meetupTime` has passed. This avoids the need for a background scheduler entirely. The tradeoff is that the status update is not instantaneous — it happens the first time someone reads the pod. In practice, the pod's own members will be polling messages every 3 seconds, so the transition will be detected quickly.

### `POST /pods/join` handles both create and join

Rather than two separate endpoints (`POST /pods` for create, `POST /pods/:id/join` for join), both actions go through `POST /pods/join`. The presence or absence of `podId` in the request body determines which path executes. This keeps the API surface minimal while supporting both user actions.

### JWT secret has a dev default

`JWT_SECRET` defaults to `'bridge_dev_secret'` if the environment variable is not set. This means the app runs out of the box with no configuration. In production, `JWT_SECRET` should be set to a long random string — tokens signed with the dev secret could be forged by anyone who reads this codebase.

### Navigation auth gate via conditional stacks

Rather than a dedicated redirect or protected-route component, the navigator conditionally renders different screen sets based on `user !== null`. When `user` becomes non-null (sign in), React Navigation automatically navigates to the first screen of the authenticated set (`ActivityList`). This is idiomatic React Navigation and avoids imperative navigation calls on auth state changes.

### `api.ts` token as module-level variable (not React state)

The JWT token lives in a plain module variable, not in `useState` or `useContext`. This means it can be read synchronously inside `request()` without hooks. `AuthContext` is the source of truth for React (it drives navigation and component rendering); `api.ts` maintains its own copy purely for injection into HTTP headers. They are kept in sync by `setToken()` being called inside `AuthContext.signIn()` and `signOut()`.

### `@types/express` pinned to v4 (not v5)

The runtime is Express 4, but `npm install` was initially pulling `@types/express@5`, which changed the type of `req.params` values from `string` to `string | string[]`. This broke TypeScript compilation. The fix was pinning `"@types/express": "^4.17.21"` in `package.json`. Always match your `@types` version to your runtime version.

### Centralized design system instead of inline styles

Every color, spacing value, font size, border radius, and shadow is defined once in `theme.ts` and imported everywhere. This means changing the primary color from indigo to, say, emerald green is a single-line edit that propagates everywhere. It also means a new developer can read `theme.ts` to understand the entire visual vocabulary of the app without opening any screen files.

### Built-in Animated API instead of react-native-reanimated

The entrance animations use React Native's built-in `Animated` module (in `FadeIn.tsx`) rather than `react-native-reanimated`. Reanimated is a more powerful library, but it includes a native binary that must exactly match the version embedded in the Expo Go client. A version mismatch causes an instant crash on app launch. The built-in `Animated` API has no native dependency, runs on the JS thread, and is more than sufficient for simple fade+slide entrance animations. If you later eject to a custom dev client (via `npx expo prebuild`), you can swap back to reanimated for more complex gesture-driven animations.

### Haptic feedback on actions

`expo-haptics` provides tactile vibrations on iOS (and on Android devices that support it). Light impacts fire when tapping activity cards and pod cards. Medium impacts fire on "Join Pod" and "Send" — the higher-impact actions. This is a small detail but it makes the app feel more native and responsive.

### Group size presets instead of sliders

When creating a pod, min and max members are chosen via preset chips (2–3, 2–4, 3–6, etc.) rather than two sliders. Earlier designs used sliders, but adjusting one would shift the other's range (e.g., "min can't exceed max-1"), which felt janky. Presets avoid that: one tap sets both values, and there's no coupling between controls. This pattern is common in booking and event apps.

### Editable location config

OSU building names live in `backend/src/config/locations.ts`, not in the database. To add a new building or change the list for a category, you edit that file — no migration, no API changes. The `GET /activities/:id/locations` endpoint reads the activity's category from the database and returns the matching list from the config.
