# Oval — Cold-Start & Clubs Revamp

**Written:** July 25, 2026 · **Owner:** Brady · **Target:** substantially complete before the ~Aug 10 Play submission, fully live for welcome week (Aug 19–25).

**Companion docs:** `docs/STATE_2026-07-06.md` (backlog), `docs/GROWTH_PLAN.md` (measurement), `docs/LAUNCH_PLAN_FALL2026.md` (external deadlines), `docs/wireframes-2026/clubs-directions-2026-07.html` (clubs layout studies), `ARCHITECTURE.md` Part 0.

---

## 0. Thesis

Oval's home board goes empty because `Pod` is perishable by construction: it requires a future `meetupTime` and `expireOldPods()` sweeps it afterward. Steady-state board size is *creation rate × lifetime*. At launch-scale N with a lifetime measured in days, that product is regularly zero. No amount of empty-state copy changes the arithmetic.

Three structural fixes, in order of leverage:

1. **Collect intent instead of supply.** Creating a pod is a public bid that can visibly fail; that social risk — not effort — is why nobody goes first. A demand signal is cheap, private, and reversible. The system, not a brave student, crystallizes the pod.
2. **Make signup itself supply.** If a new user's first action deposits demand signals, the board fills from the one event welcome week guarantees. Cold start flips from "N−1 users must act before user N gets value" to "user 1 contributes on arrival."
3. **Make emptiness legible.** A scheduled formation window ("drop") means a quiet Tuesday reads as *waiting*, not *dead*.

Everything below serves those three. Pods are not removed and are not buried inside clubs; clubs become a **scope** on pods, which shrinks the denominator so demand counts read as strong instead of as evidence of abandonment.

---

## 1. What already exists — do not rebuild

The demand mechanic is largely built and shipped. Read these before writing anything.

| Thing | Location |
|---|---|
| `PodDemand` model (7-day TTL, `consumedAt`, unique `[userId, activityId]`) | `backend/prisma/schema.prisma` |
| `POST` / `DELETE /activities/:id/demand`, `DEMAND_TTL_MS` | `backend/src/routes/activities.ts:26,111,163` |
| `demandCount` + `myDemanded` on the activities list | `backend/src/routes/activities.ts:234-259` |
| `DEMAND_POOL_THRESHOLD = 4`, `sendDemandConversionPrompts()` | `backend/src/lib/NotificationService.ts:60,757` |
| Demand marked consumed on join | `backend/src/lib/joinExistingPod.ts:139` |
| Job runner (cron entry point) | `backend/src/lib/maintenanceJobs.ts` |
| `demandAlerts` notification preference | `NotificationService.ts:25`, `frontend/src/api.ts:1198` |
| Client demand calls | `frontend/src/api.ts:345,351` |
| Demand UI (chips) | `frontend/src/screens/ExploreScreen.tsx:347,666`, `ActivityPodsScreen.tsx:247` |
| Interest taxonomy `INTEREST_TAGS` → `TAG_TO_CATEGORY` | `backend/src/config/interestTags.ts` |
| Club categories | `frontend/src/constants/clubCategories.ts` |
| Club liveness data sources | `GET /clubs/today`, `/clubs/week`, `getMyClubs`, `nextMeeting`, `attendeeCount`, `upcomingMeetingCount` |
| Unread source of truth | `GET /inbox/summary` (`backend/src/routes/inbox.ts:7`) |
| Attendance confirmation primitive | `PodMember.confirmedAt` (exists, currently unused for this) |

**The single largest defect today:** none of the demand UI appears on `HomeScreen.tsx`. The screen where a user hits the empty board offers "Start a pod" — the highest-friction, highest-social-risk action in the app — while the zero-risk action sits one tab away behind a category browse. Fixing that placement is worth more than any other item in this document.

**The single largest defect on the clubs screen:** `ClubsHomeScreen.tsx:129` sorts Discover by `memberCount` descending — a static ranking. The screen is byte-identical every time it opens. That, plus rows that carry no content (mark + name + one administrative caption + chevron), is why it reads as a utility list.

