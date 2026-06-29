import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { getLocationsForCategory } from '../config/locations';
import { requireVerifiedAuth as requireAuth, AuthRequest } from '../middleware/auth';
import { expireOldPods } from '../lib/expireOldPods';
import { moderateTextContent } from '../lib/contentModeration';
import { consumeDurableRateLimit } from '../lib/durableRateLimit';

const router = Router();

const ACTIVITY_REQUEST_CATEGORIES = new Set([
  'Sports & Fitness',
  'Food & Drink',
  'Academic',
  'Arts & Creative',
  'Social',
  'Outdoors',
  'Music & Entertainment',
  'Wellness',
  'Gaming',
  'Volunteering',
]);

const ACTIVITY_REQUEST_LIMIT = 5;
const ACTIVITY_REQUEST_WINDOW_MS = 24 * 60 * 60 * 1000;

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

// POST /activities/requests — students can suggest a curated catalog addition.
router.post('/requests', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
  const description =
    typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const defaultLocation =
    typeof req.body?.defaultLocation === 'string' ? req.body.defaultLocation.trim() : '';

  if (title.length < 3 || title.length > 80) {
    res.status(400).json({ error: 'title must be 3-80 characters' });
    return;
  }
  if (!ACTIVITY_REQUEST_CATEGORIES.has(category)) {
    res.status(400).json({ error: 'category is not supported' });
    return;
  }
  if (description.length > 240) {
    res.status(400).json({ error: 'description cannot exceed 240 characters' });
    return;
  }
  if (defaultLocation.length > 80) {
    res.status(400).json({ error: 'defaultLocation cannot exceed 80 characters' });
    return;
  }

  const moderation = await moderateTextContent([title, description, defaultLocation]);
  if (moderation) {
    res.status(moderation.status).json({ error: moderation.message });
    return;
  }

  try {
    const allowed = await consumeDurableRateLimit({
      action: 'activity_request',
      identifiers: [`user:${userId}`, `ip:${req.ip ?? 'unknown'}`],
      limit: ACTIVITY_REQUEST_LIMIT,
      windowMs: ACTIVITY_REQUEST_WINDOW_MS,
    });
    if (!allowed) {
      res.status(429).json({ error: 'You have submitted too many activity requests today.' });
      return;
    }

    const activityRequest = await prisma.activityRequest.create({
      data: {
        userId,
        title,
        category,
        description: description || null,
        defaultLocation: defaultLocation || null,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    res.status(201).json(activityRequest);
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
    await expireOldPods();

    const { category } = req.query;
    const where = category && typeof category === 'string' ? { category } : {};
    const now = new Date();

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            pods: {
              where: {
                AND: [
                  { status: 'FORMING' },
                  { status: { notIn: ['EXPIRED', 'COMPLETED'] } },
                  { meetupTime: { gt: now } },
                ],
              },
            },
          },
        },
      },
    });
    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
