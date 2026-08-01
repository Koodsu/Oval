# Oval — Master Launch Plan (July 21 → Fall Semester 2026)

Every known task from today to school launch, with dependencies and order. OSU autumn semester starts ~Aug 25; move-in/welcome week ~Aug 19–24. That's ~5 weeks. Companion docs: `GOOGLE_PLAY_ROADMAP.md` (Play detail), `STATE_2026-07-06.md` (product backlog), `onboard-a-club.md` (club flow).

**Deadline math (work backwards from Aug 24):**
- Play review ≈ up to 7 days + fix buffer → **production submission by ~Aug 10**
- Play org verification ≈ days–2 weeks after D-U-N-S → account created the day the number arrives
- Apple org enrollment + app transfer ≈ 1–2 weeks total → also starts the day D-U-N-S arrives
- Club outreach needs the App Store name changed (Apple transfer done) → realistically ~Aug 5–15 window, batched
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
| C6 | Set `ANDROID_SHA256` env from Play App Signing cert (Play Console → App signing) so assetlinks.json verifies; redeploy backend; test Android deep links | 🔒 C5 | 30 min |
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
| F4 | **Send outreach in batches** (~10/day, personalized) | 🔒 B3 (name off App Store), F1, F2 | ~30 min/day |
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
