# Bridge Public Release Gate

Audit snapshot: June 9, 2026

This is the canonical launch checklist. It replaces earlier sprint and launch lists.
Checked items are complete in the repository. Unchecked items require a founder
decision, production credentials, a third-party account, legal review, or physical
device/App Store testing.

## The Stopping Rule

Bridge is ready to submit when every **App Store submission gate** below is checked.
Bridge is ready to announce publicly when those gates and every **Public launch gate**
are checked.

A new issue may block release only if it involves:

- an App Store rule;
- a security or privacy breach;
- a crash, data loss, or account takeover;
- a broken core flow;
- a safety or moderation failure; or
- materially false store or marketing information.

Everything else goes into the v1.1 backlog. Freeze features 48 hours before
submission and accept only blocker fixes.

## Founder Run Order

Complete the remaining unchecked work in this order:

1. Decide the seller/entity and clear the Bridge name; obtain the bounded legal
   review, then freeze v1.
2. Create the release commit/tag and sign in to Vercel.
3. Configure production environment variables, backups, alerts, quotas, and the
   moderator inbox; run migrations and deploy backend plus landing.
4. Run the live smoke tests, email-delivery test, moderation incident drill, and
   physical-iPhone universal-link test.
5. Create the App Store Connect record, add its numeric ID to `frontend/eas.json`,
   configure `IOS_APP_STORE_URL`, create a fresh production build from the release
   commit, and upload that build.
6. Complete internal/external TestFlight, the device/accessibility matrix, App
   Privacy, age rating, screenshots, reviewer account, and review notes.
7. Submit. During review, fix only rejection reasons or stopping-rule blockers.
8. Complete the public-launch operations gates, smoke-test the approved build, and
   then announce it.

## Current Automated Evidence

These checks passed on June 9, 2026:

- [x] Backend tests: 31 files, 333 tests.
- [x] Frontend tests: 6 suites, 19 tests.
- [x] Production migration upgrade simulation matches the current Prisma schema.
- [x] Backend TypeScript build.
- [x] Frontend TypeScript check.
- [x] Landing production build.
- [x] Expo iOS production export.
- [x] Phone-sized browser QA covered authentication, onboarding, Home, Explore,
      pod creation/detail/chat, Clubs directory/detail, Inbox, profile, Settings,
      and privacy screens with realistic local data.
- [x] Expo Doctor: 21/21 checks.
- [x] Production dependency audit: zero known vulnerabilities in backend, frontend,
      and landing site.
- [x] Repository release-safety check.
- [x] `git diff --check`.
- [x] Xcode 26.2 is installed, satisfying Apple's current iOS 26 SDK requirement.
- [x] App icon is 1024x1024, RGB, and has no alpha channel.

Passing these checks does not replace TestFlight and production verification.

## App Store Submission Gates

### 1. Freeze the Release

- [ ] Stop adding v1 features. The current product is sufficient for launch.
- [ ] Make one clean release commit and tag after all gates pass.
- [x] Add CI, or a single documented release command, that repeats tests, builds,
      type checks, Expo Doctor, and production dependency audits using Node 22.
- [x] Remove tracked generated/private artifacts: `landing/node_modules`,
      `landing/dist`, tracked `.env` files, and user-uploaded images.
- [x] Update stale setup documentation from Node 18 to Node 22.

### 2. Deploy the Actual Release

The live sites are currently older than the audited code.

- [ ] Deploy the current backend and landing site.
- [ ] Run `prisma migrate deploy` against production before starting the new backend.
- [ ] Verify all production environment variables:
      `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `CRON_SECRET`,
      Resend credentials, `CONTACT_EMAIL`, `ADMIN_REPORTS_URL`,
      `ADMIN_REVIEW_SECRET`, Supabase storage credentials, OpenAI moderation
      credentials, and Apple Team ID.
- [ ] Confirm the Vercel plan supports the five-minute cron. Hobby does not; use
      Pro or an external scheduler.
- [ ] Verify the live health endpoint, registration, verification, login, password
      reset, uploads, push notifications, pod expiry, and reminder cron.
- [ ] Verify `https://www.joinbridgeapp.com/.well-known/apple-app-site-association`
      returns the JSON file, not the landing HTML.
- [ ] Test every universal link from Mail, Messages, and Safari on a physical iPhone.
- [x] Hide dead store links until real listing URLs are configured.
- [ ] Set `IOS_APP_STORE_URL` after the App Store record is created.

### 3. Close Security and Account-Control Gaps

- [x] Never log email verification or password-reset codes in production.
- [x] Generate verification and reset codes with a cryptographic random generator.
- [x] Revoke existing sessions after password reset, account suspension, and ban.
- [x] Add durable abuse throttling for registration, verification, password reset,
      and reports. Per-instance in-memory limits are not sufficient on Vercel.
- [x] Add report deduplication or per-user throttling so one person cannot flood the
      moderation inbox.
- [x] Record the accepted Terms version, acceptance time, and 18+ attestation on the
      server. AsyncStorage-only acceptance is bypassable.

### 4. Make Moderation Enforceable

Filtering, reporting, blocking, contact information, and review links exist. The
missing piece is enforcement.

- [x] Add persistent account suspension/ban state and enforce it in authentication.
- [x] Give the moderator a tested path to remove reported content and suspend or ban
      its author.
- [x] Prevent a banned user from immediately recreating the same account.
- [ ] Test one complete production incident: submit report, receive alert, open
      signed review link, remove content, suspend account, and close the report.
- [ ] Assign a real moderator and enable urgent notifications for the contact inbox.
- [x] Adopt the existing response targets: P0 immediately, P1 within 24 hours, P2
      within 72 hours.

### 5. Make Legal and Privacy Statements Accurate

