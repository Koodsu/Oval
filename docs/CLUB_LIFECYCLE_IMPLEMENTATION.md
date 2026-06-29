# Club Lifecycle, Onboarding & Verification — Implementation Plan

Status: proposed
Owner: Brady
Scope: backend (`backend/src/routes/clubs.ts`, Prisma), frontend (Expo club screens), a thin admin surface, and one Instagram account (**@oval**) used as the verification channel.

---

## 1. Goal

Replace manual, founder-driven club onboarding (a form + hand-set `isVerified`) with a self-gating system so that:

1. Brady is no longer in the loop to *create* a club.
2. The Explore catalog never fills with dead or fake clubs — a club isn't discoverable until it has real traction (5 members) or is verified.
3. The verified badge means "this is the real club, run by its real officers," proven by control of the club's Instagram (or official email), not by Brady eyeballing a form.
4. The only human step that survives is a few-seconds confirm of Instagram claims — handleable by Brady alone for all of OSU, and trivially delegable later.

Works at **any** university with zero external integrations. An official org directory, where one exists, is an optional accelerant (§13), not a dependency.

A note on terms: **onboarding** = getting a club's data in; **verification** = the badge. They're decoupled.

---

## 2. Club state — four orthogonal axes (no single lifecycle enum)

A club is described by four independent properties plus a follow relationship. This is cleaner than one lifecycle enum because discoverability, the badge, how you join, and moderation standing all move independently.

1. **Discoverability** — `isDiscoverable` (boolean toggle, default `false`). Whether the club shows in Explore/search. The club controls it, but it can only be turned **ON** while the club is **eligible**:

   > eligible = (≥ `CLUB_PUBLISH_THRESHOLD` distinct qualifying members) **OR** verified.

   A new club starts hidden. The first time it crosses the member threshold (§5) — or the moment it gets verified — discovery auto-flips ON. After that the club can toggle it OFF (go private) or back ON (while still eligible) whenever it wants.

2. **Verification** — `verification`: `UNVERIFIED → PENDING_REVIEW → VERIFIED`. The badge. A discoverable but unverified club shows a grey/unverified mark; an Instagram claim (§7) earns the checkmark. Verification is independent of discoverability — a hidden club can verify *in order to become* eligible to be discoverable.

3. **Join policy** — how someone becomes a **member** (§18): `OPEN` (auto-accept: anyone joins instantly), `REQUEST` (officer approval), `APPLICATION` (in-app form an officer can open/close), `INVITE_ONLY` (officers add people).

4. **Moderation status** — `status`: `ACTIVE | SUSPENDED | ARCHIVED` (§9). Separate from the badge — a verified club can be suspended for behavior without being called "unverified."

Plus: a lightweight **follow** relationship. Anyone can follow a discoverable club; it drives the public **follower count** and the public content feed, and is separate from membership.

Key rules:
- Brand-new club = hidden, unverified, `OPEN` join by default. Founder invites people (§ invites) until 5 qualifying members → auto-discoverable with an unverified mark. Or the founder verifies via Instagram and becomes discoverable immediately, skipping the threshold.
- Turning discovery **ON** requires current eligibility; turning it **OFF** is always allowed.
- There is **no permanent-private state** — "private forever" is just leaving the discovery toggle off. The only way such a club can be discoverable is to verify via Instagram.

---

## 3. Things this plan must get right (design constraints)

1. **The verification channel must not be Brady's personal phone.** Officers DM the code to **@oval**, so the proof lands in a shared inbox any reviewer can clear. Reviewer is a role, not a person.
2. **Officer turnover.** Officers graduate yearly. Without ownership transfer + yearly re-affirmation, the verified set rots into clubs run by nobody. See §6.
3. **Threshold gaming.** Only **distinct, OSU-verified** (`User.verifiedUniversity = true`), sufficiently-aged accounts count toward the gate. See §5.
4. **Squatting / duplicates.** Name-collision detection at creation; a dispute path. See §10.
5. **Revocation.** Reports, no-shows, and inactivity can strip the badge or suspend the club. See §9.
6. **Founder account deletion.** `Club.createdBy` is `onDelete: Restrict` today — deleting a founder must first transfer ownership or archive the club. See §6.
7. **Guidelines + enforcement.** Published rules + a reporting path so moderation is defensible. See §11.

