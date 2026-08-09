import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { clearApiCache, getMe } from '../api';
import { useAuth } from './AuthContext';
import { useRealtimeChannel } from '../hooks/useRealtimeChannel';

export const SHARED_STATE_SCOPES = [
  'pods',
  'clubs',
  'friends',
  'users',
  'activities',
  'messages',
  'inbox',
  'admin',
] as const;

export type SharedStateScope = (typeof SHARED_STATE_SCOPES)[number];
type Versions = Record<SharedStateScope, number>;

const INITIAL_VERSIONS: Versions = {
  pods: 0,
  clubs: 0,
  friends: 0,
  users: 0,
  activities: 0,
  messages: 0,
  inbox: 0,
  admin: 0,
};

const SharedStateInvalidationContext = createContext<Versions>(INITIAL_VERSIONS);
const VALID_SCOPES = new Set<string>(SHARED_STATE_SCOPES);

export function scopesFromRealtimePayload(payload: Record<string, unknown>): SharedStateScope[] {
  if (!Array.isArray(payload.scopes)) return [];
  return [...new Set(payload.scopes.filter(
    (scope): scope is SharedStateScope => typeof scope === 'string' && VALID_SCOPES.has(scope),
  ))];
}

export function SharedStateInvalidationProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUser } = useAuth();
  const [versions, setVersions] = useState<Versions>(INITIAL_VERSIONS);

  const invalidate = useCallback((scopes: readonly SharedStateScope[]) => {
    if (!scopes.length) return;
    clearApiCache();
    setVersions((current) => {
      const next = { ...current };
      for (const scope of scopes) next[scope] += 1;
      return next;
    });
  }, []);

  const connected = useRealtimeChannel(
    user ? 'app-state' : null,
    ['state_updated'],
    ({ payload }) => invalidate(scopesFromRealtimePayload(payload)),
  );

  useRealtimeChannel(
    user ? `user-${user.id}` : null,
    ['state_updated'],
    ({ payload }) => {
      if (!scopesFromRealtimePayload(payload).includes('users')) return;
      clearApiCache();
      void getMe().then((latestUser) => updateUser(latestUser)).catch(() => {});
    },
  );

  // Reconnect/app-resume safety net: realtime is the instant path, while this
  // bounds staleness if the socket drops or the OS suspends the app.
  useEffect(() => {
    if (!user) return undefined;
    const interval = setInterval(
      () => invalidate(SHARED_STATE_SCOPES),
      connected ? 60_000 : 20_000,
    );
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') invalidate(SHARED_STATE_SCOPES);
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [connected, invalidate, user]);

  return (
    <SharedStateInvalidationContext.Provider value={versions}>
      {children}
    </SharedStateInvalidationContext.Provider>
  );
}

export function useSharedStateVersion(...scopes: SharedStateScope[]): string {
  const versions = useContext(SharedStateInvalidationContext);
  return useMemo(
    () => scopes.map((scope) => `${scope}:${versions[scope]}`).join('|'),
    // `scopes` is intentionally represented as a stable primitive key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versions, scopes.join('|')],
  );
}
