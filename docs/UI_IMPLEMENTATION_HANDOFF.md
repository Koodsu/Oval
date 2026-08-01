# Oval reference-driven UI implementation handoff

Copy the prompt below into a **fresh Codex task** rooted at the Oval repository.
Attach or explicitly point the task to the relevant reference board for the
screen family being implemented.

Use one screen family per task after the shared design foundation is stable.

---

## Copy-paste prompt

You are performing a reference-driven reconstruction of the Oval React Native
frontend.

This is not a restyle of the existing UI. The approved mockups and written
specification are the source of truth for visual hierarchy, screen composition,
content density, component anatomy, spacing, imagery, and information priority.

### Required context

Read these files completely before making changes:

- `AGENTS.md`
- `docs/STATE_2026-07-06.md`
- `docs/UI_IMPLEMENTATION_HANDOFF.md`
- `frontend/assets/illustrations/README.md`
- the applicable frontend guidance files
- the current screen source only for behavior and data contracts

Inspect the applicable reference images directly with image-viewing tools:

- `docs/design-mockups-2026/01-core-tabs-campus-pulse.png`
- `docs/design-mockups-2026/02-pods-messaging-profiles.png`
- `docs/design-mockups-2026/03-clubs.png`
- `docs/design-mockups-2026/04-onboarding-profile-settings.png`
- `docs/design-mockups-2026/05-empty-states.png`
- `docs/design-mockups-2026/06-dark-mode.png`
- `docs/design-mockups-2026/07-creation-profile-privacy.png`
- `docs/design-mockups-2026/08-cold-start-zero-supply.png`
- `docs/design-mockups-2026/09-cold-start-1-to-9-spotlight.png`
- `docs/design-mockups-2026/10-cold-start-10-to-99-community.png`
- `docs/design-mockups-2026/11-pods-density-ladder.png`
- `docs/design-mockups-2026/12-clubs-density-ladder.png`
- `docs/design-mockups-2026/13-inbox-density-ladder.png`
- `docs/design-mockups-2026/14-spot-illustration-contact-sheet.png`

The contact sheet is a review/reference board only. Import the individual
transparent assets listed below, never the contact sheet itself.

Approved compact production illustrations live under:

- `frontend/assets/illustrations/spot/onboarding/`
- `frontend/assets/illustrations/spot/cold-start/`
- `frontend/assets/illustrations/spot/invites/`

Subtle atmosphere textures live under:

- `frontend/assets/illustrations/runtime/ambient/`

Read `frontend/assets/illustrations/README.md` for the exact state-to-asset
mapping. For people-based empty states, onboarding, and invitation prompts,
import the transparent `spot/**` PNGs—not the older full-scene JPEGs. Never
import a `-source.png` chroma-key file, the high-resolution scene masters, or the
character reference sheet into production UI.

Before writing JSX, inspect every spot illustration selected for this screen
family with an image-viewing tool. Record the exact filename beside the state it
serves. Do not redraw, regenerate, approximate, or substitute the illustration
based on whatever happens to be visible in the current app.

### Priority order

When sources disagree, use this priority:

1. Product safety, moderation, privacy, and business invariants
2. This handoff and the illustration manifest
3. Approved visual reference images
4. Existing API, navigation, type, analytics, and deep-link contracts
5. Existing JSX hierarchy and styling

The current rendered UI is not a design reference. Do not take a screenshot of
the current app and ask a model or agent to “improve” it. Reconstruct from the
approved boards, state rules, and named assets in this handoff.

Inspect existing source to preserve business logic and data flow. Do not preserve
its layout, card hierarchy, styling, or component boundaries merely because they
already exist. Existing JSX and styles are disposable when they conflict with
the approved references.

### Before coding

1. Inventory the selected screen family’s current API calls, navigation params,
   mutations, analytics, permissions, accessibility behavior, loading states,
   error states, and safety actions.
2. Map every visible reference element to real available data.
3. Identify missing backend data explicitly. Do not fabricate production data.
4. List the reference board and exact phone/screen that controls each state.
5. Propose the reusable primitives required for the selected family.
6. State which existing components will be retained, replaced, or deleted.
7. Present a concise plan before implementation.

