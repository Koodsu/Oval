# Oval — Master Launch Plan (July 21 → Fall Semester 2026)

Every known task from today to school launch, with dependencies and order. OSU autumn semester starts ~Aug 25; move-in/welcome week ~Aug 19–24. That's ~5 weeks. Companion docs: `GOOGLE_PLAY_ROADMAP.md` (Play detail), `STATE_2026-07-06.md` (product backlog), `onboard-a-club.md` (club flow).

## August 2 reset — this section overrides the older sequence below

Assumption from Brady on August 2: none of the external/business/testing/outreach
sessions below have been completed. The iOS app is already live. D-U-N-S is still
pending. Columbus move-in begins August 19 and classes begin August 25.

### Strategy change

- **Do not wait for the Apple organization transfer to start outreach.** The live
  iOS listing is enough for club conversations; moving the publisher name to the
  LLC is now post-launch unless D-U-N-S and Apple verification clear unusually fast.
- **Keep Google Play organization enrollment as the preferred Android path.** If
  D-U-N-S arrives, create the Google organization account that same day and submit
  as quickly as verification allows.
- **Prepare an APK by August 7 as a contingency, not the public launch channel.**
  Share it only with known Android club leaders/testers via a direct EAS install
  link. Sideloading has security-warning/install friction and does not help iPhone
  users. Public campus QR codes should lead to the live iOS listing plus a clearly
  labeled Android early-access option until Play is live.
  A successful July 20 preview APK proves the pipeline works, but its EAS artifact
  expires August 3 and predates current changes, so it is not the launch binary.
- **Launch density-first.** August 19 is a soft launch through 3–5 onboarded clubs
  and one or two dense student clusters. Expand around August 25 only if the board
  has real upcoming activity and the first cohort is activating.
- **No new product features before launch.** Only crash/data-loss/auth/moderation,
  broken onboarding, broken push/deep links, and empty-launch-supply fixes qualify.

### Remaining calendar buffer

| Workstream | Latest safe date | Buffer on Aug 2 | Status |
|---|---:|---:|---|
| Club list + first personalized outreach | **Aug 3** | ~1 day | Start now |
| Android preview APK installed and fully smoke-tested | **Aug 7** | 5 days | Tight |
| Play production submission, if org account clears | **Aug 10–12** | 8–10 days | Very tight |
| 3–5 clubs committed with real first meetings | **Aug 15** | 13 days | Tight |
| Launch content seeded + links/QRs rehearsed | **Aug 17** | 15 days | Tight |
| Density-first soft launch | **Aug 19** | 17 days | Fixed |
| First-day-of-classes expansion | **Aug 25** | 23 days | Conditional |

### Revised execution schedule

**Sunday Aug 2 — recovery day (4–6 focused hours)**

1. Check D-U-N-S email/status and collect the exact LLC/D&B details in one note.
2. Trigger the existing `preview` Android EAS build; it is configured for internal
   distribution and should produce an installable APK.
3. While it builds, create the first 30-club prospect list and write the outreach
   email. Rank the top 10 by social/recreation fit and recent activity.
4. Verify the deployed web account-deletion flow and create the pre-verified
   reviewer account. Do not assume either is ready because the code exists.

**Monday Aug 3 — first external motion**

1. Send 5–10 personalized club emails from the OSU/domain address. Offer a
   15-minute setup where Brady does the work. Do not mention a mass campus launch;
   pitch founding-club access and a live iOS app with Android early access.
2. Install the APK on an Android Studio emulator using a Google Play system image.
   Run the complete light/dark, signup, join, chat, push, deep-link, report/block,
   account deletion, and data-export tour. Camera/library behavior can be exercised
   with emulator media, but real hardware remains a later confidence check.
3. Draft Play Data Safety, store copy, reviewer instructions, and feature graphic.

**Tuesday Aug 4 — hard D-U-N-S decision**

1. If the number has not arrived, contact D&B and pay for expedited processing if
   that option is available for this request. Do not keep passively waiting.
2. Fix only launch-blocking Android issues from the Aug 3 test.
3. Send the second personalized club batch and book onboarding calls for Aug 5–11.

**Aug 5–7 — freeze the installable build**

