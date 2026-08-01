import { Router, Response } from 'express';
import { AuthRequest, requireVerifiedAuth as requireAuth } from '../middleware/auth';
import prisma from '../prisma';
import { hasBlockingRelationship, getBlockedUserIds } from '../lib/blocks';
import { areFriends, normalizeUserPair } from '../lib/friendUtils';
import { isValidReactionEmoji } from '../lib/reactionEmojis';
import { setTyping, getTypingUserIds } from '../lib/typingStore';
import { broadcast, dmTopic, REALTIME_EVENTS, userTopic } from '../lib/realtime';
import { withDisplayName } from '../lib/userNames';
import { moderateTextContent } from '../lib/contentModeration';
import { NotificationService } from '../lib/NotificationService';

const router = Router();
router.use(requireAuth);

const MAX_DM_LENGTH = 2000;

function formatDmMessage<T extends {
  sender: { id: string; name: string; firstName?: string | null; lastName?: string | null };
  replyTo?: {
    sender: { id: string; name: string; firstName?: string | null; lastName?: string | null };
  } | null;
}>(message: T): T {
  return {
    ...message,
    sender: withDisplayName(message.sender, 'full'),
    replyTo: message.replyTo
      ? { ...message.replyTo, sender: withDisplayName(message.replyTo.sender, 'full') }
      : message.replyTo,
  };
}

