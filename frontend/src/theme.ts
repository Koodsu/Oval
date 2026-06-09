import React, {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Appearance,
  ColorSchemeName,
  StyleSheet,
  TextStyle,
  ViewStyle,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// Bridge Design System — "Campus Sunset"
// Warm paper canvas in light, rich charcoal in dark, one vivid sunset brand
// gradient, Sora display type + Inter UI type, spring-driven motion.
// ─────────────────────────────────────────────────────────────────────────────

export const fonts = {
  display: 'Sora_700Bold',
  displayHeavy: 'Sora_800ExtraBold',
  displayMedium: 'Sora_600SemiBold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export type ThemeColors = {
  // canvas
  bg: string;
  surface: string;
  surfaceAlt: string;
  glass: string;
  glassStrong: string;
  scrim: string;
  // text
  ink: string;
  sub: string;
  faint: string;
  onPrimary: string;
  onHero: string;
  heroSub: string;
  // lines
  border: string;
  borderStrong: string;
  // brand
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  primarySoftText: string;
  // accents (category color wheel)
  violet: string;
  violetSoft: string;
  teal: string;
  tealSoft: string;
  amber: string;
  amberSoft: string;
  pink: string;
  pinkSoft: string;
  blue: string;
  blueSoft: string;
  green: string;
  greenSoft: string;
  // status
  successBg: string;
  successText: string;
  warnBg: string;
  warnText: string;
  dangerBg: string;
  dangerText: string;
  danger: string;
  // misc
  shadow: string;
  tabBar: string;
  inputBg: string;
  skeleton: string;
  heroCard: string;
};

export const lightColors: ThemeColors = {
  bg: '#F7F5F1',
  surface: '#FFFFFF',
  surfaceAlt: '#EFECE6',
  glass: 'rgba(255,255,255,0.78)',
  glassStrong: 'rgba(255,255,255,0.92)',
  scrim: 'rgba(15,17,23,0.45)',

  ink: '#13151C',
  sub: '#5A6170',
  faint: '#9AA0AD',
  onPrimary: '#FFFFFF',
  onHero: '#FFFFFF',
  heroSub: 'rgba(255,255,255,0.72)',

  border: 'rgba(19,21,28,0.07)',
  borderStrong: 'rgba(19,21,28,0.14)',

  primary: '#EF3E1B',
  primaryPressed: '#CC2B0C',
  primarySoft: '#FEE9E2',
  primarySoftText: '#B22A0E',

  violet: '#6F55F2',
  violetSoft: '#EEEAFE',
  teal: '#0E9595',
  tealSoft: '#E0F4F4',
  amber: '#E89B0C',
  amberSoft: '#FCF0D8',
  pink: '#E73774',
  pinkSoft: '#FDE7F0',
  blue: '#2F6FE4',
  blueSoft: '#E5EEFD',
  green: '#1E9D63',
  greenSoft: '#E1F5EB',

  successBg: '#E1F5EB',
  successText: '#176C45',
  warnBg: '#FCF0D8',
  warnText: '#8F5E07',
  dangerBg: '#FEE9E2',
  dangerText: '#A82A10',
  danger: '#DC3413',

  shadow: '#2A1D14',
  tabBar: 'rgba(255,255,255,0.86)',
  inputBg: 'rgba(19,21,28,0.045)',
  skeleton: 'rgba(19,21,28,0.08)',
  heroCard: '#191C26',
};

export const darkColors: ThemeColors = {
  bg: '#0C0D11',
  surface: '#16181F',
  surfaceAlt: '#1E2129',
  glass: 'rgba(22,24,31,0.78)',
  glassStrong: 'rgba(22,24,31,0.94)',
  scrim: 'rgba(0,0,0,0.6)',

  ink: '#F4F5F8',
  sub: '#A6ADBC',
  faint: '#6C7383',
  onPrimary: '#FFFFFF',
  onHero: '#FFFFFF',
  heroSub: 'rgba(255,255,255,0.66)',

  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',

  primary: '#FF5A33',
  primaryPressed: '#E5431D',
  primarySoft: 'rgba(255,90,51,0.16)',
  primarySoftText: '#FF8A6B',

  violet: '#9D8AFF',
  violetSoft: 'rgba(132,108,255,0.18)',
  teal: '#3DC2C2',
  tealSoft: 'rgba(38,178,178,0.16)',
  amber: '#FFB938',
  amberSoft: 'rgba(255,176,32,0.16)',
  pink: '#FF6BA0',
  pinkSoft: 'rgba(244,66,124,0.18)',
  blue: '#6B9DFF',
  blueSoft: 'rgba(79,134,247,0.18)',
  green: '#3DC98A',
  greenSoft: 'rgba(34,160,107,0.18)',

  successBg: 'rgba(34,160,107,0.18)',
  successText: '#5BD89C',
  warnBg: 'rgba(255,176,32,0.16)',
  warnText: '#FFC95E',
  dangerBg: 'rgba(255,90,51,0.16)',
  dangerText: '#FF8A6B',
  danger: '#FF5A33',

  shadow: '#000000',
  tabBar: 'rgba(15,16,21,0.88)',
  inputBg: 'rgba(255,255,255,0.06)',
  skeleton: 'rgba(255,255,255,0.08)',
  heroCard: '#191C26',
};

export type ThemeGradients = {
  brand: readonly [string, string, ...string[]];
  brandSoft: readonly [string, string, ...string[]];
  hero: readonly [string, string, ...string[]];
  app: readonly [string, string, ...string[]];
  card: readonly [string, string, ...string[]];
};

export const lightGradients: ThemeGradients = {
  brand: ['#FF8A3D', '#F23E16', '#D8173F'],
  brandSoft: ['#FFF1E6', '#FEE9E2'],
  hero: ['#15161D', '#27182B', '#511F39'],
  app: ['#F9F6F1', '#F6F3EE', '#F3F1ED'],
  card: ['#FFFFFF', '#FBFAF7'],
};

export const darkGradients: ThemeGradients = {
  brand: ['#FF8A3D', '#F23E16', '#D8173F'],
  brandSoft: ['rgba(255,138,61,0.14)', 'rgba(216,23,63,0.12)'],
  hero: ['#15161D', '#27182B', '#511F39'],
  app: ['#0C0D11', '#0E0F14', '#11121A'],
  card: ['#16181F', '#14161C'],
};

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 36,
};

