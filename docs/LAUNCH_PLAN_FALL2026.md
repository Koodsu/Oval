# Oval — Fall 2026 launch plan

**Reset:** Tuesday, August 4, 2026 at 11:00 PM

**Controlled launch:** Wednesday, August 19

**Expansion decision:** Tuesday, August 25

This is the current source of truth from now through launch. Older July/August reset
plans are superseded. The iOS app is already live. Columbus residence-hall move-in is
August 19–22, and autumn classes begin August 25.

Companion docs:

- `CLUB_OUTREACH_2026.md` — send-ready email, variants, follow-up, and tracker
- `LAUNCH_MANUAL_GATES_2026-08-03.md` — deploy, store, device, and production checks
- `onboard-a-club.md` — manual club creation and owner assignment
- `GOOGLE_PLAY_ROADMAP.md` — detailed Play Console work
- `STATE_2026-07-06.md` — product backlog; it does not set pre-launch priority

## The launch we are actually doing

August 19 is a **density-first controlled launch**, not a campus-wide blast. Start
with 3–5 real clubs plus one or two dense student clusters. Those groups announce to
their own members, and Oval has a staffed seven-day calendar before anyone is sent
into it.

August 25 is an expansion decision. Broaden promotion only if the first cohort can
sign up, verify, find real activity, and join without founder rescue. A narrow launch
that works is better than spending the whole-campus first impression on an empty app.

Android is an important parallel lane, but Google approval and the D-U-N-S number do
not block the August 19 iOS launch. If Play is not live, invite Android club leaders
only through a tested internal build; do not promote sideloading campus-wide.

## Launch gates

All **critical** gates must be green by the August 17 rehearsal.

### Critical: people and supply

- [ ] 30 qualified organizations in the outreach tracker; top 10 personalized
- [ ] First five emails sent by 10:00 AM August 5; 5–10 new contacts each weekday
- [ ] 3–5 clubs committed and onboarded with a real officer account
- [ ] Every launch club has at least one real August 19–31 meeting or announcement
- [ ] 2–3 ambassadors committed to host real pods during August 19–25
- [ ] The production board has a rolling seven-day calendar of real pods/meetings
- [ ] Each launch cluster has an agreed announcement channel and owner

### Critical: production and safety

- [ ] Backend and landing deploys include the July 31/August 3 launch work and the
      41-activity catalog migration
- [ ] `npm run release:check` passes under Node 22 immediately before the release build
- [ ] Fresh-account iOS rehearsal passes: signup, OSU verification, onboarding, join,
      create, chat, push/deep link, report/block, data export, and deletion
- [ ] External maintenance scheduler is confirmed live against `/cron/maintenance`
- [ ] Production Sentry receives a readable test exception from a non-production build
- [ ] Support/moderation inbox is watched during launch and response ownership is clear
- [ ] No open crash, data-loss, auth, moderation, push-routing, or empty-supply blocker

### Android/store lane

- [ ] Current `com.theovalapp.app` preview build installed and smoke-tested
- [ ] One physical Android owner verifies photo picking, push delivery/tap routing,
      cold start, and a real `theovalapp.com` link
- [ ] Production AAB built; Play App Signing fingerprint installed in production
      `assetlinks.json`
- [ ] Play Data Safety, App Access, reviewer account, listing, screenshots, and feature
      graphic are complete
- [ ] Submit to Play as soon as organization verification clears
- [ ] If Play is not approved, prepare a tested internal-access link for known testers

### Parallel, not launch blockers

- [ ] Check D-U-N-S status and escalate with D&B on August 5 if still unresolved
- [ ] When D-U-N-S arrives, start Google organization enrollment immediately
- [ ] Apple organization enrollment/app transfer may run in parallel only when it does
      not take time from outreach, onboarding, supply, or rehearsal
- [ ] EIN, bank account, operating agreement, bookkeeping, and billing migration continue
      in bounded admin blocks; none delays August 19

## Tonight — August 4, 11:00 PM to 12:15 AM

The goal tonight is to make tomorrow externally productive. Do not start a feature,
redesign a screen, or enter an open-ended testing session.

### Required

1. **11:00–11:20 — finalize outreach.** Read the primary email and signature in
   `CLUB_OUTREACH_2026.md`, replace the availability placeholders with two real
   15-minute windows, and send a test to yourself. Keep the pitch centered on
   year-round club discovery; operational tools are supporting proof.
2. **11:20–11:50 — create the first batch.** Open the official OSU student-org
   directory, add the first 10 qualified clubs to the tracker, and write one genuine
   personalization sentence for the top five. Favor active social, recreation,
   hobby, creative, service, and cultural groups with visible meetings or recent posts.
3. **11:50–12:05 — queue tomorrow's five.** Prepare five individually addressed
   drafts. Schedule them between 9:00 and 10:00 AM Wednesday; do not send a bulk BCC.
4. **12:05–12:15 — remove the external uncertainty.** Search email for the D-U-N-S
   response and write one status line at the top of tomorrow's note: `received`,
   `pending—contact D&B`, or `blocked by missing information`. Also record whether a
   current Android preview build exists. Stop after this status check.

### Only if the required block is finished early

- Reply to or schedule one message to a warm club contact. A warm introduction is
  worth more than another hour of product polish.
- Put the August 17 rehearsal and August 19–25 launch watch blocks on the calendar.

### Tonight's definition of done

- One tested, send-ready email
- Ten prospects recorded
- Five personalized drafts scheduled for Wednesday morning
- D-U-N-S and Android-build status written down
- Laptop closed by 12:15 AM

