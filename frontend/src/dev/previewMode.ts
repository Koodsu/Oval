import { Platform } from 'react-native';

let nativePreviewMode: string | undefined;

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
  return webQueryValue('preview') ?? nativePreviewMode ?? process.env.EXPO_PUBLIC_UI_PREVIEW;
}

export function setNativeUiPreviewMode(value: string | undefined): void {
  if (__DEV__ && Platform.OS !== 'web') nativePreviewMode = value;
}

/**
 * Native Expo previews can be switched without restarting Metro by opening a
 * development URL such as `exp://host:8081/--/?preview=ui-privacy`.
 * Production builds never consume this helper.
 */
export function uiPreviewModeFromUrl(url: string): string | undefined {
  const query = url.split('?')[1]?.split('#')[0];
  if (!query) return undefined;
  const value = new URLSearchParams(query).get('preview')?.trim();
  return value || undefined;
}

export type UiPreviewTab = 'Home' | 'Explore' | 'Pods' | 'Clubs' | 'Inbox';

export function getUiPreviewTab(): UiPreviewTab | undefined {
  const value = webQueryValue('tab') ?? process.env.EXPO_PUBLIC_UI_PREVIEW_TAB;
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
