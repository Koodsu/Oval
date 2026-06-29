import { Router, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import prisma from '../prisma';
import { requireVerifiedAuth as requireAuth, AuthRequest } from '../middleware/auth';
import { MEMBER_USER_SELECT, parseMemberTags } from '../lib/joinExistingPod';
import { setTyping, getTypingUserIds } from '../lib/typingStore';
import { NotificationService } from '../lib/NotificationService';
import { isSupabaseStorageConfigured, supabaseStorage } from '../lib/supabaseStorage';
import { moderateImageContent, moderateTextContent } from '../lib/contentModeration';
import { consumeDurableRateLimit } from '../lib/durableRateLimit';

// ── Club avatar upload setup ──────────────────────────────────────────────────

const CLUB_AVATAR_BUCKET = 'club-avatars';
const CLUB_AVATAR_UPLOAD_DIR = path.join(__dirname, '../../uploads/club-avatars');

const clubAvatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
      return;
    }
    cb(null, true);
  },
});

function clubAvatarExtension(mimetype: string): string {
  const subtype = mimetype.split('/')[1]?.toLowerCase();
  if (subtype === 'png') return 'png';
  if (subtype === 'webp') return 'webp';
  return 'jpg';
}

function clubSupabaseObjectNameFromPublicUrl(url: string): string | null {
  const marker = `/${CLUB_AVATAR_BUCKET}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;
  return decodeURIComponent(url.slice(markerIndex + marker.length));
}

async function cleanupClubAvatarUrl(avatarUrl: string | null | undefined): Promise<void> {
  if (!avatarUrl) return;

  if (avatarUrl.startsWith('/uploads/club-avatars/')) {
    const filename = path.basename(avatarUrl);
    await fs.promises.unlink(path.join(CLUB_AVATAR_UPLOAD_DIR, filename)).catch(() => {});
    return;
  }

  if (!isSupabaseStorageConfigured()) return;
  const oldObjectName = clubSupabaseObjectNameFromPublicUrl(avatarUrl);
  if (oldObjectName) {
    await supabaseStorage.storage.from(CLUB_AVATAR_BUCKET).remove([oldObjectName]).catch(() => {});
  }
}

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
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from(
    { length: 6 },
    () => alphabet[crypto.randomInt(0, alphabet.length)]
  ).join('');
}

// ── Role constants ──────────────────────────────────────────────────────────────

const ROLE_OWNER = 'OWNER';
const ROLE_ADMIN = 'ADMIN';
const ROLE_OFFICER = 'OFFICER';
const ROLE_MEMBER = 'MEMBER';
const VISIBILITY_PUBLIC = 'PUBLIC';
const VISIBILITY_MEMBERS = 'MEMBERS';
const VISIBILITY_OFFICERS = 'OFFICERS';

// ── Club lifecycle (see docs/CLUB_LIFECYCLE_IMPLEMENTATION.md) ─────────────────
const CLUB_PUBLISH_THRESHOLD = 5; // distinct qualifying members to auto-enable discovery
const MIN_ACCOUNT_AGE_DAYS = 3; // min account age for a member to count toward the gate

const VERIFICATION_UNVERIFIED = 'UNVERIFIED';
const VERIFICATION_PENDING = 'PENDING_REVIEW';
const VERIFICATION_VERIFIED = 'VERIFIED';

const JOIN_OPEN = 'OPEN';
const JOIN_REQUEST = 'REQUEST';
const JOIN_APPLICATION = 'APPLICATION';
const JOIN_INVITE_ONLY = 'INVITE_ONLY';
const CLUB_JOIN_POLICIES = new Set([JOIN_OPEN, JOIN_REQUEST, JOIN_APPLICATION, JOIN_INVITE_ONLY]);

const CLUB_STATUS_ACTIVE = 'ACTIVE';
const CLUB_STATUS_SUSPENDED = 'SUSPENDED';
const CLUB_STATUS_ARCHIVED = 'ARCHIVED';

const CLAIM_METHOD_INSTAGRAM = 'INSTAGRAM';
const CLAIM_METHOD_EMAIL = 'OFFICIAL_EMAIL';
const CLAIM_STATUS_PENDING = 'PENDING';
const CLAIM_STATUS_PROOF_SENT = 'PROOF_SENT';
const CLAIM_EXPIRY_HOURS = 24;

const CYCLE_STATUS_OPEN = 'OPEN';
const CYCLE_STATUS_CLOSED = 'CLOSED';
const APP_STAGE_APPLIED = 'APPLIED';
const APP_STAGE_INTERVIEW = 'INTERVIEW';
const APP_STAGE_ACCEPTED = 'ACCEPTED';
const APP_STAGE_REJECTED = 'REJECTED';
const APP_STAGE_WITHDRAWN = 'WITHDRAWN';
const APP_STAGES = new Set([
  APP_STAGE_APPLIED,
  APP_STAGE_INTERVIEW,
  APP_STAGE_ACCEPTED,
  APP_STAGE_REJECTED,
  APP_STAGE_WITHDRAWN,
]);

const RSVP_GOING = 'GOING';
const RSVP_MAYBE = 'MAYBE';
const RSVP_NOT_GOING = 'NOT_GOING';

const RSVP_STATUSES = new Set([RSVP_GOING, RSVP_MAYBE, RSVP_NOT_GOING]);
const CLUB_VISIBILITIES = new Set([VISIBILITY_PUBLIC, VISIBILITY_MEMBERS, VISIBILITY_OFFICERS]);

const STATUS_ATTENDED = 'ATTENDED';

const MAX_CLUB_MESSAGE_LENGTH = 500;
const MAX_CLUB_OUTREACH_LENGTH = 800;
const MAX_ROLE_NAME_LENGTH = 40;
const MAX_CHANNEL_NAME_LENGTH = 32;
const MAX_CHANNEL_DESCRIPTION_LENGTH = 140;
const MAX_CUSTOM_CHANNELS = 20;

const CHANNEL_ANNOUNCEMENTS = 'ANNOUNCEMENTS';
const CHANNEL_GENERAL = 'GENERAL';
const CHANNEL_OFFICERS = 'OFFICERS';
const CHANNEL_CUSTOM = 'CUSTOM';

/** Named accents from the mobile palette. */
const ROLE_COLORS = new Set(['scarlet', 'blue', 'green', 'amber', 'pink', 'violet', 'teal']);
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const RSVP_REMINDER_COOLDOWN_MS = 15 * 60 * 1000;
const OUTREACH_COOLDOWN_MS = 5 * 60 * 1000;

const PERMISSION_MANAGE_MEMBERS = 'MANAGE_MEMBERS';
const PERMISSION_MANAGE_ROLES = 'MANAGE_ROLES';
const PERMISSION_CREATE_MEETINGS = 'CREATE_MEETINGS';
const PERMISSION_POST_ANNOUNCEMENTS = 'POST_ANNOUNCEMENTS';
const PERMISSION_DELETE_MESSAGES = 'DELETE_MESSAGES';
const PERMISSION_MANAGE_CLUB = 'MANAGE_CLUB';
const PERMISSION_TRANSFER_OWNERSHIP = 'TRANSFER_OWNERSHIP';

const outreachRateLimit = new Map<string, number>();

const CLUB_PERMISSIONS = new Set([
  PERMISSION_MANAGE_MEMBERS,
  PERMISSION_MANAGE_ROLES,
  PERMISSION_CREATE_MEETINGS,
  PERMISSION_POST_ANNOUNCEMENTS,
  PERMISSION_DELETE_MESSAGES,
  PERMISSION_MANAGE_CLUB,
]);

function latestAllowedMeetingTime(from = new Date()): Date {
  const max = new Date(from);
  max.setMonth(max.getMonth() + 12);
  return max;
}

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

function canManageAttendance(membership: { role: string; club?: { officerPermissions?: string | null } } | null | undefined): boolean {
  return roleRank(membership?.role) >= roleRank(ROLE_OFFICER);
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

function canDeleteClubContent(membership: { role: string } | null | undefined): boolean {
  return roleRank(membership?.role) >= roleRank(ROLE_ADMIN);
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

async function parseAndValidateTargetUserIds(clubId: string, raw: unknown): Promise<string[] | null> {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== 'string')) return null;
  const ids = Array.from(new Set(raw.map((item) => item.trim()).filter(Boolean)));
  if (ids.length === 0) return [];
  const count = await prisma.clubMember.count({ where: { clubId, userId: { in: ids } } });
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

type OutreachAudience =
  | { type: 'ALL' }
  | { type: 'NON_RSVP'; meetingId?: string }
  | { type: 'PRIMARY_ROLE'; role: string }
  | { type: 'CUSTOM_ROLE'; roleId: string }
  | { type: 'MANUAL'; userIds: string[] };

function parseOutreachAudience(raw: unknown): OutreachAudience | null {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const type = typeof body.type === 'string' ? body.type.trim().toUpperCase() : '';
  if (type === 'ALL') return { type: 'ALL' };
  if (type === 'NON_RSVP') {
    return { type: 'NON_RSVP', meetingId: typeof body.meetingId === 'string' ? body.meetingId : undefined };
  }
  if (type === 'PRIMARY_ROLE') {
    const role = typeof body.role === 'string' ? body.role.trim().toUpperCase() : '';
    return [ROLE_OWNER, ROLE_ADMIN, ROLE_OFFICER, ROLE_MEMBER].includes(role) ? { type: 'PRIMARY_ROLE', role } : null;
  }
  if (type === 'CUSTOM_ROLE') {
    return typeof body.roleId === 'string' && body.roleId.trim() ? { type: 'CUSTOM_ROLE', roleId: body.roleId.trim() } : null;
  }
  if (type === 'MANUAL') {
    const userIds = Array.isArray(body.userIds)
      ? Array.from(new Set(body.userIds.filter((item): item is string => typeof item === 'string' && !!item.trim())))
      : [];
    return { type: 'MANUAL', userIds };
  }
  return null;
}

function audienceLabel(audience: OutreachAudience): string {
  if (audience.type === 'ALL') return 'All members';
  if (audience.type === 'NON_RSVP') return 'Members who have not RSVP’d';
  if (audience.type === 'PRIMARY_ROLE') return `${audience.role.toLowerCase()} members`;
  if (audience.type === 'CUSTOM_ROLE') return 'Selected member tag';
  return 'Manual selection';
}

async function resolveClubAudience(
  clubId: string,
  audience: OutreachAudience,
  excludeUserId?: string
): Promise<
  | {
      ok: true;
      recipients: Array<{ id: string; name: string; avatarUrl: string | null; role: string }>;
    }
  | { ok: false; status: number; error: string }
> {
  const members = await prisma.clubMember.findMany({
    where: { clubId },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      customRoles: { select: { roleId: true } },
    },
    orderBy: { joinedAt: 'asc' },
  });

  let filtered = members;
  if (audience.type === 'NON_RSVP') {
    const meeting = audience.meetingId
      ? await prisma.clubMeeting.findFirst({ where: { id: audience.meetingId, clubId } })
      : await prisma.clubMeeting.findFirst({
          where: { clubId, meetingTime: { gt: new Date() } },
          orderBy: { meetingTime: 'asc' },
        });
    if (!meeting) return { ok: false, status: 404, error: 'Meeting not found' };

    const responded = await prisma.clubMeetingAttendee.findMany({
      where: { meetingId: meeting.id, status: { in: [RSVP_GOING, RSVP_MAYBE, RSVP_NOT_GOING] } },
      select: { userId: true },
    });
    const respondedIds = new Set(responded.map((row) => row.userId));
    filtered = members.filter((member) => !respondedIds.has(member.userId));
  } else if (audience.type === 'PRIMARY_ROLE') {
    filtered = members.filter((member) => member.role === audience.role);
  } else if (audience.type === 'CUSTOM_ROLE') {
    const role = await prisma.clubRole.findFirst({ where: { id: audience.roleId, clubId }, select: { id: true } });
    if (!role) return { ok: false, status: 404, error: 'Role not found' };
    filtered = members.filter((member) => member.customRoles.some((assignment) => assignment.roleId === audience.roleId));
  } else if (audience.type === 'MANUAL') {
    const selectedIds = new Set(audience.userIds);
    filtered = members.filter((member) => selectedIds.has(member.userId));
  }

  const seen = new Set<string>();
  const recipients = filtered
    .filter((member) => {
      if (member.userId === excludeUserId) return false;
      if (seen.has(member.userId)) return false;
      seen.add(member.userId);
      return true;
    })
    .map((member) => ({
      id: member.user.id,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
      role: member.role,
    }));

  return { ok: true, recipients };
}

// ── Club channels ───────────────────────────────────────────────────────────

type ChannelRecord = {
  id: string;
  clubId: string;
  kind: string;
  name: string;
  description: string | null;
  allowedRoleIds: string | null;
  allowedUserIds: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

type MembershipWithRoles = {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date;
  club?: { officerPermissions?: string | null };
  customRoles: Array<{ roleId: string }>;
};

const BUILTIN_CHANNELS = [
  { kind: CHANNEL_ANNOUNCEMENTS, name: 'Announcements', position: 0 },
  { kind: CHANNEL_GENERAL, name: 'General', position: 1 },
  { kind: CHANNEL_OFFICERS, name: 'Officers', position: 2 },
] as const;

/** Fetch (and lazily create) the club's channels, builtins first. */
async function ensureClubChannels(clubId: string): Promise<ChannelRecord[]> {
  const existing = await prisma.clubChannel.findMany({
    where: { clubId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  const missing = BUILTIN_CHANNELS.filter((builtin) => !existing.some((channel) => channel.kind === builtin.kind));
  if (missing.length === 0) return existing;

  await prisma.clubChannel
    .createMany({
      data: missing.map((builtin) => ({ clubId, ...builtin })),
      skipDuplicates: true,
    })
    .catch(() => {});
  return prisma.clubChannel.findMany({
    where: { clubId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
}

async function getMembershipWithRoles(clubId: string, userId: string): Promise<MembershipWithRoles | null> {
  return prisma.clubMember.findUnique({
    where: { clubId_userId: { clubId, userId } },
    include: {
      club: { select: { officerPermissions: true } },
      customRoles: { select: { roleId: true } },
    },
  });
}

// ── Club lifecycle helpers ────────────────────────────────────────────────────

/** Distinct, university-verified, sufficiently-aged members count toward the publish gate. */
async function countQualifyingMembers(clubId: string): Promise<number> {
  const cutoff = new Date(Date.now() - MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000);
  return prisma.clubMember.count({
    where: {
      clubId,
      user: { verifiedUniversity: true, createdAt: { lte: cutoff } },
    },
  });
}

/** A club may turn discovery on once it has enough real members OR is verified. */
async function isEligibleForDiscovery(club: { id: string; verification: string }): Promise<boolean> {
  if (club.verification === VERIFICATION_VERIFIED) return true;
  const qualifying = await countQualifyingMembers(club.id);
  return qualifying >= CLUB_PUBLISH_THRESHOLD;
}

/**
 * After a membership add, auto-flip a never-published club to discoverable the first
 * time it crosses the member threshold. One-time: once `discoverableSince` is set the
 * club controls discovery via PATCH /:id/discovery.
 */
async function maybeAutoEnableDiscovery(clubId: string): Promise<void> {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { id: true, isDiscoverable: true, discoverableSince: true, status: true },
  });
  if (!club) return;
  if (club.isDiscoverable || club.discoverableSince || club.status !== CLUB_STATUS_ACTIVE) return;
  const qualifying = await countQualifyingMembers(clubId);
  if (qualifying < CLUB_PUBLISH_THRESHOLD) return;
  await prisma.club.update({
    where: { id: clubId },
    data: { isDiscoverable: true, discoverableSince: new Date(), isPublic: true },
  });
}

function generateInviteCode(): string {
  return crypto.randomBytes(6).toString('base64url');
}

/** Short human-typable code the officer DMs to @oval (or receives by email). */
function generateChallengeCode(): string {
  return `OVAL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/** Normalize an Instagram handle: strip leading @, lowercase, trim. */
function normalizeInstagramHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const APPLICANT_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  major: true,
  classYear: true,
} as const;

