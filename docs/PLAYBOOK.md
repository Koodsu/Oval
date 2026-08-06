# Oval Playbook — prompts and recipes for AI-assisted work

Copy-paste starting points for recurring tasks. Each recipe lists the context to attach so any model (including weaker/faster ones) performs well. Assume the session auto-loads `CLAUDE.md`.

## 1. Add a backend endpoint

> Add `<METHOD> <path>` to the Oval backend. Read `ARCHITECTURE.md` Part 0 and Part 16 (backend patterns) first. Requirements: <what it does>. Follow existing patterns in `backend/src/routes/<closest-existing>.ts`: asyncHandler wrapper, requireVerifiedAuth (or requireAuth — decide and justify), Prisma via `src/prisma`, shared logic in `src/lib/`. Write the sibling `*.test.ts` using `registerAndGetToken()` from `src/test/helpers.ts`, covering auth-required, happy path, and one edge case. Run `npm test` in backend/ and iterate until green.

## 2. Add or modify a screen

> Work in `frontend/src/screens/`. Read `frontend/CLAUDE.md` first. Use primitives from `src/components/ui.tsx` and tokens from `useTheme()` — no hardcoded colors, no new card/sheet implementations. All API calls go through `src/api.ts`. Check both light and dark themes and add `accessibilityLabel` to icon-only Pressables. Run `npm run typecheck` and `npm test` before finishing.

## 3. Schema change

> Modify `backend/prisma/schema.prisma` to <change>. Then: `npm run db:migrate` (name the migration descriptively), update affected routes/libs, update tests, run `npm test`. Remember deploys run `prisma migrate deploy` automatically — never edit applied migrations. Check whether the change affects `seed.ts` / `seed-launch.ts`.

## 4. New push notification type

> Read `ARCHITECTURE.md` Part 13. Add the send in `backend/src/lib/NotificationService.ts` following an existing category: respect user preference categories, chunked Expo sends, include a deep-link `url` in the payload (`oval://…`, must exist in App.tsx linking config). If time-based, it runs from `runMaintenanceJobs()` — remember prod cadence depends on the external scheduler, and make it idempotent across repeated runs.

## 5. Cut a release

> Follow the oval-release skill (or `APP_STORE_SUBMISSION.md` + `LAUNCH_CHECKLIST.md` phases 3–5). Preconditions: CI green, version/build bumped, RELEASE_NOTES updated. `cd frontend && eas build --platform ios --profile production`, TestFlight smoke test (register→verify→login, join pod, chat, report/block, **account deletion + data export**), then `eas submit`. Reviewer account must stay working (bypasses OSU email gate).

## 6. Growth experiment

> Before building: pull a baseline from `GET /analytics/summary` and write it down. Instrument the new surface with events (see `docs/GROWTH_PLAN.md` §0 naming). Ship, wait a cycle, compare. Current highest-leverage open items are ranked in `docs/STATE_2026-07-06.md` §5.

## 7. Debug production

> Read `INCIDENT_RESPONSE.md`. Check `/health` (touches the DB). Common causes: paused Supabase DB, missing env var (validated at boot by `productionEnv.ts` — check Vercel logs for the throw), stale cron scheduler, CORS_ORIGIN mismatch. Timezone bugs: remember everything is America/New_York.

## 8. Bumping the terms version

> **This has broken a release twice. Read before touching `legal.ts`.**
>
> The version string lives in two places that must agree: `backend/src/config/legal.ts` and `frontend/src/constants/legal.ts`. The app re-prompts whenever a user's stored `termsVersion` differs from the frontend constant (`AuthContext.tsx`), and `/auth/register` + `/auth/accept-terms` validate what the client submits. So a client whose version the API doesn't recognize gets a 400 on the terms screen **with no way past it** — it blocks existing users, not just new signups.
>
> The App Store build and the Vercel deploy are never simultaneous, so some client is always on the old version. That's what `ACCEPTED_TERMS_VERSIONS` is for.
>
> **Procedure:**
>
> 1. Update the terms text (`landing/src/components/TermsOfUse.jsx`, `PrivacyPolicy.jsx`, `CommunityGuidelines.jsx`).
> 2. In `backend/src/config/legal.ts`: set the new `CURRENT_TERMS_VERSION` **and move the old value into `PREVIOUS_TERMS_VERSIONS` in the same commit.**
> 3. Set the identical string in `frontend/src/constants/legal.ts`.
> 4. `cd backend && npm test -- auth` — the `PREVIOUS_TERMS_VERSIONS` cases must pass.
> 5. **Deploy the backend first, then build the app.** Never the reverse: a build that ships ahead of the deploy sends a version the API has never heard of.
> 6. Verify against production before submitting: register a throwaway account on the new build, and confirm the currently-live App Store build can still accept terms.
>
> Prune `PREVIOUS_TERMS_VERSIONS` only once the build carrying that version is out of circulation, not at the next bump. The accepted version is recorded as-submitted rather than forced to `CURRENT_TERMS_VERSION`, because a user on an older build genuinely saw older text.

## 9. Design/UX pass

> Read `AUDIT_2026.md` Part 2 (D1–D7) and the Lumen 2.0 token table before proposing changes; wireframes live in `docs/wireframes-2026/` (regenerate: `node gen-wireframes.mjs .`). Constraints: blur only on chrome (dock/sheets), solid card surfaces, WCAG AA contrast, OSU scarlet accent.

## Context-attachment cheat sheet

| Task | Attach / point the model at |
|---|---|
| Anything backend | `ARCHITECTURE.md` Part 0, `backend/CLAUDE.md` |
| Anything frontend | `frontend/CLAUDE.md`, `src/theme.ts`, `src/components/ui.tsx` |
| Product/priority decisions | `docs/STATE_2026-07-06.md`, `AUDIT_2026.md` |
| Growth | `docs/GROWTH_PLAN.md` |
| Clubs domain | `docs/CLUB_LIFECYCLE_IMPLEMENTATION.md`, `docs/onboard-a-club.md` |
| Release/ops | `APP_STORE_SUBMISSION.md`, `INCIDENT_RESPONSE.md` |
