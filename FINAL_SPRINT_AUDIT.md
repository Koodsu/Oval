# Bridge Final Sprint Audit

> Historical audit only. For the current release decision, use
> `PUBLIC_RELEASE_GATE.md`.

Prepared: 2026-06-01  
Branch audited: `build19TouchUp`  
Scope: product idea, mobile app screens, landing/legal pages, backend risks, launch readiness, and platform/legal next steps.

This is not legal advice. Treat the legal section as a checklist for counsel/review before public distribution.

## Executive Verdict

Bridge is a good idea with a real wedge: verified campus students, small activity pods, and club momentum are more specific and useful than another generic "make friends" app. The strongest promise is not "social network for college"; it is "open Bridge and find something you can actually show up to today with people who are supposed to be there."

The app is close enough for the summer friend test plan, then a targeted club outreach push before August. I would still avoid a broad public App Store launch until the operational items below are finished, but the original P0 code blockers from this audit have now been addressed in the current sprint.

The design is cohesive and memorable. The mobile app feels much more complete than most MVPs. The risk is that it now contains several products at once: pods, clubs, DMs, officer tooling, attendance, reports, roles, reminders, recaps, and launch marketing. For the first launch, the mental model should be narrowed to:

1. See what is happening.
2. Join or create a small pod.
3. Convert good meetups into friends.
4. Let clubs seed reliable activity.

## Sprint Implementation Update

Completed after this audit:

- P0 1: backend app surfaces now require verified university auth, while `/users/me`, verification, and public preview routes remain reachable where needed.
- P0 2: pod chat now exposes report/block actions for non-self messages.
- P0 3: Node is pinned to 22 via `.nvmrc`, `.node-version`, and package `engines`.
- P0 4: root `npm test` is green with an ephemeral local Postgres fallback for backend tests.
- P0 5: landing hero mobile clipping is fixed and the guidelines route was visually checked locally.

Launch plan assumed now: test privately with friends this summer, then reach out to 500+ clubs and aim for roughly 50 onboarded clubs before August classes start.

Still needs founder decision:

- Frontend audit: remaining moderate vulnerabilities are tied to Expo transitive dependencies and require a breaking `expo@56` force upgrade.

## P0 Launch Blockers

### 1. Verified OSU Access Is Bypassable

Registration sends the verification email best-effort, then immediately returns a 7 day JWT:

- `backend/src/routes/auth.ts:173`
- `backend/src/routes/auth.ts:179`
- `backend/src/routes/auth.ts:183`

`requireAuth` only validates the JWT payload:

- `backend/src/middleware/auth.ts:9`
- `backend/src/middleware/auth.ts:20`
- `backend/src/middleware/auth.ts:22`

The mobile app does gate unverified users in `frontend/App.tsx:141`, but API clients can still call authenticated routes directly. Since Bridge's positioning depends on verified university access, this is the most important pre-launch fix.

Recommendation:

- Add `requireVerifiedUser` middleware that loads the user and checks `verifiedUniversity`.
- Apply it to pods, messages, clubs, friends, search, reports, notifications, and direct messages.
- Leave only auth verification endpoints, `/users/me`, resend/verify, waitlist, public pod/club invite read endpoints, and health endpoints outside the verified gate.
- Add tests proving an unverified token cannot create/join pods, send messages, search users, join clubs, or DM.

### 2. Pod Chat Lacks In-App Report/Block UI

The backend can create reports for pod messages:

- `backend/src/routes/reports.ts:12`
- `backend/src/services/reportService.ts:68`
- `backend/src/services/reportService.ts:84`

DMs have report/block actions:

- `frontend/src/screens/ThreadScreen.tsx:103`
- `frontend/src/screens/ThreadScreen.tsx:111`
- `frontend/src/screens/ThreadScreen.tsx:126`

Club messages and announcements also expose reporting:

- `frontend/src/screens/ClubDetailScreen.tsx:491`
- `frontend/src/screens/ClubDetailScreen.tsx:1640`

Pod chat, however, only offers reply and heart in the visible message UI:

- `frontend/src/screens/PodDetailScreen.tsx:448`
- `frontend/src/screens/PodDetailScreen.tsx:462`

Apple and Google both treat this as UGC/social functionality. Apple Guideline 1.2 says UGC/social apps need filtering, reporting, blocking, and contact info. Google Play's UGC policy similarly requires terms/user policy acceptance, objectionable-content rules, moderation, and report/block systems.

Recommendation:

- Add a safety action to every non-self pod chat message: report message, report user, block user.
- Reuse the direct-message action sheet pattern.
- Make sure blocking affects pods, DMs, user search, invites, and club interactions consistently.
- Add a visible support/contact path in-app.

