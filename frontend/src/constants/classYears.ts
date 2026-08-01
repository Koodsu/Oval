export const CLASS_YEAR_OPTIONS = [
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Grad',
] as const;

export type ClassYearOption = (typeof CLASS_YEAR_OPTIONS)[number];

const CLASS_STANDING_LABELS: Record<string, string> = {
  freshman: 'Freshman',
  sophomore: 'Sophomore',
  junior: 'Junior',
  senior: 'Senior',
  grad: 'Grad',
  graduate: 'Graduate',
};

/**
 * Supports both the current standing-based values and future graduation years.
 *
 * Examples:
 * - Freshman → OSU Freshman
 * - 2026 → OSU ’26
 * - Class of 2026 → OSU ’26
 */
export function formatClassYear(
  value?: string | null,
  context: 'default' | 'osu' = 'default',
) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const yearMatch = trimmed.match(/^(?:class\s+of\s+)?(?:20)?['’]?(\d{2})$/i);
  if (yearMatch) {
    const shortYear = yearMatch[1];
    return context === 'osu' ? `OSU ’${shortYear}` : `Class of 20${shortYear}`;
  }

  const standing = CLASS_STANDING_LABELS[trimmed.toLowerCase()] ?? trimmed;
  return context === 'osu' ? `OSU ${standing}` : standing;
}
