import { Activity, Pod } from '../types';

export function getActivityLiveCount(activityId: string, pods: Pod[]): number {
  return pods.filter((pod) => pod.activityId === activityId && pod.status === 'FORMING').length;
}

export function sortUpcomingPods(pods: Pod[]): Pod[] {
  return [...pods].sort(
    (a, b) => new Date(a.meetupTime).getTime() - new Date(b.meetupTime).getTime()
  );
}

export function getFeaturedActivities(activities: Activity[], pods: Pod[]): Activity[] {
  return [...activities]
    .sort((a, b) => {
      const podDiff = getActivityLiveCount(b.id, pods) - getActivityLiveCount(a.id, pods);
      if (podDiff !== 0) return podDiff;
      return a.title.localeCompare(b.title);
    })
    .slice(0, 8);
}

export function getOpenPodCount(pods: Pod[]): number {
  return pods.filter((pod) => pod.status === 'FORMING').length;
}
