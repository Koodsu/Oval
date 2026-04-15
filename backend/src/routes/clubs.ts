import { Router, Response } from 'express';
import prisma from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { MEMBER_USER_SELECT, parseMemberTags } from '../lib/joinExistingPod';
import { setTyping, getTypingUserIds } from '../lib/typingStore';

const router = Router();

const ROLE_ADMIN = 'ADMIN';
const ROLE_OFFICER = 'OFFICER';
const ROLE_MEMBER = 'MEMBER';

const RSVP_GOING = 'GOING';
const RSVP_MAYBE = 'MAYBE';
const RSVP_NOT_GOING = 'NOT_GOING';

const RSVP_STATUSES = new Set([RSVP_GOING, RSVP_MAYBE, RSVP_NOT_GOING]);

const STATUS_ATTENDED = 'ATTENDED';

const MAX_CLUB_MESSAGE_LENGTH = 2000;

/** Latest allowed instant for meetingTime (exclusive upper bound per product spec). */
const MEETING_TIME_MAX = new Date('2027-06-01T00:00:00.000Z');

/** Local calendar day bounds (Node process TZ; set TZ in production if needed). */
function startEndOfLocalToday(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function canCreateMeetings(role: string): boolean {
  return role === ROLE_ADMIN || role === ROLE_OFFICER;
}

async function requireClubMembership(
  clubId: string,
  userId: string
): Promise<
  | { ok: true }
  | { ok: false; status: 404 | 403; message: string }
> {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: {
      id: true,
      members: { where: { userId }, select: { userId: true } },
    },
  });
  if (!club) {
    return { ok: false, status: 404, message: 'Club not found' };
  }
  if (club.members.length === 0) {
    return { ok: false, status: 403, message: 'You must be a member to access club chat' };
  }
  return { ok: true };
}

