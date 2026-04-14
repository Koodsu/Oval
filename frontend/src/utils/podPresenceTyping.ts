/** One row from Supabase Realtime `channel.presenceState()` values. */
export type PresenceStateRow = Record<string, unknown>;

export type TypingUser = { userId: string };

/**
 * Parse Supabase presence state for pod chat: other users currently typing.
 * Dedupes by userId (multiple presence keys / tabs).
 */
export function parseTypingUsersFromPresenceState(
  state: Record<string, PresenceStateRow[]>,
  currentUserId: string | undefined
): TypingUser[] {
  const seen = new Set<string>();
  const out: TypingUser[] = [];

  for (const metas of Object.values(state)) {
    if (!Array.isArray(metas)) continue;
    for (const meta of metas) {
      if (!meta || typeof meta !== 'object') continue;
      const userId = meta.userId;
      const typing = meta.typing;
      if (typing !== true || typeof userId !== 'string' || !userId) continue;
      if (currentUserId && userId === currentUserId) continue;
      if (seen.has(userId)) continue;
      seen.add(userId);
      out.push({ userId });
    }
  }

  return out;
}
