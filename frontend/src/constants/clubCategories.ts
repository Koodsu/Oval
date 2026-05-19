export const CLUB_CATEGORIES = [
  'Sports & Fitness',
  'Food & Drink',
  'Academic',
  'Business',
  'STEM',
  'Arts & Creative',
  'Social',
  'Outdoors',
  'Music & Entertainment',
  'Wellness',
  'Gaming',
  'Volunteering',
  'Other',
] as const;

const CLUB_CATEGORY_ALIASES: Record<string, string[]> = {
  'Sports & Fitness': ['Sports'],
  'Arts & Creative': ['Arts'],
  Volunteering: ['Service'],
};

export function clubCategoryMatches(category: string, filter: string | null) {
  if (!filter) return true;

  const normalizedCategory = category.trim().toLowerCase();
  const matches = [filter, ...(CLUB_CATEGORY_ALIASES[filter] ?? [])]
    .map((item) => item.toLowerCase());

  return matches.includes(normalizedCategory);
}
