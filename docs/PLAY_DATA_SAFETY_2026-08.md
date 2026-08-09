# Google Play Data Safety — answer sheet

Derived from the code on 2026-08-06, not from memory. Every row cites where the
collection actually happens. Re-verify before submitting if the schema has moved.

**You fill this in yourself** at Play Console → Policy → App content → Data safety.
It cannot be automated or uploaded from the repo.

---

## Section 1: Data collection and security

| Question | Answer | Basis |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | See tables below |
| Is all user data encrypted in transit? | **Yes** | HTTPS only; Vercel enforces TLS. `helmet` set in `server.ts` |
| Do you provide a way for users to request data deletion? | **Yes** | `backend/src/lib/accountDeletion.ts` → `deleteUserAccount()`, exposed in-app |

On the deletion question, Play asks for a URL. Point it at the in-app path
(Settings → Delete account) and the web fallback on theovalapp.com.

---

## Section 2: Data types

### Personal info

| Data type | Collected | Shared | Optional? | Purpose | Where |
|---|---|---|---|---|---|
| Name | Yes | No | Required | App functionality, Account management | `User.name`, `firstName`, `lastName` |
| Email address | Yes | No | Required | App functionality, Account management | `User.email` (OSU verification gate) |
| User IDs | Yes | No | Required | App functionality | `User.id` (uuid) |
| Other info | Yes | No | Optional | App functionality | `bio`, `major`, `classYear`, `instagramHandle`, `interestTags`, `purpose`, `campusZones`, `clubInterests` |

Note: `instagramHandle` is a third-party social identifier. It's optional and
user-entered — declare it under "Other info", flag as optional.

### Photos and videos

| Data type | Collected | Shared | Optional? | Purpose | Where |
|---|---|---|---|---|---|
| Photos | Yes | No | Optional | App functionality | `expo-image-picker` → Supabase Storage via `avatarStorage.ts`; `User.avatarUrl`, club avatars, `ClubChatScreen` uploads |

### Messages

| Data type | Collected | Shared | Optional? | Purpose | Where |
|---|---|---|---|---|---|
| Other in-app messages | Yes | No | Required | App functionality | `Message`, `DirectMessage`, `ClubMessage`, `ClubOfficerMessage`, `ClubAnnouncement` models |

Play requires this for any app with chat. Do **not** mark messages as optional —
they're core functionality.

### App activity

| Data type | Collected | Shared | Optional? | Purpose | Where |
|---|---|---|---|---|---|
| App interactions | Yes | No | Required | Analytics, App functionality | `AnalyticsEvent` model; `trackEvent()` calls in `frontend/src/api.ts` |
| Other user-generated content | Yes | No | Required | App functionality | Pod titles, recaps, club content, reports |

`AnalyticsEvent.userId` is a real FK to User, so these events are **not**
anonymous. Declare purpose as Analytics and confirm it's linked to identity.

### App info and performance

**Depends on whether the Sentry DSN is set for the build you ship. See
"Sentry status" below — as of 2026-08-06 it is being switched on.**

### Sentry status

Sentry was dormant until 2026-08-06 — the DSN was unset in `eas.json`, in the
local `.env`, and in EAS environment variables, so `monitoringEnabled` was false
and every call no-opped.

It is now being enabled deliberately. **Once a build ships with
`EXPO_PUBLIC_SENTRY_DSN` set, answer:**

| Data type | Collected | Shared | Ephemeral | Required? | Purpose |
|---|---|---|---|---|---|
| Crash logs | Yes | No | No | Required | Analytics |
| Diagnostics | Yes | No | No | Required | Analytics |

- **Not "Shared"** — Sentry is a service provider processing on your behalf,
  which Google exempts.
- **Diagnostics as well as Crash logs**, because `enableAutoSessionTracking: true`
  and `tracesSampleRate: 0.1` send session health and performance traces, not
  just crashes.
- **Required**, because there is no user-facing opt-out. Building a toggle would
  let you answer "optional" instead.

**No new personal-data rows.** `monitoring.ts` is configured anonymously:
`Sentry.setUser()` is never called, `sendDefaultPii: false` suppresses IP
capture, `beforeSend` clears `event.user` defensively, console breadcrumbs are
dropped (they could otherwise carry message text or profile fields), and query
strings are stripped from network breadcrumbs — without that last one, Sentry
would capture the `?lat=&lng=` params and undo the morgan redaction on the client
side. So Name, Email, User IDs and Messages gain no new destination.

