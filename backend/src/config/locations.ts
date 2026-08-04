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
  'Academic / Study': [
    'Thompson Library',
    '18th Avenue Library',
    'FAES Library',
    'Health Sciences Library',
    'Research Commons',
  ],
  Sports: [
    'RPAC',
    'North Recreation Center',
    'Jesse Owens North',
    'Jesse Owens South',
    'Aquatic Center',
    'Lincoln Tower Fields',
    'The Oval',
  ],
  'Fitness & Wellness': [
    'RPAC',
    'RPAC – Wellness Space',
    'RPAC – Mind Body Studio',
    'Student Wellness Center',
    'The Oval',
    'Olentangy Trail',
  ],
  'Social & Events': ['Ohio Union', 'The Oval', 'Mirror Lake', 'Student Lounge'],
  Food: [
    'Traditions at Scott',
    'Traditions at Kennedy',
    'Traditions at Morrill',
    "Sloopy's Diner",
    'Ohio Union',
    'Berry Café',
    'High Street',
    'Residence Hall – Community Kitchen',
  ],
  'Music & Arts': [
    'Wexner Center for the Arts',
    'Hopkins Hall',
    'Hughes Hall',
    'Sullivant Hall',
    'Ohio Union',
    'The Oval',
  ],
  'Sports & Fitness': [
    'RPAC',
    'North Recreation Center',
    'Jesse Owens North',
    'Jesse Owens South',
    'Jesse Owens West',
    'Adventure Recreation Center',
    'Aquatic Center',
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

/**
 * Real-world coordinates for named campus spots, so pods created from the
 * suggested-location chips (no map pin) still land in the right place on the
 * map. Keys are matched after normalization: lowercased, trimmed, and any
 * " – suffix" (e.g. "RPAC – Wellness Space" → "rpac") stripped, so room-level
 * variants resolve to their building.
 *
 * ⚠️ Every entry MUST fall inside OSU_CAMPUS_POLYGON (backend/src/routes/pods.ts)
 * — locations.test.ts enforces this. Off-campus spots (e.g. Urban Arts Space,
 * which is downtown) are intentionally absent and resolve to null.
 *
 * Anchors verified against public map data 2026-07: Lincoln Tower Park
 * 39.99749,-83.02217 · Mirror Lake 39.99800,-83.01423 · the Oval ~39.999,-83.013.
 */
export const LOCATION_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  // Sports & Fitness
  'rpac': { latitude: 39.9995, longitude: -83.0184 },
  'north recreation center': { latitude: 40.0032, longitude: -83.0113 },
  'jesse owens north': { latitude: 40.0042, longitude: -83.017 },
  'jesse owens south': { latitude: 39.9948, longitude: -83.0108 },
  'jesse owens west': { latitude: 40.0018, longitude: -83.0405 },
  'adventure recreation center': { latitude: 40.0013, longitude: -83.04 },
  'aquatic center': { latitude: 40.0003, longitude: -83.0187 }, // McCorkle Aquatic Pavilion
  'lincoln tower park': { latitude: 39.99749, longitude: -83.02217 },
  'lincoln tower fields': { latitude: 39.9968, longitude: -83.024 },
  'lincoln tower park amphitheater': { latitude: 39.9973, longitude: -83.0225 },

  // Food & Drink
  'traditions at scott': { latitude: 40.004, longitude: -83.0122 },
  'traditions at kennedy': { latitude: 39.9961, longitude: -83.0125 },
  'traditions at morrill': { latitude: 39.9989, longitude: -83.0225 },
  "sloopy's diner": { latitude: 39.9977, longitude: -83.0091 }, // inside Ohio Union
  'ohio union': { latitude: 39.9978, longitude: -83.009 },
  'espress-oh': { latitude: 39.9979, longitude: -83.0089 }, // inside Ohio Union
  '12th avenue bread company': { latitude: 39.9962, longitude: -83.0127 }, // Kennedy Commons
  'berry café': { latitude: 39.9992, longitude: -83.0157 }, // inside Thompson Library
  'connecting grounds': { latitude: 39.9996, longitude: -83.0185 }, // inside RPAC

  // Academic
  'thompson library': { latitude: 39.9992, longitude: -83.0155 },
  '18th avenue library': { latitude: 40.0013, longitude: -83.0132 },
  'faes library': { latitude: 40.004, longitude: -83.0283 },
  'health sciences library': { latitude: 39.994, longitude: -83.018 }, // Prior Hall
  'research commons': { latitude: 40.0014, longitude: -83.0133 }, // 18th Ave Library, 3rd floor

  // Arts & Creative
  'wexner center for the arts': { latitude: 39.9992, longitude: -83.0092 },
  'wexner center': { latitude: 39.9992, longitude: -83.0092 },
  'hopkins hall': { latitude: 39.9998, longitude: -83.014 },
  'hagerty hall': { latitude: 39.9987, longitude: -83.0122 },
  'hughes hall': { latitude: 40.0003, longitude: -83.0105 },
  'sullivant hall': { latitude: 39.9986, longitude: -83.0093 },

  // Social
  'student union': { latitude: 39.9978, longitude: -83.009 }, // alias of Ohio Union
  'blackwell inn': { latitude: 40.0053, longitude: -83.0158 },

  // Outdoors
  'mirror lake': { latitude: 39.998, longitude: -83.01423 },
  'south oval': { latitude: 39.9975, longitude: -83.0125 },
  'north oval': { latitude: 39.9995, longitude: -83.0128 },
  'the oval': { latitude: 39.999, longitude: -83.0129 },
  'main quad': { latitude: 39.999, longitude: -83.0129 }, // legacy alias of the Oval
  'coffey road park': { latitude: 40.0025, longitude: -83.0355 },
  'fred beekman park': { latitude: 40.0022, longitude: -83.0395 },
  'olentangy trail': { latitude: 39.9985, longitude: -83.026 },

  // Music & Entertainment
  'ohio union performance hall': { latitude: 39.9978, longitude: -83.009 },
  'mershon auditorium': { latitude: 39.9995, longitude: -83.0091 },

  // Wellness
  'student wellness center': { latitude: 39.9998, longitude: -83.0185 }, // inside RPAC

  // Demo/seed spots (seed-screenshots.ts)
  'high street': { latitude: 39.997, longitude: -83.009 },
  'the lounge': { latitude: 39.9988, longitude: -83.0092 },
};

/**
 * Resolve a location name to campus coordinates, or null when unknown.
 * Falls back from "Building – Room" to "Building" so every chip variant
 * ("RPAC – Game Area", "Thompson Library – 11th Floor") gets its building's pin.
 */
export function getCoordinatesForLocation(
  location: string,
): { latitude: number; longitude: number } | null {
  const normalized = location.trim().toLowerCase();
  const direct = LOCATION_COORDINATES[normalized];
  if (direct) return direct;
  // Strip a " – suffix" / " - suffix" / " — suffix" and retry with the base name.
  const base = normalized.split(/\s+[–—-]\s+/)[0].trim();
  if (base && base !== normalized) {
    return LOCATION_COORDINATES[base] ?? null;
  }
  return null;
}

/** Returns locations for a category, merging custom locations with defaults. */
export function getLocationsForCategory(category: string): string[] {
  const base = LOCATION_BY_CATEGORY[category] ?? [];
  const custom = CUSTOM_LOCATIONS[category] ?? [];
  const combined = [...base, ...custom];
  return combined.length > 0 ? combined : ['Campus Center', 'Main Quad'];
}
