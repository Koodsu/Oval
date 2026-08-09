# Google Play Roadmap — Start to Approval

_Written 2026-07-19. Policy facts verified against Play Console Help + current guides as of this date; re-verify anything time-sensitive before acting on it._

---

## The one decision that shapes everything: account type

**Recommendation: wait for the LLC and register an ORGANIZATION Play developer account.** This solves two problems at once:

| | Personal account | Organization (LLC) account |
|---|---|---|
| 12-tester / 14-day closed test | **Required** (accounts created after Nov 13, 2023) | **Exempt** — go straight to production after verification |
| Developer name shown publicly | Your legal name | The LLC's name |
| Requirements | $25 fee + government ID | $25 fee + D-U-N-S number + org docs + verified website |
| Verification time | Days | D-U-N-S: free, up to 30 days; org verification on top |

You want your name off the app anyway. A personal Play account displays your legal name on the store listing forever (changing account type later means creating a NEW account and transferring the app). The org account kills the 12-tester grind AND the name problem in one move.

**Timeline math:** LLC approval + D-U-N-S (up to 30 days, often ~1-2 weeks) + org verification ≈ similar total time to the personal-account path (12 testers + 14 days + production-access review), but with no tester recruiting and the right long-term account. Only fall back to a personal account + testing community if the LLC stalls badly.

**Do today regardless of path:** apply for the D-U-N-S number the moment the LLC exists (dnb.com, free tier). It's the long pole.

> Same logic applies to Apple: plan to migrate the iOS app to an Apple Developer **organization** membership under the LLC (App Store Connect supports app transfer). Separate project; don't block Android on it.

---

## Phase 0 — Account setup (calendar time, not work)

1. LLC approved → request D-U-N-S number immediately.
2. Create Google Play developer account as **Organization** ($25 one-time). Use an LLC email (e.g. `dev@theovalapp.com`), not the personal/OSU one — the contact email can be shown publicly.
3. Complete verification: D-U-N-S, org documents, website (theovalapp.com — make sure the site footer/contact shows the LLC).
4. Play requires a publicly listed **support email** and, for orgs, address/phone. Set up forwarding addresses under theovalapp.com now.

## Phase 1 — Technical build (do in parallel with Phase 0)

Current repo state: `app.json` uses the Android package (`com.theovalapp.app`), includes adaptive and monochrome notification icons plus App Links intent filters, and the landing deployment proxies `/.well-known/assetlinks.json` to the backend. Android registers separate plan, message, club, discovery, and fallback channels so only time-sensitive plan updates use HIGH importance; backend push (expo-server-sdk) is platform-agnostic. Remaining gaps:

- [x] **Package name check.** The release package is `com.theovalapp.app`; keep `app.json`, `ANDROID_PACKAGE`, Firebase, and the Play listing aligned to it.
- [x] **FCM credentials.** Verified Aug. 9, 2026: `google-services.json` matches `com.theovalapp.app`, `app.json` references it, and the production EAS application identifier has an FCM V1 service-account key assigned.
- [x] **First Android build:** Production AAB builds have completed successfully; an installable notification-QA preview build was queued Aug. 9, 2026.
- [ ] **App Links SHA-256.** After Play App Signing is set up (first upload), copy the app-signing cert SHA-256 from Play Console → set `ANDROID_SHA256_CERT_FINGERPRINT` on the backend and redeploy. Then verify both `https://api.theovalapp.com/.well-known/assetlinks.json` and `https://www.theovalapp.com/.well-known/assetlinks.json` contain the fingerprint.
- [ ] **Target API level.** New apps must target API 35 now, **API 36 (Android 16) from Aug 31, 2026**. Expo SDK 56 should satisfy this — confirm `targetSdkVersion` in the build output; upgrade SDK if not. Don't cut it close to the Aug 31 boundary.
- [ ] **EAS submit config.** Add an `android` block to `eas.json` submit profile: create a Google Cloud service account in Play Console (Setup → API access), download its JSON key, reference as `serviceAccountKeyPath`. First submission must be manual through the Console UI; `eas submit` works after that.
- [ ] **Design QA on Android.** AUDIT_2026 D1 (blur on Android) is still open — Lumen leans on `expo-blur`, which is slow/glitchy on Android. Decide: ship Lumen 2.0's "blur only on chrome" surfaces for Android, or set a no-blur fallback. Also spot-check: predictive back (already disabled), keyboard behavior in chat, edge-to-edge insets, splash on cold start.
- [ ] **Device testing.** Emulator (with Google Play services image, so FCM works) covers most; buy/borrow one cheap physical device before launch for real-world push + camera + deep-link QA.

