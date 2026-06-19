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
} as const;

export function podTopic(podId: string): string {
  return `pod-${podId}`;
}

export function dmTopic(threadId: string): string {
  return `dm-${threadId}`;
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

  try {
    const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [{ topic, event, payload, private: false }],
      }),
    });
    if (!response.ok) {
      console.error(`[realtime] broadcast failed: ${response.status}`);
    }
  } catch (err) {
    console.error('[realtime] broadcast failed:', err);
  }
}
