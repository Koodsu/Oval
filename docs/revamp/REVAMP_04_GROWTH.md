# Oval Revamp — 04: Growth, Onboarding & Engagement Loops (v2)

v2 supersedes the earlier draft. What carried over: FirstPlan onboarding, recap chaining, peak-moment shares, empty-state CTAs, browse-before-verify, the no-guilt-mechanics rule. What's new: the liquidity thesis, pod templates, anchor windows, demand pooling ("I'm down"), twin pods, group-chat-first sharing, People-You-Met reconnection, attendance-based metrics, and density-first launch ops.

Prereqs: docs 01–03 (03 §4 analytics and §5 interest ranking are hard dependencies for §2). Every feature ships WITH its instrumentation.

---

## 0. Thesis and north star

A social-plans app doesn't die from bad retention mechanics; it dies from **thin liquidity** — 60 users spread across 30 activities and 7 days means every screen looks dead to everyone. Most of this doc is really one strategy: **concentrate demand and supply into the same few places and times, and convert every overflow or dead end back into supply.**

North-star metric: **weekly attended plans per weekly active user** — *attended*, not joined. The attendance-confirmation flow already exists (`backend/src/routes/attendance.ts`, pod confirm windows), so measure the real thing. Activation = **first attended plan within 7 days of verifying**. Joins are a leading indicator, not the goal.

## 1. Activation: the first attended plan

**1a. FirstPlanScreen** (unchanged in essence from v1): after verification (and terms), route once to a stack screen — "This week, near you": interests recap chips (editable), 2–3 pods from the interest-boosted feed (03 §5), top card tagged "BEST MATCH" with the only primary-filled Join, quiet "Skip for now". Joins use the shared `useJoinPod` hook (02 §1). Persist `oval.firstrun.done` in AsyncStorage; `AppGate` routes accordingly. If the feed is empty, skip the screen silently — never render an empty first-run.
Events: `onboarding.started`, `onboarding.pods_shown {count}`, `onboarding.first_pod_joined {podId}`, `onboarding.skipped`.

**1b. Close the join→attend gap.** Joining is a promise; the product's job is making it kept. For a user's *first-ever* pod, add one extra push the morning of ("Tonight: Frisbee at 7:30 — Maya and 5 others will be there", `NotificationService`, reuse the reminder plumbing from 03 §8 with a `firstPodNudgeSentAt` guard on the membership row or an AnalyticsEvent-existence check). First-timers who attend once are the cohort everything else compounds on.

## 2. The supply engine (the real cold-start work)

**2a. Pod templates — kill the blank form.** Most students will never fill out a creation form, so supply defaults to zero. Add `POD_TEMPLATES` (new `frontend/src/constants/podTemplates.ts`): ~10 curated one-tap templates per popular activity — "Boba run · tonight 8pm · High St", "Study grind · Thompson · 7–10pm", "Pickup hoops · RPAC · Sat 2pm". The create sheet (01 §5) and every "Start one" empty-state CTA open a **template picker first** (blank form demoted to a "Custom" row). A template prefills activity, title, location (from `backend/src/config/locations.ts` ids), time (§2b), and maxMembers. Creation becomes 2 taps + confirm. Event: `pod.created {template: id|custom}` — track the template share of supply.

**2b. Anchor windows — concentrate time.** Default every template and the custom form's time picker to the next **anchor window**: Sun–Thu 7–10pm, Fri/Sat 6pm–12am, weekend afternoons. Copy throughout the app frames plans by the nearest window ("Tonight", "Tomorrow night"), and Home's hero/pulse always speak in "tonight" units. Users can pick any time — anchors are defaults, not rules. Rationale: 20 pods scattered across a week reads dead; 12 pods tonight reads alive.

