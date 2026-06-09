import { Resend } from 'resend';
import { createAdminReviewToken } from './adminReviewToken';

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'noreply@joinbridgeapp.com';
}

export function getContactEmail(): string {
  return process.env.CONTACT_EMAIL ?? 'contactus@joinbridgeapp.com';
}

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Bridge] Verification code for ${to}: ${code}`);
  }

  if (process.env.NODE_ENV === 'test') {
    console.log('[emailService] Test environment detected — email not sent. Use code above.');
    return;
  }

  const resend = getResendClient();

  if (!resend) {
    console.log(`[emailService] No RESEND_API_KEY set — email not sent. Use code above.`);
    return;
  }

  const from = getFromEmail();
  console.log(`[emailService] Sending verification email to ${to} from ${from}`);

  const result = await resend.emails.send({
    from,
    to,
    subject: 'Your Bridge verification code',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #6d28d9;">Verify your Bridge account</h2>
        <p>Enter this code in the app to confirm your OSU email:</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes. If you didn't create a Bridge account, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (result.error) {
    throw new Error(`Resend API error for ${to}: ${result.error.message}`);
  }

  console.log(`[emailService] Email sent successfully to ${to} (id: ${result.data?.id}) at ${new Date().toISOString()}`);
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Bridge] Password reset code for ${to}: ${code}`);
  }

  if (process.env.NODE_ENV === 'test') {
    console.log('[emailService] Test environment detected — password reset email not sent. Use code above.');
    return;
  }

  const resend = getResendClient();
  if (!resend) {
    console.log(`[emailService] No RESEND_API_KEY set — password reset email not sent. Use code above.`);
    return;
  }

  const from = getFromEmail();
  const result = await resend.emails.send({
    from,
    to,
    subject: 'Reset your Bridge password',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #6d28d9;">Reset your Bridge password</h2>
        <p>Enter this code in the Bridge app to choose a new password:</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827;">${escapeHtml(code)}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 15 minutes. If you did not request a password reset, you can ignore this email.</p>
      </div>
    `,
  });

  if (result.error) {
    throw new Error(`Resend API error for ${to}: ${result.error.message}`);
  }

  console.log(`[emailService] Password reset email sent successfully to ${to} (id: ${result.data?.id}) at ${new Date().toISOString()}`);
}

export interface ModerationReportEmailPayload {
  id: string;
  severity: string;
  reason: string;
  status: string;
  targetType: string | null;
  details: string | null;
  createdAt: Date;
  reporter?: { id: string; name: string; email: string } | null;
  target?: { id: string; name: string; email: string } | null;
  pod?: { id: string; location?: string | null; activity?: { title: string } | null } | null;
  message?: { id: string; content: string; createdAt?: Date } | null;
  reportedContent?: string | null;
  directMessageId?: string | null;
  clubId?: string | null;
  clubMessageId?: string | null;
  clubOfficerMessageId?: string | null;
  clubAnnouncementId?: string | null;
}

export async function sendModerationReportEmail(report: ModerationReportEmailPayload): Promise<void> {
  const to = getContactEmail();
  const subject = `[Bridge ${report.severity}] New ${report.reason} report`;
  const adminBase = process.env.ADMIN_REPORTS_URL?.trim().replace(/\/$/, '');
  const signedReview = createAdminReviewToken(report.id);
  const reviewUrl = adminBase && signedReview
    ? `${adminBase}/${encodeURIComponent(report.id)}?expires=${signedReview.expires}&token=${signedReview.token}`
    : null;
  const responseTarget =
    report.severity === 'P0' ? 'Immediate review' :
    report.severity === 'P1' ? 'Review within 24 hours' :
    'Review within 72 hours';

  console.log(`[Bridge] Moderation report ${report.id} (${report.severity}/${report.reason}) should go to ${to}`);

  if (process.env.NODE_ENV === 'test') {
    console.log('[emailService] Test environment detected — moderation report email not sent.');
    return;
  }

  const resend = getResendClient();
  if (!resend) {
    console.log('[emailService] No RESEND_API_KEY set — moderation report email not sent.');
    return;
  }

  const from = getFromEmail();
  const rows: Array<[string, string | null | undefined]> = [
    ['Severity', report.severity],
    ['Reason', report.reason],
    ['Status', report.status],
    ['Response target', responseTarget],
    ['Target type', report.targetType],
    ['Reporter', report.reporter ? `${report.reporter.name} <${report.reporter.email}> (${report.reporter.id})` : null],
    ['Target user', report.target ? `${report.target.name} <${report.target.email}> (${report.target.id})` : null],
    ['Pod', report.pod ? `${report.pod.activity?.title ?? 'Pod'} at ${report.pod.location ?? 'unknown location'} (${report.pod.id})` : null],
    ['Reported content', report.message ? `${report.message.content.slice(0, 500)} (${report.message.id})` : report.reportedContent?.slice(0, 500)],
    ['Direct message id', report.directMessageId],
    ['Club id', report.clubId],
    ['Club message id', report.clubMessageId],
    ['Officer message id', report.clubOfficerMessageId],
    ['Announcement id', report.clubAnnouncementId],
    ['Details', report.details],
    ['Created', report.createdAt.toISOString()],
  ];

  const result = await resend.emails.send({
    from,
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 680px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111827;">${escapeHtml(subject)}</h2>
        <p style="color: #4b5563;">A Bridge user submitted a report. Review the evidence and record the response after action.</p>
        ${reviewUrl
          ? `<p><a href="${escapeHtml(reviewUrl)}" style="color: #6d28d9;">Open this report securely</a></p>`
          : '<p style="color: #b45309;">Secure review links are not configured. Use the authenticated admin reports API or reply to this email.</p>'}
        <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
          ${rows
            .filter(([, value]) => value)
            .map(([label, value]) => `
              <tr>
                <td style="padding: 8px 10px; background: #f3f4f6; border: 1px solid #e5e7eb; font-weight: 700; width: 180px;">${escapeHtml(label)}</td>
                <td style="padding: 8px 10px; border: 1px solid #e5e7eb;">${escapeHtml(value)}</td>
              </tr>
            `).join('')}
        </table>
      </div>
    `,
  });

  if (result.error) {
    throw new Error(`Resend API error for moderation report ${report.id}: ${result.error.message}`);
  }

  console.log(`[emailService] Moderation report email sent successfully to ${to} (id: ${result.data?.id}) at ${new Date().toISOString()}`);
}