1. Rebuild and re-test after blocker fixes; produce the final APK fallback by Aug 7.
2. Finish Play listing/compliance assets so account-verification day is paste/upload,
   not writing from scratch.
3. Follow up with the first club batch after 48–72 hours; send 5–10 new contacts/day.
4. Recruit one Android-owning friend or club leader to install the same APK remotely
   by Aug 10 and check real-device camera/library, notification delivery, cold-start
   notification routing, and a web invite link. Buying a device is not required.

**Aug 8–12 — store deadline and club conversions**

1. When D-U-N-S arrives, open the Google organization account immediately. Apple
   enrollment may run in parallel but cannot consume launch-critical hours.
2. When Google verification clears: upload the AAB to internal testing, verify Play
   signing/deep links, then submit production immediately. Target Aug 10; Aug 12 is
   the revised hard ceiling for a plausible welcome-week approval.
3. Complete at least three live club onboardings. Each officer must post one real
   Aug 19–31 meeting/event before the onboarding call ends.

**Aug 13–17 — manufacture launch liquidity**

1. Reach 3–5 committed clubs, 2–3 student ambassadors, and a seven-day calendar of
   real activity. Seed only real officer/ambassador-hosted plans—no fake personas.
2. Finalize QR destination, install instructions, invite links, analytics baseline,
   Sentry access, moderation response, and launch-day support message.
3. Run a complete launch rehearsal on Aug 17 using a new account and both platforms
   available at that time.

**Aug 18–25 — controlled launch**

1. Aug 18: onboarded clubs announce to their own GroupMes/Instagram stories first.
2. Aug 19–22: soft-launch into those dense clusters during move-in; monitor crashes,
   signup verification, activation, and whether users see at least three joinable
   options. Personally respond to every club/user issue.
3. Aug 23–24: fix only blockers and reseed real upcoming supply.
4. Aug 25: expand promotion only if the initial cohort has real activity. Otherwise
   keep the launch narrow for another week rather than burn the campus-wide first
   impression.

**Deadline math (work backwards from Aug 24):**
- Play review ≈ up to 7 days + fix buffer → **production submission by ~Aug 10**
- Play org verification ≈ days–2 weeks after D-U-N-S → account created the day the number arrives
- Apple org enrollment + app transfer ≈ 1–2 weeks total → also starts the day D-U-N-S arrives
- Club outreach starts Aug 3 using the already-live iOS app; publisher-name transfer no longer blocks it
- **D-U-N-S is the fuse for everything above.** Requested July 21. If not arrived by ~Aug 4, pay for expedited — that's the decision date, not now.

Legend: ⏳ waiting on external party · 🔒 blocked by listed item · ✅ done

---

## Track A — Business / legal / financial

| # | Task | Depends on | Effort |
|---|---|---|---|
| A1 | EIN: retry online (name exactly "VAN BIBBER"); if rejected again, SS-4 fax to 855-641-6935 (~4 business days) | — | 10 min (or fax + wait) |
| A2 | Business bank account (Mercury/Relay or local; needs EIN + Articles) | 🔒 A1 | 30 min |
| A3 | Single-member operating agreement (banks may ask; strengthens liability shield) | — | 30 min (draftable now) |
| A4 | Move all app billing to LLC card/account: Apple $99, Expo/EAS, Vercel, Supabase, domain registrar, Google Play $25 when created | 🔒 A2 | 1 hr |
| A5 | D-U-N-S number ⏳ (requested 7/21 via Google flow; check status ~weekly; expedite decision Aug 4) | — | waiting |
| A6 | Deploy landing LLC changes (privacy/terms/footer already edited — commit + push) | — | 10 min |
| A7 | Simple bookkeeping: spreadsheet or Wave; log the $99/filing fees/subscriptions as expenses | 🔒 A2 | 30 min once |
| A8 | (Optional, post-launch) general liability insurance quote — app organizes IRL meetups; worth a quote, not a launch blocker | — | later |

Ohio has no annual LLC report — no recurring state paperwork. CAT tax irrelevant until multi-million revenue.

## Track B — Apple: get your name off the App Store

