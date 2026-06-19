# Clubs Feature — UI/UX Redesign Plan

**Status:** Proposal (no code yet) · **Scope:** Clubs screens + shared UI/nav · **Direction:** Evolve Scarlet Press — keep the brand bones, fix organization, density, and hierarchy.

---

## 1. What exists today

Three screens carry the entire feature:

| Screen | Lines | Role |
|---|---|---|
| `ClubsScreen` | 642 | Directory: masthead, search, category chips, "Tonight" rail, Spotlight, 2-col grid |
| `ClubDetailScreen` | 3,627 | Everything: 5 chip-tab "modes" (Overview / Chat / Members / Events / Analytics), 4 chat sub-views, 3 inline composers, role manager, outreach, attendance tooling |
| `ClubMeetingsTonightScreen` | 304 | "See all" list for tonight's meetings |

## 2. Diagnosis

**The detail screen is a god-screen.** One ScrollView hosts member content, leader tooling, chat, composers, and analytics, switched by chip-row state (`mode` + `chatView`). Consequences: no deep links to anything below the club root, all state resets on navigation, the identity card pushes every mode's content below the fold, and scroll position is shared across unrelated contexts.

**Chat is the wrong pattern.** Messages render as cards inside the parent ScrollView — no inverted list, no docked composer, no keyboard avoidance, and a fake back button (`setChatView('hub')`) that breaks the OS back gesture. A messaging surface needs to be its own screen.

**Member and leader content are interleaved.** Officer permissions, member tags, bulk outreach, attendance codes, and RSVP reminders sit inline between member-facing content. A regular member scrolls past leadership machinery; a leader hunts across three tabs to run their club.

**The directory has three competing heroes.** Tonight rail, Spotlight, and the grid all fight for attention before browsing starts — and Spotlight is just `filteredClubs[0]` (the biggest club), duplicating the first grid entry while eating a full card of vertical space. There's also no "My clubs" concept: clubs I've joined are mixed into discovery.

**Density noise.** Grid cards stack avatar + verified badge + title + member count + dashed-border footer + signal icon + rotated action chip into ~160pt. Tilts and stickers appear on nearly every element, so nothing reads as special. (Also a latent bug: the grid join action puts `onPress` on an `Ionicons` element, not a Pressable.)

## 3. Design principles for the rework

1. **One screen, one job.** Every distinct context (browse, club home, a chat channel, events, members, leader console) is its own routed screen.
2. **Member-first, leader-gated.** The default experience is what a regular member needs. Leadership tooling lives behind one clearly labeled door.
3. **Earn the accent.** Keep Scarlet Press (paper, ink borders, slab shadows, Unbounded display type) but reserve tilt/sticker/slab treatment for one hero moment per screen. Dense, repeated rows use flat `Card`/`ListRow` styling.
4. **Deep-linkable everything.** Every screen gets a route (`clubs/:clubId/chat/general`, `clubs/:clubId/events/:meetingId`), which the current mode-state approach can never support.

## 4. New information architecture

```
Clubs tab
└── ClubsHomeScreen            "My Clubs" + "Discover" (replaces ClubsScreen)
    ├── ClubMeetingsTonightScreen   (kept, lightly restyled)
    └── ClubHomeScreen          clubs/:clubId — the hub (replaces ClubDetail "Overview")
        ├── ClubChatScreen      clubs/:clubId/chat/:channel  (announcements | general | officers)
        ├── ClubEventsScreen    clubs/:clubId/events
        │   └── MeetingDetailScreen  clubs/:clubId/events/:meetingId
        ├── ClubMembersScreen   clubs/:clubId/members
        └── ClubManageScreen    clubs/:clubId/manage   (leaders only)
            ├── roles & permissions, outreach, analytics, club settings
```

Hub-and-spoke instead of tabs: the club home is a calm overview, and each spoke is a push navigation with a real back gesture. State, scroll position, and keyboard behavior become per-screen problems with standard solutions.

## 5. Screen-by-screen layout

### 5.1 ClubsHomeScreen (directory)