---

## 2. Phase 0 — Unify the taxonomy

Everything downstream depends on one shared vocabulary. Do this first; it is small and it is load-bearing.

Today there are two layers: `INTEREST_TAGS` (16 personal tags) → `TAG_TO_CATEGORY` → club categories. Add a third layer **above** them: **intents**, the entry point for both club discovery and pod demand.

Create `backend/src/config/intents.ts` (and mirror the constant to the frontend, or expose via an endpoint — do not fork the list):

```ts
export const INTENTS = {
  MAKE:    { label: 'Make something',   blurb: 'Film, music, art',      tags: ['Art','Dance','Film','Music','Photography'] },
  MOVE:    { label: 'Move together',    blurb: 'Sports, outdoors, gym', tags: ['Gym','Outdoors','Sports'] },
  BUILD:   { label: 'Build your future',blurb: 'STEM, business',        tags: ['Engineering','Pre-Med','Tech','Reading'] },
  GIVE:    { label: 'Give something',   blurb: 'Service, advocacy',     tags: ['Volunteering'] },
  HANG:    { label: 'Just hang out',    blurb: 'Food, games, people',   tags: ['Food','Gaming','Greek Life'] },
} as const;
```

Every tag in `INTEREST_TAGS` must appear in exactly one intent — add a unit test asserting total coverage and no duplicates, so the lists can't drift.

Intents drive: the Clubs → Discover tiles, the onboarding step 1, and the activity ordering on Home. `getInterestCategories()` continues to work unchanged; intents resolve *through* tags to categories.

---

## 3. Schema changes

One migration (`npm run db:migrate`). Deploys already run `prisma migrate deploy` per `backend/vercel.json`.

```prisma
model PodDemand {
  // existing: id, userId, activityId, createdAt, expiresAt, consumedAt
  windows       String   @default("[]")   // JSON array of WindowKey
  clubId        String?                    // club-scoped pool
  clubMeetingId String?                    // "find people to go with" on a specific meeting

  club    Club?        @relation(fields: [clubId], references: [id], onDelete: Cascade)
  meeting ClubMeeting? @relation(fields: [clubMeetingId], references: [id], onDelete: Cascade)

  @@unique([userId, activityId, clubId, clubMeetingId])   // replaces @@unique([userId, activityId])
  @@index([activityId, clubId, expiresAt])
}

model Pod {
  // existing fields unchanged
  origin        String   @default("USER")  // USER | DEMAND | DROP | CLUB
  clubId        String?
  clubMeetingId String?
  formedAt      DateTime?                  // when auto-formation created it
  confirmDeadline DateTime?                // T-3h gate; null for USER pods

  club    Club?        @relation(fields: [clubId], references: [id], onDelete: SetNull)
  meeting ClubMeeting? @relation(fields: [clubMeetingId], references: [id], onDelete: SetNull)

  @@index([clubId])
}
```

`Pod.status` gains a `DISSOLVED` value (string column today — no enum migration needed, but update every `status` filter: `routes/pods.ts` feed query, `expireOldPods.ts`, `NotificationService` reminder queries, and the public preview route).

`Pod.creatorId` is already nullable — **auto-formed pods leave it null**. That null is the mechanism: nobody went first because nobody had to.

Backfill: existing rows get `origin: 'USER'`, `windows: '[]'`. No data migration risk.

---

## 4. Backend

### 4.1 Time windows

`backend/src/config/windows.ts`. All resolution in Columbus time — `TZ=America/New_York` is forced in `server.ts` and `vercel.json`; never construct these in UTC.

```ts
export const WINDOWS = {
  WEEKDAY_MORNING: { label: 'Weekday mornings', days: [1,2,3,4,5], hour: 8  },
  WEEKDAY_AFTERNOON:{ label: 'Weekday afternoons', days: [1,2,3,4,5], hour: 15 },
  WEEKNIGHT:       { label: 'Weeknights',      days: [1,2,3,4],   hour: 19 },
  WEEKEND_DAY:     { label: 'Weekend days',    days: [0,6],       hour: 14 },
  WEEKEND_NIGHT:   { label: 'Weekend nights',  days: [5,6],       hour: 21 },
} as const;
```

