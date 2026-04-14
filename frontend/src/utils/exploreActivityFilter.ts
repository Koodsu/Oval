import type { Activity, Pod } from '../types';

export type ExploreTimeFilter = 'all' | 'today' | 'week';

const JOINABLE_STATUSES = new Set<string>(['FORMING', 'LOCKED']);

function isSameLocalCalendarDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function isInNextSevenDays(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  const weekFromNow = new Date(ref.getTime() + 7 * 86_400_000);
  return d >= ref && d <= weekFromNow;
}

/** Activity IDs that have at least one joinable pod in the feed matching the time window. */
export function activityIdsWithPodsMatchingTimeFilter(
  pods: Pod[],
  timeFilter: Exclude<ExploreTimeFilter, 'all'>,
  ref: Date = new Date()
): Set<string> {
  const ids = new Set<string>();
  for (const p of pods) {
    if (!JOINABLE_STATUSES.has(p.status)) continue;
    const aid = p.activity?.id ?? p.activityId;
    if (!aid) continue;
    if (timeFilter === 'today' && !isSameLocalCalendarDay(p.meetupTime, ref)) continue;
    if (timeFilter === 'week' && !isInNextSevenDays(p.meetupTime, ref)) continue;
    ids.add(aid);
  }
  return ids;
}

export function filterActivitiesForExplore(
  activities: Activity[],
  pods: Pod[],
  timeFilter: ExploreTimeFilter,
  searchQuery: string,
  ref: Date = new Date()
): Activity[] {
  let list = activities;
  if (timeFilter !== 'all') {
    const allowed = activityIdsWithPodsMatchingTimeFilter(pods, timeFilter, ref);
    list = list.filter((a) => allowed.has(a.id));
  }

  const q = searchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.defaultLocation.toLowerCase().includes(q)
    );
  }

  return [...list].sort((a, b) => {
    const ac = a._count?.pods ?? 0;
    const bc = b._count?.pods ?? 0;
    if (bc !== ac) return bc - ac;
    return a.title.localeCompare(b.title);
  });
}
