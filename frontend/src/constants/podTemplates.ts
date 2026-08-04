import type { Activity } from '../types';
import type { CreatePodOptions } from '../api';

export type PodTemplate = {
  id: string;
  activityTitle: string;
  label: string;
  detail: string;
  location: string;
  maxMembers: number;
  anchor: 'evening' | 'weekend_afternoon';
};

export const POD_TEMPLATES: PodTemplate[] = [
  {
    id: 'boba-tonight',
    activityTitle: 'Grab coffee or tea',
    label: 'Boba run',
    detail: 'Tonight near the Union',
    location: 'Ohio Union',
    maxMembers: 5,
    anchor: 'evening',
  },
  {
    id: 'study-thompson',
    activityTitle: 'Study group',
    label: 'Study grind',
    detail: 'Focused work at Thompson',
    location: 'Thompson Library',
    maxMembers: 6,
    anchor: 'evening',
  },
  {
    id: 'pickup-hoops',
    activityTitle: 'Pickup basketball',
    label: 'Pickup hoops',
    detail: 'Run a game at RPAC',
    location: 'RPAC',
    maxMembers: 8,
    anchor: 'weekend_afternoon',
  },
  {
    id: 'soccer-sat',
    activityTitle: 'Pickup soccer',
    label: 'Soccer kickaround',
    detail: 'Casual touches outside',
    location: 'Lincoln Tower Park',
    maxMembers: 10,
    anchor: 'weekend_afternoon',
  },
  {
    id: 'board-games',
    activityTitle: 'Board games',
    label: 'Board games',
    detail: 'Low-key table at the Union',
    location: 'Ohio Union',
    maxMembers: 6,
    anchor: 'evening',
  },
  {
    id: 'movie-night',
    activityTitle: 'Movie / watch party',
    label: 'Movie night',
    detail: 'Pick something together',
    location: 'Ohio Union',
    maxMembers: 6,
    anchor: 'evening',
  },
  {
    id: 'mirror-lake',
    activityTitle: 'Casual hangout',
    label: 'Mirror Lake hang',
    detail: 'Walk, sit, decompress',
    location: 'Mirror Lake',
    maxMembers: 5,
    anchor: 'evening',
  },
  {
    id: 'yoga-reset',
    activityTitle: 'Yoga',
    label: 'Yoga reset',
    detail: 'Easy reset session',
    location: 'RPAC – Wellness Space',
    maxMembers: 6,
    anchor: 'weekend_afternoon',
  },
  {
    id: 'smash-night',
    activityTitle: 'Video games',
    label: 'Smash bracket',
    detail: 'Friendly games, no sweat',
    location: 'Ohio Union – Esports Arena',
    maxMembers: 8,
    anchor: 'evening',
  },
  {
    id: 'campus-cleanup',
    activityTitle: 'Other volunteering',
    label: 'Campus cleanup',
    detail: 'Bring a friend, do some good',
    location: 'Ohio Union – Service Hub',
    maxMembers: 8,
    anchor: 'weekend_afternoon',
  },
];

export function templatesForActivity(activity: Pick<Activity, 'title'>): PodTemplate[] {
  return POD_TEMPLATES.filter((template) => template.activityTitle === activity.title);
}

export function resolveTemplateActivity(
  template: PodTemplate,
  activities: Activity[],
): Activity | null {
  return activities.find((activity) => activity.title === template.activityTitle) ?? null;
}

export function nextAnchorWindow(anchor: PodTemplate['anchor'] = 'evening', now = new Date()): Date {
  const minimum = new Date(now.getTime() + 45 * 60 * 1000);

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    const day = candidate.getDay();

    if (anchor === 'weekend_afternoon') {
      if (day !== 0 && day !== 6) continue;
      candidate.setHours(14, 0, 0, 0);
    } else {
      candidate.setHours(day === 5 || day === 6 ? 20 : 19, 30, 0, 0);
    }

    if (candidate > minimum) return candidate;
  }

  const fallback = new Date(now);
  fallback.setDate(now.getDate() + 1);
  fallback.setHours(19, 30, 0, 0);
  return fallback;
}

export function anchorWindowLabel(date: Date, now = new Date()): string {
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startDate.getTime() - startToday.getTime()) / (24 * 60 * 60 * 1000));
  const hour = date.getHours();
  const isAfternoon = hour < 17;

  if (dayDiff === 0) return isAfternoon ? 'This afternoon' : 'Tonight';
  if (dayDiff === 1) return isAfternoon ? 'Tomorrow afternoon' : 'Tomorrow night';
  return date.toLocaleDateString([], { weekday: 'long' });
}

export function templateCreateOptions(template: PodTemplate, now = new Date()): CreatePodOptions {
  return {
    minMembers: 2,
    maxMembers: template.maxMembers,
    location: template.location,
    meetupTime: nextAnchorWindow(template.anchor, now).toISOString(),
    template: template.id,
  };
}

export function customCreateDefaults(now = new Date()): Pick<CreatePodOptions, 'meetupTime' | 'maxMembers' | 'template'> {
  return {
    meetupTime: nextAnchorWindow('evening', now).toISOString(),
    maxMembers: 4,
    template: 'custom',
  };
}
