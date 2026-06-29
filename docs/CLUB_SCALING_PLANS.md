# Scaling & Verifying Clubs — 5 Plans

**Context:** Today every club is onboarded by you personally via a form, and `Club.isVerified` is set by hand. This works at OSU-pilot scale but breaks the moment you want hundreds of orgs or a second campus. Below are five distinct strategies. They're ordered roughly from "least human effort, weakest trust" to "most automated source-of-truth." Most likely you'll combine 2–3 of them — see the recommendation at the end.

A note on terms used throughout:
- **Onboarding** = getting a club's data into Bridge (name, description, officers, channels).
- **Verification** = asserting this is the *real, official* club run by its *actual* officers (the `isVerified` badge).
These are separate problems and the best plans decouple them.

---

## Plan 1 — Fully self-serve + automated signals (no human review)

**Idea:** Anyone with a verified `@osu.edu` email can create a club instantly. Verification is granted automatically from signals you can check in code, with no manual step from you.

**How it works**
- Reuse your existing OSU email verification (`verifiedUniversity`) as the gate to *create* a club.
- Auto-grant `isVerified` when a club clears automated checks: creator email domain matches `university`, club name isn't a near-duplicate of an existing verified club (fuzzy match), description passes a basic quality/abuse filter, and the creator confirms an official link (Instagram handle, Linktree, or org-directory URL) that the system fetches and sanity-checks.
- Add rate limits (e.g. one club creation per user per 24h) and a "claim instead of create" prompt when a similar club already exists.

**What to build**
- Self-serve "Create club" flow in the app (you mostly have the data model already).
- A background `verifyClub` job: domain check, duplicate detection, link liveness check, profanity/abuse scan.
- An auto-revoke path: if a club later gets reports/no-shows above a threshold, `isVerified` flips back to false and lands in a small exceptions queue.

**Pros:** Near-zero ongoing effort; scales infinitely; instant gratification for officers.
**Cons:** Weakest trust guarantee — a motivated impersonator with an OSU email can still spin up a fake "official" club. Duplicate clubs proliferate.
**Effort:** Low–medium (mostly one create flow + one job).
**Choose this if:** speed of growth matters more than badge integrity, and you're okay treating the badge as "looks legit" rather than "we confirmed it."

---

## Plan 2 — Authoritative directory integration (official list as source of truth)

**Idea:** Stop verifying clubs one by one. Import OSU's official registered-student-organization directory and treat it as ground truth. A Bridge club is verified iff it maps to a real registered org.

**How it works**
- Ingest the official OSU org directory (Ohio State publishes registered student orgs through its involvement/Student Activities platform). Store each as an *unclaimed club shell* with name, category, and official contact.
- Officers "claim" their shell rather than create from scratch. Claiming requires proving they're an officer (see claim methods in Plan 5).
- `isVerified` is derived: matched-to-directory + claimed-by-verified-officer = verified. Unmatched user-created clubs stay unverified until they map to a directory entry.
- Re-sync on a schedule (e.g. weekly) to catch new orgs and deactivate defunct ones.

**What to build**
- An importer (scraper or API/CSV pull) + a normalization/matching layer (dedupe against existing clubs).
- A "claim this club" flow and an `externalOrgId` field on `Club`.
- A scheduled re-sync job.

**Pros:** Strongest, lowest-effort trust at scale — the university already did the verification work. Naturally solves duplicates. Pre-seeds your catalog so the app looks full on day one.
**Cons:** Depends on the directory being accessible and reasonably current; needs a matching layer; doesn't cover informal/unregistered groups. Per-campus integration work to expand beyond OSU.
**Effort:** Medium (the importer + matching is the real work).
**Choose this if:** you want the badge to mean something real and you're committed to OSU first. This is the most defensible long-term backbone.

---

## Plan 3 — Tiered trust + peer/community verification

**Idea:** Replace the binary verified/unverified flag with progressive trust tiers that clubs earn from real activity and member vouching — so verification scales with usage instead of with your time.

**How it works**
- Tiers, e.g.: **Unverified** (just created) → **Community** (N distinct OSU-verified members joined and/or vouched) → **Active** (hosted M real meetings with attendance/check-ins) → **Official** (claimed + directory-matched per Plan 2, or your manual stamp).
- Members vouch ("I'm actually in this club"); weight vouches by account age/trust to resist sybils. Attendance and check-in data you already track feed the tier automatically.
- Show the tier as a badge so users self-calibrate trust; reserve the top "Official" tier for the rare manual/integration cases.

**What to build**
- A `trustTier` field + a scoring job that recomputes tiers from members, vouches, meetings, and reports.
- Vouch UI and anti-abuse weighting.
- Badge rendering for each tier across club cards and detail.

