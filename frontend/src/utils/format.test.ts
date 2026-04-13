import { formatPodChatDateSeparator } from './format';

describe('formatPodChatDateSeparator', () => {
  it('formats today with TODAY and a time', () => {
    const result = formatPodChatDateSeparator(new Date().toISOString());
    expect(result).toMatch(/^TODAY · \d/);
  });

  it('formats yesterday with YESTERDAY', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(15, 30, 0, 0);
    const result = formatPodChatDateSeparator(d.toISOString());
    expect(result).toMatch(/^YESTERDAY · /);
  });

  it('includes weekday and date for older messages', () => {
    const d = new Date('2020-06-15T10:00:00.000Z');
    const result = formatPodChatDateSeparator(d.toISOString());
    expect(result).toContain('·');
    expect(result.length).toBeGreaterThan(10);
  });
});
