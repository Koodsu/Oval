import { describe, it, expect } from 'vitest';
import { getActivityEmoji } from './activityEmoji';

describe('getActivityEmoji', () => {
  it('matches title keywords', () => {
    expect(getActivityEmoji('Library study session', 'Social')).toBe('📚');
    expect(getActivityEmoji('Coffee with friends', 'Social')).toBe('☕');
    expect(getActivityEmoji('Pickup basketball', 'Social')).toBe('🏀');
  });

  it('falls back to category', () => {
    expect(getActivityEmoji('Something generic', 'Academic')).toBe('📚');
    expect(getActivityEmoji('Random hangout', 'Gaming')).toBe('🎮');
  });

  it('uses default for unknown category', () => {
    expect(getActivityEmoji('X', 'UnknownCategory')).toBe('✨');
  });
});