**Pros:** Self-reinforcing — the more a club is used, the more verified it becomes, with no gatekeeper. Degrades gracefully (a fake club with no real members never climbs). Great signal even where no official directory exists.
**Cons:** Cold-start problem (brand-new legit clubs look untrusted); gameable by coordinated groups without good anti-sybil weighting; "verified" becomes fuzzier to explain to users.
**Effort:** Medium (scoring + anti-abuse is the hard part).
**Choose this if:** you want something that works across campuses and informal groups, and you're comfortable with trust-as-a-gradient rather than a yes/no stamp.

---

## Plan 4 — Delegated human review (you stop being the bottleneck)

**Idea:** Keep human verification, but make it *anyone's* job but yours. Build an admin review queue and recruit student ambassadors / campus reps to clear it. You scale reviewers, not your own hours.

**How it works**
- Officers submit a club; it enters a **review queue** instead of your inbox.
- A small set of trusted reviewers (you + vetted student ambassadors, ideally one per campus) approve/reject with a one-tap decision and a reason code.
- Reviewers get lightweight tooling: side-by-side of submission + auto-checks from Plan 1 (domain, duplicates, link liveness) so each decision takes seconds.
- Track reviewer accuracy; auto-approve submissions that clear all automated checks to keep the queue small, route only ambiguous ones to humans.

**What to build**
- An internal admin web view (queue, filters, approve/reject, audit log) — your `landing/` or a protected backend route.
- Reviewer roles/permissions and an audit trail on `Club`.
- Auto-triage so humans only see edge cases.

**Pros:** Preserves high badge integrity while removing *you* as the single point of failure; ambassadors double as local growth/marketing. Works on any campus immediately.
**Cons:** Ongoing coordination/quality-control of a reviewer team; slower than self-serve; you have to recruit and trust reviewers.
**Effort:** Medium (the admin tooling) + ongoing people ops.
**Choose this if:** you want to keep manual rigor through the next growth stage without it consuming your time, and you're open to a small ambassador program.

---

## Plan 5 — Officer-claim with credential verification (prove you run it)

**Idea:** Focus entirely on the hardest sub-problem — proving the *person* is a real officer — and make that proof automatic. Onboarding can be self-serve or directory-seeded; the badge hangs on a strong claim.

**How it works**
- A club exists (created in-app or seeded from a directory). To get verified, an officer must complete one of several **claim methods**, strongest first:
  1. **Email-domain proof:** receive a code at the club's official email (from the org directory or club's public contact), not just any personal `@osu.edu`.
  2. **Social handle proof:** post a one-time code to the club's official Instagram/Linktree, or DM it from the verified handle, then the system confirms.
  3. **Officer cross-vouch:** an already-verified officer of that club approves the new officer.
- On success, set `isVerified` and record *how* it was verified (method + timestamp) for auditability and revocation.

**What to build**
- A claim state machine on `Club`/`ClubMember` (`claimStatus`, `claimMethod`, `verifiedVia`).
- Code-send + confirm flows for email and social proof.
- Officer-to-officer approval UI.

**Pros:** Directly attacks impersonation, which is the real risk in the binary `isVerified` model; fully automatable; composes nicely on top of Plans 1, 2, or 3.
**Cons:** Some friction for officers; social-proof checks can be brittle (handles change, platforms rate-limit); doesn't by itself prevent duplicate or low-quality clubs.
**Effort:** Medium (several verification channels to build and maintain).
**Choose this if:** the thing you actually care about is "is this the real club run by real officers," and you want that answered without your involvement.

---

## How they compare

| Plan | Human effort to scale | Trust strength | Cross-campus ready | Main risk |
|------|----------------------|----------------|--------------------|-----------|
| 1 Self-serve + signals | Lowest | Weak | Yes | Impersonation, duplicates |
| 2 Directory integration | Low | Strongest | Per-campus work | Directory access/match |
| 3 Tiered/peer trust | Low | Medium (gradient) | Yes | Cold start, sybils |
| 4 Delegated review | Medium + people ops | High | Yes | Reviewer quality |
| 5 Officer-claim | Low after build | High (anti-impersonation) | Yes | Friction, brittle proofs |

## Recommendation (a phased combination)

These aren't mutually exclusive — the strongest system stacks them:

1. **Now:** Build **Plan 1** self-serve so you're out of the create loop, plus **Plan 4**'s lightweight review queue for the edge cases you used to handle in your inbox. This alone removes you as the bottleneck within one build cycle.
2. **Next:** Add **Plan 5** officer-claim so the `isVerified` badge means "real officers proved it," not "Brady eyeballed a form."
3. **Backbone:** Land **Plan 2** directory integration for OSU so most clubs are pre-seeded and verified from the source of truth, shrinking everything else to exceptions.
4. **Overlay:** Layer **Plan 3** trust tiers on top so unregistered/informal groups and brand-new clubs still get a meaningful, abuse-resistant signal.

Net effect: directory + claim handles the official long tail automatically, tiers cover everything outside the directory, and the review queue shrinks to a handful of true edge cases — none of which require *you* specifically.