// GET /clubs — public directory
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { category, search } = req.query;
  const now = new Date();

  try {
    const where: {
      isPublic: boolean;
      category?: string;
      name?: { contains: string; mode: 'insensitive' };
    } = { isPublic: true };

    if (category && typeof category === 'string' && category.trim()) {
      where.category = category.trim();
    }
    if (search && typeof search === 'string' && search.trim()) {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }

    const clubs = await prisma.club.findMany({
      where,
      include: {
        _count: {
          select: {
            members: true,
            meetings: { where: { meetingTime: { gt: now } } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const clubIds = clubs.map((c) => c.id);
    const myMemberships =
      clubIds.length === 0
        ? []
        : await prisma.clubMember.findMany({
            where: { userId, clubId: { in: clubIds } },
            select: { clubId: true },
          });
    const memberSet = new Set(myMemberships.map((m) => m.clubId));

    res.json(
      clubs.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        category: c.category,
        emoji: c.emoji,
        isVerified: c.isVerified,
        isPublic: c.isPublic,
        university: c.university,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        memberCount: c._count.members,
        upcomingMeetingCount: c._count.meetings,
        isMember: memberSet.has(c.id),
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /clubs/my
router.get('/my', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const now = new Date();

  try {
    const rows = await prisma.clubMember.findMany({
      where: { userId },
      include: {
        club: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const clubIds = rows.map((r) => r.clubId);
    const upcomingMeetings =
      clubIds.length === 0
        ? []
        : await prisma.clubMeeting.findMany({
            where: { clubId: { in: clubIds }, meetingTime: { gt: now } },
            orderBy: { meetingTime: 'asc' },
          });

    const nextByClub = new Map<string, (typeof upcomingMeetings)[0]>();
    for (const m of upcomingMeetings) {
      if (!nextByClub.has(m.clubId)) nextByClub.set(m.clubId, m);
    }

    res.json(
      rows.map((r) => ({
        membershipId: r.id,
        role: r.role,
        joinedAt: r.joinedAt,
        club: {
          id: r.club.id,
          name: r.club.name,
          description: r.club.description,
          category: r.club.category,
          emoji: r.club.emoji,
          isVerified: r.club.isVerified,
          isPublic: r.club.isPublic,
          university: r.club.university,
          createdAt: r.club.createdAt,
          updatedAt: r.club.updatedAt,
          memberCount: r.club._count.members,
        },
        nextMeeting: nextByClub.get(r.clubId) ?? null,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /clubs/today
router.get('/today', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { start, end } = startEndOfLocalToday();

  try {
    const meetings = await prisma.clubMeeting.findMany({
      where: {
        meetingTime: { gte: start, lte: end },
        OR: [
          { isPublic: true },
          {
            club: {
              members: { some: { userId } },
            },
          },
        ],
      },
      include: {
        club: { select: { id: true, name: true, emoji: true } },
        _count: { select: { attendees: true } },
      },
      orderBy: { meetingTime: 'asc' },
    });

    res.json(
      meetings.map((m) => ({
        id: m.id,
        title: m.title,
        location: m.location,
        meetingTime: m.meetingTime,
        isPublic: m.isPublic,
        clubId: m.club.id,
        clubName: m.club.name,
        clubEmoji: m.club.emoji,
        attendeeCount: m._count.attendees,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs — create club
router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const body = req.body ?? {};
  const { name, description, category, emoji, isPublic } = body;

  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ error: 'description is required' });
    return;
  }
  if (typeof category !== 'string' || !category.trim()) {
    res.status(400).json({ error: 'category is required' });
    return;
  }
  if (typeof emoji !== 'string' || !emoji.trim()) {
    res.status(400).json({ error: 'emoji is required' });
    return;
  }
  let publicFlag = true;
  if (isPublic !== undefined) {
    if (typeof isPublic !== 'boolean') {
      res.status(400).json({ error: 'isPublic must be a boolean' });
      return;
    }
    publicFlag = isPublic;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const club = await tx.club.create({
        data: {
          name: name.trim(),
          description: description.trim(),
          category: category.trim(),
          emoji: emoji.trim(),
          isPublic: publicFlag,
          createdById: userId,
        },
      });
      await tx.clubMember.create({
        data: { clubId: club.id, userId, role: ROLE_ADMIN },
      });
      return club;
    });

    const full = await prisma.club.findUnique({
      where: { id: result.id },
      include: {
        members: {
          include: { user: { select: MEMBER_USER_SELECT } },
        },
        meetings: {
          where: { meetingTime: { gt: new Date() } },
          orderBy: { meetingTime: 'asc' },
        },
        announcements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });

    if (!full) {
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    res.status(201).json({
      ...full,
      members: full.members.map(parseMemberTags),
      isMember: true,
      myRole: ROLE_ADMIN,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/meetings/:meetingId/rsvp
router.post('/meetings/:meetingId/rsvp', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { meetingId } = req.params;
  const { status } = req.body ?? {};

  if (typeof status !== 'string' || !RSVP_STATUSES.has(status)) {
    res.status(400).json({ error: 'status must be GOING, MAYBE, or NOT_GOING' });
    return;
  }

  try {
    const meeting = await prisma.clubMeeting.findUnique({
      where: { id: meetingId },
      include: {
        club: {
          select: {
            id: true,
            members: { where: { userId }, select: { userId: true } },
          },
        },
      },
    });

    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }

    const isMember = meeting.club.members.length > 0;
    if (!meeting.isPublic && !isMember) {
      res.status(403).json({ error: 'You cannot RSVP to this meeting' });
      return;
    }

    const attendee = await prisma.clubMeetingAttendee.upsert({
      where: { meetingId_userId: { meetingId, userId } },
      create: { meetingId, userId, status },
      update: { status },
    });

    res.json(attendee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/meetings/:meetingId/attend — club members only; actual attendance (not RSVP)
router.post('/meetings/:meetingId/attend', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { meetingId } = req.params;

  try {
    const meeting = await prisma.clubMeeting.findUnique({
      where: { id: meetingId },
      include: {
        club: {
          select: {
            id: true,
            members: { where: { userId }, select: { userId: true } },
          },
        },
      },
    });

    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }

    if (meeting.club.members.length === 0) {
      res.status(403).json({ error: 'Only club members can mark attendance' });
      return;
    }

    await prisma.clubMeetingAttendee.upsert({
      where: { meetingId_userId: { meetingId, userId } },
      create: { meetingId, userId, status: STATUS_ATTENDED },
      update: { status: STATUS_ATTENDED },
    });

    const attendedCount = await prisma.clubMeetingAttendee.count({
      where: { meetingId, status: STATUS_ATTENDED },
    });

    res.json({ attendedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /clubs/:id/announcements
router.get('/:id/announcements', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const pageRaw = typeof req.query.page === 'string' ? req.query.page : '1';
  const limitRaw = typeof req.query.limit === 'string' ? req.query.limit : '20';
  const page = Math.max(1, parseInt(pageRaw, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 20));
  const skip = (page - 1) * limit;

  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, isPublic: true, members: { where: { userId }, select: { userId: true } } },
    });

    if (!club) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }
    if (!club.isPublic && club.members.length === 0) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }

    const [total, items] = await Promise.all([
      prisma.clubAnnouncement.count({ where: { clubId } }),
      prisma.clubAnnouncement.findMany({
        where: { clubId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      }),
    ]);

    res.json({ items, page, limit, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/announcements
router.post('/:id/announcements', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const { content } = req.body ?? {};

  if (typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });

    if (!membership) {
      res.status(403).json({ error: 'You must be a member to post announcements' });
      return;
    }

    const announcement = await prisma.clubAnnouncement.create({
      data: { clubId, userId, content: content.trim() },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    res.status(201).json(announcement);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /clubs/:id/meetings/:meetingId/attendance — OFFICER and ADMIN only
router.get(
  '/:id/meetings/:meetingId/attendance',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId, meetingId } = req.params;

    try {
      const membership = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId } },
      });

      if (!membership || !canCreateMeetings(membership.role)) {
        res.status(403).json({ error: 'Only officers and admins can view attendance' });
        return;
      }

      const meeting = await prisma.clubMeeting.findFirst({
        where: { id: meetingId, clubId },
      });

      if (!meeting) {
        res.status(404).json({ error: 'Meeting not found' });
        return;
      }

      const attendees = await prisma.clubMeetingAttendee.findMany({
        where: { meetingId, status: STATUS_ATTENDED },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });

      res.json({
        attendees,
        attendedCount: attendees.length,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /clubs/:id/meetings
router.get('/:id/meetings', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const now = new Date();

  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, isPublic: true, members: { where: { userId }, select: { userId: true } } },
    });

    if (!club) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }
    const isMember = club.members.length > 0;
    if (!club.isPublic && !isMember) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }

    const meetings = await prisma.clubMeeting.findMany({
      where: {
        clubId,
        meetingTime: { gt: now },
        ...(isMember ? {} : { isPublic: true }),
      },
      orderBy: { meetingTime: 'asc' },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const meetingIds = meetings.map((m) => m.id);
    const rsvpBuckets = new Map<string, { going: number; maybe: number; notGoing: number }>();
    const myRsvpByMeeting = new Map<string, string>();

    if (meetingIds.length > 0) {
      const [groups, mine] = await Promise.all([
        prisma.clubMeetingAttendee.groupBy({
          by: ['meetingId', 'status'],
          where: {
            meetingId: { in: meetingIds },
            status: { in: [RSVP_GOING, RSVP_MAYBE, RSVP_NOT_GOING] },
          },
          _count: { _all: true },
        }),
        prisma.clubMeetingAttendee.findMany({
          where: { meetingId: { in: meetingIds }, userId },
          select: { meetingId: true, status: true },
        }),
      ]);

      for (const id of meetingIds) {
        rsvpBuckets.set(id, { going: 0, maybe: 0, notGoing: 0 });
      }
      for (const row of groups) {
        const b = rsvpBuckets.get(row.meetingId);
        if (!b) continue;
        const c = row._count._all;
        if (row.status === RSVP_GOING) b.going += c;
        else if (row.status === RSVP_MAYBE) b.maybe += c;
        else if (row.status === RSVP_NOT_GOING) b.notGoing += c;
      }
      for (const row of mine) {
        if (RSVP_STATUSES.has(row.status)) {
          myRsvpByMeeting.set(row.meetingId, row.status);
        }
      }
    }

    res.json(
      meetings.map((m) => {
        const rsvpCounts = rsvpBuckets.get(m.id) ?? { going: 0, maybe: 0, notGoing: 0 };
        const myRsvp = myRsvpByMeeting.get(m.id) ?? null;
        return {
          ...m,
          rsvpCounts,
          myRsvp,
          /** People who RSVP'd Going (primary display count). */
          attendeeCount: rsvpCounts.going,
        };
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/meetings
router.post('/:id/meetings', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const body = req.body ?? {};
  const { title, location, meetingTime, description, isPublic } = body;

  if (typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  if (typeof location !== 'string' || !location.trim()) {
    res.status(400).json({ error: 'location is required' });
    return;
  }
  if (!meetingTime || typeof meetingTime !== 'string') {
    res.status(400).json({ error: 'meetingTime is required' });
    return;
  }

  const when = new Date(meetingTime);
  if (Number.isNaN(when.getTime())) {
    res.status(400).json({ error: 'meetingTime must be a valid ISO date string' });
    return;
  }

  const now = new Date();
  if (when <= now) {
    res.status(400).json({ error: 'meetingTime must be in the future' });
    return;
  }
  if (when >= MEETING_TIME_MAX) {
    res.status(400).json({ error: 'meetingTime must be before June 1, 2027' });
    return;
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    res.status(400).json({ error: 'description must be a string' });
    return;
  }

  let publicFlag = true;
  if (isPublic !== undefined) {
    if (typeof isPublic !== 'boolean') {
      res.status(400).json({ error: 'isPublic must be a boolean' });
      return;
    }
    publicFlag = isPublic;
  }

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });

    if (!membership || !canCreateMeetings(membership.role)) {
      res.status(403).json({ error: 'Only officers and admins can create meetings' });
      return;
    }

    const meeting = await prisma.clubMeeting.create({
      data: {
        clubId,
        title: title.trim(),
        location: location.trim(),
        meetingTime: when,
        description:
          typeof description === 'string' && description.trim() ? description.trim() : null,
        isPublic: publicFlag,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    res.status(201).json({
      ...meeting,
      rsvpCounts: { going: 0, maybe: 0, notGoing: 0 },
      myRsvp: null,
      attendeeCount: 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /clubs/:id/messages — members only
router.get('/:id/messages', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;

  try {
    const gate = await requireClubMembership(clubId, userId);
    if (!gate.ok) {
      res.status(gate.status).json({ error: gate.message });
      return;
    }

    const messages = await prisma.clubMessage.findMany({
      where: { clubId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const typingUserIds = getTypingUserIds('club', clubId, userId);
    res.json({ messages, typingUserIds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/messages — members only
router.post('/:id/messages', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const { content } = req.body as { content?: string };

  const trimmed = typeof content === 'string' ? content.trim() : '';
  if (!trimmed) {
    res.status(400).json({ error: 'content is required' });
    return;
  }
  if (trimmed.length > MAX_CLUB_MESSAGE_LENGTH) {
    res.status(400).json({ error: `Message cannot exceed ${MAX_CLUB_MESSAGE_LENGTH} characters` });
    return;
  }

  try {
    const gate = await requireClubMembership(clubId, userId);
    if (!gate.ok) {
      res.status(gate.status).json({ error: gate.message });
      return;
    }

    const message = await prisma.clubMessage.create({
      data: { clubId, userId, content: trimmed },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/typing — members only
router.post('/:id/typing', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;

  try {
    const gate = await requireClubMembership(clubId, userId);
    if (!gate.ok) {
      res.status(gate.status).json({ error: gate.message });
      return;
    }

    setTyping('club', clubId, userId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/members/:memberUserId/promote — ADMIN only
router.post(
  '/:id/members/:memberUserId/promote',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId, memberUserId } = req.params;

    if (memberUserId === userId) {
      res.status(400).json({ error: 'Cannot promote yourself' });
      return;
    }

    try {
      const actor = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId } },
      });
      if (!actor || actor.role !== ROLE_ADMIN) {
        res.status(403).json({ error: 'Only admins can promote members' });
        return;
      }

      const target = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId: memberUserId } },
        include: { user: { select: MEMBER_USER_SELECT } },
      });

      if (!target) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }
      if (target.role === ROLE_ADMIN) {
        res.status(400).json({ error: 'Cannot change an admin role' });
        return;
      }
      if (target.role === ROLE_OFFICER) {
        res.json(parseMemberTags(target));
        return;
      }

      const updated = await prisma.clubMember.update({
        where: { id: target.id },
        data: { role: ROLE_OFFICER },
        include: { user: { select: MEMBER_USER_SELECT } },
      });

      res.json(parseMemberTags(updated));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /clubs/:id/join
router.post('/:id/join', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;

  try {
    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }

    const existing = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (existing) {
      res.status(400).json({ error: 'Already a member of this club' });
      return;
    }

    await prisma.clubMember.create({
      data: { clubId, userId, role: ROLE_MEMBER },
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /clubs/:id/leave
router.delete('/:id/leave', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });

    if (!membership) {
      res.status(400).json({ error: 'You are not a member of this club' });
      return;
    }

    if (membership.role === ROLE_ADMIN) {
      const adminCount = await prisma.clubMember.count({
        where: { clubId, role: ROLE_ADMIN },
      });
      if (adminCount === 1) {
        res.status(400).json({
          error: 'You are the only admin. Delete the club instead of leaving.',
        });
        return;
      }
    }

    await prisma.clubMember.delete({ where: { id: membership.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /clubs/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;

  try {
    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }

    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });

    if (!membership || membership.role !== ROLE_ADMIN) {
      res.status(403).json({ error: 'Only admins can delete the club' });
      return;
    }

    await prisma.club.delete({ where: { id: clubId } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /clubs/:id — detail (register last among /:id routes)
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const now = new Date();

  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: {
        members: {
          include: { user: { select: MEMBER_USER_SELECT } },
          orderBy: { joinedAt: 'asc' },
        },
        meetings: {
          where: { meetingTime: { gt: now } },
          orderBy: { meetingTime: 'asc' },
        },
        announcements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });

    if (!club) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }

    const myMembership = club.members.find((m) => m.userId === userId);
    if (!club.isPublic && !myMembership) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }

    res.json({
      ...club,
      members: club.members.map(parseMemberTags),
      isMember: !!myMembership,
      myRole: myMembership?.role ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
