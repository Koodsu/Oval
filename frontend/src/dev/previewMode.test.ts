import {
  getUiPreviewMode,
  getUiPreviewTab,
  setNativeUiPreviewMode,
  uiPreviewModeFromUrl,
} from './previewMode';

describe('native UI preview tab selection', () => {
  const originalValue = process.env.EXPO_PUBLIC_UI_PREVIEW_TAB;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.EXPO_PUBLIC_UI_PREVIEW_TAB;
    } else {
      process.env.EXPO_PUBLIC_UI_PREVIEW_TAB = originalValue;
    }
  });

  it('accepts a seeded native preview tab from the Expo public environment', () => {
    process.env.EXPO_PUBLIC_UI_PREVIEW_TAB = 'Clubs';

    expect(getUiPreviewTab()).toBe('Clubs');
  });

  it('ignores unsupported tab names', () => {
    process.env.EXPO_PUBLIC_UI_PREVIEW_TAB = 'Settings';

    expect(getUiPreviewTab()).toBeUndefined();
  });
});

describe('native UI preview URL parsing', () => {
  afterEach(() => setNativeUiPreviewMode(undefined));

  it('reads the preview mode from an Expo development URL', () => {
    expect(
      uiPreviewModeFromUrl('exp://127.0.0.1:8081/--/?preview=secondary-thread'),
    ).toBe('secondary-thread');
  });

  it('returns undefined when no preview was requested', () => {
    expect(uiPreviewModeFromUrl('exp://127.0.0.1:8081')).toBeUndefined();
  });

  it('shares a native URL override with seeded child-screen fixtures', () => {
    setNativeUiPreviewMode('club-home-member');

    expect(getUiPreviewMode()).toBe('club-home-member');
  });
});
