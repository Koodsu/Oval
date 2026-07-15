# Oval (formerly Bridge)

OSU campus social app for small-group hangouts ("pods"), clubs, messaging, and a friend graph. Live on the iOS App Store as of v1.1 (July 2026). Solo developer: Brady.

## Repo map

- `backend/` — Express + Prisma + Postgres (Supabase) API. Deployed on Vercel serverless. Has its own `AGENTS.md`.
- `frontend/` — Expo / React Native iOS app. Has its own `AGENTS.md`.
- `landing/` — Vite marketing site + waitlist (theovalapp.com).
- `docs/` — plans and audits. **Read `docs/STATE_2026-07-06.md` first** for current status/backlog; `AUDIT_2026.md` for the full July 2026 product audit; `docs/PLAYBOOK.md` for task recipes.
- `ARCHITECTURE.md` — 1100-line deep dive; **Part 0 is an AI Quick Reference** written for you. Skim it before nontrivial backend work.

## Ground truths (things that will bite you)

- **Everything is Columbus time.** `TZ=America/New_York` is forced in `server.ts` and `vercel.json`. Never write time logic assuming UTC.
- **Naming history:** the product was "Bridge," now "Oval." Both names appear in code, env vars (`VITE_BRIDGE_API_URL`), and docs. Don't "fix" stray Bridge references without checking what depends on them.
- **Vercel serverless:** no persistent local disk (uploads must go to Supabase Storage), in-memory state (rate limits, throttles) is per-instance, and the Hobby-tier cron in `vercel.json` runs only daily — timely jobs need the external scheduler hitting `/cron/maintenance` with `CRON_SECRET`.
- **Verification gate:** almost everything requires a verified OSU email (`requireVerifiedAuth`). The App Store reviewer account bypasses it — don't break that path.
- **Deep links:** `oval://pod/:podId` etc., configured in `App.tsx`; push notification payloads carry a `url` that feeds the same config.
- **Age rating is 18+** and moderation features (block, report, delete account, data export) are App Store review-critical. Never weaken them casually.

## Workflow expectations

- Every backend route file has a sibling `*.test.ts` (Vitest, real Postgres test DB, sequential). New endpoints need tests. CI is `.github/workflows/release-check.yml`.
- Frontend: `npm run typecheck` and `npm test` (jest-expo) must pass.
- New env vars go in `.env.example` AND `backend/src/config/productionEnv.ts`.
- Prisma schema changes need a migration (`npm run db:migrate`), and deploys run `prisma migrate deploy` (see `backend/vercel.json` buildCommand).
- Releases: EAS build/submit; process distilled in `APP_STORE_SUBMISSION.md` + `LAUNCH_CHECKLIST.md` (checklist is partially stale — see STATE doc).

## Design language

Current theme is "Lumen": gradient backdrop, glass slabs, scarlet accent, light+dark. Tokens in `frontend/src/theme.ts`; shared primitives (Slab, Card, Sheet, Avatar, DateTimeField) in `frontend/src/components/ui.tsx`. A proposed "Lumen 2.0" token set (solid surfaces, blur only on chrome, WCAG-fixed contrast) is specified in `AUDIT_2026.md` Part 2 with wireframes in `docs/wireframes-2026/`.
