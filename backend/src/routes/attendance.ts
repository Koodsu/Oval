import { Router, Response } from 'express';
import prisma from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /pods/:id/confirm — RSVP for upcoming meetup
// Requires: pod is LOCKED, caller is a member, meetupTime is in the future
router.post('/:id/confirm', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const podId = req.params.id;
  const userId = req.user!.userId;

  try {
    const pod = await prisma.pod.findUnique({ where: { id: podId } });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.status !== 'LOCKED') {
      res.status(400).json({ error: 'Attendance can only be confirmed for a locked pod' });
      return;
    }

    if (new Date(pod.meetupTime) <= new Date()) {
      res.status(400).json({ error: 'Meetup has already passed' });
      return;
    }

    const member = await prisma.podMember.findUnique({
      where: { podId_userId: { podId, userId } },
    });
    if (!member) {
      res.status(403).json({ error: 'You are not a member of this pod' });
      return;
    }

    const confirmedAt = new Date();
    await prisma.podMember.update({
      where: { podId_userId: { podId, userId } },
      data: { confirmedAt },
    });

    res.json({ confirmedAt: confirmedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/no-show/:userId — report another member as a no-show
// Requires: pod is COMPLETED, reporter is a member, target is a member, no self-reports
router.post('/:id/no-show/:userId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const podId = req.params.id;
  const reporterId = req.user!.userId;
  const targetUserId = req.params.userId;

  if (reporterId === targetUserId) {
    res.status(400).json({ error: 'You cannot report yourself as a no-show' });
    return;
  }

  try {
    const pod = await prisma.pod.findUnique({ where: { id: podId } });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.status !== 'COMPLETED') {
      res.status(400).json({ error: 'No-shows can only be reported for completed pods' });
      return;
    }

    const [reporterMember, targetMember] = await Promise.all([
      prisma.podMember.findUnique({ where: { podId_userId: { podId, userId: reporterId } } }),
      prisma.podMember.findUnique({ where: { podId_userId: { podId, userId: targetUserId } } }),
    ]);

    if (!reporterMember) {
      res.status(403).json({ error: 'You were not a member of this pod' });
      return;
    }
    if (!targetMember) {
      res.status(404).json({ error: 'Target user was not a member of this pod' });
      return;
    }

    // Idempotent: if already reported, return success
    await prisma.noShowReport.upsert({
      where: {
        podId_reporterId_targetUserId: { podId, reporterId, targetUserId },
      },
      create: { podId, reporterId, targetUserId },
      update: {},
    });

    res.json({ reported: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