---

## 4. Data model changes (Prisma)

Replace the two loose booleans with the four axes above + follow + verification metadata. Keep `isPublic`/`isVerified` temporarily as back-compat (§14), then drop them.

```prisma
enum ClubVerification {
  UNVERIFIED
  PENDING_REVIEW
  VERIFIED
}

enum ClubJoinPolicy {
  OPEN          // auto-accept: anyone joins instantly
  REQUEST       // request + officer approval
  APPLICATION   // in-app application form, open/closeable
  INVITE_ONLY   // officers add members
}

enum ClubStatus {
  ACTIVE
  SUSPENDED
  ARCHIVED
}

enum ClubVerificationMethod {
  INSTAGRAM
  OFFICIAL_EMAIL
  DIRECTORY        // optional fast lane, §13
  MANUAL           // reviewer override / seeded
}

model Club {
  // ... existing fields ...
  isDiscoverable     Boolean          @default(false)
  verification       ClubVerification @default(UNVERIFIED)
  joinPolicy         ClubJoinPolicy   @default(OPEN)
  status             ClubStatus       @default(ACTIVE)

  // verification metadata
  verificationMethod ClubVerificationMethod?
  verifiedAt         DateTime?
  verifiedByUserId   String?
  instagramHandle    String?          // normalized, lowercase, no '@'
  officialEmail      String?
  lastReaffirmedAt   DateTime?        // yearly re-verification (§6)

  // bookkeeping
  discoverableSince  DateTime?
  suspendedAt        DateTime?
  suspendedReason    String?

  followers          ClubFollower[]
  claims             ClubClaim[]
  invites            ClubInvite[]
  appCycles          ClubApplicationCycle[]

  // keep during migration window, then remove:
  isVerified         Boolean  @default(false)
  isPublic           Boolean  @default(true)

  @@index([isDiscoverable, category])   // replaces @@index([isPublic, category])
  @@index([university, isDiscoverable])
}

// Public follow — audience, separate from membership.
model ClubFollower {
  id        String   @id @default(uuid())
  clubId    String
  userId    String
  createdAt DateTime @default(now())

  club Club @relation(fields: [clubId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([clubId, userId])
  @@index([clubId])
  @@index([userId])
}

// A verification attempt by a member who says they're an officer.
model ClubClaim {
  id            String   @id @default(uuid())
  clubId        String
  userId        String                       // claimant
  method        ClubVerificationMethod
  handleOrEmail String                       // IG handle or email claimed
  challengeCode String                       // code they DM to @oval / receive by email
  status        String   @default("PENDING") // PENDING | PROOF_SENT | APPROVED | REJECTED | EXPIRED
  reviewerId    String?
  reviewNote    String?
  createdAt     DateTime @default(now())
  expiresAt     DateTime
  resolvedAt    DateTime?

  club Club @relation(fields: [clubId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([clubId, status])
  @@index([status, createdAt])
}

// Invite links for the private (pre-threshold) stage.
model ClubInvite {
  id          String    @id @default(uuid())
  clubId      String
  code        String    @unique          // short, URL-safe
  createdById String
  maxUses     Int?                        // null = unlimited
  uses        Int       @default(0)
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())

  club Club @relation(fields: [clubId], references: [id], onDelete: Cascade)
  @@index([clubId])
}

// In-app applications to JOIN a club (the Builders flow, §18).
model ClubApplicationCycle {
  id           String   @id @default(uuid())
  clubId       String
  title        String                    // "Fall 2026 Applications"
  questionsJson String                   // customizable form schema
  status       String   @default("DRAFT") // DRAFT | OPEN | CLOSED
  opensAt      DateTime?
  closesAt     DateTime?
  createdAt    DateTime @default(now())

  club         Club              @relation(fields: [clubId], references: [id], onDelete: Cascade)
  applications ClubApplication[]
  @@index([clubId, status])
}

model ClubApplication {
  id          String   @id @default(uuid())
  cycleId     String
  userId      String
  answersJson String
  stage       String   @default("APPLIED") // APPLIED | INTERVIEW | ACCEPTED | REJECTED | WITHDRAWN
  reviewNote  String?
  createdAt   DateTime @default(now())

  cycle ClubApplicationCycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  user  User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([cycleId, userId])
  @@index([cycleId, stage])
}
```

