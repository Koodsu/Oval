import { darkColors, lightColors } from './theme';
import { readableInkOn } from './components/ui';

function luminance(hex: string): number {
  const channels = hex
    .replace('#', '')
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first: string, second: string): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('%s theme accessibility', (_name, colors) => {
  it.each([
    ['ink', 'bg'],
    ['sub', 'bg'],
    ['faint', 'bg'],
    ['ink', 'surface'],
    ['sub', 'surface'],
    ['faint', 'surface'],
    ['onPrimary', 'primary'],
    ['accentText', 'bg'],
    ['danger', 'bg'],
    ['success', 'bg'],
    ['warning', 'bg'],
    ['blue', 'blueSoft'],
    ['green', 'greenSoft'],
    ['amber', 'amberSoft'],
    ['pink', 'pinkSoft'],
    ['violet', 'violetSoft'],
    ['teal', 'tealSoft'],
  ] as const)('keeps %s on %s at WCAG AA contrast', (foreground, background) => {
    expect(contrast(colors[foreground], colors[background])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['primary', 'blue', 'green', 'amber', 'pink', 'violet', 'teal'] as const)(
    'chooses the higher-contrast ink for %s fills',
    (fill) => {
      const selected = readableInkOn(colors, colors[fill]);
      const alternative = selected === colors.ink ? colors.onPrimary : colors.ink;
      expect(contrast(selected, colors[fill])).toBeGreaterThanOrEqual(
        contrast(alternative, colors[fill]),
      );
    },
  );
});
