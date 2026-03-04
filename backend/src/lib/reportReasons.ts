export const REPORT_REASONS = [
  'HARASSMENT',
  'HATE',
  'SPAM',
  'NUDITY_SEXUAL',
  'VIOLENCE_THREATS',
  'SELF_HARM',
  'SCAM_FRAUD',
  'ILLEGAL',
  'OTHER',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export function isValidReason(r: string): r is ReportReason {
  return REPORT_REASONS.includes(r as ReportReason);
}

export function isValidStatus(s: string): s is ReportStatus {
  return REPORT_STATUSES.includes(s as ReportStatus);
}