Official references:

- Apple App Review Guidelines, UGC: https://developer.apple.com/app-store/review/guidelines/
- Google Play UGC policy: https://support.google.com/googleplay/android-developer/answer/9876937

### 3. Expo Web QA Is Blocked On Current Node

`frontend/package.json:11` runs:

```json
"web": "expo start --web --port 8081"
```

On Node `v24.12.0`, `npm run web --prefix frontend` crashes before rendering:

```text
RangeError [ERR_SOCKET_BAD_PORT]: options.port should be >= 0 and < 65536. Received type number (65536)
```

This blocks browser-based screen QA for the mobile app. The frontend tests and TypeScript pass, but you still need an on-device/simulator pass before shipping.

Recommendation:

- Add a pinned runtime file, probably `.nvmrc`, with Node LTS.
- Use that runtime for local, CI, EAS build hooks, and docs.
- Re-run Expo web or device simulator QA after pinning.

### 4. Root Test Command Fails Before Backend Specs

`npm test` runs backend then frontend:

- `package.json:5`

The backend global setup resets the DB with Prisma:

- `backend/src/test/setup.ts:37`
- `backend/src/test/setup.ts:44`

In this audit run, the root test command failed during backend setup before specs ran. Frontend tests pass independently, and backend TypeScript builds, but the default test command is currently not a green pre-ship signal on this machine.

Recommendation:

- Make `TEST_DATABASE_URL` setup explicit in `TESTING.md`.
- Consider a Docker/local Postgres test helper or a SQLite-only test mode if compatible.
- CI should fail loudly when `TEST_DATABASE_URL` points at anything unsafe.

### 5. Landing Mobile Hero Clips

The landing hero looks strong on desktop, but at a 390px mobile viewport the phrase `WATCHING CAMPUS.` overflows/clips horizontally. The culprit is the large no-wrap block:

- `landing/src/components/Hero.jsx:82`
- `landing/src/components/Hero.jsx:95`
- `landing/src/components/Hero.jsx:103`

Recommendation:

- On mobile, split the phrase into two lines or use a smaller mobile clamp for that line only.
- Re-check `/clubs`, which uses similar hero sizing.
- Keep the attitude, but do not let the first viewport look broken on the device most students will use.

## P1 Before Public Launch

### Security And Infra

- CSP is disabled globally in `backend/src/server.ts:30` through `backend/src/server.ts:35`. Rework the pod invite inline JSON into fetch or a nonce-based script and re-enable a strict CSP.
- Avatar uploads use local disk storage in `backend/src/routes/users.ts:31` through `backend/src/routes/users.ts:62`, with a Vercel read-only filesystem comment at `backend/src/routes/users.ts:37`. In production, profile photos can fail or disappear. Move user avatars to the same durable object storage pattern clubs use.
- `GET /users/blocked` is shadowed by `GET /users/:id`, because the dynamic route appears first:
  - `backend/src/routes/users.ts:521`
  - `backend/src/routes/users.ts:573`
  Move `/blocked` above `/:id`.
- `npm audit --omit=dev --audit-level=moderate` found production vulnerabilities in backend and frontend. Backend includes high-risk advisories around `express-rate-limit` and Express 4/path matching. Frontend has several transitive advisories, some tied to Expo upgrade paths. Landing production audit was clean.
- There is no pinned Node version. Add `.nvmrc`/`.node-version` and document it.

### Product Consistency

- Landing activity and pod-count claims now align with the backend: `2-10` person pods and 50 seeded activities. Keep this consistency any time seed data or backend pod limits change.
- Activity pod creation copy says typed custom locations are fine, but backend rejects custom typed locations without coordinates:
  - `frontend/src/screens/ActivityPodsScreen.tsx:167`
  - `frontend/src/screens/ActivityPodsScreen.tsx:177`
  - `backend/src/routes/pods.ts:456`
  - `backend/src/routes/pods.ts:463`
  Either make the map pin required for custom locations or provide allowed location choices in the UI.
- Edit Profile allows selecting unlimited interests:
  - `frontend/src/screens/EditProfileScreen.tsx:25`
  - `frontend/src/screens/EditProfileScreen.tsx:120`
  Backend rejects more than 5:
  - `backend/src/routes/users.ts:214`
  Add the same cap UI used in registration.
- Profile has delete account in the same button stack as edit/find/sign out:
  - `frontend/src/screens/ProfileScreen.tsx:115`
  - `frontend/src/screens/ProfileScreen.tsx:119`
  Move it into a separate destructive/account section with Privacy, Terms, Support, and Blocked Users.
