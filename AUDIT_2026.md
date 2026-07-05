# Oval — Full Product Audit (July 2026)

Scope: mobile app (frontend + the backend logic behind it). Covers app logic, design/UX, user engagement, and the cold-start problem, with a prioritized roadmap. Wireframes for the proposed light/dark redesign live in `docs/wireframes-2026/` (8 SVGs + the generator script).

Context notes: most of the P0s in `frontend/DESIGN_AUDIT.md` ("Scarlet Press" era) are verified fixed in the current Lumen codebase — KAV everywhere, inverted chat lists, avatar resolution inside `Avatar`/`ClubMark`, `DateTimeField` in ui.tsx, dock badge with app-wide polling, Sheet in wide use, RefreshControl on all feeds. This audit is about what's *still* wrong or missing.

---

## Part 1 — Logic & architecture

### L1 (P0) Push notification pipeline is broken end-to-end on the client

The backend side is solid (`NotificationService` with 13 preference categories, chunked Expo sends, cron-driven reminders). The client side has three gaps that together mean push is close to nonfunctional as a retention channel:

1. **Token registration only happens once, behind a tap.** `useNotificationPermission.requestNotifications()` is the only place `getExpoPushTokenAsync()` + `registerPushToken()` run — and it's only called from the Home-screen "Turn on alerts" chip. A user who already granted permission (or reinstalls, or gets a rotated Expo token, or switches devices) never re-registers. Their stored token silently goes stale and every notification bounces. Fix: on every app launch, if `getPermissionsAsync()` is granted, fetch the token and register it (idempotent upsert).
2. **No `Notifications.setNotificationHandler`.** Foreground pushes are silently dropped on iOS. Anyone using the app when a "waitlist spot opened" push arrives never sees it — the exact moment they'd act on it.
3. **No `addNotificationResponseReceivedListener`.** Tapping a push opens the app to wherever it last was. The deep-link config in `App.tsx` (`oval://pod/:podId` etc.) already exists — the notification payload just needs a `url` and a response listener that feeds it to `Linking`/the navigation ref. Right now the single highest-intent moment in the retention loop (user taps "Maya messaged the pod") lands them on the wrong screen.

Also confirm the backend prunes tokens on `DeviceNotRegistered` receipts — `send()` logs errors but doesn't appear to read receipts; dead tokens accumulate.

### L2 (P0) Interest tags are collected and then never used

Signup step 3 requires ≥1 interest tag and stores them on the user. Nothing reads them for ranking:

- `GET /pods/feed` ranks by past-recap ratings and past pod membership — data a **new user has none of**. For the exact population the cold-start problem hits (fresh accounts), the feed degrades to "soonest first," identical for everyone.
- The fix is cheap: map interest tags → activity categories and boost matching activities in the feed sort for users with < N pods of history. This single change makes signup step 3 stop being wasted effort and directly attacks first-session relevance.

### L3 (P0) Analytics are write-only

`analytics.ts` is 49 lines: a `POST /events` validator. Events fire from the client (`pod.joined`, `app.opened`, `verify.completed`, etc. per `docs/GROWTH_PLAN.md` §0), but there is no `GET /analytics/summary`, no dashboard, nothing. You cannot currently answer "what is our D1 retention" or "what % of verified users join a pod in 72h." GROWTH_PLAN §1 spec'd this and it was never built. Until it exists, every growth decision is a guess. Build the admin-gated summary endpoint (activation rate, DAU/WAU, D1/D7, loop volume) — it's all `groupBy` over `AnalyticsEvent` with existing indexes.

### L4 (P1) Pod chat has no read state — the core loop is invisible

The schema has `DirectMessageThread.hasUnread` (DMs) and `ClubChannelReadState` (clubs), but **`Message`/`PodMember` have no read tracking at all**. Consequences:

- The Inbox badge (`useInboxBadgeCount`) counts DM unreads + invites + friend requests. New messages in your *pod* — the product's core object — produce zero visible signal anywhere.
- PodsScreen rows can't show "4 new," PodDetail can't show a chat-unread pill.

