export interface CategoryPillStyle {
  /** Short label inside the pill */
  label: string;
  pillBg: string;
  pillText: string;
  /** Light fill behind the emoji circle */
  emojiCircleBg: string;
}

/**
 * Category pill styles for home / activity cards (design spec + fallbacks).
 */
export function getCategoryPillStyle(category: string): CategoryPillStyle {
  switch (category) {
    case 'Sports & Fitness':
      return {
        label: 'Sports',
        pillBg: '#FEE2E2',
        pillText: '#CC0000',
        emojiCircleBg: '#FEE2E2',
      };
    case 'Academic':
      return {
        label: 'Academic',
        pillBg: '#EFF6FF',
        pillText: '#1D4ED8',
        emojiCircleBg: '#EFF6FF',
      };
    case 'Outdoors':
      return {
        label: 'Outdoors',
        pillBg: '#F0FDF4',
        pillText: '#16A34A',
        emojiCircleBg: '#DCFCE7',
      };
    case 'Food & Drink':
      return {
        label: 'Food',
        pillBg: '#FFF7ED',
        pillText: '#C2410C',
        emojiCircleBg: '#FFEDD5',
      };
    case 'Arts & Creative':
      return {
        label: 'Arts',
        pillBg: '#FCE7F3',
        pillText: '#BE185D',
        emojiCircleBg: '#FCE7F3',
      };
    case 'Social':
      return {
        label: 'Social',
        pillBg: '#F5F3FF',
        pillText: '#7C3AED',
        emojiCircleBg: '#F5F3FF',
      };
    case 'Music & Entertainment':
      return {
        label: 'Music',
        pillBg: '#FFEDD5',
        pillText: '#EA580C',
        emojiCircleBg: '#FFEDD5',
      };
    case 'Wellness':
      return {
        label: 'Wellness',
        pillBg: '#ECFEFF',
        pillText: '#0E7490',
        emojiCircleBg: '#CFFAFE',
      };
    case 'Gaming':
      return {
        label: 'Gaming',
        pillBg: '#FFF7ED',
        pillText: '#EA580C',
        emojiCircleBg: '#FFF7ED',
      };
    case 'Volunteering':
      return {
        label: 'Volunteer',
        pillBg: '#ECFDF5',
        pillText: '#047857',
        emojiCircleBg: '#D1FAE5',
      };
    default: {
      const short = category.split('&')[0]?.trim() ?? 'Activity';
      return {
        label: short.length > 12 ? `${short.slice(0, 12)}…` : short,
        pillBg: '#F4F4F5',
        pillText: '#52525B',
        emojiCircleBg: '#F4F4F5',
      };
    }
  }
}
