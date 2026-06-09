# Bridge

Bridge is an OSU-focused social coordination app built around small-group hangouts. Students browse activities, join or create pods, discover clubs, message people they meet, and manage real-world plans from their phone.

This repo contains:

- `backend/`: Express + Prisma API
- `frontend/`: Expo / React Native mobile app
- `landing/`: Vite marketing site and waitlist flow

For a much deeper code-level explanation, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## What Bridge Does

Bridge combines a few product surfaces into one system:

- **Activity pods**: small meetup groups tied to activities like frisbee, food, studying, or workouts
- **Club discovery**: public/private clubs, meetings, announcements, club chat, and officer tooling
- **Messaging**: pod chat, direct messages, replies, reactions, typing indicators
- **Social graph**: friend requests, friendships, pod invites, people-you-met flows, profile search
- **Trust and moderation**: OSU email verification, blocking, reports, no-show tracking
- **Operational support**: push notifications, meetup reminders, attendance/check-in flows, waitlist handling

## Current Product Surface

### Mobile app layouts

The main mobile app is organized around 5 tabs:

- **Home**
  Shows your day at a glance, upcoming plans, a campus pod map, featured activities, and club meetings today.
- **Explore**
  Browse activities and clubs, search, filter by category, join clubs, and jump into activity-specific pod lists.
- **Pods**
  See active pods you are in and a recent pod history.
- **Inbox**
  Handle direct messages, pod invites, and friend requests.
- **Profile**
  Edit your identity, manage notification preferences, review friends, and view clubs you belong to.

There are also stack screens for:

- `ActivityPods`
- `PodDetail`
- `ClubDetail`
- `Thread`
- `EditProfile`
- `UserProfile`
- `UserSearch`
- `VerifyEmail`
- `Auth`

### Pod system

Pods are the core planning object in Bridge.

- Users can browse open pods by activity or feed
- Users can create pods with a time, location, max size, and optional map pin
- Pods can be `FORMING`, `LOCKED`, `COMPLETED`, or `EXPIRED`
- Full pods support waitlists
- Pod detail includes members, meetup map, chat, replies, reactions, typing, shareable invite links, attendance confirmation, recap prompts, no-show follow-up, and people-you-met conversion
- Pod creators can lock or reopen pods

### Club system

Clubs are more persistent communities layered on top of pods.

- Public club directory and membership flow
- Club detail with overview, members, chat, officer channel, and in-app leader dashboard controls
- Club meetings with visibility levels:
  `PUBLIC`, `MEMBERS`, `OFFICERS`
- Club announcements with the same visibility levels
- Officer/admin-only club meeting creation
- Officer/admin-only officer chat
- Admin member-role management:
  `MEMBER` ↔ `OFFICER`
- Attendance/check-in support for meetings, including leader-opened codes and attendance review

### Messaging and social features

- Pod chat
- Direct messages between friends
- Typing indicators
- Message replies
- Message reactions
- Friend requests
- Friend acceptance/decline/cancel
- Pod invites
- User profiles and user search
- People-you-met friend conversion
- Blocking support across the app

### Trust, moderation, and notifications

- OSU / Buckeyemail verification
- Report creation and admin review flows
- Report severity triage with P0/P1/P2 labels and moderation email notifications
- No-show reporting
- Push notifications for relevant events
- Vercel Cron maintenance for meetup reminders, recaps, waitlist expiry, and pod expiry
- Waitlist signup and promotion notifications
- First-party product analytics events

## Known Product Gaps

- Typing indicators are in-memory and reset on backend restart
- Push notifications are fire-and-forget; failures are logged but not retried
- The public waitlist route is a lightweight signup capture, not a full onboarding drip system
- Admin moderation is report-centered; broader case-management and audit dashboards are not yet built
- Product analytics are first-party and event-based; there is not yet a dashboard UI

## Stack

### Frontend

- React Native
- Expo
- TypeScript
- React Navigation
- `fetch` API wrapper in `frontend/src/api.ts`
- Expo Secure Store for auth token persistence
- Expo Notifications
- React Native Maps

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT auth
- Resend for email
- Expo Push API

### Landing site

- React
- Vite
- Tailwind CSS

## Repository Layout

