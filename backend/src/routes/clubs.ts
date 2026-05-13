import { Router, Response } from 'express';
import multer from 'multer';
import prisma from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { MEMBER_USER_SELECT, parseMemberTags } from '../lib/joinExistingPod';
import { setTyping, getTypingUserIds } from '../lib/typingStore';
import { NotificationService } from '../lib/NotificationService';
import { supabaseStorage } from '../lib/supabaseStorage';

// ── Club avatar upload setup ──────────────────────────────────────────────────

const CLUB_AVATAR_BUCKET = 'club-avatars';

const clubAvatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

// ── OSU Campus bounds helpers ──────────────────────────────────────────────────

const OSU_CAMPUS_POLYGON = [
  { lat: 40.0015, lng: -83.0190 },
  { lat: 40.0010, lng: -83.0340 },
  { lat: 40.0020, lng: -83.0480 },
  { lat: 40.0010, lng: -83.0580 },
  { lat: 39.9990, lng: -83.0650 },
  { lat: 39.9960, lng: -83.0700 },
  { lat: 39.9930, lng: -83.0680 },
  { lat: 39.9900, lng: -83.0620 },
  { lat: 39.9878, lng: -83.0540 },
  { lat: 39.9880, lng: -83.0430 },
  { lat: 39.9890, lng: -83.0330 },
  { lat: 39.9900, lng: -83.0240 },
  { lat: 39.9920, lng: -83.0190 },
  { lat: 39.9950, lng: -83.0190 },
  { lat: 40.0015, lng: -83.0190 },
];

