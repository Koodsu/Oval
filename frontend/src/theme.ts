import { Platform, ViewStyle } from 'react-native';

export const colors = {
  primary: '#6366f1',
  primaryDark: '#4f46e5',
  violet: '#8b5cf6',
  gradient: ['#6366f1', '#8b5cf6'] as const,
  gradientSubtle: ['#eef2ff', '#e0e7ff', '#f5f3ff'] as const,

  amber: '#f59e0b',
  amberLight: '#fef3c7',
  green: '#22c55e',
  greenLight: '#dcfce7',
  blue: '#3b82f6',
  blueLight: '#dbeafe',
  red: '#ef4444',

  bg: '#f8f9fb',
  surface: '#ffffff',
  surfacePressed: '#f1f5f9',

  text: '#0f172a',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  textInverse: '#ffffff',

  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  divider: '#e2e8f0',

  chatMe: ['#6366f1', '#7c3aed'] as const,
  chatThem: '#f1f5f9',

  status: {
    FORMING: '#22c55e',
    LOCKED: '#3b82f6',
    COMPLETED: '#94a3b8',
  } as Record<string, string>,

  statusBg: {
    FORMING: '#dcfce7',
    LOCKED: '#dbeafe',
    COMPLETED: '#f1f5f9',
  } as Record<string, string>,

  avatarPalette: [
    '#6366f1',
    '#ec4899',
    '#f59e0b',
    '#22c55e',
    '#3b82f6',
    '#8b5cf6',
    '#14b8a6',
    '#f97316',
  ],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 56,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const typography = {
  hero: {
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    color: colors.text,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    color: colors.text,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.text,
  },
  h3: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.text,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: colors.text,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: colors.text,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.textSecondary,
  },
  tiny: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: colors.textTertiary,
  },
  label: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: colors.textTertiary,
  },
};

export const shadows: Record<string, ViewStyle> = {
  sm: Platform.select({
    ios: {
      shadowColor: '#0f172a',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    android: { elevation: 1 },
  }) ?? {},
  md: Platform.select({
    ios: {
      shadowColor: '#0f172a',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 3 },
  }) ?? {},
  lg: Platform.select({
    ios: {
      shadowColor: '#0f172a',
      shadowOpacity: 0.12,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 6 },
  }) ?? {},
};
