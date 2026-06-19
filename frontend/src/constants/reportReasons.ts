/**
 * User-facing report reasons. Values must match the backend's REPORT_REASONS
 * (backend/src/lib/reportReasons.ts) so severity routing works.
 */
export interface ReportReasonOption {
  value: string;
  label: string;
}

export const REPORT_REASON_OPTIONS: ReportReasonOption[] = [
  { value: 'HARASSMENT', label: 'Harassment or bullying' },
  { value: 'HATE', label: 'Hate or discrimination' },
  { value: 'VIOLENCE_THREATS', label: 'Violence or threats' },
  { value: 'NUDITY_SEXUAL', label: 'Sexual content' },
  { value: 'SELF_HARM', label: 'Self-harm concern' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'SCAM_FRAUD', label: 'Scam or fraud' },
  { value: 'OTHER', label: 'Something else' },
];
