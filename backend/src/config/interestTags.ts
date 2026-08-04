export const INTEREST_TAGS = [
  'Art',
  'Dance',
  'Engineering',
  'Film',
  'Food',
  'Gaming',
  'Greek Life',
  'Gym',
  'Music',
  'Outdoors',
  'Photography',
  'Pre-Med',
  'Reading',
  'Sports',
  'Tech',
  'Volunteering',
] as const;

export type InterestTag = (typeof INTEREST_TAGS)[number];

export const INTEREST_TAG_SET = new Set<string>(INTEREST_TAGS);

export const TAG_TO_CATEGORY: Record<InterestTag, string> = {
  Art: 'Music & Arts',
  Dance: 'Music & Arts',
  Engineering: 'Academic / Study',
  Film: 'Social & Events',
  Food: 'Food',
  Gaming: 'Gaming',
  'Greek Life': 'Social & Events',
  Gym: 'Fitness & Wellness',
  Music: 'Music & Arts',
  Outdoors: 'Fitness & Wellness',
  Photography: 'Music & Arts',
  'Pre-Med': 'Academic / Study',
  Reading: 'Academic / Study',
  Sports: 'Sports',
  Tech: 'Academic / Study',
  Volunteering: 'Volunteering',
};

export function parseInterestTags(raw: string | null | undefined): InterestTag[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((tag): tag is InterestTag => INTEREST_TAG_SET.has(tag));
  } catch {
    return [];
  }
}

export function getInterestCategories(raw: string | null | undefined): Set<string> {
  return new Set(parseInterestTags(raw).map((tag) => TAG_TO_CATEGORY[tag]));
}