```text
Bridge/
├── backend/
│   ├── prisma/                # schema, migrations, seed
│   └── src/
│       ├── routes/            # API route handlers
│       ├── services/          # domain logic
│       ├── lib/               # shared utilities
│       ├── middleware/        # auth/admin middleware
│       └── test/              # test setup helpers
├── frontend/
│   └── src/
│       ├── screens/           # mobile screens
│       ├── components/        # shared UI
│       ├── context/           # auth/session state
│       ├── hooks/             # app hooks
│       ├── constants/         # categories, map, interest tags
│       ├── utils/             # formatting and derived UI logic
│       └── api.ts             # all backend HTTP calls
├── landing/
│   └── src/
│       ├── components/        # marketing sections, waitlist, policies
│       └── data/              # landing page content
├── ARCHITECTURE.md
└── TESTING.md
```

## Backend Overview

The backend is the source of truth for auth, pods, clubs, messaging, friendship, moderation, and notifications.

### Main route groups

- `/auth`
  Register, login, email verification, resend verification
- `/activities`
  Activity catalog and helper queries
- `/pods`
  Feed, create/join, leave, lock/unlock, detail, waitlist, recaps, attendance
- `/pods/:id/messages`
  Pod chat, reactions, replies
- `/clubs`
  Directory, detail, join/leave, meetings, announcements, chat, officer chat, member management, avatars
- `/friends`
  Requests, friendships, list, unfriend
- `/messages`
  Direct message threads and messages
- `/users`
  Profile, avatar, push token, notification preferences, profile lookup, search, block list
- `/reports`
  Reporting flows
- `/admin/reports`
  Admin moderation tooling
- `/waitlist`
  Public landing-page waitlist

### Important backend behavior

- JWT auth with `Authorization: Bearer <token>`
- Global rate limiting
- Centralized error handling
- Push notifications are fire-and-forget
- Typing indicators are in-memory and reset on restart
- Reminder/background scheduling happens server-side
- Club visibility and membership gates are enforced server-side
- Universal-link metadata is served from backend web routes and can be aligned via env vars

## Frontend Overview

The mobile app is a thin client over the backend.

### Frontend patterns

- All network requests live in `frontend/src/api.ts`
- Screen state is mostly local + fetched on focus
- Auth/session state is provided by `AuthContext`
- Shared page chrome and controls live in `frontend/src/components/ui.tsx`
- Maps are used for pod browsing and meetup pin placement

### Frontend responsibilities

- Session restore and token storage
- Browse and act on pods/clubs/messages
- Search users, open public profiles, and manage trust/friendship flows
- Render planning/chat UI
- Manage local optimistic updates where helpful
- Register Expo push tokens with the backend

## Landing Site Overview

The landing app is not just marketing copy.

It currently handles:

- Homepage / marketing sections
- Waitlist signup flow
- Club-facing page(s)
- Legal pages
- Pod invite page / public deep-link presentation

The landing site talks to the backend via `VITE_BRIDGE_API_URL`.

## Local Development

## Prerequisites

- Node.js 22
- npm 9+
- Expo tooling for local mobile development
- A PostgreSQL database
- A Supabase project if you want hosted Postgres / storage / related services

## 1. Install dependencies

From the repo root:

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ../landing && npm install
```

## 2. Backend setup

```bash
cd backend
cp .env.example .env
```

Fill in the required values, then run:

```bash
npx prisma migrate dev
npm run dev
```

Default local backend URL:

```text
http://localhost:3000
```

## 3. Frontend setup

```bash
cd frontend
cp .env.example .env
npx expo start
```

For a physical device, `EXPO_PUBLIC_API_URL` must point at your machine's LAN IP, not `localhost`.

Example:

```text
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

## 4. Landing setup

```bash
cd landing
cp .env.example .env
npm run dev
```

Default local landing URL:

```text
http://localhost:5173
```

## Environment Variables

### Backend

