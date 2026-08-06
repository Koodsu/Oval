# Accessibility second opinion — August 5, 2026

Independent code review of the accessibility overhaul, done without reference to the previous session's own conclusions. The goal was to find things `ACCESSIBILITY_AUDIT_2026-08-05.md` claims or implies that the code does not support.

**Verdict: the remediation is real and substantial, but "everything is done" is not accurate.** Six findings below, two of which are genuine WCAG conformance failures that exist in the code today and are not on any checklist.

## Resolution status (same day)

**F1 and F2 are fixed.** F3–F6 remain open and are deliberately deferred to after this release, except for one guardrail added below.

| Finding | Status |
|---------|--------|
| F1 — unread counts not announced | ✅ Fixed, 6 call sites (one more than originally found) |
| F2 — Dynamic Type capped below 200% | ✅ Fixed, 11 sites raised to 2; 2 documented exceptions remain |
| F3 — scanner blind spots | ⚠️ Partially closed — added a `maxFontSizeMultiplier` rule; the rest stand |
| F4 — untested rgba surfaces, no 1.4.11 | ❌ Open |
| F5 — thin shared-UI tests | ⚠️ Improved — 3 assertions → 6 |
| F6 — thin live regions | ❌ Open, flagged for the device pass |

Verification after the fixes: `tsc --noEmit` clean, `audit:a11y` passes, **13 suites / 93 tests pass** (was 90). The new scanner rule was tested against an injected violation to confirm it actually fires rather than silently passing — the same failure mode F3 criticises.

### Two corrections to my own findings below

- I wrote that `CountBubble` used `fontSize: 12`. It uses `bubbleStyles.label`, which is **`fontSize: 10`** — so the old ceiling was **14px**, not 16.8px. The finding was worse than stated.
- `HomeScreen`'s notification button already carried `` `Open inbox, ${total} unread` ``, so it was never an F1 site. Its badge still needed the F2 cap raised and is now also hidden from assistive tech for consistency.

### Two additional F1 sites found while fixing

Not in the original table, same defect class:

- `InboxScreen.tsx:1282` — pod row labelled `` `Open ${title} chat` ``, dropping the unread count.
- `ExploreScreen.tsx:241` — interest pill labelled `` `Interested in ${title}` ``, dropping the visible demand count.

---

## F1 — Unread counts are visible but not announced (WCAG 1.3.1, 4.1.2) — **High**

`CountBubble` (`ui.tsx:770`) renders a bare number inside an unlabeled `View`. It is used in five places. In three of them the count never reaches a screen-reader user:

| Site | Container | Accessible name | Count announced? |
|------|-----------|-----------------|------------------|
| `App.tsx:325` (tab bar) | `Pressable` | `` `${label}, ${badge} unread` `` | ✅ yes |
| `PodsScreen.tsx:195` | `Slab` | `` `Open ${title}` `` | ❌ **no** |
| `components/clubs/index.tsx:118` | `Pressable` | `` `Open ${channel.name} channel` `` | ❌ **no** |
| `components/clubs/index.tsx:639` | `Pressable` | label prop + hint | ❌ **no** |
| `ClubChatScreen.tsx:439` | switcher row | inherits container label | ❌ **no** |

`Slab` (`ui.tsx:217`) renders an `AnimatedPressable`, which React Native defaults to `accessible={true}`. That collapses the subtree into one element and the explicit `accessibilityLabel` wins — so the child `<Text>{count}</Text>` is never read. A sighted user sees "3 unread"; a VoiceOver user hears "Open Coffee at Sip, button" and has no way to know.

The tab bar proves the correct pattern was known. It just wasn't applied consistently.

**Fix:** append the count to the container's `accessibilityLabel` at each of the four sites, exactly as `App.tsx:325` does.

---

## F2 — Dynamic Type is capped, not supported (WCAG 1.4.4) — **High**

The audit doc says "Maximum Dynamic Type fixes cover primary tabs, pod/club creation, privacy…". What the code actually does is cap text scaling in **303 places**:

