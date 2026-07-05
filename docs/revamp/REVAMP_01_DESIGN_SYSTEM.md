# Oval Revamp — 01: Crimson Design System

Prereq: read `REVAMP_00_OVERVIEW.md` (decisions D-1…D-7). This doc converts the theme layer, shared components, and navigation. No screen redesigns here (that's 02) — screens should keep compiling against the updated primitives with minimal call-site churn.

Files you will touch most: `frontend/src/theme.ts`, `frontend/src/components/ui.tsx`, `frontend/App.tsx`.

---

## 1. Tokens (`frontend/src/theme.ts`)

Replace the Lumen palettes with Crimson. Keep the `ThemeColors` type shape and all existing token *names* so call sites keep compiling; change values. Add the two new tokens noted below.

**Light:**

| token | value | notes |
|---|---|---|
| bg | `#F5F4F2` | flat page gray (no gradient) |
| surface | `#FFFFFF` | cards — SOLID, no alpha |
| surfaceAlt | `#F3F2F0` | input wells, inset panels |
| sunken | `#EAE9E6` | switch tracks, code wells |
| ink / sub / faint | `#111317` / `#5B5E66` / `#9A9DA6` | faint is decorative-only (see §6) |
| border / borderSoft | `#E7E6E3` / `#F0EFEC` | |
| primary / primaryPress | `#D90429` / `#B00321` | |
| primarySoft | `#FFE5EA` | blush chips/tags (mockups' `#FFE5EB`) |
| onPrimary | `#FFFFFF` | |
| accentText *(new)* | `#D90429` | text/icon accent; light = primary |
| danger/dangerSoft | `#C01731` / `#F9E2E6` | |
| success/successSoft | `#178A47` / `#E2F3E9` | |
| warning/warningSoft | `#B57A0B` / `#F8EEDB` | |
| glass / overlay / tabBar | `rgba(255,255,255,0.6)` / `rgba(17,19,23,0.45)` / `rgba(255,255,255,0.92)` | tabBar nearly opaque |
| shadow | `#111317` | used at low opacity via `elevation` |
| crayon colors (blue…teal + softs) | keep current light values | category accents still work |

**Dark:**

| token | value | notes |
|---|---|---|
| bg | `#0F0E12` | |
| surface | `#1B1A20` | SOLID |
| surfaceAlt | `#232228` | |
| sunken | `#0A090C` | |
| ink / sub / faint | `#F4F3F6` / `#A8A7B0` / `#6E6D78` | |
| border / borderSoft | `#2E2D35` / `#26252C` | |
| primary / primaryPress | `#D90429` / `#F0264A` | fills keep brand red; press brightens on dark |
| primarySoft | `rgba(217,4,41,0.16)` | |
| onPrimary | `#FFFFFF` | 5.4:1 on #D90429 ✓ |
| accentText *(new)* | `#FF4D63` | accent TEXT/ICONS on dark surfaces (AA); never as a fill |
| success | `#3ECF7A` (soft `rgba(62,207,122,0.15)`) | |
| warning | `#E8B04B` (soft `rgba(232,176,75,0.15)`) | danger `#FF5C71` (soft `rgba(255,92,113,0.16)`) |
| glass / overlay / tabBar | `rgba(27,26,32,0.6)` / `rgba(0,0,0,0.6)` / `rgba(20,19,24,0.94)` | |
| crayon colors | keep current dark values | |

Also in theme.ts:
- Delete `lightBackdrop`/`darkBackdrop`/`backdropStart`/`backdropEnd` exports (grep call sites: `AppBackdrop` in ui.tsx is the only consumer).
- `elevation.card` → `shadowOpacity: 0.06, shadowRadius: 12, shadowOffset {0,4}` (light) — cards on solid bg need less shadow. Keep `elevation.floating` for dock/sheets.
- `radii`: change `md: 16, lg: 20, xl: 24` (xs/sm/pill unchanged). This matches the mockups' tighter geometry.
- Rule stated in a comment at top of file: **no raw hex in screens; every color goes through `useTheme()`.**

## 2. Typography → system font

- In `theme.ts`, replace the `fonts` map values with `undefined`-family styles: define `fonts = { display: undefined, ... }` is NOT valid — instead change `getTypography` to stop setting `fontFamily` and set `fontWeight` per role: hero/display `'800'`, title/heading `'700'`, subheading/button `'600'`, body `'400'`, bodyMedium/caption `'500'`, kicker `'700'` + letterSpacing 0.8 + uppercase (unchanged).
- Keep the exported `fonts` object as deprecated aliases mapping to `undefined` so stray imports compile, then remove imports screen-by-screen as touched (02 finishes this).
- In `App.tsx`: remove `useFonts`, `@expo-google-fonts/sora`, `@expo-google-fonts/inter` imports and the font-gating in `App()` (keep `SplashScreen` for the theme-preference gate added in §7). Remove the packages from `frontend/package.json`.
- Type scale stays as-is except: hero 30→32, display 23→24, remove the half-point sizes (17.5→17, 16.5→16, 15.5→15, 12.5→12, 11.5→12).

## 3. Component restyle (`frontend/src/components/ui.tsx`)

- **Slab:** delete the internal `BlurView` and the `isGlass` branch entirely; face is always solid `color ?? colors.surface`. Keep press-scale animation, haptics, border (`BORDER_W` on `colors.border`). Remove the `GLASS_BLUR` import; delete the `GLASS_BLUR` export from theme.ts after confirming its only other consumers are the dock/Sheet (those keep a literal `intensity={40}`).
- **AppBackdrop:** replace the `LinearGradient` with a plain `View` using `colors.bg`. Keep the component + prop signature (every screen wraps in it).
- **Button:** three variants matching the mockups — `primary` (fill `colors.primary`, text `onPrimary`), `secondary` (surface fill, `BORDER_W` border `colors.primary`, text `accentText`), `tertiary` (fill `colors.ink`, text `colors.bg`). Add `variant` prop defaulting to `primary`; map the existing boolean props (`ghost` etc., if present) onto variants rather than breaking call sites.
- **Tag / status:** add a `StatusTag` helper rendering pod/meeting status: FORMING → `primarySoft`/`accentText` "Forming"; LOCKED → `surfaceAlt`/`sub` with lock icon "Locked"; COMPLETED → `successSoft`/`success` "Completed"; EXPIRED → `surfaceAlt`/`faint`. Screens currently roll their own — 02 swaps them to this.
- **Chip:** selected = `primarySoft` bg + `accentText` label + `colors.primary` border; unselected = surface + border + `sub`. Min height 32, horizontal padding 14.
- **Avatar/AvatarStack:** unchanged API. AvatarStack gets an optional `overflowCount` prop rendering the `+N` circle (mockups use it everywhere).
- **CountBubble:** fill `colors.primary`, text white, min-size 18, used for all unread/pending counts.
- **Sheet:** keep blur here. Ensure it renders a grabber, title row, and respects safe-area bottom.
- **Sticker:** demote — keep exported for compatibility but restyle as a plain rounded `Tag` (no tilt, no offset shadow). Remove `tilt` visual effect app-wide via this one component (call sites pass tilt; ignore the prop).
- **EmptyState:** require `actionLabel`/`onAction` in the type (make them non-optional). This forces the 04 §3 empty-state pass at compile time. Where a screen truly has no action, it should not use EmptyState.

## 4. Navigation & tab bar (`frontend/App.tsx`)

- `MainTabParamList` → `{ Home, Discover, Plans, Inbox }` + a non-navigating center button. Implementation: keep 4 `Tab.Screen`s; in `OvalDock`, render slots as [Home, Discover, CREATE, Plans, Inbox], where CREATE is a 52px `colors.primary` circle with a white `add` icon, `accessibilityLabel="Create"`, elevated ~8px above the bar (mockup style), opening the **create sheet** (§5).
- Route mapping: `Discover` renders a new `DiscoverScreen` (02 §3) that hosts today's `ExploreScreen` + `ClubsHomeScreen` content as segments; `Plans` renders `PodsScreen` (renamed label only — keep the route name `Pods` internally if renaming breaks too many `navigate('Pods')` call sites; grep first, then decide, and note the decision in the PR).
- Remove `Clubs` tab registration; keep all club stack screens. Grep `navigate('MainTabs', { screen: 'Clubs' })` and `screen: 'Explore'` and update to `Discover` (+ segment param).
- Tab icons (Ionicons): Home `home`/`home-outline`, Discover `search`, Plans `calendar`/`calendar-outline` (drops the flash/megaphone metaphors), Inbox `mail`/`mail-outline`. Active tint `colors.primary` (light) / `colors.accentText` (dark); inactive `colors.sub` — NOT `faint` (contrast).
- Dock: near-opaque `colors.tabBar` + hairline top border; keep BlurView underneath at `intensity={30}`. Keep badge logic; badge component top-right of the icon.
- Keep deep-link config unchanged.

## 5. Create sheet (new, `frontend/src/components/CreateSheet.tsx`)

Bottom `Sheet` with rows: **"Start a pod"** (→ `Discover` activities segment in pick-mode, or directly to `ActivityPods` with `startCreate: true` when launched from an activity context), **"Plan a club meeting"** (only if the user is an officer/admin of ≥1 club — reuse the membership data from `useClub`/clubs API; navigates to `ClubEvents` with `startCreate: true`), **"Invite a friend"** (opens the native share sheet with the app link; fires `invite.shared` with `surface: 'create_sheet'`, see 03 §6). Each row: icon well, title, one-line sub.

## 6. Accessibility & contrast rules (enforced in this doc's PR)

- `faint` may style decorative elements only (dividers, disabled, placeholders) — never labels, timestamps, or tab text. Grep `colors.faint` and re-point meaningful text to `sub`.
- All icon-only `Pressable`s get `accessibilityLabel` + `hitSlop` to reach 44×44.
- Every use of white text on `primary` is fine (5.4:1). Any accent-colored TEXT on dark surfaces must use `accentText`, not `primary` — grep dark-mode screenshots for violations after retheme.
- Verify with light AND dark screenshots of: Home, Discover, Plans, Pod Detail, Pod Chat, Inbox, Profile, Auth.

## 7. Theme-preference flash fix

`ThemeProvider` (theme.ts) currently defaults to `'dark'` and loads AsyncStorage after first paint (light users get a dark flash). Fix: add a `ready` flag to the provider; `App()` keeps the splash visible (`SplashScreen.hideAsync` gating, which currently waits for fonts) until `ready === true`. Since fonts no longer load (§2), theme readiness becomes the only splash gate.

## Acceptance for doc 01

Both apps typecheck; frontend tests pass; app boots with zero references to Sora/Inter; no `BlurView` outside the dock and `Sheet`; tab bar shows Home/Discover/+/Plans/Inbox with the create sheet working; no dark-launch flash for a light-preference user; a grep for `#` hex literals in `frontend/src/screens` returns only pre-existing map/polygon constants.
