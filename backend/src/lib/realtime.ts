/**
 * Lightweight realtime fan-out via Supabase Realtime's broadcast REST API.
 *
 * Why this design: the backend deploys to serverless (Vercel), where a
 * persistent WebSocket server can't live. Supabase Realtime holds the client
 * sockets instead; the API just POSTs a broadcast message after each write.
 *
 * Security: payloads are *pings only* (no chat content). Clients react to a
 * ping by refetching through the authenticated REST API, which enforces
 * membership/blocking. Knowing a topic name only leaks "something happened
 * in pod X", never what.
 *
 * When SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing (tests, local
 * dev), broadcasts are skipped and clients silently fall back to polling.
 */

export const REALTIME_EVENTS = {
  NEW_MESSAGE: 'new_message',
  MESSAGE_UPDATE: 'message_update',
  TYPING: 'typing',
  INBOX_UPDATED: 'inbox_updated',
  STATE_UPDATED: 'state_updated',
} as const;

export const SHARED_STATE_TOPIC = 'app-state';

export function podTopic(podId: string): string {
  return `pod-${podId}`;
}

export function dmTopic(threadId: string): string {
  return `dm-${threadId}`;
}

export function userTopic(userId: string): string {
  return `user-${userId}`;
}

export function clubChannelTopic(clubId: string, channelId: string): string {
  return `club-${clubId}-channel-${channelId}`;
}

export function createBroadcastRequest(
  key: string,
  topic: string,
  event: string,
  payload: Record<string, unknown>,
): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Supabase's current publishable/secret keys are opaque rather than JWTs.
      // Sending an sb_secret_* key as a Bearer token returns 401, while the
      // apikey header works for both current keys and legacy service_role JWTs.
      apikey: key,
    },
    body: JSON.stringify({
      messages: [{ topic, event, payload, private: false }],
    }),
  };
}

export async function broadcast(
  topic: string,
  event: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return;
  if (process.env.NODE_ENV === 'test') return;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await fetch(
      `${url}/realtime/v1/api/broadcast`,
      {
        ...createBroadcastRequest(key, topic, event, payload),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      console.error(`[realtime] broadcast failed: ${response.status}`);
    }
  } catch (err) {
    console.error('[realtime] broadcast failed:', err);
  } finally {
    clearTimeout(timeoutId);
  }
}
