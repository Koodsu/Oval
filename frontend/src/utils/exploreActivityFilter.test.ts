import type { Activity, Pod } from '../types';
import {
  activityIdsWithPodsMatchingTimeFilter,
  filterActivitiesForExplore,
} from './exploreActivityFilter';

const act = (id: string, title = 'T'): Activity => ({
  id,
  title,
  description: 'd',
  category: 'Academic',
  defaultLocation: 'loc',
  createdAt: new Date().toISOString(),
  _count: { pods: 1 },
});

function pod(
  activityId: string,
  meetupTime: string,
  status: Pod['status'] = 'FORMING',
  activity?: Activity
): Pod {
  const a = activity ?? act(activityId);
  return {
    id: `pod-${activityId}-${meetupTime}`,
    activityId,
    meetupTime,
    location: 'Somewhere',
    locationType: 'public',
    minMembers: 2,
    maxMembers: 4,
    status,
    createdAt: new Date().toISOString(),
    members: [],
    activity: a,
  };
}

describe('activityIdsWithPodsMatchingTimeFilter', () => {
  const ref = new Date(2026, 5, 15, 12, 0, 0, 0);

  it('includes activity when a FORMING pod meetup is today', () => {
    const p = pod('a1', new Date(2026, 5, 15, 18, 0, 0, 0).toISOString(), 'FORMING');
    const ids = activityIdsWithPodsMatchingTimeFilter([p], 'today', ref);
    expect(ids.has('a1')).toBe(true);
  });

  it('excludes COMPLETED pods', () => {
    const p = pod('a1', new Date(2026, 5, 15, 18, 0, 0, 0).toISOString(), 'COMPLETED');
    const ids = activityIdsWithPodsMatchingTimeFilter([p], 'today', ref);
    expect(ids.has('a1')).toBe(false);
  });

  it('week window includes future meetup within 7 days', () => {
    const p = pod('a2', new Date(2026, 5, 18, 12, 0, 0, 0).toISOString(), 'LOCKED');
    const ids = activityIdsWithPodsMatchingTimeFilter([p], 'week', ref);
    expect(ids.has('a2')).toBe(true);
  });
});

describe('filterActivitiesForExplore', () => {
  const ref = new Date(2026, 5, 15, 12, 0, 0, 0);
  const activities = [act('x', 'Zebra'), act('y', 'Apple')];
  activities[0]._count = { pods: 2 };
  activities[1]._count = { pods: 1 };

  it('sorts by pod count then title when time is all', () => {
    const pods: Pod[] = [];
    const out = filterActivitiesForExplore(activities, pods, 'all', '', ref);
    expect(out.map((a) => a.id)).toEqual(['x', 'y']);
  });

  it('filters by search query', () => {
    const out = filterActivitiesForExplore(activities, [], 'all', 'Apple', ref);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('y');
  });

  it('restricts to activities with pods in window for today', () => {
    const pods = [pod('x', new Date(2026, 5, 15, 9, 0, 0, 0).toISOString(), 'FORMING', activities[0])];
    const out = filterActivitiesForExplore(activities, pods, 'today', '', ref);
    expect(out.map((a) => a.id)).toEqual(['x']);
  });
});
