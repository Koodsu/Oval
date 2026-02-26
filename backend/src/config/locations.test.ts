import { describe, it, expect } from 'vitest';
import {
  getLocationsForCategory,
  LOCATION_BY_CATEGORY,
  CUSTOM_LOCATIONS,
} from './locations';

describe('getLocationsForCategory', () => {
  it('returns locations for a known category', () => {
    const result = getLocationsForCategory('Sports & Fitness');
    expect(result).toContain('RPAC');
    expect(result).toContain('North Recreation Center');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns locations for Food & Drink', () => {
    const result = getLocationsForCategory('Food & Drink');
    expect(result).toContain("Sloopy's Diner");
    expect(result).toContain('Ohio Union');
  });

  it('returns fallback for unknown category', () => {
    const result = getLocationsForCategory('Unknown Category XYZ');
    expect(result).toEqual(['Campus Center', 'Main Quad']);
  });

  it('returns empty string category fallback', () => {
    const result = getLocationsForCategory('');
    expect(result).toEqual(['Campus Center', 'Main Quad']);
  });
});

describe('LOCATION_BY_CATEGORY', () => {
  it('has entries for all expected categories', () => {
    const categories = Object.keys(LOCATION_BY_CATEGORY);
    expect(categories).toContain('Sports & Fitness');
    expect(categories).toContain('Food & Drink');
    expect(categories).toContain('Academic');
    expect(categories).toContain('Wellness');
    expect(categories).toContain('Gaming');
  });

  it('each category has non-empty location arrays', () => {
    for (const [category, locations] of Object.entries(LOCATION_BY_CATEGORY)) {
      expect(locations.length).toBeGreaterThan(0);
      expect(locations.every((l) => typeof l === 'string')).toBe(true);
    }
  });
});
