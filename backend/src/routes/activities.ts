import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { LOCATION_BY_CATEGORY } from '../config/locations';

const router = Router();

// GET /activities/:id/locations – buildings for this activity's category
router.get('/:id/locations', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const activity = await prisma.activity.findUnique({ where: { id } });
    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }
    const locations = LOCATION_BY_CATEGORY[activity.category] ?? [];
    res.json(locations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