`nextSlot(window, notBefore)` returns the next matching day/hour at least 12 hours out — enough notice that a formed group is actionable.

`POST /activities/:id/demand` gains an optional `windows: WindowKey[]` body field, validated against the keys (the global `inputGuard` handles structure; validate membership explicitly). Empty array = "any time," which matches every window during formation.

**This is the crucial ordering decision:** windows are collected *at signal time*, not after the pool fills. A post-threshold scheduling round is a second round-trip that requires everyone to respond again, and at launch N those pools will die at that step — failing later and louder than not forming at all.

### 4.2 Automatic formation

New `backend/src/lib/formPodsFromDemand.ts`, called from `maintenanceJobs.ts`.

```
for each (activityId, clubId, window) group over PodDemand
    where consumedAt IS NULL and expiresAt > now:

  if group.size < DEMAND_FORM_THRESHOLD (3 at launch)      → skip
  if an open FORMING pod already exists for that activity  → skip   (reuse the
      existing check in sendDemandConversionPrompts:791-799)
  if any member already has an auto-formed pod today       → skip that member

  create Pod {
    activityId, clubId,
    meetupTime: nextSlot(window),
    location: activity.defaultLocation,
    locationType: 'public',
    creatorId: null,
    origin: 'DEMAND' | 'DROP',
    status: 'FORMING',
    formedAt: now,
    confirmDeadline: meetupTime - 3h,
  }
  insert PodMember rows (confirmedAt: null) up to maxMembers;
      overflow spills into a second pod rather than being dropped
  mark those PodDemand rows consumed
  push 'pod_auto_formed' → "Your group locked in: <activity>, <day> <time>."
  fire analytics demand.pod_auto_created { activityId, window, size, origin }
```

### 4.3 The confirmation gate — non-negotiable

New `backend/src/lib/reconcileAutoPods.ts`, also in `maintenanceJobs`.

For every pod with `confirmDeadline` in the past and `origin != 'USER'`:

- **`confirmedAt` count ≥ `minMembers`** → promote the earliest confirmer to `creatorId` (the pod gets a host, and therefore someone accountable), clear `confirmDeadline`, notify the group.
- **otherwise** → set `status: 'DISSOLVED'`, notify participants once ("not enough people confirmed — you're back in the pool"), and **re-insert their `PodDemand` rows** with the original `expiresAt` so the intent isn't destroyed.

Rationale: every mechanic in this document optimizes *formation*. None of them touch *attendance*. A pod that forms and then no-shows is worse than no pod, because it teaches the user that Oval's groups are fake — and that is the one thing that can't be rebuilt. A group that quietly fails to form is a fine outcome; a group that forms and evaporates in person is not. `NoShowReport` exists because this already matters.

Send one confirmation nudge at `meetupTime - 6h` to members with `confirmedAt: null`, honoring notification preferences.

### 4.4 Oval Drop

`backend/src/config/drops.ts`: **Wednesday and Sunday, 8:00 PM America/New_York.**

- `now - 3h` before a drop: push "Drop closes at 8 — what are you down for this week?" to users with active interests and no active demand. One push per drop, gated on `demandAlerts`.
- At the drop: run `formPodsFromDemand` across all activities at once with `origin: 'DROP'`.
- Results notify **only participants**. A drop that publicly announces "0 groups formed" is a far louder failure than a quiet board.
- Demand continues to accumulate between drops, and instant user-created pods remain available. Drops are the guaranteed floor, not the only path — spontaneity ("who wants food right now") is the most natural campus behavior and a drop-only model would kill it.

The `nextDropAt` timestamp is what makes emptiness legible on the client. Expose it on `GET /activities` and the home feed payload.

### 4.5 Club-scoped pods

