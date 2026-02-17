import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /activities
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const activities = await prisma.activity.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