function isInsideOsuCampus(lat: number, lng: number): boolean {
  let inside = false;
  const n = OSU_CAMPUS_POLYGON.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = OSU_CAMPUS_POLYGON[i].lng;
    const yi = OSU_CAMPUS_POLYGON[i].lat;
    const xj = OSU_CAMPUS_POLYGON[j].lng;
    const yj = OSU_CAMPUS_POLYGON[j].lat;
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function generateAttendanceCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── Role constants ──────────────────────────────────────────────────────────────

const ROLE_OWNER = 'OWNER';
const ROLE_ADMIN = 'ADMIN';
const ROLE_OFFICER = 'OFFICER';
const ROLE_MEMBER = 'MEMBER';
const VISIBILITY_PUBLIC = 'PUBLIC';
const VISIBILITY_MEMBERS = 'MEMBERS';
const VISIBILITY_OFFICERS = 'OFFICERS';

const RSVP_GOING = 'GOING';
const RSVP_MAYBE = 'MAYBE';
const RSVP_NOT_GOING = 'NOT_GOING';

const RSVP_STATUSES = new Set([RSVP_GOING, RSVP_MAYBE, RSVP_NOT_GOING]);
const CLUB_VISIBILITIES = new Set([VISIBILITY_PUBLIC, VISIBILITY_MEMBERS, VISIBILITY_OFFICERS]);

const STATUS_ATTENDED = 'ATTENDED';

const MAX_CLUB_MESSAGE_LENGTH = 500;
const MAX_ROLE_NAME_LENGTH = 40;

const PERMISSION_MANAGE_MEMBERS = 'MANAGE_MEMBERS';
const PERMISSION_MANAGE_ROLES = 'MANAGE_ROLES';
const PERMISSION_CREATE_MEETINGS = 'CREATE_MEETINGS';
const PERMISSION_POST_ANNOUNCEMENTS = 'POST_ANNOUNCEMENTS';
const PERMISSION_DELETE_MESSAGES = 'DELETE_MESSAGES';
const PERMISSION_MANAGE_CLUB = 'MANAGE_CLUB';
const PERMISSION_TRANSFER_OWNERSHIP = 'TRANSFER_OWNERSHIP';

const CLUB_PERMISSIONS = new Set([
  PERMISSION_MANAGE_MEMBERS,
  PERMISSION_MANAGE_ROLES,
  PERMISSION_CREATE_MEETINGS,
  PERMISSION_POST_ANNOUNCEMENTS,
  PERMISSION_DELETE_MESSAGES,
  PERMISSION_MANAGE_CLUB,
]);

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

function parseStringList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function stringifyStringList(values: string[]): string {
  return JSON.stringify(Array.from(new Set(values)));
}

function normalizePermissionList(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const permissions = raw.map((item) => (typeof item === 'string' ? item.trim().toUpperCase() : ''));
  if (permissions.some((permission) => !CLUB_PERMISSIONS.has(permission))) return null;
  return Array.from(new Set(permissions));
}

function roleRank(role: string | null | undefined): number {
  if (role === ROLE_OWNER) return 4;
  if (role === ROLE_ADMIN) return 3;
  if (role === ROLE_OFFICER) return 2;
  if (role === ROLE_MEMBER) return 1;
  return 0;
}

function basePermissions(role: string): Set<string> {
  if (role === ROLE_OWNER) {
    return new Set([...CLUB_PERMISSIONS, PERMISSION_TRANSFER_OWNERSHIP]);
  }
  if (role === ROLE_ADMIN) {
    return new Set(CLUB_PERMISSIONS);
  }
  if (role === ROLE_OFFICER) {
    return new Set([PERMISSION_POST_ANNOUNCEMENTS, PERMISSION_DELETE_MESSAGES]);
  }
  return new Set();
}

function permissionsForMembership(membership: { role: string; club?: { officerPermissions?: string | null } }): Set<string> {
  const permissions = basePermissions(membership.role);
  if (membership.role === ROLE_OFFICER) {
    for (const permission of parseStringList(membership.club?.officerPermissions)) {
      if (CLUB_PERMISSIONS.has(permission)) permissions.add(permission);
    }
  }
  return permissions;
}

function hasClubPermission(
  membership: { role: string; club?: { officerPermissions?: string | null } } | null | undefined,
  permission: string
): boolean {
  if (!membership) return false;
  return permissionsForMembership(membership).has(permission);
}

function canManageTarget(actorRole: string, targetRole: string): boolean {
  return roleRank(targetRole) < roleRank(actorRole);
}

function canAssignPrimaryRole(actorRole: string, desiredRole: string): boolean {
  if (desiredRole === ROLE_OWNER) return false;
  if (actorRole === ROLE_OWNER) return [ROLE_ADMIN, ROLE_OFFICER, ROLE_MEMBER].includes(desiredRole);
  if (actorRole === ROLE_ADMIN) return [ROLE_OFFICER, ROLE_MEMBER].includes(desiredRole);
  return false;
}

function canCreateMeetings(membership: { role: string; club?: { officerPermissions?: string | null } } | string | null | undefined): boolean {
  if (typeof membership === 'string') {
    return membership === ROLE_OWNER || membership === ROLE_ADMIN;
  }
  return hasClubPermission(membership, PERMISSION_CREATE_MEETINGS);
}

function canPostAnnouncements(membership: { role: string; club?: { officerPermissions?: string | null } } | string | null | undefined): boolean {
  if (typeof membership === 'string') {
    return membership === ROLE_OWNER || membership === ROLE_ADMIN || membership === ROLE_OFFICER;
  }
  return hasClubPermission(membership, PERMISSION_POST_ANNOUNCEMENTS);
}

function canDeleteMessages(membership: { role: string; club?: { officerPermissions?: string | null } } | null | undefined): boolean {
  return hasClubPermission(membership, PERMISSION_DELETE_MESSAGES);
}

function canAccessTargetRoles(
  targetRoleIds: string | null | undefined,
  myRoleIds: Set<string>,
  membership: { role: string; club?: { officerPermissions?: string | null } } | null | undefined
): boolean {
  const targets = parseStringList(targetRoleIds);
  if (targets.length === 0) return true;
  if (membership && roleRank(membership.role) >= roleRank(ROLE_OFFICER)) return true;
  return targets.some((roleId) => myRoleIds.has(roleId));
}

async function parseAndValidateTargetRoleIds(clubId: string, raw: unknown): Promise<string[] | null> {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== 'string')) return null;
  const ids = Array.from(new Set(raw.map((item) => item.trim()).filter(Boolean)));
  if (ids.length === 0) return [];
  const count = await prisma.clubRole.count({ where: { clubId, id: { in: ids } } });
  return count === ids.length ? ids : null;
}

function parseVisibility(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toUpperCase();
  return CLUB_VISIBILITIES.has(normalized) ? normalized : null;
}

function canAccessVisibility(
  visibility: string,
  isMember: boolean,
  role: string | null | undefined
): boolean {
  if (visibility === VISIBILITY_PUBLIC) return true;
  if (visibility === VISIBILITY_MEMBERS) return isMember;
  if (visibility === VISIBILITY_OFFICERS) return roleRank(role) >= roleRank(ROLE_OFFICER);
  return false;
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
    return { ok: false, status: 403, message: 'You must be a member to access club messages' };
  }
  return { ok: true };
}

type AdminRoleChangeResult =
  | { ok: true; member: ReturnType<typeof parseMemberTags> }
  | { ok: false; status: number; error: string };