| Cap | Count | Effect |
|-----|-------|--------|
| `maxFontSizeMultiplier={2}` | 292 | 200% ceiling — meets WCAG 1.4.4, below iOS AX3–AX5 |
| `{1.5}` | 5 | **below 200% — fails 1.4.4** |
| `{1.4}` | 4 | **below 200% — fails 1.4.4** |
| `{1.2}` (tab labels, `App.tsx:329`) | 1 | **below 200%** |
| `{1}` (emoji avatars) | 2 | no scaling; defensible, these are images not prose |

The sub-200% cases on real content:

- `ExploreScreen.tsx:259` — demand count on `typography.captionSmall`, which is **`fontSize: 10`** (`theme.ts:327`). Capped at 1.4 → **14px ceiling.** A low-vision user can never make this larger.
- `ui.tsx:782` — `CountBubble`, `fontSize: 12` capped at 1.4 → 16.8px ceiling.
- `HomeScreen.tsx:779` — notification badge, same pattern.
- `InboxScreen.tsx:1330` — unread badge, same pattern.

The 200% caps are a defensible engineering trade-off and satisfy the letter of WCAG 1.4.4. But capping is not the same as supporting, and the audit doc's phrasing implies the latter. The doc does disclose the 120% dock cap; it does not disclose the other 302.

**Fix:** raise the sub-200% caps to 2 and verify the layouts hold, or accept them as documented, justified exceptions. Do not leave them undisclosed.

---

## F3 — The static scanners are a lint, not an audit — **Medium**

`frontend/scripts/audit-accessibility.mjs` (132 lines) passing is weaker evidence than the audit doc implies. Confirmed holes:

- **Presence, not value.** `hasProp` only checks the attribute exists. `accessibilityLabel={undefined}`, `accessibilityLabel=""`, or a label bound to an empty variable all pass.
- **Custom controls aren't required to have names.** Only `Pressable`, `TouchableOpacity`, `TouchableWithoutFeedback` are checked for role + label. `IconButton`, `Button`, `Chip`, `ListRow` are checked only for illegal *nesting*. An `<IconButton onPress>` with no label would pass. *(Checked manually — all 16 current uses do have labels. The guardrail is missing, not the labels.)*
- **`TouchableHighlight` is not covered at all.**
- **`<Image accessible />` with no label passes** — the check accepts either `accessible` or `accessibilityLabel`, so an image marked accessible with no name is allowed.
- **`maxFontSizeMultiplier` is invisible to it.** The single most consequential Dynamic Type lever in this codebase (F2) is not checked at all.
- **Not checked at all:** touch-target size, heading hierarchy, focus order, live regions, modal semantics, color-only information.

`landing/scripts/audit-accessibility.mjs` (75 lines):

- **An `id` counts as a label.** Line 29 accepts `id=` as proof of an accessible name, but an `id` only helps if a matching `<label for>` exists — which is never verified. False negatives are possible.
- **`alt=` presence only.** `alt="image"` passes.
- **Contract checks are `String.includes()`.** Verifying `'focus({ preventScroll: true })'` appears in a file does not verify focus management works.
- The `<div onClick>` check reports once per file, so multiple violations collapse into one finding.

These scripts are worth keeping as regression guards. They should not be cited as evidence of conformance.

---

## F4 — Contrast tests miss the surfaces text is actually drawn on — **Medium**

`theme.accessibility.test.ts` is the strongest artifact here: 17 foreground/background pairs × 2 themes at 4.5:1, plus a check that `readableInkOn` picks the higher-contrast ink. That's genuinely good.

Two gaps:

1. **The rgba surfaces are untested.** `glass`, `overlay`, and `tabBar` are `rgba()` strings (`theme.ts:106–108, 155–157`). The test's `luminance()` parses 6-digit hex only, so those colors are simply excluded from the list. But `colors.tabBar` is the actual background of the tab bar (`App.tsx:392`, `ui.tsx:2054`) with `colors.sub` labels on it, and `colors.glass` backs the map overlays. **The contrast of text on the translucent chrome has never been computed.** In practice `rgba(255,255,255,0.95)` composites close to white so it is probably fine — but "probably" is doing the work, not the test.
2. **No WCAG 1.4.11 non-text contrast (3:1).** `colors.border` defines control boundaries throughout (`clubs/index.tsx:100, 631`) and is never contrast-checked. Neither are icon-only controls or focus indicators.

