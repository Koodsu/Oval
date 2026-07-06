# Oval Revamp — 03: Backend & Logic

Prereq: `REVAMP_00_OVERVIEW.md`. Independent of docs 01/02 except where noted. Every section: backend tests in the existing `*.test.ts` style; `npx prisma migrate dev` for schema changes; `npm run migrations:check` green.

---

## 1. Push pipeline (client + server) — highest priority in the entire revamp

**Client (frontend):**
1. `frontend/src/hooks/useNotificationPermission.ts`: extract `registerTokenIfGranted()` — if `getPermissionsAsync()` is granted, `getExpoPushTokenAsync()` + `registerPushToken()` (idempotent). Call it on every authed app start (from `AuthContext` once `token && user.verifiedUniversity`), not only from the Home nudge tap. This fixes stale/rotated/reinstalled tokens.
2. In `frontend/App.tsx` (or a new `src/lib/notifications.ts` imported there): `Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }) })` so foreground pushes render.
3. Tap routing: `Notifications.addNotificationResponseReceivedListener` reading `response.notification.request.content.data.url` and passing it to `Linking.openURL` (the `oval://` linking config in App.tsx already routes `pod/:podId`, `clubs/:clubId`, etc.). Also handle the cold-start case via `Notifications.getLastNotificationResponseAsync()` after navigation is ready.

**Server (`backend/src/lib/NotificationService.ts`):**
4. Every push message gets `data: { url }` — pod events → `oval://pod/{id}`, DMs → the thread deep link (add `Thread` to the linking config in App.tsx if missing: `thread/:threadId`), club events → `oval://clubs/{id}`.
5. Receipt handling: after `sendPushNotificationsAsync`, collect tickets; check receipts (`getPushNotificationReceiptsAsync`) on the next maintenance run; on `DeviceNotRegistered`, null out that user's stored push token. Add `sentPushTickets` persistence only if needed — a simple JSON column or in-run check is acceptable; document the choice.

**Test:** unit-test preference parsing + url attachment; manual E2E on a dev build (documented steps in the PR).

## 2. Pod read state (unlocks unread everywhere)

Schema (mirror `ClubChannelReadState`, schema.prisma ~line 512):

```prisma
model PodReadState {
  id         String   @id @default(cuid())
  userId     String
  podId      String
  lastReadAt DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  pod        Pod      @relation(fields: [podId], references: [id], onDelete: Cascade)
  @@unique([userId, podId])
  @@index([userId])
}
```

- Stamp (upsert `lastReadAt: now`) in `GET /pods/:podId/messages` (backend/src/routes/messages.ts) for the requesting member, and on message POST.
- Unread count for a user+pod = messages with `createdAt > lastReadAt` and `senderId != userId` (cap the count query at 100 with `take`). No row yet = fall back to the member's `joinedAt` (`PodMember`).
- Expose per-pod counts on `GET /pods/mine` responses (additive field `unreadCount`) and in §3's summary.

## 3. `GET /inbox/summary` (one call replaces three, on a 60s timer, per client)

New route in `backend/src/routes/directMessages.ts` or a new `inbox.ts`: returns `{ dmUnread, podUnread, invites, friendRequests, total }` for the authed user — DM unread from the existing `hasUnread` logic, pod unread from §2 (count of pods with ≥1 unread, not message totals), invites = pending `PodInvite`, requests = incoming pending `FriendRequest`. One handler, ~4 counts, respects blocks.

Frontend: `useInboxBadgeCount` in `App.tsx` switches to this single call; also subscribe via `useRealtimeChannel` to the user's realtime topic so the badge refreshes on ping instead of only on the 60s timer. Inbox screen consumes the same endpoint for its segment counts (02 §6).

## 4. `GET /analytics/summary` (admin-gated; the growth dashboard)

In `backend/src/routes/analytics.ts` (currently write-only). Auth: reuse the admin middleware pattern (`backend/src/middleware/admin.ts`). Query param `?days=N` (default 14, max 90). Return:
- `activation`: of users with `verify.completed` in-window, % with `pod.joined`|`pod.created` within 24h and 72h of it.
- `dau`: per-day distinct `userId` on `app.opened`; `wau` rolling 7.
- `retention`: for each registration-day cohort, D1 and D7 = % with `app.opened` on day+1 / day+7.
- `loop`: per-day counts of `pod.created`, `pod.joined`, `pod.message_sent`, `friend.accepted`, `invite.shared`.
All computable with `groupBy`/`count` on `AnalyticsEvent` (indexes on `[name, createdAt]`, `[userId, createdAt]` exist). Tests with seeded events asserting the math (edge: user verifies day 1 joins day 4 → counts for neither window).

