import * as Sentry from '@sentry/react-native';

// Crash/error reporting. Safe to ship without a DSN configured — when
// EXPO_PUBLIC_SENTRY_DSN is absent, every call here is a no-op.
//
// PRIVACY POSTURE — deliberately anonymous.
// Oval is an 18+ social app whose users are identifiable OSU students, and whose
// core content is private messages. Sentry is configured to receive crashes and
// device/session context ONLY. Specifically:
//   - We never call Sentry.setUser(), so no user id, name or email is attached.
//   - sendDefaultPii is off, so IP addresses are not recorded.
//   - Console breadcrumbs are dropped entirely — anything we ever console.log
//     (message text, profile fields) would otherwise ride along on a crash.
//   - Query strings are stripped from network breadcrumbs. Home/Explore pass the
//     device's lat/lng as query params; without this they would land in Sentry
//     and re-create the exact leak that the morgan redaction in
//     backend/src/server.ts closes on the server side.
// Changing any of the above widens what leaves the device and requires updating
// the Play Data Safety declaration (docs/PLAY_DATA_SAFETY_2026-08.md).

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const monitoringEnabled = Boolean(dsn);

/** Remove the query string from a URL, keeping the path for debugging. */
function stripQueryString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const queryStart = value.indexOf('?');
  return queryStart === -1 ? value : value.slice(0, queryStart);
}

export function initMonitoring(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    // Errors and crashes are always captured; only performance tracing is sampled.
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
    environment: process.env.EXPO_PUBLIC_ENV ?? 'production',
    // Never attach IP address or other automatically-inferred identifiers.
    sendDefaultPii: false,

    beforeBreadcrumb(breadcrumb) {
      // Console output can contain message bodies and profile fields.
      if (breadcrumb.category === 'console') return null;

      // Network breadcrumbs: keep the endpoint, drop the query string.
      if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
        if (breadcrumb.data) {
          breadcrumb.data = { ...breadcrumb.data, url: stripQueryString(breadcrumb.data.url) };
        }
      }
      return breadcrumb;
    },

    beforeSend(event) {
      // Defence in depth — nothing should ever set these, so clear them if
      // a future SDK default or dependency starts populating them.
      delete event.user;
      if (event.request) {
        delete event.request.query_string;
        delete event.request.cookies;
        delete event.request.headers;
        event.request.url = stripQueryString(event.request.url) as string | undefined;
      }
      return event;
    },
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

// Wraps the root component for native crash + touch-event context when enabled.
export const wrapApp = <T,>(component: T): T =>
  monitoringEnabled ? (Sentry.wrap(component as never) as T) : component;