This is a product-data accuracy pass, followed by one fixed legal review. It is not
an invitation to keep rewriting indefinitely.

- [x] Rewrite the privacy policy to describe only data Bridge actually handles:
      account/profile data, photos and user content, messages, precise meetup
      location, attendance/social interactions, reports, push token, and analytics.
- [x] Name the material processors and purposes: Vercel, Supabase, Resend, Expo Push,
      and OpenAI moderation.
- [x] State accurate retention, deletion, backup, report, and moderation practices.
- [ ] Complete the App Privacy answers so they exactly match the policy and code.
      Do not declare tracking unless Bridge begins cross-company tracking or ads.
- [ ] Test in-app data export and account deletion from the final TestFlight build.
- [x] Fix the waitlist email footer so it cannot imply Ohio State affiliation.
- [x] Use one consistent public support/moderation address across app, site, email,
      policy, and App Store Connect.
- [ ] Have an attorney perform one bounded review of privacy, Terms, meetup
      liability, Ohio State references, and the 18+ design. Resolve the findings once.

### 6. Decide the Seller and Name Once

- [ ] Decide whether the App Store seller may be Brady Van Bibber's legal name.
      If not, create the entity, obtain a D-U-N-S number, and enroll or convert to an
      Apple organization account before release.
- [ ] Perform one trademark and App Store name clearance. "Bridge" is crowded and
      already used by concept-adjacent social/student apps.
- [ ] Keep the name if cleared; otherwise rename before screenshots and public spend.
      Do not repeatedly reopen this decision without new legal evidence.
- [x] Do not use official Ohio State logos or imply university sponsorship.

### 7. Finish Release Branding and Honest Copy

- [x] Replace the default Expo splash image with Bridge artwork.
- [x] Replace the default Vite favicon with the Bridge icon.
- [x] Remove or correct unsupported landing claims: "reliability scores",
      "founding-member status", inconsistent pod capacities, and "50+" activities
      unless the released product supports them.
- [ ] Check every store screenshot and description against the final build.
- [x] Keep the "not affiliated with The Ohio State University" disclaimer visible.

### 8. Test the Shipping App

- [ ] Create a fresh production EAS iOS build using Node 22 and the production
      environment. [Build 21](https://expo.dev/accounts/bradyv/projects/bridge/builds/907b1e74-03db-4f78-8e17-f4ba953473ae)
      completed successfully, but it predates the June 9 product-polish changes and
      is no longer the submission candidate.
- [ ] Run an internal TestFlight pass, then an external TestFlight pass.
- [ ] Test on at least one current iPhone and one smaller/older supported iPhone.
- [x] Either set `supportsTablet` to false for v1 or fully test iPad and provide the
      required iPad screenshots.
- [ ] Complete the manual core-flow matrix:
      register, verify, onboard, browse, create/join/leave pod, group chat, direct
      message, club post, attendance, report, block, password reset, export, delete,
      push notifications, denied permissions, poor network, and relaunch.
- [ ] Run VoiceOver and large Dynamic Type through the core flows; label and fix
      inaccessible icon-only controls.
- [ ] Confirm there are no known P0/P1 crashes, data-loss bugs, security failures,
      or safety failures.

### 9. Complete App Store Connect

- [ ] Create the app record and final bundle/build configuration.
- [ ] Set accurate name, subtitle, description, keywords, category, support URL,
      marketing URL, privacy URL, copyright, and content-rights answers.
- [ ] Set the age rating consistently with Bridge's 18+ Terms and onboarding.
- [ ] Upload accurate iPhone screenshots. Upload 13-inch iPad screenshots only if
      iPad support remains enabled.
- [ ] Complete App Privacy and export-compliance answers.
- [ ] Create a preverified reviewer account with realistic content and full access.
- [ ] In Review Notes, explain the reviewer login, OSU-email verification model,
      permissions, report/block path, account deletion path, and that there are no
      in-app purchases.
- [ ] Keep the production backend and moderator inbox operating throughout review.

## Public Launch Gates

These may happen while Apple review is underway, but must pass before promoting the
app to students.

- [ ] Enable database backups or point-in-time recovery and perform one restore test.
- [ ] Add mobile crash reporting and backend uptime/5xx alerts.
- [x] Verify SPF, DKIM, and DMARC records for the production sender domain.
- [ ] Confirm real inbox delivery of verification and password-reset mail.
- [ ] Confirm storage, email, moderation, push, and hosting quotas/cost alerts.
- [x] Prepare a one-page incident procedure for safety reports, outages, compromised
      accounts, and data requests.
- [ ] Seed enough real upcoming activities, pods, and club participation that a new
      user can get value during launch week.
- [ ] Assign who monitors support, moderation, uptime, and App Store feedback daily
      for the first two weeks.
- [ ] Publish only after the live App Store build passes the smoke test.

## Explicitly Deferred to v1.1

These do not block the first iOS release:

- subscriptions or payments;
- a large admin dashboard;
- recommendation algorithms;
- advanced analytics;
- perfect polish on every secondary empty state;
- web-app support;
- Android release;
- additional social features;
- realtime typing/presence; and
- broad refactors that do not resolve a launch gate.

## Submission Decision

When all submission gates are checked, submit. Do not run another open-ended
"what else could be improved?" audit. During review, fix only rejection reasons or
items covered by the stopping rule. When all public launch gates are checked and the
approved build passes its smoke test, announce the release.

## Official Reference Anchors

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple account deletion requirement](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Apple age-rating guidance](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/)
- [Apple Developer Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)
- [Apple SDK submission requirements](https://developer.apple.com/news/upcoming-requirements/?id=02032026a)
- [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [USPTO trademark clearance guidance](https://www.uspto.gov/trademarks/basics/why-search-similar-trademarks)
