import { Router, Response } from 'express';
import prisma from '../prisma';
import { requireVerifiedAuth as requireAuth, AuthRequest } from '../middleware/auth';
import { hasBlockingRelationshipWithAny } from '../lib/blocks';
import { NotificationService } from '../lib/NotificationService';
import { isValidReactionEmoji } from '../lib/reactionEmojis';
import { setTyping, getTypingUserIds } from '../lib/typingStore';
import { broadcast, podTopic, REALTIME_EVENTS, userTopic } from '../lib/realtime';
import { withDisplayName } from '../lib/userNames';
import { moderateTextContent } from '../lib/contentModeration';
import { stampPodReadState } from '../lib/podReadState';

const router = Router({ mergeParams: true });

function formatPodMessage<T extends {
  user: { id: string; name: string; firstName?: string | null; lastName?: string | null };
  replyTo?: {
    user: { id: string; name: string; firstName?: string | null; lastName?: string | null };
  } | null;
}>(message: T): T {
  return {
    ...message,
    user: withDisplayName(message.user, 'public'),
    replyTo: message.replyTo
      ? { ...message.replyTo, user: withDisplayName(message.replyTo.user, 'public') }
      : message.replyTo,
  };
}

const MESSAGE_INCLUDE = {
  user: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } },
  reactions: { select: { emoji: true, userId: true } },
  replyTo: {
    select: {
      id: true,
      content: true,
      userId: true,
      user: { select: { id: true, name: true, firstName: true, lastName: true } },
    },
  },
} as const;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function parsePageSize(raw: unknown): number {
  const parsed = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  if (isNaN(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

// GET /pods/:id/messages
// Query params:
//   limit  — page size (default 50, max 200)
//   after  — message id; return only messages newer than this (cheap polling)
//   before — message id; return the page of messages older than this (history)
// Without cursors, returns the most recent `limit` messages.
// Always ascending by createdAt. `hasMore` indicates older history exists.
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const podId = req.params.id;
  const userId = req.user!.userId;
  const limit = parsePageSize(req.query.limit);
  const after = typeof req.query.after === 'string' ? req.query.after : null;
  const before = typeof req.query.before === 'string' ? req.query.before : null;

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

    if (await hasBlockingRelationshipWithAny(userId, pod.members.map((m) => m.userId))) {
      res.status(403).json({ error: "You can't view messages in this pod." });
      return;
    }

    // Deleted messages can invalidate a cursor — resolve it first and fall
    // back to the latest page when it no longer exists.
    const cursorId = after ?? before;
    const cursorExists = cursorId
      ? (await prisma.message.findUnique({ where: { id: cursorId, podId }, select: { id: true } })) != null
      : false;

    let messages;
    let hasMore = false;
    if (after && cursorExists) {
      // Poll path: only messages newer than the cursor.
      messages = await prisma.message.findMany({
        where: { podId },
        include: MESSAGE_INCLUDE,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        cursor: { id: after },
        skip: 1,
        take: MAX_PAGE_SIZE,
      });
    } else if (before && cursorExists) {
      // History path: page of older messages ending just before the cursor.
      const older = await prisma.message.findMany({
        where: { podId },
        include: MESSAGE_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        cursor: { id: before },
        skip: 1,
        take: limit + 1,
      });
      hasMore = older.length > limit;
      messages = older.slice(0, limit).reverse();
    } else {
      // Initial load: latest page.
      const latest = await prisma.message.findMany({
        where: { podId },
        include: MESSAGE_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      });
      hasMore = latest.length > limit;
      messages = latest.slice(0, limit).reverse();
    }

    const typingUserIds = getTypingUserIds('pod', podId, userId);
    await stampPodReadState(userId, podId);
    // Reading clears unread — ping the reader's own inbox topic so their tab
    // badge refreshes immediately instead of waiting for the 60s poll.
    await broadcast(userTopic(userId), REALTIME_EVENTS.INBOX_UPDATED);

    res.json({ messages: messages.map(formatPodMessage), typingUserIds, hasMore });
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
  const moderation = await moderateTextContent([trimmed]);
  if (moderation) {
    res.status(moderation.status).json({ error: moderation.message });
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

    if (await hasBlockingRelationshipWithAny(userId, pod.members.map((m) => m.userId))) {
      res.status(403).json({ error: "You can't send messages in this pod." });
      return;
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
        user: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } },
        reactions: { select: { emoji: true, userId: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            userId: true,
            user: { select: { id: true, name: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    // Fire-and-forget — don't await so message response isn't delayed
    NotificationService.notifyNewMessage(podId, userId).catch(() => {});
    stampPodReadState(userId, podId).catch(() => {});
    await Promise.all([
      broadcast(podTopic(podId), REALTIME_EVENTS.NEW_MESSAGE, { userId }),
      ...pod.members
        .filter((member) => member.userId !== userId)
        .map((member) => broadcast(userTopic(member.userId), REALTIME_EVENTS.INBOX_UPDATED)),
    ]);

    res.status(201).json(formatPodMessage(message));
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

    if (await hasBlockingRelationshipWithAny(userId, pod.members.map((m) => m.userId))) {
      res.status(403).json({ error: "You can't react in this pod." });
      return;
    }

    await prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: { messageId: msgId, userId, emoji },
      },
      create: { messageId: msgId, userId, emoji },
      update: {},
    });
    await broadcast(podTopic(podId), REALTIME_EVENTS.MESSAGE_UPDATE, { userId });

    const updated = await prisma.message.findUnique({
      where: { id: msgId },
      include: {
        user: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } },
        reactions: { select: { emoji: true, userId: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            userId: true,
            user: { select: { id: true, name: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    res.json(updated ? formatPodMessage(updated) : updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /pods/:id/messages/:msgId — delete a message (author only)
router.delete('/:msgId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const podId = req.params.id;
  const msgId = req.params.msgId;
  const userId = req.user!.userId;

  try {
    const message = await prisma.message.findUnique({
      where: { id: msgId, podId },
    });
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }
    if (message.userId !== userId) {
      res.status(403).json({ error: 'You can only delete your own messages' });
      return;
    }
    await prisma.message.delete({ where: { id: msgId } });
    await broadcast(podTopic(podId), REALTIME_EVENTS.MESSAGE_UPDATE, { userId });
    res.status(204).send();
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
    await broadcast(podTopic(podId), REALTIME_EVENTS.MESSAGE_UPDATE, { userId });

    const updated = await prisma.message.findUnique({
      where: { id: msgId },
      include: {
        user: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } },
        reactions: { select: { emoji: true, userId: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            userId: true,
            user: { select: { id: true, name: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    res.json(updated ? formatPodMessage(updated) : updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
