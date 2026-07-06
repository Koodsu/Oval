import React from 'react';
import { StyleSheet, TextStyle, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * OVAL DESIGN SYSTEM — Crimson
 *
 * Rule: screens must not use raw hex colors. Route every color through
 * useTheme() tokens so light/dark contrast stays intentional.
 */

// ── Fonts ────────────────────────────────────────────────────────────────────

export const fonts = {
  /** @deprecated System fonts are used; aliases remain for compatibility. */
  displayHeavy: undefined,
  /** @deprecated System fonts are used; aliases remain for compatibility. */
  display: undefined,
  /** @deprecated System fonts are used; aliases remain for compatibility. */
  displayMedium: undefined,
  /** @deprecated System fonts are used; aliases remain for compatibility. */
  body: undefined,
  /** @deprecated System fonts are used; aliases remain for compatibility. */
  medium: undefined,
  /** @deprecated System fonts are used; aliases remain for compatibility. */
  semibold: undefined,
  /** @deprecated System fonts are used; aliases remain for compatibility. */
  bold: undefined,
} satisfies Record<string, undefined>;

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
  /** Text/icon accent. Dark mode uses a brighter red for AA contrast. */
  accentText: string;

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
  bg: '#F5F4F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F2F0',
  sunken: '#EAE9E6',
  ink: '#111317',
  sub: '#5B5E66',
  faint: '#9A9DA6',
  border: '#E7E6E3',
  borderSoft: '#F0EFEC',
  shadow: '#111317',
  glass: 'rgba(255,255,255,0.6)',
  overlay: 'rgba(17,19,23,0.45)',
  tabBar: 'rgba(255,255,255,0.92)',

  primary: '#D90429',
  primaryPress: '#B00321',
  primarySoft: '#FFE5EA',
  onPrimary: '#FFFFFF',
  accentText: '#D90429',

  danger: '#C01731',
  dangerSoft: '#F9E2E6',
  success: '#178A47',
  successSoft: '#E2F3E9',
  warning: '#B57A0B',
  warningSoft: '#F8EEDB',

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
  bg: '#0F0E12',
  surface: '#1B1A20',
  surfaceAlt: '#232228',
  sunken: '#0A090C',
  ink: '#F4F3F6',
  sub: '#A8A7B0',
  faint: '#6E6D78',
  border: '#2E2D35',
  borderSoft: '#26252C',
  shadow: '#000000',
  glass: 'rgba(27,26,32,0.6)',
  overlay: 'rgba(0,0,0,0.6)',
  tabBar: 'rgba(20,19,24,0.94)',

  primary: '#D90429',
  primaryPress: '#F0264A',
  primarySoft: 'rgba(217,4,41,0.16)',
  onPrimary: '#FFFFFF',
  accentText: '#FF4D63',

  danger: '#FF5C71',
  dangerSoft: 'rgba(255,92,113,0.16)',
  success: '#3ECF7A',
  successSoft: 'rgba(62,207,122,0.15)',
  warning: '#E8B04B',
  warningSoft: 'rgba(232,176,75,0.15)',

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

// ── Elevation — soft, diffuse shadows ───────────────────────────────────────

export const elevation = {
  /** Resting solid card. */
  card: {
    shadowColor: '#111317',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
  md: 16,
  lg: 20,
  xl: 24,
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
    hero: {
      fontSize: 32,
      lineHeight: 39,
      fontWeight: '800',
      letterSpacing: 0,
      color: colors.ink,
    },
    display: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '800',
      letterSpacing: 0,
      color: colors.ink,
    },
    title: {
      fontSize: 17,
      lineHeight: 23,
      fontWeight: '700',
      letterSpacing: 0,
      color: colors.ink,
    },
    heading: {
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '700',
      color: colors.ink,
    },
    subheading: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '600',
      color: colors.ink,
    },
    body: {
      fontSize: 15,
      lineHeight: 21,
      fontWeight: '400',
      color: colors.ink,
    },
    bodyMedium: {
      fontSize: 15,
      lineHeight: 21,
      fontWeight: '500',
      color: colors.ink,
    },
    caption: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '500',
      color: colors.sub,
    },
    captionSmall: {
      fontSize: 12,
      lineHeight: 15,
      fontWeight: '500',
      color: colors.sub,
    },
    kicker: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.sub,
    },
    button: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '600',
      color: colors.ink,
    },
    chip: {
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '600',
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
  ready: boolean;
  setPreference: (preference: AppearancePreference) => void;
};

const ThemeContext = React.createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  // Oval is dark-first by design, so new users default to the dark theme.
  // Returning users' saved choice (loaded below) still takes precedence, and
  // anyone can switch to Light or System in Settings.
  const [preference, setPreferenceState] = React.useState<AppearancePreference>('dark');
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    AsyncStorage.getItem(APPEARANCE_KEY)
      .then((stored) => {
        if (active && (stored === 'light' || stored === 'dark' || stored === 'system')) {
          setPreferenceState(stored);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
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
      ready,
      setPreference,
    }),
    [colors, isDark, scheme, preference, ready, setPreference],
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
      ready: true,
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
