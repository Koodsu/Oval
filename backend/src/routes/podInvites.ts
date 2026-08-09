import { Router, Response } from 'express';
import { AuthRequest, requireVerifiedAuth as requireAuth } from '../middleware/auth';
import prisma from '../prisma';
import { hasBlockingRelationship } from '../lib/blocks';
import { areFriends } from '../lib/friendUtils';
import { joinExistingPodMember, parsePodMembers } from '../lib/joinExistingPod';
import { withDisplayName } from '../lib/userNames';
import { broadcast, REALTIME_EVENTS, userTopic } from '../lib/realtime';
import { NotificationService } from '../lib/NotificationService';

const router = Router();

const FORMING = 'FORMING';
const LOCKED = 'LOCKED';
const EXPIRED = 'EXPIRED';
const COMPLETED = 'COMPLETED';

// POST /pods/:id/invite — invite a friend to a pod
router.post('/:id/invite', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const senderId = req.user!.userId;
  const podId = req.params.id;
  const { receiverId } = req.body as { receiverId?: string };

  if (!receiverId || typeof receiverId !== 'string') {
    res.status(400).json({ error: 'receiverId is required' });
    return;
  }

  if (senderId === receiverId) {
    res.status(400).json({ error: 'Cannot invite yourself' });
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

    if (pod.status !== FORMING) {
      res.status(409).json({ error: 'Pod is no longer accepting invites' });
      return;
    }

    if (pod.members.length >= pod.maxMembers) {
      res.status(409).json({ error: 'Pod is full' });
      return;
    }

    // Sender must be a member of the pod
    const isMember = pod.members.some((m) => m.userId === senderId);
    if (!isMember) {
      res.status(403).json({ error: 'You must be a pod member to invite others' });
      return;
    }

    // Receiver must not already be a member
    const alreadyMember = pod.members.some((m) => m.userId === receiverId);
    if (alreadyMember) {
      res.status(409).json({ error: 'User is already in this pod' });
      return;
    }

    const friends = await areFriends(senderId, receiverId);
    if (!friends) {
      res.status(403).json({ error: 'You can only invite friends to a pod' });
      return;
    }

    const blocked = await hasBlockingRelationship(senderId, receiverId);
    if (blocked) {
      res.status(403).json({ error: 'Cannot invite this user' });
      return;
    }

    // No duplicate pending invite
    const existing = await prisma.podInvite.findFirst({
      where: { podId, senderId, receiverId, status: 'PENDING' },
    });
    if (existing) {
      res.status(409).json({ error: 'Invite already sent' });
      return;
    }

    const invite = await prisma.podInvite.create({
      data: { podId, senderId, receiverId, status: 'PENDING' },
      include: {
        pod: { include: { activity: true } },
        sender: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
    await broadcast(userTopic(receiverId), REALTIME_EVENTS.INBOX_UPDATED);
    NotificationService.notifyPodInvite(invite.id).catch(() => {});

    res.status(201).json({
      ...invite,
      sender: invite.sender ? withDisplayName(invite.sender, 'full') : invite.sender,
      receiver: invite.receiver ? withDisplayName(invite.receiver, 'full') : invite.receiver,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods/invites — incoming PENDING pod invites for the current user
router.get('/invites', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const now = new Date();
    const invites = await prisma.podInvite.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
        pod: {
          AND: [
            { status: { notIn: [EXPIRED, COMPLETED] } },
            { meetupTime: { gt: now } },
          ],
        },
      },
      include: {
        pod: { include: { activity: true, members: { include: { user: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } } } } } },
        sender: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true, verifiedUniversity: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter to only invites where the pod is still FORMING and not full
    const valid = invites.filter(
      (inv) => inv.pod.status === FORMING && inv.pod.members.length < inv.pod.maxMembers
    );

    // Expire invalid invites (best-effort, non-blocking)
    const invalidIds = invites
      .filter((inv) => !valid.find((v) => v.id === inv.id))
      .map((inv) => inv.id);

    if (invalidIds.length > 0) {
      prisma.podInvite
        .updateMany({ where: { id: { in: invalidIds } }, data: { status: 'EXPIRED' } })
        .catch(() => {});
    }

    res.json(valid.map((invite) => ({
      ...invite,
      pod: parsePodMembers(invite.pod),
      sender: invite.sender ? withDisplayName(invite.sender, 'full') : invite.sender,
    })));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/invites/:id/accept — accept a pod invite
router.post('/invites/:id/accept', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: inviteId } = req.params;

  try {
    const invite = await prisma.podInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.status !== 'PENDING') {
      res.status(404).json({ error: 'Invite not found or already responded' });
      return;
    }

    if (invite.receiverId !== userId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    // Re-validate all join constraints before actually joining
    const pod = await prisma.pod.findUnique({
      where: { id: invite.podId },
      include: { members: true, activity: true },
    });

    if (!pod) {
      await prisma.podInvite.update({ where: { id: inviteId }, data: { status: 'EXPIRED' } });
      res.status(404).json({ error: 'Pod no longer exists' });
      return;
    }

    if (pod.status !== FORMING) {
      await prisma.podInvite.update({ where: { id: inviteId }, data: { status: 'EXPIRED' } });
      res.status(409).json({ error: 'Pod is no longer accepting members' });
      return;
    }

    if (pod.members.length >= pod.maxMembers) {
      await prisma.podInvite.update({ where: { id: inviteId }, data: { status: 'EXPIRED' } });
      res.status(409).json({ error: 'Pod is full' });
      return;
    }

    const alreadyMember = pod.members.some((m) => m.userId === userId);
    if (alreadyMember) {
      await prisma.podInvite.update({
        where: { id: inviteId },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      res.status(409).json({ error: 'Already a member of this pod' });
      return;
    }

    // Check no blocking with any member
    for (const m of pod.members) {
      if (await hasBlockingRelationship(userId, m.userId)) {
        res.status(403).json({ error: "You can't join this pod" });
        return;
      }
    }

    // Check not already in an active pod for this activity
    const existingMembership = await prisma.podMember.findFirst({
      where: {
        userId,
        pod: {
          activityId: pod.activityId,
          status: { in: [FORMING, LOCKED] },
        },
      },
    });

    if (existingMembership) {
      res.status(409).json({ error: 'You are already in an active pod for this activity' });
      return;
    }

    const result = await joinExistingPodMember(userId, pod.id, { markInviteAcceptedId: inviteId });

    if (!result.ok) {
      const expireInvite =
        result.status === 404 ||
        result.error === 'This pod is full' ||
        result.error === 'This pod is no longer available' ||
        result.error === 'This pod is no longer accepting members';
      if (expireInvite) {
        await prisma.podInvite
          .update({ where: { id: inviteId }, data: { status: 'EXPIRED' } })
          .catch(() => {});
      }
      res.status(result.status).json({ error: result.error });
      return;
    }

    await Promise.all([
      broadcast(userTopic(invite.senderId), REALTIME_EVENTS.INBOX_UPDATED),
      broadcast(userTopic(invite.receiverId), REALTIME_EVENTS.INBOX_UPDATED),
    ]);
    res.status(201).json(parsePodMembers(result.updatedPod));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/invites/:id/decline — decline a pod invite
router.post('/invites/:id/decline', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: inviteId } = req.params;

  try {
    const invite = await prisma.podInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.status !== 'PENDING') {
      res.status(404).json({ error: 'Invite not found or already responded' });
      return;
    }

    if (invite.receiverId !== userId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    await prisma.podInvite.update({
      where: { id: inviteId },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
    await Promise.all([
      broadcast(userTopic(invite.senderId), REALTIME_EVENTS.INBOX_UPDATED),
      broadcast(userTopic(invite.receiverId), REALTIME_EVENTS.INBOX_UPDATED),
    ]);

    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
