import type { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../theme';

/**
 * Club category visual identity — every category gets a stable icon, a
 * cinematic three-stop gradient, and a theme accent key. This replaces the
 * old "gradient by list index" approach so a club always looks like itself.
 */

export type ClubGradient = readonly [string, string, string];

export type ClubCategoryVisual = {
  icon: keyof typeof Ionicons.glyphMap;
  gradient: ClubGradient;
  /** Key into ThemeColors for the category accent (e.g. 'violet'). */
  accent: 'primary' | 'violet' | 'teal' | 'amber' | 'pink' | 'blue' | 'green';
};

const VISUALS: Record<string, ClubCategoryVisual> = {
  'Sports & Fitness': {
    icon: 'basketball-outline',
    gradient: ['#0E1F1A', '#1F6A50', '#3DC98A'],
    accent: 'green',
  },
  'Food & Drink': {
    icon: 'restaurant-outline',
    gradient: ['#201307', '#8A5A0F', '#E89B0C'],
    accent: 'amber',
  },
  Academic: {
    icon: 'school-outline',
    gradient: ['#0F1524', '#2C4A8A', '#6B9DFF'],
    accent: 'blue',
  },
  Business: {
    icon: 'briefcase-outline',
    gradient: ['#0D1620', '#1F4E5E', '#3DA5C2'],
    accent: 'teal',
  },
  STEM: {
    icon: 'rocket-outline',
    gradient: ['#1A1026', '#5B3A8C', '#9D6BDE'],
    accent: 'violet',
  },
  'Arts & Creative': {
    icon: 'color-palette-outline',
    gradient: ['#220C16', '#8C2350', '#E73774'],
    accent: 'pink',
  },
  Social: {
    icon: 'sparkles-outline',
    gradient: ['#1C0E0A', '#7C1F15', '#E04A2C'],
    accent: 'primary',
  },
  Outdoors: {
    icon: 'trail-sign-outline',
    gradient: ['#0C1B14', '#1E5C3B', '#4CAF6E'],
    accent: 'green',
  },
  'Music & Entertainment': {
    icon: 'musical-notes-outline',
    gradient: ['#170E22', '#4E2A7E', '#A36BDE'],
    accent: 'violet',
  },
  Wellness: {
    icon: 'leaf-outline',
    gradient: ['#0E1D1D', '#176A6A', '#3DC2C2'],
    accent: 'teal',
  },
  Gaming: {
    icon: 'game-controller-outline',
    gradient: ['#0E1228', '#33388E', '#7B7FF2'],
    accent: 'blue',
  },
  Volunteering: {
    icon: 'ribbon-outline',
    gradient: ['#1F0D12', '#92274B', '#E7558B'],
    accent: 'pink',
  },
  Other: {
    icon: 'people-outline',
    gradient: ['#15161D', '#27182B', '#53204A'],
    accent: 'primary',
  },
};

const CATEGORY_ALIASES: Record<string, string> = {
  sports: 'Sports & Fitness',
  arts: 'Arts & Creative',
  service: 'Volunteering',
  music: 'Music & Entertainment',
};

const GRADIENT_POOL: ClubGradient[] = Object.values(VISUALS).map((visual) => visual.gradient);

function resolveCategory(category?: string | null): string {
  if (!category) return 'Other';
  const trimmed = category.trim();
  if (VISUALS[trimmed]) return trimmed;
  const aliased = CATEGORY_ALIASES[trimmed.toLowerCase()];
  if (aliased) return aliased;
  const match = Object.keys(VISUALS).find(
    (key) => key.toLowerCase() === trimmed.toLowerCase()
  );
  return match ?? 'Other';
}

export function clubCategoryVisual(category?: string | null): ClubCategoryVisual {
  return VISUALS[resolveCategory(category)];
}

/** Accent tint + soft background for a category, resolved from the theme. */
export function clubAccent(colors: ThemeColors, category?: string | null) {
  const accent = clubCategoryVisual(category).accent;
  if (accent === 'primary') {
    return { tint: colors.primary, soft: colors.primarySoft };
  }
  return {
    tint: colors[accent],
    soft: colors[`${accent}Soft` as const],
  };
}

/** Stable gradient for entities without a category (hashes the seed). */
export function clubGradientForSeed(seed: string): ClubGradient {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return GRADIENT_POOL[hash % GRADIENT_POOL.length];
}
