import { Router, Response } from 'express';
import { AuthRequest, requireVerifiedAuth as requireAuth } from '../middleware/auth';
import { getInboxSummary } from '../lib/inboxSummary';

const router = Router();

router.get('/summary', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json(await getInboxSummary(req.user!.userId));
  } catch (err) {
    console.error('[inbox] summary failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
