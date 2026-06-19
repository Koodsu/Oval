# Bridge Frontend Design Audit — "Scarlet Press" v2

Audience: an implementing engineer/model. Each item says **what's wrong, why it matters, and exactly how to fix it**. Work top to bottom; P0 items are bugs or broken UX, P1 items are core social-app experience gaps, P2 is polish. Do not change API calls, navigation params, or business logic unless an item explicitly says to.

Conventions used below:
- `ui.tsx` = `src/components/ui.tsx`
- "Slab" = the pressable card primitive in ui.tsx
- All line numbers are approximate; search for the quoted code.

---

## P0 — Bugs and broken interactions

### P0.1 Avatars with relative URLs render broken everywhere
**Where:** `ui.tsx` → `Avatar` and `ClubMark`; ~27 call sites pass `avatarUrl` raw.
**What's wrong:** The backend returns avatar paths that can be relative (see `resolveAvatarUrl` in `src/api.ts`: anything not starting with `http` must be prefixed with `API_BASE`). The old design resolved this inside the avatar component. The new `Avatar`/`ClubMark` use the `uri` prop directly, and only `PodsScreen` calls `resolveAvatarUrl` at the call site. Every other screen (PodDetail, Inbox, Thread, Profile, UserProfile, ClubDetail, ClubsScreen, EditProfile, BlockedUsers, UserSearch…) will show a blank/broken image for backend-hosted avatars.
**Fix:** Inside `Avatar` and `ClubMark`, resolve once: `import { resolveAvatarUrl } from '../api';` and use `const resolved = resolveAvatarUrl(uri);` then render image only if `resolved`. Remove the now-redundant `resolveAvatarUrl` call sites in `PodsScreen` (harmless if left, but tidy). Do NOT change the prop name; keep `uri`.

### P0.2 Keyboard covers every text input — no KeyboardAvoidingView in the app
**Where:** Global. Worst on `ThreadScreen`, `PodDetailScreen` (chat composer), `ClubDetailScreen` (general/officer chat), `AuthScreen`, `ActivityPodsScreen` (composer fields).
**What's wrong:** Zero `KeyboardAvoidingView` usage. On iOS, opening the keyboard hides the composer the user is typing into. For a messaging-heavy social app this is a launch blocker.
**Fix:** Wrap the screen content of Thread, PodDetail, ClubDetail, Auth, ActivityPods, EditProfile in `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}} keyboardVerticalOffset={0}>` directly inside `AppBackdrop`. For ThreadScreen specifically, restructure so the composer is pinned (see P1.1) and the KAV pushes it above the keyboard.

### P0.3 Chat screens use the wrong list pattern (not inverted, no auto-scroll)
**Where:** `ThreadScreen` (messages in a plain ScrollView), `PodDetailScreen` and `ClubDetailScreen` (chat inside a nested ScrollView capped at `maxHeight: 360` inside the page scroll).
**What's wrong:**
- Long threads open scrolled to the **top** (oldest message). Users must scroll down to see the latest — backwards for chat.
- New incoming/sent messages appear off-screen with no scroll-to-bottom.
- In PodDetail/ClubDetail, the 3.5–4s polling `load()` re-renders the inner list and can yank the user's scroll position mid-read.
**Fix:**
- `ThreadScreen`: replace the messages ScrollView with an **inverted `FlatList`** (`inverted`, data reversed: `[...messages].reverse()` or render index math), composer pinned below it (outside the list), KAV around both. Remove the outer page ScrollView; header stays fixed on top.
- `PodDetailScreen` / `ClubDetailScreen` chat sections: keep the embedded-card approach but (a) auto-scroll to end on new message (`ref.scrollToEnd` in a `useEffect` keyed on `messages.length` — only when the user is already near the bottom), and (b) make the polling update messages without replacing the array identity when nothing changed (compare last message id before `setMessages`).

### P0.4 Android: `DateTimePicker mode="datetime"` is iOS-only
**Where:** `ActivityPodsScreen` (~line 353), `ClubDetailScreen` (~line 2575). `app.json` configures both ios and android.
**What's wrong:** `@react-native-community/datetimepicker` does not support `mode="datetime"` on Android — it throws. Pod creation and meeting creation are broken on Android.
**Fix:** On Android, render two-step pickers: a date picker, then a time picker (`mode="date"` then `mode="time"`), composing into one `Date`. Gate with `Platform.OS === 'ios' ? <single datetime picker> : <two-step>`. Extract this into a small shared `DateTimeField` component in `ui.tsx` so both screens use it.

