import { formatClassYear } from './classYears';

describe('formatClassYear', () => {
  it('formats the current standing-based values', () => {
    expect(formatClassYear('Freshman', 'osu')).toBe('OSU Freshman');
    expect(formatClassYear('sophomore', 'osu')).toBe('OSU Sophomore');
    expect(formatClassYear('Grad', 'osu')).toBe('OSU Grad');
  });

  it('formats future graduation-year values', () => {
    expect(formatClassYear('2026', 'osu')).toBe('OSU ’26');
    expect(formatClassYear('Class of 2027', 'osu')).toBe('OSU ’27');
    expect(formatClassYear('2028')).toBe('Class of 2028');
  });

  it('handles missing and unknown values safely', () => {
    expect(formatClassYear(null, 'osu')).toBeNull();
    expect(formatClassYear('  ')).toBeNull();
    expect(formatClassYear('Exchange', 'osu')).toBe('OSU Exchange');
  });
});