Reviewer capability on `User`, set manually in Supabase for now:

```prisma
model User {
  // ...
  isClubReviewer Boolean @default(false)
}
```

---

## 5. The member gate (auto-enable discovery)

- **Threshold:** `CLUB_PUBLISH_THRESHOLD = 5` distinct qualifying members (low to ease cold-start; bump to 10 later if junk grows). **Verified clubs skip this entirely** — verification alone makes a club eligible to be discoverable.
- **Qualifying member** = a `ClubMember` whose `User.verifiedUniversity = true` and whose account age ≥ `MIN_ACCOUNT_AGE_DAYS` (e.g. 3) at join time. The founder counts as one. (Followers do **not** count — only real members.)
- **Where evaluated:** on every membership add (`POST /clubs/:id/join`, invite accept, application accept), recompute the qualifying count. If it reaches the threshold and the club has never been discoverable, set `isDiscoverable = true`, `discoverableSince = now`, and notify officers ("Your club is now public 🎉 — verify it via Instagram to get the checkmark").
- This is an **auto-enable**, not a one-way lock: once eligible the club may toggle discovery off/on at will (§2). Dropping below 5 members later does not force it private, but inactivity can suspend it (§9).

---

## 6. Officer turnover & ownership transfer

- **Transfer ownership:** `POST /clubs/:id/transfer` (owner-only) promotes an existing member to owner; old owner stays as officer. Required before a founder can delete their account (fixes the `onDelete: Restrict` problem) — otherwise deletion is blocked with a clear message, or the club is auto-archived if the founder is the sole member.
- **Yearly re-verification:** a scheduled job finds VERIFIED clubs whose `lastReaffirmedAt` is older than `REVERIFY_INTERVAL` (12 months). On expiry the club **loses the badge** (`verification → UNVERIFIED`) and the current officer gets a notification + a persistent in-app pop-up to re-verify. A current verified officer re-affirms in one tap (sets `lastReaffirmedAt = now`, restores `VERIFIED`); if officers have changed, they re-run the Instagram claim (§7). The club stays discoverable throughout — only the badge drops.

---

## 7. Verification flows (→ VERIFIED)

Instagram is primary; official email is the fallback. Both end in a few-seconds human confirm (§8).

### 7a. Instagram (primary, universal)
1. Officer enters the club's Instagram handle → `POST /clubs/:id/claims { method: INSTAGRAM, handle }`. Sets `verification = PENDING_REVIEW`.
2. Backend normalizes the handle, generates a short `challengeCode` (e.g. `OVAL-4F9K`), stores a `ClubClaim` (`expiresAt` +24h), and instructs the officer: **DM this exact code to @oval from the club's official Instagram.**
3. Officer sends it; taps "I've sent it" → claim `PROOF_SENT`.
4. The code arrives in the @oval IG inbox. A reviewer opens the queue (§8), eyeballs that the handle is plausibly the real club (followers, post history), matches the code, taps **Approve**.
5. On approve: `verification = VERIFIED`, `verificationMethod = INSTAGRAM`, `instagramHandle`, `verifiedAt`, `verifiedByUserId`, `lastReaffirmedAt = now`. If the club wasn't discoverable, it's now eligible — auto-enable or prompt the officer to turn discovery on. Notify officers.