## 5. Feed: determinism + interest ranking + inline-maintenance throttle

In `backend/src/routes/pods.ts` `GET /feed`:
1. Add `orderBy: [{ meetupTime: 'asc' }, { id: 'asc' }]` to the `findMany` — today `take` without `orderBy` returns an arbitrary subset when forming pods exceed the limit.
2. **Interest boost:** load the user's `interestTags` (JSON on User). Map tags → activity categories (add `TAG_TO_CATEGORY` in `backend/src/config/interestTags.ts`; cover every tag in the existing list — unmapped tags are a test failure). In the existing JS sort, when the user has fewer than 3 past pod memberships, sort key = (interest-match desc, meetupTime asc, memberCount desc); with ≥3 memberships keep the current recap/membership scoring but add interest match as the final tiebreaker. This makes signup step 3 actually drive the first feed.
3. Throttle `expireOldPods()`: module-level `lastRunAt`; skip if < 60s ago (cron also runs it — `backend/src/lib/maintenanceJobs.ts`). Same throttle where it's called in pod-detail.

## 6. Invite attribution (measure the growth loop)

1. Frontend fires `trackEvent('invite.shared', { surface, podId? })` at every share: PodDetail share (02 §4), post-create prompt + post-recap prompt (04 §5), create-sheet row (01 §5).
2. Share links append `?ref=<inviterUserId>` to the existing public pod URL. `backend/src/routes/web.ts` pod-preview route logs an `invite.link_opened` AnalyticsEvent `{ podId, ref }` (no auth required — `optionalAuth`).
3. On register, the client passes along a `ref` it captured from an initial deep link (store in AsyncStorage at first open; attach as `referredBy` property on the `auth.register` event). No schema change — attribution lives in AnalyticsEvent and is read via §4's `loop` counts plus an added `invites` block: shares, opens, registrations-with-ref in-window.

## 7. Seed near-future content (`backend/prisma/seed.ts` or new `seed-launch.ts`)

`seed.ts` currently creates zero pods. Add a re-runnable launch seeder: for the 6 most popular activities, create pods with `meetupTime` at staggered offsets over the next 5 days (evenings + weekend daytimes), realistic locations from `backend/src/config/locations.ts`, maxMembers 6–10, hosted by designated seed/ambassador accounts (flagged via an env-var list of emails, never fake personas pretending to be students). Idempotent: tag seeded pods (e.g., description marker or creator account) and skip when a future seeded pod already exists for that activity. Wire as `npm run seed:launch`.

## 8. Meetup-reminder idempotency

`sendMeetupReminders` (NotificationService) targets a hard 55–65min window — pods silently miss reminders if cron cadence exceeds ~10 min. Add `reminderSentAt DateTime?` to `Pod`; widen the query to "meetupTime between now+30min and now+70min AND reminderSentAt IS NULL"; set it after send. Delete the WINDOW constants. Test: two consecutive runs send once.

## 9. Optional stretch (do last, skip if time-boxed out)

- DM typing parity: reuse `backend/src/lib/typingStore.ts` pattern for DM threads + surface in ThreadScreen (pods/clubs already have it).
- Club RSVP "maybe": check `ClubMeetingAttendee` for a status field before promising the mockup's Going/Maybe/Can't-go — if absent, add enum status (migration) + additive API field; otherwise skip.

## 10. Friends-out-tonight count (for Home pulse, 02 §1)

Small addition to §3's summary or a standalone `GET /friends/tonight`: count of the user's friends (Friendship table, respecting blocks) who are members of a pod with `meetupTime` today. Return count + up to 3 avatar URLs. Cheap join; add an index if the query plan needs it.

## Acceptance for doc 03

Backend suite green including new tests for: read-state stamping and unread math, inbox summary totals, analytics summary math, feed ordering determinism + interest boost, reminder idempotency, invite event logging. A push tapped on a dev build opens the referenced pod. `npm run release:check` passes.