### P0.5 ClubsScreen grid: join action is an `onPress` on an `Ionicons` glyph
**Where:** `ClubsScreen` directory grid, the `+ / →` square (`styles.gridAction`): `<Ionicons ... onPress={() => club.isMember ? openClub(...) : handleJoinClub(...)} />`.
**What's wrong:** (a) Pressing the icon also bubbles oddly inside the parent Slab pressable; (b) the tap target is the glyph itself (~15px) — far below the 44px accessibility minimum; (c) `Ionicons onPress` has no pressed feedback, no accessibility role/label.
**Fix:** Replace the wrapping `View` + icon with a `Pressable` (the whole 30×30 box) with `hitSlop={10}`, `accessibilityRole="button"`, `accessibilityLabel={club.isMember ? \`Open ${club.name}\` : \`Join ${club.name}\`}`. Nested Pressables in RN correctly give the inner one priority.

### P0.6 PrivacyDataScreen ignores safe-area — content under the notch
**Where:** `PrivacyDataScreen` content uses fixed `paddingVertical: spacing.xxl` (intentionally avoiding `useSafeAreaInsets` because the Jest mock doesn't provide it).
**What's wrong:** On notch devices the back button/header sits under the status bar.
**Fix:** Wrap the screen in `SafeAreaView` from `react-native-safe-area-context` (the test file already mocks `SafeAreaView` → children, so tests keep passing). Keep the existing padding.

### P0.7 Dark mode: the signature slab shadow is invisible
**Where:** `theme.ts` `darkColors.shadow: '#000000'` against `bg: '#181210'`.
**What's wrong:** The whole design language is "face sitting on a hard offset shadow." In dark mode the pure-black shadow disappears against the near-black background, so cards lose depth and the press-down animation reads as the card just shifting diagonally for no reason.
**Fix:** In dark mode the offset block should read as a backing plate, not a shadow. Set `darkColors.shadow` to the border cream (`#EFE2C5`) — the Slab already uses `borderColor ?? colors.shadow` for the backing block, so the cream backing + cream border gives a striking "printed sticker" look consistent with the zine language. Verify Slab passes `colors.shadow` (it does) and that press-down still looks right.

### P0.8 Home greeting says "TONIGHT, BRADY."
**Where:** `HomeScreen` `greetingForNow()` returns `'TONIGHT'` for evening.
**What's wrong:** "Tonight, Brady." isn't a greeting; reads like a sentence fragment.
**Fix:** Return `'EVENING'` for the >=17h case. Keep `'UP LATE'`, `'MORNING'`, `'AFTERNOON'`.

---

## P1 — Core social-app UX gaps (data not shown, missing affordances)

### P1.1 Inbox shows no unread state — the data exists and is ignored
**Where:** `InboxScreen` message rows; `DirectMessageThread.hasUnread` in `src/types.ts`.
**What's wrong:** A messaging inbox with no unread indicators is dead on arrival. The API already returns `hasUnread` and `lastMessage.createdAt`/`updatedAt`, none of which are rendered. Every thread row looks identical whether it has a new message or not, and there's no timestamp.
**Fix (thread rows):**
- Render a scarlet unread dot (10px, `colors.primary`, hard border) on the avatar corner OR a `CountBubble` (already built in ui.tsx, currently unused) at the row's right edge when `thread.hasUnread`.
- Bold the preview text (`fonts.semibold`, `colors.ink` instead of `colors.sub`) when unread.
- Add a relative timestamp at the row's top-right (e.g. "2m", "Yesterday") from `thread.lastMessage?.createdAt ?? thread.updatedAt`. Add a tiny `relativeTime(iso)` helper to `src/utils/format.ts`.
- Sort threads by `updatedAt` desc if not already server-sorted.

### P1.2 No badges on the dock — invites/requests/unreads are invisible until you visit Inbox
**Where:** `App.tsx` `BridgeDock`/`TabItem`.
**What's wrong:** Social apps live and die by re-engagement loops. Nothing on the tab bar tells the user they have a pod invite, friend request, or unread DM.
**Fix:** Minimal viable approach without new global state: in `InboxScreen`'s `load()`, compute `invites.length + requests.length + threads.filter(t => t.hasUnread).length` and write it via `navigation.setOptions({ tabBarBadge: n || undefined })`. In `BridgeDock`, read `options.tabBarBadge` and render the existing `CountBubble` absolutely positioned at the top-right of the tab sticker (`top: -4, right: -6`). Limitation (acceptable for now): badge only refreshes when Inbox loads; note this as a follow-up for a lightweight polling context.

### P1.3 Pull-to-refresh missing on every feed except Home
**Where:** `ExploreScreen`, `PodsScreen`, `ClubsScreen`, `InboxScreen`.
**What's wrong:** These all load on focus but give the user no way to refresh manually; on a slow load the screen just sits there stale.
**Fix:** Copy Home's pattern: a `refreshing` state + `RefreshControl` with `tintColor={colors.primary}` on each screen's ScrollView, calling the existing `load()`.

### P1.4 Long lists are unvirtualized ScrollView + `.map()`
**Where:** `ClubsScreen` directory, `ClubDetailScreen` members roster, `InboxScreen` friends, `UserSearchScreen` results.
**What's wrong:** At launch scale (hundreds of clubs, large club rosters), mounting every row will jank scrolling and inflate memory. It also blocks list niceties (sticky section headers).
**Fix:** Convert the clubs directory and club members roster to `FlatList` (`numColumns={2}` for the grid; keep the header content via `ListHeaderComponent`). Inbox/Search can stay as-is for now (bounded lists) — note as acceptable.

### P1.5 Alert.alert is the app's only menu/confirm system — breaks the brand at every important moment
**Where:** `PodDetailScreen` message safety menu, `ClubDetailScreen` `handleClubActions` and `openMemberActions`, plus a dozen confirms.
**What's wrong:** The most identity-rich app moments (member management, club actions, reporting) drop into the gray system alert, which can also only show ~3 buttons comfortably — `openMemberActions` stuffs up to 5. The branded `Sheet` component in ui.tsx is built and **never used**.
**Fix:** Replace **menus** (not destructive confirms — those should stay native alerts) with the `Sheet`:
- `handleClubActions` → Sheet titled with the club name, rows via `ListRow` (icon wells, destructive rows red).
- `openMemberActions` → Sheet with the member's avatar + name in header, action `ListRow`s.
- Pod message long-press safety menu → Sheet with "Reply", "Report message", "Block {name}".
State: one `const [activeSheet, setActiveSheet] = useState<null | {...}>` per screen.

### P1.6 Thread screen: no message grouping, no date separators
**Where:** `ThreadScreen`, also chat in `PodDetailScreen`.
**What's wrong:** Every message repeats the avatar + name + timestamp even for consecutive messages from the same sender within a minute — wastes ~40% of vertical space and looks amateur next to iMessage/Instagram conventions. Long threads have no day anchors.
**Fix:**
- Group: if `message.sender.id === prev.sender.id` and `createdAt - prev.createdAt < 5min`, hide the avatar (render a 32px spacer) and the name/time meta row, and tighten the gap to 2px.
- Date separators: when a message's calendar day differs from the previous one, render a centered `Sticker` (e.g. "TODAY", "MON, JUN 8") between them.

### P1.7 Own profile is missing the stats other profiles show
**Where:** `ProfileScreen` stat strip (friends/clubs only) vs `UserProfileScreen` (pods joined / attended / reliability).
**What's wrong:** Inconsistent: your own profile shows less about you than what strangers see. Reliability score is a core trust mechanic — users need to see and manage their own.
**Fix:** `ProfileScreen` should also fetch own public profile (`getUserProfile(user.id)`) and render the same three `StatSlab`s (extract `StatSlab` from UserProfileScreen into `ui.tsx` so both use it), alongside friends/clubs counts. Layout: one row of 3 accent stat slabs replacing the current 2-cell strip, with friends/clubs moved into the row as well if it fits (5 max → use 3 + keep friends/clubs in the strip).

### P1.8 Pods "+" button teleports into a random activity's composer
**Where:** `PodsScreen` header `IconButton icon="add"` → navigates to `ActivityPods` for `quickStartActivity` (whatever activity happens to be first in the feed) with `startCreate: true`.
**What's wrong:** User intent is "start a pod"; landing inside *Basketball Pickup Game*'s create form (or whatever was first) is disorienting and looks like a bug.
**Fix:** Navigate to Explore instead (`navigation.navigate('MainTabs', { screen: 'Explore' })`) — it's the activity picker. Better (if budget allows): open a `Sheet` listing the top ~8 activities (icon + title rows) and navigate to `ActivityPods` with `startCreate: true` on selection.

### P1.9 Inline validation is missing — Auth yells via alerts
**Where:** `AuthScreen` (all validation via `Alert.alert`), `Field` component already supports an `error` prop that nothing uses.
**What's wrong:** Modern onboarding shows errors at the field. Alert-per-mistake is high-friction exactly where drop-off hurts most.
**Fix:** Add an `errors: Record<string,string>` state in AuthScreen; on failed validation set messages per field (`email`, `password`, `firstName`…) and pass to each `Field error={errors.email}`; clear on change. Keep alerts only for server errors. Also add a password visibility toggle: `Field` gains an optional `secureToggle` prop rendering an eye icon `Pressable` on the right that flips `secureTextEntry`.

### P1.10 ClubDetail header is generic and tab bar scrolls away
**Where:** `ClubDetailScreen`: `ScreenHeader title="Club"`, mode chips inside the page scroll.
**What's wrong:** (a) The header says "Club" — wasted slot; users deep-linking land without knowing where they are until the card loads. (b) The five-section dashboard's tab chips scroll out of view; switching sections from deep scroll requires scrolling back up.
**Fix:** (a) `title={club?.name ?? 'Club'}` (it already truncates to 1 line). Drop the redundant kicker or keep category. (b) Use the ScrollView's `stickyHeaderIndices` to pin the chip row: restructure so the chip row is a direct child of the ScrollView at a known index, with `backgroundColor: colors.bg` and a bottom hairline so content doesn't show through while pinned.

### P1.11 Grid "orphan" rows stretch full-width
**Where:** `ExploreScreen` grid, `ClubsScreen` grid, `ClubDetailScreen` metric grid (`flexBasis: '46%', flexGrow: 1`).
**What's wrong:** An odd item count makes the last card span the entire row — twice the width of its siblings, which reads as a layout bug (user already flagged sizing once).
**Fix:** Change grid slots to fixed `flexBasis: '47%'` with `flexGrow: 0` (and `maxWidth: '48%'`), keeping the `gap`. For the metric grid (5 items), this leaves the fifth at half-width left-aligned — acceptable and consistent. Verify on a 375pt-wide screen that two columns still fit (47% + 47% + 12 gap ≤ 100% of inner width).

---

## P2 — Polish, consistency, hygiene

### P2.1 Touch targets below 44pt
- `Chip` height is 36 — fine for filters, but Chips are used as **RSVP buttons** (`ClubDetailScreen`) and **mode switches**. Add `hitSlop={{top: 6, bottom: 6}}` inside Chip's Slab (Slab needs to forward a `hitSlop` prop to the face Pressable).
- `ClubsScreen` grid action (fixed in P0.5), heart buttons in chats already have hitSlop — good.

### P2.2 Stale "Could not load" alerts fire on every focus when offline
**Where:** All screens' `load()` catch blocks `Alert.alert(...)` (Home, Explore, Pods, Clubs…), and Home/PodDetail/ClubDetail re-run on a timer/focus.
**What's wrong:** Offline users get an alert storm just by navigating tabs.
**Fix:** Convert the focus-load failure path to a non-blocking inline `Banner` (component exists) at the top of the screen ("Couldn't refresh — pull to retry") + keep stale data rendered. Keep alerts only for user-initiated actions (join, send, RSVP).

### P2.3 The polling `load()` in ClubDetail refetches the world every 4s
**Where:** `ClubDetailScreen` `useFocusEffect` interval.
**What's wrong:** Club + meetings + announcements + 1–2 chat endpoints, every 4 seconds, for as long as the screen is focused. Battery/network heavy; mutations can race the poll (optimistic RSVP then poll overwrites momentarily).
**Fix:** Poll only the active surface: when `mode==='chat' && chatView==='general'` poll `getClubMessages`; `officers` → `getClubOfficerMessages`; otherwise poll nothing and refresh on focus/mutations only. Same idea in PodDetail (poll `getMessages` only; full `load` on focus and after mutations).

### P2.4 Static `typography` export is a dark-mode footgun
**Where:** `theme.ts` `export const typography = getTypography(lightColors)`.
**What's wrong:** Anyone importing the static `typography` gets light-mode ink colors burned in; in dark mode that's near-black text on near-black background. Nothing uses it today, but it's one autocomplete away.
**Fix:** Delete the export (and the leftover `getSystemScheme` if present); fix any compile errors by switching to `useTheme().typography`.

### P2.5 Mid-file imports
**Where:** `ClubDetailScreen.tsx` and `UserProfileScreen.tsx` have `import { StyleSheet } from 'react-native'` in the middle of the file.
**Fix:** Move to the top import block (add `StyleSheet` to the existing `react-native` import). Pure hygiene; behavior identical.

### P2.6 Sticker overflow on long labels
**Where:** `Sticker` (`ui.tsx`) used with dynamic content: category names ("Music & Entertainment") in Home's activity rail, `formatDateTime` in Home's next-pod card, role-audience labels in ClubDetail.
**What's wrong:** `alignSelf: flex-start` + `numberOfLines={1}` means long labels get clipped mid-word with no max width control; in tight rows the sticker can push siblings.
**Fix:** Add `maxWidth: '100%'` to the sticker base and `flexShrink: 1` to its Text; where stickers sit in a row with other elements (Home nextPodTop), give the sticker container `flexShrink: 1`.

### P2.7 Search has no submit/dismiss affordances
**Where:** `SearchBar` in ui.tsx.
**Fix:** Forward `onSubmitEditing` and add `clearButtonMode` is iOS-only — keep the custom clear button, but also blur the input on submit. One-liner each.

### P2.8 Instagram handle hygiene
**Where:** `EditProfileScreen`, `PrivacyDataScreen`.
**What's wrong:** Users will type `@handle`; the raw string is saved and then rendered as `@@handle` ( `@${profile.instagramHandle}` in UserProfile).
**Fix:** Strip a leading `@` and spaces before `updateProfile` in both screens: `instagram.trim().replace(/^@+/, '')`.

### P2.9 Verify-email niceties
**Where:** `VerifyEmailScreen`.
**Fix:** Auto-submit when the 6th digit is entered (`useEffect` on `code.length === 6` → `submit()` once, guard with a ref so it doesn't loop on failure). Keep the button.

### P2.10 Home map in dark mode
**Where:** `HomeScreen` MapView.
**What's wrong:** Default Apple/Google map tiles are light; in dark mode the map is a glowing white slab inside an ink card.
**Fix:** iOS Apple Maps respects system appearance automatically when `userInterfaceStyle` is set — ensure `app.json` has `"userInterfaceStyle": "automatic"`. If it's pinned to light, either set automatic or overlay `colors.glass` on the map at 0 elevation. Verify, don't assume.

### P2.11 Button loading state causes width jump
**Where:** `Button` in ui.tsx replaces label with an `ActivityIndicator`.
**Fix:** Render the label at `opacity: 0` underneath an absolutely-centered spinner so width is stable.

### P2.12 Duplicate CTA on Pods primary card
**Where:** `PodsScreen` primary card: the whole card navigates to PodDetail AND it contains an "Open" Button doing the same thing.
**What's wrong:** Redundant; the button steals visual weight from the more useful info (friends joined).
**Fix:** Remove the "Open" button; move the `friendCountLabel` line up beside the avatar stack; add a subtle `arrow-forward` icon at the card's top-right instead.

### P2.13 Inbox header icon ambiguity
**Where:** `InboxScreen` masthead: `search` and `person` icon buttons, unlabeled.
**Fix:** Keep icons but ensure accessibility labels exist (they do); swap `person` → `person-circle-outline` to read as "profile" rather than "a user". Optional.

### P2.14 EmptyStates could carry CTAs more often
**Where:** e.g. Inbox "No invites waiting", "No friend activity"; ClubDetail "No upcoming meetings" for leaders.
**Fix:** Where a next action exists, pass `actionLabel`/`onAction`: "No friend activity" → "Find people" → `UserSearch`; leader-visible "No upcoming meetings" → "Schedule one" → open meeting composer. Sweep all EmptyState usages and add the obvious CTA where one exists.

---

## Explicitly fine — do not "fix"
- Uppercase Unbounded mastheads, tilted stickers, dashed dividers: intentional brand.
- `Slab` face-as-Pressable structure (recently fixed; don't restructure again).
- Tests: `ProfileScreen.test.tsx` expects a pressable "Settings" text; `PrivacyDataScreen.test.tsx` expects 10 switches, "Delete my account" ×2, "Update/Unlink Instagram". Run `npx tsc --noEmit` and `npx jest` after every batch; both must stay green.

## Suggested implementation order
1. P0.1 → P0.8 (each is small and independent; P0.2/P0.3 together).
2. P1.1 + P1.2 (inbox/badges), P1.3 (PTR), P1.5 (sheets), P1.6 (chat grouping).
3. P1.4, P1.7–P1.11.
4. P2 sweep.
