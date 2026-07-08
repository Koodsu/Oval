export const OSU_CAMPUS_CENTER = {
  latitude: 39.9997,
  longitude: -83.0253,
};

export const OSU_CAMPUS_DELTA = {
  latitudeDelta: 0.0175,
  longitudeDelta: 0.0460,
};

/**
 * OSU campus geofence. Roads, clockwise from the northwest corner:
 * Lane Ave (north) → High St (east) → 10th Ave (south) → Kenny Rd (west).
 *
 * Vertices are anchored to real intersections (±~50m), so the fence hugs the
 * actual streets — the previous polygon's east edge sat at -83.0190, west of
 * High St, which cut off the Oval, the Union, and everything east of the
 * stadium.
 *
 * ⚠️ Keep in sync with OSU_CAMPUS_POLYGON in backend/src/routes/pods.ts —
 * the server enforces the same fence on pod create/update.
 */
export const OSU_CAMPUS_POLYGON = [
  // NW — Lane Ave & Kenny Rd
  { latitude: 40.0063, longitude: -83.0421 },
  // North — east along Lane Ave
  { latitude: 40.0061, longitude: -83.033 }, // Lane over west campus
  { latitude: 40.006, longitude: -83.0252 }, // Lane & Olentangy River Rd
  { latitude: 40.0061, longitude: -83.018 }, // Lane & Tuttle Park Pl
  // NE — Lane Ave & High St
  { latitude: 40.0062, longitude: -83.0093 },
  // East — south down High St (leans slightly east as it goes south)
  { latitude: 40.003, longitude: -83.009 }, // Lane→17th block
  { latitude: 39.9991, longitude: -83.0086 }, // 15th & High (main gateway)
  { latitude: 39.9962, longitude: -83.0082 }, // 12th & High (Ohio Union block)
  // SE — 10th Ave & High St
  { latitude: 39.9935, longitude: -83.0078 },
  // South — west along 10th Ave (covers the Wexner Medical campus)
  { latitude: 39.9934, longitude: -83.018 }, // 10th & Neil
  { latitude: 39.9933, longitude: -83.026 }, // 10th line at the river
  { latitude: 39.9933, longitude: -83.034 }, // 10th line over west campus
  // SW — 10th Ave line extended to Kenny Rd
  { latitude: 39.9932, longitude: -83.0425 },
  // West — north up Kenny Rd
  { latitude: 40.0006, longitude: -83.0428 }, // Kenny & Kinnear Rd
];

export const OSU_CAMPUS_BOUNDS = {
  minLat: 39.9932,
  maxLat: 40.0063,
  minLng: -83.0428,
  maxLng: -83.0078,
};

/**
 * Ray-casting point-in-polygon test against OSU_CAMPUS_POLYGON. Mirrors
 * isInsideCampus in backend/src/routes/pods.ts, so a pin the client accepts is
 * a pin the server will accept.
 */
export function isCampusCoordinate(latitude: number, longitude: number): boolean {
  let inside = false;
  const n = OSU_CAMPUS_POLYGON.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = OSU_CAMPUS_POLYGON[i].longitude;
    const yi = OSU_CAMPUS_POLYGON[i].latitude;
    const xj = OSU_CAMPUS_POLYGON[j].longitude;
    const yj = OSU_CAMPUS_POLYGON[j].latitude;
    const intersect =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export const SCARLET = '#CC0000';
