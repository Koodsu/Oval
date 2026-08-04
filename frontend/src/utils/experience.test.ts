import { getActivityLiveCount, getFeaturedActivities, getOpenPodCount, getPodTitle, sortUpcomingPods } from './experience';
import type { Activity, Pod } from '../types';

const activity = (id: string, title: string): Activity => ({
  id,
  title,
  description: '',
  category: 'Social',
  defaultLocation: 'Oval',
  createdAt: new Date().toISOString(),
});

const pod = (id: string, activityId: string, meetupTime: string, status: Pod['status'] = 'FORMING'): Pod => ({
  id,
  activityId,
  meetupTime,
  location: 'Oval',
  locationType: 'public',
  minMembers: 2,
  maxMembers: 4,
  status,
  createdAt: meetupTime,
  members: [],
});

describe('experience utilities', () => {
  it('counts live pods per activity', () => {
    expect(getActivityLiveCount('a', [pod('1', 'a', '2026-04-26T12:00:00Z'), pod('2', 'a', '2026-04-26T13:00:00Z', 'LOCKED')])).toBe(1);
  });

  it('sorts pods by meetup time', () => {
    const sorted = sortUpcomingPods([
      pod('2', 'a', '2026-04-26T13:00:00Z'),
      pod('1', 'a', '2026-04-26T12:00:00Z'),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('surfaces featured activities by pod momentum', () => {
    const activities = [activity('a', 'Coffee'), activity('b', 'Run')];
    const featured = getFeaturedActivities(activities, [
      pod('1', 'b', '2026-04-26T12:00:00Z'),
      pod('2', 'b', '2026-04-26T13:00:00Z'),
      pod('3', 'a', '2026-04-26T14:00:00Z'),
    ]);
    expect(featured[0].id).toBe('b');
  });

  it('counts open pods', () => {
    expect(getOpenPodCount([
      pod('1', 'a', '2026-04-26T12:00:00Z'),
      pod('2', 'a', '2026-04-26T13:00:00Z', 'LOCKED'),
    ])).toBe(1);
  });

  it('uses the specific pod title before the activity fallback', () => {
    const named = { ...pod('p1', 'a', '2026-08-03T18:00:00.000Z'), title: 'Euchre at Morrill', activity: activity('a', 'Card Games') };
    const legacy = { ...pod('p2', 'a', '2026-08-03T19:00:00.000Z'), title: null, activity: activity('a', 'Card Games') };

    expect(getPodTitle(named)).toBe('Euchre at Morrill');
    expect(getPodTitle(legacy)).toBe('Card Games');
  });
});
