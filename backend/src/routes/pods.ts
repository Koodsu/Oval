import { Router, Response } from 'express';
import prisma from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getLocationsForCategory } from '../config/locations';
import { getBlockedUserIds, hasBlockingRelationship } from '../lib/blocks';
import { NotificationService } from '../lib/NotificationService';
import { setTyping } from '../lib/typingStore';

// Select shape used for pod member user fields across all pod queries
const MEMBER_USER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  interestTags: true,
  classYear: true,
  major: true,
} as const;

function parseMemberTags<T extends { user: { interestTags?: string | null } }>(member: T) {
  let tags: string[] = [];
  if (member.user.interestTags) {
    try { tags = JSON.parse(member.user.interestTags); } catch { /* ignore */ }
  }
  return { ...member, user: { ...member.user, interestTags: tags } };
}

function parsePodMembers<T extends { members: Array<{ user: { interestTags?: string | null } }> }>(pod: T) {
  return { ...pod, members: pod.members.map(parseMemberTags) };
}

const router = Router();

const FORMING = 'FORMING';
const LOCKED = 'LOCKED';
const COMPLETED = 'COMPLETED';

function getMaxMeetupTime(): Date {
  const max = new Date();
  max.setDate(max.getDate() + 7);
  max.setHours(23, 59, 59, 999);
  return max;
}

