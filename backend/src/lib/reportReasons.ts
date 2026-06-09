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

export const REPORT_SEVERITIES = ['P0', 'P1', 'P2'] as const;

export type ReportSeverity = (typeof REPORT_SEVERITIES)[number];

const REASON_SEVERITY: Record<ReportReason, ReportSeverity> = {
  VIOLENCE_THREATS: 'P0',
  SELF_HARM: 'P0',
  ILLEGAL: 'P0',
  HARASSMENT: 'P1',
  HATE: 'P1',
  NUDITY_SEXUAL: 'P1',
  SCAM_FRAUD: 'P1',
  SPAM: 'P2',
  OTHER: 'P2',
};

export function isValidReason(r: string): r is ReportReason {
  return REPORT_REASONS.includes(r as ReportReason);
}

export function isValidStatus(s: string): s is ReportStatus {
  return REPORT_STATUSES.includes(s as ReportStatus);
}

export function isValidSeverity(s: string): s is ReportSeverity {
  return REPORT_SEVERITIES.includes(s as ReportSeverity);
}

export function severityForReason(reason: ReportReason): ReportSeverity {
  return REASON_SEVERITY[reason] ?? 'P2';
}
