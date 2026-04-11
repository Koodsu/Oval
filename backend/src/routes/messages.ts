import { Router, Response } from 'express';
import prisma from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { hasBlockingRelationship } from '../lib/blocks';
import { notifyNewMessage } from '../lib/NotificationService';
import { isValidReactionEmoji } from '../lib/reactionEmojis';
import { setTyping, getTypingUserIds } from '../lib/typingStore';

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
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        reactions: { select: { emoji: true, userId: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const typingUserIds = getTypingUserIds('pod', podId, userId);

    res.json({ messages, typingUserIds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/messages
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const podId = req.params.id;
  const userId = req.user!.userId;
  const { content, replyToId } = req.body as { content?: string; replyToId?: string };

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

    const data: { podId: string; userId: string; content: string; replyToId?: string } = {
      podId,
      userId,
      content: trimmed,
    };
    if (replyToId && typeof replyToId === 'string') {
      const replyTo = await prisma.message.findUnique({
        where: { id: replyToId, podId },
      });
      if (replyTo) data.replyToId = replyToId;
    }

    const message = await prisma.message.create({
      data,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        reactions: { select: { emoji: true, userId: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Fire-and-forget — don't await so message response isn't delayed
    notifyNewMessage(podId, userId, message.user.name, trimmed).catch(() => {});

    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/messages/:msgId/reactions — add reaction
router.post('/:msgId/reactions', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const podId = req.params.id;
  const msgId = req.params.msgId;
  const userId = req.user!.userId;
  const { emoji } = req.body as { emoji?: string };

  if (!emoji || typeof emoji !== 'string' || !isValidReactionEmoji(emoji)) {
    res.status(400).json({ error: 'Valid emoji is required (👍 ❤️ 😂 😮 😢)' });
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
      res.status(403).json({ error: 'Not a member of this pod' });
      return;
    }

    const message = await prisma.message.findUnique({
      where: { id: msgId, podId },
    });
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    for (const m of pod.members) {
      if (await hasBlockingRelationship(userId, m.userId)) {
        res.status(403).json({ error: "You can't react in this pod." });
        return;
      }
    }

    await prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: { messageId: msgId, userId, emoji },
      },
      create: { messageId: msgId, userId, emoji },
      update: {},
    });

    const updated = await prisma.message.findUnique({
      where: { id: msgId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        reactions: { select: { emoji: true, userId: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /pods/:id/messages/:msgId/reactions — remove reaction (emoji in query)
router.delete('/:msgId/reactions', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const podId = req.params.id;
  const msgId = req.params.msgId;
  const userId = req.user!.userId;
  const emoji = (req.query.emoji ?? req.body?.emoji) as string | undefined;

  if (!emoji || !isValidReactionEmoji(emoji)) {
    res.status(400).json({ error: 'Valid emoji is required (👍 ❤️ 😂 😮 😢)' });
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
      res.status(403).json({ error: 'Not a member of this pod' });
      return;
    }

    await prisma.messageReaction.deleteMany({
      where: { messageId: msgId, userId, emoji },
    });

    const updated = await prisma.message.findUnique({
      where: { id: msgId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        reactions: { select: { emoji: true, userId: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
