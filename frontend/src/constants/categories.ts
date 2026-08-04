import { Ionicons } from '@expo/vector-icons';

export interface CategoryMeta {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export const CATEGORIES: string[] = [
  'Academic / Study',
  'Sports',
  'Fitness & Wellness',
  'Social & Events',
  'Gaming',
  'Volunteering',
  'Food',
  'Music & Arts',
];

export const CATEGORY_META: Record<string, CategoryMeta> = {
  'Academic / Study': { label: 'Academic / Study', icon: 'book-outline', color: '#3b82f6' },
  Sports: { label: 'Sports', icon: 'basketball-outline', color: '#22c55e' },
  'Fitness & Wellness': { label: 'Fitness & Wellness', icon: 'fitness-outline', color: '#06b6d4' },
  'Social & Events': { label: 'Social & Events', icon: 'people-outline', color: '#990000' },
  'Gaming': { label: 'Gaming', icon: 'game-controller-outline', color: '#ef4444' },
  'Volunteering': { label: 'Volunteering', icon: 'hand-left-outline', color: '#10b981' },
  Food: { label: 'Food', icon: 'restaurant-outline', color: '#f59e0b' },
  'Music & Arts': { label: 'Music & Arts', icon: 'color-palette-outline', color: '#ec4899' },
};