### Design foundation

Recreate Campus Pulse as a coherent system:

- Warm neutral light background, solid white content surfaces, near-black ink,
  vivid Oval scarlet, and selective category tints.
- Deep warm charcoal dark mode with elevated solid surfaces and accessible
  scarlet accents.
- Blur only for floating chrome such as the dock and sheets.
- Strong, compact information hierarchy with faces, real social proof, urgency,
  capacity, time, and clear actions.
- No decorative whitespace that displaces useful content.
- No generic empty-state component stretched across unrelated situations.
- No fictional characters used as real avatars, members, attendees, messages,
  or engagement proof.

Use the approved fictional people illustrations only as editorial imagery in
onboarding, empty states, and invitation prompts.

These people illustrations are compact transparent **spot vignettes**, not
full-bleed scenes. Render them with `resizeMode="contain"`, preserve their aspect
ratio, and keep the entire silhouette visible. At a `390`-point viewport they
should usually occupy roughly `160–230` points of height above or alongside live
headline/body/action content. Never crop them into card photography, stretch
them, place copy inside the bitmap, or use them as activity thumbnails.

### Required illustration mapping

Use these exact assets when the corresponding state exists:

- Home, zero relevant supply:
  `frontend/assets/illustrations/spot/cold-start/01-home-zero-start-network.png`
- Explore, zero relevant supply:
  `frontend/assets/illustrations/spot/cold-start/02-explore-first-move.png`
- My Pods, global supply zero:
  `frontend/assets/illustrations/spot/cold-start/03-pods-first-plan.png`
- Clubs, discoverable verified supply zero:
  `frontend/assets/illustrations/spot/cold-start/04-clubs-bring-groups.png`
- Inbox, no network and no personal threads:
  `frontend/assets/illustrations/spot/cold-start/05-inbox-connections.png`
- Relevant supply `1–9`:
  `frontend/assets/illustrations/spot/cold-start/06-low-supply-spotlight.png`
- Search/filter has no exact matches:
  `frontend/assets/illustrations/spot/cold-start/07-no-search-results.png`
- My Pods, no upcoming personal pods but global supply exists:
  `frontend/assets/illustrations/spot/cold-start/08-no-upcoming-personal.png`
- Inbox, no personal conversations but real people exist:
  `frontend/assets/illustrations/spot/cold-start/09-no-conversations-personal.png`
- Inbox, previously active and now caught up:
  `frontend/assets/illustrations/spot/cold-start/10-inbox-all-caught-up.png`
- Onboarding welcome:
  `frontend/assets/illustrations/spot/onboarding/01-welcome.png`
- Account creation:
  `frontend/assets/illustrations/spot/onboarding/02-create-account.png`
- Verification success:
  `frontend/assets/illustrations/spot/onboarding/03-verification.png`
- Interest selection:
  `frontend/assets/illustrations/spot/onboarding/04-interests.png`
- First-plan activation:
  `frontend/assets/illustrations/spot/onboarding/05-first-plan.png`
- Profile setup:
  `frontend/assets/illustrations/spot/onboarding/06-profile.png`
- Invite friends:
  `frontend/assets/illustrations/spot/invites/01-invite-friends.png`
- Share a pod:
  `frontend/assets/illustrations/spot/invites/02-share-pod.png`
- Invite an organization:
  `frontend/assets/illustrations/spot/invites/03-invite-organization.png`
- Community growth:
  `frontend/assets/illustrations/spot/invites/04-community-growth.png`

Activity and club-category imagery are intentionally not supplied yet. Build
configuration-driven mappings that accept stable keys later. Until an approved
image exists, fall back to a code-native icon, club mark, and deterministic
category tint. Do not invent activity or club imagery.

### Required density modes

Supply is surface-specific, not one global boolean.

Pods:

- `globalRelevantPods === 0`: activation mode with templates, creation, intent
  capture, and invitations; no recommendations.
- `globalRelevantPods` from `1–9`: spotlight mode with the few real pods plus
  supply-building actions; no repeated cards.
