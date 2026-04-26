export const CLASS_YEAR_OPTIONS = [
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Grad',
] as const;

export type ClassYearOption = (typeof CLASS_YEAR_OPTIONS)[number];
