import { Platform, TextStyle, ViewStyle } from 'react-native';

const displayFamily = Platform.select({
  ios: 'Avenir Next',
  android: 'sans-serif-condensed',
  default: 'System',
});

const bodyFamily = Platform.select({
  ios: 'Avenir',
  android: 'sans-serif',
  default: 'System',
});

export const palette = {
  ink: '#10212B',
  slate: '#4E6673',
  mist: '#E7EEF1',
  paper: '#F7F4EE',
  cream: '#FBF9F4',
  white: '#FFFFFF',
  scarlet: '#C73B22',
  coral: '#F27A54',
  amber: '#E6A646',
  moss: '#4F745A',
  sky: '#5E8FCB',
  teal: '#3A8E92',
  shadow: 'rgba(16, 33, 43, 0.12)',
  shadowStrong: 'rgba(16, 33, 43, 0.18)',
  border: 'rgba(16, 33, 43, 0.08)',
  successBg: '#E8F6ED',
  successText: '#2C6A45',
  warnBg: '#FFF1DE',
  warnText: '#9A5E17',
  dangerBg: '#FCE8E4',
  dangerText: '#A03528',
};

export const gradients = {
  app: ['#F9F4EC', '#F3ECE3', '#EEF1EE'] as const,
  hero: ['#10212B', '#1B3845', '#2A5E66'] as const,
  heroSoft: ['rgba(255,255,255,0.88)', 'rgba(244,240,232,0.96)', 'rgba(232,239,241,0.92)'] as const,
  accent: ['#F7B267', '#F4845F', '#D35D6E'] as const,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 36,
};

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
};

export const typography: Record<string, TextStyle> = {
  display: {
    fontFamily: displayFamily,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -1,
    color: palette.white,
  },
  h1: {
    fontFamily: displayFamily,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.7,
    color: palette.ink,
  },
  h2: {
    fontFamily: displayFamily,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: palette.ink,
  },
  title: {
    fontFamily: displayFamily,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: palette.ink,
  },
  body: {
    fontFamily: bodyFamily,
    fontSize: 15,
    lineHeight: 22,
    color: palette.slate,
  },
  bodyStrong: {
    fontFamily: bodyFamily,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: palette.ink,
  },
  label: {
    fontFamily: bodyFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: palette.slate,
  },
};

export const shadows = {
  card: {
    shadowColor: palette.shadowStrong,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 6,
  } satisfies ViewStyle,
};
