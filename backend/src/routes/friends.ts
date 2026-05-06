import { Router, Response } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth';
import prisma from '../prisma';
import { getBlockedUserIds, hasBlockingRelationship } from '../lib/blocks';
import { normalizeUserPair } from '../lib/friendUtils';
import { withDisplayName } from '../lib/userNames';
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  unfriend,
} from '../services/friendService';

const router = Router();
router.use(requireAuth);

const friendUserSelect = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  verifiedUniversity: true,
} as const;

// GET /friends — list accepted friends, excluding any with a block relationship
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const blockedIds = await getBlockedUserIds(userId);

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: { select: friendUserSelect },
        userB: { select: friendUserSelect },
      },
      orderBy: { createdAt: 'desc' },
    });

    const friends = friendships
      .map((f) => (f.userAId === userId ? f.userB : f.userA))
      .filter((u) => !blockedIds.has(u.id))
      .map((friend) => withDisplayName(friend, 'full'));

    res.json(friends);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /friends/requests — incoming and outgoing PENDING requests
router.get('/requests', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const [incoming, outgoing] = await Promise.all([
      prisma.friendRequest.findMany({
        where: { receiverId: userId, status: 'PENDING' },
        include: { sender: { select: friendUserSelect } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.friendRequest.findMany({
        where: { senderId: userId, status: 'PENDING' },
        include: { receiver: { select: friendUserSelect } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    res.json({
      incoming: incoming.map((request) => ({
        ...request,
        sender: request.sender ? withDisplayName(request.sender, 'full') : request.sender,
      })),
      outgoing: outgoing.map((request) => ({
        ...request,
        receiver: request.receiver ? withDisplayName(request.receiver, 'full') : request.receiver,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /friends/requests — send a friend request
router.post('/requests', async (req: AuthRequest, res: Response): Promise<void> => {
  const senderId = req.user!.userId;
  const { receiverId } = req.body as { receiverId?: string };

  if (!receiverId || typeof receiverId !== 'string') {
    res.status(400).json({ error: 'receiverId is required' });
    return;
  }

  try {
    const friendRequest = await sendFriendRequest(senderId, receiverId);
    res.status(201).json(friendRequest);
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? 'Internal server error' });
  }
});

// POST /friends/requests/:id/accept — accept an incoming request
router.post('/requests/:id/accept', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;
  try {
    await acceptFriendRequest(id, userId);
    res.json({ ok: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? 'Internal server error' });
  }
});

// POST /friends/requests/:id/decline — decline an incoming request
router.post('/requests/:id/decline', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;
  try {
    await declineFriendRequest(id, userId);
    res.json({ ok: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? 'Internal server error' });
  }
});

// DELETE /friends/requests/:id — cancel an outgoing request
router.delete('/requests/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;
  try {
    await cancelFriendRequest(id, userId);
    res.status(204).send();
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? 'Internal server error' });
  }
});

// DELETE /friends/:userId — unfriend
router.delete('/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  const actingUserId = req.user!.userId;
  const { userId: otherUserId } = req.params;
  try {
    await unfriend(actingUserId, otherUserId);
    res.status(204).send();
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message ?? 'Internal server error' });
  }
});

// GET /friends/relationship/:userId — get relationship state for profile UI
// Returns: { status: 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS', requestId?: string }
router.get('/relationship/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { userId: otherId } = req.params;

  if (userId === otherId) {
    res.json({ status: 'SELF' });
    return;
  }

  try {
    const blocked = await hasBlockingRelationship(userId, otherId);
    if (blocked) {
      res.json({ status: 'BLOCKED' });
      return;
    }

    const [a, b] = normalizeUserPair(userId, otherId);
    const friendship = await prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId: a, userBId: b } },
      select: { id: true },
    });
    if (friendship) {
      res.json({ status: 'FRIENDS' });
      return;
    }

    const pending = await prisma.friendRequest.findFirst({
      where: {
        status: 'PENDING',
        OR: [
          { senderId: userId, receiverId: otherId },
          { senderId: otherId, receiverId: userId },
        ],
      },
      select: { id: true, senderId: true },
    });

    if (pending) {
      const status = pending.senderId === userId ? 'PENDING_SENT' : 'PENDING_RECEIVED';
      res.json({ status, requestId: pending.id });
      return;
    }

    res.json({ status: 'NONE' });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