/** Officer-or-higher membership, or null. */
async function getOfficerMembership(clubId: string, userId: string) {
  const membership = await prisma.clubMember.findUnique({
    where: { clubId_userId: { clubId, userId } },
  });
  return membership && roleRank(membership.role) >= roleRank(ROLE_OFFICER) ? membership : null;
}

/** Parse a JSON string array (questions/answers), tolerating bad data. */
function parseJsonStringArray(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function serializeCycle(
  cycle: {
    id: string;
    title: string;
    questionsJson: string;
    status: string;
    opensAt: Date | null;
    closesAt: Date | null;
    createdAt: Date;
  },
  applicationCount: number
) {
  return {
    id: cycle.id,
    title: cycle.title,
    questions: parseJsonStringArray(cycle.questionsJson),
    status: cycle.status,
    opensAt: cycle.opensAt,
    closesAt: cycle.closesAt,
    createdAt: cycle.createdAt,
    applicationCount,
  };
}

function canSeeChannel(
  channel: Pick<ChannelRecord, 'kind' | 'allowedRoleIds' | 'allowedUserIds'>,
  membership: MembershipWithRoles | null,
  myRoleIds: Set<string>
): boolean {
  if (channel.kind === CHANNEL_ANNOUNCEMENTS) return true;
  if (!membership) return false;
  if (channel.kind === CHANNEL_GENERAL) return true;
  if (channel.kind === CHANNEL_OFFICERS) return roleRank(membership.role) >= roleRank(ROLE_OFFICER);
  const allowedRoles = parseStringList(channel.allowedRoleIds);
  const allowedUsers = parseStringList(channel.allowedUserIds);
  if (allowedRoles.length === 0 && allowedUsers.length === 0) return true;
  if (roleRank(membership.role) >= roleRank(ROLE_OFFICER)) return true;
  return allowedUsers.includes(membership.userId) || allowedRoles.some((roleId) => myRoleIds.has(roleId));
}

function canPostToChannel(
  channel: Pick<ChannelRecord, 'kind' | 'allowedRoleIds' | 'allowedUserIds'>,
  membership: MembershipWithRoles | null,
  myRoleIds: Set<string>
): boolean {
  if (!membership) return false;
  if (channel.kind === CHANNEL_ANNOUNCEMENTS) return canPostAnnouncements(membership);
  return canSeeChannel(channel, membership, myRoleIds);
}

function canPingRoles(membership: MembershipWithRoles): boolean {
  return roleRank(membership.role) >= roleRank(ROLE_OFFICER) || hasClubPermission(membership, PERMISSION_POST_ANNOUNCEMENTS);
}

function typingScopeForChannel(
  channel: Pick<ChannelRecord, 'id' | 'kind' | 'clubId'>
): { scope: 'club' | 'club-officer' | 'club-channel'; key: string } {
  if (channel.kind === CHANNEL_GENERAL) return { scope: 'club', key: channel.clubId };
  if (channel.kind === CHANNEL_OFFICERS) return { scope: 'club-officer', key: channel.clubId };
  return { scope: 'club-channel', key: channel.id };
}

type ChannelActivity = { unreadCount: number; lastMessageAt: Date | null; lastMessagePreview: string | null };

/** Unread + latest-message info for one channel relative to the viewer's read state. */
async function channelActivity(
  channel: ChannelRecord,
  membership: MembershipWithRoles,
  userId: string,
  lastReadAt: Date | null
): Promise<ChannelActivity> {
  const baseline = lastReadAt ?? membership.joinedAt;

  if (channel.kind === CHANNEL_ANNOUNCEMENTS) {
    const [unreadCount, latest] = await Promise.all([
      prisma.clubAnnouncement.count({
        where: { clubId: channel.clubId, createdAt: { gt: baseline }, userId: { not: userId } },
      }),
      prisma.clubAnnouncement.findFirst({
        where: { clubId: channel.clubId },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true },
      }),
    ]);
    return {
      unreadCount,
      lastMessageAt: latest?.createdAt ?? null,
      lastMessagePreview: latest?.content ?? null,
    };
  }

  if (channel.kind === CHANNEL_OFFICERS) {
    const [unreadCount, latest] = await Promise.all([
      prisma.clubOfficerMessage.count({
        where: { clubId: channel.clubId, createdAt: { gt: baseline }, userId: { not: userId } },
      }),
      prisma.clubOfficerMessage.findFirst({
        where: { clubId: channel.clubId },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true },
      }),
    ]);
    return {
      unreadCount,
      lastMessageAt: latest?.createdAt ?? null,
      lastMessagePreview: latest?.content ?? null,
    };
  }

  const channelFilter = channel.kind === CHANNEL_GENERAL ? null : channel.id;
  const [unreadCount, latest] = await Promise.all([
    prisma.clubMessage.count({
      where: {
        clubId: channel.clubId,
        channelId: channelFilter,
        createdAt: { gt: baseline },
        userId: { not: userId },
      },
    }),
    prisma.clubMessage.findFirst({
      where: { clubId: channel.clubId, channelId: channelFilter },
      orderBy: { createdAt: 'desc' },
      select: { content: true, createdAt: true },
    }),
  ]);
  return {
    unreadCount,
    lastMessageAt: latest?.createdAt ?? null,
    lastMessagePreview: latest?.content ?? null,
  };
}

