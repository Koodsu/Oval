# Oval — Growth & Cold-Start Plan

Hand this to a session and say "implement section N." Everything is grounded in the
current codebase. Validate after each section with `npx tsc --noEmit` (both apps) and
`npm test`.

The thesis: Oval does not have a growth-engineering problem, it has a
**measurement** problem and a **cold-start** problem. The viral infrastructure
(deep links, public pod previews, club invites) is already built. What's missing is
(a) the data to know whether new users activate and return, and (b) a guarantee that a
new user's first session is never an empty room. Fix those two things before adding any
new feature.

---

## 0. What's already done (this session)

Activation/engagement instrumentation is now live in `frontend/src/api.ts` and
`frontend/src/context/AuthContext.tsx`. The following events now fire to the existing
`/analytics/events` endpoint (backed by the `AnalyticsEvent` table):

- `auth.register`, `auth.login` (pre-existing)
- `verify.completed`
- `pod.created` (props: `activityId`, `visibility`, `hasLocation`)
- `pod.joined` (props: `podId`, `activityId`)
- `pod.message_sent` (props: `podId`, `isReply`)
- `club.joined` (props: `clubId`)
- `friend.request_sent` (props: `receiverId`), `friend.accepted` (props: `requestId`)
- `app.opened` (props: `state` = `launch` | `foreground`)
- `safety.report_created` (pre-existing)

This is enough to compute the three numbers that decide whether Oval works:
**activation** (verified → first `pod.joined`/`pod.created`), the **core loop**
(`pod.message_sent`, friend events), and **retention** (`app.opened` by `userId` over
time). Everything below builds on this.

---

## 1. Activation & retention dashboard (read-only, backend)

You're now collecting the events but have no way to read them. Build a tiny internal
metrics endpoint so you can answer the only questions that matter during launch.

**Backend** (`backend/src/routes/analytics.ts` — add an admin-gated `GET /analytics/summary`)
- Reuse the admin auth pattern from `adminReports.ts` / `adminReview.ts` (don't expose
  this publicly — it's founder-only).
- Return, for a `?days=N` window:
  - **Activation rate**: of users who hit `verify.completed`, what % fired a
    `pod.joined` or `pod.created` within 24h / 72h.
  - **DAU / WAU**: distinct `userId` on `app.opened` per day / rolling 7.
  - **D1 / D7 retention**: of users registered on day X, what % had an `app.opened`
    on day X+1 / X+7.
  - **Loop volume**: counts of `pod.created`, `pod.joined`, `pod.message_sent`,
    `friend.accepted` per day.
- All of this is `groupBy` / `count` over `AnalyticsEvent` with the existing
  `[name, createdAt]` and `[userId, createdAt]` indexes — no schema change.

**Optional frontend**: a hidden admin screen, or just hit the endpoint with curl. Don't
over-build the UI; the numbers are the point.

**Acceptance**: you can state today's activation rate and D1 retention from real data.

---

## 2. Guarantee a non-empty first session (cold-start)

A social app that opens to an empty board is dead on arrival. Two fronts:

**Seed real, time-relevant content** (`backend/prisma/seed.ts`)
- The seed already builds activities and pods. Extend it (or add a `seed-launch.ts`)
  to create a rolling set of **near-future pods** across the most popular activities,
  with meetup times in the next few days, so the Home board and Explore are never
  empty on launch day. Re-runnable.
- Line up 3–5 real clubs with a real officer each before launch — your
  `docs/onboard-a-club.md` flow already exists; treat "clubs seeded" as a launch
  blocker, not a nicety.

**Make empty states drive action** (`frontend/src/screens/HomeScreen.tsx`,
`ExploreScreen.tsx`)
- The copy is good ("Nothing on the board. Yet.") but verify every `EmptyState`
  on Home/Explore has a one-tap primary action that lands on pod creation for a
  relevant activity — "Be the first to start a frisbee pod" → create flow prefilled
  with that activity. An empty state should never be a dead end.

**Acceptance**: a brand-new account in a fresh environment sees joinable pods within
one screen, and every empty state has a working CTA.

---

## 3. First-run activation flow

There's a `ClubOnboardingScreen` but no first-run flow for the **core pod loop** — the
make-or-break first 60 seconds. After `verify.completed`, before dropping the user on
Home, run a lightweight 2-step flow:

1. **Pick 2–3 interests** (reuse the existing interest-tag system — there's already an
   `interestTags` route and tests).
2. **"Here's what's happening near you this week"** — show 2–3 joinable pods matching
   those interests, with a single prominent Join.

Instrument it: `onboarding.started`, `onboarding.interests_picked`
(props: count), `onboarding.first_pod_joined`. This lets you measure whether the flow
actually lifts activation vs. the control of dropping straight to Home.

**Acceptance**: new users can go verify → interests → joined a pod without ever seeing
an empty screen, and you can measure the funnel.

---

## 4. Close the friend-invite loop (virality with attribution)

You already have the hard parts: `oval://` deep links, the unauthenticated
`/pods/:id/public` share preview, the web landing page for pod invites
(`backend/src/routes/web.ts`), and club invite redemption. What's missing is a
**measured user→user invite-to-Oval loop** — the entire growth model for a campus app.

**Frontend**
- Add a prominent "Invite a friend" / "Share this pod" CTA on `PodDetailScreen` and
  Home. It should share the existing public pod link (already deep-link-ready).
- Fire `invite.shared` (props: `surface`, `podId`) on share.

**Backend / attribution**
- When the public preview is viewed and when a signup arrives via a shared link, tag
  it. Cheapest version: append a `?ref=<podId or userId>` to the shared URL, capture it
  on the landing page, pass it through registration, and fire `invite.signup_attributed`
  (props: `ref`). No schema change needed if you store it as an event property; add a
  nullable `referredBy` column on `User` only if you later want a true referral graph.

**Acceptance**: you can answer "how many signups came from an in-app share, and which
pods drove them."

---

## 5. Re-engagement (uses infra you already have)

You already run Vercel Cron maintenance (meetup reminders, recaps, waitlist/pod expiry)
and have Expo push set up. Add growth-oriented nudges, gated so they never feel spammy:

- **Dormant nudge**: a user with no `app.opened` in N days and a relevant pod forming
  near them gets one push. Reuse `NotificationService` and the cron framework.
- **Activation nudge**: verified but never joined a pod after 48h → one push pointing at
  a live pod in an interest they picked.

Measure with `notif.sent` / `notif.opened` so you can prove (or kill) each nudge.
Respect the existing notification preferences — these must honor opt-outs.

**Acceptance**: dormant and never-activated users get exactly one well-targeted nudge,
and you can measure open-through.

---

## Sequencing

For the **August distributed launch**, do 1–3 before you announce (you cannot run a
launch blind, and an empty app burns your one first impression), then 4–5 once real
users are flowing. Section 0 is already shipped; the only thing it needs is to be
deployed and verified live like any other backend change.
