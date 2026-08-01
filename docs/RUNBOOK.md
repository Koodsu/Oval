# Oval — Do-This-Next Runbook

No decisions required. Work top to bottom. Each session is one sitting; each step says exactly what to type or click. Check things off as you go.

Companion docs: `LAUNCH_PLAN_FALL2026.md` (the why/dependencies), `GOOGLE_PLAY_ROADMAP.md` (Play detail).

**The only rule:** anything marked ⏳ WAITING is out of your hands — never sit and think about it, just do the next unblocked session.

---

# SESSION 1 — Ship the deletion flow (~30 min)

Code is written but uncommitted. This finishes it.

**1.1 Run the backend tests** (sandbox can't reach your test DB; you can)

```
cd ~/Documents/Code/Personal/Oval/backend
npm test -- web.test.ts
```

Expect the new "Web account deletion flow" block to pass (10 tests). If a test errors with a DB connection message, start your test Postgres first, then rerun.

**1.2 Run the full backend suite once**

```
npm test
```

**1.3 Build the landing site** (I couldn't verify this in the sandbox — rollup needs your local machine)

```
cd ../landing
npm run build
```

If it fails with a rollup/native module error: `rm -rf node_modules package-lock.json && npm install`, then rebuild.

**1.4 Preview the page locally**

```
npm run dev
```

Open http://localhost:5173/delete-account — check it renders, submit your own email, confirm you get "if an account exists…" message.

**1.5 Commit and push everything**

```
cd ..
git add -A
git commit -m "Add web account deletion flow, Lumen 2.0 solid surfaces, Android package rename"
git push
```

**1.6 Verify deploys** — Vercel auto-deploys both. After ~2 min:
- https://theovalapp.com/delete-account loads
- https://api.theovalapp.com/.well-known/assetlinks.json shows `com.theovalapp.app`

**1.7 End-to-end test the real thing** — create a throwaway account in the app (any OSU email you can receive at), then request deletion from the web page, click the email link, confirm. Verify the account is gone by trying to sign in.

> If the email never arrives: check `RESEND_API_KEY` is set in the Vercel backend env, and check Resend's dashboard logs.

✅ Done → Play's account-deletion requirement is satisfied.

---

# SESSION 2 — EIN (~15 min, weekday 7am–10pm ET only)

**2.1** Go to https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online → "Apply Online Now"

**2.2** Answers, in order:
- Legal structure: **Limited Liability Company (LLC)**
- Members: **1** · State: **Ohio**
- Reason: **Started a new business**
- Responsible party: your name **exactly as on your Social Security card**. Last time it failed — most likely cause is the last-name format. Your Ohio certificate reads `BRADY VAN BIBBER`. Try **Van Bibber** (with space) first; if rejected, retry the whole form with **VanBibber** (no space).
- Your SSN
- Role: **I am one of the owners, members, or the managing member of this LLC**
- Business name: **OVAL TECHNOLOGIES LLC** · Address: **10058 Cartgate Ct, Dublin, OH 43017** · Start date: **July 2026**
- What does the business do: **Other** → "Software / mobile application publishing"

**2.3** At the end choose **Receive letter online** and DOWNLOAD THE PDF IMMEDIATELY. Save as `~/Documents/Oval-Business/EIN-CP575.pdf`. You cannot get this screen back.

**2.4 If it fails again** with "unable to provide you with an EIN":
1. Download https://www.irs.gov/pub/irs-pdf/fss4.pdf
2. Tell me and I'll fill it out for you — or fill it yourself: line 1 = OVAL TECHNOLOGIES LLC, 4a/b = your address, 7a = your name + SSN, 8a = Yes (LLC), 8b = 1, 8c = Yes, 9a = check "Other" → "Single-member LLC (disregarded entity)", 10 = Started new business, 11 = 07/16/2026, 16 = Other → software publishing, 18 = No. Sign at the bottom.
3. Fax to **855-641-6935**, include your fax number for the reply (use an online fax service — HelloFax/FaxZero free tiers work). Reply comes in ~4 business days.

---

# SESSION 3 — Verify the Android build (~45 min)

**3.1 Rebuild with the fixes**

```
cd ~/Documents/Code/Personal/Oval/frontend
eas build --platform android --profile preview
```

Wait ~20 min. While it builds, do step 3.2.

**3.2 Boot the emulator** — Android Studio → More Actions → Virtual Device Manager → ▶ next to Pixel 10. Leave it running.

**3.3 Install**

```
eas build:run -p android --latest
```

**3.4 Verify the three fixes I made** (open the app, sign in):
- [ ] Profile screen, **dark mode** (Settings → Appearance → Dark): the 5 stat cards should be clean solid color blocks — no muddy inner rectangle
- [ ] Home screen: scroll to the very bottom — no content hidden behind the floating dock
- [ ] Home screen with an empty board: exactly ONE empty state ("Nothing on the board"), no second "feed is quiet" block, no row of zeros

**3.5 The punch-list tour** — open a note, walk every screen in both light and dark, write down anything that looks wrong. Cover: Explore, create a pod (all fields incl. date/time picker), pod detail, pod chat (**type a message — does the keyboard cover the input?**), Clubs, club detail, Inbox, DMs, user search, profile edit + **avatar upload from camera and library**, settings, the map strip, recap flow.

**3.6 Push notification test:**
1. In the app: allow notifications when prompted
2. Background the app (home button, don't kill it)
3. From another account (your phone, or a second emulator), send a DM to the Android account
4. Notification should appear → tap it → should open the right thread
5. Now force-kill the Android app and repeat — cold-start deep link is the one that usually breaks

**3.7** Send me the punch list and I'll fix them.

---

# SESSION 4 — Operating agreement + business admin (~45 min)

**4.1** Ask me to draft the operating agreement (I'll write it to `docs/business/`). Print, sign, date, scan → save with your other docs. No filing needed; it lives in your records.

**4.2 Bank account** (needs EIN from Session 2):
- Recommended: **Mercury** (mercury.com) — free, built for startups, ~15 min online
- Have ready: EIN letter PDF, Articles of Organization PDF, your ID, the LLC address
- Alternative if you want a branch: Chase/Huntington business checking

**4.3 Move billing to the LLC card** — log into each and swap the payment method:
- [ ] Apple Developer ($99/yr)
- [ ] Expo/EAS
- [ ] Vercel
- [ ] Supabase
- [ ] Domain registrar (theovalapp.com)
- [ ] Resend
- [ ] Sentry

**4.4 Start an expense log** — a spreadsheet is fine: date, vendor, amount, category. Backfill the LLC filing fee ($99), Apple ($99), and any subscriptions you've already paid.

---

# SESSION 5 — Play Console prep work (~2 hrs, no account needed yet)

Everything here gets pasted into Play Console later. Do it now so submission day is fast.

**5.1 Reviewer test account:**
1. Register a new account in the app with an OSU email you control (e.g. `oval.review@osu.edu` style — or reuse the App Store reviewer account)
2. In the DB (Supabase SQL editor), set it verified: `UPDATE "User" SET "verifiedUniversity" = true WHERE email = '...';`
3. In the app as that user: accept terms, complete onboarding, join a club, join a pod (so a reviewer sees a populated app)
4. Write the credentials into `APP_STORE_SUBMISSION.md` alongside the Apple ones

**5.2 Data Safety answers** — ask me to generate the draft from the codebase; I'll write `docs/PLAY_DATA_SAFETY.md` with every question pre-answered. (Collected: email, name, profile photo, messages, coarse location, push token, analytics events, Sentry crash data.)

**5.3 Store listing text** — ask me to draft:
- Title (30 char max)
- Short description (80 char)
- Full description (4000 char)

**5.4 Feature graphic** — 1024×500 PNG, no transparency. You don't have one (iOS doesn't use it). Options: make it in Figma/Canva with the Oval logo on the gradient backdrop, or ask me and I'll generate one.

**5.5 Screenshots** — with the emulator running, navigate to each screen and press the camera icon in the emulator sidebar (saves to Desktop). Get at least 4: Home with pods, Explore, a pod detail, Clubs. Do them in **light mode** — it photographs better.

**5.6 Privacy policy check** — reread https://theovalapp.com/privacy for anything iOS-specific that should say "mobile apps"; tell me and I'll edit.

---

# SESSION 6 — Club outreach prep (~3 hrs, do before the name changes)

**6.1 Build the list:**
1. Go to OSU's student org directory (Involved Living / involvedliving.osu.edu)
2. Filter to social, recreation, hobby, cultural, and club-sport orgs — skip academic honoraries and pre-professional societies (worse fit)
3. Make a spreadsheet: Org Name · Category · President/Contact Name · Email · Size (if listed) · Notes
4. Target 40–60 rows. This is grunt work; put on a podcast.

**6.2 Rank them** — mark your top 10 "must land" orgs: mid-size (20–80 members), social/recreational, active posting. Those get the most personalized emails.

**6.3 Email template** — ask me to draft it. Structure that works: 1 line who you are (OSU student), 1 line what Oval does, 1 line what's in it for their club, 1 specific ask (15-min setup, you do the work), link. Under 120 words.

**6.4 Rehearse the onboarding flow** — open `docs/onboard-a-club.md`, run through it yourself with a fake club. Time it. If it's over 15 minutes or has a confusing step, tell me and I'll fix the flow or the docs.

**6.5** ⏳ Do NOT send yet — wait for the App Store name change (Session 9).

---

# SESSION 7 — Fix the punch list (~however long it takes)

Send me the Session 3.7 list. I fix, you rebuild and re-verify:

```
cd ~/Documents/Code/Personal/Oval/frontend
eas build --platform android --profile development
```

(Use the **development** profile this time — install it once and after that JS changes hot-reload via `npx expo start`, no more 20-min rebuilds.)

---

# ⏳ WAITING — D-U-N-S number

Requested July 21. Check email weekly. Decision date: **if it hasn't arrived by Aug 4, pay for expedited that day.**

Everything below is blocked until it arrives. Nothing above is.

---

# SESSION 8 — The day D-U-N-S arrives (~1 hr, then waiting)

Do both of these the same day; they verify in parallel.

**8.1 Apple organization enrollment:**
1. https://developer.apple.com/programs/enroll/ → sign in with a **new Apple ID** for the business (not your personal one — this becomes the org account holder)
2. Choose **Organization** (not Individual)
3. Enter: OVAL TECHNOLOGIES LLC, D-U-N-S number, https://theovalapp.com, your phone
4. Pay $99. Apple may phone you to verify — answer it.

**8.2 Google Play organization account:**
1. https://play.google.com/console/signup → sign in with a **Google account on your domain or a dedicated one** (not your OSU account)
2. Account type: **Organization**
3. Enter the same LLC details + D-U-N-S + website + contactus@theovalapp.com
4. Pay $25
5. Upload ID/docs when prompted

**8.3** Then wait. Both verifications take days to ~2 weeks.

---

# SESSION 9 — When Apple verification clears (~1 hr + waiting)

**9.1 Pre-transfer checklist** (App Store Connect, personal account):
- [ ] No build currently in review
- [ ] App removed from any external TestFlight groups
- [ ] Both accounts have accepted all agreements (Business → Agreements)

**9.2 Transfer:** App Store Connect → your app → App Information → scroll to **Additional Information** → **Transfer App** → enter the org account's Apple ID → follow prompts. The receiving account then accepts under Users & Access.

**9.3 After transfer completes:**
1. Verify the App Store listing shows **Oval Technologies LLC**
2. Create a NEW APNs auth key under the org account (Certificates, IDs & Profiles → Keys → + → Apple Push Notifications service) and upload it: `cd frontend && eas credentials` → iOS → production → Push Key
3. Update `frontend/eas.json` submit config with the new `appleId`, `appleTeamId`, `ascAppId` — tell me the values and I'll edit
4. **Test an iOS push immediately.** This is the step that silently breaks.

**9.4 → Club outreach begins (Session 6 emails).** Send ~10/day, personalized.

---

# SESSION 10 — When Play verification clears (~3 hrs)

**10.1 Create the app:** Play Console → Create app → Name "Oval", English (US), App, Free.

**10.2 Store listing** — paste the Session 5.3 text, upload icon (512×512), feature graphic (1024×500), screenshots.

**10.3 App content** (left sidebar, work top to bottom):
- Privacy policy: `https://theovalapp.com/privacy`
- App access: reviewer credentials from 5.1 + note "Requires verified OSU email; use provided pre-verified account"
- Ads: No
- Content rating: fill the IARC questionnaire — answer YES to user-generated content and user interaction, describe the block/report/moderation tools
- Target audience: 18+
- Data safety: paste from `docs/PLAY_DATA_SAFETY.md`; **account deletion URL = https://theovalapp.com/delete-account**
- News/Health/Financial: No to all

**10.4 Service account for eas submit:** Play Console → Setup → API access → Create service account → follow to Google Cloud → create key (JSON) → download → back in Play Console grant it Release permissions. Save the JSON outside the repo, then tell me and I'll wire it into `eas.json`.

**10.5 Production build + internal test upload:**

```
cd ~/Documents/Code/Personal/Oval/frontend
eas build --platform android --profile production
```

Upload the .aab to **Testing → Internal testing** → create release → add yourself as a tester → install via the opt-in link on the emulator. Smoke test.

**10.6 App Links:** Play Console → Setup → App signing → copy the **SHA-256 certificate fingerprint** → set `ANDROID_SHA256_CERT_FINGERPRINT` in the Vercel backend env → redeploy → verify https://api.theovalapp.com/.well-known/assetlinks.json shows it → test a `theovalapp.com/pod/...` link on Android opens the app.

**10.7 Promote to production** — Production → Create release → same .aab → rollout. Review takes up to ~7 days.

**Target date for 10.7: August 10.**

---

# SESSION 11 — Welcome week (Aug 19–25)

- [ ] Onboard your committed clubs (3–5 minimum) — officers post their first meetings
- [ ] Seed pods for the first week so day-one boards aren't empty
- [ ] QR posters/flyers; ask onboarded clubs to announce in their GroupMes
- [ ] Watch Sentry daily for crashes
- [ ] Watch `GET /analytics/summary` for activation rate

---

# Reference card — paste these exactly

```
Legal name:  OVAL TECHNOLOGIES LLC
Address:     10058 Cartgate Ct, Dublin, OH 43017
Formed:      07/16/2026 (Ohio)
Email:       contactus@theovalapp.com
Website:     https://theovalapp.com
Android pkg: com.theovalapp.app
iOS bundle:  com.bradyvb.ovalapp  (unchanged — do not touch)
Deletion:    https://theovalapp.com/delete-account
```

# If you only have 20 minutes

Do Session 1 (ship the deletion flow). It's the highest-value blocker and it's already written.

# If you have a full evening

Session 1 → Session 3 (build + verify + punch list). That gets Android from "unknown" to "known."