// GET /pods/mine
router.get('/mine', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  try {
    const blockedIds = await getBlockedUserIds(userId);
    const pods = await prisma.pod.findMany({
      where: {
        members: {
          some: { userId },
          none: { userId: { in: [...blockedIds] } },
        },
      },
      include: {
        activity: true,
        members: {
          include: { user: { select: MEMBER_USER_SELECT } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(pods.map(parsePodMembers));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods/feed — cross-activity discovery feed, soonest first then most-joined
router.get('/feed', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { category, limit = '20' } = req.query;
  const userId = req.user!.userId;
  const now = new Date();

  try {
    const blockedIds = await getBlockedUserIds(userId);

    const where: Record<string, unknown> = {
      status: FORMING,
      meetupTime: { gt: now },
      members: { none: { userId: { in: [...blockedIds] } } },
    };

    if (category && typeof category === 'string') {
      where.activity = { category };
    }

    const [pods, pastMembers, recaps] = await Promise.all([
      prisma.pod.findMany({
        where,
        include: {
          activity: true,
          members: {
            include: { user: { select: MEMBER_USER_SELECT } },
          },
        },
        take: Math.min(Number(limit) || 20, 50),
      }),
      prisma.podMember.findMany({
        where: { userId },
        include: { pod: { select: { activityId: true } } },
        take: 50,
      }),
      prisma.podRecap.findMany({
        where: { userId },
        include: { pod: { select: { activityId: true } } },
      }),
    ]);

    // Build activity preference scores from past recaps
    // rating 3 = +1, rating 2 = 0, rating 1 = -1 (normalized to -1..+1)
    const activityRatingSum: Record<string, number> = {};
    const activityRatingCount: Record<string, number> = {};
    for (const recap of recaps) {
      const actId = recap.pod.activityId;
      activityRatingSum[actId] = (activityRatingSum[actId] ?? 0) + (recap.rating - 2);
      activityRatingCount[actId] = (activityRatingCount[actId] ?? 0) + 1;
    }

    const preferredActivityIds = new Set(pastMembers.map((pm) => pm.pod.activityId));

    function getActivityScore(activityId: string): number {
      const count = activityRatingCount[activityId] ?? 0;
      if (count === 0) return 0;
      return (activityRatingSum[activityId] ?? 0) / count; // -1..+1
    }

    // Sort: negatively-rated activities go last, then by meetupTime asc, then memberCount desc
    pods.sort((a, b) => {
      const scoreA = getActivityScore(a.activityId);
      const scoreB = getActivityScore(b.activityId);
      // Heavily negative activities (avg < -0.5) sink to the bottom
      const sinkA = scoreA < -0.5 ? 1 : 0;
      const sinkB = scoreB < -0.5 ? 1 : 0;
      if (sinkA !== sinkB) return sinkA - sinkB;
      // Otherwise sort by time then members
      const timeDiff = new Date(a.meetupTime).getTime() - new Date(b.meetupTime).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.members.length - a.members.length;
    });

    const result = pods.map((p) => parsePodMembers({ ...p, recommended: preferredActivityIds.has(p.activityId) }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods?activityId=&sort=
// Returns FORMING pods for an activity (locked pods excluded from browse)
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { activityId, sort } = req.query;

  if (!activityId || typeof activityId !== 'string') {
    res.status(400).json({ error: 'activityId query parameter is required' });
    return;
  }

  try {
    const blockedIds = await getBlockedUserIds(req.user!.userId);
    const where: Record<string, unknown> = {
      activityId,
      status: FORMING,
      members: { none: { userId: { in: [...blockedIds] } } },
    };

    let orderBy: Record<string, string> = { createdAt: 'desc' };
    if (sort === 'starting_soon') {
      orderBy = { meetupTime: 'asc' };
    }

    const pods = await prisma.pod.findMany({
      where,
      include: {
        activity: true,
        members: {
          include: { user: { select: MEMBER_USER_SELECT } },
        },
      },
      orderBy,
    });

    let result = pods;
    if (sort === 'most_members') {
      result = [...pods].sort((a, b) => b.members.length - a.members.length);
    }

    res.json(result.map(parsePodMembers));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/join
// Body option A – join a specific existing pod:  { podId }
// Body option B – create a brand new pod:         { activityId }
router.post('/join', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { podId, activityId } = req.body;

  if (!podId && !activityId) {
    res.status(400).json({ error: 'podId or activityId is required' });
    return;
  }

  try {
    // ── Option A: join a specific pod ─────────────────────────────────────────
    if (podId) {
      const pod = await prisma.pod.findUnique({
        where: { id: podId },
        include: { members: true, activity: true },
      });

      if (!pod) {
        res.status(404).json({ error: 'Pod not found' });
        return;
      }

      if (pod.status !== FORMING) {
        res.status(409).json({ error: 'This pod is no longer accepting members' });
        return;
      }

      if (pod.members.length >= pod.maxMembers) {
        res.status(409).json({ error: 'This pod is full' });
        return;
      }

      // Check no blocking relationship with any pod member
      for (const m of pod.members) {
        if (await hasBlockingRelationship(userId, m.userId)) {
          res.status(403).json({ error: "You can't join this pod." });
          return;
        }
      }

      // Check user is not already in an active pod for this activity
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

      await prisma.podMember.create({ data: { podId, userId } });

      // If this user was on the waitlist, mark as JOINED
      await prisma.podWaitlist.updateMany({
        where: { podId, userId, status: { in: ['WAITING', 'NOTIFIED'] } },
        data: { status: 'JOINED' },
      });

      const memberCount = await prisma.podMember.count({ where: { podId } });
      if (memberCount >= pod.maxMembers) {
        await prisma.pod.update({ where: { id: podId }, data: { status: LOCKED } });
      }

      const updatedPod = await prisma.pod.findUnique({
        where: { id: podId },
        include: {
          activity: true,
          creator: { select: { id: true } },
          members: { include: { user: { select: MEMBER_USER_SELECT } } },
        },
      });

      res.status(201).json(updatedPod ? parsePodMembers(updatedPod) : updatedPod);

      // Notify creator that someone joined (fire-and-forget)
      if (updatedPod?.creatorId && updatedPod.creatorId !== userId) {
        const joiner = updatedPod.members.find((m) => m.userId === userId);
        if (joiner) {
          NotificationService.notifyPodJoin(podId, joiner.userId).catch(() => {});
        }
      }
      return;
    }

    // ── Option B: create a new pod for an activity ───────────────────────────
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    // Check user is not already in an active pod for this activity
    const existingMembership = await prisma.podMember.findFirst({
      where: {
        userId,
        pod: {
          activityId,
          status: { in: [FORMING, LOCKED] },
        },
      },
    });

    if (existingMembership) {
      res.status(409).json({ error: 'You are already in an active pod for this activity' });
      return;
    }

    const minMembers = Math.max(2, Math.min(10, Number(req.body.minMembers) || 2));
    const maxMembers = Math.max(minMembers, Math.min(10, Number(req.body.maxMembers) || 4));
    const locationInput = typeof req.body.location === 'string' ? req.body.location.trim() : '';

    if (!locationInput) {
      res.status(400).json({ error: 'Location is required. Please select a location before creating a pod.' });
      return;
    }

    let meetupTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (req.body.meetupTime) {
      const parsed = new Date(req.body.meetupTime);
      if (isNaN(parsed.getTime())) {
        res.status(400).json({ error: 'Invalid meetupTime' });
        return;
      }
      const now = new Date();
      const maxTime = getMaxMeetupTime();
      if (parsed <= now) {
        res.status(400).json({ error: 'Meetup time must be in the future' });
        return;
      }
      if (parsed > maxTime) {
        res.status(400).json({ error: 'Meetup time cannot be more than 1 week from now' });
        return;
      }
      meetupTime = parsed;
    }

    let allowed = getLocationsForCategory(activity.category);
    if (activity.defaultLocation && !allowed.includes(activity.defaultLocation)) {
      allowed = [activity.defaultLocation, ...allowed];
    }
    if (allowed.length > 0 && !allowed.includes(locationInput)) {
      res.status(400).json({
        error: 'Invalid location. Must be from the activity category list.',
      });
      return;
    }

    const newPod = await prisma.pod.create({
      data: {
        activityId,
        meetupTime,
        location: locationInput,
        locationType: 'public',
        minMembers,
        maxMembers,
        status: FORMING,
        creatorId: userId,
      },
    });

    await prisma.podMember.create({ data: { podId: newPod.id, userId } });

    const updatedPod = await prisma.pod.findUnique({
      where: { id: newPod.id },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: MEMBER_USER_SELECT } } },
      },
    });

    res.status(201).json(updatedPod ? parsePodMembers(updatedPod) : updatedPod);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/lock – creator only; lock when memberCount >= minMembers
router.post('/:id/lock', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const pod = await prisma.pod.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }
    const creatorId = pod.creatorId ?? pod.members.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0]?.userId;
    if (creatorId !== userId) {
      res.status(403).json({ error: 'Only the pod creator can lock the pod' });
      return;
    }
    if (pod.status !== FORMING) {
      res.status(409).json({ error: 'Pod is already locked or completed' });
      return;
    }
    if (pod.members.length < pod.minMembers) {
      res.status(400).json({ error: `Need at least ${pod.minMembers} members to lock` });
      return;
    }

    const updated = await prisma.pod.update({
      where: { id },
      data: { status: LOCKED },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: MEMBER_USER_SELECT } } },
      },
    });
    res.json(parsePodMembers(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/leave – remove current user from pod; disband if empty
router.post('/:id/leave', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const pod = await prisma.pod.findUnique({
      where: { id },
      include: { members: true, activity: { select: { title: true } } },
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

    let podDeleted = false;
    const wasLocked = pod.status === LOCKED;

    await prisma.$transaction(async (tx) => {
      await tx.podMember.delete({ where: { id: membership.id } });
      const remainingCount = await tx.podMember.count({ where: { podId: id } });
      if (remainingCount === 0) {
        await tx.message.deleteMany({ where: { podId: id } });
        await tx.pod.delete({ where: { id } });
        podDeleted = true;
      } else {
        const updates: Record<string, unknown> = {};
        if (pod.creatorId === userId) {
          const nextCreator = await tx.podMember.findFirst({
            where: { podId: id },
            orderBy: { joinedAt: 'asc' },
          });
          if (nextCreator) updates.creatorId = nextCreator.userId;
        }
        // Reopen pod to FORMING when a member leaves a LOCKED pod
        if (wasLocked) updates.status = FORMING;
        if (Object.keys(updates).length > 0) {
          await tx.pod.update({ where: { id }, data: updates });
        }
      }
    });

    if (podDeleted) {
      res.json({ left: true, podDeleted: true });
      return;
    }

    // Notify first waitlisted user that a spot opened up (fire-and-forget)
    NotificationService.notifyWaitlistSpot(id, pod.activity?.title).catch(() => {});

    const updatedPod = await prisma.pod.findUnique({
      where: { id },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: MEMBER_USER_SELECT } } },
      },
    });
    res.json({ left: true, podDeleted: false, pod: updatedPod ? parsePodMembers(updatedPod) : updatedPod });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/unlock – creator only; unlock when memberCount < maxMembers
router.post('/:id/unlock', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const pod = await prisma.pod.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }
    const creatorId = pod.creatorId ?? pod.members.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0]?.userId;
    if (creatorId !== userId) {
      res.status(403).json({ error: 'Only the pod creator can unlock the pod' });
      return;
    }
    if (pod.status !== LOCKED) {
      res.status(409).json({ error: 'Pod is not locked' });
      return;
    }
    if (pod.members.length >= pod.maxMembers) {
      res.status(400).json({ error: 'Cannot unlock a full pod' });
      return;
    }

    const updated = await prisma.pod.update({
      where: { id },
      data: { status: FORMING },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: MEMBER_USER_SELECT } } },
      },
    });
    res.json(parsePodMembers(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/typing
router.post('/:id/typing', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id: podId } = req.params;
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
      res.status(403).json({ error: 'Not a member of this pod' });
      return;
    }
    setTyping('pod', podId, userId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.userId;

  const memberInclude = {
    include: { user: { select: MEMBER_USER_SELECT } },
  };

  try {
    let pod = await prisma.pod.findUnique({
      where: { id },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: memberInclude,
      },
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    // Hide pod if any member has blocking relationship with current user
    for (const m of pod.members) {
      if (await hasBlockingRelationship(userId, m.userId)) {
        res.status(404).json({ error: 'Pod not found' });
        return;
      }
    }

    // Lazy COMPLETED transition
    if (pod.status === LOCKED && pod.meetupTime < new Date()) {
      pod = await prisma.pod.update({
        where: { id },
        data: { status: COMPLETED },
        include: {
          activity: true,
          creator: { select: { id: true } },
          members: memberInclude,
        },
      });
    }

    // Include no-show user IDs + recap data for completed pods
    const [noShowUserIds, averageRating, myRecap] =
      pod.status === COMPLETED
        ? await Promise.all([
            prisma.noShowReport
              .findMany({
                where: { podId: id },
                select: { targetUserId: true },
                distinct: ['targetUserId'],
              })
              .then((r) => r.map((x) => x.targetUserId)),
            prisma.podRecap
              .aggregate({ where: { podId: id }, _avg: { rating: true } })
              .then((r) => r._avg.rating),
            prisma.podRecap.findUnique({
              where: { podId_userId: { podId: id, userId } },
            }),
          ])
        : [[], null, null];

    // Waitlist info
    const [waitlistCount, myWaitlistEntry] = await Promise.all([
      prisma.podWaitlist.count({ where: { podId: id, status: 'WAITING' } }),
      prisma.podWaitlist.findUnique({ where: { podId_userId: { podId: id, userId } } }),
    ]);
    const myWaitlistPosition =
      myWaitlistEntry && (myWaitlistEntry.status === 'WAITING' || myWaitlistEntry.status === 'NOTIFIED')
        ? myWaitlistEntry.position
        : null;

    res.json(parsePodMembers({
      ...pod,
      noShowUserIds,
      averageRating,
      myRecap,
      waitlistCount,
      myWaitlistPosition,
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods/:id/people-you-met — confirmed attendees who are not yet friends
router.get('/:id/people-you-met', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.userId;

  try {
    const pod = await prisma.pod.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                classYear: true,
                major: true,
                interestTags: true,
              },
            },
          },
        },
      },
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.status !== COMPLETED) {
      res.status(400).json({ error: 'Pod is not completed' });
      return;
    }

    const myMember = pod.members.find((m) => m.userId === userId);
    if (!myMember || !myMember.confirmedAt) {
      res.status(403).json({ error: 'You must be a confirmed attendee of this pod' });
      return;
    }

    // Other confirmed members (not the caller)
    const confirmedOthers = pod.members.filter(
      (m) => m.userId !== userId && m.confirmedAt
    );

    if (confirmedOthers.length === 0) {
      res.json({ users: [] });
      return;
    }

    const otherUserIds = confirmedOthers.map((m) => m.userId);

    // Exclude users who are already friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userAId: userId, userBId: { in: otherUserIds } },
          { userBId: userId, userAId: { in: otherUserIds } },
        ],
      },
    });
    const friendIds = new Set(
      friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId))
    );

    // Exclude users with pending friend requests (either direction)
    const pendingRequests = await prisma.friendRequest.findMany({
      where: {
        status: 'PENDING',
        OR: [
          { senderId: userId, receiverId: { in: otherUserIds } },
          { receiverId: userId, senderId: { in: otherUserIds } },
        ],
      },
    });
    const pendingIds = new Set(
      pendingRequests.map((r) => (r.senderId === userId ? r.receiverId : r.senderId))
    );

    // Exclude no-show reported users
    const noShows = await prisma.noShowReport.findMany({
      where: { podId: id, targetUserId: { in: otherUserIds } },
      select: { targetUserId: true },
      distinct: ['targetUserId'],
    });
    const noShowIds = new Set(noShows.map((n) => n.targetUserId));

    const users = confirmedOthers
      .filter((m) => !friendIds.has(m.userId) && !pendingIds.has(m.userId) && !noShowIds.has(m.userId))
      .map((m) => {
        let interestTags: string[] = [];
        if (m.user.interestTags) {
          try { interestTags = JSON.parse(m.user.interestTags as string); } catch { /* ignore */ }
        }
        return {
          id: m.user.id,
          name: m.user.name,
          avatarUrl: m.user.avatarUrl,
          classYear: m.user.classYear,
          major: m.user.major,
          interestTags,
        };
      });

    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