---

## F5 — "Shared UI accessibility regression tests: passed" is three assertions — **Low**

`ui.accessibility.test.tsx` contains exactly three `it()` blocks: loading-button busy/disabled state, input name derivation, and progress percentage. That's a reasonable start and each one is well-targeted. It is not coverage of the shared primitive layer, and the audit doc's bullet reads like it is.

---

## F6 — Live-region coverage is thin — **Low**

Seven total uses of `accessibilityLiveRegion` / `announceForAccessibility` / `accessibilityViewIsModal` across the entire app. Given how many async states exist (sending a message, joining a pod, RSVPing, blocking, data export), status changes going unannounced is a plausible device-pass finding. Cannot be confirmed statically — flag it for the VoiceOver pass.

---

## What this review could not check

Static review cannot determine focus order, whether VoiceOver can actually activate a control, whether content is reachable at max text size, whether landscape hides actions, or whether anything is conveyed by color alone in practice. **All of that still requires the physical-device pass in `ACCESSIBILITY_DEVICE_PASS_2026-08-05.md`.** Nothing in this second opinion replaces it.

## How F1 and F2 were fixed

**F1 — the count now travels with the name.** `CountBubble` is explicitly hidden from assistive technology (`accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`), because inside a collapsed container it could only ever be swallowed or read as a bare number. The count instead folds into each container's `accessibilityLabel`, pluralised: *"Open Coffee at Sip, 3 unread messages."* `Chip` gained an optional `accessibilityLabel` so the club-chat switcher can carry its badge without changing the visible text.

Sites fixed: `PodsScreen`, `InboxScreen` (pod rows), `ChannelRow` and the badge row in `components/clubs/index.tsx`, `ClubChatScreen`, `ExploreScreen`.

**F2 — caps raised and the boxes made to grow.** All eleven sub-200% caps are now `2`. Raising a cap alone would have clipped text inside fixed-size circles, so every affected badge (`bubbleStyles.base`, `InboxScreen.countBadge`, `HomeScreen.badge`, `CreateClubScreen.ruleNumber`) switched from a fixed `height` to `minHeight` + padding with a pill radius, so it grows with its content.

The tab bar was the one real judgement call. Raising it from 1.2 to 2 with `numberOfLines={1}` would have truncated labels — trading one 1.4.4 failure for a worse one. It now scales to 2 and wraps to two lines at `fontScale >= 2`, which the dock can absorb because it has no fixed height (`styles.dock` is padding-based). **This specific change needs a visual check on device**; it is the one edit here I could not verify by rendering.

**Two documented exceptions remain**, both emoji functioning as images rather than prose: the club avatar glyphs at `CreateClubScreen.tsx:197` and `:425`, capped at `1`. WCAG 1.4.4 governs text, not graphics. They are allowlisted by name in the scanner so the exception is explicit rather than accidental.

**Guardrail added.** `audit-accessibility.mjs` now fails on any `maxFontSizeMultiplier` below 2 that is not in `FONT_SCALE_EXCEPTIONS`. This closes the specific F3 hole that let F2 exist invisibly for the entire previous audit.

## Recommended order

1. ~~Fix **F1**~~ — done.
2. ~~Decide on **F2**~~ — done; caps raised, two exceptions documented.
3. **Run the device pass** (`ACCESSIBILITY_DEVICE_PASS_2026-08-05.md`). Add one item: confirm the tab bar looks right at maximum text size, since that layout changed and was never rendered.
4. Fix the remaining **F3/F4** guardrails before the *next* release, not this one.
5. Correct the overstated claims in `ACCESSIBILITY_AUDIT_2026-08-05.md` so the record matches the code.
