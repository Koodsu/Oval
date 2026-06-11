import React from 'react';
import { StyleSheet, TextStyle, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BRIDGE DESIGN SYSTEM — "Scarlet Press"
 *
 * A neo-brutalist campus-zine language built for OSU students:
 *  - Warm paper surfaces with hard ink borders
 *  - Flat offset "slab" shadows that surfaces physically press down into
 *  - OSU scarlet as the loud anchor + a crayon box of category accents
 *  - Unbounded for display type, Space Grotesk for everything else
 *  - Sticker-tilt details, uppercase kickers, chunky radii
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Fonts ────────────────────────────────────────────────────────────────────

export const fonts = {
  /** Unbounded 800 — hero numerals, splash moments */
  displayHeavy: 'Unbounded-ExtraBold',
  /** Unbounded 700 — screen titles */
  display: 'Unbounded-Bold',
  /** Unbounded 600 — card titles, medium display */
  displayMedium: 'Unbounded-SemiBold',
  /** Space Grotesk 400 — body copy */
  body: 'SpaceGrotesk-Regular',
  /** Space Grotesk 500 */
  medium: 'SpaceGrotesk-Medium',
  /** Space Grotesk 600 */
  semibold: 'SpaceGrotesk-SemiBold',
  /** Space Grotesk 700 — buttons, labels, kickers */
  bold: 'SpaceGrotesk-Bold',
} as const;

// ── Colors ───────────────────────────────────────────────────────────────────

export type ThemeColors = {
  /** App background — warm paper / warm ink */
  bg: string;
  /** Card surface */
  surface: string;
  /** Secondary surface (inset panels, input wells) */
  surfaceAlt: string;
  /** Recessed surface (track of switches, code wells) */
  sunken: string;
  /** Primary text */
  ink: string;
  /** Secondary text */
  sub: string;
  /** Tertiary text / disabled */
  faint: string;
  /** Hard structural border (the neo-brutal line) */
  border: string;
  /** Soft hairline for quiet separation */
  borderSoft: string;
  /** Hard offset shadow color */
  shadow: string;
  /** Translucent wash used for overlays on imagery/maps */
  glass: string;
  /** Modal scrim */
  overlay: string;
  /** Tab bar / chrome fill */
  tabBar: string;

  /** Scarlet — the brand */
  primary: string;
  primaryPress: string;
  primarySoft: string;
  onPrimary: string;

  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;

  /** Category crayon box */
  blue: string;
  blueSoft: string;
  green: string;
  greenSoft: string;
  amber: string;
  amberSoft: string;
  pink: string;
  pinkSoft: string;
  violet: string;
  violetSoft: string;
  teal: string;
  tealSoft: string;
};

export const lightColors: ThemeColors = {
  bg: '#F5EDDD',
  surface: '#FFFCF2',
  surfaceAlt: '#EFE5CF',
  sunken: '#E7DBC1',
  ink: '#1D1408',
  sub: '#70614A',
  faint: '#A6967D',
  border: '#1D1408',
  borderSoft: '#DCCFAF',
  shadow: '#1D1408',
  glass: 'rgba(29, 20, 8, 0.10)',
  overlay: 'rgba(29, 20, 8, 0.55)',
  tabBar: '#FFFCF2',

  primary: '#C8102E',
  primaryPress: '#9C0A22',
  primarySoft: '#F8D6CC',
  onPrimary: '#FFF6E8',

  danger: '#B00D26',
  dangerSoft: '#F8D6CC',
  success: '#15833E',
  successSoft: '#D6EFD4',
  warning: '#D98E04',
  warningSoft: '#FAEBC4',

  blue: '#2459D9',
  blueSoft: '#D9E4FA',
  green: '#15833E',
  greenSoft: '#D6EFD4',
  amber: '#D98E04',
  amberSoft: '#FAEBC4',
  pink: '#D6336C',
  pinkSoft: '#FAD9E4',
  violet: '#6D3FD4',
  violetSoft: '#E6DCFA',
  teal: '#0E7E8A',
  tealSoft: '#D2EEF0',
};

export const darkColors: ThemeColors = {
  bg: '#181210',
  surface: '#241C16',
  surfaceAlt: '#2F251C',
  sunken: '#120D0A',
  ink: '#F6EBD5',
  sub: '#BFAE90',
  faint: '#85765F',
  border: '#EFE2C5',
  borderSoft: '#3D3226',
  shadow: '#000000',
  glass: 'rgba(246, 235, 213, 0.10)',
  overlay: 'rgba(0, 0, 0, 0.65)',
  tabBar: '#241C16',

  primary: '#F23A47',
  primaryPress: '#C61F30',
  primarySoft: '#46191A',
  onPrimary: '#FFF6E8',

  danger: '#FF5A66',
  dangerSoft: '#46191A',
  success: '#4CC878',
  successSoft: '#16301E',
  warning: '#FFC14D',
  warningSoft: '#3A2D12',

  blue: '#6E9CFF',
  blueSoft: '#1C2A4A',
  green: '#4CC878',
  greenSoft: '#16301E',
  amber: '#FFC14D',
  amberSoft: '#3A2D12',
  pink: '#FF7CAB',
  pinkSoft: '#3D1826',
  violet: '#AE8BFF',
  violetSoft: '#2A1F44',
  teal: '#4FD0DC',
  tealSoft: '#103238',
};

// ── Layout tokens ────────────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

/** Hard offset for the signature slab shadow. */
export const SLAB_OFFSET = 4;
/** Standard hard border width. */
export const BORDER_W = 2;
/** Space screens must reserve above the bottom dock. */
export const DOCK_CLEARANCE = 104;

// ── Motion ───────────────────────────────────────────────────────────────────

export const motion = {
  /** Press-into-shadow spring */
  springPress: { damping: 22, stiffness: 420, mass: 0.7 },
  /** Snappy UI movement */
  springSnappy: { damping: 19, stiffness: 280, mass: 0.9 },
  /** Sticker pop */
  springBouncy: { damping: 12, stiffness: 200, mass: 0.9 },
  durFast: 140,
  durBase: 220,
  durSlow: 320,
  /** Stagger step for list entrances */
  stagger: 45,
} as const;

// ── Typography ───────────────────────────────────────────────────────────────

export function getTypography(colors: ThemeColors): Record<string, TextStyle> {
  return {
    /** Unbounded 800 — splash numbers, auth hero */
    hero: {
      fontFamily: fonts.displayHeavy,
      fontSize: 30,
      lineHeight: 37,
      letterSpacing: -0.8,
      color: colors.ink,
    },
    /** Unbounded 700 — screen titles */
    display: {
      fontFamily: fonts.display,
      fontSize: 23,
      lineHeight: 29,
      letterSpacing: -0.5,
      color: colors.ink,
    },
    /** Unbounded 600 — section/card display titles */
    title: {
      fontFamily: fonts.displayMedium,
      fontSize: 17.5,
      lineHeight: 23,
      letterSpacing: -0.3,
      color: colors.ink,
    },
    /** Grotesk 700 — entity names, list titles */
    heading: {
      fontFamily: fonts.bold,
      fontSize: 16.5,
      lineHeight: 21,
      color: colors.ink,
    },
    /** Grotesk 600 — emphasized body */
    subheading: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      lineHeight: 20,
      color: colors.ink,
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 21,
      color: colors.ink,
    },
    bodyMedium: {
      fontFamily: fonts.medium,
      fontSize: 15,
      lineHeight: 21,
      color: colors.ink,
    },
    caption: {
      fontFamily: fonts.medium,
      fontSize: 13,
      lineHeight: 18,
      color: colors.sub,
    },
    captionSmall: {
      fontFamily: fonts.medium,
      fontSize: 11.5,
      lineHeight: 15,
      color: colors.faint,
    },
    /** SHOUTY KICKER — section eyebrow labels */
    kicker: {
      fontFamily: fonts.bold,
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.sub,
    },
    button: {
      fontFamily: fonts.bold,
      fontSize: 15.5,
      lineHeight: 20,
      color: colors.ink,
    },
    chip: {
      fontFamily: fonts.semibold,
      fontSize: 13,
      lineHeight: 17,
      color: colors.ink,
    },
  };
}