**2c. Demand pooling — "I'm down" (the lurker's first rung).** Nobody wants to be first, and most new users won't create. Give demand a zero-commitment signal:
- On `ActivityPods` screens with no open pods and on Discover activity cards: an **"I'm down this week"** chip instead of dead space.
- Backend: `PodDemand` model `{ id, userId, activityId, createdAt, expiresAt (+7d), @@unique([userId, activityId]) }` + POST/DELETE routes. Show "5 people are down for boba this week" on the activity — social proof *before* supply exists.
- **Conversion job** (add to `maintenanceJobs.ts`): when an activity crosses a threshold (≥4 active signals), push everyone who's down: "6 people want a boba run this week — start it?" deep-linking to the template prefilled. When any pod is later created for that activity, notify the pool ("A boba run just went up for tonight") and clear consumed signals on join.
- Events: `demand.signaled {activityId}`, `demand.converted {activityId, podId}`. This converts empty screens into a demand ledger and gives you a list of exactly what supply to seed.

**2d. Twin pods — overflow becomes supply.** A full pod is peak demand hitting a capacity wall. On the full-pod 409 (and on the waitlist screen): alongside "Join waitlist," offer **"Start a twin"** — one tap clones activity/location/time (+30min if identical), notifies the waitlist that a second pod opened. Frontend-only apart from a `waitlist notify` reuse; the clone is a normal create. Event: `pod.twinned {fromPodId}`.

**2e. Club → pod bridge.** Clubs are pre-aggregated audiences with real meeting times. After a club meeting ends (attendance data exists), prompt attendees in the club channel/push: "Meeting's done — anyone hanging out after?" → template picker prefilled with location near the meeting. Officers get a "spin up a hang" row on MeetingDetail. Clubs solve distribution; pods capture the relationships.

**2f. Seeding & the liquidity guardrail (ops + one endpoint).** Keep 03 §7 seeding and the launch-blocker checklist (3–5 real clubs onboarded, ambassador accounts hosting ≥1 pod/day for two weeks, invite waves sized to live supply). Add a **liquidity ratio** to `/analytics/summary`: viewers-with-≥3-joinable-pods ÷ daily viewers, plus `demand.signaled` counts by activity. When liquidity dips or a demand pool crosses threshold un-converted, that's the ambassadors' nightly to-do list. Cold start managed by dashboard, not vibes.

**2g. Density-first rollout (pure ops).** Launch to one dense social cluster at a time (a dorm, a college, 2–3 big clubs) and get *it* to liquidity before widening. 200 users in one dorm beats 2,000 across campus. Invite waves follow the guardrail in 2f.

## 3. Retention: the loop that compounds

**3a. Recap → next plan** (kept from v1, now template-powered): after a rating-3 recap — "Run it back?" → creates from the same pod as a template (same activity/location/weekday next week) and auto-opens invite-friends preselecting the attendees. Rating ≤2 skips the pitch, People You Met only. Plans-history rows without recaps show "Rate it" chips (02 §2). Event: `recap.chained_create {fromPodId}`.

**3b. People You Met is the moat — work it.** The friend graph here is made of *actual meetings*, which no other app on campus has. Two additions:
- **Reconnect prompts:** in the weekly recap (3c) and on UserProfile, surface "You and Sam have been to 3 pods together — down for Thursday?" → invite flow. Data = shared `PodMember` history; cheap query, add to the friends API.
- **Met-count as the profile stat that matters:** "9 people met this semester" on own Profile (02 §8) — the number that tells a lonely freshman the app is working.

**3c. The Sunday ritual (one push, not thirty).** Replace ambient-engagement ambitions with a single weekly anchor: Sunday 6pm push — "Your week: 2 pods, 3 new people. 12 pods are forming for this week →" deep-linking to Plans/Discover. New `weeklyRecap` preference (default on), sent from `maintenanceJobs`, **only to users with ≥1 event that week OR ≥1 joinable matching pod to show** — never an empty-week guilt push. Combined with anchor windows, this creates the weekly planning habit without streaks.

**3d. Push hygiene budget.** Hard rule now that 03 §1 makes push work: max 1 non-transactional push per day per user (transactional = reminders, waitlist, your-pod activity; non-transactional = demand conversions, weekly recap, reconnects). Enforce with a simple per-user daily counter in `NotificationService`. The fastest way to lose a re-engagement channel is to spend it.

**3e. Explicitly rejected, still:** streaks, XP, leaderboards, login rewards, public reliability scores. Oval's promise is fewer-better sessions that end in leaving your room.

## 4. Virality: built for group chats

**4a. Group-chat-first sharing.** Campus social distribution is GroupMe/iMessage group chats, not feeds. The share payload for a pod should be built for that context: rich link preview (the public pod web route in `backend/src/routes/web.ts` already renders — verify OG tags show activity, time, spots left, avatars) + share copy like "Boba run tonight 8pm — 3 spots. I'm in." One person dropping a pod into a 40-person group chat is the whole growth model; optimize that artifact.

**4b. Peak-moment prompts** (kept from v1): post-create Sheet ("Pod's up. Now fill it." — Share link / Invite friends / Skip, once per pod) and post-recap ("Bring someone new" inside 3a's flow). Max one share prompt per session, nowhere else.

**4c. Attribution** (03 §6): `invite.shared {surface}` at every share point, `?ref=` on links, `invite.link_opened` server-side, ref attached to `auth.register`. Invite K-factor readable in `/analytics/summary`.

**4d. Browse-before-verify** (kept, still last): read-only Home/Discover for unverified users, joins gated by a "Verify your OSU email" banner. Ship after everything else; keep private-location pods excluded from any pre-verify surface. Events: `preverify.browse`, `preverify.join_blocked`.

## 5. Empty states = doors (compressed; rules from v1 apply)

Every `EmptyState` action completes in ≤2 taps and is specific. The high-traffic ones now route through the new supply surfaces: Home hero empty → template picker; ActivityPods empty → "I'm down this week" chip + "Be the first" → template prefilled; Plans empty → "Find a pod" / template picker; Inbox messages empty → People You Met; Discover club-search miss → "Request a club" → CreateClub. Full table from v1 remains valid where not superseded.

## 6. Measurement (attendance-based)

| Metric | Definition | Owner feature |
|---|---|---|
| North star | weekly attended plans / WAU | everything |
| Activation | % verified → first *attended* plan ≤7d | §1 |
| Join→attend | % of joins that confirm/attend | §1b, reminders |
| Liquidity | % of daily viewers seeing ≥3 joinable pods | §2 |
| Template share | % of pods from templates | §2a |
| Demand conversion | demand.signaled → converted ≤7d | §2c |
| Repeat attendance | 2nd attended plan ≤14d of 1st | §3a/3b |
| Invite K | shares → opens → ref registrations | §4 |

All readable from `/analytics/summary` (extend 03 §4 with the liquidity + demand blocks). Report the funnel in each feature's PR using seeded data.

## 7. Sequencing inside this doc

1. §1a FirstPlan + §2a templates (activation + supply friction, biggest paired win)
2. §2b anchor windows + §3c Sunday ritual (the weekly rhythm)
3. §3a recap chaining + §3b reconnects (retention loop)
4. §2c demand pooling + §2d twins (liquidity machinery)
5. §4a/4b/4c sharing + attribution
6. §2e club bridge, §4d browse-before-verify

## Acceptance for doc 04 v2

New user in a seeded env: verify → FirstPlan with ≥2 relevant pods → attends via ≤3 taps + a morning-of nudge. Creating from a template takes ≤3 taps. An activity with zero pods shows a demand chip, and 4 signals trigger the conversion push. A full pod offers waitlist AND twin. Rating-3 recap offers a prefilled next pod. Sunday push sends only when there's something real to say, and no user receives >1 non-transactional push/day. Liquidity, demand conversion, and invite K are visible in `/analytics/summary`.
