# Accessibility device pass — required before submission

Companion checklist to `ACCESSIBILITY_AUDIT_2026-08-05.md`. Everything below must be done on a **physical iPhone running the exact release build** (TestFlight or an internal-distribution build — not Expo Go, not the simulator).

Tester: ______________  Device / iOS: ______________  Build: ______________  Date: ______________

---

## Before you start

- [ ] Install the release build on the device and sign out completely.
- [ ] Have a throwaway test account ready for block/report/leave/remove actions.
- [ ] Settings → Accessibility → VoiceOver → **Verbosity → Speak Hints: On** (so missing hints are audible).
- [ ] Reset text size to default before Section A. Section B raises it; Section D lowers it again.

**Stop and file a blocker if you hit any of these:** unnamed control ("button", "image", or a raw filename), focus that traps or skips visible content, a control VoiceOver can focus but not activate, content that becomes unreachable at the largest text size, an action off-screen with no scroll in landscape, a status or error that is never announced, or information carried only by color.

---

## Priority 0 — never got a simulator pass

These four screens were remediated in code but the final visual rerun was cut short. Check them **first**, at the largest accessibility text size, before spending time elsewhere.

- [ ] **Public profile** (another user, via People search) — name/year/bio wrap, action buttons don't overlap, every action separately focusable.
- [ ] **Blocked users** (Privacy & Data → Blocked) — rows stack rather than compress, Unblock reachable and announces its result.
- [ ] **Club detail** — header, tabs, meeting cards, and RSVP controls readable; selected tab announces "selected".
- [ ] **Club chat** — message bubbles wrap, composer and send reachable above the keyboard, new messages announced.

---

## A. VoiceOver pass (default text size)

Swipe right/left through each screen; don't touch-explore. Focus order should follow reading order.

- [ ] **Logged out:** sign in, sign up, email verification, terms/age acceptance, onboarding.
- [ ] **Home** — open one card; use every header action.
- [ ] **Explore** — filters announce selected state; open one result.
- [ ] **Pods** — open pod detail; cards with multiple actions expose each action separately.
- [ ] **Inbox** — open one thread; send a message; confirm it's announced.
- [ ] **Clubs** — open a club; RSVP to a meeting; confirm the RSVP choice announces its new state.
- [ ] **Pod flow:** create or join a pod, open details, use chat / reply / reaction, then leave or remove the test account.
- [ ] **Safety paths:** report content, block a user, privacy settings, request data download, open (do **not** complete) delete account.
- [ ] Loading and empty states announce themselves rather than going silent.

## B. Largest text (Settings → Accessibility → Display & Text Size → Larger Text → Larger Accessibility Sizes → max)

- [ ] The four Priority 0 screens above.
- [ ] All five primary tabs — titles readable, all five dock labels visible.
- [ ] **Tab bar / dock specifically.** Labels now scale to 200% and wrap to two lines at accessibility sizes (changed 2026-08-05, never rendered). Confirm the dock grows to fit, no label truncates, badges don't overlap adjacent tabs, and nothing is clipped at the bottom edge.
- [ ] Pod detail, pod chat, direct messaging.
- [ ] Create pod, create club, edit profile.
- [ ] Privacy & Data, terms/age acceptance, People search.
- [ ] Every screen: text wraps instead of truncating, buttons grow, nothing sits under the dock unreachably (scroll to the bottom of each).

## C. Landscape (rotate with the device unlocked from rotation lock)

- [ ] Authentication
- [ ] Home
- [ ] Explore
- [ ] Pod detail
- [ ] Pod chat
- [ ] Clubs
- [ ] Privacy & Data

All primary actions must stay reachable, by scrolling if necessary.

## D. Reduce Motion (Settings → Accessibility → Motion → Reduce Motion: On)

- [ ] Navigate between tabs and push/pop screens.
- [ ] Open and dismiss sheets and modals.
- [ ] Load the animated feed screens.
- [ ] Confirm no essential information is conveyed only by an animation that is now suppressed.

## E. Voice Control (Settings → Accessibility → Voice Control)

- [ ] Say "Show names" on Home, Explore, and one chat screen.
- [ ] Activate three or four visible buttons and one text field by name.
- [ ] Where a label appears twice on screen, confirm the numbered picker targets the intended control.

---

## Result

- [ ] **Pass — no blockers.** Proceed to build and upload (EAS auto-increments; Build 22 is burned, next upload is 23+).
- [ ] **Blockers found** — list below, fix, rebuild, and rerun at minimum the affected section plus Priority 0.

| # | Screen | What happened | Section | Fixed in |
|---|--------|---------------|---------|----------|
|   |        |               |         |          |
|   |        |               |         |          |
|   |        |               |         |          |

---

## Android

The same core-flow pass is required on a physical Android device with TalkBack, largest font/display size, Remove animations, and both orientations before the first Google Play production release. iOS results do not carry over.