Add a `PodReadState` (userId, podId, lastReadAt) mirroring `ClubChannelReadState`, stamp it on chat open, and surface counts in the inbox summary (see L5) and pod rows.

### L5 (P1) Inbox badge polling should be one endpoint

`useInboxBadgeCount` fires 3 API calls (`getMessageThreads`, `getPodInvites`, `getFriendRequests`) every 60s per client, app-wide, forever. Replace with a single `GET /inbox/summary` returning `{dmUnread, invites, requests, podUnread}` — one cheap query set, and the natural home for L4's pod counts. Bonus: subscribe the badge to the existing Supabase realtime pings so it updates on event instead of on a timer.

### L6 (P1) Feed query is nondeterministic and does maintenance work inline

In `GET /pods/feed`:

- `prisma.pod.findMany({ where, include, take })` has **no `orderBy`** — with more than `limit` forming pods, the DB returns an arbitrary subset *before* the JS sort runs. Two users (or the same user twice) can see different pods for no reason. Add `orderBy: { meetupTime: 'asc' }` to the query itself.
- `await expireOldPods()` runs two `updateMany` sweeps on **every feed request** (and pod-detail requests). Fine today; a lock-contention footgun at scale, and it's already run by the cron maintenance job. Make the inline call a cheap early-out (skip if run < 60s ago, in-process timestamp) or drop it and trust cron.

### L7 (P2) Reminder delivery depends on cron cadence matching a hard-coded window

`sendMeetupReminders` targets pods with meetup time 55–65 min out. If the external cron hits `/cron/maintenance` less often than every ~10 minutes, pods fall through the window and get no reminder, silently. Either widen the window with a "reminded" flag on the pod (idempotent), or document the ≥1-per-10-min cadence as a hard ops requirement in `INCIDENT_RESPONSE.md`/deploy docs.

### L8 (P2) Theme flash for light-mode users at launch

`ThemeProvider` defaults preference to `'dark'` and loads the stored value from AsyncStorage async — a user who chose Light gets a dark flash every cold start. Read the stored preference before first paint (gate on the same splash you already hold for fonts) or persist it somewhere synchronous.

### L9 (P2) Verification wall hides all value pre-commitment

`AppGate` hard-blocks everything behind OSU email verification. A curious student who downloads the app sees: form → email gate → (maybe) bounce. Consider a read-only browse mode (feed + club directory, join/message disabled with "Verify to join" CTAs) so the app can sell itself before asking for commitment. The public pod preview endpoint (`/pods/:id/public`) proves the pattern already exists server-side.

---

## Part 2 — Design & UX

### D1 (P1) Blur is overused and doesn't work on Android

Every glass `Slab`/`Card` mounts its own `BlurView` (`ui.tsx` ~line 162). Two problems:

- **Android:** `expo-blur` without `experimentalBlurMethod` doesn't actually blur on Android — it renders a translucent tint. Every "frosted" card becomes a muddy gray rectangle over the gradient. The design language visibly breaks on half your target devices.
- **iOS perf:** Home mounts ~15+ BlurViews per screen (each card, the dock). Real-time blur is one of the most expensive things you can composite; on older iPhones this is dropped frames during scroll + entrance animations.

Recommendation (reflected in the wireframes): reserve blur for *chrome* — the dock, sheets, and modals — and give cards solid theme surfaces (`#FFFFFF` light / `#221D2D` dark). You keep the Lumen mood via the gradient backdrop and soft shadows, and both problems disappear.

### D2 (P1) Contrast failures in both themes

