import type { RequestHandler, Response } from 'express';
import {
  broadcast,
  REALTIME_EVENTS,
  SHARED_STATE_TOPIC,
  userTopic,
} from '../lib/realtime';
import type { AuthRequest } from './auth';

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

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Converts a successful API mutation into a content-free invalidation ping.
 * Chat, read receipts, typing, analytics, auth, and private device settings
 * have dedicated behavior and intentionally do not wake unrelated screens.
 */
export function sharedStateScopesForRequest(
  method: string,
  originalUrl: string,
): SharedStateScope[] {
  if (!MUTATION_METHODS.has(method.toUpperCase())) return [];

  const path = originalUrl.split('?')[0].replace(/\/+$/, '') || '/';

  if (
    path.startsWith('/auth')
    || path.startsWith('/analytics')
    || path.startsWith('/cron')
    || path.startsWith('/waitlist')
    || path.startsWith('/reports')
    || path.endsWith('/typing')
    || path === '/users/push-token'
    || path === '/users/notifications'
  ) {
    return [];
  }

  // Room-level topics update the open chat itself. This broader scope updates
  // unread counts, previews, and inbox rows elsewhere without reloading feeds.
  if (
    path.startsWith('/messages')
    || (/^\/pods\/[^/]+\/messages(?:\/|$)/).test(path)
    || (/^\/clubs\/[^/]+\/(?:messages|officer-messages)(?:\/|$)/).test(path)
    || (/^\/clubs\/[^/]+\/channels\/[^/]+\/(?:messages|typing|read)(?:\/|$)/).test(path)
  ) {
    return ['messages'];
  }

  if (path.startsWith('/pods')) return ['pods'];
  if (path.startsWith('/clubs')) return ['clubs'];
  if (path.startsWith('/friends')) return ['friends', 'users', 'inbox'];
  if (path.startsWith('/users')) return ['users', 'friends', 'pods', 'clubs'];
  if (path.startsWith('/activities')) return ['activities', 'pods'];
  if (path.startsWith('/admin')) return ['admin', 'activities', 'clubs'];
  return [];
}

/**
 * Waits for Supabase to accept the ping before ending the response. This is
 * important on Vercel, where background work may be frozen as soon as the
 * serverless response completes.
 */
export const sharedStateInvalidation: RequestHandler = (req, res, next) => {
  const scopes = sharedStateScopesForRequest(req.method, req.originalUrl || req.url);
  if (!scopes.length) {
    next();
    return;
  }

  const originalEnd = res.end;
  let ending = false;

  res.end = function delayedEnd(...args: unknown[]) {
    if (ending || res.statusCode < 200 || res.statusCode >= 400) {
      return originalEnd.apply(res, args as Parameters<Response['end']>);
    }

    ending = true;
    const broadcasts = [
      broadcast(
        SHARED_STATE_TOPIC,
        REALTIME_EVENTS.STATE_UPDATED,
        { scopes },
      ),
    ];
    const actorUserId = (req as AuthRequest).user?.userId;
    if (actorUserId && scopes.includes('users')) {
      broadcasts.push(broadcast(
        userTopic(actorUserId),
        REALTIME_EVENTS.STATE_UPDATED,
        { scopes: ['users'] },
      ));
    }

    void Promise.all(broadcasts).finally(() => {
      originalEnd.apply(res, args as Parameters<Response['end']>);
    });
    return res;
  } as Response['end'];

  next();
};
