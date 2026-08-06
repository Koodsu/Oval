# Oval Accessibility Audit — August 5, 2026

## Status

The code-level remediation and automated verification are complete for the Expo/React Native app and the public website. Oval now has regression checks for the most common accessibility failures and a public accessibility statement.

This is not a legal certification or a guarantee that no user will encounter a barrier. Accessibility conformance also requires hands-on testing with assistive technologies on release hardware. The real-device checks at the end of this document are required before submitting the release.

## Target

- WCAG 2.2 Level AA, applied to the website and mobile software through relevant WCAG2ICT principles
- Apple accessibility behavior for VoiceOver, Dynamic Type, Reduce Motion, orientation, and control semantics
- Android accessibility behavior for TalkBack, font scaling, control semantics, and touch targets

## Scope Audited

- Shared mobile UI primitives: buttons, slabs/cards, fields, sheets, chips, segmented controls, list rows, banners, progress, loading, avatars, images, and date/time fields
- Mobile navigation and primary flows: authentication, verification, Home, Explore, Pods, pod detail/chat, Inbox/threads, Clubs, profiles, privacy/data controls, and onboarding
- Mobile contrast tokens, motion configuration, orientation support, touch targets, headings, live regions, images, maps, switches, and nested controls
- Public website routes: landing, clubs, privacy, terms, community guidelines, support, accessibility, account deletion, pod invites, and public profiles
- Website keyboard focus, skip navigation, SPA route focus, form labels, custom controls, motion, contrast, landmarks, headings, images, and 320 CSS-pixel reflow

## Material Fixes

- Added accessible names, roles, hints, selected/checked/disabled/busy states, headings, alerts, and live regions across mobile controls.
- Kept disabled/loading controls in the accessibility tree instead of replacing them with non-interactive views.
- Removed nested interactive controls that could hide child actions from VoiceOver or TalkBack.
- Made message and announcement actions available by ordinary assistive-technology activation instead of long-press only.
- Added modal semantics and initial sheet-heading focus.
- Added progress values and loading announcements.
- Marked decorative art, avatars, skeletons, and repeated website mockups as decorative where the same information is already conveyed in text.
- Raised key mobile targets to at least 44 points or provided equivalent hit slop.
- Reworked mobile contrast tokens and added AA contrast regression tests.
- Enabled system Reduce Motion handling for Reanimated and navigation transitions.
- Enabled both portrait and landscape orientation and removed fixed text-container heights that could clip larger text.
- Added a website skip link, visible focus treatment, route focus management, route titles, labeled fields, native category select, form status/error announcements, reduced-motion CSS, and AA contrast safeguards.
- Added a public `/accessibility` statement and accessibility contact path.
- Added permanent `audit:a11y` commands to the release gate for both mobile and website code.

## Verification Evidence

- Mobile static accessibility audit: passed
- Website static accessibility audit: passed
- Backend tests: 35 files, 444 tests passed
- Frontend tests after final remediation: 13 suites, 90 tests passed
- Mobile contrast tests: passed
- Shared UI accessibility regression tests: passed
- TypeScript/backend/website builds: passed
- iOS production export: passed
- Expo Doctor: 21/21 checks passed
- Production dependency audits: 0 vulnerabilities in backend, frontend, and landing packages
- Production migration upgrade path: passed
- Browser semantics across all public routes: no unnamed controls, unlabelled fields, missing image alternatives, duplicate IDs, heading jumps, or landmark failures
- Browser contrast sampling across all dark public routes: no AA failures found
- Browser SPA navigation: focus moved to `main-content`
- Browser reflow at 320 CSS pixels: no horizontal overflow or visible text clipping found
- iPhone 16e simulator at `accessibility-extra-extra-extra-large`: seeded native previews were run for Home, Explore, Pods, Clubs, and Inbox. The first expanded pass exposed real blockers in every primary tab: collapsed Home metrics, single-character Explore headings/cards, an unreadable fixed Pods hero, three-column club cards that truncated names, and squeezed Inbox tabs/banner content. Those layouts now switch to stacked, wrapped, or wider accessibility-size presentations; key content remains readable at 200% scaling and dock chrome is bounded to 120% while retaining complete assistive-technology labels.
- Follow-up largest-text screenshots showed readable primary titles, visible filters/cards/metadata/buttons, section headings, and all five dock labels across the five primary tabs. Content extending below the dock is placed in each screen's scroll container with explicit dock clearance; the required release-device pass below must still confirm every off-screen action is reachable by touch and VoiceOver.
- The existing seeded native preview harness now accepts `EXPO_PUBLIC_UI_PREVIEW_TAB` so all five primary tabs can be reopened directly for future device-size and Dynamic Type regression checks.
- The largest-text simulator pass also exercised Privacy & Data, create pod, create club, terms/age acceptance, direct messaging, edit profile, People search, a public profile, and blocked-user management. It exposed and prompted fixes for collapsed privacy rows, oversized form copy, two-column image controls, unreadable policy copy, narrow message bubbles, overlapping profile actions, truncated People tabs/cards, and compressed moderation rows.
- Follow-up screenshots passed for Privacy & Data, create pod, create club, terms/age acceptance, direct messaging, edit profile, and People search. Shared components now stack settings rows, segmented controls, form controls, headers with right-side actions, and person/action cards when the system font scale reaches an accessibility size.
- Native preview URLs now propagate their mode to child-screen fixture hooks, not just the root navigator. This fixes seeded club-detail/chat/event previews when launched directly from an Expo development URL.
- A final screenshot rerun of the remediated public-profile, blocked-user, and seeded club-detail/chat screens could not be completed after the local simulator tooling hit its usage limit. Their code compiles and the shared checks pass, but they remain explicitly included in the exact-build device gate below; this document does not claim a visual pass for those final states.
- iPhone simulator with Reduce Motion enabled: Oval relaunched successfully with the system preference active; Reanimated and native-stack transitions are configured to follow that preference.