> Automation note: the IG inbox is read manually at first — fine for one person at OSU scale. Later you can semi-automate code matching without schema changes. Do **not** build against the Instagram Graph API for DMs initially — it's restricted and brittle.

### 7b. Official email (fallback)
- For clubs with an official `@osu.edu`-style address. System emails a code; entering it advances the claim, with a light human confirm the address looks official.

### 7c. No socials / brand-new club
- Rare. Either wait for the member threshold to grant discovery (unverified mark) or do a one-off manual review.

---

## 8. Admin review surface (handoff-ready)

A thin protected view (guarded backend route group `/admin` or a page in `landing/`, gated on `isClubReviewer`):

- **Verification queue:** claims with status `PROOF_SENT` — club name, claimed handle/email, the `challengeCode`, member count, recent activity. Approve / Reject (+reason).
- **Moderation queue:** clubs over a report threshold or flagged inactive (§9).
- **Audit log:** every state change with actor + timestamp (append-only `ClubAuditEvent` or reuse logging).
- Reviewer = anyone with `isClubReviewer = true`. Just Brady for now (set in Supabase); the queue still gives him one place to clear all OSU verifications.

---

## 9. Revocation, suspension & re-review

A scheduled job evaluates discoverable clubs:

- **Inactivity:** no meetings and no chat in `INACTIVITY_WINDOW` (e.g. 60 days) → after a grace prompt, `status = SUSPENDED` (hidden from Explore) with `suspendedReason`.
- **Reports / no-shows:** when reports or no-show counts (already tracked) cross a threshold → moderation queue; a reviewer can `SUSPENDED` the club or revoke just the badge (`verification → UNVERIFIED`).
- **Reinstatement:** a reviewer can restore a suspended club; a revoked-badge club can re-run the claim.
- Verification (real/official) and moderation standing (well-behaved) stay **separate**.

---

## 10. Anti-abuse at creation

In `POST /clubs`:

- **Name-collision check:** fuzzy-match against existing non-archived clubs at the same `university`. On a near-match, soft-warn "Is this the same club? Join it instead" rather than silently duplicating.
- **Rate limit:** max club creations per user per 24h (e.g. 2).
- **Keep** the existing `moderateTextContent([name, description])` call.
- New clubs start `isDiscoverable = false`, `verification = UNVERIFIED`, `joinPolicy = OPEN`. Client no longer passes `isPublic`.
- **Disputes:** `POST /clubs/:id/dispute` lets a real officer contest a squatter; lands in the moderation queue.

---

## 11. Club guidelines & content policy

Publish a short **Club Guidelines** doc (in-app + landing): who may create/claim a club, that impersonation = permanent ban, prohibited content (reuse platform moderation policy), what each badge state means, and the appeals path. One-line acknowledgement checkbox at creation; link it from the verification screen. Makes suspensions/rejections defensible.

---

## 12. Backend endpoint changes (summary)

| Endpoint | Change |
|---|---|
| `POST /clubs` | Create hidden/unverified/OPEN; drop client `isPublic`; name-collision + rate-limit |
| `GET /clubs` (Explore) | Filter `isDiscoverable = true AND status = ACTIVE` instead of `isPublic`; return `verification`, `followerCount`, `memberCount` |
| `GET /clubs/:id` | Hidden clubs visible only to members/invitees; for discoverable clubs, non-members get public content + Follow + Join/Apply CTA |
| `PATCH /clubs/:id/discovery` | Toggle `isDiscoverable` (rejects ON if not eligible) |
| `POST /clubs/:id/join` | Honor `joinPolicy` (OPEN instant / REQUEST / APPLICATION / INVITE_ONLY); recompute member gate; auto-enable discovery on threshold |
| `POST /clubs/:id/follow` / `DELETE …/follow` | Follow / unfollow (drives follower count) |
| `POST /clubs/:id/invites` / `POST /clubs/join/:code` | Invite-link create + redeem (private stage) |
| `POST /clubs/:id/claims` / `…/:claimId/sent` | Start IG/email verification; mark proof sent |
| `POST /admin/claims/:id/approve` / `/reject` | Reviewer decision (`isClubReviewer`-gated) |
| `POST /clubs/:id/transfer` / `/reaffirm` / `/dispute` | Ownership transfer, yearly re-affirm, contest squatter |
| `…/application-cycles` (CRUD, open/close) + `…/applications` | In-app applications (§18) |