| # | Task | Depends on | Effort |
|---|---|---|---|
| B1 | Enroll LLC in Apple Developer Program as **Organization** (needs D-U-N-S, legal name, website, phone; Apple may verification-call) | 🔒 A5 | 30 min + ⏳ days–2 wks |
| B2 | Transfer the Oval app from personal account → org account (App Store Connect → App → Transfer; both sides accept) | 🔒 B1 | 30 min + ⏳ ~days |
| B3 | Verify listing shows "Oval Technologies LLC"; update `eas.json` submit config (new team ID/ASC IDs); confirm push certs/keys survived transfer (APNs key must be re-created under org account — test push after transfer!) | 🔒 B2 | 1–2 hrs |
| B4 | Keep personal membership until transfer completes, then decide whether to let it lapse | 🔒 B2 | — |

⚠️ Transfer gotchas to check before initiating: no builds in review, agreements accepted on both accounts, and the app must be removed from any TestFlight external groups. Push tokens keep working during transfer but the APNs auth key belongs to the old account — plan a push test immediately after (B3).

## Track C — Google Play account & submission

| # | Task | Depends on | Effort |
|---|---|---|---|
| C1 | Create Play developer account as **Organization** ($25, LLC email, D-U-N-S) | 🔒 A5 | 30 min |
| C2 | Org verification (D-U-N-S record match, docs, website showing LLC, support email) | 🔒 C1, A6 | ⏳ days–2 wks |
| C3 | Play Console app setup: store listing, all App-content declarations (data safety, IARC content rating, target audience 18+, App access reviewer creds, no-ads) — drafts from E3/E4/E5 | 🔒 C2, E3–E5 | 2 hrs |
| C4 | Play Console → API access → service account for `eas submit`; add android block to eas.json submit config | 🔒 C1 | 30 min |
| C5 | Upload first .aab to **internal testing**; install via Play on emulator/device; smoke test | 🔒 C2, C4, D7 | 1 hr |
| C6 | Set `ANDROID_SHA256_CERT_FINGERPRINT` from the Play App Signing cert so assetlinks.json verifies on both API and landing hosts; redeploy backend; test Android deep links | 🔒 C5 | 30 min |
| C7 | (Optional) closed-testing track with club members / your Android friend for a week | 🔒 C5 | ongoing |
| C8 | **Production submission by ~Aug 10** | 🔒 C5 (C7 optional), E1 | 30 min + ⏳ ~7 days review |
| C9 | Post-approval: staged rollout → 100%; add Play steps to release checklist; ANDROID_STORE_URL env for invite pages | 🔒 C8 | 30 min |

## Track D — Android app readiness (all unblocked NOW)

| # | Task | Depends on | Effort |
|---|---|---|---|
| D1 | Install latest preview build; verify: dark-mode stat tints solid, dock clipping gone, single Home empty state | — (build done) | 30 min |
| D2 | Full punch-list tour: dark+light, chat keyboard, sheets, avatar upload/camera, DMs, clubs, maps, recap flow | — | 2 hrs |
| D3 | Fix punch-list items found in D2 (unknown scope — budget a few evenings) | 🔒 D2 | ~unknown |
| D4 | Push end-to-end test on Android emulator (Google Play image): message push, tap → deep link routing, badge | — | 1 hr |
| D5 | Confirm build's targetSdkVersion ≥ 35 now, and plan for 36 (Aug 31 rule — check Expo SDK 56 default; if 36 needed, `expo install --check` / SDK bump BEFORE C8) | — | 30 min to verify |
| D6 | (Recommended) cheap physical Android device; real-device pass incl. camera + push | — | $100–150 + 1 hr |
| D7 | Production .aab: `eas build -p android --profile production` | 🔒 D3 | 30 min |

## Track E — Play compliance & store content (all unblocked NOW)

| # | Task | Depends on | Effort |
|---|---|---|---|
| E1 | **Web account-deletion page** on theovalapp.com (Play hard requirement; backend delete path exists) | — | 2–3 hrs |
| E2 | Privacy policy: confirm it covers Android/push/Play (LLC name ✅ done 7/20) | — | 30 min |
| E3 | Data Safety form draft: enumerate collected data from codebase (email, name, photos, messages, coarse location, push token, analytics, Sentry crash logs) | — | 1 hr |
| E4 | Store listing assets: title/short/full description, 512² icon, **1024×500 feature graphic** (new asset), ≥4 screenshots (emulator OK) | — | 2–3 hrs |
| E5 | Reviewer test account: pre-verified, past OSU gate, terms accepted, in a club + pod (mirror APP_STORE_SUBMISSION.md pattern) | — | 30 min |

