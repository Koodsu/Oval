import { Router, Response } from 'express';
import prisma from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

// GET /pods/:id/messages
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const podId = req.params.id;
  const userId = req.user!.userId;

  try {
    // Verify pod exists
    const pod = await prisma.pod.findUnique({ where: { id: podId } });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    // Verify user is a member of the pod
    const membership = await prisma.podMember.findUnique({
      where: { podId_userId: { podId, userId } },
    });
    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this pod' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { podId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/messages
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const podId = req.params.id;
  const userId = req.user!.userId;
  const { content } = req.body;

  if (!content || typeof content !== 'string' || content.trim() === '') {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  try {
    // Verify pod exists
    const pod = await prisma.pod.findUnique({ where: { id: podId } });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    // Verify user is a member of the pod
    const membership = await prisma.podMember.findUnique({
      where: { podId_userId: { podId, userId } },
    });
    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this pod' });
      return;
    }

    const message = await prisma.message.create({
      data: { podId, userId, content: content.trim() },
      include: { user: { select: { id: true, name: true } } },
    });

    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
