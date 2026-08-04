import { describe, expect, it } from 'vitest';
import { ACTIVITY_CATALOG, ACTIVITY_CATEGORIES } from '../../prisma/activityCatalog';

describe('activity catalog', () => {
  it('contains 41 ordered, uniquely keyed activities', () => {
    expect(ACTIVITY_CATALOG).toHaveLength(41);
    expect(new Set(ACTIVITY_CATALOG.map((activity) => activity.id)).size).toBe(41);
    expect(new Set(ACTIVITY_CATALOG.map((activity) => activity.artworkKey)).size).toBe(41);
    expect(ACTIVITY_CATALOG.map((activity) => activity.sortOrder)).toEqual(
      Array.from({ length: 41 }, (_, index) => index + 1),
    );
  });

  it('uses only the eight launch categories', () => {
    const usedCategories = new Set(ACTIVITY_CATALOG.map((activity) => activity.category));
    expect(usedCategories).toEqual(new Set(ACTIVITY_CATEGORIES));
  });
});
