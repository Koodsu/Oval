# Bridge — Bare Minimum to Public

Goal: app live on the App Store for waitlist users ASAP. Everything not required by Apple or basic function is deferred to July, ahead of the distributed August launch.

Seller: your existing individual account. No LLC, no attorney, no name change, no ops hardening — all deferred.

## The only things Apple actually requires

A working production app a reviewer can use, complete ASC metadata (privacy answers, age rating, screenshots), a reviewer account that bypasses your OSU-email gate, working in-app account deletion, and live privacy/support URLs. That's the whole gate. Your app already has the hard parts built (deletion, export, report/block, policies written).

## The checklist (~25–30 hrs, submit in 4–5 days)

### 1. Deploy production (Day 1, ~5 hrs)

- Stay on Vercel Hobby; replace the daily Vercel cron with a free external scheduler (GitHub Actions on a 5-min schedule, or cron-job.org) hitting `/cron/maintenance` with the `CRON_SECRET` header — meetup reminders need 5-min granularity and Hobby crons are daily-only. Revisit Vercel Pro in July. Set env vars from gate §2, `prisma migrate deploy`, deploy backend + landing.
- Verify on the live URL: register → verification email arrives in a real inbox → login, password reset, join pod, send message, upload image, push notification. Fix what breaks.

### 2. Build + self-test (Day 2, ~5 hrs)

- Release commit/tag. Fresh EAS production build (Build 21 is stale). Upload to a new ASC record; put its numeric ID in `frontend/eas.json`.
- Internal TestFlight on your own iPhone. Test only what Apple touches and what would embarrass you: register/verify/login, browse, create/join pod, chat, DM, report, block, password reset, **account deletion**, **data export**, relaunch. Account deletion failing from the real build is the #1 social-app rejection — test it twice.

### 3. ASC paperwork (Day 3, ~5 hrs)

- Metadata from `APP_STORE_SUBMISSION.md` (it's already drafted). Privacy questionnaire = the table in that file, no tracking declared. Age rating = 18+. Export compliance = HTTPS exemption.
- Screenshots: 6.9" + 6.5" iPhone from your build with real-looking seeded content. One session.
- **Reviewer account**: preverified OSU-format email, Terms accepted, populated with pods/clubs/messages. Log into it yourself before submitting.
- Review notes from the existing draft: reviewer credentials, why an OSU email is required (eligibility gate, reviewer account bypasses it), permissions optional, no IAP.

### 4. Fix + submit (Day 4–5)

- Fix anything broken from step 2, rebuild if needed, **submit**.
- Review: 2–5 days. ~40% of first apps get one rejection — if so, fix only what's cited, resubmit same day.

### 5. While Apple reviews

- Seed real pods/activities and line up a few club officers so waitlist users hit a live app, not an empty one.
- On approval: smoke-test the live build, email the waitlist.

**Realistic: submitted by end of week 1, live for waitlist users days 7–12 (add ~3–5 days if rejected once).**

## Deferred to July (before the August push)

In rough priority order: attorney review of Terms/privacy/meetup liability (you're carrying this risk personally until then — flat fee $500–1,500, or free via OSU Moritz EBLC August cohort, apply now); database backups + uptime alerts + crash reporting; LLC → D-U-N-S → Apple org conversion (seller name changes to the LLC, app stays live); moderation incident drill; accessibility pass; device matrix; name/trademark clearance; universal-link testing; everything in `PUBLIC_RELEASE_GATE.md` still unchecked.

One non-negotiable even in minimal mode: someone (you) watches the moderation/report inbox daily once real users are on. It's an 18+ meetup app — that's not gold-plating, that's the floor.
