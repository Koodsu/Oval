import { Platform } from 'react-native';

function webQueryValue(key: string): string | null {
  if (!__DEV__ || Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * Preview values normally come from Expo public env vars. On web, query
 * overrides let the visual-regression harness exercise every production state
 * from one Metro process: `?preview=club-home-empty&theme=dark`.
 */
export function getUiPreviewMode(): string | undefined {
  return webQueryValue('preview') ?? process.env.EXPO_PUBLIC_UI_PREVIEW;
}

export type UiPreviewTab = 'Home' | 'Explore' | 'Pods' | 'Clubs' | 'Inbox';

export function getUiPreviewTab(): UiPreviewTab | undefined {
  const value = webQueryValue('tab');
  return value === 'Home' ||
    value === 'Explore' ||
    value === 'Pods' ||
    value === 'Clubs' ||
    value === 'Inbox'
    ? value
    : undefined;
}

export function getUiPreviewNeutralDock(): boolean {
  return webQueryValue('dock') === 'neutral';
}

export function getUiPreviewTheme(): 'light' | 'dark' | null {
  const queryTheme = webQueryValue('theme');
  if (queryTheme === 'light' || queryTheme === 'dark') return queryTheme;
  const envTheme = process.env.EXPO_PUBLIC_UI_PREVIEW_THEME;
  return envTheme === 'light' || envTheme === 'dark' ? envTheme : null;
}
