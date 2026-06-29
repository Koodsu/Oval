import * as Sentry from '@sentry/react-native';

// Crash/error reporting. Safe to ship without a DSN configured — when
// EXPO_PUBLIC_SENTRY_DSN is absent, every call here is a no-op.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const monitoringEnabled = Boolean(dsn);

export function initMonitoring(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    // Errors and crashes are always captured; only performance tracing is sampled.
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
    environment: process.env.EXPO_PUBLIC_ENV ?? 'production',
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

// Wraps the root component for native crash + touch-event context when enabled.
export const wrapApp = <T,>(component: T): T =>
  monitoringEnabled ? (Sentry.wrap(component as never) as T) : component;
