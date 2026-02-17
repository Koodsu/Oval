import { Router, Response } from 'express';
import prisma from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const FORMING = 'FORMING';
const LOCKED = 'LOCKED';
const COMPLETED = 'COMPLETED';

// GET /pods?activityId=
// Returns all pods for an activity (all statuses)
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { activityId } = req.query;

  if (!activityId || typeof activityId !== 'string') {
    res.status(400).json({ error: 'activityId query parameter is required' });
    return;
  }

  try {
    const pods = await prisma.pod.findMany({
      where: { activityId },
      include: {
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

      if (pod.members.length >= 4) {
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
      if (memberCount >= 4) {
        await prisma.pod.update({ where: { id: podId }, data: { status: LOCKED } });
      }

      const updatedPod = await prisma.pod.findUnique({
        where: { id: podId },
        include: {
          activity: true,
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

    const meetupTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const newPod = await prisma.pod.create({
      data: {
        activityId,
        meetupTime,
        location: activity.defaultLocation,
        status: FORMING,
      },
    });

    await prisma.podMember.create({ data: { podId: newPod.id, userId } });

    const updatedPod = await prisma.pod.findUnique({
      where: { id: newPod.id },
      include: {
        activity: true,
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    res.status(201).json(updatedPod);
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