export const radii = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
};

export const motion = {
  fast: 140,
  base: 220,
  slow: 380,
  spring: { damping: 19, stiffness: 260, mass: 0.8 },
  springGentle: { damping: 22, stiffness: 180, mass: 1 },
  springBouncy: { damping: 13, stiffness: 230, mass: 0.7 },
};

export function getTypography(colors: ThemeColors): Record<string, TextStyle> {
  return {
    display: {
      fontFamily: fonts.displayHeavy,
      fontSize: 34,
      lineHeight: 40,
      letterSpacing: -1.2,
      color: colors.ink,
    },
    h1: {
      fontFamily: fonts.display,
      fontSize: 27,
      lineHeight: 33,
      letterSpacing: -0.8,
      color: colors.ink,
    },
    h2: {
      fontFamily: fonts.display,
      fontSize: 20,
      lineHeight: 26,
      letterSpacing: -0.4,
      color: colors.ink,
    },
    title: {
      fontFamily: fonts.displayMedium,
      fontSize: 16.5,
      lineHeight: 22,
      letterSpacing: -0.2,
      color: colors.ink,
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
      color: colors.sub,
    },
    bodyStrong: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      lineHeight: 22,
      color: colors.ink,
    },
    label: {
      fontFamily: fonts.bold,
      fontSize: 11,
      lineHeight: 15,
      textTransform: 'uppercase',
      letterSpacing: 1.4,
      color: colors.faint,
    },
    caption: {
      fontFamily: fonts.medium,
      fontSize: 12.5,
      lineHeight: 17,
      color: colors.faint,
    },
  };
}

