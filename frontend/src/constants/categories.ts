import { Ionicons } from '@expo/vector-icons';

export interface CategoryMeta {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export const CATEGORIES: string[] = [
  'Sports & Fitness',
  'Food & Drink',
  'Academic',
  'Arts & Creative',
  'Social',
  'Outdoors',
  'Music & Entertainment',
  'Wellness',
  'Gaming',
  'Volunteering',
];

export const CATEGORY_META: Record<string, CategoryMeta> = {
  'Sports & Fitness': { label: 'Sports & Fitness', icon: 'fitness-outline', color: '#22c55e' },
  'Food & Drink': { label: 'Food & Drink', icon: 'restaurant-outline', color: '#f59e0b' },
  'Academic': { label: 'Academic', icon: 'book-outline', color: '#3b82f6' },
  'Arts & Creative': { label: 'Arts & Creative', icon: 'color-palette-outline', color: '#ec4899' },
  'Social': { label: 'Social', icon: 'people-outline', color: '#990000' },
  'Outdoors': { label: 'Outdoors', icon: 'leaf-outline', color: '#14b8a6' },
  'Music & Entertainment': { label: 'Music & Entertainment', icon: 'musical-notes-outline', color: '#f97316' },
  'Wellness': { label: 'Wellness', icon: 'heart-outline', color: '#06b6d4' },
  'Gaming': { label: 'Gaming', icon: 'game-controller-outline', color: '#ef4444' },
  'Volunteering': { label: 'Volunteering', icon: 'hand-left-outline', color: '#10b981' },
};
