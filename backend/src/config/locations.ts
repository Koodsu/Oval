/**
 * Location options for each activity category.
 *
 * Add your own locations: Edit this file and add entries to LOCATION_BY_CATEGORY
 * or CUSTOM_LOCATIONS for categories not listed. Use the exact category strings
 * from your activities (e.g. "Sports & Fitness", "Food & Drink").
 *
 * Run `npx prisma db seed` after changing activities if needed.
 */
export const LOCATION_BY_CATEGORY: Record<string, string[]> = {
  'Sports & Fitness': [
    'RPAC',
    'North Recreation Center',
    'Jesse Owens North',
    'Jesse Owens South',
    'Jesse Owens West',
    'Adventure Recreation Center',
    'Aquatic Center',
    'Coffey Road Park',
    'Fred Beekman Park',
    'Lincoln Tower Park',
  ],
  'Food & Drink': [
    'Traditions at Scott',
    'Traditions at Kennedy',
    'Traditions at Morrill',
    "Sloopy's Diner",
    'Ohio Union',
    'Espress-OH',
    '12th Avenue Bread Company',
    'Berry Café',
    'Connecting Grounds',
  ],
  Academic: [
    'Thompson Library',
    '18th Avenue Library',
    'FAES Library',
    'Health Sciences Library',
    'Research Commons',
  ],
  'Arts & Creative': [
    'Wexner Center for the Arts',
    'Hopkins Hall',
    'Hagerty Hall',
    'Sullivant Hall',
    'Urban Arts Space',
  ],
  Social: [
    'Ohio Union',
    'Student Union',
    'Blackwell Inn',
    'Campus Pub',
    'Student Lounge',
  ],
  Outdoors: [
    'Mirror Lake',
    'South Oval',
    'North Oval',
    'Coffey Road Park',
    'Fred Beekman Park',
    'Lincoln Tower Park',
    'Olentangy Trail',
  ],
  'Music & Entertainment': [
    'Wexner Center',
    'Ohio Union Performance Hall',
    'Mershon Auditorium',
    'Lincoln Tower Park Amphitheater',
  ],
  Wellness: [
    'RPAC – Wellness Space',
    'North Recreation Center – Studio',
    'Student Wellness Center',
    'Thompson Library – Reading Garden',
  ],
  Gaming: [
    'Ohio Union – Esports Arena',
    'Student Center – Game Room',
    'RPAC – Game Area',
    'Residence Hall – Common Room',
  ],
  Volunteering: [
    'Ohio Union – Service Hub',
    'Community Garden – Behind Science Hall',
    'Main Quad – Info Booth',
    'Student Center – Volunteer Office',
  ],
};

/**
 * Add your own locations here. These are merged with LOCATION_BY_CATEGORY.
 * Example: { 'My Category': ['Location A', 'Location B'] }
 */
export const CUSTOM_LOCATIONS: Record<string, string[]> = {
  // Add custom categories/locations here
};

/** Returns locations for a category, merging custom locations with defaults. */
export function getLocationsForCategory(category: string): string[] {
  const base = LOCATION_BY_CATEGORY[category] ?? [];
  const custom = CUSTOM_LOCATIONS[category] ?? [];
  const combined = [...base, ...custom];
  return combined.length > 0 ? combined : ['Campus Center', 'Main Quad'];
}