### Re-verification, August 5, 2026 (Linux sandbox)

Re-ran the platform-independent portion of the gate against the working tree to confirm no regression since the original run:

- `frontend/scripts/audit-accessibility.mjs`: passed
- `landing/scripts/audit-accessibility.mjs`: passed
- `frontend` TypeScript (`tsc --noEmit`): passed, no errors
- `frontend` Jest: 13 suites, 90 tests passed (includes `theme.accessibility.test.ts` and `ui.accessibility.test.tsx`)
- `scripts/release-check.mjs`: repository configuration passed

Not re-run, and why — neither is a failure signal:

- `scripts/verify-migrations.mjs` and backend tests require a local Postgres, which the sandbox lacks. The accessibility change set touches only `frontend/`, `landing/`, and `docs/`; no backend or Prisma files are modified.
- `landing` Vite build and `export:ios` require macOS-native toolchain binaries (rollup native module, Xcode). Both must be re-run on the Mac as part of `npm run release:check` immediately before the store build.

## Required Real-iPhone Pass Before Submission

Use the exact release build, not Expo Go. Fix any blocker before uploading.

A printable, checkbox version of this pass — with the four screens that never got a simulator rerun (public profile, blocked users, club detail, club chat) pulled to the front as Priority 0 — is in [`ACCESSIBILITY_DEVICE_PASS_2026-08-05.md`](./ACCESSIBILITY_DEVICE_PASS_2026-08-05.md). Use that sheet to record results; the steps below are the reference.

1. Turn on VoiceOver in Settings → Accessibility → VoiceOver.
2. Starting from a logged-out state, swipe through sign in/sign up, email verification, terms, and onboarding. Confirm the focus order follows the visual order and every control has a useful name and state.
3. Test Home, Explore, Pods, Inbox, and Clubs. Open one card in each, use every header action, and confirm cards with multiple actions expose each action separately.
4. Create or join a pod, open pod details, use chat/reply/reaction actions, and leave or remove a member using a test account.
5. Open a club, RSVP to a meeting, use member/announcement/chat actions, and confirm selected tabs and RSVP choices announce their state.
6. Test the safety-critical paths: report content, block a user, privacy settings, download data, and delete account. Do not complete deletion on a real production account.
7. In Settings → Accessibility → Display & Text Size → Larger Text, enable Larger Accessibility Sizes and test at the largest setting. Confirm text wraps, buttons grow, and no action is covered or unreachable.
8. Rotate the device to landscape on authentication, Home, Explore, pod detail, chat, Clubs, and privacy screens. Confirm all primary actions remain reachable by scrolling.
9. Turn on Reduce Motion and repeat navigation, sheet opening, and animated-feed screens. Confirm no essential information depends on motion.
10. Use Voice Control for a quick pass on visible buttons and fields; duplicate visible labels must still target the intended control.

### Blockers

Do not submit if any core flow has an unnamed control, trapped or skipped focus, a control that cannot be activated, content unavailable at the largest text size, an unreachable action in landscape, a status/error that is never announced, or information conveyed only by color.

## Android Follow-up

Before the first Google Play production release, repeat the same core-flow pass on a physical Android device with TalkBack, the largest font/display size, Remove animations enabled, and both orientations. iOS verification does not substitute for Android assistive-technology testing.

## Legal/Operational Follow-up

- Keep `contactus@theovalapp.com` monitored for accessibility reports and document response/fix dates.
- Re-run `npm run audit:a11y` and the release gate for every release.
- Include accessibility checks when adding a new shared control or major flow.
- For formal legal assurance, retain an accessibility professional and counsel familiar with ADA/state-law obligations; no automated or internal code review can make the company lawsuit-proof.

## Release Note

Build 22 has already been consumed and cannot be reused. `eas.json` sets `appVersionSource: "remote"` with `autoIncrement: true` on the production profile, so EAS assigns the next build number (23) automatically — do not add a local `buildNumber` to `app.json`, it would conflict with the remote source. Run the full `npm run release:check` on the Mac, then build and submit only after the device pass above is clean.