`Pod.clubId` and `PodDemand.clubId` create pools whose denominator is a club, not a campus. "4 people are down" reads as strong inside a 30-person club and as abandonment across 60,000 students.

Two entry points:

- **Club → start a pod.** Officer or member creates a pod scoped to the club; it appears on the club home and on Home for members.
- **"Find people to go with" on a club meeting.** Sets `clubMeetingId`. This case **auto-forms at threshold with no window collection at all**, because the meeting already fixes time, place, and purpose. This is the cleanest auto-formation path in the product — build it first and use it to validate the mechanic.

Club-scoped pods do not replace campus-wide pods. Putting pods exclusively inside clubs converts one potentially-dead surface into two.

### 4.6 Club liveness

`GET /clubs` returns a computed `livenessScore` and Discover sorts by it:

```
livenessScore =
    40 × (has a meeting in the next 48h)
  + 25 × min(1, messages in last 7d / 20)
  + 20 × min(1, joins in last 7d / 5)
  + 15 × min(1, upcomingMeetingCount / 3)
```

Also return derived **trait flags** — do not ask officers to author these, or you become the content bottleneck for 30+ clubs:

- `openToEveryone` ← `joinPolicy === 'OPEN'`
- `smallEnoughToKnowEveryone` ← `memberCount < 40`
- `showUpAlone` ← has a meeting with `visibility: 'PUBLIC'` in the next 14 days
- `noExperienceNeeded` ← club category in a beginner-friendly set, or an officer-set boolean defaulting from category

These pills are the most important copy on the discovery screen. The real barrier to joining a club as a freshman is not information — it's the fear of walking into an established group alone.

### 4.7 Pre-verification pulse (closes L9)

`GET /public/pulse` — unauthenticated, cached 5 minutes, no PII:

```json
{ "activeDemandCount": 37, "formingPodCount": 6, "clubCount": 14, "meetingsThisWeek": 9, "nextDropAt": "..." }
```

Rendered on `VerifyEmailScreen` and the landing site. Suppress the whole module when `activeDemandCount < 10` — below that it advertises emptiness. Aggregate demand is the only thing you can show an unverified visitor that is both privacy-clean and proof the app is alive.

---

## 5. Frontend

### 5.1 Home — `frontend/src/screens/HomeScreen.tsx`

Restructure top to bottom. The screen must be structurally incapable of reaching a bare empty state.

1. **Masthead** — unchanged.
2. **Hero — "your next move."** Priority: your confirmed pod → your club meeting today → a pool of yours that's one person short → countdown to the next drop. The last fallback means the hero *always* renders.
3. **"What are you down for this week?"** — 5 featured activities, one-tap demand with window chips revealed on tap, staged labels. This is the section that replaces the old empty state.
4. **"Almost ready"** — pools at threshold−1 or above, campus-wide and club-scoped.
5. **"Happening around campus"** — pods *and* club meetings merged, time-ordered. Club meetings recur, so this section does not decay to zero as long as one club is active. `renderHero` already handles `hero.kind === 'meeting'`, so the plumbing is partly there.
6. **Your plans** — waiting pools, unconfirmed auto-formed pods (with a prominent Confirm), formed pods.
7. **Map strip** — unchanged.

The empty state at `HomeScreen.tsx:345` is now reachable only with zero clubs *and* zero demand. Its copy becomes drop-anchored: "Nothing forming yet. The next drop is Wednesday at 8." Its primary action becomes **"I'm down for…"**, never "Start a pod."

### 5.2 Staged demand labels

Shared util, used everywhere a count could render. Never show a raw count below threshold.

| State | Label |
|---|---|
| `count < threshold − 1` | "Waiting for a few more" |
| `count === threshold − 1` | "One person away" |
| `count ≥ threshold` | "Ready — forming at the next drop" |
| after formation | "Group forming <day>" |

Fix `ExploreScreen.tsx:670`, which currently renders `${demandCount} down` for any nonzero value — including 1.

### 5.3 "One person away" invite

