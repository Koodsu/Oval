import { formatPodChatDateSeparator } from './format';

describe('formatPodChatDateSeparator', () => {
  it('formats today with Today and a time', () => {
    const result = formatPodChatDateSeparator(new Date().toISOString());
    expect(result).toMatch(/^Today · \d/);
  });

  it('formats yesterday with Yesterday', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(15, 30, 0, 0);
    const result = formatPodChatDateSeparator(d.toISOString());
    expect(result).toMatch(/^Yesterday · /);
  });

  it('uses weekday month day and a single dot before time for older messages', () => {
    const d = new Date('2020-06-15T10:00:00.000Z');
    const result = formatPodChatDateSeparator(d.toISOString());
    expect(result).toMatch(/·/);
    expect((result.match(/·/g) ?? []).length).toBe(1);
    expect(result.length).toBeGreaterThan(10);
  });
});