// ── Theme context ────────────────────────────────────────────────────────────

export type AppearancePreference = 'system' | 'light' | 'dark';

const APPEARANCE_KEY = 'bridge.appearance.v2';

export type Theme = {
  colors: ThemeColors;
  typography: Record<string, TextStyle>;
  isDark: boolean;
  scheme: 'light' | 'dark';
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
};

const ThemeContext = React.createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = React.useState<AppearancePreference>('system');

  React.useEffect(() => {
    AsyncStorage.getItem(APPEARANCE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      })
      .catch(() => {});
  }, []);

  const setPreference = React.useCallback((next: AppearancePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(APPEARANCE_KEY, next).catch(() => {});
  }, []);

  const scheme: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const isDark = scheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const value = React.useMemo<Theme>(
    () => ({
      colors,
      typography: getTypography(colors),
      isDark,
      scheme,
      preference,
      setPreference,
    }),
    [colors, isDark, scheme, preference, setPreference],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): Theme {
  const theme = React.useContext(ThemeContext);
  if (!theme) {
    // Sensible fallback so isolated component tests don't need a provider.
    const colors = lightColors;
    return {
      colors,
      typography: getTypography(colors),
      isDark: false,
      scheme: 'light',
      preference: 'system',
      setPreference: () => {},
    };
  }
  return theme;
}

/**
 * Memoized themed StyleSheet factory:
 *   const useStyles = createThemedStyles((t) => ({ ... }));
 */
export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: Theme) => T,
): () => T {
  return function useThemedStyles(): T {
    const theme = useTheme();
    return React.useMemo(() => StyleSheet.create(factory(theme)), [theme]);
  };
}

// ── Static conveniences (non-reactive; prefer useTheme in components) ───────

export const typography = getTypography(lightColors);
