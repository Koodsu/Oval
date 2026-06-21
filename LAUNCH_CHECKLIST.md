# Oval — Ordered To-Do Before App Store Submission

Work top to bottom; later steps depend on earlier ones. ⚠ = blocks the reviewer
flow if skipped.

## Phase 0 — Finish the Oval rebrand (manual, can't be done in code)

- [ ] **⚠ Resend:** verify `theovalapp.com` as a sending domain (add the SPF/DKIM
      DNS records Resend gives you). Until verified, `noreply@theovalapp.com`
      won't send and email verification breaks.
- [ ] **⚠ Vercel:** set production env vars to the new domain/emails and attach
      `theovalapp.com`; confirm `VITE_BRIDGE_API_URL` still points at the backend.
- [ ] **⚠ Confirm the mobile API fallback** — code now defaults to
      `ovalapp.vercel.app`. Verify that's actually your backend (a wrong API base
      silently breaks the app).
- [ ] **Name/trademark check on "Oval"** — App Store search + basic trademark look
      before spending on screenshots (old crowding research was for "Bridge").
- [ ] Commit the rebrand on `OvalV1`; merge to your release branch.
- [ ] *(Visual, optional)* redesign the leftover "bridge arc" SVG in
      `backend/src/routes/web.ts` to an oval motif.

## Phase 1 — Verify production works

- [ ] **⚠ Cron:** make `/cron/maintenance` run every ~5 min (external scheduler
      like cron-job.org / GitHub Actions, or upgrade to Vercel Pro). Daily-only
      Hobby crons can't deliver timely meetup reminders.
- [ ] `prisma migrate deploy`; confirm all env vars set in Vercel production.
- [ ] **⚠ Live smoke test** on the production URL with a real inbox: register →
      verification email arrives → login → password reset → join pod → send
      message → upload image → receive push.

## Phase 2 — Apple setup

- [ ] Apple Developer → Identifiers: register bundle ID `com.bradyvb.ovalapp`.
- [ ] App Store Connect → My Apps → "+" → New App: name `Oval`, that bundle ID,
      language, SKU. Copy the numeric **Apple ID**.
- [ ] Fill `frontend/eas.json` `submit.production`: `appleId`,
      `ascAppId` (the numeric ID), `appleTeamId` = `687FPU46UV`.

## Phase 3 — Build + TestFlight

- [ ] Tag the release commit (Build 21 is stale).
- [ ] `cd frontend && eas build --platform ios --profile production`.
- [ ] `eas submit --platform ios --profile production` → wait for processing.
- [ ] Install via TestFlight on your iPhone. Test reviewer-critical paths:
      register/verify/login, browse, create/join pod, chat, DM, report, block,
      password reset, and **⚠ account deletion + data export (test twice — #1
      social-app rejection cause)**.

## Phase 4 — App Store Connect paperwork

- [ ] Metadata from `APP_STORE_SUBMISSION.md` (Oval name, subtitle, description,
      support/marketing/privacy URLs).
- [ ] App Privacy questionnaire = the table in that doc; no tracking, no ads.
- [ ] Age rating questionnaire → 18+.
- [ ] Export compliance → HTTPS exemption (already set via
      `ITSAppUsesNonExemptEncryption: false`).
- [ ] Screenshots: 6.9" + 6.5" iPhone, from the build, with seeded content.
- [ ] **⚠ Reviewer account:** preverified OSU-format email, Terms accepted,
      populated with pods/clubs/messages. Log into it yourself.
- [ ] Review notes: reviewer credentials + why the OSU email gate exists (and that
      the reviewer account bypasses it), permissions optional, no IAP.

## Phase 5 — Submit

- [ ] Attach the processed build, fix anything broken from Phase 3, **Submit for Review**.
- [ ] While in review: seed real pods/clubs so waitlist users don't hit an empty app.
- [ ] On approval: smoke-test the live build, email the waitlist. If rejected, fix
      only what's cited and resubmit same day.