/** ADMIN-only: MEMBER→OFFICER or OFFICER→MEMBER. Idempotent when already at desired role. */
async function applyAdminMemberRoleChange(
  clubId: string,
  actorUserId: string,
  memberUserId: string,
  desiredRole: typeof ROLE_ADMIN | typeof ROLE_OFFICER | typeof ROLE_MEMBER
): Promise<AdminRoleChangeResult> {
  if (memberUserId === actorUserId) {
    return { ok: false, status: 400, error: 'Cannot change yourself' };
  }

  const actor = await prisma.clubMember.findUnique({
    where: { clubId_userId: { clubId, userId: actorUserId } },
  });
  if (!actor || !hasClubPermission(actor, PERMISSION_MANAGE_MEMBERS)) {
    return { ok: false, status: 403, error: 'You do not have permission to change member roles' };
  }
  if (!canAssignPrimaryRole(actor.role, desiredRole)) {
    return { ok: false, status: 403, error: 'You cannot assign that role' };
  }

  const target = await prisma.clubMember.findUnique({
    where: { clubId_userId: { clubId, userId: memberUserId } },
    include: { user: { select: MEMBER_USER_SELECT } },
  });

  if (!target) {
    return { ok: false, status: 404, error: 'Member not found' };
  }
  if (!canManageTarget(actor.role, target.role)) {
    return { ok: false, status: 400, error: 'You can only manage members below your role' };
  }

  if (target.role === desiredRole) {
    return { ok: true, member: parseMemberTags(target) };
  }

  const updated = await prisma.clubMember.update({
    where: { id: target.id },
    data: { role: desiredRole },
    include: { user: { select: MEMBER_USER_SELECT } },
  });
  return { ok: true, member: parseMemberTags(updated) };
}

