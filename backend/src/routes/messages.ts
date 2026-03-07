import { Router, Response } from 'express';
import prisma from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { hasBlockingRelationship } from '../lib/blocks';
import { notifyNewMessage } from '../lib/NotificationService';

const router = Router({ mergeParams: true });

// GET /pods/:id/messages
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
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

    const membership = pod.members.find((m) => m.userId === userId);
    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this pod' });
      return;
    }

    for (const m of pod.members) {
      if (await hasBlockingRelationship(userId, m.userId)) {
        res.status(403).json({ error: "You can't view messages in this pod." });
        return;
      }
    }

    const messages = await prisma.message.findMany({
      where: { podId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
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

  const trimmed = typeof content === 'string' ? content.trim() : '';
  if (!trimmed) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const MAX_MESSAGE_LENGTH = 2000;
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
    return;
  }

  try {
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      include: { members: true },
    });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    const membership = pod.members.find((m) => m.userId === userId);
    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this pod' });
      return;
    }

    for (const m of pod.members) {
      if (await hasBlockingRelationship(userId, m.userId)) {
        res.status(403).json({ error: "You can't send messages in this pod." });
        return;
      }
    }

    const message = await prisma.message.create({
      data: { podId, userId, content: trimmed },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    // Fire-and-forget — don't await so message response isn't delayed
    notifyNewMessage(podId, userId, message.user.name, trimmed).catch(() => {});

    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
