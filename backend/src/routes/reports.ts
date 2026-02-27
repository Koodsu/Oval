import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { createReport, listMyReports, adminListReports, adminUpdateReport } from '../services/reportService';
import { isValidReason, isValidStatus } from '../lib/reportReasons';

const router = Router();

// POST /reports – create report (auth required)
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const reporterId = req.user!.userId;
  const { podId, messageId, targetUserId, reason, details } = req.body;

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
    targetUserId: typeof targetUserId === 'string' && targetUserId.trim() ? targetUserId.trim() : undefined,
    reason,
    details: typeof details === 'string' ? details : undefined,
  };

  try {
    const result = await createReport(reporterId, payload);
    res.status(201).json({ reportId: result.id, status: result.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create report';
    if (msg.includes('required') || msg.includes('cannot report') || msg.includes('not found') || msg.includes('does not belong')) {
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
