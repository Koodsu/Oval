# Oval Revamp — 00: Overview, Decisions, and How to Use These Docs

This is the master doc for a full revamp of the Oval mobile app ("Crimson" design language + the fixes from `AUDIT_2026.md`). It locks the decisions every other doc depends on. **Read this doc fully before implementing any section of docs 01–04.**

## How to use these docs

- Hand a model ONE doc (plus this overview) and say "implement section N." Each section is scoped to be completable and verifiable in a single focused session.
- Docs: `01_DESIGN_SYSTEM` (tokens, components, navigation), `02_SCREENS` (per-screen specs), `03_BACKEND_LOGIC` (server + push + data), `04_GROWTH` (onboarding, loops, instrumentation).
- Execution order: **01 → 03 → 02 → 04.** 01 has no dependencies. 03 has no UI dependencies and unblocks the parts of 02 that show unread counts. 02 depends on 01's tokens/components. 04 depends on all three.
- Within a doc, sections are ordered by dependency; don't skip ahead when a section says it depends on an earlier one.

## Global constraints (apply to every session)

1. **Validate before declaring done:** `cd frontend && npx tsc --noEmit && npm test`, `cd backend && npx tsc --noEmit && npm test`. New backend behavior needs new tests in the matching `*.test.ts` pattern (see `backend/src/routes/*.test.ts`).
2. **Do not rename existing API routes, request/response fields, navigation route names, or Prisma columns** unless the doc explicitly says to. Additive changes only, so old app builds keep working against the new backend.
3. **Migrations:** any schema change gets a real migration (`npx prisma migrate dev --name <name>`), and `npm run migrations:check` from repo root must pass.
4. Frontend is Expo / React Native (see `frontend/package.json` for SDK). Do not add native modules that require a config-plugin change without noting it — EAS builds are involved.
5. Keep the existing safety surface intact: blocking, reports, content moderation, OSU verification gate (except where doc 04 §6 explicitly relaxes read-only browsing).
6. All user-facing copy: sentence case, short, warm, no exclamation-mark spam. The app's voice is "a friend who has plans," not a brand.

## Locked product decisions

These were decided by the founder; do not re-litigate them in implementation sessions.

**D-1. Brand accent is `#D90429`** (not OSU scarlet — the app is unaffiliated with OSU and this is deliberate). Light theme uses it for fills and accent text. Dark theme uses `#D90429` for **fills** (white label text, 5.4:1 ✓) but `#FF4D63` for **accent text/icons on dark backgrounds** (because #D90429 on near-black is ~3.5:1 and fails AA). Token names in 01 encode this split — use the tokens, never raw hex in screens.

**D-2. Visual language is "Crimson":** iOS-native feel, solid white cards on a light-gray page (dark: solid dark cards on near-black), generous 16px radii, real whitespace, scarlet used only for actions/live-state/unread. **No frosted glass on content surfaces.** Blur survives only on the tab bar and bottom sheets. The gradient `AppBackdrop` becomes a flat themed background.

**D-3. Typography moves to the system font stack** (SF Pro on iOS, Roboto on Android). Remove Sora/Inter and `@expo-google-fonts/*` loading. Weights: 700 for display/titles, 600 for headings/buttons, 400/500 for body/meta. Rationale: native feel, faster cold start, one less failure mode.

**D-4. Navigation IA (canonical five):** `Home · Discover · [+] · Plans · Inbox`.
- **Discover** merges today's Explore and Clubs tabs (segmented: Activities | Clubs).
- **Plans** is the renamed Pods tab: Active / Invites / History.
- **[+]** is a center create button (not a route) opening a create sheet.
- **Profile** leaves the tab bar; it's reached from the avatar in the Home masthead and anywhere else an avatar of self appears. The `Profile` stack screen already exists.

**D-5. Scope exclusions (do NOT build in this revamp):** photo/image messages, voice messages, read receipts ("seen"), online-presence dots ("Active now"), public reliability scores. The GPT mockups show some of these; they are explicitly cut. "On-time rate" style stats may only ever be shown to the user about themselves (see 02 §8). Typing indicators: pods/clubs already have them (`typingStore`); DM parity is an optional stretch item in 03 §9, nothing else.

**D-6. `min` group size from the mockups is cut.** Pods keep `maxMembers` only. Show "X of Y in · Z spots left."

**D-7. Dark mode remains the default for new users** (existing `theme.ts` behavior), and the launch flash bug is fixed (01 §7).

## What the revamp delivers (summary)

- A full retheme: Crimson tokens, system type, solid surfaces, new tab bar with create button, contrast/a11y pass. (01)
- Redesigned core screens matching the approved mockup direction: Home with one hero and inline Join, merged Discover, Plans with invites inline, richer Pod Detail, Pod Chat with contextual attendance/recap cards, Inbox with counts + inline accept, Profile with private stats. (02)
- Working push pipeline end-to-end, pod read-state + unified inbox summary/badge, interest-ranked feed with deterministic ordering, readable analytics, invite attribution, seeded launch content. (03)
- First-run "your first plan" onboarding, recap→next-plan chaining, empty-state CTAs everywhere, share prompts at peak moments, weekly-recap push, measurable funnels. (04)

## Definition of done for the whole revamp

A brand-new verified account, in a seeded environment, reaches a joinable pod within 60 seconds of verifying without ever seeing a dead-end screen; a push notification tap lands on the exact pod/thread it references; the Inbox badge equals the sum of DM unreads + pod unreads + invites + requests; `GET /analytics/summary` reports activation and D1/D7 from real events; both test suites and `npm run release:check` pass; every screen renders correctly in light AND dark with no raw hex colors outside `theme.ts`.