/** Visible channels with unread counts for a member; announcements-only for non-members. */
async function visibleChannelsWithActivity(clubId: string, userId: string) {
  const [channels, membership] = await Promise.all([
    ensureClubChannels(clubId),
    getMembershipWithRoles(clubId, userId),
  ]);
  const myRoleIds = new Set(membership?.customRoles.map((assignment) => assignment.roleId) ?? []);
  const visible = channels.filter((channel) => canSeeChannel(channel, membership, myRoleIds));

  if (!membership) {
    return visible.map((channel) => ({
      ...serializeChannel(channel),
      unreadCount: 0,
      lastMessageAt: null as Date | null,
      lastMessagePreview: null as string | null,
      canPost: false,
    }));
  }

  const readStates = await prisma.clubChannelReadState.findMany({
    where: { userId, channelId: { in: visible.map((channel) => channel.id) } },
  });
  const readByChannel = new Map(readStates.map((state) => [state.channelId, state.lastReadAt]));

  const activities = await Promise.all(
    visible.map((channel) => channelActivity(channel, membership, userId, readByChannel.get(channel.id) ?? null))
  );

  return visible.map((channel, index) => ({
    ...serializeChannel(channel),
    ...activities[index],
    canPost: canPostToChannel(channel, membership, myRoleIds),
  }));
}

/** Count-only unread query for one channel (used by the /my digest). */
function unreadCountForChannel(
  channel: Pick<ChannelRecord, 'id' | 'kind' | 'clubId'>,
  baseline: Date,
  userId: string
): Promise<number> {
  if (channel.kind === CHANNEL_ANNOUNCEMENTS) {
    return prisma.clubAnnouncement.count({
      where: { clubId: channel.clubId, createdAt: { gt: baseline }, userId: { not: userId } },
    });
  }
  if (channel.kind === CHANNEL_OFFICERS) {
    return prisma.clubOfficerMessage.count({
      where: { clubId: channel.clubId, createdAt: { gt: baseline }, userId: { not: userId } },
    });
  }
  return prisma.clubMessage.count({
    where: {
      clubId: channel.clubId,
      channelId: channel.kind === CHANNEL_GENERAL ? null : channel.id,
      createdAt: { gt: baseline },
      userId: { not: userId },
    },
  });
}

