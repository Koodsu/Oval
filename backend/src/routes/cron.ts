import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { runMaintenanceJobs } from '../lib/maintenanceJobs';

const router = Router();

function secretsMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

router.get('/maintenance', async (req: Request, res: Response): Promise<void> => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ error: 'Cron is not configured' });
    return;
  }

  const authorization = req.get('authorization') ?? '';
  if (!secretsMatch(authorization, `Bearer ${secret}`)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await runMaintenanceJobs();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron] Maintenance job failed:', err);
    res.status(500).json({ error: 'Maintenance job failed' });
  }
});

export default router;
