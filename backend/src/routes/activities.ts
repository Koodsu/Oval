import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { getLocationsForCategory } from '../config/locations';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /activities/locations?category= – locations by category (must be before /:id/locations)
router.get('/locations', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    if (!category || typeof category !== 'string') {
      res.status(400).json({ error: 'category query parameter is required' });
      return;
    }
    const locations = getLocationsForCategory(category);
    res.json(locations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /activities/:id/locations – buildings for this activity's category
router.get('/:id/locations', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const activity = await prisma.activity.findUnique({ where: { id } });
    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }
    let locations = getLocationsForCategory(activity.category);
    if (activity.defaultLocation && !locations.includes(activity.defaultLocation)) {
      locations = [activity.defaultLocation, ...locations];
    }
    res.json(locations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /activities?category=
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
