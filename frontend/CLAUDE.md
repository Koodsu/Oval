# Oval Frontend

Expo / React Native (Expo SDK 56, RN 0.85, React 19) iOS-first app. Entry: `App.tsx` (navigation, deep links, notification handlers, theme + auth providers).

## Commands

- `npm start` / `npm run ios` — Expo dev server
- `npm run typecheck` — `tsc --noEmit` (must pass)
- `npm test` — jest-expo; `npm run doctor` — expo-doctor
- `npm run export:ios` — static export sanity check
- Release builds: `eas build --platform ios --profile production`, then `eas submit` (see `../APP_STORE_SUBMISSION.md`)

## Structure

- `src/api.ts` — single API client; all network calls live here, not in screens.
- `src/screens/` — one file per screen; club screens under `screens/clubs/`.
- `src/components/ui.tsx` — shared primitives (Slab, Card, Sheet, Avatar, CountBubble, DateTimeField, SkeletonCard…). Reuse these; don't hand-roll cards/sheets.
- `src/theme.ts` — Lumen theme tokens, light + dark, via `ThemeProvider`/`useTheme`. Never hardcode colors in screens.
- `src/context/` — AuthContext (session, push-token registration on launch), ThemeProvider.
- `src/hooks/` — `useRealtimeChannel` (Supabase realtime, incl. inbox badge events), `useJoinPod`, permission hooks.
- `src/lib/referrals.ts` — referral capture from deep links.

## Conventions & gotchas

- **Navigation:** React Navigation native-stack + bottom tabs; deep-link config in `App.tsx` (`oval://…`). Push payloads carry a `url` routed through the same config — new pushes should include one.
- **Notifications:** handler + Android channel are set at module scope in `App.tsx`; token registration is `registerTokenIfGranted()` (called from AuthContext on every authed launch). Don't add a second registration path.
- **Chat lists are inverted FlatLists**; KeyboardAvoidingView is expected on every input screen.
- **expo-blur doesn't really blur on Android** — it renders a tint. Prefer solid theme surfaces for cards (see AUDIT_2026 D1).
- **Theme default is dark** and the stored preference loads async — beware of reintroducing the light-mode launch flash (AUDIT_2026 L8).
- Icon-only Pressables need `accessibilityLabel`.
- Web is a secondary target (`react-native-web`); platform-split files use `.web.tsx` (e.g. `CampusMap.web.tsx`). Guard native-only APIs with `Platform.OS !== 'web'`.
