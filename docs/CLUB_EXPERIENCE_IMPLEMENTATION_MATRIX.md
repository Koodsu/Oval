# Club Experience Implementation Matrix

This is the implementation contract for the 40 reference screens in
`docs/design-mockups-2026/club-experience-2026/screens/`. The mockups are an
art-direction source; shared production components and tokens are authoritative
when a generated board varies in spacing, radii, color, or control treatment.

## Standardized system

- Identity: `ClubIdentityHero`, `ClubPhoto`, and `clubIdentityImageFor` keep the
  same uploaded or curated club image across home, meeting, application, roster,
  and management surfaces.
- Structure: `AppBackdrop`, `ScreenHeader`, `Card`, `Sheet`, `Button`, `Chip`,
  `Field`, `ContentImage`, `ClubEmptyState`, and `SegmentedControl` provide the
  common spacing, typography, radii, borders, safe areas, and interaction states.
- Permissions: the backend returns effective `myPermissions`; the client hides
  or disables controls from that exact list. Owner-only ownership and destructive
  actions are separately gated.
- State: rich, empty, loading, restricted, error, and dark appearances use the
  same production screen rather than parallel mock-only implementations.

## Coverage

| Reference | Production implementation |
| --- | --- |
| 01-01 Club home — member | `ClubHomeScreen` rich member fixture and live data |
| 01-02 Club home — empty | `ClubHomeScreen` empty meeting/announcement state |
| 01-03 About and roles | `ClubHomeScreen` About tab and self-assign roles |
| 01-04 Club actions | `ClubHomeScreen` action sheet |
| 02-01 General chat | `ClubChatScreen` + `MessageList`; photos, captions, replies, reactions, typing |
| 02-02 Chat empty | `ClubChatScreen` semantic chat empty state |
| 02-03 Announcements | `ClubChatScreen` announcement channel and meeting attachments |
| 02-04 Private space | `ClubChatScreen` role/officer access recovery |
| 03-01 Events | `ClubEventsScreen` search, month rail, groups, and inline RSVP |
| 03-02 Events empty | `ClubEventsScreen` permission-aware empty action |
| 03-03 Meeting detail | `MeetingDetailScreen` identity art, RSVP, sharing, calendar, and location |
| 03-04 Live check-in | `MeetingDetailScreen` live code entry and progress |
| 04-01 Members | `ClubMembersScreen` searchable, role-aware roster |
| 04-02 Member search empty | `ClubMembersScreen` semantic no-results state |
| 04-03 Apply to join | `ClubApplyScreen` current application-cycle form |
| 04-04 Application status | `ClubApplyScreen` persistent status and withdrawal |
| 05-01 Officer desk | `ClubManageScreen` metrics and grouped controls |
| 05-02 Applications | `ClubApplicationsScreen` stage queue |
| 05-03 Applicant review | `ClubApplicationsScreen` private review sheet and review note |
| 05-04 Member actions | `ClubMembersScreen` promote, permissions, tags, and removal |
| 06-01 Roles | `ClubManageScreen` role editor, colors, self-assign, and ordering |
| 06-02 Channels | `ClubManageScreen` channel editor, access targets, and ordering |
| 06-03 Officer permissions | `ClubManageScreen` per-officer permission overrides |
| 06-04 Photo and identity | `ClubManageScreen` avatar, cover, name, description, category, and visibility |
| 07-01 New announcement | `ClubChatScreen` composer, audience, meeting attachment, and notification control |
| 07-02 Create meeting | `ClubEventsScreen` meeting composer |
| 07-03 Attendance console | `MeetingDetailScreen` open/close, code, progress, reminders, and export |
| 07-04 Bulk outreach | `ClubManageScreen` audience builder and recipient preview |
| 08-01 New application cycle | `ClubApplicationsScreen` title, questions, and close date |
| 08-02 Applications empty | `ClubApplicationsScreen` applications empty state |
| 08-03 Make discoverable | `ClubVerifyPrompt` verification and eligibility flow |
| 08-04 Delete club | `ClubManageScreen` owner-gated typed confirmation |
| 09-01 Dark club home | Theme-driven `ClubHomeScreen` |
| 09-02 Dark general chat | Theme-driven `ClubChatScreen` |
| 09-03 Dark meeting | Theme-driven `MeetingDetailScreen` |
| 09-04 Dark officer desk | Theme-driven `ClubManageScreen` |
| 10-01 Club load error | `ClubHomeScreen` recovery state and retry |
| 10-02 Meeting not found | `MeetingDetailScreen` recovery state |
| 10-03 Applications closed | `ClubApplyScreen` closed-cycle state |
| 10-04 Leader access required | `ClubManageScreen` restricted state |

## Added beyond the reference set

- Transfer ownership is available from the Officer desk to the current owner.
  The flow requires an eligible member selection and exact club-name
  confirmation, demotes the former owner to admin, repairs the club creator
  pointer, records immutable history, and is protected against concurrent
  transfers.
- Club-chat photos are moderated before storage, restricted to managed club
  media URLs, and removed from storage when a moderator deletes the message.

## Verification

- Backend club route suite: 74 tests.
- Full backend suite: 433 tests; frontend suite: 29 tests.
- Prisma production-baseline-to-current migration check.
- Backend TypeScript build, frontend TypeScript check, and landing production build.
- Repository release-policy check under Node 22.
- Expo Doctor: 21 of 21 checks; production iOS export completed.
- Production dependency audits: zero findings in backend, frontend, and landing.
- Deterministic development routes cover every one of the 40 references,
  including member, empty, restricted, officer-only, destructive, recovery,
  and dark-mode states. A 390×844 browser render audit captured all 40 without
  a runtime failure and visually checked the ten four-screen boards.
- Direct iOS Simulator renders of the light and dark member home, Officer desk,
  ownership transfer sheet, and media-rich general chat.
