# Oval — Remaining Work Plan

Hand this to a session and say "implement section N." Everything is grounded in the
current codebase. Validate after each section with `npx tsc --noEmit` (both apps) and
`npm test`.

---

## 0. Ship what's already built (ops, no new code)

These changes from the last session are code-complete and typecheck clean, but still
need to be rolled out:

- **Deploy the backend** (in-app club create/verify/applications, password-checked
  delete, application endpoints all live only on the new backend). Build runs
  `prisma generate`; run `npx prisma migrate deploy` too (no new migrations pending —
  the club lifecycle migration is already applied — it'll just confirm).
- **Rebuild the app bundle** (`npx expo start -c` for dev, or a fresh EAS build) so the
  new screens/fixes appear.
- **Set `EXPO_PUBLIC_SENTRY_DSN`** in env/EAS secrets before submitting.
- **Run both test suites** (`cd backend && npm test`, `cd frontend && npm test`) — the
  session added application tests + reaction/emoji changes since the last green run.
- **Delete the duplicate "Boba Run"** activity row in Supabase (keep the one with pods,
  delete the other). Recurrence is already fixed in `seed-screenshots.ts`.
- *(Optional)* Mirror the inbox reaction fix into `PodChatScreen.tsx` — it has the same
  heart-only display pattern (`heartCount` / `HEART_EMOJI` around line 360). Copy the
  `otherReactions` computation + pills + styles from `ThreadScreen.tsx`.

---

## 1. Hex / RGB color picker for roles  (no migration)

Roles already store color as a free `String` (`ClubRole.color`), so no schema change.

**Backend** (`backend/src/routes/clubs.ts`)
- Find the role color validation (the `ROLE_COLORS` Set check in the create-role and
  patch-role handlers). Relax it to accept a named color **or** a valid hex:
  `const HEX_RE = /^#[0-9a-fA-F]{6}$/;` → allow if `ROLE_COLORS.has(color) || HEX_RE.test(color)`.

**Frontend** (`frontend/src/components/clubs/index.tsx` — `roleAccent`)
- At the top of `roleAccent(colors, color)`: if `color?.startsWith('#')`, return
  `{ tint: color, ink: readableInk(color) }` directly (skip the named lookup).
- Add a `readableInk(hex)` helper: parse R/G/B, compute luminance
  `(0.299*r + 0.587*g + 0.114*b)`, return dark ink for light colors and light ink for
  dark ones.

**Frontend** (`frontend/src/screens/clubs/ClubManageScreen.tsx` — the COLOR section ~line 560)
- Below the named-color chips, add a hex `Field` (placeholder `#1E90FF`), validate with
  the same regex, and on valid input call `setRoleColor(hex)`. Show a live swatch
  (`View` with `backgroundColor: roleColor`). The named chips and hex field both write to
  the same `roleColor` state.

Files: `clubs.ts`, `components/clubs/index.tsx`, `ClubManageScreen.tsx`. Validate with tsc.

---

## 2. Channel access by specific members (and roles)  (NEEDS MIGRATION)

Today channels gate by role only via `ClubChannel.allowedRoleIds` (JSON string array).
Add per-member access.

**Schema** (`backend/prisma/schema.prisma`)
- Add to `model ClubChannel`: `allowedUserIds String?  // JSON array of user ids`.
- Generate the migration offline (the sandbox can't reach the DB):
  1. `cp prisma/schema.prisma /tmp/schema_old.prisma`
  2. edit schema
  3. `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate diff
     --from-schema-datamodel /tmp/schema_old.prisma
     --to-schema-datamodel prisma/schema.prisma --script` (if engines unavailable, hand-write
     the SQL: `ALTER TABLE "ClubChannel" ADD COLUMN "allowedUserIds" TEXT;`)
  4. create `prisma/migrations/<timestamp>_channel_allowed_users/migration.sql`.
- On your machine: `npx prisma migrate deploy` + `npx prisma generate`.

**Backend** (`backend/src/routes/clubs.ts`)
- Channel create + patch handlers: accept `allowedUserIds: string[]`, validate each is a
  current club member, store as JSON. (Mirror how `allowedRoleIds` is parsed/validated —
  see `parseAndValidateTargetRoleIds` / `parseStringList`.)
- `canSeeChannel` / `canPostToChannel` (helpers ~line 475–500): for CUSTOM channels,
  allow if officer **or** the user's id is in `allowedUserIds` **or** they hold an allowed
  role. (Currently only the role/officer checks exist.)
- Include `allowedUserIds` (parsed) in channel responses.

**Frontend**
- `api.ts` `ClubChannelBody`: add `allowedUserIds?: string[]`.
- `ClubManageScreen.tsx` channel editor: add a member multi-select next to the existing
  `RoleTargetPicker`. Build a small `MemberPicker` (list `club.members`, checkboxes,
  controlled `selectedUserIds`). Send both arrays on save.
- Channel summary text: show gated roles AND member count.
- `types.ts`: add `allowedUserIds?: string[]` to the channel type.

**Tests**: extend `clubChannels.test.ts` — a member-gated channel is visible to the listed
member, hidden from a non-listed plain member, visible to officers.

---

## 3. Request-and-approve activity system  (NEEDS MIGRATION)

Decision: curated catalog + students **request** additions that **you approve** (reuses the
admin reviewer pattern). Freeform pods deferred.

**Schema** (`backend/prisma/schema.prisma`) — new model + migration (same offline process as §2):
```prisma
model ActivityRequest {
  id              String   @id @default(uuid())
  userId          String
  title           String
  description     String?
  category        String
  defaultLocation String?
  status          String   @default("PENDING") // PENDING | APPROVED | REJECTED
  reviewerId      String?
  reviewNote      String?
  createdAt       DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([status, createdAt])
}
```
Add the back-relation `activityRequests ActivityRequest[]` to `model User`.

**Backend**
- In `routes/activities.ts`: `POST /activities/requests` (requireVerifiedAuth) — validate
  title/category, run `moderateTextContent`, rate-limit (`consumeDurableRateLimit`,
  action `activity_request`, e.g. 5/day), create PENDING request.
- New `routes/adminActivityRequests.ts` mounted at `/admin/activity-requests`
  (`router.use(requireAuth, requireAdmin)` — copy `adminClubClaims.ts` structure):
  - `GET /` — list PENDING with requester name.
  - `POST /:id/approve` — if no `Activity` with that title exists, create it from the
    request (title, description, category, defaultLocation); mark request APPROVED + reviewer.
  - `POST /:id/reject` — mark REJECTED + reviewNote.
- Mount in `server.ts` next to the other admin routes.

**Frontend**
- `api.ts`: `requestActivity(body)`, and admin `getActivityRequests`, `approveActivityRequest`,
  `rejectActivityRequest`; `types.ts`: `ActivityRequest`.
- "Request an activity" entry on the activity picker (the pod-create / `ActivityPodsScreen`
  or Explore activity list) → small form (title, category chips, optional location) →
  submit → "Submitted — pending approval."
- Admin review: a simple list screen gated to admins (or handle via a web admin). Minimal:
  reuse the `Sheet`/`ListRow` pattern, approve/reject buttons.

**Tests**: student submits → appears in admin list → approve creates an `Activity` (and is
deduped by title) → reject path.

---

## Conventions cheat-sheet (discovered this session)

- **Officer gate** (backend): `getOfficerMembership(clubId, userId)` helper in `clubs.ts`.
- **Admin gate**: `requireAdmin` (env `ADMIN_USER_IDS`) for platform-level; `requireClubReviewer`
  (`User.isClubReviewer`) for club verification.
- **Durable rate limit**: `consumeDurableRateLimit({ action, identifiers, limit, windowMs })`.
- **Offline migrations**: sandbox can't reach Supabase/engines — hand-write or
  `migrate diff` the SQL into a timestamped folder; you run `migrate deploy` + `generate`
  locally. (`migrate dev` is broken on this repo's history — use `migrate deploy`.)
- **Frontend UI kit** (`components/ui.tsx`): `AppBackdrop, ScreenHeader, Card, Field, Button
  (variants primary|secondary|ghost|danger|accent), Chip, Sheet, ListRow, Banner, Avatar,
  ClubMark, SkeletonCard`. Theme via `useTheme()` → `colors` (keys: ink, sub, faint, primary,
  danger, success, surfaceAlt, borderSoft, …), `typography`, `spacing`.
- **Nav**: screens registered in `App.tsx` (`RootStackParamList` + `<Stack.Screen>`); club
  screens import `RootStackParamList` from `'../../../App'`.
- **Validate**: `npx tsc --noEmit` (both apps) + `npm test`. Build the iOS submission with
  **Node 22**.

---

## Suggested order

1. Section 0 (ship current work) — unblocks the App Store resubmission.
2. Section 1 (hex picker) — small, no migration.
3. Section 3 (activity requests) — migration, but self-contained.
4. Section 2 (channel members) — migration + most UI surface area.
