/**
 * Waitlist position semantics:
 *   - Positions are 1-indexed (first in line = 1).
 *   - Only entries with status "WAITING" have active positions; "NOTIFIED",
 *     "JOINED", and "EXPIRED" entries retain their last position value but are
 *     no longer part of the live queue.
 *   - Positions are contiguous: after any removal, remaining WAITING entries
 *     are re-numbered 1..n in their original join order.
 */

import { Router, Response } from 'express';
import prisma from '../prisma';
import { requireVerifiedAuth as requireAuth, AuthRequest } from '../middleware/auth';
import { getBlockedUserIds } from '../lib/blocks';

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

    // Batch block check — one query instead of one per member
    const blockedIds = await getBlockedUserIds(userId);
    if (pod.members.some((m) => blockedIds.has(m.userId))) {
      res.status(403).json({ error: "You can't join this pod." });
      return;
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

    // Use a transaction to prevent two concurrent joins from receiving the
    // same position number (read-then-increment race condition).
    const entry = await prisma.$transaction(async (tx) => {
      const maxPosition = await tx.podWaitlist.aggregate({
        where: { podId, status: 'WAITING' },
        _max: { position: true },
      });
      const position = (maxPosition._max.position ?? 0) + 1;

      return tx.podWaitlist.upsert({
        where: { podId_userId: { podId, userId } },
        update: { position, status: 'WAITING', notifiedAt: null },
        create: { podId, userId, position, status: 'WAITING' },
      });
    });

    res.status(201).json({ position: entry.position });
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

    // Delete and re-number remaining WAITING entries in a single transaction.
    // The raw UPDATE assigns contiguous 1-based positions ordered by the
    // existing position value, replacing the old O(n) update loop.
    await prisma.$transaction([
      prisma.podWaitlist.delete({ where: { id: entry.id } }),
      prisma.$executeRaw`
        UPDATE "PodWaitlist" pw
        SET position = ranked.rn
        FROM (
          SELECT id, ROW_NUMBER() OVER (ORDER BY position) AS rn
          FROM "PodWaitlist"
          WHERE "podId" = ${podId} AND status = 'WAITING'
        ) ranked
        WHERE pw.id = ranked.id
      `,
    ]);

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