- `globalRelevantPods` from `10–99`: curated community mode.
- `userUpcomingPods === 0 && globalRelevantPods > 0`: personal empty state with
  real recommendations.
- `userUpcomingPods > 0`: active destination state.

Clubs:

- `discoverableVerifiedClubs === 0`: bring/create/notify mode, no directory.
- `1–9`: one spotlight plus the complete honest list and bring-your-club CTA.
- `10–99`: curated discovery sections.
- `100+`: full directory/search experience.

Inbox:

- `networkPeople === 0 && personalThreads === 0`: teach and invite; no suggested
  people.
- `networkPeople` from `1–9 && personalThreads === 0`: show only real people and
  connection actions.
- `networkPeople >= 10 && personalThreads === 0`: personal empty state with real
  interest-based suggestions.
- `personalThreads > 0`: active inbox architecture.
- Previously active but no unread/actionable items: caught-up state, not
  first-use state.

All thresholds must use real, relevant records. Never fabricate listings,
messages, avatars, attendees, clubs, invitations, mutuals, or momentum metrics.

### Implementation sequence

Complete one family at a time:

1. Theme tokens, background treatment, typography, cards, buttons, fields,
   navigation chrome, image wrappers, skeletons, and state primitives
2. Home and Explore
3. My Pods, Pod Detail, and Pod Chat
4. Clubs, Club Detail, events, meetings, members, applications, and management
5. Inbox, direct messages, profiles, and people search
6. Auth, verification, onboarding, profile editing, settings, privacy, and forms
7. Complete density, loading, offline, error, partial-data, and cold-start sweep

Do not start multiple agents on shared theme or primitive files concurrently.
After the foundation is stable, independent screen families may be assigned
separately.

### Visual validation

For every screen and density state:

1. Add deterministic development fixtures or an isolated preview harness.
   Fixture data must never ship as production social proof.
2. Render at a target iPhone viewport near `390 × 844`.
3. Capture a screenshot.
4. Compare it side-by-side with the controlling reference.
5. Explicitly evaluate:
   - hierarchy
   - vertical rhythm and spacing
   - component dimensions
   - typography
   - colors and contrast
   - image crop and focal point
   - content density
   - safe areas and dock clearance
   - loading, error, and partial-data behavior
6. Iterate until deviations are intentional and documented.

Do not claim a screen matches the reference based only on TypeScript or component
inspection. Visual screenshot comparison is required.

### Functional invariants

- Preserve API and navigation contracts unless a missing reference requirement
  genuinely requires an additive change.
- Preserve the verified-user gate and reviewer bypass.
- Preserve block, report, account deletion, data export, and moderation behavior.
- Preserve deep links and notification navigation.
- Keep all Columbus-facing time logic consistent with `America/New_York`.
- Maintain accessibility labels, minimum touch targets, dynamic type resilience,
  keyboard avoidance, and safe-area handling.
- New backend behavior requires route tests.
- Run frontend typecheck and tests after each family.

### Definition of done

A screen family is complete only when:

- Every active, empty, low-supply, loading, error, offline, and partial-data state
  is implemented.
- All approved spot illustrations are used only in their documented roles.
- No chroma-key source, full-scene master, or fictional-character image is used
  as real social proof.
- Future activity and club-category artwork can be added through stable keyed
  mappings without restructuring screens.
- Screenshot comparisons exist for every required state.
- Remaining deviations from the references are listed explicitly.
- Typecheck and tests pass.

Begin with **[INSERT ONE SCREEN FAMILY HERE]**. Do not implement another family
until this one satisfies the definition of done.

---

## Recommended first task

Replace the final line with:

```text
Begin with the shared design foundation plus Home and Explore. Stop after visual
validation of active, zero-supply, 1–9 spotlight, and 10–99 community states.
```

For later tasks, start a fresh task and substitute one of:

- `My Pods, Pod Detail, and Pod Chat`
- `the complete Clubs family`
- `Inbox, direct messages, profiles, and people search`
- `Auth, verification, onboarding, editing, settings, privacy, and forms`
