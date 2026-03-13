/**
 * In-memory store for typing indicators.
 * Keys: "pod:{podId}" or "dm:{threadId}"
 * Values: Map<userId, lastTypingAt>
 * TTL: 5 seconds
 */

const TTL_MS = 5000;

const store = new Map<string, Map<string, number>>();

function prune(key: string): void {
  const m = store.get(key);
  if (!m) return;
  const now = Date.now();
  for (const [uid, ts] of m.entries()) {
    if (now - ts > TTL_MS) m.delete(uid);
  }
  if (m.size === 0) store.delete(key);
}

export function setTyping(type: 'pod' | 'dm', id: string, userId: string): void {
  const key = `${type}:${id}`;
  let m = store.get(key);
  if (!m) {
    m = new Map();
    store.set(key, m);
  }
  m.set(userId, Date.now());
}

export function getTypingUserIds(type: 'pod' | 'dm', id: string, excludeUserId?: string): string[] {
  const key = `${type}:${id}`;
  prune(key);
  const m = store.get(key);
  if (!m) return [];
  const now = Date.now();
  const userIds: string[] = [];
  for (const [uid, ts] of m.entries()) {
    if (uid === excludeUserId) continue;
    if (now - ts <= TTL_MS) userIds.push(uid);
  }
  return userIds;
}