- The frontend has a `getBlockedUsers` API helper at `frontend/src/api.ts:897`, but no obvious profile/settings surface to use it.

### Moderation Ops

Bridge has backend admin report endpoints:

- `backend/src/routes/adminReports.ts:9`
- `backend/src/routes/adminReports.ts:11`
- `backend/src/routes/adminReports.ts:29`

But there is no obvious admin review UI in the frontend. For a private cohort, a backend-only flow may be enough, but define the real operating procedure:

- Who receives report notifications?
- What is the response SLA?
- How are urgent safety issues escalated?
- How are users warned, suspended, or removed?
- Where is the public contact address shown?

## Screen-By-Screen Product And Design Notes

### Auth

Strong brand entry. The registration form asks for enough social signal to make the app work, and the age confirmation is useful. The main weakness is friction: it is a long single-scroll form before the user has felt the product. Also, there is no obvious Terms/Privacy acceptance near account creation.

Recommendations:

- Add Terms and Privacy links near account creation.
- Add a real password reset flow; "email support" is not enough for launch.
- Keep the social signal fields, but consider deferring clubs/interests until after verification if conversion is weak.

### Verify Email

Clear and focused. This screen supports the trust promise. Make it feel slightly more app-like with paste/autofill handling, resend countdown, and clearer "wrong email?" recovery.

Most important: the backend must enforce the same gate, not just this screen.

### Home

The home screen is a good daily cockpit: today's pods, club pulse, people/friends, and a profile path. It feels like the right first tab for a returning user.

Risk: if the map area has few markers or is not interactive, it may read as decorative. Empty states need to push the user into one clear action: join something today or create a pod.

### Explore

Probably the strongest screen. Activity cards clearly communicate the app's core behavior and are easier to understand than the bigger "social app" pitch.

Recommendation: make this the emotional center of launch. Students should understand Bridge from this screen alone.

### Pods

The Pods screen feels rich and useful. "Starting soon", "friends in pods", and "more open pods" are good categories, but multiple horizontal carousels can become heavy on a low-liquidity app.

Recommendation: during launch, bias toward one high-confidence list with "Today" and "Near friends" filters instead of showing many sparse lanes.

### Activity Pods

Powerful but complex. It combines creation, timing, map pinning, typed location, open pods, and nearby pins. This is where the user will decide whether Bridge feels easy or too much.

Recommendations:

- Fix the typed-location/backend mismatch.
- Make "start with default location" easier.
- Add clear validation before submit instead of letting the backend surprise the user.
- Keep the map, but ensure it earns its space by showing real pods or selected pin state.

### Pod Detail

This is one of the best parts of the app. It feels like coordination, not just browsing. Chat, share, privacy, attendance, no-show reporting, recap, and people-you-met all support the core promise.

Recommendations:

- Add report/block to pod chat messages.
- Consider collapsing details by default once the user is in the pod; chat and meetup status should dominate.
- Watch nested scroll behavior on small phones.
- Make completed pod recap the retention hook: "you met these people, add them."

### Clubs

The directory looks polished and gives Bridge a supply-side story. Clubs are smart because they create repeatable activity and launch credibility.

Risk: if only one club is featured and the rest are horizontal, the directory may feel smaller than it is.

Recommendations:

- Add a clearer "register/start your club" path in-app, not just on landing.
- Let users search/filter clubs quickly.
- Use clubs as seeded activity engines, not as a second app that competes with pods.

### Club Detail

This is technically impressive. It has roles, officer messages, announcements, meetings, RSVP, attendance, outreach, analytics, member management, and permissions. That is a lot.

For officers, it is valuable. For normal members, it risks feeling like enterprise software inside a student app.

Recommendations:

- Split member view and officer view more aggressively.
- Put advanced controls behind an "Officer tools" panel.
- On the default member view, prioritize next meeting, announcements, join/leave, chat, and who is going.
- Treat attendance/role/outreach tooling as launch-support features for founding club leaders, not the main student story.

### Inbox

Clear utility. It includes DMs and safety affordances. The "Find people" and "Profile/settings" actions are helpful, though they slightly pull attention away from the inbox itself.

Recommendation: keep this simple. DMs are retention glue, not the headline.

### Thread

Usable DM screen with report/block. Polling is fine for MVP, but it will feel less alive than real-time chat.

Recommendations:

- Add auto-scroll/read-position polish.
- Consider optimistic send and better message delivery feedback.
- Keep report/block discoverable.

### Profile

Good personal hub. Clubs, friends, notifications, and edit profile all belong here.

Recommendations:

- Add Privacy, Terms, Support, Community Guidelines, and Blocked Users.
- Move Delete Account into a separate destructive section.
- Explain notification preferences in plainer labels if users are confused.

### Edit Profile

Clean and useful. The interest cap mismatch is the main bug. Also consider whether Instagram should be clearly optional and how visible it is to non-friends.

### User Profile

The trust stats are useful, especially reliability and mutual context. But reliability can be over-interpreted when sample size is tiny.

Recommendations:

- Show reliability only after enough completed pods, or label it as "new" with context.
- Keep report/block visible but not so dominant that every profile feels risky.

### User Search

Functional, but one of the thinner screens visually. Search is useful after pods, not as a cold-start discovery product.

Recommendations:

- Add recent people from pods.
- Add friend suggestions based on shared clubs or attended pods.
- Add clearer loading and empty states.

### Club Meetings Tonight

Simple and useful. Good for launch-day club seeding. Keep it.

### Landing Home

Desktop visual identity is strong: bold, memorable, and campus-specific. The mobile hero clipping is the biggest visual flaw. The first viewport is also very tall, so the conversion form is lower than ideal.

Recommendations:

- Fix mobile hero line wrapping.
- Align claims around max pod size and activity count.
- Keep CTA visible earlier on mobile.
- Keep the OSU-specific angle but add non-affiliation/legal clarity.

### Landing Clubs Page

Strong pitch for club officers. It communicates a real pain: clubs need attendance, meetings, announcements, and momentum.

Recommendations:

- Make the first viewport show a hint of the registration section sooner.
- Avoid overpromising analytics until production data exists.
- Add "not affiliated with OSU" language if using Ohio State marks/name in a way that could imply endorsement.

### Privacy And Terms Pages

They exist, which is good. They read as early-stage policies, not final app launch policies.

Issues to review:

- Privacy needs to fully reflect university email, profile data, location/pin data, user content, reports, push tokens, club attendance, DMs, analytics if added, and third-party processors.
- Terms should cover the mobile app, not just the site/waitlist.
- Terms should include community rules, UGC license/removal, moderation, account suspension, safety disclaimers, age rules, no emergency use, and non-affiliation.
- In-app links to Privacy and Terms need to be easy to find.

Official references:

- Apple privacy policy requirements: https://developer.apple.com/app-store/review/guidelines/
- Apple privacy labels/data use overview: https://developer.apple.com/app-store/user-privacy-and-data-use/
- Google Play Data safety form: https://support.google.com/googleplay/android-developer/answer/10787469

### Pod Invite Page

The `/pod/test-pod` fallback is fine: it eventually shows a plain "Pod not found" state. This is acceptable, but the invite page should be tested with real pods before launch because it is part of the viral loop.

## Legal And Platform Checklist

### App Store / Google Play

Bridge has UGC: pod chat, club chat, officer chat, announcements, profiles, DMs, club pages, and reports. Before app review, make sure the submitted build has:

- In-app report content/user flows for every UGC surface.
- In-app block user flow for DMs and other user interactions.
- Objectionable content policy in Terms/Community Guidelines.
- User acceptance of Terms before posting UGC.
- Published support/contact info.
- Moderation workflow and response process.
- Privacy policy link in app and store metadata.
- Account deletion in-app. Bridge has this flow, but the policy and deletion semantics need review.

Apple references:

- UGC/social apps need moderation, reporting, blocking, and contact info: https://developer.apple.com/app-store/review/guidelines/
- Privacy policy must describe collection, use, third-party sharing, retention/deletion, and revoking consent: https://developer.apple.com/app-store/review/guidelines/

Google references:

- Google UGC policy requires terms/user policy acceptance, prohibited content definitions, moderation, and report/block systems: https://support.google.com/googleplay/android-developer/answer/9876937
- Data safety disclosures are required for Play listings outside internal-only testing and must include third-party SDK collection/sharing: https://support.google.com/googleplay/android-developer/answer/10787469

### OSU Name / Brand / Trademark

Bridge uses OSU/Ohio State as the launch context. That is probably necessary for the product, but be careful not to imply official university endorsement.

Ohio State Trademark & Licensing says the university licensing office regulates use of the university's name and identifying marks on products/services, promotions, sponsorships, and advertising; it also provides license and single-use request paths.

Recommendation:

- Do not use official logos, Buckeye leaf, block O, Brutus, or official branding unless licensed.
- Add a clear "not affiliated with, sponsored by, or endorsed by The Ohio State University" statement.
- Consider counsel review of "OSU-only", "Ohio State launch", and similar claims before public ads.
- If you want official student-org/club partnerships using university marks, contact OSU Trademark & Licensing.

