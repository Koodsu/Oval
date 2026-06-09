# Bridge App Store Submission Draft

Use this with `PUBLIC_RELEASE_GATE.md`. Replace bracketed values in App Store
Connect; do not invent answers to fields that depend on the seller account.

## Metadata

- App name: `Bridge - Campus Life`
- Subtitle: `Find plans and campus clubs`
- Primary category: Social Networking
- Secondary category: Lifestyle
- Bundle ID: `com.bradyvb.bridgeapp`
- Audited production binary: `[PENDING NEW PRODUCTION BUILD]`
- Support URL: `https://www.joinbridgeapp.com/support`
- Marketing URL: `https://www.joinbridgeapp.com`
- Privacy URL: `https://www.joinbridgeapp.com/privacy`
- Copyright: `[YEAR] [LEGAL SELLER NAME]`
- Price: Free
- In-app purchases: None

The public US App Store search already returns multiple products using "Bridge,"
including active business, finance, and card-game apps. Treat the name as crowded,
not cleared, until the trademark and App Store review is complete.

EAS iOS build 21 completed successfully with Node 22, but it predates the June 9,
2026 product-polish pass. Do not submit it; create the final binary from the release
commit after the remaining production and account gates are complete.

### Description

Bridge helps eligible Ohio State community members find real plans, join small
activity pods, and stay connected with campus clubs.

Browse activities happening around campus, create or join a pod, coordinate in
group chat, and turn a good meetup into an ongoing connection. Clubs can publish
meetings and announcements, manage attendance, and stay discoverable beyond the
involvement fair.

Bridge includes in-app reporting, blocking, account deletion, and privacy-data
export. An eligible OSU email address is required, but email verification is not an
identity check or a guarantee of current enrollment.

Bridge is for adults age 18 and older. It is not affiliated with or endorsed by
The Ohio State University.

## App Privacy Draft

Confirm these against the final App Store Connect wording. Bridge does not use
third-party advertising and does not track users across other companies' apps or
websites.

| Apple category | Bridge examples | Linked to user | Purpose |
| --- | --- | --- | --- |
| Contact Info | Name and OSU email | Yes | App functionality, account security |
| Precise Location | Coordinates used for nearby pods or meetup locations | Yes | App functionality |
| User Content | Profile/club images, messages, pod and club content, support requests | Yes | App functionality, safety |
| Identifiers | Bridge user ID and push token | Yes | App functionality, notifications, security |
| Usage Data | First-party feature-use events and social interactions | Yes | Analytics, app functionality |
| Diagnostics | Request and error records needed to operate and secure the service | May be linked | App functionality, security |
| Other Data | Attendance, friendships, blocks, reports, moderation records, and recaps | Yes | App functionality, safety |

Material service providers are Vercel, Supabase, Resend, Expo Push, OpenAI
moderation, and Apple. The public Privacy Policy contains the fuller disclosure.

## Review Notes Draft

Bridge is an 18+ social planning and club app for users with an eligible Ohio State
email domain. It has no subscriptions, purchases, paid content, or advertising.

Reviewer account:

- Email: `[PREVERIFIED REVIEWER EMAIL]`
- Password: `[REVIEWER PASSWORD]`

The reviewer account must already be email-verified, have accepted the current
Terms, and contain realistic sample pods, clubs, and messages.

Important paths:

- Report/block: open a message or user profile and choose the safety action.
- Community Guidelines: Settings > Community Guidelines.
- Export/delete account: Settings > Privacy & Data.
- Password reset: sign-in screen > Forgot password.
- Support: Settings > Contact support or `https://www.joinbridgeapp.com/support`.

Location and notification permissions are optional. Users may enter meetup
locations manually. Bridge verifies control of an eligible email address; it does
not perform identity or background checks. The production moderation inbox remains
monitored during review.

## Owner Inputs Still Required

1. Confirm the legal seller/entity and copyright name.
2. Clear the product name before spending on screenshots or promotion.
3. Create the App Store Connect record and add its numeric Apple ID as
   `submit.production.ascAppId` in `frontend/eas.json`.
4. Complete the current App Privacy and age-rating questionnaires in App Store
   Connect using the final policy and build.
5. Add a preverified reviewer account and its credentials.
6. Upload screenshots captured from the approved production build.
7. Run TestFlight and physical-device testing before submission.
