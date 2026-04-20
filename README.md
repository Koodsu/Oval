# Bridge

OSU-only social activity app. Students join activity pods, meet up, and rate the experience.

## Prerequisites

- Node.js 18+
- npm 9+
- Expo CLI: `npm install -g expo-cli`
- A Supabase project (PostgreSQL + Realtime)

## Structure

```
backend/    Express + Prisma API server
frontend/   React Native / Expo mobile app
landing/    Vite + React landing page
```

## Backend

```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET, etc.
npm install
npx prisma migrate dev        # apply all migrations
npm run dev                   # starts on :3000
```

Required environment variables (see `backend/.env.example`):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase pooled connection string |
| `DIRECT_URL` | Supabase direct (non-pooled) connection string |
| `JWT_SECRET` | Secret for signing auth tokens — required at startup |
| `RESEND_API_KEY` | Resend.com API key for email verification |
| `RESEND_FROM_EMAIL` | Sender address for verification emails |
| `CORS_ORIGIN` | Allowed origin(s) in production, comma-separated |
| `ADMIN_USER_IDS` | Comma-separated user IDs with admin access |

## Frontend

```bash
cd frontend
cp .env.example .env          # set EXPO_PUBLIC_API_URL and Supabase keys
npm install
npx expo start                # scan QR code with Expo Go
```

For physical device testing set `EXPO_PUBLIC_API_URL` to your machine's LAN IP
(e.g. `http://192.168.1.100:3000`) instead of `localhost`.

## Landing page

```bash
cd landing
cp .env.example .env          # set VITE_BRIDGE_API_URL
npm install
npm run dev                   # starts on :5173
```

## Running tests

```bash
cd backend && npm test        # Jest integration tests against a local SQLite DB
```

## Deployment

- **Backend:** Deployed to Vercel (Node.js serverless). Set all env vars in the Vercel dashboard.
- **Frontend:** Built with `eas build` (EAS / Expo Application Services).
- **Landing:** Deployed to Vercel (static Vite build). Set `VITE_BRIDGE_API_URL` in Vercel env vars.

After deploying the backend, run migrations against the production database:

```bash
cd backend && npx prisma migrate deploy
```
