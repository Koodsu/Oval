# Oval Backend

Express + Prisma + PostgreSQL API for Oval, a campus social app (OSU). Deployed on Vercel serverless; daily cron hits `/cron/maintenance`.

## Commands

- `npm run dev` — start dev server (ts-node, port 3000)
- `npm run test` — run all tests (Vitest); `npm run test:watch` for watch mode
- `npx vitest run src/routes/pods.test.ts` — run a single test file
- `npm run build` — `prisma generate` + `tsc`
- `npm run db:migrate` — create/apply a Prisma migration (dev)
- `npm run db:seed` — seed the dev database

## Architecture

- `src/server.ts` — app entry: helmet/CSP with per-request nonce, CORS, rate limiting, route mounting. `trust proxy` is set for Vercel.
- `src/routes/` — one file per resource (pods, clubs, friends, directMessages, …). Admin-only routes are prefixed `admin*` and gated by `src/middleware/admin.ts`.
- `src/middleware/auth.ts` — JWT auth; secrets via `src/config/jwt.ts`.
- `src/lib/` — shared domain logic (notifications, moderation, rate limiting, realtime, storage). Prefer putting reusable logic here, not in routes.
- `src/services/` — higher-level orchestration (friendService, reportService).
- `prisma/schema.prisma` — ~40 models; Postgres via `DATABASE_URL` + `DIRECT_URL` (Supabase pooling).
- `src/config/productionEnv.ts` — validates required env vars at boot; update it when adding a new env var.

## Conventions

- All date/time logic is Columbus time: `TZ=America/New_York` is forced in `server.ts` and `vercel.json`. Never write timezone-sensitive logic that assumes UTC.
- Wrap async route handlers in `asyncHandler` (`src/lib/asyncHandler.ts`).
- Every route file has a sibling `*.test.ts`. New endpoints need integration tests.
- Copy new env vars into `.env.example` and `productionEnv.ts`.

## Testing

- Vitest with `globals: true`; integration tests hit a real Postgres test DB (`TEST_DATABASE_URL`), reset and seeded by `src/test/setup.ts`.
- Test files run sequentially (`fileParallelism: false`) because they share one DB — don't rely on parallelism.
- Use helpers from `src/test/helpers.ts`: `registerAndGetToken()` for authed requests, `createTestUser()` for fixtures.
- CI (`.github/workflows/release-check.yml`) runs against Postgres 16; keep tests green there, not just locally.