// GET /messages/threads — list DM threads for the current user
router.get('/threads', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const blockedIds = await getBlockedUserIds(userId);

    const threads = await prisma.directMessageThread.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true, verifiedUniversity: true } },
        userB: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true, verifiedUniversity: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true, senderId: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Filter out threads involving blocked users
    const filtered = threads.filter((t) => {
      const otherId = t.userAId === userId ? t.userBId : t.userAId;
      return !blockedIds.has(otherId);
    });

    const result = filtered.map((t) => {
      const lastMsg = t.messages[0] ?? null;
      const myLastReadAt = t.userAId === userId ? t.userALastReadAt : t.userBLastReadAt;
      const hasUnread =
        !!lastMsg &&
        lastMsg.senderId !== userId &&
        (!myLastReadAt || myLastReadAt < lastMsg.createdAt);
      return {
        id: t.id,
        otherUser: withDisplayName(t.userAId === userId ? t.userB : t.userA, 'full'),
        lastMessage: lastMsg,
        updatedAt: t.updatedAt,
        hasUnread,
      };
    });

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /messages/threads/:id — get messages in a thread
router.get('/threads/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: threadId } = req.params;
  try {
    const thread = await prisma.directMessageThread.findUnique({
      where: { id: threadId },
      select: {
        userAId: true,
        userBId: true,
        userALastReadAt: true,
        userBLastReadAt: true,
        userA: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            verifiedUniversity: true,
          },
        },
        userB: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            verifiedUniversity: true,
          },
        },
      },
    });
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const isParticipant = thread.userAId === userId || thread.userBId === userId;
    if (!isParticipant) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const otherId = thread.userAId === userId ? thread.userBId : thread.userAId;

    const blocked = await hasBlockingRelationship(userId, otherId);
    if (blocked) {
      res.status(403).json({ error: 'Cannot access this thread' });
      return;
    }

    const friends = await areFriends(userId, otherId);
    if (!friends) {
      res.status(403).json({ error: 'Must be friends to view messages' });
      return;
    }

    const DM_INCLUDE = {
      sender: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } },
      reactions: { select: { emoji: true, userId: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          senderId: true,
          sender: { select: { id: true, name: true, firstName: true, lastName: true } },
        },
      },
    } as const;

    // Pagination: ?limit (default 50, max 200), ?after=<msgId> for new
    // messages only (polling), ?before=<msgId> for older history.
    const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : NaN;
    const limit = isNaN(rawLimit) || rawLimit <= 0 ? 50 : Math.min(rawLimit, 200);
    const after = typeof req.query.after === 'string' ? req.query.after : null;
    const before = typeof req.query.before === 'string' ? req.query.before : null;
    const cursorId = after ?? before;
    const cursorExists = cursorId
      ? (await prisma.directMessage.findUnique({
          where: { id: cursorId, threadId },
          select: { id: true },
        })) != null
      : false;

    let messages;
    let hasMore = false;
    if (after && cursorExists) {
      messages = await prisma.directMessage.findMany({
        where: { threadId },
        include: DM_INCLUDE,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        cursor: { id: after },
        skip: 1,
        take: 200,
      });
    } else if (before && cursorExists) {
      const older = await prisma.directMessage.findMany({
        where: { threadId },
        include: DM_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        cursor: { id: before },
        skip: 1,
        take: limit + 1,
      });
      hasMore = older.length > limit;
      messages = older.slice(0, limit).reverse();
    } else {
      const latest = await prisma.directMessage.findMany({
        where: { threadId },
        include: DM_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      });
      hasMore = latest.length > limit;
      messages = latest.slice(0, limit).reverse();
    }

    const typingUserIds = getTypingUserIds('dm', threadId, userId);
    const otherLastReadAt =
      thread.userAId === userId ? thread.userBLastReadAt : thread.userALastReadAt;
    const otherUser = withDisplayName(
      thread.userAId === userId ? thread.userB : thread.userA,
      'full',
    );

    res.json({
      messages: messages.map(formatDmMessage),
      otherUser,
      typingUserIds,
      otherLastReadAt: otherLastReadAt?.toISOString() ?? null,
      hasMore,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /messages/threads/:id/read — mark thread as read
router.patch('/threads/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: threadId } = req.params;
  try {
    const thread = await prisma.directMessageThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }
    const isParticipant = thread.userAId === userId || thread.userBId === userId;
    if (!isParticipant) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }
    const now = new Date();
    await prisma.directMessageThread.update({
      where: { id: threadId },
      data:
        thread.userAId === userId
          ? { userALastReadAt: now }
          : { userBLastReadAt: now },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /messages/threads/:id/typing
router.post('/threads/:id/typing', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: threadId } = req.params;
  try {
    const thread = await prisma.directMessageThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }
    const isParticipant = thread.userAId === userId || thread.userBId === userId;
    if (!isParticipant) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }
    setTyping('dm', threadId, userId);
    void broadcast(dmTopic(threadId), REALTIME_EVENTS.TYPING);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /messages/threads/:id/messages/:msgId/reactions — add DM reaction
router.post('/threads/:id/messages/:msgId/reactions', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: threadId, msgId } = req.params;
  const { emoji } = req.body as { emoji?: string };

  if (!emoji || typeof emoji !== 'string' || !isValidReactionEmoji(emoji)) {
    res.status(400).json({ error: 'Valid emoji is required (👍 ❤️ 😂 😮 😢)' });
    return;
  }

  try {
    const thread = await prisma.directMessageThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const isParticipant = thread.userAId === userId || thread.userBId === userId;
    if (!isParticipant) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const otherId = thread.userAId === userId ? thread.userBId : thread.userAId;
    const blocked = await hasBlockingRelationship(userId, otherId);
    if (blocked) {
      res.status(403).json({ error: 'Cannot access this thread' });
      return;
    }

    const dm = await prisma.directMessage.findUnique({
      where: { id: msgId, threadId },
    });
    if (!dm) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    await prisma.directMessageReaction.upsert({
      where: {
        directMessageId_userId_emoji: { directMessageId: msgId, userId, emoji },
      },
      create: { directMessageId: msgId, userId, emoji },
      update: {},
    });
    void broadcast(dmTopic(threadId), REALTIME_EVENTS.MESSAGE_UPDATE);

    const updated = await prisma.directMessage.findUnique({
      where: { id: msgId },
      include: {
        sender: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } },
        reactions: { select: { emoji: true, userId: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            senderId: true,
            sender: { select: { id: true, name: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    res.json(updated ? formatDmMessage(updated) : updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /messages/threads/:id/messages/:msgId/reactions — remove DM reaction
router.delete('/threads/:id/messages/:msgId/reactions', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: threadId, msgId } = req.params;
  const emoji = (req.query.emoji ?? req.body?.emoji) as string | undefined;

  if (!emoji || !isValidReactionEmoji(emoji)) {
    res.status(400).json({ error: 'Valid emoji is required (👍 ❤️ 😂 😮 😢)' });
    return;
  }

  try {
    const thread = await prisma.directMessageThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const isParticipant = thread.userAId === userId || thread.userBId === userId;
    if (!isParticipant) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    await prisma.directMessageReaction.deleteMany({
      where: { directMessageId: msgId, userId, emoji },
    });
    void broadcast(dmTopic(threadId), REALTIME_EVENTS.MESSAGE_UPDATE);

    const updated = await prisma.directMessage.findUnique({
      where: { id: msgId },
      include: {
        sender: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } },
        reactions: { select: { emoji: true, userId: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            senderId: true,
            sender: { select: { id: true, name: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    res.json(updated ? formatDmMessage(updated) : updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /messages/threads/:id/messages/:msgId — delete a DM (sender only)
router.delete('/threads/:id/messages/:msgId', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: threadId, msgId } = req.params;

  try {
    const dm = await prisma.directMessage.findUnique({
      where: { id: msgId, threadId },
    });
    if (!dm) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }
    if (dm.senderId !== userId) {
      res.status(403).json({ error: 'You can only delete your own messages' });
      return;
    }
    await prisma.directMessage.delete({ where: { id: msgId } });
    void broadcast(dmTopic(threadId), REALTIME_EVENTS.MESSAGE_UPDATE);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /messages/threads/:id/messages — send a message in a thread
router.post('/threads/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: threadId } = req.params;
  const { content, replyToId } = req.body as { content?: string; replyToId?: string };

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({ error: 'Message content is required' });
    return;
  }
  if (content.length > MAX_DM_LENGTH) {
    res.status(400).json({ error: `Message too long (max ${MAX_DM_LENGTH} characters)` });
    return;
  }
  const moderation = await moderateTextContent([content]);
  if (moderation) {
    res.status(moderation.status).json({ error: moderation.message });
    return;
  }

  try {
    const thread = await prisma.directMessageThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const isParticipant = thread.userAId === userId || thread.userBId === userId;
    if (!isParticipant) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const otherId = thread.userAId === userId ? thread.userBId : thread.userAId;

    const blocked = await hasBlockingRelationship(userId, otherId);
    if (blocked) {
      res.status(403).json({ error: 'Cannot send messages to this user' });
      return;
    }

    const friends = await areFriends(userId, otherId);
    if (!friends) {
      res.status(403).json({ error: 'Must be friends to send messages' });
      return;
    }

    const data: { threadId: string; senderId: string; content: string; replyToId?: string } = {
      threadId,
      senderId: userId,
      content: content.trim(),
    };
    if (replyToId && typeof replyToId === 'string') {
      const replyTo = await prisma.directMessage.findUnique({
        where: { id: replyToId, threadId },
      });
      if (replyTo) data.replyToId = replyToId;
    }

    const [message] = await prisma.$transaction([
      prisma.directMessage.create({
        data,
        include: {
          sender: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } },
          reactions: { select: { emoji: true, userId: true } },
          replyTo: {
            select: {
              id: true,
              content: true,
              senderId: true,
              sender: { select: { id: true, name: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.directMessageThread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() },
      }),
    ]);

    void broadcast(dmTopic(threadId), REALTIME_EVENTS.NEW_MESSAGE);
    void broadcast(userTopic(otherId), REALTIME_EVENTS.INBOX_UPDATED);
    NotificationService.notifyDirectMessage(threadId, userId).catch(() => {});

    res.status(201).json(formatDmMessage(message));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /messages/threads/by-user/:userId — get or create thread with a specific friend
// Used when navigating to a DM from a profile (where you may not know the threadId yet)
router.get('/threads/by-user/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  const myId = req.user!.userId;
  const { userId: otherId } = req.params;

  if (myId === otherId) {
    res.status(400).json({ error: 'Cannot DM yourself' });
    return;
  }

  try {
    const blocked = await hasBlockingRelationship(myId, otherId);
    if (blocked) {
      res.status(403).json({ error: 'Cannot message this user' });
      return;
    }

    const friends = await areFriends(myId, otherId);
    if (!friends) {
      res.status(403).json({ error: 'Must be friends to send messages' });
      return;
    }

    const [userAId, userBId] = normalizeUserPair(myId, otherId);

    const thread = await prisma.directMessageThread.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      update: {},
      create: { userAId, userBId },
      include: {
        userA: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true, verifiedUniversity: true } },
        userB: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true, verifiedUniversity: true } },
      },
    });

    res.json({
      id: thread.id,
      otherUser: withDisplayName(thread.userAId === myId ? thread.userB : thread.userA, 'full'),
      updatedAt: thread.updatedAt,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
