# Oval Revamp — 02: Screen Specs

Prereqs: `REVAMP_00_OVERVIEW.md` decisions; doc 01 merged (tokens, components, nav). Sections marked **[needs 03 §N]** depend on backend work — build the UI with the data wired but gate the element behind field-presence so it degrades gracefully until 03 ships.

General rules for every screen: wrap in `AppBackdrop`; respect `DOCK_CLEARANCE`; light+dark verified; every list that can be empty uses `EmptyState` with a working action; every icon-only pressable labeled; use `StatusTag`, `AvatarStack`, `CountBubble` from ui.tsx instead of bespoke equivalents (delete bespoke ones as found).

---

## 1. Home (`frontend/src/screens/HomeScreen.tsx`)

Today's screen stacks 9 blocks with duplicated content (agenda + "your next move" show the same pod; open pods/activities/clubs duplicate other tabs). Rebuild top-to-bottom as:

1. **Masthead** — dateline kicker (`accentText`), "Evening, Brady." display, avatar → `Profile`. Keep `greetingForNow()`.
2. **Hero: one next action.** If the user has an upcoming pod/meeting (soonest of `getMyPods()` FORMING/LOCKED and `getClubsToday()` where member): a full-width `primary`-filled card — kicker "YOUR NEXT MOVE · 7:30 PM", title, "4/8 going · starts in 2h", `AvatarStack` of members, white "Open" pill → detail screen. If none: the **best suggestion** from the feed (top-ranked joinable pod) with the same layout but "Join" as the pill action (inline join, §"inline join" below). Only if the feed is also empty: EmptyState → "Start a pod" (create sheet).
3. **Pulse strip** — one card, three stats: open pods now (→ Discover), meetings today (→ `ClubMeetingsTonight`), **friends out tonight [needs 03 §10]** (count of friends in pods today → Plans; hide the third column until the endpoint exists).
4. **Today** — merged agenda (remaining pods + club meetings, max 4 rows, time-block style). Delete the separate "Your next move" section — the hero replaced it.
5. **Happening soon** — up to 3 feed pods NOT already shown in the hero: time block, title, **social-proof line** ("2 friends going" with mini avatars in `success` when `pod.members` intersects the friend list — friends come from `getFriends()`; otherwise "3 spots left" in `sub`), and an **inline Join button**.
6. **Map strip** — compact 96px tappable preview (static, pins only, "3 pods live on map" pill) → expands a full-screen map modal with the existing `CampusMap`. Delete today's 200px inline map.
7. Keep permission-nudge chips row (location/notifications) between 1 and 2.

Delete sections: activity rail, clubs-today list, open-pods list (Discover owns these).

**Inline Join (shared behavior, used by Home §2/§5, Discover, ActivityPods):** extract a `useJoinPod(podId)` hook wrapping the existing join API call. On 409 show the server's message via `Alert` ("pod full" → offer waitlist if `podWaitlist` route applies; "already in an active pod for this activity" → offer to open that pod). On success: haptic, optimistic member-count bump, navigate to `PodDetail`, fire `pod.joined` (already in api.ts).

## 2. Plans tab (`frontend/src/screens/PodsScreen.tsx`)

Match mockup board 1. Header "Plans" + a right-side `+` (create sheet). Sections:
- **Active** — card rows: emoji/icon well (activity), title, "location · time", `AvatarStack` + member count, `StatusTag`. Row → `PodDetail`. **[needs 03 §2]** unread chat count as `CountBubble` on the row.
- **Invites** — pod invites inline (currently only in Inbox): inviter avatar, pod title, "3 mutual friends" when computable from friends list, accept (✓ primary circle) / decline (✕ surface circle) directly in the row. Accepting joins + navigates. Keep them mirrored in Inbox too — same API (`getPodInvites`).
- **History** — last 3 completed/expired with `StatusTag`, "View all" expands. If a completed pod lacks the user's recap, show a "Rate it" chip on the row (→ recap flow; feeds 04 §4).
- Empty Active state: "Nothing planned yet" → actions "Find a pod" (Discover) and "Start one" (create sheet).

## 3. Discover (new `frontend/src/screens/DiscoverScreen.tsx`)

Hosts a `Segmented` control: **Activities | Clubs**, preserving each segment's scroll position. Param `{ segment?: 'activities' | 'clubs' }`.
- **Activities segment** = current `ExploreScreen` content, restyled: search, category chips, activity grid → `ActivityPods`; below the grid, a "Happening now" pod list with inline Join. Keep existing filter logic.
- **Clubs segment** = current `ClubsHomeScreen` content: search, category chips, featured carousel, all-clubs list with join/open affordance (keep the fixed 44px-target join button), verified badge where `club.verified`.
- Retire the standalone tab registrations; `ExploreScreen`/`ClubsHomeScreen` can become the segment bodies rather than being rewritten.