**If any of that changes, this declaration changes.** Attaching a user id or
email, or re-enabling console breadcrumbs, widens collection and must ship
together with an updated Data Safety form.

### Device or other IDs

| Data type | Collected | Shared | Optional? | Purpose | Where |
|---|---|---|---|---|---|
| Device or other IDs | Yes | No | Required | App functionality (push) | `User.pushToken` (Expo push token), `PushReceipt` model |

---

## The location question — read this before answering

This is the one genuinely ambiguous row, so decide deliberately.

**What the code does:** `frontend/src/hooks/useLocationPermission.ts` requests
foreground permission. `HomeScreen.tsx:602` and `ExploreScreen.tsx:393` send
`lat`/`lng` as query params to sort pods by proximity. `ActivityPodsScreen.tsx`
calls `reverseGeocodeAsync` / `geocodeAsync`.

**What is stored — read carefully, there are two different things here:**

- **The user's own device position is never stored.** The `User` model has no
  latitude/longitude column. The `lat`/`lng` sent from Home/Explore are used to
  sort pods by proximity for that request and discarded.
- **`Pod.latitude` / `Pod.longitude` DO exist** (`schema.prisma`, `model Pod`),
  but these are the *meetup venue's* coordinates, not anyone's device position.
  They are set either by tapping a pin on the campus map
  (`ActivityPodsScreen.handleMapPress`) or by geocoding a typed street address
  (`Location.geocodeAsync`). Both are deliberate user choices about where to
  meet, fenced to campus by `isCampusCoordinate`.

The distinction matters for the content rating questionnaire: because pod
coordinates are a chosen venue rather than a live position, Oval does **not**
"share the user's current and precise physical location with other users."

Google's data safety rules exempt data "processed ephemerally" (in memory, for
the current request only, never persisted). On a strict reading you could answer
**No** to location collection.

**Previously `morgan` broke this.** Morgan's default `url` token logs the full
request URL including `?lat=...&lng=...`, parking precise coordinates in retained
Vercel logs. **Fixed 2026-08-06:** `server.ts` now overrides the `url` token to
rewrite `lat` and `lng` to `REDACTED` while keeping the rest of the query string.
Coordinates are no longer written to any log.

With that in place, location collection **is** genuinely ephemeral — answer
"Yes, this collected data is processed ephemerally" on the Data Safety form.
Ephemeral data must still be disclosed but is not displayed on the public store
listing.

**Answer it as Precise, not Approximate.** `useLocationPermission.ts` calls
`Location.getCurrentPositionAsync({})` with no accuracy option, so expo-location
uses its default `Accuracy.Balanced` — roughly 100 m, about 0.03 km². Google's
cutoff for "Approximate" is an area of 3 km² or greater, so this falls well
inside **Precise location**.

Final answers for this row: Collected (not Shared) → **ephemeral: Yes** →
optional (the app works without the permission) → purpose: App functionality.

---

## Third parties — none require "shared"

"Shared" in Play's sense means transfer to a third party for *their* own use.
Service providers processing on your behalf don't count.

| Vendor | Role | Counts as "shared"? |
|---|---|---|
| Supabase (Postgres + Storage) | Data processor | No |
| Vercel | Hosting | No |
| Resend | Transactional email | No |
| Expo push (`expo-server-sdk`) | Push delivery | No |

So every row above can be answered **shared: No**. Worth stating plainly because
it's easy to over-declare here out of caution and end up with a scarier listing
than you've earned.

---

## Security practices to check

- [x] Data encrypted in transit
- [x] Users can request data deletion
- [x] Committed to Play Families Policy — **N/A**, app is 18+
- [ ] Independent security review — leave unchecked, you haven't had one

---

## Sequence

1. Content rating questionnaire first — it asks about UGC and messaging, and the
   answers should be consistent with this form.
2. Data safety form.
3. Target audience: **18+ only**. Do not select any age band under 18; that
   triggers Families Policy requirements you don't meet and don't want.
4. App access: reviewers hit `requireVerifiedAuth`. Provide the App Store
   reviewer bypass credentials under "All functionality is restricted" with
   instructions, same as iOS.