## Phase 2 — App content declarations (the part that gets apps rejected)

All in Play Console → App content. Must be consistent with each other and with the privacy policy:

- [ ] **Privacy policy URL** — must cover Android, name the LLC as data controller, and match the Data safety form exactly.
- [ ] **Data safety form** — declare: email, name, photos (avatars), messages, coarse location (pods near you), device push token, analytics events, Sentry crash data. Mismatches with observed network traffic are a common suspension cause; be thorough.
- [ ] **Account deletion** — Google requires in-app deletion AND a **web deletion URL** (a page where users can request deletion without reinstalling). The app has in-app deletion (App Store parity); add a simple web form/page on theovalapp.com that hits the same path or emails support.
- [ ] **Content rating (IARC questionnaire)** — answer honestly re: user-generated content, chat, location. Note: Play's rating system differs from Apple's 18+; UGC + chat will likely land Teen/Mature 17+. Answer the UGC section carefully — your block/report/moderation features are exactly what they're checking.
- [ ] **Target audience & content** — declare 18+ target age; do NOT declare appeal to children.
- [ ] **App access** — provide a pre-verified reviewer account (same pattern as `APP_STORE_SUBMISSION.md`: pre-verified, onboarded past the OSU-email gate). Google actually logs in and tests.
- [ ] **Ads declaration** — "no ads."
- [ ] **News/Financial/Health declarations** — all no.

## Phase 3 — Testing tracks

Even on an org account (no mandated closed test), do NOT skip straight to production:

1. **Internal testing** (up to 100 testers, instant updates, no review delay): you + your one Android friend. Shake out FCM, deep links, sign-in.
2. **Closed testing** (optional but smart): club beta. Real feedback + a warm Android install base for launch day.
   - **OSU-email gate problem:** random testers can't get past `requireVerifiedAuth`. If using a testing community (personal-account fallback path), either provision pre-verified test accounts or add a temporary allowlist — otherwise testers stare at a login wall, and Google checks tester engagement when reviewing production-access applications.
3. Promote the tested build to **production**.

If on the personal-account fallback: closed test needs **12 testers opted in for 14 consecutive days**; recruit 16-18 (dropouts reset nothing but lower your count); then apply for production access and answer the questionnaire (how you recruited, feedback received, changes made — keep notes).

## Phase 4 — Store listing & submission

- [ ] Listing: title (30 chars), short description (80), full description (4000), icon 512×512, feature graphic **1024×500** (new asset — doesn't exist for iOS), ≥4 phone screenshots (emulator screenshots fine; reuse iOS marketing framing).
- [ ] Countries: US only (matches the OSU-only reality).
- [ ] Pricing: free.
- [ ] Pre-launch report will auto-run on physical devices — read it; it catches real crashes.
- [ ] Submit for review. Expect **up to ~7 days** for a first-time app; resubmissions after fixes are usually faster.

## Post-approval obligations (recurring)

- Target API level must stay ≤1 year behind the latest Android release (API 36 by Aug 31, 2026 for updates too).
- Data safety form must be updated when data practices change.
- Keep the reviewer account working — Play re-reviews periodically.
- Add Play submission steps to `LAUNCH_CHECKLIST.md` / release process (EAS build → submit covers both stores once configured).

---

## Non-Play pre-launch items surfaced while auditing

- **OPS-1 (STATE doc P0):** confirmed resolved July 7 — external scheduler hits `/cron/maintenance`. No action.
- **D1 blur-on-Android** is now launch-blocking, not cosmetic — see Phase 1.
- **Mass email to club leaders:** sending from the LLC via a real domain address (`brady@theovalapp.com`) with SPF/DKIM/DMARC set up will massively beat a personal address for deliverability; include a physical address + working unsubscribe (CAN-SPAM applies to commercial email). OSU also has policies on bulk email to university addresses — sending individually-addressed, personalized notes in small batches is both more effective and safer than a visible mass blast.
- **iOS name removal:** App Store developer-name change = transfer app to an LLC Apple Developer org account (D-U-N-S needed there too — one more reason to get it now).

## Sources

- [Play Console Help — testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Play Console Help — target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Play Console Help — set up open/closed/internal tests](https://support.google.com/googleplay/android-developer/answer/9845334)
- [Personal vs organization account & the 12-tester rule](https://primetestlab.com/blog/personal-vs-organization-google-play-account-12-testers)
- [Google Play publishing requirements 2026 overview](https://primetestlab.com/blog/google-play-publishing-requirements-2026)
- [Expo — submit to Google Play](https://docs.expo.dev/submit/android/)