## Track F — Club outreach & campus launch

| # | Task | Depends on | Effort |
|---|---|---|---|
| F1 | Build club-leader list: OSU student org directory → name, org, category, email (spreadsheet; prioritize 30–50 active social/rec/hobby orgs) | — | 2–3 hrs |
| F2 | Outreach email: personalized template + 2 variants; from OSU address; small batches (deliverability + OSU bulk-mail policy) | — | 1 hr |
| F3 | Polish `onboard-a-club.md` into a repeatable 15-min flow (officer signup → club claim → first meeting posted) | — | 1–2 hrs |
| F4 | **Send outreach in batches** (~5–10/day, personalized) | 🔒 F1, F2 | ~30 min/day |
| F5 | Pre-onboard 3–5 clubs with real officers before semester (audit E1 calls this a launch blocker, not a nicety) | 🔒 F4 | ongoing |
| F6 | Seed week-one content: ambassador pods + near-future pods so day-1 boards aren't empty | 🔒 F5 | welcome week |
| F7 | Welcome-week presence: QR posters/flyers, club fair if accessible, ask onboarded clubs to announce | 🔒 F5 | Aug 19–25 |
| F8 | Android install path for clubs: Play listing live (C8/C9) or closed-test opt-in links (C7) as fallback | 🔒 C8 or C7 | — |

## Track G — Product backlog worth shipping pre-launch (not blockers)

From `STATE_2026-07-06.md` ranked backlog — do these in gaps while waiting on external parties:

| # | Task | Why |
|---|---|---|
| G1 | Invite loop instrumentation + post-create/post-recap share prompts (E4) | Highest-leverage growth item still open |
| G2 | Seed near-future pods in prod for launch week + post-verify onboarding check (E1) | Empty first session kills activation |
| G3 | Recap → next-plan chaining (E5) | Retention |
| G4 | Theme flash on cold start (L8); `expireOldPods` throttle (L6) | Polish |
| G5 | Reconcile or delete LAUNCH_CHECKLIST.md; add dual-store release steps (OPS-4) | Housekeeping before a second launch |

## Housekeeping (continuous)

- Commit + push everything after each session; CI green (backend web.test.ts expectation updated 7/20 — verify CI passed).
- `npx expo-doctor` clean (patch bumps pending via `expo install --check`).
- Keep D&B, IRS, bank, Google, Apple correspondence in one folder; every form uses: OVAL TECHNOLOGIES LLC / 10058 Cartgate Ct, Dublin, OH 43017 / contactus@theovalapp.com / your cell.

---

## The order (first → last)

**This week (July 21–27) — nothing here waits on D-U-N-S:**
1. A1 EIN retry → A3 operating agreement → A6 push landing changes
2. D1 verify build → D2 punch-list tour → D4 push test → D5 target-API check
3. E1 deletion page → E3 data safety draft → E5 reviewer account → E4 store assets
4. F1 club list → F2 email draft → F3 onboarding flow
5. A2 bank + A4 billing migration (as soon as EIN lands)

**Week of July 28–Aug 3 (still waiting on D-U-N-S):**
6. D3 fix punch-list items → D6 physical device pass → D7 production build ready
7. G1/G2 growth items in remaining gaps

**The day D-U-N-S arrives (~Aug 1–8, hopefully):**
8. B1 Apple org enrollment AND C1 Play org account — same day, they verify in parallel
9. C4 service account while verification runs

**When verifications clear:**
10. B2 app transfer → B3 verify name + push test → **F4 club outreach begins**
11. C3 console setup (paste E3–E5 drafts) → C5 internal upload → C6 assetlinks → C7 optional club beta
12. **C8 production submission (target: Aug 10, hard ceiling: ~Aug 15)**

**Welcome week (Aug 19–25):**
13. F5–F7 club onboarding, seeding, campus presence; C9 rollout; monitor Sentry + analytics

**If D-U-N-S hasn't arrived by Aug 4: pay for expedited that day.**
