import { describe, it, expect } from 'vitest';
import {
  getLocationsForCategory,
  getCoordinatesForLocation,
  LOCATION_BY_CATEGORY,
  LOCATION_COORDINATES,
  CUSTOM_LOCATIONS,
} from './locations';
import { isInsideCampus } from '../routes/pods';

describe('getLocationsForCategory', () => {
  it('returns locations for a known category', () => {
    const result = getLocationsForCategory('Sports');
    expect(result).toContain('RPAC');
    expect(result).toContain('North Recreation Center');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns locations for Food', () => {
    const result = getLocationsForCategory('Food');
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
    expect(categories).toContain('Sports');
    expect(categories).toContain('Food');
    expect(categories).toContain('Academic / Study');
    expect(categories).toContain('Fitness & Wellness');
    expect(categories).toContain('Gaming');
  });

  it('each category has non-empty location arrays', () => {
    for (const [category, locations] of Object.entries(LOCATION_BY_CATEGORY)) {
      expect(locations.length).toBeGreaterThan(0);
      expect(locations.every((l) => typeof l === 'string')).toBe(true);
    }
  });
});

describe('getCoordinatesForLocation', () => {
  it('resolves a known location directly', () => {
    const coords = getCoordinatesForLocation('Lincoln Tower Park');
    expect(coords).not.toBeNull();
    // Regression guard: this park sat ~1.7km north of reality in the old
    // screenshot seed. Real position ≈ 39.99749, -83.02217.
    expect(coords!.latitude).toBeCloseTo(39.9975, 3);
    expect(coords!.longitude).toBeCloseTo(-83.0222, 3);
  });

  it('falls back from "Building – Room" variants to the building', () => {
    const rpac = getCoordinatesForLocation('RPAC');
    expect(getCoordinatesForLocation('RPAC – Wellness Space')).toEqual(rpac);
    expect(getCoordinatesForLocation('RPAC – Game Area')).toEqual(rpac);
    expect(getCoordinatesForLocation('Thompson Library – 11th Floor')).toEqual(
      getCoordinatesForLocation('Thompson Library'),
    );
  });

  it('is case- and whitespace-insensitive', () => {
    expect(getCoordinatesForLocation('  ohio union ')).toEqual(
      getCoordinatesForLocation('Ohio Union'),
    );
  });

  it('returns null for unknown and off-campus locations', () => {
    expect(getCoordinatesForLocation('Invalid Building XYZ')).toBeNull();
    // Urban Arts Space is downtown — intentionally has no campus pin.
    expect(getCoordinatesForLocation('Urban Arts Space')).toBeNull();
  });

  it('every coordinate table entry is inside the campus fence', () => {
    for (const [name, coords] of Object.entries(LOCATION_COORDINATES)) {
      expect(
        isInsideCampus(coords.latitude, coords.longitude),
        `"${name}" (${coords.latitude}, ${coords.longitude}) is outside the campus polygon`,
      ).toBe(true);
    }
  });

  it('resolves every suggested location except known off-campus/generic spots', () => {
    // Generic scaffold names and the one genuinely off-campus venue. Anything
    // else in LOCATION_BY_CATEGORY must map to a real pin.
    const knownUnresolved = new Set([
      'Campus Pub',
      'Student Lounge',
      'Urban Arts Space',
      'Student Center – Game Room',
      'Residence Hall – Common Room',
      'Residence Hall – Community Kitchen',
      'Community Garden – Behind Science Hall',
      'Student Center – Volunteer Office',
    ]);
    for (const locations of Object.values(LOCATION_BY_CATEGORY)) {
      for (const location of locations) {
        if (knownUnresolved.has(location)) continue;
        expect(
          getCoordinatesForLocation(location),
          `"${location}" has no coordinates — add it to LOCATION_COORDINATES`,
        ).not.toBeNull();
      }
    }
  });
});
