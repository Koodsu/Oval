import React from 'react';
import { StyleSheet, TextStyle, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OVAL DESIGN SYSTEM — "Lumen"
 *
 * A premium liquid-glass language built for OSU students:
 *  - A soft tinted gradient backdrop (warm cream → lilac → cool blue)
 *  - Frosted translucent surfaces with hairline highlight borders
 *  - Soft, diffuse elevation — no hard ink borders, no offset slab shadows
 *  - OSU scarlet kept as a focused accent (primary actions, live state)
 *  - Sora for quiet geometric display type, Inter for clean body copy
 *  - Generous radii, calm spacing, depth instead of decoration
 *
 * Restraint is the system: let the gradient + glass carry mood, and spend
 * scarlet only where the user should act or where something is live.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Fonts ────────────────────────────────────────────────────────────────────

export const fonts = {
  /** Sora 800 — hero numerals, splash moments */
  displayHeavy: 'Sora-ExtraBold',
  /** Sora 700 — screen titles */
  display: 'Sora-Bold',
  /** Sora 600 — card titles, medium display */
  displayMedium: 'Sora-SemiBold',
  /** Inter 400 — body copy */
  body: 'Inter-Regular',
  /** Inter 500 */
  medium: 'Inter-Medium',
  /** Inter 600 */
  semibold: 'Inter-SemiBold',
  /** Inter 700 — buttons, labels, kickers */
  bold: 'Inter-Bold',
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
  bg: '#F3EEF6',
  surface: 'rgba(255, 255, 255, 0.72)',
  surfaceAlt: 'rgba(255, 255, 255, 0.46)',
  sunken: 'rgba(108, 96, 122, 0.10)',
  ink: '#241F2B',
  sub: '#6C6476',
  faint: '#A39BAD',
  border: 'rgba(120, 108, 134, 0.16)',
  borderSoft: 'rgba(120, 108, 134, 0.09)',
  shadow: '#36283F',
  glass: 'rgba(255, 255, 255, 0.50)',
  overlay: 'rgba(28, 22, 38, 0.40)',
  tabBar: 'rgba(255, 255, 255, 0.70)',

  primary: '#C8102E',
  primaryPress: '#9C0A22',
  primarySoft: 'rgba(200, 16, 46, 0.12)',
  onPrimary: '#FFFFFF',

  danger: '#C01731',
  dangerSoft: 'rgba(192, 23, 49, 0.12)',
  success: '#1A8C49',
  successSoft: 'rgba(26, 140, 73, 0.14)',
  warning: '#C2810C',
  warningSoft: 'rgba(194, 129, 12, 0.16)',

  blue: '#2E63D9',
  blueSoft: 'rgba(46, 99, 217, 0.14)',
  green: '#1A8C49',
  greenSoft: 'rgba(26, 140, 73, 0.14)',
  amber: '#C2810C',
  amberSoft: 'rgba(194, 129, 12, 0.16)',
  pink: '#D6336C',
  pinkSoft: 'rgba(214, 51, 108, 0.14)',
  violet: '#6D3FD4',
  violetSoft: 'rgba(109, 63, 212, 0.14)',
  teal: '#0E8A97',
  tealSoft: 'rgba(14, 138, 151, 0.14)',
};

export const darkColors: ThemeColors = {
  bg: '#15121C',
  surface: 'rgba(255, 255, 255, 0.075)',
  surfaceAlt: 'rgba(255, 255, 255, 0.05)',
  sunken: 'rgba(0, 0, 0, 0.26)',
  ink: '#F2EDF8',
  sub: '#B6AEC4',
  faint: '#7C7389',
  border: 'rgba(255, 255, 255, 0.14)',
  borderSoft: 'rgba(255, 255, 255, 0.08)',
  shadow: '#000000',
  glass: 'rgba(255, 255, 255, 0.08)',
  overlay: 'rgba(0, 0, 0, 0.55)',
  tabBar: 'rgba(26, 22, 34, 0.70)',

  primary: '#FF566A',
  primaryPress: '#E33B50',
  primarySoft: 'rgba(255, 86, 106, 0.18)',
  onPrimary: '#FFFFFF',

  danger: '#FF6275',
  dangerSoft: 'rgba(255, 98, 117, 0.18)',
  success: '#46CC7E',
  successSoft: 'rgba(70, 204, 126, 0.16)',
  warning: '#F2B753',
  warningSoft: 'rgba(242, 183, 83, 0.16)',

  blue: '#7CA2FF',
  blueSoft: 'rgba(124, 162, 255, 0.16)',
  green: '#46CC7E',
  greenSoft: 'rgba(70, 204, 126, 0.16)',
  amber: '#F2B753',
  amberSoft: 'rgba(242, 183, 83, 0.16)',
  pink: '#FF8AB6',
  pinkSoft: 'rgba(255, 138, 182, 0.16)',
  violet: '#B79BFF',
  violetSoft: 'rgba(183, 155, 255, 0.18)',
  teal: '#54D4E0',
  tealSoft: 'rgba(84, 212, 224, 0.16)',
};

// ── Backdrop gradients (consumed by AppBackdrop) ─────────────────────────────

/** Soft tinted wash behind every screen. Warm cream → lilac → cool blue. */
export const lightBackdrop = ['#FCEAE1', '#F3EDF8', '#E9F0F8'] as const;
export const darkBackdrop = ['#1E1726', '#15121C', '#121521'] as const;
export const backdropStart = { x: 0.1, y: 0 } as const;
export const backdropEnd = { x: 0.9, y: 1 } as const;

// ── Elevation — soft, diffuse shadows (replaces the hard slab offset) ────────

export const elevation = {
  /** Resting glass card. */
  card: {
    shadowColor: '#2A1F36',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  /** Floating chrome (docks, FABs, sheets). */
  floating: {
    shadowColor: '#241A30',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
} as const;

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
  xs: 10,
  sm: 14,
  md: 18,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const density = {
  compactRow: 56,
  regularRow: 68,
  metaLine: 15,
} as const;

/**
 * Retained for API stability. Lumen has no offset slab; surfaces sit on soft
 * diffuse shadows instead, so the offset is zero everywhere.
 */
export const SLAB_OFFSET = 0;
/** Hairline highlight border on glass surfaces. */
export const BORDER_W = 1;
/** Default blur strength for frosted surfaces. */
export const GLASS_BLUR = 24;
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
      letterSpacing: 0.8,
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
  // Oval is dark-first by design, so new users default to the dark theme.
  // Returning users' saved choice (loaded below) still takes precedence, and
  // anyone can switch to Light or System in Settings.
  const [preference, setPreferenceState] = React.useState<AppearancePreference>('dark');

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