function serializeChannel(channel: ChannelRecord) {
  return {
    id: channel.id,
    clubId: channel.clubId,
    kind: channel.kind,
    name: channel.name,
    description: channel.description,
    allowedRoleIds: parseStringList(channel.allowedRoleIds),
    allowedUserIds: parseStringList(channel.allowedUserIds),
    position: channel.position,
    createdAt: channel.createdAt,
  };
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
      isDiscoverable: boolean;
      status: string;
      category?: string;
      name?: { contains: string; mode: 'insensitive' };
    } = {
      isDiscoverable: true,
      status: CLUB_STATUS_ACTIVE,
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
            followers: true,
            meetings: { where: { meetingTime: { gt: now } } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const clubIds = clubs.map((c) => c.id);
    const [myMemberships, myFollows] =
      clubIds.length === 0
        ? [[], []]
        : await Promise.all([
            prisma.clubMember.findMany({
              where: { userId, clubId: { in: clubIds } },
              select: { clubId: true },
            }),
            prisma.clubFollower.findMany({
              where: { userId, clubId: { in: clubIds } },
              select: { clubId: true },
            }),
          ]);
    const memberSet = new Set(myMemberships.map((m) => m.clubId));
    const followSet = new Set(myFollows.map((f) => f.clubId));

    res.json(
      clubs.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        category: c.category,
        emoji: c.emoji,
        avatarUrl: c.avatarUrl,
        isVerified: c.isVerified,
        verification: c.verification,
        isPublic: c.isPublic,
        isDiscoverable: c.isDiscoverable,
        joinPolicy: c.joinPolicy,
        university: c.university,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        memberCount: c._count.members,
        followerCount: c._count.followers,
        upcomingMeetingCount: c._count.meetings,
        isMember: memberSet.has(c.id),
        isFollower: followSet.has(c.id),
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

    // Unread totals across each club's channels the member can see.
    const channels =
      clubIds.length === 0
        ? []
        : await prisma.clubChannel.findMany({ where: { clubId: { in: clubIds } } });
    const membershipIds = rows.map((r) => r.id);
    const myRoleAssignments =
      membershipIds.length === 0
        ? []
        : await prisma.clubMemberRole.findMany({
            where: { memberId: { in: membershipIds } },
            select: { clubId: true, roleId: true },
          });
    const readStates =
      channels.length === 0
        ? []
        : await prisma.clubChannelReadState.findMany({
            where: { userId, channelId: { in: channels.map((channel) => channel.id) } },
          });
    const readByChannel = new Map(readStates.map((state) => [state.channelId, state.lastReadAt]));
    const roleIdsByClub = new Map<string, Set<string>>();
    for (const assignment of myRoleAssignments) {
      const set = roleIdsByClub.get(assignment.clubId) ?? new Set<string>();
      set.add(assignment.roleId);
      roleIdsByClub.set(assignment.clubId, set);
    }

    const unreadByClub = new Map<string, number>();
    await Promise.all(
      rows.map(async (row) => {
        const myRoleIds = roleIdsByClub.get(row.clubId) ?? new Set<string>();
        const membershipLike = {
          id: row.id,
          userId: row.userId,
          role: row.role,
          joinedAt: row.joinedAt,
          customRoles: Array.from(myRoleIds).map((roleId) => ({ roleId })),
        };
        const visible = channels.filter(
          (channel) => channel.clubId === row.clubId && canSeeChannel(channel, membershipLike, myRoleIds)
        );
        const counts = await Promise.all(
          visible.map((channel) =>
            unreadCountForChannel(channel, readByChannel.get(channel.id) ?? row.joinedAt, userId)
          )
        );
        unreadByClub.set(row.clubId, counts.reduce((sum, count) => sum + count, 0));
      })
    );

    res.json(
      rows.map((r) => ({
        membershipId: r.id,
        role: r.role,
        joinedAt: r.joinedAt,
        unreadCount: unreadByClub.get(r.clubId) ?? 0,
        club: {
          id: r.club.id,
          name: r.club.name,
          description: r.club.description,
          category: r.club.category,
          emoji: r.club.emoji,
          avatarUrl: r.club.avatarUrl,
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

// GET /clubs/week — visible meetings for the next 7 days (campus timeline)
router.get('/week', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { start } = startEndOfLocalToday();
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);

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
          isMyClub: m.club.members.length > 0,
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
  const { name, description, category, emoji } = body;

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
  // Emoji is optional — an empty emoji renders the club's initials instead.
  if (emoji !== undefined && emoji !== null && typeof emoji !== 'string') {
    res.status(400).json({ error: 'emoji must be a string' });
    return;
  }
  const clubModeration = await moderateTextContent([name, description]);
  if (clubModeration) {
    res.status(clubModeration.status).json({ error: clubModeration.message });
    return;
  }

  const trimmedName = name.trim();

  // Rate-limit club creation to curb spam/squatting.
  const createAllowed = await consumeDurableRateLimit({
    action: 'club_create',
    identifiers: [userId],
    limit: 1,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!createAllowed) {
    res.status(429).json({ error: 'You are creating clubs too quickly. Try again later.' });
    return;
  }

  // Soft name-collision guard within the same university (default OSU).
  const collision = await prisma.club.findFirst({
    where: {
      university: 'OSU',
      name: { equals: trimmedName, mode: 'insensitive' },
      status: { not: CLUB_STATUS_ARCHIVED },
    },
    select: { id: true },
  });
  if (collision) {
    res.status(409).json({
      error: 'A club with this name already exists. Try joining it instead.',
      existingClubId: collision.id,
    });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // New clubs start hidden, unverified, open-join; they become discoverable
      // once they reach the member threshold (§5) or get verified (§7).
      const club = await tx.club.create({
        data: {
          name: trimmedName,
          description: description.trim(),
          category: category.trim(),
          emoji: typeof emoji === 'string' ? emoji.trim() : '',
          isPublic: false,
          isDiscoverable: false,
          verification: VERIFICATION_UNVERIFIED,
          joinPolicy: JOIN_OPEN,
          status: CLUB_STATUS_ACTIVE,
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
  const announcementModeration = await moderateTextContent([content], { allowProfanity: true });
  if (announcementModeration) {
    res.status(announcementModeration.status).json({ error: announcementModeration.message });
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

// DELETE /clubs/:id/announcements/:announcementId — OWNER/ADMIN only
router.delete('/:id/announcements/:announcementId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, announcementId } = req.params;

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!canDeleteClubContent(membership)) {
      res.status(403).json({ error: 'Only club admins can delete announcements' });
      return;
    }

    const announcement = await prisma.clubAnnouncement.findFirst({
      where: { id: announcementId, clubId },
      select: { id: true },
    });
    if (!announcement) {
      res.status(404).json({ error: 'Announcement not found' });
      return;
    }

    await prisma.clubAnnouncement.delete({ where: { id: announcementId } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/outreach/preview — leaders preview exact recipient list
router.post('/:id/outreach/preview', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const audience = parseOutreachAudience((req.body ?? {}).audience);

  if (!audience) {
    res.status(400).json({ error: 'audience is required' });
    return;
  }

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      include: { club: { select: { officerPermissions: true } } },
    });
    if (!membership || !canPostAnnouncements(membership)) {
      res.status(403).json({ error: 'Only club leaders can preview outreach' });
      return;
    }

    const result = await resolveClubAudience(clubId, audience, userId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ audience: audienceLabel(audience), count: result.recipients.length, recipients: result.recipients });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/outreach/send — leaders send notification outreach after UI confirmation
router.post('/:id/outreach/send', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const { content } = req.body ?? {};
  const audience = parseOutreachAudience((req.body ?? {}).audience);
  const trimmed = typeof content === 'string' ? content.trim() : '';

  if (!audience) {
    res.status(400).json({ error: 'audience is required' });
    return;
  }
  if (!trimmed) {
    res.status(400).json({ error: 'content is required' });
    return;
  }
  if (trimmed.length > MAX_CLUB_OUTREACH_LENGTH) {
    res.status(400).json({ error: `Message cannot exceed ${MAX_CLUB_OUTREACH_LENGTH} characters` });
    return;
  }
  const outreachModeration = await moderateTextContent([trimmed], { allowProfanity: true });
  if (outreachModeration) {
    res.status(outreachModeration.status).json({ error: outreachModeration.message });
    return;
  }

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      include: { club: { select: { officerPermissions: true } } },
    });
    if (!membership || !canPostAnnouncements(membership)) {
      res.status(403).json({ error: 'Only club leaders can send outreach' });
      return;
    }

    const rateKey = `${clubId}:${userId}:outreach`;
    const lastSentAt = outreachRateLimit.get(rateKey) ?? 0;
    if (Date.now() - lastSentAt < OUTREACH_COOLDOWN_MS) {
      res.status(429).json({ error: 'Please wait a few minutes before sending another outreach message' });
      return;
    }

    const result = await resolveClubAudience(clubId, audience, userId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    if (result.recipients.length === 0) {
      res.status(400).json({ error: 'No members match that audience' });
      return;
    }

    outreachRateLimit.set(rateKey, Date.now());
    const delivery = await NotificationService.notifyClubOutreach(
      clubId,
      userId,
      result.recipients.map((recipient) => recipient.id),
      trimmed
    );
    res.status(201).json({
      ok: true,
      audience: audienceLabel(audience),
      count: result.recipients.length,
      recipients: result.recipients,
      sent: delivery.sent,
      attempted: delivery.attempted,
      sentAt: new Date(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/meetings/:meetingId/rsvp-reminders — leaders remind non-RSVPs
router.post('/:id/meetings/:meetingId/rsvp-reminders', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, meetingId } = req.params;

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      include: { club: { select: { officerPermissions: true } } },
    });
    if (!membership || !canCreateMeetings(membership)) {
      res.status(403).json({ error: 'Only club leaders can send RSVP reminders' });
      return;
    }

    const meeting = await prisma.clubMeeting.findFirst({ where: { id: meetingId, clubId } });
    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }
    if (
      meeting.rsvpReminderSentAt &&
      Date.now() - meeting.rsvpReminderSentAt.getTime() < RSVP_REMINDER_COOLDOWN_MS
    ) {
      res.status(429).json({ error: 'Please wait before sending another RSVP reminder for this meeting' });
      return;
    }

    const audience = await resolveClubAudience(clubId, { type: 'NON_RSVP', meetingId }, userId);
    if (!audience.ok) {
      res.status(audience.status).json({ error: audience.error });
      return;
    }
    const recipientIds = audience.recipients.map((recipient) => recipient.id);
    if (recipientIds.length === 0) {
      const updated = await prisma.clubMeeting.update({
        where: { id: meetingId },
        data: {
          rsvpReminderSentAt: new Date(),
          rsvpReminderStatus: 'SUCCESS',
          rsvpReminderCount: 0,
          rsvpReminderError: null,
        },
      });
      res.json({
        ok: true,
        count: 0,
        sent: 0,
        attempted: 0,
        recipients: [],
        lastSentAt: updated.rsvpReminderSentAt,
        status: updated.rsvpReminderStatus,
      });
      return;
    }

    const delivery = await NotificationService.notifyClubRsvpReminder(meetingId, recipientIds);
    const status = delivery.sent > 0 ? 'SUCCESS' : 'NO_DELIVERABLE_TOKENS';
    const updated = await prisma.clubMeeting.update({
      where: { id: meetingId },
      data: {
        rsvpReminderSentAt: new Date(),
        rsvpReminderStatus: status,
        rsvpReminderCount: recipientIds.length,
        rsvpReminderError: null,
      },
    });

    res.json({
      ok: true,
      count: recipientIds.length,
      sent: delivery.sent,
      attempted: delivery.attempted,
      recipients: audience.recipients,
      lastSentAt: updated.rsvpReminderSentAt,
      status: updated.rsvpReminderStatus,
    });
  } catch (err) {
    console.error(err);
    try {
      await prisma.clubMeeting.update({
        where: { id: meetingId },
        data: {
          rsvpReminderSentAt: new Date(),
          rsvpReminderStatus: 'FAILED',
          rsvpReminderError: 'Internal server error',
        },
      });
    } catch {}
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
      if (!membership || !canManageAttendance(membership)) {
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
      if (!membership || !canManageAttendance(membership)) {
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
      const allowed = await consumeDurableRateLimit({
        action: 'club_attendance_checkin',
        identifiers: [`${meetingId}:${userId}`, req.ip || req.socket.remoteAddress || 'unknown'],
        limit: 20,
        windowMs: 15 * 60 * 1000,
      });
      if (!allowed) {
        res.status(429).json({ error: 'Too many attendance-code attempts. Try again later.' });
        return;
      }

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

      if (!membership || !canManageAttendance(membership)) {
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
    if (!club.isPublic && !isMember) {
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
  if (when > latestAllowedMeetingTime(now)) {
    res.status(400).json({ error: 'meetingTime must be within the next 12 months' });
    return;
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    res.status(400).json({ error: 'description must be a string' });
    return;
  }
  const meetingModeration = await moderateTextContent([title, location, typeof description === 'string' ? description : null]);
  if (meetingModeration) {
    res.status(meetingModeration.status).json({ error: meetingModeration.message });
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

// DELETE /clubs/:id/meetings/:meetingId — OWNER/ADMIN only
router.delete('/:id/meetings/:meetingId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, meetingId } = req.params;

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!canDeleteClubContent(membership)) {
      res.status(403).json({ error: 'Only club admins can delete meetings' });
      return;
    }

    const meeting = await prisma.clubMeeting.findFirst({
      where: { id: meetingId, clubId },
      select: { id: true },
    });
    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }

    await prisma.clubMeeting.delete({ where: { id: meetingId } });
    res.json({ ok: true });
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

    // channelId null = the built-in General channel; custom-channel messages are
    // role-gated and only served by the channel endpoints.
    const messages = await prisma.clubMessage.findMany({
      where: { clubId, channelId: null },
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
  const clubMessageModeration = await moderateTextContent([trimmed], { allowProfanity: true });
  if (clubMessageModeration) {
    res.status(clubMessageModeration.status).json({ error: clubMessageModeration.message });
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
  const officerMessageModeration = await moderateTextContent([content], { allowProfanity: true });
  if (officerMessageModeration) {
    res.status(officerMessageModeration.status).json({ error: officerMessageModeration.message });
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

// ── Channel endpoints ──────────────────────────────────────────────────────────

// GET /clubs/:id/channels — visible channels with unread counts
router.get('/:id/channels', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;

  try {
    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { id: true, isPublic: true } });
    if (!club) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      select: { id: true },
    });
    if (!club.isPublic && !membership) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }

    const channels = await visibleChannelsWithActivity(clubId, userId);
    res.json({ channels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/channels — create a custom channel (MANAGE_CLUB)
router.post('/:id/channels', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const { name, description, allowedRoleIds, allowedUserIds } = req.body ?? {};

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedDescription = typeof description === 'string' ? description.trim() : '';
  if (!trimmedName) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (trimmedName.length > MAX_CHANNEL_NAME_LENGTH) {
    res.status(400).json({ error: `name cannot exceed ${MAX_CHANNEL_NAME_LENGTH} characters` });
    return;
  }
  if (trimmedDescription.length > MAX_CHANNEL_DESCRIPTION_LENGTH) {
    res.status(400).json({ error: `description cannot exceed ${MAX_CHANNEL_DESCRIPTION_LENGTH} characters` });
    return;
  }
  const channelModeration = await moderateTextContent([trimmedName, trimmedDescription].filter(Boolean));
  if (channelModeration) {
    res.status(channelModeration.status).json({ error: channelModeration.message });
    return;
  }

  try {
    const membership = await getMembershipWithRoles(clubId, userId);
    if (!membership || !hasClubPermission(membership, PERMISSION_MANAGE_CLUB)) {
      res.status(403).json({ error: 'You do not have permission to manage channels' });
      return;
    }

    const targetIds = await parseAndValidateTargetRoleIds(clubId, allowedRoleIds);
    if (targetIds === null) {
      res.status(400).json({ error: 'allowedRoleIds contains invalid roles' });
      return;
    }
    const targetUserIds = await parseAndValidateTargetUserIds(clubId, allowedUserIds);
    if (targetUserIds === null) {
      res.status(400).json({ error: 'allowedUserIds contains invalid members' });
      return;
    }

    const channels = await ensureClubChannels(clubId);
    const customCount = channels.filter((channel) => channel.kind === CHANNEL_CUSTOM).length;
    if (customCount >= MAX_CUSTOM_CHANNELS) {
      res.status(400).json({ error: `Clubs can have at most ${MAX_CUSTOM_CHANNELS} custom channels` });
      return;
    }
    const maxPosition = channels.reduce((max, channel) => Math.max(max, channel.position), 0);

    const channel = await prisma.clubChannel.create({
      data: {
        clubId,
        kind: CHANNEL_CUSTOM,
        name: trimmedName,
        description: trimmedDescription || null,
        allowedRoleIds: targetIds.length ? stringifyStringList(targetIds) : null,
        allowedUserIds: targetUserIds.length ? stringifyStringList(targetUserIds) : null,
        position: Math.max(maxPosition + 1, 10),
        createdById: userId,
      },
    });
    res.status(201).json(serializeChannel(channel));
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(400).json({ error: 'A channel with that name already exists' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /clubs/:id/channels/:channelId — edit a custom channel (MANAGE_CLUB)
router.patch('/:id/channels/:channelId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, channelId } = req.params;
  const { name, description, allowedRoleIds, allowedUserIds } = req.body ?? {};

  try {
    const membership = await getMembershipWithRoles(clubId, userId);
    if (!membership || !hasClubPermission(membership, PERMISSION_MANAGE_CLUB)) {
      res.status(403).json({ error: 'You do not have permission to manage channels' });
      return;
    }

    const existing = await prisma.clubChannel.findFirst({ where: { id: channelId, clubId } });
    if (!existing) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    if (existing.kind !== CHANNEL_CUSTOM) {
      res.status(400).json({ error: 'Built-in channels cannot be edited' });
      return;
    }

    const data: {
      name?: string;
      description?: string | null;
      allowedRoleIds?: string | null;
      allowedUserIds?: string | null;
    } = {};
    if (name !== undefined) {
      const trimmedName = typeof name === 'string' ? name.trim() : '';
      if (!trimmedName || trimmedName.length > MAX_CHANNEL_NAME_LENGTH) {
        res.status(400).json({ error: `name must be 1-${MAX_CHANNEL_NAME_LENGTH} characters` });
        return;
      }
      const moderation = await moderateTextContent([trimmedName]);
      if (moderation) {
        res.status(moderation.status).json({ error: moderation.message });
        return;
      }
      data.name = trimmedName;
    }
    if (description !== undefined) {
      const trimmedDescription = typeof description === 'string' ? description.trim() : '';
      if (trimmedDescription.length > MAX_CHANNEL_DESCRIPTION_LENGTH) {
        res.status(400).json({ error: `description cannot exceed ${MAX_CHANNEL_DESCRIPTION_LENGTH} characters` });
        return;
      }
      data.description = trimmedDescription || null;
    }
    if (allowedRoleIds !== undefined) {
      const targetIds = await parseAndValidateTargetRoleIds(clubId, allowedRoleIds);
      if (targetIds === null) {
        res.status(400).json({ error: 'allowedRoleIds contains invalid roles' });
        return;
      }
      data.allowedRoleIds = targetIds.length ? stringifyStringList(targetIds) : null;
    }
    if (allowedUserIds !== undefined) {
      const targetUserIds = await parseAndValidateTargetUserIds(clubId, allowedUserIds);
      if (targetUserIds === null) {
        res.status(400).json({ error: 'allowedUserIds contains invalid members' });
        return;
      }
      data.allowedUserIds = targetUserIds.length ? stringifyStringList(targetUserIds) : null;
    }

    const channel = await prisma.clubChannel.update({ where: { id: channelId }, data });
    res.json(serializeChannel(channel));
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(400).json({ error: 'A channel with that name already exists' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /clubs/:id/channels/:channelId — delete a custom channel (MANAGE_CLUB)
router.delete('/:id/channels/:channelId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, channelId } = req.params;

  try {
    const membership = await getMembershipWithRoles(clubId, userId);
    if (!membership || !hasClubPermission(membership, PERMISSION_MANAGE_CLUB)) {
      res.status(403).json({ error: 'You do not have permission to manage channels' });
      return;
    }

    const existing = await prisma.clubChannel.findFirst({ where: { id: channelId, clubId } });
    if (!existing) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    if (existing.kind !== CHANNEL_CUSTOM) {
      res.status(400).json({ error: 'Built-in channels cannot be deleted' });
      return;
    }

    await prisma.clubChannel.delete({ where: { id: channelId } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /clubs/:id/channels/:channelId/messages — chat channels only; marks the channel read
router.get('/:id/channels/:channelId/messages', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, channelId } = req.params;

  try {
    const membership = await getMembershipWithRoles(clubId, userId);
    const channel = await prisma.clubChannel.findFirst({ where: { id: channelId, clubId } });
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    if (channel.kind === CHANNEL_ANNOUNCEMENTS) {
      res.status(400).json({ error: 'Use the announcements endpoints for this channel' });
      return;
    }
    const myRoleIds = new Set(membership?.customRoles.map((assignment) => assignment.roleId) ?? []);
    if (!canSeeChannel(channel, membership, myRoleIds)) {
      res.status(403).json({ error: 'You do not have access to this channel' });
      return;
    }

    let messages;
    if (channel.kind === CHANNEL_OFFICERS) {
      messages = await prisma.clubOfficerMessage.findMany({
        where: { clubId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      });
    } else {
      const channelFilter = channel.kind === CHANNEL_GENERAL ? null : channel.id;
      const rows = await prisma.clubMessage.findMany({
        where: { clubId, channelId: channelFilter },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      });
      messages = rows.map((row) => ({ ...row, mentionRoleIds: parseStringList(row.mentionRoleIds) }));
    }

    // Viewing the channel marks it read.
    await prisma.clubChannelReadState.upsert({
      where: { channelId_userId: { channelId: channel.id, userId } },
      update: { lastReadAt: new Date() },
      create: { channelId: channel.id, userId },
    });

    const typing = typingScopeForChannel(channel);
    const typingUserIds = getTypingUserIds(typing.scope, typing.key, userId);
    res.json({ channel: serializeChannel(channel), messages, typingUserIds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/channels/:channelId/messages — send to a chat channel (supports @role pings)
router.post('/:id/channels/:channelId/messages', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, channelId } = req.params;
  const { content, mentionRoleIds } = req.body ?? {};

  const trimmed = typeof content === 'string' ? content.trim() : '';
  if (!trimmed) {
    res.status(400).json({ error: 'content is required' });
    return;
  }
  if (trimmed.length > MAX_CLUB_MESSAGE_LENGTH) {
    res.status(400).json({ error: `Message cannot exceed ${MAX_CLUB_MESSAGE_LENGTH} characters` });
    return;
  }
  const moderation = await moderateTextContent([trimmed], { allowProfanity: true });
  if (moderation) {
    res.status(moderation.status).json({ error: moderation.message });
    return;
  }

  try {
    const membership = await getMembershipWithRoles(clubId, userId);
    const channel = await prisma.clubChannel.findFirst({ where: { id: channelId, clubId } });
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    if (channel.kind === CHANNEL_ANNOUNCEMENTS) {
      res.status(400).json({ error: 'Use the announcements endpoints for this channel' });
      return;
    }
    const myRoleIds = new Set(membership?.customRoles.map((assignment) => assignment.roleId) ?? []);
    if (!membership || !canPostToChannel(channel, membership, myRoleIds)) {
      res.status(403).json({ error: 'You do not have access to this channel' });
      return;
    }

    let pingRoleIds: string[] = [];
    if (mentionRoleIds !== undefined && mentionRoleIds !== null) {
      const validated = await parseAndValidateTargetRoleIds(clubId, mentionRoleIds);
      if (validated === null) {
        res.status(400).json({ error: 'mentionRoleIds contains invalid roles' });
        return;
      }
      if (validated.length > 0 && !canPingRoles(membership)) {
        res.status(403).json({ error: 'Only officers can ping roles' });
        return;
      }
      pingRoleIds = validated;
    }

    let message;
    if (channel.kind === CHANNEL_OFFICERS) {
      message = await prisma.clubOfficerMessage.create({
        data: { clubId, userId, content: trimmed },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });
    } else {
      const created = await prisma.clubMessage.create({
        data: {
          clubId,
          channelId: channel.kind === CHANNEL_GENERAL ? null : channel.id,
          userId,
          content: trimmed,
          mentionRoleIds: pingRoleIds.length ? stringifyStringList(pingRoleIds) : null,
        },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });
      message = { ...created, mentionRoleIds: pingRoleIds };
    }

    // Sending implies the channel is read up to now.
    await prisma.clubChannelReadState.upsert({
      where: { channelId_userId: { channelId: channel.id, userId } },
      update: { lastReadAt: new Date() },
      create: { channelId: channel.id, userId },
    });

    if (pingRoleIds.length > 0) {
      void NotificationService.notifyClubRolePing(clubId, userId, pingRoleIds, channel.name, trimmed);
    }

    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /clubs/:id/channels/:channelId/messages/:messageId — DELETE_MESSAGES permission
router.delete(
  '/:id/channels/:channelId/messages/:messageId',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId, channelId, messageId } = req.params;

    try {
      const membership = await getMembershipWithRoles(clubId, userId);
      if (!membership || !canDeleteMessages(membership)) {
        res.status(403).json({ error: 'You do not have permission to delete messages' });
        return;
      }

      const channel = await prisma.clubChannel.findFirst({ where: { id: channelId, clubId } });
      if (!channel) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }

      if (channel.kind === CHANNEL_OFFICERS) {
        const message = await prisma.clubOfficerMessage.findFirst({ where: { id: messageId, clubId } });
        if (!message) {
          res.status(404).json({ error: 'Message not found' });
          return;
        }
        await prisma.clubOfficerMessage.delete({ where: { id: messageId } });
      } else {
        const channelFilter = channel.kind === CHANNEL_GENERAL ? null : channel.id;
        const message = await prisma.clubMessage.findFirst({
          where: { id: messageId, clubId, channelId: channelFilter },
        });
        if (!message) {
          res.status(404).json({ error: 'Message not found' });
          return;
        }
        await prisma.clubMessage.delete({ where: { id: messageId } });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /clubs/:id/channels/:channelId/typing
router.post('/:id/channels/:channelId/typing', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, channelId } = req.params;

  try {
    const membership = await getMembershipWithRoles(clubId, userId);
    const channel = await prisma.clubChannel.findFirst({ where: { id: channelId, clubId } });
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    const myRoleIds = new Set(membership?.customRoles.map((assignment) => assignment.roleId) ?? []);
    if (!membership || !canPostToChannel(channel, membership, myRoleIds)) {
      res.status(403).json({ error: 'You do not have access to this channel' });
      return;
    }

    const typing = typingScopeForChannel(channel);
    setTyping(typing.scope, typing.key, userId);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/channels/:channelId/read — mark a channel read (incl. announcements)
router.post('/:id/channels/:channelId/read', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, channelId } = req.params;

  try {
    const membership = await getMembershipWithRoles(clubId, userId);
    const channel = await prisma.clubChannel.findFirst({ where: { id: channelId, clubId } });
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    const myRoleIds = new Set(membership?.customRoles.map((assignment) => assignment.roleId) ?? []);
    if (!membership || !canSeeChannel(channel, membership, myRoleIds)) {
      res.status(403).json({ error: 'You do not have access to this channel' });
      return;
    }

    await prisma.clubChannelReadState.upsert({
      where: { channelId_userId: { channelId: channel.id, userId } },
      update: { lastReadAt: new Date() },
      create: { channelId: channel.id, userId },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /clubs/:id/roles — members can list member tags
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

/** Validate optional role color; returns undefined when not provided, null to clear. */
function parseRoleColor(raw: unknown): string | null | undefined | false {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (HEX_COLOR_RE.test(trimmed)) return trimmed;
  const normalized = trimmed.toLowerCase();
  return ROLE_COLORS.has(normalized) ? normalized : false;
}

function roleColorError(): string {
  return 'color must be a named color or #RRGGBB hex value. Named colors: ' + Array.from(ROLE_COLORS).join(', ');
}

// POST /clubs/:id/roles — create a named member tag
router.post('/:id/roles', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const { name, color, isSelfAssignable } = req.body ?? {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  if (!trimmedName) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (trimmedName.length > MAX_ROLE_NAME_LENGTH) {
    res.status(400).json({ error: `name cannot exceed ${MAX_ROLE_NAME_LENGTH} characters` });
    return;
  }
  const parsedColor = parseRoleColor(color);
  if (parsedColor === false) {
    res.status(400).json({ error: roleColorError() });
    return;
  }
  const roleModeration = await moderateTextContent([trimmedName]);
  if (roleModeration) {
    res.status(roleModeration.status).json({ error: roleModeration.message });
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
      data: {
        clubId,
        name: trimmedName,
        createdById: userId,
        color: parsedColor ?? null,
        isSelfAssignable: isSelfAssignable === true,
      },
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

// PATCH /clubs/:id/roles/:roleId — rename / recolor / toggle self-assign on a member tag
router.patch('/:id/roles/:roleId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, roleId } = req.params;
  const { name, color, isSelfAssignable } = req.body ?? {};

  const data: { name?: string; color?: string | null; isSelfAssignable?: boolean } = {};

  if (name !== undefined) {
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (trimmedName.length > MAX_ROLE_NAME_LENGTH) {
      res.status(400).json({ error: `name cannot exceed ${MAX_ROLE_NAME_LENGTH} characters` });
      return;
    }
    const roleModeration = await moderateTextContent([trimmedName]);
    if (roleModeration) {
      res.status(roleModeration.status).json({ error: roleModeration.message });
      return;
    }
    data.name = trimmedName;
  }

  const parsedColor = parseRoleColor(color);
  if (parsedColor === false) {
    res.status(400).json({ error: roleColorError() });
    return;
  }
  if (parsedColor !== undefined) data.color = parsedColor;

  if (isSelfAssignable !== undefined) {
    if (typeof isSelfAssignable !== 'boolean') {
      res.status(400).json({ error: 'isSelfAssignable must be a boolean' });
      return;
    }
    data.isSelfAssignable = isSelfAssignable;
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
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
      data,
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

// POST /clubs/:id/roles/:roleId/self — opt into a self-assignable role
router.post('/:id/roles/:roleId/self', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, roleId } = req.params;

  try {
    const [membership, role] = await Promise.all([
      prisma.clubMember.findUnique({ where: { clubId_userId: { clubId, userId } } }),
      prisma.clubRole.findFirst({ where: { id: roleId, clubId } }),
    ]);
    if (!membership) {
      res.status(403).json({ error: 'You must be a club member' });
      return;
    }
    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    if (!role.isSelfAssignable) {
      res.status(403).json({ error: 'This role is not self-assignable' });
      return;
    }

    await prisma.clubMemberRole
      .create({ data: { clubId, memberId: membership.id, roleId, assignedById: userId } })
      .catch((err: any) => {
        if (err?.code !== 'P2002') throw err; // already assigned → idempotent
      });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /clubs/:id/roles/:roleId/self — leave a self-assignable role
router.delete('/:id/roles/:roleId/self', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, roleId } = req.params;

  try {
    const [membership, role] = await Promise.all([
      prisma.clubMember.findUnique({ where: { clubId_userId: { clubId, userId } } }),
      prisma.clubRole.findFirst({ where: { id: roleId, clubId } }),
    ]);
    if (!membership) {
      res.status(403).json({ error: 'You must be a club member' });
      return;
    }
    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }
    if (!role.isSelfAssignable) {
      res.status(403).json({ error: 'This role is not self-assignable' });
      return;
    }

    await prisma.clubMemberRole.deleteMany({ where: { memberId: membership.id, roleId } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /clubs/:id/roles/:roleId — delete a member tag and its assignments
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

// POST /clubs/:id/roles/:roleId/members/:memberUserId — assign member tag
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

// DELETE /clubs/:id/roles/:roleId/members/:memberUserId — remove member tag
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
    if (club.status !== CLUB_STATUS_ACTIVE) {
      res.status(403).json({ error: 'This club is not accepting members right now.' });
      return;
    }
    // You can only directly join a club you can see; hidden clubs are joined via invite.
    if (!club.isDiscoverable) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }
    // Gated join policies route through request/application/invite flows, not direct join.
    if (club.joinPolicy !== JOIN_OPEN) {
      const message =
        club.joinPolicy === JOIN_APPLICATION
          ? 'This club accepts members by application.'
          : club.joinPolicy === JOIN_REQUEST
            ? 'This club requires officer approval to join.'
            : 'This club is invite-only.';
      res.status(403).json({ error: message, joinPolicy: club.joinPolicy });
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
    await maybeAutoEnableDiscovery(clubId);

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

// PATCH /clubs/:id — update club profile or upload an avatar
router.patch(
  '/:id',
  requireAuth,
  clubAvatarUpload.single('image'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId } = req.params;
    const body = req.body ?? {};
    const hasProfileFields =
      Object.prototype.hasOwnProperty.call(body, 'name') ||
      Object.prototype.hasOwnProperty.call(body, 'description') ||
      Object.prototype.hasOwnProperty.call(body, 'isPublic');

    if (!req.file && !hasProfileFields) {
      res.status(400).json({ error: 'No club updates provided' });
      return;
    }

    const updates: {
      name?: string;
      description?: string;
      isPublic?: boolean;
      avatarUrl?: string;
    } = {};

    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        res.status(400).json({ error: 'name is required' });
        return;
      }
      updates.name = body.name.trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      if (typeof body.description !== 'string' || !body.description.trim()) {
        res.status(400).json({ error: 'description is required' });
        return;
      }
      updates.description = body.description.trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'isPublic')) {
      if (typeof body.isPublic !== 'boolean') {
        res.status(400).json({ error: 'isPublic must be a boolean' });
        return;
      }
      updates.isPublic = body.isPublic;
    }

    const profileModeration = await moderateTextContent([
      updates.name ?? null,
      updates.description ?? null,
    ]);
    if (profileModeration) {
      res.status(profileModeration.status).json({ error: profileModeration.message });
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
        res.status(403).json({ error: 'You do not have permission to update the club' });
        return;
      }

      if (req.file) {
        if (!isSupabaseStorageConfigured() && process.env.NODE_ENV === 'production') {
          res.status(500).json({ error: 'Avatar storage is not configured' });
          return;
        }

        const moderation = await moderateImageContent(req.file.buffer, req.file.mimetype);
        if (moderation) {
          res.status(moderation.status).json({ error: moderation.message });
          return;
        }

        const filename = `${clubId}-${Date.now()}.${clubAvatarExtension(req.file.mimetype)}`;

        if (isSupabaseStorageConfigured()) {
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

          updates.avatarUrl = publicUrlData.publicUrl;
        } else {
          await fs.promises.mkdir(CLUB_AVATAR_UPLOAD_DIR, { recursive: true });
          await fs.promises.writeFile(path.join(CLUB_AVATAR_UPLOAD_DIR, filename), req.file.buffer);
          updates.avatarUrl = `/uploads/club-avatars/${filename}`;
        }
      }

      const updated = await prisma.club.update({
        where: { id: clubId },
        data: updates,
        select: {
          id: true,
          name: true,
          description: true,
          isPublic: true,
          avatarUrl: true,
        },
      });

      if (req.file) {
        await cleanupClubAvatarUrl(club.avatarUrl);
      }

      res.json(updated);
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
    // Hidden clubs are visible only to members; archived clubs are hidden from everyone.
    if ((!club.isDiscoverable && !myMembership) || club.status === CLUB_STATUS_ARCHIVED) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }

    const [followerCount, myFollow] = await Promise.all([
      prisma.clubFollower.count({ where: { clubId } }),
      prisma.clubFollower.findUnique({ where: { clubId_userId: { clubId, userId } } }),
    ]);

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
      officerPermissions: parseStringList(club.officerPermissions),
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
      followerCount,
      isFollower: !!myFollow,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Follow / unfollow (public audience, separate from membership) ──────────────

// POST /clubs/:id/follow
router.post('/:id/follow', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;

  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, isDiscoverable: true, status: true },
    });
    if (!club || club.status === CLUB_STATUS_ARCHIVED || !club.isDiscoverable) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }
    await prisma.clubFollower.upsert({
      where: { clubId_userId: { clubId, userId } },
      create: { clubId, userId },
      update: {},
    });
    const followerCount = await prisma.clubFollower.count({ where: { clubId } });
    res.status(201).json({ ok: true, isFollower: true, followerCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /clubs/:id/follow
router.delete('/:id/follow', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;

  try {
    await prisma.clubFollower.deleteMany({ where: { clubId, userId } });
    const followerCount = await prisma.clubFollower.count({ where: { clubId } });
    res.json({ ok: true, isFollower: false, followerCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Discovery toggle (officer-controlled, eligibility-gated) ───────────────────

// PATCH /clubs/:id/discovery — { isDiscoverable: boolean }
router.patch('/:id/discovery', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const { isDiscoverable } = req.body ?? {};

  if (typeof isDiscoverable !== 'boolean') {
    res.status(400).json({ error: 'isDiscoverable must be a boolean' });
    return;
  }

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership || roleRank(membership.role) < roleRank(ROLE_OFFICER)) {
      res.status(403).json({ error: 'Only officers and admins can change discovery' });
      return;
    }

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, verification: true, status: true, discoverableSince: true },
    });
    if (!club || club.status === CLUB_STATUS_ARCHIVED) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }

    if (isDiscoverable) {
      if (club.status !== CLUB_STATUS_ACTIVE) {
        res.status(403).json({ error: 'A suspended club cannot be made discoverable.' });
        return;
      }
      const eligible = await isEligibleForDiscovery(club);
      if (!eligible) {
        res.status(409).json({
          error: `Your club needs ${CLUB_PUBLISH_THRESHOLD} members or Instagram verification before it can be discoverable.`,
        });
        return;
      }
    }

    const updated = await prisma.club.update({
      where: { id: clubId },
      data: {
        isDiscoverable,
        isPublic: isDiscoverable,
        discoverableSince: isDiscoverable && !club.discoverableSince ? new Date() : undefined,
      },
      select: { isDiscoverable: true },
    });
    res.json({ ok: true, isDiscoverable: updated.isDiscoverable });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Invite links (private-stage growth) ───────────────────────────────────────

// POST /clubs/:id/invites — officer creates a shareable invite link
router.post('/:id/invites', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const { maxUses, expiresInHours } = req.body ?? {};

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership || roleRank(membership.role) < roleRank(ROLE_OFFICER)) {
      res.status(403).json({ error: 'Only officers and admins can create invites' });
      return;
    }

    let maxUsesValue: number | null = null;
    if (maxUses !== undefined && maxUses !== null) {
      if (typeof maxUses !== 'number' || !Number.isInteger(maxUses) || maxUses < 1) {
        res.status(400).json({ error: 'maxUses must be a positive integer' });
        return;
      }
      maxUsesValue = maxUses;
    }

    let expiresAt: Date | null = null;
    if (expiresInHours !== undefined && expiresInHours !== null) {
      if (typeof expiresInHours !== 'number' || expiresInHours <= 0) {
        res.status(400).json({ error: 'expiresInHours must be a positive number' });
        return;
      }
      expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    }

    const invite = await prisma.clubInvite.create({
      data: { clubId, code: generateInviteCode(), createdById: userId, maxUses: maxUsesValue, expiresAt },
    });
    res.status(201).json({
      id: invite.id,
      code: invite.code,
      maxUses: invite.maxUses,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/join/:code — redeem an invite link to become a member
router.post('/join/:code', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { code } = req.params;

  try {
    const invite = await prisma.clubInvite.findUnique({ where: { code } });
    if (!invite) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      res.status(410).json({ error: 'This invite has expired' });
      return;
    }
    if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
      res.status(410).json({ error: 'This invite has reached its use limit' });
      return;
    }

    const club = await prisma.club.findUnique({
      where: { id: invite.clubId },
      select: { id: true, status: true },
    });
    if (!club || club.status === CLUB_STATUS_ARCHIVED) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }

    const existing = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: invite.clubId, userId } },
    });
    if (existing) {
      res.status(200).json({ ok: true, clubId: invite.clubId, alreadyMember: true });
      return;
    }

    await prisma.$transaction([
      prisma.clubMember.create({ data: { clubId: invite.clubId, userId, role: ROLE_MEMBER } }),
      prisma.clubInvite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } }),
    ]);
    await maybeAutoEnableDiscovery(invite.clubId);

    res.status(201).json({ ok: true, clubId: invite.clubId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Verification claims (Instagram / official email) ──────────────────────────

// POST /clubs/:id/claims — an officer starts verification for the club
router.post('/:id/claims', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const body = req.body ?? {};
  const method = typeof body.method === 'string' ? body.method.trim().toUpperCase() : '';

  try {
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership || roleRank(membership.role) < roleRank(ROLE_OFFICER)) {
      res.status(403).json({ error: 'Only officers and admins can verify a club' });
      return;
    }

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, status: true, verification: true },
    });
    if (!club || club.status === CLUB_STATUS_ARCHIVED) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }
    if (club.verification === VERIFICATION_VERIFIED) {
      res.status(409).json({ error: 'This club is already verified.' });
      return;
    }

    // Resolve the handle/email being claimed.
    let handleOrEmail: string;
    if (method === CLAIM_METHOD_INSTAGRAM) {
      const handle = typeof body.handle === 'string' ? normalizeInstagramHandle(body.handle) : '';
      if (!handle || handle.length < 2) {
        res.status(400).json({ error: 'A valid Instagram handle is required' });
        return;
      }
      handleOrEmail = handle;
    } else if (method === CLAIM_METHOD_EMAIL) {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!EMAIL_REGEX.test(email)) {
        res.status(400).json({ error: 'A valid official email is required' });
        return;
      }
      handleOrEmail = email;
    } else {
      res.status(400).json({ error: 'method must be INSTAGRAM or OFFICIAL_EMAIL' });
      return;
    }

    const challengeCode = generateChallengeCode();
    const expiresAt = new Date(Date.now() + CLAIM_EXPIRY_HOURS * 60 * 60 * 1000);

    const claim = await prisma.$transaction(async (tx) => {
      // Supersede any still-open claims for this club.
      await tx.clubClaim.updateMany({
        where: { clubId, status: { in: [CLAIM_STATUS_PENDING, CLAIM_STATUS_PROOF_SENT] } },
        data: { status: 'EXPIRED', resolvedAt: new Date() },
      });
      const created = await tx.clubClaim.create({
        data: {
          clubId,
          userId,
          method,
          handleOrEmail,
          challengeCode,
          status: CLAIM_STATUS_PENDING,
          expiresAt,
        },
      });
      await tx.club.update({ where: { id: clubId }, data: { verification: VERIFICATION_PENDING } });
      return created;
    });

    const instructions =
      method === CLAIM_METHOD_INSTAGRAM
        ? `DM this exact code to @oval from @${handleOrEmail} on Instagram, then tap "I've sent it".`
        : `We will review the code sent from ${handleOrEmail}.`;

    res.status(201).json({
      id: claim.id,
      method: claim.method,
      handleOrEmail: claim.handleOrEmail,
      challengeCode: claim.challengeCode,
      status: claim.status,
      expiresAt: claim.expiresAt,
      instructions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/claims/:claimId/sent — officer confirms they sent the code
router.post(
  '/:id/claims/:claimId/sent',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId, claimId } = req.params;

    try {
      const membership = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId } },
      });
      if (!membership || roleRank(membership.role) < roleRank(ROLE_OFFICER)) {
        res.status(403).json({ error: 'Only officers and admins can verify a club' });
        return;
      }

      const claim = await prisma.clubClaim.findFirst({ where: { id: claimId, clubId } });
      if (!claim) {
        res.status(404).json({ error: 'Claim not found' });
        return;
      }
      if (claim.status === CLAIM_STATUS_PROOF_SENT) {
        res.json({ ok: true, status: claim.status });
        return;
      }
      if (claim.status !== CLAIM_STATUS_PENDING) {
        res.status(409).json({ error: 'This claim can no longer be updated.' });
        return;
      }
      if (claim.expiresAt < new Date()) {
        await prisma.clubClaim.update({
          where: { id: claim.id },
          data: { status: 'EXPIRED', resolvedAt: new Date() },
        });
        res.status(410).json({ error: 'This verification code has expired. Start again.' });
        return;
      }

      await prisma.clubClaim.update({
        where: { id: claim.id },
        data: { status: CLAIM_STATUS_PROOF_SENT },
      });
      res.json({ ok: true, status: CLAIM_STATUS_PROOF_SENT });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── Club applications (joinPolicy = APPLICATION) ──────────────────────────────

// POST /clubs/:id/application-cycles — officer opens a new application cycle
router.post('/:id/application-cycles', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  const body = req.body ?? {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const questions: string[] = Array.isArray(body.questions)
    ? body.questions
        .map((q: unknown) => (typeof q === 'string' ? q.trim() : ''))
        .filter((q: string) => q.length > 0)
    : [];

  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  if (!questions.length) {
    res.status(400).json({ error: 'Add at least one application question' });
    return;
  }

  try {
    if (!(await getOfficerMembership(clubId, userId))) {
      res.status(403).json({ error: 'Only officers and admins can manage applications' });
      return;
    }
    const cycle = await prisma.$transaction(async (tx) => {
      // Only one open cycle at a time.
      await tx.clubApplicationCycle.updateMany({
        where: { clubId, status: CYCLE_STATUS_OPEN },
        data: { status: CYCLE_STATUS_CLOSED },
      });
      const created = await tx.clubApplicationCycle.create({
        data: {
          clubId,
          title,
          questionsJson: JSON.stringify(questions),
          status: CYCLE_STATUS_OPEN,
          opensAt: new Date(),
        },
      });
      await tx.club.update({ where: { id: clubId }, data: { joinPolicy: JOIN_APPLICATION } });
      return created;
    });
    res.status(201).json(serializeCycle(cycle, 0));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /clubs/:id/application-cycles/:cycleId — officer edits/opens/closes a cycle
router.patch('/:id/application-cycles/:cycleId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, cycleId } = req.params;
  const body = req.body ?? {};

  try {
    if (!(await getOfficerMembership(clubId, userId))) {
      res.status(403).json({ error: 'Only officers and admins can manage applications' });
      return;
    }
    const cycle = await prisma.clubApplicationCycle.findFirst({ where: { id: cycleId, clubId } });
    if (!cycle) {
      res.status(404).json({ error: 'Application cycle not found' });
      return;
    }

    const data: { title?: string; questionsJson?: string; status?: string } = {};
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if (Array.isArray(body.questions)) {
      const qs = body.questions
        .map((q: unknown) => (typeof q === 'string' ? q.trim() : ''))
        .filter((q: string) => q.length > 0);
      if (qs.length) data.questionsJson = JSON.stringify(qs);
    }
    let reopen = false;
    if (typeof body.status === 'string') {
      const status = body.status.toUpperCase();
      if (status !== CYCLE_STATUS_OPEN && status !== CYCLE_STATUS_CLOSED) {
        res.status(400).json({ error: 'status must be OPEN or CLOSED' });
        return;
      }
      data.status = status;
      reopen = status === CYCLE_STATUS_OPEN;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (reopen) {
        await tx.clubApplicationCycle.updateMany({
          where: { clubId, status: CYCLE_STATUS_OPEN, id: { not: cycleId } },
          data: { status: CYCLE_STATUS_CLOSED },
        });
      }
      return tx.clubApplicationCycle.update({ where: { id: cycleId }, data });
    });
    const count = await prisma.clubApplication.count({ where: { cycleId } });
    res.json(serializeCycle(updated, count));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /clubs/:id/application-cycles — officer lists cycles with applicant counts
router.get('/:id/application-cycles', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  try {
    if (!(await getOfficerMembership(clubId, userId))) {
      res.status(403).json({ error: 'Only officers and admins can manage applications' });
      return;
    }
    const cycles = await prisma.clubApplicationCycle.findMany({
      where: { clubId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    });
    res.json(cycles.map((c) => serializeCycle(c, c._count.applications)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /clubs/:id/apply — applicant view: the open cycle + my application
router.get('/:id/apply', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId } = req.params;
  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, status: true, joinPolicy: true },
    });
    if (!club || club.status === CLUB_STATUS_ARCHIVED) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }
    const openCycle = await prisma.clubApplicationCycle.findFirst({
      where: { clubId, status: CYCLE_STATUS_OPEN },
      orderBy: { createdAt: 'desc' },
    });
    const [myApplication, membership] = await Promise.all([
      openCycle
        ? prisma.clubApplication.findUnique({
            where: { cycleId_userId: { cycleId: openCycle.id, userId } },
          })
        : Promise.resolve(null),
      prisma.clubMember.findUnique({ where: { clubId_userId: { clubId, userId } } }),
    ]);
    res.json({
      joinPolicy: club.joinPolicy,
      isMember: !!membership,
      openCycle: openCycle ? serializeCycle(openCycle, 0) : null,
      myApplication: myApplication ? { id: myApplication.id, stage: myApplication.stage } : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clubs/:id/application-cycles/:cycleId/apply — submit an application
router.post(
  '/:id/application-cycles/:cycleId/apply',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId, cycleId } = req.params;
    const body = req.body ?? {};
    const answers: string[] | null = Array.isArray(body.answers)
      ? body.answers.map((a: unknown) => (typeof a === 'string' ? a : ''))
      : null;
    if (!answers) {
      res.status(400).json({ error: 'answers are required' });
      return;
    }

    try {
      const cycle = await prisma.clubApplicationCycle.findFirst({ where: { id: cycleId, clubId } });
      if (!cycle) {
        res.status(404).json({ error: 'Application cycle not found' });
        return;
      }
      if (cycle.status !== CYCLE_STATUS_OPEN) {
        res.status(409).json({ error: 'Applications are closed.' });
        return;
      }
      const member = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId } },
      });
      if (member) {
        res.status(400).json({ error: 'You are already a member of this club.' });
        return;
      }
      const existing = await prisma.clubApplication.findUnique({
        where: { cycleId_userId: { cycleId, userId } },
      });
      if (existing) {
        res.status(409).json({ error: 'You have already applied.', stage: existing.stage });
        return;
      }
      const application = await prisma.clubApplication.create({
        data: { cycleId, userId, answersJson: JSON.stringify(answers), stage: APP_STAGE_APPLIED },
      });
      res.status(201).json({ id: application.id, stage: application.stage });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /clubs/:id/application-cycles/:cycleId/applications — officer applicant pipeline
router.get(
  '/:id/application-cycles/:cycleId/applications',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { id: clubId, cycleId } = req.params;
    try {
      if (!(await getOfficerMembership(clubId, userId))) {
        res.status(403).json({ error: 'Only officers and admins can manage applications' });
        return;
      }
      const cycle = await prisma.clubApplicationCycle.findFirst({ where: { id: cycleId, clubId } });
      if (!cycle) {
        res.status(404).json({ error: 'Application cycle not found' });
        return;
      }
      const apps = await prisma.clubApplication.findMany({
        where: { cycleId },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: APPLICANT_SELECT } },
      });
      res.json({
        cycle: serializeCycle(cycle, apps.length),
        applications: apps.map((a) => ({
          id: a.id,
          stage: a.stage,
          reviewNote: a.reviewNote,
          createdAt: a.createdAt,
          answers: parseJsonStringArray(a.answersJson),
          user: a.user,
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /clubs/:id/applications/:applicationId — officer moves stage (accept -> member)
router.patch('/:id/applications/:applicationId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id: clubId, applicationId } = req.params;
  const body = req.body ?? {};
  const stage = typeof body.stage === 'string' ? body.stage.toUpperCase() : '';
  const reviewNote =
    typeof body.reviewNote === 'string' ? body.reviewNote.trim().slice(0, 500) || null : undefined;

  if (!APP_STAGES.has(stage)) {
    res.status(400).json({ error: 'Invalid application stage' });
    return;
  }

  try {
    if (!(await getOfficerMembership(clubId, userId))) {
      res.status(403).json({ error: 'Only officers and admins can manage applications' });
      return;
    }
    const application = await prisma.clubApplication.findFirst({
      where: { id: applicationId, cycle: { clubId } },
    });
    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.clubApplication.update({
        where: { id: application.id },
        data: { stage, ...(reviewNote !== undefined ? { reviewNote } : {}) },
      });
      if (stage === APP_STAGE_ACCEPTED) {
        const existing = await tx.clubMember.findUnique({
          where: { clubId_userId: { clubId, userId: application.userId } },
        });
        if (!existing) {
          await tx.clubMember.create({
            data: { clubId, userId: application.userId, role: ROLE_MEMBER },
          });
        }
      }
    });
    if (stage === APP_STAGE_ACCEPTED) await maybeAutoEnableDiscovery(clubId);

    res.json({ ok: true, stage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
