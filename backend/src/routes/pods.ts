import { Router, Response } from 'express';
import prisma from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { LOCATION_BY_CATEGORY } from '../config/locations';

const router = Router();

const FORMING = 'FORMING';
const LOCKED = 'LOCKED';
const COMPLETED = 'COMPLETED';

function getMaxMeetupTime(): Date {
  const max = new Date();
  max.setDate(max.getDate() + 7);
  max.setHours(23, 59, 59, 999);
  return max;
}

// GET /pods/mine
router.get('/mine', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  try {
    const pods = await prisma.pod.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        activity: true,
        members: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(pods);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods?activityId=&sort=
// Returns FORMING pods for an activity (locked pods excluded from browse)
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { activityId, sort } = req.query;

  if (!activityId || typeof activityId !== 'string') {
    res.status(400).json({ error: 'activityId query parameter is required' });
    return;
  }

  try {
    const where: Record<string, unknown> = {
      activityId,
      status: FORMING,
    };

    let orderBy: Record<string, string> = { createdAt: 'desc' };
    if (sort === 'starting_soon') {
      orderBy = { meetupTime: 'asc' };
    }

    const pods = await prisma.pod.findMany({
      where,
      include: {
        activity: true,
        members: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy,
    });

    let result = pods;
    if (sort === 'most_members') {
      result = [...pods].sort((a, b) => b.members.length - a.members.length);
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/join
// Body option A – join a specific existing pod:  { podId }
// Body option B – create a brand new pod:         { activityId }
router.post('/join', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { podId, activityId } = req.body;

  if (!podId && !activityId) {
    res.status(400).json({ error: 'podId or activityId is required' });
    return;
  }

  try {
    // ── Option A: join a specific pod ─────────────────────────────────────────
    if (podId) {
      const pod = await prisma.pod.findUnique({
        where: { id: podId },
        include: { members: true, activity: true },
      });

      if (!pod) {
        res.status(404).json({ error: 'Pod not found' });
        return;
      }

      if (pod.status !== FORMING) {
        res.status(409).json({ error: 'This pod is no longer accepting members' });
        return;
      }

      if (pod.members.length >= pod.maxMembers) {
        res.status(409).json({ error: 'This pod is full' });
        return;
      }

      // Check user is not already in an active pod for this activity
      const existingMembership = await prisma.podMember.findFirst({
        where: {
          userId,
          pod: {
            activityId: pod.activityId,
            status: { in: [FORMING, LOCKED] },
          },
        },
      });

      if (existingMembership) {
        res.status(409).json({ error: 'You are already in an active pod for this activity' });
        return;
      }

      await prisma.podMember.create({ data: { podId, userId } });

      const memberCount = await prisma.podMember.count({ where: { podId } });
      if (memberCount >= pod.maxMembers) {
        await prisma.pod.update({ where: { id: podId }, data: { status: LOCKED } });
      }

      const updatedPod = await prisma.pod.findUnique({
        where: { id: podId },
        include: {
          activity: true,
          creator: { select: { id: true } },
          members: { include: { user: { select: { id: true, name: true } } } },
        },
      });

      res.status(201).json(updatedPod);
      return;
    }

    // ── Option B: create a new pod for an activity ───────────────────────────
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    // Check user is not already in an active pod for this activity
    const existingMembership = await prisma.podMember.findFirst({
      where: {
        userId,
        pod: {
          activityId,
          status: { in: [FORMING, LOCKED] },
        },
      },
    });

    if (existingMembership) {
      res.status(409).json({ error: 'You are already in an active pod for this activity' });
      return;
    }

    const minMembers = Math.max(2, Math.min(10, Number(req.body.minMembers) || 2));
    const maxMembers = Math.max(minMembers, Math.min(10, Number(req.body.maxMembers) || 4));
    const locationInput = typeof req.body.location === 'string' ? req.body.location.trim() : '';

    let meetupTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (req.body.meetupTime) {
      const parsed = new Date(req.body.meetupTime);
      if (isNaN(parsed.getTime())) {
        res.status(400).json({ error: 'Invalid meetupTime' });
        return;
      }
      const now = new Date();
      const maxTime = getMaxMeetupTime();
      if (parsed <= now) {
        res.status(400).json({ error: 'Meetup time must be in the future' });
        return;
      }
      if (parsed > maxTime) {
        res.status(400).json({ error: 'Meetup time cannot be more than 1 week from now' });
        return;
      }
      meetupTime = parsed;
    }

    const allowed = LOCATION_BY_CATEGORY[activity.category] ?? [];
    const location = locationInput || activity.defaultLocation;
    if (allowed.length > 0 && !allowed.includes(location)) {
      res.status(400).json({
        error: 'Invalid location. Must be from the activity category list.',
      });
      return;
    }

    const newPod = await prisma.pod.create({
      data: {
        activityId,
        meetupTime,
        location,
        locationType: 'public',
        minMembers,
        maxMembers,
        status: FORMING,
        creatorId: userId,
      },
    });

    await prisma.podMember.create({ data: { podId: newPod.id, userId } });

    const updatedPod = await prisma.pod.findUnique({
      where: { id: newPod.id },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    res.status(201).json(updatedPod);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/lock – creator only; lock when memberCount >= minMembers
router.post('/:id/lock', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const pod = await prisma.pod.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }
    const creatorId = pod.creatorId ?? pod.members.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0]?.userId;
    if (creatorId !== userId) {
      res.status(403).json({ error: 'Only the pod creator can lock the pod' });
      return;
    }
    if (pod.status !== FORMING) {
      res.status(409).json({ error: 'Pod is already locked or completed' });
      return;
    }
    if (pod.members.length < pod.minMembers) {
      res.status(400).json({ error: `Need at least ${pod.minMembers} members to lock` });
      return;
    }

    const updated = await prisma.pod.update({
      where: { id },
      data: { status: LOCKED },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/unlock – creator only; unlock when memberCount < maxMembers
router.post('/:id/unlock', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const pod = await prisma.pod.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }
    const creatorId = pod.creatorId ?? pod.members.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0]?.userId;
    if (creatorId !== userId) {
      res.status(403).json({ error: 'Only the pod creator can unlock the pod' });
      return;
    }
    if (pod.status !== LOCKED) {
      res.status(409).json({ error: 'Pod is not locked' });
      return;
    }
    if (pod.members.length >= pod.maxMembers) {
      res.status(400).json({ error: 'Cannot unlock a full pod' });
      return;
    }

    const updated = await prisma.pod.update({
      where: { id },
      data: { status: FORMING },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    let pod = await prisma.pod.findUnique({
      where: { id },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    // Lazy COMPLETED transition
    if (pod.status === LOCKED && pod.meetupTime < new Date()) {
      pod = await prisma.pod.update({
        where: { id },
        data: { status: COMPLETED },
        include: {
          activity: true,
          creator: { select: { id: true } },
          members: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      });
    }

    res.json(pod);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