See [`backend/.env.example`](./backend/.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Main runtime PostgreSQL connection |
| `DIRECT_URL` | Yes | Direct Prisma migration connection |
| `TEST_DATABASE_URL` | Recommended | Separate Postgres DB for tests |
| `JWT_SECRET` | Yes | JWT signing secret |
| `PORT` | No | Backend port, defaults to `3000` |
| `CORS_ORIGIN` | Prod | Allowed web origins |
| `ADMIN_USER_IDS` | No | Comma-separated admin user IDs |
| `CRON_SECRET` | Prod | Authenticates Vercel Cron maintenance requests |
| `RESEND_API_KEY` | For email | Verification email and waitlist integration |
| `RESEND_FROM_EMAIL` | For email | Sender address for verification email |
| `CONTACT_EMAIL` | No | Support and moderation-report inbox, defaults to `contactus@joinbridgeapp.com` |
| `ADMIN_REPORTS_URL` | Prod moderation | Backend URL for signed report review links |
| `ADMIN_REVIEW_SECRET` | Prod moderation | Signs expiring report-specific review links |
| `REPORT_RETENTION_DAYS` | No | Closed safety-report retention, defaults to 730 days |
| `OPENAI_API_KEY` | Prod moderation | Text and image moderation provider credential |
| `OPENAI_MODERATION_MODEL` | No | Defaults to `omni-moderation-latest` |
| `MODERATION_ENFORCEMENT` | No | Production defaults to fail-closed `required` mode |
| `RESEND_WAITLIST_SEGMENT_ID` | Optional | Segment-scoped public waitlist isolation |
| `SUPABASE_URL` | For storage | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | For storage | Service role key for storage uploads |
| `IOS_APP_ID` | Optional | iOS bundle ID used in `apple-app-site-association` |
| `ANDROID_PACKAGE` | Optional | Android package used in `assetlinks.json` |
| `APPLE_TEAM_ID` | Required for iOS review | Apple team ID for fully-qualified universal-link appID |
| `ANDROID_SHA256_CERT_FINGERPRINT` | Optional | Android signing fingerprint for verified app links |

### Frontend

See [`frontend/.env.example`](./frontend/.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Yes | Backend base URL |
| `EXPO_PUBLIC_APP_SITE_URL` | Optional | Public site base URL used when sharing pod invite links |
| `EXPO_PUBLIC_SUPABASE_URL` | Optional/currently limited | Supabase URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Optional/currently limited | Supabase anon key |

For local Expo development, this can live in `frontend/.env`.

For EAS preview/production builds, you must also define these variables in EAS so they are embedded into the build at compile time. A TestFlight app cannot use your local `.env` file after the binary has already been built.

### Landing

See [`landing/.env.example`](./landing/.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `VITE_BRIDGE_API_URL` | Yes | Backend URL for waitlist and related calls |

## Database and Prisma

The project uses Prisma with PostgreSQL.

Common commands:

```bash
cd backend
npx prisma migrate dev
npx prisma generate
npx prisma studio
npx prisma migrate deploy
```

There is also a seed script:

```bash
cd backend
npm run db:seed
```

## Testing

Run the complete local release gate from the repository root:

```bash
npm run release:check
```

This checks repository hygiene, applies the production migration upgrade path to a
disposable database, runs backend and frontend tests, builds, TypeScript, Expo
Doctor, an iOS export, and production dependency vulnerabilities. CI runs the same
command on every push and pull request.

Top-level shortcuts:

```bash
npm run test
npm run test:backend
npm run test:frontend
```

### Backend tests

- Runner: Vitest
- Style: integration-heavy route tests plus utilities
- DB: PostgreSQL via `TEST_DATABASE_URL`
- Global setup resets the test DB and reseeds before the suite

Run:

```bash
cd backend
npm test
```

### Frontend tests

- Runner: Jest
- Focus: API helpers, auth context, utility behavior

Run:

```bash
cd frontend
npm test
```

More detail lives in [TESTING.md](./TESTING.md).

## Deployment

### Backend

- Target: Vercel
- Set all backend environment variables in the deployment platform
- `backend/vercel.json` uses a daily maintenance schedule so Hobby deployments succeed
- For five-minute maintenance, use Vercel Pro/Enterprise or an external scheduler to call `/cron/maintenance`
- Set `CRON_SECRET`, `OPENAI_API_KEY`, `ADMIN_REPORTS_URL`, and `ADMIN_REVIEW_SECRET` before production deploy
- After deploy:

```bash
cd backend
npx prisma migrate deploy
```

### Frontend

- Target: Expo / EAS builds
- Production API base should be injected via Expo public env vars / secrets

### Landing

- Target: Vercel static deployment
- Set `VITE_BRIDGE_API_URL`
- Attach `www.joinbridgeapp.com` directly to this project; the checked-in AASA file is served from that no-redirect host

## Recommended Reading

- [ARCHITECTURE.md](./ARCHITECTURE.md): deep technical walkthrough
- [TESTING.md](./TESTING.md): test setup and workflow

## Status Note

This README is meant to reflect the current product and codebase shape as of the latest repo update. If a screen or route changes, update this file alongside the implementation so it stays useful instead of drifting back into setup-only notes.
