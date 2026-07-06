# Revamp Implementation Review — July 2, 2026

> **STATUS UPDATE (same day):** everything below has been addressed in a follow-up
> pass — see **"Fixes applied"** at the end of this doc for what changed, two
> corrections to the original findings, and the three things that still need a
> human (backend test run, Vercel cron plan, browse-before-verify).

Audit of the uncommitted revamp implementation (89 files, ~3.5k insertions) against `docs/revamp/REVAMP_00–04`.

**Validation status:** frontend `tsc` ✓, backend `tsc` ✓, frontend jest 6/6 suites ✓. Backend vitest and `migrations:check` could not run in the review sandbox (no Postgres, Prisma engine CDN blocked) — **run `cd backend && npm test` and `npm run migrations:check` locally before committing.** The two new migrations were verified by hand against `schema.prisma` and match.

**Overall:** doc 01 (design system) is essentially complete and high quality. Doc 03 (backend) is ~85% built and mostly solid. Docs 02 and 04 are roughly half-implemented — several headline screens (Home, Inbox, Pod Chat, Profile) got token retouches instead of the spec'd rebuilds, and a handful of the growth loops have real bugs. The findings below are ordered by severity.

---

## P0 — Broken outcomes (fix before anything else)

### P0-1. The daily cron makes most of the new push layer dead code
`backend/vercel.json` runs `/cron/maintenance` at `0 0 * * *` — **once per day, midnight UTC** — and the backend is serverless. Consequences:

