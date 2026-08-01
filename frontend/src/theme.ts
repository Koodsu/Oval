import React from 'react';
import { StyleSheet, TextStyle, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUiPreviewTheme } from './dev/previewMode';

/**
 * OVAL DESIGN SYSTEM — Campus Pulse
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
  /** Structural border */
  border: string;
  /** Soft hairline for quiet separation */
  borderSoft: string;
  /** Shadow color */
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

/**
 * Light — white canvas, cool neutral structure, and one saturated scarlet.
 */
export const lightColors: ThemeColors = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5F6',
  sunken: '#ECECEF',
  ink: '#111217',
  sub: '#62636B',
  faint: '#898B93',
  border: '#E5E5E8',
  borderSoft: '#F0F0F2',
  shadow: '#111217',
  glass: 'rgba(255,255,255,0.76)',
  overlay: 'rgba(17,18,23,0.46)',
  tabBar: 'rgba(255,255,255,0.95)',

  primary: '#D70912',
  primaryPress: '#B30710',
  primarySoft: '#FFE6E8',
  onPrimary: '#FFFFFF',
  accentText: '#D70912',

  danger: '#C01731',
  dangerSoft: '#F9E2E6',
  success: '#178A47',
  successSoft: '#E2F3E9',
  warning: '#A86D08',
  warningSoft: '#F8EEDB',

  // Soft tints are pre-blended opaque values (tint over `surface`).
  // Translucent rgba surfaces composite badly with Android elevation
  // shadows (visible shadow-rect artifacts) and make text contrast
  // content-dependent. Solid surfaces everywhere.
  blue: '#3569C8',
  blueSoft: '#E7EEFC',
  green: '#2C844D',
  greenSoft: '#E5F2E8',
  amber: '#A96F0A',
  amberSoft: '#F8EDDA',
  pink: '#C63B69',
  pinkSoft: '#FBE7EE',
  violet: '#6750B8',
  violetSoft: '#EEE9FC',
  teal: '#167D87',
  tealSoft: '#E2F1F2',
};

/**
 * Dark — cool campus-night charcoal, lifted solid surfaces, and vivid scarlet.
 */
export const darkColors: ThemeColors = {
  bg: '#0C0E14',
  surface: '#14171E',
  surfaceAlt: '#1D2028',
  sunken: '#080A0F',
  ink: '#F5F5F7',
  sub: '#A8AAB3',
  faint: '#767984',
  border: '#2B2F38',
  borderSoft: '#22262E',
  shadow: '#000000',
  glass: 'rgba(20,23,30,0.72)',
  overlay: 'rgba(0,0,0,0.68)',
  tabBar: 'rgba(15,18,24,0.95)',

  primary: '#CE0115',
  primaryPress: '#ED1730',
  primarySoft: '#351019',
  onPrimary: '#FFFFFF',
  accentText: '#F13A50',

  danger: '#FF667C',
  dangerSoft: '#3B1821',
  success: '#47CF82',
  successSoft: '#143021',
  warning: '#E8B04B',
  warningSoft: '#342715',

  // Pre-blended opaque tints (tint over `surface`) — see light palette note.
  blue: '#7FA6FF',
  blueSoft: '#1A2233',
  green: '#4BD088',
  greenSoft: '#122C1E',
  amber: '#F3BA5C',
  amberSoft: '#302416',
  pink: '#FF8FB4',
  pinkSoft: '#331A24',
  violet: '#B49BFF',
  violetSoft: '#241E3A',
  teal: '#57D6E0',
  tealSoft: '#132B30',
};

// ── Elevation — soft, diffuse shadows ───────────────────────────────────────

export const elevation = {
  /** Resting solid card — low, warm, and diffuse. */
  card: {
    shadowColor: '#2A1E16',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  /** Floating chrome (docks, FABs, sheets). */
  floating: {
    shadowColor: '#2A1E16',
    shadowOpacity: 0.15,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
} as const;

// ── Layout tokens ────────────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  xs: 8,
  /** Inputs, wells, banners. */
  sm: 12,
  /** Buttons — slightly tighter than a card so CTAs read as controls. */
  button: 12,
  /** Cards and content slabs. */
  md: 16,
  lg: 20,
  /** Sheets, the dock, hero surfaces. */
  xl: 24,
  pill: 999,
} as const;

export const density = {
  compactRow: 52,
  regularRow: 64,
  metaLine: 15,
} as const;

/**
 * Retained for API stability. Campus Pulse uses no offset-card effect.
 */
export const SLAB_OFFSET = 0;
/** Hairline highlight border on glass surfaces. */
export const BORDER_W = 1;
/** Space screens must reserve above the bottom dock. */
export const DOCK_CLEARANCE = 96;

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
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '800',
      letterSpacing: 0,
      color: colors.ink,
    },
    display: {
      fontSize: 24,
      lineHeight: 29,
      fontWeight: '800',
      letterSpacing: 0,
      color: colors.ink,
    },
    title: {
      fontSize: 18,
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
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '600',
      color: colors.ink,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400',
      color: colors.ink,
    },
    bodyMedium: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
      color: colors.ink,
    },
    caption: {
      fontSize: 12,
      lineHeight: 17,
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
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
      letterSpacing: 0.7,
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
      fontSize: 12,
      lineHeight: 16,
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
  const [previewPreference] = React.useState(getUiPreviewTheme);
  // New users default to the light theme (not the system scheme). Returning
  // users' saved choice (loaded below) still takes precedence, and anyone can
  // switch to Dark or System in Settings.
  const [preference, setPreferenceState] = React.useState<AppearancePreference>(
    previewPreference ?? 'light',
  );
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (previewPreference) {
      setPreferenceState(previewPreference);
      setReady(true);
      return;
    }
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
  }, [previewPreference]);

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
