export interface InterestTagMeta {
  label: string;
  color: string;
  bg: string;
}

export const INTEREST_TAG_META: Record<string, InterestTagMeta> = {
  Art:         { label: 'Art',         color: '#ec4899', bg: '#fce7f3' },
  Dance:       { label: 'Dance',       color: '#a855f7', bg: '#f3e8ff' },
  Engineering: { label: 'Engineering', color: '#3b82f6', bg: '#dbeafe' },
  Film:        { label: 'Film',        color: '#0ea5e9', bg: '#e0f2fe' },
  Food:        { label: 'Food',        color: '#f97316', bg: '#ffedd5' },
  Gaming:      { label: 'Gaming',      color: '#a855f7', bg: '#f3e8ff' },
  'Greek Life':{ label: 'Greek Life',  color: '#0ea5e9', bg: '#e0f2fe' },
  Gym:         { label: 'Gym',         color: '#ef4444', bg: '#fee2e2' },
  Music:       { label: 'Music',       color: '#14b8a6', bg: '#ccfbf1' },
  Outdoors:    { label: 'Outdoors',    color: '#22c55e', bg: '#dcfce7' },
  Photography: { label: 'Photography', color: '#d97706', bg: '#fef3c7' },
  'Pre-Med':   { label: 'Pre-Med',     color: '#06b6d4', bg: '#cffafe' },
  Reading:     { label: 'Reading',     color: '#78716c', bg: '#f5f5f4' },
  Sports:      { label: 'Sports',      color: '#16a34a', bg: '#bbf7d0' },
  Tech:        { label: 'Tech',        color: '#2563eb', bg: '#dbeafe' },
  Volunteering:{ label: 'Volunteering',color: '#65a30d', bg: '#ecfccb' },
};

export const INTEREST_TAGS = Object.keys(INTEREST_TAG_META).sort() as string[];