When a pool hits threshold−1, push to its members with a prefilled share: *"We're one person away from locking in a basketball group at OSU."* Deep link to the activity with `?ref=`, fire `invite.shared { surface: 'demand_pool' }`.

This is the strongest growth mechanic in the plan and it closes E4, still open in `STATE_2026-07-06.md`. It converts a generic "join my app" ask — which nobody sends — into a specific, urgent, socially legible one. It also makes joining strangers less intimidating, because the invited friend arrives with someone they know.

### 5.4 Onboarding — `FirstPlanScreen.tsx` + new step

Three steps, and the second is separate from the first **on purpose**:

1. **"What sounds like you?"** — pick ≥1 intent, then ≥3 interest tags. Writes `User.interestTags`. This is a *preference*: durable, used for personalization.
2. **"What are you actually down for this week?"** — activities filtered by step 1, multi-select, with window chips. Writes `PodDemand` rows. This is an *intent*: 7-day TTL, and the only signal with teeth.
3. **"Here's what's forming"** — the pools they just joined and the next drop time.

Collapsing 1 into 2 would be a mistake. "I like basketball" is not "I want to play basketball Thursday," and auto-enrolling a preference into a real group produces pods that look full and are dead — the failure mode that is strictly worse than empty.

Events: `onboarding.started`, `onboarding.intent_picked`, `onboarding.interests_picked {count}`, `onboarding.demand_signaled {count}`, `onboarding.completed`.

### 5.5 Clubs → My clubs ("Sunday on campus")

Rebuild the `segment === 'mine'` branch of `ClubsHomeScreen.tsx`. Layout per the chosen mockup:

1. **Masthead** — kicker is the live day (`SUNDAY ON CAMPUS`), title "Your clubs", caption "3 clubs · 5 unread".
2. **Hero — next up.** Full-bleed tinted card (category tint from `clubVisuals.ts`): time, event title, club + location, attendee `AvatarStack`, inline **RSVP**. Tapping goes to `ClubMeeting`.
3. **"Needs your attention."** Unread club chats and officer updates — **read from `GET /inbox/summary`, filtered to club sources.** Do not introduce a second unread store; two surfaces computing unreads independently will disagree, and the app badge already subscribes to `REALTIME_INBOX_EVENTS`.
4. **"Your rooms."** Icon row of joined clubs plus a browse affordance.
5. **No memberships** → render the Discover intent tiles inline instead of an empty state.

Remove the search bar and segmented control from the default view; search moves to an icon in the masthead. Four rows of chrome before any content is a Contacts/Settings pattern, not a social one.

### 5.6 Clubs → Discover (intent-first)

1. **"What sounds like you?"** — the 5 intent tiles, 2×3 grid, replacing the `CLUB_CATEGORIES` chip row. Selecting one filters and persists to the user's interests.
2. **Editorial hero** — the single best-matching club: cover tint, mark, name, verified check, member count, description, **trait pills**, `View club` + `Join`.
3. **Liveness-sorted list** — compact rows below, ordered by `livenessScore`, each carrying a live signal ("Meets tonight 6:30", "6 joined this week") rather than an administrative one.
4. **"Browse all clubs A–Z"** — the escape hatch for people who know what they want.

Delete `meetingSignal()`'s "N upcoming meetings" fallback; it reads like a database field, not a reason to care.

### 5.7 Naming

Pick one vocabulary and hold it. Recommended: **clubs** (the org), **rooms** (chat channels), **pods** (the small-group hangout), **pools** (accumulating demand), **drops** (the twice-weekly formation window). Do not also ship "signal," "circles," "scenes," or "pulse" as user-facing nouns — five names for two objects is a real cost, and the product has already survived one rename.

---

## 6. Instrumentation

`demand.signaled` and `demand.conversion_prompted` already fire. Add, before building the rest, so the drop model can be *read* after welcome week instead of argued about:

