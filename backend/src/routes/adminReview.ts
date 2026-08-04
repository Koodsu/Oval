import express, { Router, Request, Response } from 'express';
import { verifyAdminReviewToken } from '../lib/adminReviewToken';
import { isValidStatus, ReportStatus } from '../lib/reportReasons';
import { adminGetReport, adminUpdateReport } from '../services/reportService';

const router = Router();
router.use(express.urlencoded({ extended: false, limit: '8kb' }));

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderReport(report: NonNullable<Awaited<ReturnType<typeof adminGetReport>>>, signed: {
  expires: string;
  token: string;
}, message?: string): string {
  const rows: Array<[string, unknown]> = [
    ['Severity', report.severity],
    ['Reason', report.reason],
    ['Status', report.status],
    ['Target type', report.targetType],
    ['Reporter', report.reporter ? `${report.reporter.name} <${report.reporter.email}>` : null],
    ['Target user', report.target ? `${report.target.name} <${report.target.email}>` : null],
    ['Target account', report.target?.accountStatus],
    ['Last account action', report.accountAction],
    ['Content removed', report.contentRemovedAt?.toISOString()],
    ['Pod', report.pod ? `${report.pod.title?.trim() || report.pod.activity?.title || 'Pod'} at ${report.pod.location ?? 'unknown location'}` : null],
    ['Reported content', report.message?.content ?? report.reportedContent],
    ['Details', report.details],
    ['Created', report.createdAt.toISOString()],
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Oval report ${escapeHtml(report.id)}</title>
</head>
<body style="font-family: sans-serif; max-width: 760px; margin: 0 auto; padding: 32px 20px; color: #111827;">
  <h1>Moderation report</h1>
  <p style="color: #6b7280;">Report ID: ${escapeHtml(report.id)}</p>
  ${message ? `<p style="padding: 12px; background: #ecfdf5; color: #065f46;">${escapeHtml(message)}</p>` : ''}
  <table style="border-collapse: collapse; width: 100%;">
    ${rows
      .filter(([, value]) => value)
      .map(([label, value]) => `<tr>
        <th style="text-align: left; vertical-align: top; padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;">${escapeHtml(label)}</th>
        <td style="padding: 8px; border: 1px solid #e5e7eb; white-space: pre-wrap;">${escapeHtml(value)}</td>
      </tr>`).join('')}
  </table>
  <form method="post" style="margin-top: 24px;">
    <input type="hidden" name="expires" value="${escapeHtml(signed.expires)}" />
    <input type="hidden" name="token" value="${escapeHtml(signed.token)}" />
    <label for="status" style="display: block; font-weight: 700; margin-bottom: 6px;">Status</label>
    <select id="status" name="status" style="padding: 8px; margin-bottom: 16px;">
      ${(['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const)
        .map((status) => `<option value="${status}"${report.status === status ? ' selected' : ''}>${status}</option>`)
        .join('')}
    </select>
    <label for="adminNotes" style="display: block; font-weight: 700; margin-bottom: 6px;">Admin notes</label>
    <textarea id="adminNotes" name="adminNotes" maxlength="2000" rows="6" style="box-sizing: border-box; width: 100%; padding: 8px;">${escapeHtml(report.adminNotes)}</textarea>
    ${report.messageId || report.directMessageId || report.clubMessageId || report.clubOfficerMessageId || report.clubAnnouncementId
      ? `<label style="display: block; margin-top: 16px;"><input type="checkbox" name="removeContent" value="true" ${report.contentRemovedAt ? 'checked disabled' : ''} /> Remove the reported content</label>`
      : ''}
    ${report.target
      ? `<label for="accountAction" style="display: block; font-weight: 700; margin: 16px 0 6px;">Account action</label>
    <select id="accountAction" name="accountAction" style="padding: 8px;">
      <option value="">No new account action</option>
      <option value="SUSPEND">Suspend and revoke sessions</option>
      <option value="BAN">Ban and block re-registration</option>
      <option value="RESTORE">Restore account and revoke sessions</option>
    </select>`
      : ''}
    <button type="submit" style="margin-top: 16px; padding: 10px 16px; border: 0; border-radius: 6px; color: white; background: #6d28d9; font-weight: 700;">Save review</button>
  </form>
</body>
</html>`;
}

function signedRequest(req: Request): { expires: string; token: string } | null {
  const expires = typeof req.query.expires === 'string'
    ? req.query.expires
    : typeof req.body?.expires === 'string'
      ? req.body.expires
      : '';
  const token = typeof req.query.token === 'string'
    ? req.query.token
    : typeof req.body?.token === 'string'
      ? req.body.token
      : '';
  return verifyAdminReviewToken(req.params.id, expires, token) ? { expires, token } : null;
}

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const signed = signedRequest(req);
  if (!signed) {
    res.status(403).send('This review link is invalid or expired.');
    return;
  }

  try {
    const report = await adminGetReport(req.params.id);
    if (!report) {
      res.status(404).send('Report not found.');
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.type('html').send(renderReport(report, signed));
  } catch (err) {
    console.error('[adminReview] Failed to load report:', err);
    res.status(500).send('Could not load the report.');
  }
});

router.post('/:id', async (req: Request, res: Response): Promise<void> => {
  const signed = signedRequest(req);
  if (!signed) {
    res.status(403).send('This review link is invalid or expired.');
    return;
  }

  const status = typeof req.body?.status === 'string' && isValidStatus(req.body.status)
    ? req.body.status as ReportStatus
    : null;
  const adminNotes = typeof req.body?.adminNotes === 'string'
    ? req.body.adminNotes.trim().slice(0, 2000)
    : '';
  const removeContent = req.body?.removeContent === 'true';
  const accountAction =
    typeof req.body?.accountAction === 'string' &&
    ['SUSPEND', 'BAN', 'RESTORE'].includes(req.body.accountAction)
      ? req.body.accountAction as 'SUSPEND' | 'BAN' | 'RESTORE'
      : undefined;
  if (!status) {
    res.status(400).send('Invalid report status.');
    return;
  }

  try {
    await adminUpdateReport(req.params.id, {
      status,
      adminNotes,
      removeContent,
      accountAction,
    });
    const report = await adminGetReport(req.params.id);
    if (!report) {
      res.status(404).send('Report not found.');
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.type('html').send(renderReport(report, signed, 'Review updated.'));
  } catch (err) {
    if (err instanceof Error && (
      err.message.includes('does not point to removable content') ||
      err.message.includes('does not have a target user') ||
      err.message.includes('Target user not found')
    )) {
      res.status(400).send(escapeHtml(err.message));
      return;
    }
    console.error('[adminReview] Failed to update report:', err);
    res.status(500).send('Could not update the report.');
  }
});

export default router;