## Daily operating rhythm, August 5–18

Until launch, every weekday starts with external motion before code:

1. Send or follow up with 5–10 individually addressed club contacts.
2. Update every response in the tracker and offer two concrete setup times.
3. Do the day's launch-critical build/test/onboarding block.
4. End by confirming tomorrow's first external action.

No response after 72 hours gets one follow-up. No response after seven days gets one
final close-the-loop note, then the contact is archived. Do not repeatedly chase.

## Calendar

### Wednesday, August 5 — first external motion

- Send the first five emails by 10:00 AM; send five more only if they are personalized.
- Contact D&B if the D-U-N-S request is still pending; learn the actual status and any
  expedite option instead of continuing to wait passively.
- Verify the deployed deletion page, API association route, and 41-activity catalog.
- Trigger/install the current Android preview build if one does not already exist.
- Do a 60–90 minute Android/iOS blocker pass; log issues, fix only launch blockers.

### August 6–7 — make the funnel and build real

- Send 5–10 new emails per day; answer positive replies the same day.
- Book the first club setups for August 7–11.
- Finish the Android emulator tour and obtain a real-device tester commitment.
- Complete reviewer credentials, Data Safety draft, store copy, screenshots, and the
  Play feature graphic.
- Freeze a production-candidate build after blocker fixes. Run release checks.
- By Friday night: 20+ contacts sent, at least two conversations started, all store
  content ready to paste/upload.

### August 8–10 — convert interest, finish store submission inputs

- Follow up with Wednesday's nonresponders after 72 hours and continue new outreach.
- Run the first club setups. The officer creates an account, receives OWNER access,
  and posts a real meeting before the call ends.
- Produce the Android AAB and complete physical-device checks.
- If Google organization verification is available, upload to internal testing,
  configure the signing fingerprint, verify App Links, and submit immediately.
- By August 10: at least two club onboarding calls completed or firmly booked.

### August 11–14 — secure the launch cohort

- Reach 3–5 committed clubs and 2–3 ambassadors. Stop counting vague interest;
  commitment means a named owner, an announcement channel, and a dated activity.
- Onboard every club with a real officer account and real August 19–31 content.
- Decide the one or two initial clusters; do not market broadly across campus.
- Test the invite/share path those clusters will use.
- By August 14: the launch cohort, announcement owners, and first events are visible
  in one tracker.

### August 15–17 — manufacture liquidity and rehearse

- Set `SEED_AMBASSADOR_EMAILS` and run the idempotent launch seeder only for verified,
  real ambassador accounts. No fake student personas.
- Confirm at least seven days of upcoming supply; remove stale or unstaffed items.
- Capture the analytics baseline and verify access to Sentry and support channels.
- Prepare one launch-day response note covering login/verification, reports, and bugs.
- **August 17:** rehearse with a brand-new account on current physical iOS and Android
  paths. A new user must find at least three relevant, joinable pods/meetings and join
  one without founder intervention.

### August 18 — prime the clusters

- Onboarded clubs announce to their own GroupMes, Discords, or Instagram stories.
- Ambassadors confirm the next 72 hours of plans.
- Recheck production, notifications, analytics, support inbox, and public links.
- Make no non-blocker code changes.

### August 19–22 — controlled launch during move-in

- Launch only into the selected clubs/clusters.
- Check signup/verification errors, Sentry, support, activation, and supply morning,
  mid-afternoon, and evening.
- Personally respond to launch-cluster issues; log repeated friction before changing
  the product.
- Keep the next three days stocked with real activity. Do not use fake engagement.

### August 23–24 — involvement-fair amplification, stabilize, and decide

- The official Student Involvement Fair is Sunday, August 23 from 4:00–7:00 PM on
  the Oval and South Oval. Ask launch partners that already have booths to include
  their own Oval club link/QR or mention their Oval page if event rules permit. Do
  not assume Oval has permission to table or distribute independently.
- Have every partner link and QR tested before the fair; watch support and signup
  verification during and immediately after it.
- Fix only confirmed blockers and restock real upcoming supply.
- Review the first cohort: verified signups, 24/72-hour activation, joins/creates,
  messages, notification delivery, and qualitative club feedback.
- Ask each launch club whether it will make a second announcement or event.

### Tuesday, August 25 — expand or hold

Expand beyond the initial clusters only if all are true:

- no unresolved launch-blocking crash, auth, verification, safety, or routing issue;
- a new user can still see at least three relevant upcoming items;
- at least three launch partners have live content and two will continue posting;
- the first cohort is joining/creating rather than only installing;
- support volume is manageable.

If any gate is red, hold the launch narrow for one more week. That is a controlled
rollout decision, not a failed launch.

## Explicitly deferred until after launch

- New growth features, club redesigns, or general polish not tied to a reproduced
  blocker
- Apple publisher-name transfer if it competes with the launch-critical path
- Insurance research, perfect bookkeeping, or full billing migration
- Campus-wide posters/QR distribution before the controlled cohort proves the loop
- Any public Android sideload campaign

## Official dates and directory

- OSU Columbus move-in: August 19–22, 2026 —
  https://housing.osu.edu/articles/move-in-2026/
- Autumn classes begin: August 25, 2026 —
  https://registrar.osu.edu/academic-calendar/academic-calendar-5-year-view-2023-2028/
- Official student-organization directory —
  https://activities.osu.edu/involvement/student_organizations/find_a_student_org
- Autumn Student Involvement Fair: August 23, 4:00–7:00 PM —
  https://activities.osu.edu/involvement/student-organizations/student-involvement-fairs/