- `sendWeeklyRecaps` gates on `getDay() === 0 && getHours() === 18`. The only run of the day happens at hour **0**, so the Sunday recap **never sends**.
- `sendFirstPodNudges` gates on `getHours() >= 8`. At hour 0 it returns immediately, so the first-pod morning nudge **never sends**.
- `sendMeetupReminders` targets pods meeting 30–70 min out. With one run per day, only pods meeting 00:30–01:10 UTC (~8:30 pm ET) ever get a reminder. This was the "highest priority in the entire revamp" (03 §1) and it still doesn't work in practice.
- `checkPushReceipts` drains an **in-memory** `pendingPushReceipts` queue. On Vercel, the instance that sent the pushes is not the instance the cron hits — the queue is always empty, so `DeviceNotRegistered` cleanup never happens. (The code comment acknowledges the tradeoff, but on this deployment it's a no-op, not a tradeoff.)
- Recap prompts, demand conversion prompts, and waitlist expiry all also run once daily at a fixed time.

**Fix:** run maintenance every 5–10 minutes (Vercel Pro cron, or an external pinger like cron-job.org / GitHub Actions hitting `/cron/maintenance` with the secret), replace exact-hour equality checks with windows + idempotency guards, and persist push tickets (a small table) instead of the in-memory queue. Also note `maxDuration: 30` — the weekly-recap loop does per-user queries and could blow that budget once user count grows.

### P0-2. Every "today / tonight / Sunday 6pm / 8am" computation uses server-local time (UTC)
`inboxSummary.startOfToday()`, `NotificationService.startOfDay/startOfWeek/sameLocalDate`, `FIRST_POD_NUDGE_HOUR`, the weekly-recap `getHours() === 18`, and analytics `dayKey()` all use the server clock. On Vercel that's UTC, but the product is Columbus, Ohio: "friends out tonight" flips over at 8 pm ET, the "morning of" nudge fires from 4 am ET, etc.

**Fix:** set `process.env.TZ = 'America/New_York'` at the very top of `server.ts` (before any date use), or compute ET explicitly. Do this together with P0-1 since the hour-gates interact.

### P0-3. FirstPlan join strands the user (dead-end at the peak activation moment)
`FirstPlanScreen.handleJoin` does `navigation.replace('PodDetail', …)`. FirstPlan is the **initial and only route** in the stack, so after replace the stack is just `[PodDetail]`: the back arrow is a no-op, there's no tab bar, and Android hardware back exits the app. The brand-new user who just joined their first pod is stuck until they force-restart.

**Fix:** `navigation.reset({ routes: [{ name: 'MainTabs' }, { name: 'PodDetail', params: { podId } }] })` (or navigate to MainTabs first, then push PodDetail).

### P0-4. The [+] → "Start a pod" flow works exactly once per app session
`CreateSheet.openActivities` navigates to Discover with `startCreate: true`. `ExploreScreen` opens the template picker guarded by `handledStartCreateRef` (once per mount), and the `startCreate` param is never cleared — so the second time the user taps [+] → Start a pod, the effect deps haven't changed and **nothing happens**. Tab screens stay mounted, so this persists for the whole session.

**Fix:** pass a nonce (`startCreate: Date.now()`) and key the effect on it, or `navigation.setParams({ startCreate: undefined })` after handling and drop the ref.

### P0-5. `app.opened` launch events are anonymous → DAU/retention undercounted
`AuthContext` fires `trackEvent('app.opened', { state: 'launch' })` in a mount effect that runs **before** the stored token is restored, so cold-launch events post with `userId: null`. `/analytics/summary` computes DAU, WAU, D1/D7 from `app.opened` with `userId != null` — a user who opens the app once and doesn't background/foreground it records **nothing attributable**. D1/D7 will read systematically low, which poisons exactly the numbers the revamp was built to read.

**Fix:** fire the launch event after session restore completes (or additionally fire once when `token` becomes non-null per app start).

---

## P1 — Real bugs

### P1-1. Home "Your next move" card uses `accentText` as a fill
`HomeScreen` (~line 444): `color={colors.accentText}` on the next-pod Slab. D-1 explicitly forbids accentText as a fill — in dark mode this renders a `#FF4D63` card with white text (~3.5:1, fails AA). Should be `colors.primary`.

### P1-2. Discover has double top padding
`DiscoverScreen` adds `insets.top` above the segmented control, and both segment bodies (`ExploreScreen`, `ClubsHomeScreen`) still add `insets.top + spacing.md` to their own scroll content — a status-bar-height dead gap under the control on both segments. Remove the inset from the segment bodies (accept a prop or context flag). Also: segment scroll positions aren't preserved (segments unmount on switch; spec 02 §3), and the Activities segment still shows the old "FIND YOUR PEOPLE / Explore" masthead inside the Discover tab.

### P1-3. Demand pool is consumed (and notified) by private pods
`POST /pods/join` (create path, `pods.ts` ~536) calls `notifyDemandPoolPodCreated` unconditionally — including for `locationType: 'private'` pods. Strangers in the demand pool get pushed a deep link to a private pod, and the whole pool is marked consumed by supply they may not be able to see. Also the call is `await`ed inline (queries + push sends before the create response returns) — make it fire-and-forget like `notifyNewMessage`, and skip/keep-alive the pool for private pods. Copy nit: the notification always says "opened for tonight" regardless of the pod's actual day.

### P1-4. Pod-unread badge hides pods containing any blocked user
`countUnreadPodsForUser` excludes a pod from the unread count if **any member** is blocked (`members: { none: { userId: in blockedIds } } }`), but the pod chat itself is still visible/usable. Filter unread **messages by sender** instead. Result today: Inbox badge disagrees with what the user can see.

### P1-5. Inbox badge counts things the Inbox screen doesn't show
The tab badge = `summary.total` including `podUnread`, but pod threads were never added to the Inbox screen (02 §6 pod rows with the POD tag are unimplemented). A user with pod unreads sees a badge they can't explain or clear from Inbox (pod unread `CountBubble`s do exist on Plans rows). Either add pod threads to Inbox per spec or drop `podUnread` from the badge until then.

### P1-6. `invite.shared` fires on dismissed share sheets
`PodDetailScreen.handleShare` and `CreateSheet.shareInvite` track after `Share.share()` resolves without checking `result.action` — on iOS a dismissed sheet still counts as a share, inflating invite K. Check for `Share.sharedAction`.

### P1-7. Location pre-prompt lost its "Not now" option
Both `HomeScreen` and `ExploreScreen` `explainAndRequestLocation` alerts now have a single "Continue" button — the user cannot decline the pre-prompt (iOS alerts can't be dismissed otherwise). Restore the cancel option; forced pre-permission prompts also read poorly in App Store review.

### P1-8. Demand-conversion pushes are gated on the `weeklyRecap` preference
Both `sendDemandConversionPrompts` and `notifyDemandPoolPodCreated` check `prefs.weeklyRecap`. A user turning off "weekly recap" silently also turns off demand notifications. Add a distinct pref (or an umbrella "suggestions" pref) — the settings UI otherwise misrepresents what it controls.

### P1-9. Metric definition: `weeklyAttendedPlansPerWau` mixes units
`/analytics/summary` divides attendance over the whole `days` window (default 14) by the **last week's** WAU. The north-star is weekly attended plans per weekly active — compute both over the same 7-day window.

---

## P2 — Spec'd but not implemented (the biggest gaps are engagement surfaces)

- **Home rebuild (02 §1): not done.** Only token/nav renames landed. No hero with one next action, no inline Join anywhere on Home, no social-proof lines, no `useJoinPod` hook (so the spec'd 409 → waitlist / open-existing offers exist nowhere except PodDetail's pre-existing flow), the duplication the spec called out is still there (agenda + "Your next move" show the same pod; open-pods list + activity rail + clubs-today all still render; 8+ sections vs the "≤6" acceptance bar). The acceptance line "the same pod never appears twice on Home" fails.
- **Pod Chat contextual cards (02 §5): not done.** No T-2h confirm-attendance card, no post-completion "How was it?" card, no message grouping / day separators (ditto ThreadScreen, 02 §7 — `src/utils/chat.ts` is the old polling merge util, not the spec'd grouping helper).
- **Profile stats (02 §8 + 04 §3b): not done.** No "Plans joined/hosted", no private on-time stat, no "people met" count, no reconnect prompts. The "met-count" moat feature has no surface.
- **Post-create share prompt (04 §4b): not done.** Creating a pod goes straight to PodDetail with no "Pod's up. Now fill it." moment — the single highest-leverage share prompt in the plan.
- **OG tags (04 §4a): not done.** The pod web page is still static "Join a Pod on Oval" — no activity/time/spots-left meta. Group-chat link previews (the stated growth model) render generic. `web.ts` now has prisma imported for the `invite.link_opened` log, so fetching the pod for OG meta is cheap to add.
- **Twin ≠ full spec (04 §2d):** twin creation works and is tracked, but the original pod's waitlist is not notified that a second pod opened.
- **Club→pod bridge (04 §2e): not done.** No post-meeting prompt, no officer "spin up a hang" row on MeetingDetail.
- **Browse-before-verify (04 §4d): not done** (spec said ship last — fine, just tracking).
- **Discover "Happening now" list with inline Join (02 §3):** activities segment kept the old Explore layout; no inline join on the feed list.
- **Friends-tonight on Home pulse (02 §1 / 03 §10):** the backend data exists in `/inbox/summary` but Home never renders the third pulse column.

## P2 — Smaller quality items

- **FirstPlan feed fetch:** `fetchFeed({ limit: 3 })` then filters to joinable — can show 1 or 0 pods when the top 3 are full. Fetch ~10 and slice 3 after filtering.
- **CreateSheet "Custom" row in the Explore picker** just closes the sheet (`handleCustomTemplate`) — user lands back on the grid with no cue. Consider navigating to the activity list in pick-mode or opening the composer for a default activity.
- **Badge staleness after reading a chat:** GET messages stamps read state but nothing pings the reader's own `user-` topic, so the tab badge stays stale up to 60 s. Cheap fix: broadcast `INBOX_UPDATED` to self on stamp, or refresh the badge on chat blur.
- **N+1 query patterns:** `getPodUnreadCounts` (per-pod queries on `/pods/mine`), `countUnreadPodsForUser` (2 queries per membership), `sendWeeklyRecaps` (per-user queries). Fine at launch scale; will need batching (single `groupBy` over messages joined to read states) before it matters. Worth a TODO comment now.
- **`getLastNotificationResponseAsync` re-fires** the last tapped notification's deep link on any nav-container remount within the same process; consider tracking the handled response identifier.
- **`expireOldPods` throttle** is per-instance module state — on serverless it's a soft throttle at best (harmless, just don't rely on it).
- **Analytics `dayKey()`** builds a local-midnight Date then slices `toISOString()` — correct on UTC servers and still correct if TZ is set to America/New_York, but the mixed local/UTC intent is fragile; make it explicit when fixing P0-2.
- **`interestTags.test.ts`** only asserts mappings are non-empty strings, not that they're real activity categories (they are today — verified by hand — but the test wouldn't catch drift). Assert against the known category set.

---

## What's in good shape (verified)

- **Design system (01):** tokens match the spec tables exactly; system-font migration complete (no Sora/Inter/`expo-google-fonts` anywhere, packages removed); zero raw hex in screens; `faint` cleaned off meaningful text (remaining uses are placeholders/disabled); blur only on dock + Sheet; `AppBackdrop` flattened; radii/elevation per spec; theme-flash fix (`ready` gate + splash hold) implemented correctly; tab bar is Home/Discover/+/Plans/Inbox with a working create sheet; `EmptyState` now compile-enforces actions and every screen passes one.
- **Read state (03 §2):** model, stamping on GET and POST, joinedAt fallback, `unreadCount` on `/pods/mine` — all per spec, with tests.
- **Inbox summary (03 §3):** correct math, blocks respected, realtime `INBOX_UPDATED` pings wired from DMs, pod messages, invites, and friend requests; client badge uses it with the 60s poll + realtime.
- **Meetup reminder idempotency (03 §8):** `meetupReminderSentAt` with claim-before-send (`updateMany` guard) — race-safe, tested. (Just unblock it via P0-1.)
- **Feed (03 §5):** deterministic `orderBy`, interest boost for <3 memberships with the spec'd sort keys and id tiebreaker, `TAG_TO_CATEGORY` covers all 16 tags and every value matches a real seed category (hand-verified), throttled `expireOldPods`.
- **Templates (04 §2a/2b):** all 10 template activity titles exist in the seed catalog and every template location passes the backend allowlist for its category (en-dashes match); anchor-window defaults respect the 1-week create cap; template share tracked via `pod.created {template}`.
- **Demand signals (04 §2c):** endpoints, counts on `GET /activities`, chips on Explore + ActivityPods empty states, consume-on-join in the join transaction, threshold prompts with a 7-day re-prompt guard — solid apart from P1-3/P1-8.
- **Attribution (03 §6):** `?ref=` on pod share URLs, referral capture from initial/deep links, `referredBy` on `auth.register`, server-side `invite.link_opened`, all readable in `/analytics/summary`.
- **Analytics summary (03 §4 + 04 §6):** activation windows, DAU/WAU/D1/D7, loop counts, template share, liquidity, demand, invite funnel — admin-gated, with a seeded-math test.
- **Push plumbing (03 §1 client):** `registerTokenIfGranted` on authed start, foreground handler, tap routing with cold-start handling and a nav-ready queue, `data.url` on every server push including the new DM notification + `thread/:threadId` linking. (Server cadence is P0-1.)
- **Recap chaining (04 §3a):** rating-3 "Run it back?" with next-week scheduling, capped to the 1-week limit, tracked. Rating ≤2 correctly skips the pitch.
- **Migrations:** SQL matches `schema.prisma` for `PodReadState`, `PodDemand`, `firstPodNudgeSentAt`.

## Suggested fix order

1. P0-1 + P0-2 together (cron cadence, TZ, hour-gate windows, ticket persistence) — everything retention-related depends on it.
2. P0-3, P0-4 (two small navigation fixes, both first-session killers).
3. P0-5 (one-line-ish analytics fix; do it before collecting launch data).
4. P1-1…P1-8 (each is small).
5. The P2 engagement surfaces in the 04 §7 order: Home hero + inline join first, then post-create share prompt + OG tags, then chat cards, then profile stats/reconnects.

---

# Fixes applied — July 2, 2026 (follow-up pass)

Validation after the pass: backend `tsc` ✓, frontend `tsc` ✓, frontend jest 6/6 suites (20 tests) ✓. Backend vitest still can't run in the review sandbox — **run `cd backend && npm test` and `npm run migrations:check` locally**; new/updated tests were added for the changed behavior (weekly-recap gate window, push-receipt persistence, OG tags incl. the private-pod no-leak case, interest-tag category validity).

## P0s — all fixed

- **P0-1 (cron/push layer):** `vercel.json` sets `env.TZ` and keeps a **daily Hobby-safe backstop cron** (`0 17 * * *` = 1pm ET; sub-daily crons fail Hobby deploys). ⚠️ **The real 5–10-min cadence must come from an external scheduler (cron-job.org / GitHub Actions) hitting `/cron/maintenance` with `Authorization: Bearer <CRON_SECRET>` — verify the job exists and returns 200 (401 = wrong secret, 503 = CRON_SECRET unset on Vercel). On Vercel Pro you can instead set the vercel.json cron to `*/10 * * * *`.** Weekly recap gate is a window (`Sunday && hour >= 18`) instead of exact-hour equality, idempotent via the existing 1/day non-transactional budget. Push tickets are persisted in a new `PushReceipt` table (migration `20260702140000_push_receipts`; accessed via raw SQL so the checked-in generated client stays valid — regenerates automatically on `prisma generate`), read after a 15-min settling delay, deleted after one check.
- **P0-2 (timezone):** `TZ=America/New_York` set in `vercel.json` env + defensive assignment at the top of `server.ts`. Analytics `dayKey()` now builds an explicit local date string.
- **P0-3 (FirstPlan dead-end):** join now `navigation.reset`s to `[MainTabs, PodDetail]` so back and the tab bar work. Also over-fetches the feed (limit 10 → slice 3 joinable).
- **P0-4 (create-once bug):** `startCreate` is a `Date.now()` nonce end-to-end (CreateSheet → Discover → Explore), so every [+] → "Start a pod" tap opens the template picker.
- **P0-5 (anonymous launch events):** `app.opened {state:'launch'}` now fires after session restore completes, so it carries the userId.

## P1s — all fixed

- Home hero fill uses `colors.primary` (accentText-as-fill violation gone — the whole screen was rebuilt, see below).
- Discover: segment bodies take an `embedded` prop (no more double status-bar padding), both segments stay mounted with visibility toggling (scroll positions preserved), Activities masthead retitled "Discover".
- Demand pool: private pods no longer consume or notify the pool; the notify call is fire-and-forget; copy computes the real day label ("tonight"/"tomorrow"/"on Saturday"); demand pushes gated on a new dedicated `demandAlerts` preference (backend prefs + PATCH validation + Privacy & Data toggle) instead of `weeklyRecap`.
- Unread counts filter blocked **senders** (never whole pods) in both `getPodUnreadCounts` and `countUnreadPodsForUser`; `/pods/mine` passes blocked ids; read-state floors are now batch-fetched (2 queries instead of 2N).
- Inbox now shows pod chats with unread as threads (POD tag + CountBubble → PodChat), so the tab badge always has a visible counterpart.
- `invite.shared` only fires when `Share.share` returns a non-dismissed action (PodDetail + CreateSheet).
- Location pre-prompts got their "Not now" button back (Home + Explore).
- `weeklyAttendedPlansPerWau` computes both sides over the same 7 days (`attendedLast7Days` added to the payload).
- Notification tap handling is identifier-guarded so `getLastNotificationResponseAsync` can't replay an old deep link.

## P2s — implemented

- **`useJoinPod` hook** (02 §1): shared inline join with success haptic + navigate, and both 409 recovery paths — full → **waitlist AND twin** offer (04 §2d), duplicate-activity → "Open my pod".
- **Home rebuilt per 02 §1:** masthead → permission chips → ONE hero (own next pod/meeting, else best joinable pick with inline Join + friends-going proof, else EmptyState → template picker) → pulse strip with the third "Friends out" column (from `/inbox/summary`) → deduped "Today" agenda → "Happening soon" (3 joinable pods, social-proof lines, inline Join) → compact 96px map strip opening a full-screen map modal. Activity rail, clubs-today, and open-pods sections deleted; the hero pod is excluded from every other section.
- **Discover "Happening now"** list with inline Join under the live rail (02 §3); "Custom" in the global template picker now shows a hint banner instead of silently closing.
- **Pod Chat contextual cards** (02 §5): T-2h "See you soon → I'm coming" (confirm attendance) and post-completion "How was it? → Post recap", one at a time, dismissible. (Correction below: grouping/day separators already existed.)
- **Post-create share prompt** (04 §4b): PodDetail shows a dismissible "Pod's up. Now fill it." card with Share link / Invite friends when reached with `justCreated` — wired from template creates, custom create, twins, and recap chaining.
- **OG tags** (04 §4a): the pod web page renders `og:title` ("Boba Run · Tue 8:00 PM") + spots-left description for public FORMING/LOCKED pods; private or missing pods keep the generic copy (no existence/location leak). Tests added.
- **Twin waitlist notify** (04 §2d): backend reads `twinFromPodId` on create and pushes "A second pod opened" to the original pod's waitlist (waitlistSpot pref, transactional).
- **Profile stats** (02 §8 + 04 §3b): own profile gains HOSTED and PEOPLE MET (computed from real pod memberships). **UserProfile no longer shows RELIABILITY (that was a D-5 violation the original review missed)** — replaced with a "TOGETHER" shared-pods stat, plus a reconnect card ("You and Sam have been to 3 pods together") backed by a new `sharedPodCount` on the public-profile endpoint.
- **Club → pod bridge** (04 §2e): officers see a "Spin up a hang" card on MeetingDetail once the meeting has started, deep-linking to the template picker.
- Badge freshness: reading a pod chat pings the reader's own realtime topic so the tab badge clears immediately.

## Corrections to the original review

- **Chat grouping/day separators** (02 §5/§7) already existed in both PodChat and Thread — the original review misread the small diffs as "not done." Only the contextual cards were missing.
- **Profile trust stats** (joined/attended/reliability) already existed on the own-profile screen; the real gaps were hosted/met counts and the reliability leak on *other* users' profiles — both now addressed.
- **P1-4 nuance:** blocking already removes both users from shared pods, so the pod-level unread exclusion was rarely reachable; the sender-level filter is still the correct semantics and is what ships now.

## Still needs a human

1. **Run the backend suite + `npm run migrations:check` locally** (sandbox can't reach Prisma's engine CDN or run Postgres). Then `npx prisma generate` to pick up the `PushReceipt` model locally.
2. **Vercel cron cadence:** confirm the plan supports `*/10 * * * *` (Hobby doesn't) or wire an external scheduler at `/cron/maintenance`.
3. **Browse-before-verify (04 §4d)** remains unbuilt by design — the spec ships it last; it's an auth-model change deserving its own session.

---

# User-reported bugs — July 4 pass

Three bugs reported from device testing, root-caused and fixed, plus the adjacent
bugs found while sweeping the same subsystems.

## Bug 1 — Tapping a push notification just opens the app (no navigation)

Two compounding causes:

1. The tap handler routed the notification's `data.url` through
   `Linking.openURL('oval://…')` — an OS round-trip with the app's own scheme
   that silently no-ops in several app states (and raced navigation readiness
   on cold start).
2. Even when it worked, a **cold-start** deep link built a navigation state
   containing ONLY the target screen — PodDetail with no tab bar and a dead
   back button (same dead-end class as the FirstPlan P0-3 bug).

**Fix:** notification responses now feed React Navigation's own linking
pipeline via `linking.getInitialURL` / `linking.subscribe` in `App.tsx` (the
documented expo-notifications + React Navigation recipe) — no OS round-trip, no
readiness race; responses are deduped by notification identifier so
`getLastNotificationResponseAsync` can't replay an old tap after a reload. The
linking config also gained `initialRouteName: 'MainTabs'` so ANY cold-start
deep link (push tap or share link) lands with MainTabs underneath.

**Same-family fixes:** Android had no notification channel registered — Expo
pushes land on the `default` channel, and without registering it at HIGH
importance Android shows no heads-up banner (silent tray only); now registered
at startup. DM notification taps open Thread without a `title` param — the
header now derives the other person's name from the loaded messages instead of
showing "Messages". All push `data.url` values were checked against the
linking config: `pod/:podId`, `thread/:threadId`, `clubs/:clubId`,
`clubs/:clubId/events/:meetingId`, `discover`, `plans` all resolve. ⚠️ Note:
pushes sent by an **old backend deploy** carry no `data.url` at all — tap
routing only works once the current backend is deployed.

## Bug 2 — Realtime doesn't work

Root cause: **the client Supabase env vars don't exist anywhere.**
`frontend/.env` had no `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
(and neither did `eas.json`), so `getSupabase()` returns null in every build and
the app silently falls back to slow polling — by design, which is why nothing
errored. The topics, event names, payload shape, and REST broadcast call were
all verified correct; this was purely missing configuration.

**Fix + guardrails:**
- `frontend/.env`: `EXPO_PUBLIC_SUPABASE_URL` filled from the backend project;
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` added as an empty line — **⚠️ ACTION: paste
  the anon public key from Supabase Dashboard → Settings → API** (safe to embed
  in the client).
- `eas.json`: `EXPO_PUBLIC_SUPABASE_URL` added to the production and preview
  build envs — **⚠️ ACTION: add `EXPO_PUBLIC_SUPABASE_ANON_KEY` there too (or
  as an EAS env var) before the next build.**
- The silent degradation is now loud: `getSupabase()` warns once in dev when
  env is missing, and the backend logs a startup warning in production when
  `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are unset (realtime broadcasts
  are skipped entirely without them — **⚠️ verify both are set on Vercel**).

## Bug 3 — Can't copy message text

Message bubbles aren't selectable and the long-press action sheets (Reply /
React / Report / Delete) had no copy action. Added **"Copy text"** via
`expo-clipboard` (already a dependency) to all three chat surfaces: pod chat,
DM threads, and club channels (both messages and announcements). Pasting into
inputs was verified unblocked (no `contextMenuHidden` anywhere) — the missing
copy affordance was the whole bug.

## Validation

Frontend `tsc` ✓ + jest 6/6 suites (20 tests) ✓; backend `tsc` ✓. Backend
vitest still needs a local run (see "Still needs a human" above).