Top to bottom:

1. **Masthead** — keep the `CLUBS.` display title and count caption; keep the `+` list-your-club action.
2. **My Clubs** (only if the user has memberships) — compact horizontal cards or stacked `ListRow`s: club mark, name, one signal line ("Meets tonight 7:00 PM" / "3 new announcements"). This is the highest-value real estate and currently doesn't exist.
3. **Tonight rail** — keep, but cap at 6 and only render when non-empty (as today).
4. **Discover** — search bar + category chips move *down* here, directly above the list they filter (today they sit above "Tonight," which they don't filter — a hierarchy lie).
5. **Directory list** — replace the 2-col grid with single-column rows: club mark (44), name, category tag, member count + meeting signal on one meta line, and a single trailing Join/arrow affordance. Single column scans faster, fits long club names, and halves the per-item chrome. Sorting: members' clubs excluded (they're in My Clubs), then by member count.
6. **Spotlight: cut.** If editorial featuring is wanted later, drive it from a backend flag, not `filteredClubs[0]`.

Empty/loading states carry over (skeleton rows instead of skeleton cards).

### 5.2 ClubHomeScreen (the hub)

1. **Compact identity header** — avatar (52), name, category + verified inline, university. The current 68pt avatar + sticker row + description + stat strip + full-width button (~40% of the viewport) compresses to ~120pt. Description collapses to 2 lines with "more."
2. **Primary action** — Join (non-members, prominent) / joined state shows nothing here (membership management moves to the `…` menu and Manage). Stat strip (members / upcoming / going) becomes one quiet meta line.
3. **Next meeting card** — the one Slab hero on this screen: date badge, title, time/location, RSVP segmented control inline, avatar stack of who's going. Tap → MeetingDetail.
4. **Spaces list** — three `ListRow`s with unread badges: Announcements, General Chat, Officers (visible only to officers). Replaces the chat "hub" sub-view. Tap → ClubChatScreen.
5. **Recent announcements** — 2 previews max, "View all" → ClubChatScreen(announcements).
6. **Leader entry point** — single `Manage club` row (settings icon, scarlet tint) pinned at the bottom of the list for officers/owners. Everything leader-only routes through it.

### 5.3 ClubChatScreen

A real chat screen, parameterized by channel:

- Inverted `FlatList`, `KeyboardAvoidingView`, composer docked to the bottom (safe-area aware), typing indicator above composer.
- Header: channel name + member/visibility subtitle, back = OS back.
- Announcements channel: same screen, but composer is replaced by a "New announcement" button (permission-gated) opening the **announcement composer as a `Sheet`** (visibility options + role targeting + text). Announcement cells keep the author/tag/report layout from today.
- Message actions (report, delete) move from inline text-buttons to long-press context menu.

### 5.4 ClubEventsScreen + MeetingDetailScreen

- **Events list:** month-grouped meeting rows — date badge, title, time/location, RSVP count. Export `.ics` stays in the header. "New meeting" (gated) opens the **meeting composer as a Sheet**, not an inline card.
- **MeetingDetail** (new): everything that today bloats each meeting card inline — full description, RSVP control, attendee list, and the entire attendance block (open/close attendance, code display + copy, member check-in input, "remind non-RSVPs"). Attendance tooling renders only for leaders; members see RSVP + check-in. This screen is the destination for the Tonight rail and Home-tab deep links.

### 5.5 ClubMembersScreen

Member-facing only: search field, roster grouped by role (Owners, Officers, role tags, Members), each row avatar + name + tags. Leader actions (assign role, remove) live behind long-press / row `…`, not an always-rendered editor. Officer permissions, role creation, and bulk outreach **leave this screen entirely** → Manage.

### 5.6 ClubManageScreen (new — the leader console)

Sectioned settings list, gated by `canManageClub`/permission flags:

