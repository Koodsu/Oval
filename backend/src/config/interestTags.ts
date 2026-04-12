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
