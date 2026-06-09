import { Router, Response } from 'express';
import { requireVerifiedAuth as requireAuth, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { createReport, listMyReports, adminListReports, adminUpdateReport } from '../services/reportService';
import { isValidReason, isValidStatus } from '../lib/reportReasons';
import { consumeDurableRateLimit } from '../lib/durableRateLimit';

const router = Router();

// POST /reports – create report (auth required)
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const reporterId = req.user!.userId;
  const {
    podId,
    messageId,
    directMessageId,
    clubId,
    clubMessageId,
    clubOfficerMessageId,
    clubAnnouncementId,
    targetUserId,
    reason,
    details,
  } = req.body;

  if (!reason || typeof reason !== 'string' || !isValidReason(reason)) {
    res.status(400).json({ error: 'Invalid or missing reason' });
    return;
  }

  if (details !== undefined && (typeof details !== 'string' || details.length > 1000)) {
    res.status(400).json({ error: 'Details must be a string with max 1000 characters' });
    return;
  }

  const payload = {
    podId: typeof podId === 'string' && podId.trim() ? podId.trim() : undefined,
    messageId: typeof messageId === 'string' && messageId.trim() ? messageId.trim() : undefined,
    directMessageId: typeof directMessageId === 'string' && directMessageId.trim() ? directMessageId.trim() : undefined,
    clubId: typeof clubId === 'string' && clubId.trim() ? clubId.trim() : undefined,
    clubMessageId: typeof clubMessageId === 'string' && clubMessageId.trim() ? clubMessageId.trim() : undefined,
    clubOfficerMessageId: typeof clubOfficerMessageId === 'string' && clubOfficerMessageId.trim() ? clubOfficerMessageId.trim() : undefined,
    clubAnnouncementId: typeof clubAnnouncementId === 'string' && clubAnnouncementId.trim() ? clubAnnouncementId.trim() : undefined,
    targetUserId: typeof targetUserId === 'string' && targetUserId.trim() ? targetUserId.trim() : undefined,
    reason,
    details: typeof details === 'string' ? details : undefined,
  };

  try {
    const withinLimit = await consumeDurableRateLimit({
      action: 'reports.create',
      identifiers: [`user:${reporterId}`, `ip:${req.ip || 'unknown'}`],
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!withinLimit) {
      res.status(429).json({ error: 'Too many reports submitted. Contact support for urgent help.' });
      return;
    }

    const result = await createReport(reporterId, payload);
    res.status(201).json({ reportId: result.id, status: result.status, severity: result.severity });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create report';
    const lower = msg.toLowerCase();
    if (
      lower.includes('required') ||
      lower.includes('cannot report') ||
      lower.includes('not found') ||
      lower.includes('does not belong') ||
      lower.includes('you can only')
    ) {
      res.status(400).json({ error: msg });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// GET /reports/mine – list current user's reports
router.get('/mine', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const reporterId = req.user!.userId;
  try {
    const reports = await listMyReports(reporterId);
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
