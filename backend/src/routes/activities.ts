import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /activities?category=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    const where = category && typeof category === 'string' ? { category } : {};

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
