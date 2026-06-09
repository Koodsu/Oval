import { Router, Response } from 'express';
import prisma from '../prisma';
import { requireVerifiedAuth as requireAuth, AuthRequest } from '../middleware/auth';
import { moderateTextContent } from '../lib/contentModeration';

const router = Router();

// POST /pods/:id/recap — submit or update a post-meetup rating
// Rating: 1 = thumbs down, 2 = neutral, 3 = thumbs up
router.post('/:id/recap', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const podId = req.params.id;
  const { rating, note } = req.body ?? {};

  if (typeof rating !== 'number' || ![1, 2, 3].includes(rating)) {
    res.status(400).json({ error: 'rating must be 1, 2, or 3' });
    return;
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    res.status(400).json({ error: 'note must be a string or null' });
    return;
  }
  const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 200) || null : null;
  const moderation = await moderateTextContent([trimmedNote]);
  if (moderation) {
    res.status(moderation.status).json({ error: moderation.message });
    return;
  }

  try {
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      include: { members: { select: { userId: true } } },
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }
    if (pod.status !== 'COMPLETED') {
      res.status(400).json({ error: 'Can only submit a recap for a completed pod' });
      return;
    }
    if (!pod.members.some((m) => m.userId === userId)) {
      res.status(403).json({ error: 'You are not a member of this pod' });
      return;
    }

    const recap = await prisma.podRecap.upsert({
      where: { podId_userId: { podId, userId } },
      create: { podId, userId, rating, note: trimmedNote },
      update: { rating, note: trimmedNote },
    });

    res.json(recap);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods/:id/recap — get the current user's recap for this pod
router.get('/:id/recap', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const podId = req.params.id;

  try {
    const recap = await prisma.podRecap.findUnique({
      where: { podId_userId: { podId, userId } },
    });
    res.json(recap ?? null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