Official OSU reference:

- https://trademarklicensing.osu.edu/

### Testimonials, Ambassadors, And Incentives

If ambassadors, friends, or paid/incentivized students post about Bridge, disclose the relationship. FTC guidance says endorsements influenced by payment, gifts, free access, or material relationships need clear disclosure when that connection would affect how people evaluate the endorsement.

Official FTC reference:

- https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking

### Policy Artifacts To Create

Minimum launch set:

- Privacy Policy
- Terms of Service
- Community Guidelines
- Safety/Reporting page
- Data deletion request process
- Support email and abuse/moderation email
- OSU non-affiliation statement
- App Store privacy labels
- Google Play Data safety form
- App Review demo account/review notes

## Launch Strategy

Do not launch broad first. Launch dense.

### Best First Cohort

- 20-50 founding students who will actually show up.
- 5-10 founding clubs that agree to post meetings and invite members.
- A handful of predictable pods every day for the first 2 weeks.
- At least one person manually watching reports/support.

### Launch Promise

Use this simpler story:

"Bridge shows you what OSU students are doing today, lets you join a small verified pod, and helps you keep up with the people and clubs you actually meet."

Avoid leading with the full feature list. It makes the product sound bigger but less sharp.

### First 7 Days

Day 0:

- Fix P0 security/safety/runtime issues.
- Seed founding clubs and activities.
- Create app review demo account and sample data.

Day 1-2:

- TestFlight/internal test with 10 trusted users.
- Verify auth, email, pod join/create, chat, reports, block, delete account, push permissions, and deep links.

Day 3-5:

- Private OSU cohort.
- Manually seed 3-5 pods per day.
- Personally DM/ask users what made them hesitate.
- Watch empty states more than happy paths.

Day 6-7:

- Fix activation blockers.
- Submit stores or expand TestFlight based on retention and report volume.

### Metrics That Matter

Activation:

- Registered users who verify email.
- Verified users who view an activity.
- Verified users who join or create a pod within 24 hours.

Liquidity:

- Pods created per day.
- Pods reaching minimum size.
- Time from pod creation to first join.
- No-show rate.

Retention:

- Users returning within 3 days.
- Users joining a second pod.
- People-you-met friend conversions.
- Club meeting RSVP/attendance.

Safety:

- Reports per active user.
- Time to first moderation response.
- Blocks per active user.
- Repeat offenders.

## Verification Run

Passed:

- `npm run test --prefix frontend -- --runInBand` passed: 4 suites, 20 tests.
- `npm run build --prefix backend` passed.
- `npm run build --prefix landing` passed.
- `npx tsc --noEmit` in `frontend` passed.
- Landing pages loaded locally in the in-app browser: `/`, `/clubs`, `/privacy`, `/terms`, `/pod/test-pod`.

Failed or blocked:

- `npm test` failed during backend Vitest global setup before backend specs ran because Prisma `migrate reset --force` exited nonzero against the local test database setup.
- `npm run web --prefix frontend` crashed on Node `v24.12.0` with the Expo/freeport bad port error.
- Production dependency audits found backend/frontend vulnerabilities needing triage.

Browser visual findings:

- Desktop landing home looks polished and memorable.
- Mobile landing home clips the main hero text.
- Clubs landing is visually strong but conversion content is low in the first viewport.
- Privacy/Terms pages exist but need readability and legal completeness review.
- Missing pod invite IDs show a plain but acceptable not-found state.

## Recommended Final Sprint Order

1. Add verified-user middleware and tests.
2. Add pod chat report/block UI.
3. Fix `/users/blocked` route ordering and expose Blocked Users in Profile.
4. Pin Node LTS and restore Expo web/device QA.
5. Fix landing mobile hero clipping and claim mismatches.
6. Move user avatars to durable storage.
7. Re-enable CSP after removing inline invite script dependency.
8. Resolve/test dependency audit items, especially backend production issues.
9. Finalize Privacy, Terms, Community Guidelines, support/contact, and non-affiliation language.
10. Run device/simulator QA with seeded production-like data.
11. Launch to a controlled founding cohort before public store push.

## Bottom Line

Bridge is not a throwaway side project anymore. The bones are real: the pod concept is concrete, the club layer can create supply, and the design has a point of view. The thing to protect now is trust. If a student believes "everyone here is verified, reportable, blockable, and actually trying to show up," Bridge has a shot. If that trust claim leaks, the product gets much harder.

Fix the trust/safety gates, tighten the first-run story, seed supply manually, and ship to a small OSU cohort before going wide.