- **Club profile:** name/description/avatar (camera action moves here from the detail header), visibility, share link, delete club.
- **Roles & permissions:** role manager + officer permission matrix (today buried in Members).
- **Outreach:** the bulk outreach composer (audience picker, preview, send) as its own sub-flow.
- **Analytics:** the current metric cards + RSVP response rate move here as a sub-screen. Analytics is a leader tool; it should never have been a top-level member tab.
- **Attendance defaults / RSVP reminders** if/when those grow settings.

### 5.7 ClubMeetingsTonightScreen

Keep structure (live/soon/upcoming grouping). Rows link to MeetingDetail instead of the club root.

## 6. Shared component changes (`components/ui.tsx`, theme)

- **`ListRow`** — extend the existing component to support leading marks, badges, and trailing actions; it becomes the workhorse for directory, spaces, members, and manage rows.
- **`Sheet`** — already exists; announcement + meeting composers and the role editor migrate into it. Add a scrollable/keyboard-aware variant if missing.
- **New `MessageList`/`MessageComposer`** — extracted chat primitives (inverted list, docked input, typing row) so Pods/Threads can adopt the same pattern later.
- **New `MeetingCard`** — the date-badge + title + meta + RSVP block used on ClubHome, Events, and Tonight, in one place instead of three hand-rolled variants.
- **`SegmentedControl`** — for RSVP (Going / Maybe / Can't go) instead of three colored chips.
- **Density tokens** — add a `compact` row height + meta-line type style to the theme so list density is consistent rather than per-screen padding guesses.
- **Tilt/sticker budget** — convention, documented in `theme.ts` header: max one tilted element per card, stickers only on hero cards (Tonight rail, Next meeting, Spotlight-class moments). Dashed borders dropped from repeated rows.

## 7. Navigation changes (`App.tsx`)

Replace the two club routes with:

```
ClubDetail        clubs/:clubId            → ClubHomeScreen (route name kept for back-compat)
ClubChat          clubs/:clubId/chat/:channel
ClubEvents        clubs/:clubId/events
ClubMeeting       clubs/:clubId/events/:meetingId
ClubMembers       clubs/:clubId/members
ClubManage        clubs/:clubId/manage
ClubMeetingsTonight (unchanged)
```

A shared `useClub(clubId)` hook (context or query-cache) provides club + membership + permissions to all spokes so each screen doesn't refetch the world; meetings/messages/members fetch per-screen.

## 8. File structure

```
src/screens/clubs/
  ClubsHomeScreen.tsx      ClubHomeScreen.tsx      ClubChatScreen.tsx
  ClubEventsScreen.tsx     MeetingDetailScreen.tsx ClubMembersScreen.tsx
  ClubManageScreen.tsx     ClubMeetingsTonightScreen.tsx
src/components/clubs/
  ClubRow.tsx  MeetingCard.tsx  SpaceRow.tsx  MemberRow.tsx
src/hooks/useClub.ts
```

The 3,627-line file dissolves; no screen should exceed ~500 lines.

## 9. Phasing

| Phase | Work | Risk |
|---|---|---|
| 1 | Extract screens + routes from ClubDetailScreen, behavior-preserving (no visual change). Add `useClub`. | Low — pure restructuring, easiest to review |
| 2 | ClubsHomeScreen: My Clubs section, move search/chips, list rows, cut Spotlight | Low |
| 3 | ClubChatScreen rebuild (inverted list, docked composer, Sheet composers) | Medium — keyboard/scroll edge cases |
| 4 | Events list + MeetingDetail (attendance tooling moves) | Medium |
| 5 | ClubManageScreen: roles, permissions, outreach, analytics relocate | Low |
| 6 | Density/polish pass: tilt budget, SegmentedControl, ListRow consolidation app-wide | Low |

Each phase ships independently; Phase 1 unlocks everything else and fixes the worst structural debt without changing a pixel.

## 10. Open questions

1. Should "My Clubs" also surface on the Home tab (cross-feature), or stay inside Clubs?
2. Unread counts for chat channels require backend support (last-read markers) — in scope for Phase 3 or stubbed?
3. Is editorial "featured club" worth a backend flag, or is Spotlight permanently cut?
4. Should Pods adopt the same hub-and-spoke + chat primitives once clubs prove them out?