`demand.windows_selected {count}` · `demand.pool_reached_threshold {activityId, size}` · `demand.pod_auto_created {activityId, window, size, origin}` · `demand.pod_confirmed {podId}` · `demand.pod_dissolved {podId, confirmedCount}` · `drop.opened {dropId, poolCount}` · `drop.formed {dropId, podCount, userCount}` · `club.discover_intent_selected {intent}` · `club.joined_from {surface}` · `invite.shared {surface:'demand_pool'}`

Extend `GET /analytics/summary` with: demand→formation conversion rate, formation→confirmation rate, and **confirmation→attendance rate**. That last number is the one that says whether any of this worked.

Per `GROWTH_PLAN.md` §6: pull an activation baseline before the first drop and record it, or the comparison is impossible.

---

## 7. Sequencing

Every backend route file needs a sibling `*.test.ts` (Vitest, real Postgres, sequential); frontend needs `npm run typecheck` and `npm test` green. CI is `.github/workflows/release-check.yml`.

**Block 1 — foundations (do first, everything depends on them)**
1. Phase 0 taxonomy + coverage test
2. Schema migration (§3) + backfill
3. Windows config + `POST /activities/:id/demand` accepting `windows`
4. Instrumentation events (§6)

**Block 2 — the mechanic**
5. `formPodsFromDemand` + `reconcileAutoPods` + wire into `maintenanceJobs`
6. Confirmation nudge + gate; `DISSOLVED` handling across every `status` filter
7. Drops config + pre-drop push + `nextDropAt` on payloads
8. Tests for both libs, including the dissolve-and-restore path

**Block 3 — the surfaces that fix what you saw**
9. Home restructure (§5.1) — *highest value item in the document*
10. Staged labels + `ExploreScreen.tsx:670` fix
11. Onboarding 3-step flow
12. Featured activities (5 at launch; don't approve a long tail via `ActivityRequest`)

**Block 4 — clubs**
13. `livenessScore` + trait flags on `GET /clubs`
14. My clubs rebuild (§5.5)
15. Discover rebuild (§5.6)
16. Club-scoped pods + "find people to go with" on meetings (§4.5)

**Block 5 — growth & polish**
17. "One person away" invite
18. `GET /public/pulse` + pre-verify module
19. Analytics summary extensions

**Hard external constraints from `LAUNCH_PLAN_FALL2026.md`:** production Play submission ~Aug 10, D-U-N-S gates the Apple transfer and club outreach, welcome week Aug 19–25. Blocks 1–3 are the ones that must be in the Aug 10 build. Blocks 4–5 can ship in a point release before welcome week without touching store review.

---

## 8. Acceptance criteria

- A brand-new verified account completes onboarding, has ≥3 active `PodDemand` rows, and never sees a bare empty state.
- With zero pods and zero demand in the database, Home still renders a hero (drop countdown) and a populated "what are you down for" section.
- Three users signaling the same activity and an overlapping window produce one `Pod` with `creatorId: null` and `origin: 'DEMAND'`, and all three receive a push.
- A formed pod that nobody confirms is `DISSOLVED` by its `confirmDeadline`, its participants are notified once, and their demand rows are restored.
- No count below `DEMAND_FORM_THRESHOLD` is ever rendered as a raw number anywhere in the app.
- Clubs → Discover ordering changes between two sessions on different days with the same club set.
- `GET /analytics/summary` reports demand→formation, formation→confirmation, and confirmation→attendance.

## 9. Open risks

- **Threshold tuning.** `DEMAND_FORM_THRESHOLD = 3` is a launch guess. Make it an env-driven constant, not a literal, so it can be changed without a deploy cycle.
- **Drops cap spontaneity.** Keep instant pod creation available; revisit cadence once there's density.
- **Auto-formation without attendance discipline damages trust faster than emptiness does.** §4.3 is the mitigation and must not be descoped for time.
- **Officer turnover / club data rot** is out of scope here — see `docs/CLUB_LIFECYCLE_IMPLEMENTATION.md`.
- **This plan is a bet on an unmeasured mechanic.** Nothing in the demand system has ever been in front of a real user. Block 1's instrumentation is what makes welcome week an experiment rather than a guess — do not let it slip to the end.
