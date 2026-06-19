interface ChatItem {
  id: string;
  createdAt: string;
  reactions?: { emoji: string }[];
}

export function chatFingerprint(list: ChatItem[]): string {
  let reactions = 0;
  for (const m of list) reactions += m.reactions?.length ?? 0;
  return `${list.length}:${list[0]?.id ?? ''}:${list[list.length - 1]?.id ?? ''}:${reactions}`;
}

/**
 * Merge a freshly-polled "latest page" into the locally-held ascending list,
 * preserving any older history pages the user loaded. Messages inside the
 * polled window are replaced wholesale so reactions and deletions stay fresh.
 * Returns the original array when nothing changed (avoids re-render churn).
 */
export function mergeLatestPage<T extends ChatItem>(current: T[], page: T[]): T[] {
  if (!page.length) return current;
  const pageIds = new Set(page.map((m) => m.id));
  const pageStart = new Date(page[0].createdAt).getTime();
  const older = current.filter(
    (m) => !pageIds.has(m.id) && new Date(m.createdAt).getTime() < pageStart,
  );
  const merged = [...older, ...page];
  return chatFingerprint(merged) === chatFingerprint(current) ? current : merged;
}