- `faint` (`#A39BAD` on light) is used for inactive tab labels, icons, and `captionSmall` — ~2.6:1 against white surfaces. WCAG AA needs 4.5:1 for text this size. Dark `faint` (`#7C7389`) has the same problem.
- Dark `primary` `#FF566A` with `onPrimary: '#FFFFFF'` is ~3.2:1 — white-on-salmon button labels fail AA. Either darken the fill for filled buttons or use dark ink on the bright accent (wireframes do the latter: `#2A0810` on `#FF6B7A`).
- Dark `primary` has also drifted hue-wise from scarlet toward pink/salmon; worth a deliberate decision on how far off-brand dark mode is allowed to go.
- Translucent surfaces make every contrast ratio content-dependent (what's behind the card changes the effective background). Solid surfaces (D1) also fix this measurement problem.

### D3 (P1) Home screen is overloaded and self-duplicating

Nine stacked blocks: masthead, pulse, permission nudges, agenda, map, "your next move," open pods, activity rail, clubs today. Problems:

- "Your day" (agenda) and "Your next move" show **the same pod twice** within one viewport.
- The map is a 200px non-interactive block (scroll disabled) mid-feed — a dead zone that pushes real content below the fold.
- "Open pods" duplicates Explore, "Activities" duplicates Explore, "Clubs today" duplicates the Clubs tab.

Wireframe direction: one hero (your next plan, or the best suggestion if you have none), a compact 3-stat pulse that includes social signal ("3 friends out"), a short "happening soon" list with **inline Join**, and the map demoted to a tappable strip. Everything else lives in its own tab.

### D4 (P1) The core action is always two taps away

No feed surface (Home, Explore, ActivityPods) offers Join inline — every row goes through PodDetail first. For the single action the entire product funnels toward, add inline Join on feed rows (with the confirm/conflict handling `joinExistingPod` already returns 409s for). PodDetail remains the path for reading chat/details.

### D5 (P2) Empty states still dead-end (GROWTH_PLAN §2 is half-done)

Home's agenda and map empty states have CTAs, but "No pod lined up yet" and "The feed is quiet" have none, and several others (`PodsScreen` "No past pods yet," Inbox states) are informational only. Every empty state should land a one-tap action into pod creation or Explore, prefilled where possible ("Be the first to start a frisbee pod").

### D6 (P2) Social proof is absent from every decision surface

Pod rows and PodDetail show member *counts*, never *who* — even though the API returns members with names/avatars and the friend graph exists. "2 friends going" (avatars + green text, see wireframes) on feed rows and "Sam is a friend" on PodDetail is the cheapest conversion lever available: the data is already in the payloads.

### D7 (P2) Misc polish

- Inactive tab icons + labels use `faint` (see D2) — bump to `sub`.
- Capacity as a bare "5/8" is weaker than a meter + "3 spots left" urgency framing (wireframed).
- The gradient backdrop's 3 stops with fixed diagonal reads slightly banded on some OLED darks; a 2-stop subtler wash (wireframe tokens) is safer.
- 20 `accessibilityLabel`s in ui.tsx is a good base; screens are inconsistent about labeling icon-only Pressables (audit pass worth 2 hours).

### Proposed Lumen 2.0 tokens (as used in the wireframes)

| Token | Light | Dark |
|---|---|---|
| bg wash | `#FBF2EC → #EEF1F9` | `#1B1524 → #121520` |
| surface (solid) | `#FFFFFF` | `#221D2D` |
| ink / sub | `#211C28` / `#5D5666` | `#F3EEF9` / `#B3ABC1` |
| accent | `#BA0C2F` (true OSU scarlet) | `#FF6B7A`, dark-ink text on fills |
| border | `#E6E0E9` | `#383146` |

Blur: dock/sheets only. Shadows: keep `elevation.card`, they read fine on solid surfaces.

---

## Part 3 — Engagement & the cold start

The GROWTH_PLAN thesis still holds and is still unexecuted: this is a measurement problem plus a cold-start problem, and the infrastructure (deep links, public previews, invites, analytics events) is largely built. Gaps, in order of leverage:

### E1 First session: nothing guarantees a non-empty board

- `seed.ts` creates activities but no rolling near-future pods — a fresh environment (or a slow launch week) opens to empty states.
- There's no post-verify onboarding step. Signup already collects interests (step 3); the missing move is the screen after verification: "This week, near you" — 2–3 joinable pods matched to those interests, one prominent Join (wireframed as `onboarding-*.svg`). Combined with L2 (interest-ranked feed), a new user's first 60 seconds go from "generic list, maybe empty" to "here's your Tuesday."
- Instrument it: `onboarding.started` → `onboarding.first_pod_joined`, measurable via L3's summary endpoint.
- Ops side: treat 3–5 pre-onboarded clubs with real officers (the `docs/onboard-a-club.md` flow) and a week of ambassador-seeded pods as launch blockers, not niceties.

### E2 The retention loop's strongest channel is dark (= L1)

Every re-engagement mechanic you've built — meetup reminders, waitlist openings, recap prompts, message notifications — currently dies at a stale token or lands users on the wrong screen. Fixing L1 is the single highest-ROI engagement item in this document. Nothing else in Part 3 matters much while push is broken.

### E3 The core loop generates no pull (= L4)

Social apps re-engage through "something happened that involves you." With no pod read state, pod chat activity — the liveliest thing in the product — never badges, never bolds, never counts. Ship `PodReadState` + `/inbox/summary` and let pod threads appear in the Inbox as first-class items (wireframed with a violet POD tag).

### E4 The invite loop is unmeasured and under-exposed

Share exists only inside PodDetail's header and fires no analytics event. For a campus app, user→user invites are the entire growth model. Add `invite.shared` (surface, podId) instrumentation, put an Invite affordance next to Join on PodDetail (wireframed), and add a share prompt at the two natural peaks: right after creating a pod ("now fill it") and right after a pod completes ("plan the next one, bring someone"). Attribution: append `?ref=<userId>` to share links and log redemption server-side — the web preview route already exists.

### E5 Post-event chaining is a one-way door

The recap system (rating, people-you-met, no-show) captures signal but doesn't *spend* it: after a recap, the user hits a dead end. Chain it — "You rated Frisbee 3/3. Same crew is going Thursday" (create/join next occurrence, invite the people you met). Repeat attendance is the retention metric that matters for IRL products, and the data to drive it is already collected.

### E6 No ambient reasons to open the app between plans

Everything in Oval is transactional (make/attend a plan). Between plans there's nothing to check. Cheap, non-gimmicky options consistent with the brand: the "friends out tonight" pulse stat (wireframed), a Sunday "your week" push (X pods, Y new people — links to People You Met), and club announcements surfacing on Home for members. Avoid streaks/XP — wrong tone for a get-off-your-phone product.

### E7 You can't see any of this (= L3)

Ship the summary endpoint before the next growth experiment, or you won't know if it worked.

---

## Part 4 — Prioritized roadmap

| # | Item | Refs | Effort | Impact |
|---|---|---|---|---|
| 1 | Fix push client: launch-time token refresh, foreground handler, tap→deep-link routing | L1/E2 | S–M | Highest |
| 2 | `GET /analytics/summary` (activation, D1/D7, DAU/WAU, loop volume) | L3/E7 | S | Highest |
| 3 | Interest-ranked feed for low-history users + `orderBy` fix | L2/L6 | S | High |
| 4 | Post-verify onboarding: interests recap → matched pods → first join | E1 | M | High |
| 5 | `PodReadState` + `GET /inbox/summary` + badge realtime | L4/L5/E3 | M | High |
| 6 | Solid card surfaces; blur only on chrome; fix Android glass | D1 | S | High |
| 7 | Contrast pass: faint text, dark-accent button text | D2 | S | Med-high |
| 8 | Home consolidation + inline Join + friends-going proof | D3/D4/D6 | M | Med-high |
| 9 | Invite loop: instrumentation, ref attribution, post-create/post-recap prompts | E4 | M | Med-high |
| 10 | Recap→next-plan chaining | E5 | M | Medium |
| 11 | Empty-state CTA pass; seed near-future pods; club onboarding ops | D5/E1 | S | Medium |
| 12 | Reminder window idempotency; theme-flash fix; browse-before-verify | L7/L8/L9 | S–M | Medium |

Sequencing logic: items 1–2 are prerequisites for knowing whether 3–5 work. Items 6–8 can ship independently as the "Lumen 2.0" visual pass (wireframes in `docs/wireframes-2026/`: onboarding, home, pod-detail, inbox × light/dark; regenerate via `node gen-wireframes.mjs .`).
