import { Router, Response } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth';
import prisma from '../prisma';
import { hasBlockingRelationship, getBlockedUserIds } from '../lib/blocks';
import { areFriends, normalizeUserPair } from '../lib/friendUtils';

const router = Router();
router.use(requireAuth);

const MAX_DM_LENGTH = 2000;

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
        userA: { select: { id: true, name: true, avatarUrl: true, verifiedUniversity: true } },
        userB: { select: { id: true, name: true, avatarUrl: true, verifiedUniversity: true } },
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

    const result = filtered.map((t) => ({
      id: t.id,
      otherUser: t.userAId === userId ? t.userB : t.userA,
      lastMessage: t.messages[0] ?? null,
      updatedAt: t.updatedAt,
    }));

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

    const messages = await prisma.directMessage.findMany({
      where: { threadId },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(messages);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /messages/threads/:id/messages — send a message in a thread
router.post('/threads/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: threadId } = req.params;
  const { content } = req.body as { content?: string };

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({ error: 'Message content is required' });
    return;
  }
  if (content.length > MAX_DM_LENGTH) {
    res.status(400).json({ error: `Message too long (max ${MAX_DM_LENGTH} characters)` });
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

    const [message] = await prisma.$transaction([
      prisma.directMessage.create({
        data: { threadId, senderId: userId, content: content.trim() },
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.directMessageThread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() },
      }),
    ]);

    res.status(201).json(message);
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
        userA: { select: { id: true, name: true, avatarUrl: true, verifiedUniversity: true } },
        userB: { select: { id: true, name: true, avatarUrl: true, verifiedUniversity: true } },
      },
    });

    res.json({
      id: thread.id,
      otherUser: thread.userAId === myId ? thread.userB : thread.userA,
      updatedAt: thread.updatedAt,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