// GET /clubs — public directory
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { category, search } = req.query;
  const now = new Date();

  try {
    const where: {
      isPublic: boolean;
      OR?: Array<{ isPrivate: boolean } | { members: { some: { userId: string } } }>;
      category?: string;
      name?: { contains: string; mode: 'insensitive' };
    } = {
      isPublic: true,
      OR: [{ isPrivate: false }, { members: { some: { userId } } }],
    };

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
        isPrivate: c.isPrivate,
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
      },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            emoji: true,
            members: {
              where: { userId },
              select: { role: true, customRoles: { select: { roleId: true } } },
            },
          },
        },
        _count: { select: { attendees: true } },
      },
      orderBy: { meetingTime: 'asc' },
    });

    res.json(
      meetings
        .filter((m) => {
          const membership = m.club.members[0] ?? null;
          const roleIds = new Set(membership?.customRoles.map((role) => role.roleId) ?? []);
          return (
            canAccessVisibility(m.visibility, m.club.members.length > 0, membership?.role) &&
            canAccessTargetRoles(m.targetRoleIds, roleIds, membership)
          );
        })
        .map((m) => ({
        id: m.id,
        title: m.title,
        location: m.location,
        meetingTime: m.meetingTime,
        isPublic: m.visibility === VISIBILITY_PUBLIC,
        visibility: m.visibility,
        targetRoleIds: parseStringList(m.targetRoleIds),
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
        data: { clubId: club.id, userId, role: ROLE_OWNER },
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
      myRole: ROLE_OWNER,
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
            members: {
              where: { userId },
              select: { userId: true, role: true, customRoles: { select: { roleId: true } } },
            },
          },
        },
      },
    });

    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }

    const membership = meeting.club.members[0];
    const isMember = !!membership;
    const myRoleIds = new Set(membership?.customRoles.map((role) => role.roleId) ?? []);
    if (
      !canAccessVisibility(meeting.visibility, isMember, membership?.role) ||
      !canAccessTargetRoles(meeting.targetRoleIds, myRoleIds, membership)
    ) {
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
      select: { id: true, isPublic: true, isPrivate: true, members: { where: { userId }, select: { userId: true } } },
    });

    if (!club) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }
    if ((!club.isPublic || club.isPrivate) && club.members.length === 0) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }

    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      select: { role: true, customRoles: { select: { roleId: true } } },
    });
    const isMember = !!membership;
    const myRoleIds = new Set(membership?.customRoles.map((role) => role.roleId) ?? []);

    const allItems = await prisma.clubAnnouncement.findMany({
      where: { clubId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const visibleItems = allItems.filter((item) =>
      canAccessVisibility(item.visibility, isMember, membership?.role) &&
      canAccessTargetRoles(item.targetRoleIds, myRoleIds, membership)
    );

    res.json({
      items: visibleItems.slice(skip, skip + limit).map((item) => ({
        ...item,
        targetRoleIds: parseStringList(item.targetRoleIds),
      })),
      page,
      limit,
      total: visibleItems.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/announcements
router.post('/:id/announcements', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const { content, visibility, targetRoleIds } = req.body ?? {};

  if (typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const parsedVisibility = visibility === undefined ? VISIBILITY_PUBLIC : parseVisibility(visibility);
  if (!parsedVisibility) {
    res.status(400).json({ error: 'visibility must be PUBLIC, MEMBERS, or OFFICERS' });
    return;
  }

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      include: { club: { select: { officerPermissions: true } } },
    });

    if (!membership) {
      res.status(403).json({ error: 'You must be a member to post announcements' });
      return;
    }
    if (!canPostAnnouncements(membership)) {
      res.status(403).json({ error: 'Only officers and admins can post announcements' });
      return;
    }

    const parsedTargetRoleIds = await parseAndValidateTargetRoleIds(clubId, targetRoleIds);
    if (!parsedTargetRoleIds) {
      res.status(400).json({ error: 'targetRoleIds must be club role ids' });
      return;
    }

    const announcement = await prisma.clubAnnouncement.create({
      data: {
        clubId,
        userId,
        content: content.trim(),
        visibility: parsedVisibility,
        targetRoleIds: parsedTargetRoleIds.length ? stringifyStringList(parsedTargetRoleIds) : null,
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    NotificationService.notifyClubAnnouncementCreated(announcement.id, userId).catch(() => {});

    res.status(201).json({
      ...announcement,
      targetRoleIds: parseStringList(announcement.targetRoleIds),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/meetings/:meetingId/attendance/open — OFFICER/ADMIN only
router.post(
  '/:id/meetings/:meetingId/attendance/open',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId, meetingId } = req.params;

    try {
      const membership = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId } },
        include: { club: { select: { officerPermissions: true } } },
      });
      if (!membership || !canCreateMeetings(membership)) {
        res.status(403).json({ error: 'Only officers and admins can open attendance' });
        return;
      }

      const meeting = await prisma.clubMeeting.findFirst({ where: { id: meetingId, clubId } });
      if (!meeting) {
        res.status(404).json({ error: 'Meeting not found' });
        return;
      }

      const code = generateAttendanceCode();
      await prisma.clubMeeting.update({
        where: { id: meetingId },
        data: { attendanceOpen: true, attendanceCode: code },
      });

      NotificationService.notifyClubAttendanceOpen(meetingId).catch(() => {});

      res.json({ attendanceCode: code });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /clubs/:id/meetings/:meetingId/attendance/close — OFFICER/ADMIN only
router.post(
  '/:id/meetings/:meetingId/attendance/close',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId, meetingId } = req.params;

    try {
      const membership = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId } },
        include: { club: { select: { officerPermissions: true } } },
      });
      if (!membership || !canCreateMeetings(membership)) {
        res.status(403).json({ error: 'Only officers and admins can close attendance' });
        return;
      }

      const meeting = await prisma.clubMeeting.findFirst({ where: { id: meetingId, clubId } });
      if (!meeting) {
        res.status(404).json({ error: 'Meeting not found' });
        return;
      }

      await prisma.clubMeeting.update({
        where: { id: meetingId },
        data: { attendanceOpen: false, attendanceCode: null },
      });

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /clubs/:id/meetings/:meetingId/attendance/checkin — any member
router.post(
  '/:id/meetings/:meetingId/attendance/checkin',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId, meetingId } = req.params;
    const { code } = req.body ?? {};

    if (typeof code !== 'string' || !code.trim()) {
      res.status(400).json({ error: 'code is required' });
      return;
    }

    try {
      const membership = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId } },
      });
      if (!membership) {
        res.status(403).json({ error: 'You must be a club member to check in' });
        return;
      }

      const meeting = await prisma.clubMeeting.findFirst({ where: { id: meetingId, clubId } });
      if (!meeting) {
        res.status(404).json({ error: 'Meeting not found' });
        return;
      }

      if (!meeting.attendanceOpen) {
        res.status(400).json({ error: 'Attendance is not currently open' });
        return;
      }
      if (!meeting.attendanceCode || code.trim().toUpperCase() !== meeting.attendanceCode) {
        res.status(400).json({ error: 'Invalid attendance code' });
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

      res.json({ ok: true, attendedCount });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

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
        include: { club: { select: { officerPermissions: true } } },
      });

      if (!membership || !canCreateMeetings(membership)) {
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
      select: {
        id: true,
        isPublic: true,
        isPrivate: true,
        members: {
          where: { userId },
          select: {
            userId: true,
            role: true,
            customRoles: { select: { roleId: true } },
            club: { select: { officerPermissions: true } },
          },
        },
      },
    });

    if (!club) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }
    const isMember = club.members.length > 0;
    const myMembership = club.members[0] ?? null;
    const myRole = myMembership?.role ?? null;
    const myRoleIds = new Set(myMembership?.customRoles.map((role) => role.roleId) ?? []);
    if ((!club.isPublic || club.isPrivate) && !isMember) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }

    const meetings = await prisma.clubMeeting.findMany({
      where: {
        clubId,
        meetingTime: { gt: now },
      },
      orderBy: { meetingTime: 'asc' },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const meetingIds = meetings.map((m) => m.id);
    const rsvpBuckets = new Map<string, { going: number; maybe: number; notGoing: number }>();
    const myRsvpByMeeting = new Map<string, string>();
    const attendedCountByMeeting = new Map<string, number>();

    if (meetingIds.length > 0) {
      const [groups, mine, attendedGroups] = await Promise.all([
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
        prisma.clubMeetingAttendee.groupBy({
          by: ['meetingId'],
          where: {
            meetingId: { in: meetingIds },
            status: STATUS_ATTENDED,
          },
          _count: { _all: true },
        }),
      ]);

      for (const id of meetingIds) {
        rsvpBuckets.set(id, { going: 0, maybe: 0, notGoing: 0 });
        attendedCountByMeeting.set(id, 0);
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
      for (const row of attendedGroups) {
        attendedCountByMeeting.set(row.meetingId, row._count._all);
      }
    }

    const canSeeCode = !!myMembership && canCreateMeetings(myMembership);
    const visibleMeetings = meetings.filter((meeting) =>
      canAccessVisibility(meeting.visibility, isMember, myRole) &&
      canAccessTargetRoles(meeting.targetRoleIds, myRoleIds, myMembership)
    );

    res.json(
      visibleMeetings.map((m) => {
        const rsvpCounts = rsvpBuckets.get(m.id) ?? { going: 0, maybe: 0, notGoing: 0 };
        const myRsvp = myRsvpByMeeting.get(m.id) ?? null;
        return {
          ...m,
          isPublic: m.visibility === VISIBILITY_PUBLIC,
          targetRoleIds: parseStringList(m.targetRoleIds),
          attendanceCode: canSeeCode ? m.attendanceCode : null,
          rsvpCounts,
          myRsvp,
          attendeeCount: attendedCountByMeeting.get(m.id) ?? 0,
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
  const { title, location, meetingTime, description, visibility, latitude, longitude, targetRoleIds } = body;

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

  const parsedVisibility = visibility === undefined ? VISIBILITY_PUBLIC : parseVisibility(visibility);
  if (!parsedVisibility) {
    res.status(400).json({ error: 'visibility must be PUBLIC, MEMBERS, or OFFICERS' });
    return;
  }

  let lat: number | null = null;
  let lng: number | null = null;
  if (latitude !== undefined || longitude !== undefined) {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      res.status(400).json({ error: 'latitude and longitude must be numbers' });
      return;
    }
    if (!isInsideOsuCampus(latitude, longitude)) {
      res.status(400).json({ error: 'Meeting location must be on OSU campus' });
      return;
    }
    lat = latitude;
    lng = longitude;
  }

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      include: { club: { select: { officerPermissions: true } } },
    });

    if (!membership || !canCreateMeetings(membership)) {
      res.status(403).json({ error: 'Only officers and admins can create meetings' });
      return;
    }

    const parsedTargetRoleIds = await parseAndValidateTargetRoleIds(clubId, targetRoleIds);
    if (!parsedTargetRoleIds) {
      res.status(400).json({ error: 'targetRoleIds must be club role ids' });
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
        isPublic: parsedVisibility === VISIBILITY_PUBLIC,
        visibility: parsedVisibility,
        targetRoleIds: parsedTargetRoleIds.length ? stringifyStringList(parsedTargetRoleIds) : null,
        createdById: userId,
        latitude: lat,
        longitude: lng,
      },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    NotificationService.notifyClubMeetingCreated(meeting.id, userId).catch(() => {});

    res.status(201).json({
      ...meeting,
      isPublic: meeting.visibility === VISIBILITY_PUBLIC,
      targetRoleIds: parseStringList(meeting.targetRoleIds),
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

// DELETE /clubs/:id/messages/:messageId — DELETE_MESSAGES permission
router.delete('/:id/messages/:messageId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, messageId } = req.params;

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      include: { club: { select: { officerPermissions: true } } },
    });
    if (!membership || !canDeleteMessages(membership)) {
      res.status(403).json({ error: 'You do not have permission to delete messages' });
      return;
    }

    const message = await prisma.clubMessage.findFirst({ where: { id: messageId, clubId } });
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    await prisma.clubMessage.delete({ where: { id: messageId } });
    res.json({ ok: true });
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

// GET /clubs/:id/officer-messages — OFFICER/ADMIN only
router.get('/:id/officer-messages', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership) {
      res.status(403).json({ error: 'You must be a club member' });
      return;
    }
    if (roleRank(membership.role) < roleRank(ROLE_OFFICER)) {
      res.status(403).json({ error: 'This channel is for officers and admins only' });
      return;
    }

    const messages = await prisma.clubOfficerMessage.findMany({
      where: { clubId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const typingUserIds = getTypingUserIds('club-officer', clubId, userId);
    res.json({ messages, typingUserIds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/officer-messages — OFFICER/ADMIN only
router.post('/:id/officer-messages', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const { content } = req.body ?? {};

  if (typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'content is required' });
    return;
  }
  if (content.trim().length > MAX_CLUB_MESSAGE_LENGTH) {
    res.status(400).json({ error: `Message too long (max ${MAX_CLUB_MESSAGE_LENGTH} characters)` });
    return;
  }

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership) {
      res.status(403).json({ error: 'You must be a club member' });
      return;
    }
    if (roleRank(membership.role) < roleRank(ROLE_OFFICER)) {
      res.status(403).json({ error: 'This channel is for officers and admins only' });
      return;
    }

    const message = await prisma.clubOfficerMessage.create({
      data: { clubId, userId, content: content.trim() },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /clubs/:id/officer-messages/:messageId — DELETE_MESSAGES permission
router.delete('/:id/officer-messages/:messageId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, messageId } = req.params;

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      include: { club: { select: { officerPermissions: true } } },
    });
    if (!membership || !canDeleteMessages(membership)) {
      res.status(403).json({ error: 'You do not have permission to delete messages' });
      return;
    }

    const message = await prisma.clubOfficerMessage.findFirst({ where: { id: messageId, clubId } });
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    await prisma.clubOfficerMessage.delete({ where: { id: messageId } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/officer-typing — OFFICER/ADMIN only
router.post('/:id/officer-typing', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership || roleRank(membership.role) < roleRank(ROLE_OFFICER)) {
      res.status(403).json({ error: 'This channel is for officers and admins only' });
      return;
    }

    setTyping('club-officer', clubId, userId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /clubs/:id/roles — members can list ping roles
router.get('/:id/roles', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership) {
      res.status(403).json({ error: 'You must be a club member' });
      return;
    }

    const roles = await prisma.clubRole.findMany({
      where: { clubId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { assignments: true } } },
    });

    res.json(
      roles.map((role) => ({
        ...role,
        permissions: parseStringList(role.permissions),
        memberCount: role._count.assignments,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/roles — create a named ping role
router.post('/:id/roles', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const { name } = req.body ?? {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  if (!trimmedName) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (trimmedName.length > MAX_ROLE_NAME_LENGTH) {
    res.status(400).json({ error: `name cannot exceed ${MAX_ROLE_NAME_LENGTH} characters` });
    return;
  }

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      include: { club: { select: { officerPermissions: true } } },
    });
    if (!membership || !hasClubPermission(membership, PERMISSION_MANAGE_ROLES)) {
      res.status(403).json({ error: 'You do not have permission to manage roles' });
      return;
    }

    const role = await prisma.clubRole.create({
      data: { clubId, name: trimmedName, createdById: userId },
    });
    res.status(201).json({ ...role, permissions: [] });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(400).json({ error: 'A role with that name already exists' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /clubs/:id/roles/:roleId — rename a ping role
router.patch('/:id/roles/:roleId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, roleId } = req.params;
  const { name } = req.body ?? {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  if (!trimmedName) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (trimmedName.length > MAX_ROLE_NAME_LENGTH) {
    res.status(400).json({ error: `name cannot exceed ${MAX_ROLE_NAME_LENGTH} characters` });
    return;
  }

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      include: { club: { select: { officerPermissions: true } } },
    });
    if (!membership || !hasClubPermission(membership, PERMISSION_MANAGE_ROLES)) {
      res.status(403).json({ error: 'You do not have permission to manage roles' });
      return;
    }

    const existing = await prisma.clubRole.findFirst({ where: { id: roleId, clubId } });
    if (!existing) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    const role = await prisma.clubRole.update({
      where: { id: roleId },
      data: { name: trimmedName },
    });
    res.json({ ...role, permissions: parseStringList(role.permissions) });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(400).json({ error: 'A role with that name already exists' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /clubs/:id/roles/:roleId — delete a ping role and its assignments
router.delete('/:id/roles/:roleId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, roleId } = req.params;

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      include: { club: { select: { officerPermissions: true } } },
    });
    if (!membership || !hasClubPermission(membership, PERMISSION_MANAGE_ROLES)) {
      res.status(403).json({ error: 'You do not have permission to manage roles' });
      return;
    }

    const existing = await prisma.clubRole.findFirst({ where: { id: roleId, clubId } });
    if (!existing) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    await prisma.clubRole.delete({ where: { id: roleId } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/roles/:roleId/members/:memberUserId — assign ping role
router.post(
  '/:id/roles/:roleId/members/:memberUserId',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId, roleId, memberUserId } = req.params;

    try {
      const actor = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId } },
        include: { club: { select: { officerPermissions: true } } },
      });
      if (!actor || !hasClubPermission(actor, PERMISSION_MANAGE_ROLES)) {
        res.status(403).json({ error: 'You do not have permission to assign roles' });
        return;
      }

      const [role, target] = await Promise.all([
        prisma.clubRole.findFirst({ where: { id: roleId, clubId } }),
        prisma.clubMember.findUnique({
          where: { clubId_userId: { clubId, userId: memberUserId } },
          include: {
            user: { select: MEMBER_USER_SELECT },
            customRoles: { include: { role: true }, orderBy: { createdAt: 'asc' } },
          },
        }),
      ]);

      if (!role) {
        res.status(404).json({ error: 'Role not found' });
        return;
      }
      if (!target) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }
      if (!canManageTarget(actor.role, target.role)) {
        res.status(400).json({ error: 'You can only assign roles to members below your role' });
        return;
      }

      await prisma.clubMemberRole.upsert({
        where: { memberId_roleId: { memberId: target.id, roleId } },
        create: { clubId, memberId: target.id, roleId, assignedById: userId },
        update: {},
      });

      const updated = await prisma.clubMember.findUnique({
        where: { id: target.id },
        include: {
          user: { select: MEMBER_USER_SELECT },
          customRoles: { include: { role: true }, orderBy: { createdAt: 'asc' } },
        },
      });

      res.json(parseMemberTags(updated!));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /clubs/:id/roles/:roleId/members/:memberUserId — remove ping role
router.delete(
  '/:id/roles/:roleId/members/:memberUserId',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId, roleId, memberUserId } = req.params;

    try {
      const actor = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId } },
        include: { club: { select: { officerPermissions: true } } },
      });
      if (!actor || !hasClubPermission(actor, PERMISSION_MANAGE_ROLES)) {
        res.status(403).json({ error: 'You do not have permission to assign roles' });
        return;
      }

      const target = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId: memberUserId } },
      });
      if (!target) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }
      if (!canManageTarget(actor.role, target.role)) {
        res.status(400).json({ error: 'You can only assign roles to members below your role' });
        return;
      }

      await prisma.clubMemberRole.deleteMany({
        where: { memberId: target.id, roleId, clubId },
      });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /clubs/:id/officer-permissions — owner/admin role settings
router.patch('/:id/officer-permissions', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const permissions = normalizePermissionList((req.body ?? {}).permissions);

  if (!permissions || permissions.includes(PERMISSION_TRANSFER_OWNERSHIP)) {
    res.status(400).json({ error: 'permissions must be valid club permissions' });
    return;
  }

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership || ![ROLE_OWNER, ROLE_ADMIN].includes(membership.role)) {
      res.status(403).json({ error: 'Only owners and admins can update officer permissions' });
      return;
    }

    const club = await prisma.club.update({
      where: { id: clubId },
      data: { officerPermissions: stringifyStringList(permissions) },
      select: { id: true, officerPermissions: true },
    });

    res.json({ id: club.id, officerPermissions: parseStringList(club.officerPermissions) });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ error: 'Club not found' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /clubs/:id/members/:memberUserId — leadership only (assign primary leadership role)
router.patch(
  '/:id/members/:memberUserId',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId, memberUserId } = req.params;
    const roleRaw = (req.body ?? {}).role;

    if (roleRaw !== ROLE_ADMIN && roleRaw !== ROLE_OFFICER && roleRaw !== ROLE_MEMBER) {
      res.status(400).json({ error: 'role must be ADMIN, OFFICER, or MEMBER' });
      return;
    }

    try {
      const result = await applyAdminMemberRoleChange(clubId, userId, memberUserId, roleRaw);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      NotificationService.notifyClubRoleChange(memberUserId, clubId, roleRaw).catch(() => {});
      res.json(result.member);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /clubs/:id/members/:memberUserId — ADMIN only (kick)
router.delete(
  '/:id/members/:memberUserId',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId, memberUserId } = req.params;

    try {
      const actor = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId } },
        include: { club: { select: { officerPermissions: true } } },
      });
      if (!actor || !hasClubPermission(actor, PERMISSION_MANAGE_MEMBERS)) {
        res.status(403).json({ error: 'You do not have permission to remove members' });
        return;
      }

      const target = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId: memberUserId } },
      });

      if (!target) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }
      if (!canManageTarget(actor.role, target.role)) {
        res.status(400).json({ error: 'You can only remove members below your role' });
        return;
      }

      if (memberUserId === userId) {
        const ownerCount = await prisma.clubMember.count({
          where: { clubId, role: ROLE_OWNER },
        });
        if (target.role === ROLE_OWNER && ownerCount === 1) {
          res.status(400).json({
            error: 'You are the only owner. Delete the club or transfer ownership before leaving.',
          });
          return;
        }
      }

      await prisma.clubMember.delete({ where: { id: target.id } });
      NotificationService.notifyClubKick(memberUserId, clubId).catch(() => {});
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /clubs/:id/members/:memberUserId/promote — ADMIN only (delegates to MEMBER→OFFICER)
router.post(
  '/:id/members/:memberUserId/promote',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId, memberUserId } = req.params;

    try {
      const result = await applyAdminMemberRoleChange(clubId, userId, memberUserId, ROLE_OFFICER);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result.member);
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

    if (membership.role === ROLE_OWNER) {
      const ownerCount = await prisma.clubMember.count({
        where: { clubId, role: ROLE_OWNER },
      });
      if (ownerCount === 1) {
        res.status(400).json({
          error: 'You are the only owner. Delete the club instead of leaving.',
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
      include: { club: { select: { officerPermissions: true } } },
    });

    if (!membership || !hasClubPermission(membership, PERMISSION_MANAGE_CLUB)) {
      res.status(403).json({ error: 'You do not have permission to delete the club' });
      return;
    }

    await prisma.club.delete({ where: { id: clubId } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /clubs/:id — upload club avatar (ADMIN only)
router.patch(
  '/:id',
  requireAuth,
  clubAvatarUpload.single('image'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId } = req.params;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    try {
      const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true, avatarUrl: true } });
      if (!club) {
        res.status(404).json({ error: 'Club not found' });
        return;
      }

      const membership = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId } },
        include: { club: { select: { officerPermissions: true } } },
      });
      if (!membership) {
        res.status(403).json({ error: 'You must be a member of this club' });
        return;
      }
      if (!hasClubPermission(membership, PERMISSION_MANAGE_CLUB)) {
        res.status(403).json({ error: 'You do not have permission to update the club avatar' });
        return;
      }

      const filename = `${clubId}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabaseStorage.storage
        .from(CLUB_AVATAR_BUCKET)
        .upload(filename, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        res.status(500).json({ error: 'Failed to upload avatar' });
        return;
      }

      const { data: publicUrlData } = supabaseStorage.storage
        .from(CLUB_AVATAR_BUCKET)
        .getPublicUrl(filename);

      const avatarUrl = publicUrlData.publicUrl;

      // Best-effort cleanup of old avatar from Supabase Storage
      if (club.avatarUrl) {
        const oldFilename = club.avatarUrl.split('/').pop();
        if (oldFilename) {
          supabaseStorage.storage.from(CLUB_AVATAR_BUCKET).remove([oldFilename]);
        }
      }

      await prisma.club.update({ where: { id: clubId }, data: { avatarUrl } });
      res.json({ avatarUrl });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

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
          include: {
            user: { select: MEMBER_USER_SELECT },
            customRoles: { include: { role: true }, orderBy: { createdAt: 'asc' } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        roles: { orderBy: { name: 'asc' } },
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
    const myRoleIds = new Set(myMembership?.customRoles.map((role) => role.roleId) ?? []);
    if (!club.isPublic && !myMembership) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }

    const visibleMeetings = club.meetings
      .filter((meeting) =>
        canAccessVisibility(meeting.visibility, !!myMembership, myMembership?.role) &&
        canAccessTargetRoles(meeting.targetRoleIds, myRoleIds, myMembership)
      )
      .map((meeting) => ({
        ...meeting,
        isPublic: meeting.visibility === VISIBILITY_PUBLIC,
        targetRoleIds: parseStringList(meeting.targetRoleIds),
      }));

    const visibleAnnouncements = club.announcements
      .filter((announcement) =>
        canAccessVisibility(announcement.visibility, !!myMembership, myMembership?.role) &&
        canAccessTargetRoles(announcement.targetRoleIds, myRoleIds, myMembership)
      )
      .map((announcement) => ({
        ...announcement,
        targetRoleIds: parseStringList(announcement.targetRoleIds),
      }));

    res.json({
      ...club,
      meetings: visibleMeetings,
      announcements: visibleAnnouncements,
      roles: club.roles.map((role) => ({
        ...role,
        permissions: parseStringList(role.permissions),
      })),
      members: club.members.map((member) =>
        parseMemberTags({
          ...member,
          customRoles: member.customRoles.map((assignment) => ({
            id: assignment.id,
            roleId: assignment.roleId,
            createdAt: assignment.createdAt,
            role: {
              ...assignment.role,
              permissions: parseStringList(assignment.role.permissions),
            },
          })),
        })
      ),
      isMember: !!myMembership,
      myRole: myMembership?.role ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