## 4. Pod Detail (`frontend/src/screens/PodDetailScreen.tsx`)

Match mockup board 2, top-to-bottom: back + overflow (⋯ → existing Sheet actions); icon well + title + `StatusTag` + one-line vibe/description; **meta grid** (2×2: date/time, location+room, activity, "Hosted by {creator}" with avatar); map card (existing map, 150px); capacity block — "X of Y in · Z spots left" with a thin progress meter (`success` fill; `warning` when ≤2 left); description; **Members** row (`AvatarStack` + count, chevron → member list; append "· {name} is a friend" in `success` for the first friend match); **Waitlist** row when present; then actions:
- Non-member: full-width **Join Pod** (primary). Below: **Share Pod** and **Invite Friends** side-by-side (secondary). Share = native share of the public pod link, fires `invite.shared` `{surface:'pod_detail'}` [03 §6]. Invite Friends = existing pod-invite flow (friend picker).
- Member: primary slot shows context: chat entry ("Open chat · 4 new" **[needs 03 §2]**), and pre-meetup **Confirm attendance** when inside the confirmation window (existing attendance API). "Leave Pod" as quiet destructive text at the bottom (existing behavior).
- Creator: keep lock/reopen in the ⋯ sheet.

## 5. Pod Chat (`frontend/src/screens/PodChatScreen.tsx`)

Already inverted-FlatList + KAV. Changes: message grouping (same sender within 5 min: hide avatar/name, 2px gap); day separators; reply-context rendering ("You replied to Priya" mini-quote above bubble — data exists via `replyToId`); reactions as pills under bubbles (exists — restyle to mockup: white pill, emoji + count); typing indicator row (exists). **Contextual action cards** above the composer, dismissible, one at a time:
- T-2h before meetup, if not confirmed: "See you soon — let us know you're coming" + **Confirm Attendance** (primary) — existing attendance endpoint.
- After completion, if no recap: "How was it?" + **Post Recap** (secondary) → recap flow.
Composer: `+` (reserved, no-op menu for now), input pill, send. On send, stamp read state [03 §2].

## 6. Inbox (`frontend/src/screens/InboxScreen.tsx`)

Match mockup board 4: header + search (→ `UserSearch`); **segmented chips with counts** — "DMs · 3", "Pod invites · 2", "Requests · 1" (counts from `/inbox/summary` [03 §3]; until then compute from the three existing calls). Sections in one scroll (chips scroll-anchor rather than filter):
- **Messages:** avatar (unread dot top-left, `primary` with surface ring), name bold-when-unread, preview (`ink`+600 when unread, else `sub`), right column: relative time (accent when unread) + `CountBubble` with per-thread unread count if available, else dot. **[needs 03 §2]** Pod chats appear here as threads with a small `violetSoft` "POD" tag.
- **Pod invites:** avatar, "{name} invited you to join a pod", pod title, time; row → `PodDetail`; accept/decline inline.
- **Friend requests:** name + "{class year} · {major}" line when the API provides it, **Accept** (primary small) + **Hide** (secondary small) inline.
- Empty states: Messages → "Say hey to someone you met" → People You Met flow; Invites/Requests → "Find your people" → `UserSearch`.

## 7. DM Thread (`frontend/src/screens/ThreadScreen.tsx`)

Already solid (inverted, reactions, replies). Restyle to Crimson bubbles: own = `primary` fill + white text; other = `surface` + border. Add message grouping + day separators (share the utility with §5 — put it in `src/utils/chat.ts`). Header: avatar + name + `info` → existing thread-info sheet (mute/report/block live there already). No presence dot (D-5).

## 8. Profile (`frontend/src/screens/ProfileScreen.tsx` + `UserProfileScreen.tsx`)

Own profile: avatar, name, "OSU '26 · {major}", bio, **Interests** chips, **Clubs** chips, **Meetup stats** — cards for "Plans joined" and "Plans hosted". Reliability/on-time stats: **only on own profile, framed positively** ("You showed up to 21 of 23") — never on `UserProfileScreen` (D-5). Edit Profile, Settings entries unchanged. Other-user profile: mutuals row ("4 mutual friends" + stack), shared pods history, Add Friend / Message actions, ⋯ → report/block (existing).

## 9. Auth & Verify (`AuthScreen.tsx`, `VerifyEmailScreen.tsx`)

Restyle only (tokens/typography/buttons); keep the 3-step register flow and copy structure. Step 3 (interests) gains: "This picks your first pods" caption — it becomes true in 04 §1. Verify screen: add "Didn't get it? Check spam or resend" ghost row (resend exists).

## Acceptance for doc 02

Each section: light+dark screenshots attached to the PR; tsc + tests green; no `EmptyState` without a working action; inline Join works with 409 paths (full → waitlist offer; duplicate-activity → open-existing offer); Home renders ≤6 sections; the same pod never appears twice on Home.
