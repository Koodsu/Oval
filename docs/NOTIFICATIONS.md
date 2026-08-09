# Notification system and copy

Updated Aug. 9, 2026. The source of truth for generated copy is
`backend/src/lib/notificationCopy.ts`; this document is the product-facing
catalog and release checklist.

## Rules

- Every push must say what happened, name the relevant person/plan/club when
  available, and deep-link to the exact next action.
- Never print zero-value vanity stats. Weekly planning stays silent unless at
  least one joinable plan matches the member.
- Message previews collapse whitespace and stop at 110 characters.
- Transactional plan changes and reminders may interrupt. Conversations and
  club updates use normal priority. Discovery and weekly suggestions are
  low-priority and silent.
- Non-transactional pushes share a one-per-member-per-day budget.
- Every notification category shown below has an in-app preference.

## Copy catalog

| Event | Title | Body | Android channel |
| --- | --- | --- | --- |
| Someone joins | `{Maya} joined {Coffee Crawl}` | `{3} of {5} spots filled · {Saturday at 11:00 AM}` | Plans |
| Plan invite | `{Maya} invited you to {Coffee Crawl}` | `{Saturday at 11:00 AM} · {Short North} · {2 spots left}` | Plans |
| Plan time changed | `{Coffee Crawl} moved to {Saturday at 1:00 PM}` | Updated time and location | Plans |
| Plan location changed | `New location for {Coffee Crawl}` | Updated time and location | Plans |
| Plan canceled | `{Coffee Crawl} was canceled` | `{Saturday at 11:00 AM} is no longer happening.` | Plans |
| Pod message | `{Maya} · {Coffee Crawl}` | Message preview | Messages |
| Direct message | `{Maya}` | Message preview | Messages |
| Friend request | `{Maya} sent you a friend request` | `Open your Inbox to respond.` | Messages |
| One-hour reminder | `{Coffee Crawl} starts in 1 hour` | `{11:00 AM} at {Short North} · {4 people} going` | Plans |
| First-plan nudge | `Your first Oval plan is today` | Plan, time, location, and who is going | Plans |
| Post-plan rating | `How was {Coffee Crawl}?` | `Tap to rate it—it takes about 10 seconds.` | Plans |
| Waitlist opening | `A spot opened in {Coffee Crawl}` | `Join within 30 minutes before it goes to the next person.` | Plans |
| Twin plan | `Another {Coffee Crawl} opened` | Time, location, and `You have first look.` | Plans |
| Demand threshold | `{4} people are up for {Pickup Soccer}` | `Pick a time and start the plan.` | Discovery |
| Matching plan created | `{Pickup Soccer} is happening {tomorrow}` | Time, location, and `Join while spots are open.` | Discovery |
| Weekly planning, no attendance | `{3} plans match your interests` | `See what's forming around campus this week.` | Discovery |
| Weekly planning, attended | `You made it to {2} plans this week` | New people when nonzero, then matching plans for the coming week | Discovery |
| Club chat | `{Maya} · {Oval Builders} #{general}` | Message preview | Messages |
| Club role mention | `{Maya} mentioned {@officers}` | Club, channel, and message preview | Messages |
| Club meeting | `{Oval Builders} added {Weekly meeting}` | Date, time, and location | Clubs |
| Club announcement | `New from {Oval Builders}` | Announcement preview | Clubs |
| Club role change | `You're now an {officer} in {Oval Builders}` | Updated-permissions action | Clubs |
| Club removal | `You're no longer in {Oval Builders}` | `Your club membership was updated.` | Clubs |
| Attendance opens | `Check in to {Weekly meeting}` | `{Oval Builders} is meeting now.` | Plans |
| RSVP reminder | `Are you going to {Weekly meeting}?` | Club, date, and time | Clubs |
| Leader outreach | `Message from {Oval Builders}` | Leader-written preview | Clubs |

## Release verification

1. Deploy the backend so server-generated copy, recipient rules, preferences,
   ticket handling, and new triggers are live.
2. Install a native Android build; an OTA update cannot change notification
   icons or Android channel definitions.
3. On a physical Android device, allow notifications and verify token
   registration, foreground/background/killed delivery, the white Oval status
   icon, channel priority, and tap-through deep links.
4. Check an accepted Expo ticket's receipt after 15 minutes and confirm a
   `DeviceNotRegistered` result clears the stored token.
5. Verify weekly planning on Sunday evening with zero history, singular counts,
   prior co-attendees, no matching plans, and multiple matching plans.

