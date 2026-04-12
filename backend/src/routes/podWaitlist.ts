import { Router, Response } from 'express';
import prisma from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { hasBlockingRelationship } from '../lib/blocks';

const router = Router();

const FORMING = 'FORMING';

// POST /pods/:id/waitlist — join the waitlist for a full pod
router.post('/:id/waitlist', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const podId = req.params.id;
  const userId = req.user!.userId;

  try {
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      include: { members: true },
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.status !== FORMING) {
      res.status(409).json({ error: 'This pod is no longer accepting members' });
      return;
    }

    if (pod.members.length < pod.maxMembers) {
      res.status(400).json({ error: 'Pod is not full — join directly instead' });
      return;
    }

    if (pod.members.some((m) => m.userId === userId)) {
      res.status(409).json({ error: 'You are already a member of this pod' });
      return;
    }

    for (const m of pod.members) {
      if (await hasBlockingRelationship(userId, m.userId)) {
        res.status(403).json({ error: "You can't join this pod." });
        return;
      }
    }

    const existing = await prisma.podWaitlist.findUnique({
      where: { podId_userId: { podId, userId } },
    });
    if (existing && existing.status === 'WAITING') {
      res.status(409).json({ error: 'You are already on the waitlist', position: existing.position });
      return;
    }

    const existingMembership = await prisma.podMember.findFirst({
      where: {
        userId,
        pod: { activityId: pod.activityId, status: { in: [FORMING, 'LOCKED'] } },
      },
    });
    if (existingMembership) {
      res.status(409).json({ error: 'You are already in an active pod for this activity' });
      return;
    }

    const maxPosition = await prisma.podWaitlist.aggregate({
      where: { podId, status: 'WAITING' },
      _max: { position: true },
    });
    const position = (maxPosition._max.position ?? 0) + 1;

    await prisma.podWaitlist.upsert({
      where: { podId_userId: { podId, userId } },
      update: { position, status: 'WAITING', notifiedAt: null },
      create: { podId, userId, position, status: 'WAITING' },
    });

    res.status(201).json({ position });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /pods/:id/waitlist — leave the waitlist
router.delete('/:id/waitlist', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const podId = req.params.id;
  const userId = req.user!.userId;

  try {
    const entry = await prisma.podWaitlist.findUnique({
      where: { podId_userId: { podId, userId } },
    });

    if (!entry || (entry.status !== 'WAITING' && entry.status !== 'NOTIFIED')) {
      res.status(404).json({ error: 'You are not on the waitlist for this pod' });
      return;
    }

    await prisma.podWaitlist.delete({ where: { id: entry.id } });

    // Re-number remaining WAITING entries
    const remaining = await prisma.podWaitlist.findMany({
      where: { podId, status: 'WAITING' },
      orderBy: { position: 'asc' },
    });
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].position !== i + 1) {
        await prisma.podWaitlist.update({
          where: { id: remaining[i].id },
          data: { position: i + 1 },
        });
      }
    }

    res.json({ removed: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods/:id/waitlist — get waitlist info for a pod
router.get('/:id/waitlist', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const podId = req.params.id;
  const userId = req.user!.userId;

  try {
    const count = await prisma.podWaitlist.count({
      where: { podId, status: 'WAITING' },
    });

    const myEntry = await prisma.podWaitlist.findUnique({
      where: { podId_userId: { podId, userId } },
    });

    const myPosition =
      myEntry && (myEntry.status === 'WAITING' || myEntry.status === 'NOTIFIED')
        ? myEntry.position
        : null;

    const myStatus = myEntry?.status ?? null;

    res.json({ count, myPosition, myStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