export function getShadows(isDark: boolean, colors: ThemeColors) {
  return {
    card: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.5 : 0.07,
      shadowRadius: 24,
      elevation: 5,
    } satisfies ViewStyle,
    raised: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: isDark ? 0.6 : 0.12,
      shadowRadius: 32,
      elevation: 9,
    } satisfies ViewStyle,
    subtle: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.35 : 0.05,
      shadowRadius: 10,
      elevation: 2,
    } satisfies ViewStyle,
    glow: {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.45 : 0.3,
      shadowRadius: 18,
      elevation: 7,
    } satisfies ViewStyle,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme context
// ─────────────────────────────────────────────────────────────────────────────

export type AppearancePreference = 'system' | 'light' | 'dark';

export type Theme = {
  isDark: boolean;
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  gradients: ThemeGradients;
  typography: Record<string, TextStyle>;
  shadows: ReturnType<typeof getShadows>;
  preference: AppearancePreference;
  setPreference: (pref: AppearancePreference) => void;
};

function buildTheme(
  scheme: 'light' | 'dark',
  preference: AppearancePreference,
  setPreference: (pref: AppearancePreference) => void,
): Theme {
  const isDark = scheme === 'dark';
  const colors = isDark ? darkColors : lightColors;
  return {
    isDark,
    scheme,
    colors,
    gradients: isDark ? darkGradients : lightGradients,
    typography: getTypography(colors),
    shadows: getShadows(isDark, colors),
    preference,
    setPreference,
  };
}

const noop = () => {};
const defaultTheme = buildTheme('light', 'system', noop);

const ThemeContext = createContext<Theme>(defaultTheme);

const APPEARANCE_KEY = 'bridge.appearance';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>('system');
  const hydrated = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(APPEARANCE_KEY)
      .then((value) => {
        if (value === 'light' || value === 'dark' || value === 'system') {
          setPreferenceState(value);
        }
      })
      .catch(noop)
      .finally(() => {
        hydrated.current = true;
      });
  }, []);

  const setPreference = useCallback((pref: AppearancePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(APPEARANCE_KEY, pref).catch(noop);
  }, []);

  const resolved: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const theme = useMemo(
    () => buildTheme(resolved, preference, setPreference),
    [resolved, preference, setPreference],
  );

  return createElement(ThemeContext.Provider, { value: theme }, children);
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Create a theme-aware StyleSheet hook.
 *
 *   const useStyles = createThemedStyles((t) => ({ card: { backgroundColor: t.colors.surface } }));
 *   ...
 *   const styles = useStyles();
 */
export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (t: Theme) => T,
): () => T {
  const cache = new Map<string, T>();
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => {
      const key = theme.scheme;
      const cached = cache.get(key);
      if (cached) return cached;
      const created = StyleSheet.create(factory(theme));
      cache.set(key, created);
      return created;
    }, [theme]);
  };
}

/** Resolve the current scheme outside React (rare; prefer useTheme). */
export function getSystemScheme(): 'light' | 'dark' {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy static exports (light theme). Prefer useTheme()/createThemedStyles.
// ─────────────────────────────────────────────────────────────────────────────

export const palette = {
  ink: lightColors.ink,
  slate: lightColors.sub,
  mist: lightColors.surfaceAlt,
  paper: lightColors.bg,
  cream: lightColors.bg,
  white: lightColors.surface,
  scarlet: lightColors.primary,
  coral: '#FF7A4D',
  amber: lightColors.amber,
  moss: lightColors.green,
  sky: lightColors.blue,
  teal: lightColors.teal,
  shadow: 'rgba(19,21,28,0.12)',
  shadowStrong: 'rgba(19,21,28,0.18)',
  border: lightColors.border,
  successBg: lightColors.successBg,
  successText: lightColors.successText,
  warnBg: lightColors.warnBg,
  warnText: lightColors.warnText,
  dangerBg: lightColors.dangerBg,
  dangerText: lightColors.dangerText,
};

export const gradients = {
  app: lightGradients.app,
  hero: lightGradients.hero,
  heroSoft: ['rgba(255,255,255,0.9)', 'rgba(250,246,240,0.96)', 'rgba(244,242,238,0.92)'] as const,
  accent: lightGradients.brand,
};

export const typography = getTypography(lightColors);

export const shadows = {
  card: getShadows(false, lightColors).card,
};