Background jobs (extend the RSVP-reminder scheduler): yearly re-affirm flagger, inactivity/suspension evaluator, claim-expiry sweeper.

---

## 13. Optional accelerant — directory seeding (per campus, no scraping)

Where a campus publishes a registered-org list, do a **one-time CSV import** at launch (ask the student activities office; don't scrape). Imported orgs become hidden shells with `verificationMethod = DIRECTORY` available; an officer still claims via IG/email to verify. Absent a directory, nothing changes — the funnel is the default everywhere.

---

## 14. Migration & rollout (phased)

**Phase 0 — schema & backfill.** Add the new columns/enums (nullable), keep `isPublic`/`isVerified`. Backfill: `isVerified=true` → `verification=VERIFIED`; `isPublic=true` → `isDiscoverable=true`; else hidden. Read from new fields with a fallback to the old booleans. No behavior change.

**Phase 1 — private stage + member gate + follow.** New clubs start hidden; invite links; auto-enable discovery at 5; follow/unfollow + follower count.

**Phase 2 — verification + admin queue.** IG/email claims, the reviewer queue, `isClubReviewer`. Set up @oval. Start verifying.

**Phase 3 — turnover, revocation, join policies, applications, guidelines.** Transfer, yearly re-affirm + inactivity jobs, `joinPolicy`, in-app application cycles, dispute path, published guidelines.

**Phase 4 — cleanup.** Drop `isPublic`/`isVerified` and the old index; remove back-compat code.

---

## 15. Testing & verification

- Unit: qualifying-member counting (alts/unverified excluded; followers excluded), discovery-eligibility rule (ON blocked when ineligible, allowed when verified), claim expiry, name-collision matcher.
- Route tests (extend `clubs.test.ts`): hidden club absent from `GET /clubs` but visible to invitee; auto-enable at threshold; toggle discovery off/on; verified club discoverable with <5 members; claim approve/reject flips `verification`; follower count; OPEN vs REQUEST vs APPLICATION join; reviewer-gating on `/admin`.
- Integration: create → invite 5 → auto-discoverable (unverified) → IG claim → approve → VERIFIED; plus revoke, re-affirm, and Builders application paths.
- Manual QA + seed clubs in each state so the app looks populated.

---

## 16. Config constants (one place)

```
CLUB_PUBLISH_THRESHOLD = 5
MIN_ACCOUNT_AGE_DAYS   = 3
CLAIM_EXPIRY_HOURS     = 24
REVERIFY_INTERVAL_DAYS = 365
INACTIVITY_WINDOW_DAYS = 60
CLUB_CREATE_RATE_LIMIT = 2 / 24h
OVAL_IG_HANDLE         = "oval"
```

---

## 17. Deliverables checklist

- [ ] Prisma migration: `ClubVerification`/`ClubJoinPolicy`/`ClubStatus`/`ClubVerificationMethod` enums; `ClubFollower`, `ClubClaim`, `ClubInvite`, `ClubApplicationCycle`, `ClubApplication`; `User.isClubReviewer`; new `Club` columns + indexes.
- [ ] Backfill script for existing clubs.
- [ ] `POST /clubs` hidden/unverified + collisions + rate limit.
- [ ] Discovery visibility in `GET /clubs` / `GET /clubs/:id`; `PATCH …/discovery` toggle with eligibility check.
- [ ] Follow / unfollow + follower count.
- [ ] Invite link create/redeem + UI.
- [ ] Member-gate evaluation + auto-enable discovery.
- [ ] Join-policy handling (OPEN/REQUEST/APPLICATION/INVITE_ONLY) + public-content visibility for non-members.
- [ ] In-app application cycles (customizable form, open/close) + applicant pipeline.
- [ ] Claim endpoints (IG + email) + claim UI.
- [ ] Admin verification + moderation queues (`isClubReviewer`-gated).
- [ ] Ownership transfer, yearly re-affirm, dispute endpoints.
- [ ] Scheduled jobs: re-affirm flagger, inactivity evaluator, claim-expiry sweeper.
- [ ] Notifications for each state change.
- [ ] Club Guidelines doc + acknowledgement at creation.
- [ ] @oval Instagram set up as the verification channel.
- [ ] Tests per §15; remove legacy booleans in Phase 4.

---

## 18. Members, followers & joining (the Builders archetype)

The model now has three distinct relationships, which together cover every club shape:

- **Follower** — anyone can follow a discoverable club. Sees public content, counts toward the public **follower count**. No approval. (`ClubFollower`.)
- **Member** — actually in the club. How you become one is set by **`joinPolicy`**:
  - `OPEN` — **auto-accept ON**: tap Join → instant member.
  - `REQUEST` — auto-accept OFF: request → an officer approves.
  - `APPLICATION` — a customizable in-app application an officer can **open and close**; accepted applicants become members.
  - `INVITE_ONLY` — officers add people directly.
- **Role** — internal tier *within* membership (`ClubMember.role` + custom `ClubRole`), e.g. "Builder", "Confirmed Member", "Board". Announcements/meetings scope to roles via `targetRoleIds`.

"Auto-accept" is just the user-facing name for `joinPolicy = OPEN` vs not — a simple toggle in club settings, with the off-state options (request / application / invite-only) underneath.

**Public content for non-members (required):** for a discoverable club, `visibility: PUBLIC` announcements and meetings are returned to followers/non-members, and the public can RSVP/attend public meetings via the existing `ClubMeetingAttendee`. Role-scoped content (`targetRoleIds`) stays restricted. This is a permission tweak on the announcement/meeting endpoints — no new schema.

**Builders maps cleanly:**
- Verified (so discoverable even with a small membership — skips the 5-member gate).
- `joinPolicy = APPLICATION`; the officers open an application cycle each semester with custom questions and an interview stage, then close it. Outside an open cycle the Join button reads "Applications closed."
- Public events posted with `visibility: PUBLIC` so the whole campus can see and RSVP — these are the recruiting funnel; interested students **follow** to get notified when applications open.
- Accepted applicants become members and get the "Builder" role; internal meetings/announcements scope to that role.

So followers give you the public audience + count you wanted, the auto-accept toggle controls open vs gated joining, and applications are fully in-app, customizable, and open/closeable.

---

## 19. Decisions (resolved with Brady)

1. **Discovery is a toggle, not a one-way lifecycle.** No permanent-private state — "private forever" is just leaving discovery off; such a club can only become discoverable by verifying via Instagram. Clubs can turn discovery on/off anytime (ON requires eligibility).
2. **Publish threshold = 5** distinct qualifying members (→ 10 later if needed). Verified clubs skip it.
3. **Followers + follower count, plus an auto-accept toggle** (`joinPolicy OPEN` vs gated). Roles handle internal tiers.
4. **In-app, customizable applications** to *join* a club, with open/close — for gated clubs like Builders.
5. **Yearly re-verification:** badge drops on expiry; notification + persistent pop-up until an officer re-verifies (one tap, or re-claim if officers changed). Club stays discoverable; only the badge drops.
6. **Reviewer = Brady only for now**, assigned manually in Supabase (`isClubReviewer`); the admin queue still centralizes verifications. Handles all of OSU solo.
7. **Hidden clubs can verify.** A discovery-off club may complete Instagram verification and earn the badge; it just isn't shown until the club turns discovery on. This is also the path by which a "private forever" club can become discoverable.
8. **Build the full in-app application pipeline now** (customizable form + open/close + applicant stages), not a stripped request-only first pass.
