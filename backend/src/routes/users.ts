import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { requireAuth, requireVerifiedAuth, AuthRequest } from '../middleware/auth';
import { isSupabaseStorageConfigured, supabaseStorage } from '../lib/supabaseStorage';
import { USER_AVATAR_BUCKET, UPLOAD_DIR, cleanupAvatarUrl } from '../lib/avatarStorage';
import { deleteUserAccount } from '../lib/accountDeletion';
import { getBlockedUserIds } from '../lib/blocks';
import { areFriends, normalizeUserPair } from '../lib/friendUtils';
import {
  cancelPendingRequestsBetween,
  removeFriendshipIfExists,
} from '../services/friendService';
import { INTEREST_TAG_SET } from '../config/interestTags';
import { getFullName, getPublicName, withDisplayName } from '../lib/userNames';
import { moderateImageContent, moderateTextContent } from '../lib/contentModeration';
import { isPlatformAdmin } from '../middleware/admin';

const VALID_CLASS_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad'] as const;
const MAJOR_REGEX = /^[a-zA-Z\s&\/\-,\.\(\)]+$/;
const INSTAGRAM_REGEX = /^[a-zA-Z0-9._]{1,30}$/;
const CLUB_REGEX = /^[a-zA-Z\s&\-]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_NOTIFICATION_PREFERENCES = {
  podJoin: true,
  newMessage: true,
  meetupReminder: true,
  recapPrompt: true,
  waitlistSpot: true,
  clubMeetingCreated: true,
  clubAnnouncementCreated: true,
  clubKick: true,
  clubRoleChange: true,
  clubAttendanceOpen: true,
  weeklyRecap: true,
  demandAlerts: true,
};

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function parseNotificationPreferences(raw: string | null | undefined) {
  if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

const router = Router();

// ── Avatar upload setup ────────────────────────────────────────────────────────
// (bucket constants + cleanup helpers live in lib/avatarStorage.ts)

function avatarExtension(mimetype: string): string {
  if (mimetype === 'image/png') return 'png';
  if (mimetype === 'image/webp') return 'webp';
  return 'jpg';
}

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
      return;
    }
    cb(null, true);
  },
});

// ── GET /users/me — own full profile ─────────────────────────────────────────

router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      id: user.id,
      name: getFullName(user),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      verifiedUniversity: user.verifiedUniversity,
      isAdmin: isPlatformAdmin(user.id),
      avatarUrl: user.avatarUrl ?? null,
      joinedAt: user.createdAt.toISOString(),
      classYear: user.classYear ?? null,
      major: user.major ?? null,
      bio: user.bio ?? null,
      clubs: parseJsonArray(user.clubs),
      instagramHandle: user.instagramHandle ?? null,
      interestTags: parseJsonArray(user.interestTags),
      purpose: user.purpose ?? null,
      campusZones: parseJsonArray(user.campusZones),
      clubInterests: user.clubInterests ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /users/me — update profile fields ───────────────────────────────────

router.patch('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { classYear, major, bio, clubs, instagramHandle, interestTags, purpose, campusZones, clubInterests } =
    req.body ?? {};

  const updateData: Record<string, unknown> = {};

  if (classYear !== undefined) {
    if (typeof classYear !== 'string' || !(VALID_CLASS_YEARS as readonly string[]).includes(classYear)) {
      res.status(400).json({ error: 'classYear must be one of: Freshman, Sophomore, Junior, Senior, Grad' });
      return;
    }
    updateData.classYear = classYear;
  }

  if (major !== undefined) {
    if (typeof major !== 'string') {
      res.status(400).json({ error: 'major must be a string' });
      return;
    }
    const trimmed = major.trim();
    if (trimmed.length < 2) {
      res.status(400).json({ error: 'Major must be at least 2 characters' });
      return;
    }
    if (trimmed.length > 60) {
      res.status(400).json({ error: 'Major must be 60 characters or fewer' });
      return;
    }
    if (!MAJOR_REGEX.test(trimmed)) {
      res.status(400).json({ error: 'Major can only contain letters, spaces, and common punctuation (&, /, -, comma, period)' });
      return;
    }
    updateData.major = trimmed;
  }

  if (bio !== undefined) {
    if (bio !== null && typeof bio !== 'string') {
      res.status(400).json({ error: 'bio must be a string or null' });
      return;
    }
    const trimmed = bio === null ? null : bio.trim();
    if (trimmed !== null && trimmed.length > 120) {
      res.status(400).json({ error: 'Bio must be 120 characters or fewer' });
      return;
    }
    updateData.bio = trimmed || null;
  }

  if (clubs !== undefined) {
    if (!Array.isArray(clubs)) {
      res.status(400).json({ error: 'clubs must be an array' });
      return;
    }
    if (clubs.length > 5) {
      res.status(400).json({ error: 'You can add up to 5 clubs' });
      return;
    }
    for (const club of clubs) {
      if (typeof club !== 'string') {
        res.status(400).json({ error: 'Each club must be a string' });
        return;
      }
      const t = club.trim();
      if (t.length < 2 || t.length > 50) {
        res.status(400).json({ error: 'Each club must be 2–50 characters' });
        return;
      }
      if (!CLUB_REGEX.test(t)) {
        res.status(400).json({ error: 'Club names can only contain letters, spaces, &, and hyphens' });
        return;
      }
    }
    updateData.clubs = JSON.stringify(clubs.map((c: string) => c.trim()));
  }

  const moderation = await moderateTextContent([
    typeof bio === 'string' ? bio : null,
    typeof major === 'string' ? major : null,
    typeof purpose === 'string' ? purpose : null,
    typeof clubInterests === 'string' ? clubInterests : null,
    ...(Array.isArray(campusZones)
      ? campusZones.filter((zone): zone is string => typeof zone === 'string')
      : []),
    ...(Array.isArray(clubs) ? clubs.filter((club): club is string => typeof club === 'string') : []),
  ]);
  if (moderation) {
    res.status(moderation.status).json({ error: moderation.message });
    return;
  }

  if (instagramHandle !== undefined) {
    if (instagramHandle !== null && typeof instagramHandle !== 'string') {
      res.status(400).json({ error: 'instagramHandle must be a string or null' });
      return;
    }
    if (instagramHandle !== null) {
      // Strip leading @ if present
      const stripped = instagramHandle.replace(/^@/, '').trim();
      if (!INSTAGRAM_REGEX.test(stripped)) {
        res.status(400).json({ error: 'Invalid Instagram handle (letters, numbers, periods, underscores only, max 30 chars)' });
        return;
      }
      updateData.instagramHandle = stripped;
    } else {
      updateData.instagramHandle = null;
    }
  }

  if (interestTags !== undefined) {
    if (!Array.isArray(interestTags)) {
      res.status(400).json({ error: 'interestTags must be an array' });
      return;
    }
    if (interestTags.length > 5) {
      res.status(400).json({ error: 'You can select up to 5 interest tags' });
      return;
    }
    for (const tag of interestTags) {
      if (typeof tag !== 'string' || !INTEREST_TAG_SET.has(tag)) {
        res.status(400).json({ error: `Invalid interest tag: ${tag}` });
        return;
      }
    }
    updateData.interestTags = JSON.stringify(interestTags);
  }

  if (purpose !== undefined) {
    if (purpose !== null && typeof purpose !== 'string') {
      res.status(400).json({ error: 'purpose must be a string or null' });
      return;
    }
    const trimmed = purpose === null ? null : purpose.trim();
    if (trimmed !== null && trimmed.length > 40) {
      res.status(400).json({ error: 'purpose must be 40 characters or fewer' });
      return;
    }
    updateData.purpose = trimmed || null;
  }

  if (campusZones !== undefined) {
    if (!Array.isArray(campusZones)) {
      res.status(400).json({ error: 'campusZones must be an array' });
      return;
    }
    if (campusZones.length > 3) {
      res.status(400).json({ error: 'You can pick up to 3 campus zones' });
      return;
    }
    for (const zone of campusZones) {
      if (typeof zone !== 'string' || zone.trim().length < 2 || zone.trim().length > 40) {
        res.status(400).json({ error: 'Each campus zone must be 2–40 characters' });
        return;
      }
    }
    updateData.campusZones = JSON.stringify(campusZones.map((z: string) => z.trim()));
  }

  if (clubInterests !== undefined) {
    if (clubInterests !== null && typeof clubInterests !== 'string') {
      res.status(400).json({ error: 'clubInterests must be a string or null' });
      return;
    }
    const trimmed = clubInterests === null ? null : clubInterests.trim();
    if (trimmed !== null && trimmed.length > 120) {
      res.status(400).json({ error: 'clubInterests must be 120 characters or fewer' });
      return;
    }
    updateData.clubInterests = trimmed || null;
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: 'No valid fields provided' });
    return;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
    res.json({
      id: updated.id,
      name: getFullName(updated),
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      verifiedUniversity: updated.verifiedUniversity,
      isAdmin: isPlatformAdmin(updated.id),
      avatarUrl: updated.avatarUrl ?? null,
      joinedAt: updated.createdAt.toISOString(),
      classYear: updated.classYear ?? null,
      major: updated.major ?? null,
      bio: updated.bio ?? null,
      clubs: parseJsonArray(updated.clubs),
      instagramHandle: updated.instagramHandle ?? null,
      interestTags: parseJsonArray(updated.interestTags),
      purpose: updated.purpose ?? null,
      campusZones: parseJsonArray(updated.campusZones),
      clubInterests: updated.clubInterests ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /users/me/avatar — upload profile picture ───────────────────────────

router.patch(
  '/me/avatar',
  requireAuth,
  avatarUpload.single('avatar'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const moderation = await moderateImageContent(req.file.buffer, req.file.mimetype);
    if (moderation) {
      res.status(moderation.status).json({ error: moderation.message });
      return;
    }

    try {
      const existing = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });

      const filename = `${userId}-${Date.now()}.${avatarExtension(req.file.mimetype)}`;
      let avatarUrl: string;

      if (isSupabaseStorageConfigured()) {
        const { error: uploadError } = await supabaseStorage.storage
          .from(USER_AVATAR_BUCKET)
          .upload(filename, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true,
          });

        if (uploadError) {
          res.status(500).json({ error: 'Failed to upload avatar' });
          return;
        }

        const { data: publicUrlData } = supabaseStorage.storage
          .from(USER_AVATAR_BUCKET)
          .getPublicUrl(filename);
        avatarUrl = publicUrlData.publicUrl;
      } else {
        if (process.env.NODE_ENV === 'production') {
          res.status(500).json({ error: 'Avatar storage is not configured' });
          return;
        }

        await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
        await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), req.file.buffer);
        avatarUrl = `/uploads/avatars/${filename}`;
      }

      await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
      await cleanupAvatarUrl(existing?.avatarUrl);
      res.json({ avatarUrl });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── DELETE /users/me/avatar — remove profile picture ──────────────────────────

router.delete('/me/avatar', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    await cleanupAvatarUrl(existing?.avatarUrl);
    res.json({ avatarUrl: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /users/me/export — portable account data export ──────────────────────

router.get('/me/export', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
        verifiedUniversity: true,
        avatarUrl: true,
        classYear: true,
        major: true,
        bio: true,
        clubs: true,
        instagramHandle: true,
        interestTags: true,
        purpose: true,
        campusZones: true,
        clubInterests: true,
        notificationPreferences: true,
        pushToken: true,
        accountStatus: true,
        termsVersion: true,
        termsAcceptedAt: true,
        ageAttestedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const [
      podMemberships,
      createdPods,
      podMessages,
      directMessages,
      clubMemberships,
      clubMeetingsCreated,
      clubMeetingRsvps,
      clubAnnouncements,
      clubMessages,
      clubOfficerMessages,
      friendRequests,
      friendships,
      blocks,
      reports,
      noShowReports,
      recaps,
      waitlistEntries,
      podInvites,
      analyticsEvents,
    ] = await Promise.all([
      prisma.podMember.findMany({
        where: { userId },
        include: {
          pod: {
            select: {
              id: true,
              meetupTime: true,
              location: true,
              locationType: true,
              status: true,
              createdAt: true,
              activity: { select: { id: true, title: true, category: true } },
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      }),
      prisma.pod.findMany({
        where: { creatorId: userId },
        select: {
          id: true,
          activityId: true,
          meetupTime: true,
          location: true,
          locationType: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.message.findMany({
        where: { userId },
        select: { id: true, podId: true, content: true, replyToId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.directMessage.findMany({
        where: { senderId: userId },
        select: { id: true, threadId: true, content: true, replyToId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.clubMember.findMany({
        where: { userId },
        include: {
          club: {
            select: {
              id: true,
              name: true,
              category: true,
              university: true,
              isPublic: true,
              createdAt: true,
            },
          },
          customRoles: { include: { role: true } },
        },
        orderBy: { joinedAt: 'asc' },
      }),
      prisma.clubMeeting.findMany({
        where: { createdById: userId },
        select: {
          id: true,
          clubId: true,
          title: true,
          description: true,
          location: true,
          meetingTime: true,
          visibility: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.clubMeetingAttendee.findMany({
        where: { userId },
        include: {
          meeting: {
            select: { id: true, clubId: true, title: true, meetingTime: true, location: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.clubAnnouncement.findMany({
        where: { userId },
        select: {
          id: true,
          clubId: true,
          content: true,
          visibility: true,
          targetRoleIds: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.clubMessage.findMany({
        where: { userId },
        select: { id: true, clubId: true, content: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.clubOfficerMessage.findMany({
        where: { userId },
        select: { id: true, clubId: true, content: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.friendRequest.findMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
        select: {
          id: true,
          senderId: true,
          receiverId: true,
          status: true,
          createdAt: true,
          respondedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.friendship.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.block.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.report.findMany({
        where: { reporterId: userId },
        select: {
          id: true,
          targetUserId: true,
          podId: true,
          messageId: true,
          directMessageId: true,
          clubId: true,
          clubMessageId: true,
          clubOfficerMessageId: true,
          clubAnnouncementId: true,
          targetType: true,
          reason: true,
          severity: true,
          details: true,
          reportedContent: true,
          status: true,
          contentRemovedAt: true,
          accountAction: true,
          accountActionAt: true,
          createdAt: true,
          resolvedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.noShowReport.findMany({
        where: { OR: [{ reporterId: userId }, { targetUserId: userId }] },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.podRecap.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.podWaitlist.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.podInvite.findMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.analyticsEvent.findMany({
        where: { userId },
        select: { id: true, name: true, properties: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    res.json({
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        name: getFullName(user),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        createdAt: user.createdAt,
        verifiedUniversity: user.verifiedUniversity,
        accountStatus: user.accountStatus,
        termsVersion: user.termsVersion,
        termsAcceptedAt: user.termsAcceptedAt,
        ageAttestedAt: user.ageAttestedAt,
        pushNotificationsEnabled: Boolean(user.pushToken),
      },
      profile: {
        avatarUrl: user.avatarUrl,
        classYear: user.classYear,
        major: user.major,
        bio: user.bio,
        clubs: parseJsonArray(user.clubs),
        instagramHandle: user.instagramHandle,
        interestTags: parseJsonArray(user.interestTags),
        purpose: user.purpose,
        campusZones: parseJsonArray(user.campusZones),
        clubInterests: user.clubInterests,
      },
      notificationPreferences: parseNotificationPreferences(user.notificationPreferences),
      podMemberships,
      createdPods,
      podMessages,
      directMessages,
      clubMemberships,
      clubMeetingsCreated,
      clubMeetingRsvps,
      clubAnnouncements,
      clubMessages,
      clubOfficerMessages,
      friendRequests,
      friendships,
      blocks,
      reports,
      noShowReports,
      recaps,
      waitlistEntries,
      podInvites,
      analyticsEvents,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /users/me — in-app account deletion ────────────────────────────────

router.delete('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  try {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true, password: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (!password) {
      res.status(400).json({ error: 'Password is required to delete your account' });
      return;
    }
    const passwordValid = await bcrypt.compare(password, existing.password);
    if (!passwordValid) {
      res.status(403).json({ error: 'Incorrect password' });
      return;
    }

    await deleteUserAccount(userId);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /users/push-token ─────────────────────────────────────────────────────

router.post('/push-token', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'token is required' });
    return;
  }

  try {
    await prisma.user.update({ where: { id: userId }, data: { pushToken: token } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/notifications — get current notification preferences
// NOTE: must be defined before GET /users/:id to avoid being shadowed
router.get('/notifications', requireVerifiedAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const prefs = parseNotificationPreferences(user?.notificationPreferences);
    res.json({ preferences: prefs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /users/notifications — update notification preferences
router.patch('/notifications', requireVerifiedAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const {
    podJoin,
    newMessage,
    meetupReminder,
    recapPrompt,
    waitlistSpot,
    clubMeetingCreated,
    clubAnnouncementCreated,
    clubKick,
    clubRoleChange,
    clubAttendanceOpen,
    weeklyRecap,
    demandAlerts,
  } = req.body;

  if (
    (podJoin !== undefined && typeof podJoin !== 'boolean') ||
    (newMessage !== undefined && typeof newMessage !== 'boolean') ||
    (meetupReminder !== undefined && typeof meetupReminder !== 'boolean') ||
    (recapPrompt !== undefined && typeof recapPrompt !== 'boolean') ||
    (waitlistSpot !== undefined && typeof waitlistSpot !== 'boolean') ||
    (clubMeetingCreated !== undefined && typeof clubMeetingCreated !== 'boolean') ||
    (clubAnnouncementCreated !== undefined && typeof clubAnnouncementCreated !== 'boolean') ||
    (clubKick !== undefined && typeof clubKick !== 'boolean') ||
    (clubRoleChange !== undefined && typeof clubRoleChange !== 'boolean') ||
    (clubAttendanceOpen !== undefined && typeof clubAttendanceOpen !== 'boolean') ||
    (weeklyRecap !== undefined && typeof weeklyRecap !== 'boolean') ||
    (demandAlerts !== undefined && typeof demandAlerts !== 'boolean')
  ) {
    res.status(400).json({ error: 'Preference values must be booleans' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const current = user?.notificationPreferences
      ? (() => {
          try { return JSON.parse(user.notificationPreferences); } catch { return {}; }
        })()
      : {};
    const updated = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...current,
      ...(podJoin !== undefined && { podJoin }),
      ...(newMessage !== undefined && { newMessage }),
      ...(meetupReminder !== undefined && { meetupReminder }),
      ...(recapPrompt !== undefined && { recapPrompt }),
      ...(waitlistSpot !== undefined && { waitlistSpot }),
      ...(clubMeetingCreated !== undefined && { clubMeetingCreated }),
      ...(clubAnnouncementCreated !== undefined && { clubAnnouncementCreated }),
      ...(clubKick !== undefined && { clubKick }),
      ...(clubRoleChange !== undefined && { clubRoleChange }),
      ...(clubAttendanceOpen !== undefined && { clubAttendanceOpen }),
      ...(weeklyRecap !== undefined && { weeklyRecap }),
      ...(demandAlerts !== undefined && { demandAlerts }),
    };

    await prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: JSON.stringify(updated) },
    });

    res.json({ preferences: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/discover — suggested students ranked by shared interests and
// mutual friends. Existing friends, pending requests, blocks, and self are
// excluded so every row can truthfully offer an Add action.
router.get('/discover', requireVerifiedAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const [viewer, blockedIds, friendships, pendingRequests] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { interestTags: true },
      }),
      getBlockedUserIds(userId),
      prisma.friendship.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        select: { userAId: true, userBId: true },
      }),
      prisma.friendRequest.findMany({
        where: {
          status: 'PENDING',
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
        select: { senderId: true, receiverId: true },
      }),
    ]);

    const friendIds = new Set(
      friendships.map((row) => (row.userAId === userId ? row.userBId : row.userAId)),
    );
    const pendingIds = new Set(
      pendingRequests.map((row) => (row.senderId === userId ? row.receiverId : row.senderId)),
    );
    const excludedIds = new Set([userId, ...blockedIds, ...friendIds, ...pendingIds]);
    const viewerInterests = new Set(parseJsonArray(viewer?.interestTags));

    const candidates = await prisma.user.findMany({
      where: {
        id: { notIn: [...excludedIds] },
        accountStatus: 'ACTIVE',
        verifiedUniversity: true,
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        verifiedUniversity: true,
        classYear: true,
        major: true,
        interestTags: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });

    const candidateIds = candidates.map((candidate) => candidate.id);
    const candidateFriendships = candidateIds.length
      ? await prisma.friendship.findMany({
          where: {
            OR: [{ userAId: { in: candidateIds } }, { userBId: { in: candidateIds } }],
          },
          select: { userAId: true, userBId: true },
        })
      : [];

    const candidateFriendIds = new Map<string, Set<string>>();
    for (const row of candidateFriendships) {
      if (candidateIds.includes(row.userAId)) {
        const ids = candidateFriendIds.get(row.userAId) ?? new Set<string>();
        ids.add(row.userBId);
        candidateFriendIds.set(row.userAId, ids);
      }
      if (candidateIds.includes(row.userBId)) {
        const ids = candidateFriendIds.get(row.userBId) ?? new Set<string>();
        ids.add(row.userAId);
        candidateFriendIds.set(row.userBId, ids);
      }
    }

    const suggestions = candidates
      .map((candidate) => {
        const sharedInterests = parseJsonArray(candidate.interestTags).filter((tag) =>
          viewerInterests.has(tag),
        );
        const mutualFriendCount = [...(candidateFriendIds.get(candidate.id) ?? [])].filter((id) =>
          friendIds.has(id),
        ).length;
        return {
          ...withDisplayName(candidate, 'full'),
          interestTags: undefined,
          createdAt: undefined,
          sharedInterests,
          mutualFriendCount,
        };
      })
      .sort(
        (a, b) =>
          b.sharedInterests.length - a.sharedInterests.length ||
          b.mutualFriendCount - a.mutualFriendCount,
      )
      .slice(0, 20);

    res.json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/search?q= — search users by name
// NOTE: defined before /:id to avoid route conflict
router.get('/search', requireVerifiedAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (!q) {
    res.json([]);
    return;
  }

  try {
    const blockedIds = await getBlockedUserIds(userId);
    const excluded = new Set([...blockedIds, userId]);

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
        id: { notIn: [...excluded] },
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        verifiedUniversity: true,
        classYear: true,
        major: true,
      },
      take: 20,
    });

    res.json(users.map((user) => withDisplayName(user, 'full')));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/blocked — list users blocked by the current user
router.get('/blocked', requireVerifiedAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const blocks = await prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            classYear: true,
            major: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(blocks.map((b) => ({ ...withDisplayName(b.blocked, 'full'), blockedAt: b.createdAt })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/:id/public — minimal profile for shared web links.
// This intentionally stays separate from the authenticated profile response below:
// the landing page only needs enough information to identify the person safely.
router.get('/:id/public', async (req, res: Response): Promise<void> => {
  const targetId = req.params.id;
  if (!UUID_REGEX.test(targetId)) {
    res.status(400).json({ error: 'Invalid user ID' });
    return;
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        id: targetId,
        accountStatus: 'ACTIVE',
        verifiedUniversity: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        avatarUrl: true,
        classYear: true,
        major: true,
        bio: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json({
      id: user.id,
      name: getPublicName(user),
      avatarUrl: user.avatarUrl ?? null,
      classYear: user.classYear ?? null,
      major: user.major ?? null,
      bio: user.bio ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/:id — public profile
router.get('/:id', requireVerifiedAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const targetId = req.params.id;

  try {
    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isSelf = req.user!.userId === targetId;
    const isFriend = isSelf ? true : await areFriends(req.user!.userId, targetId);

    // podsJoined counts every membership the user ever took, whatever the pod's
    // fate — a user who joined three pods that later expired has still "joined
    // 3 pods". Attendance and reliability stay strictly completed-pod based:
    // you can't attend (or flake on) a pod that never happened, so those come
    // from completedPodsJoined below. Before this split, podsJoined also only
    // counted COMPLETED pods, which read as "0 pods joined" right next to a
    // nonzero "people met" for any user whose pods hadn't completed yet.
    const [
      podsJoined,
      completedPodsJoined,
      noShowPods,
      friendCount,
      sharedPodCount,
      viewerFriendships,
      targetFriendships,
      clubMemberships,
      clubCount,
      upcomingPods,
    ] = await Promise.all([
      prisma.podMember.count({ where: { userId: targetId } }),
      prisma.podMember.count({ where: { userId: targetId, pod: { status: 'COMPLETED' } } }),
      prisma.noShowReport.groupBy({ by: ['podId'], where: { targetUserId: targetId } }),
      // Count friendships for this user (appears as userA or userB)
      prisma.friendship.count({
        where: { OR: [{ userAId: targetId }, { userBId: targetId }] },
      }),
      // Pods the viewer and target were BOTH in — the real-meetings graph
      // behind the "you've been to N pods together" reconnect prompt (04 §3b).
      isSelf
        ? Promise.resolve(0)
        : prisma.pod.count({
            where: {
              AND: [
                { members: { some: { userId: req.user!.userId } } },
                { members: { some: { userId: targetId } } },
              ],
            },
          }),
      isSelf
        ? Promise.resolve([])
        : prisma.friendship.findMany({
            where: { OR: [{ userAId: req.user!.userId }, { userBId: req.user!.userId }] },
            select: { userAId: true, userBId: true },
          }),
      isSelf
        ? Promise.resolve([])
        : prisma.friendship.findMany({
            where: { OR: [{ userAId: targetId }, { userBId: targetId }] },
            select: { userAId: true, userBId: true },
          }),
      prisma.clubMember.findMany({
        where: {
          userId: targetId,
          club: { status: 'ACTIVE', isDiscoverable: true },
        },
        orderBy: { joinedAt: 'desc' },
        take: 4,
        include: {
          club: {
            select: { id: true, name: true, emoji: true, avatarUrl: true, category: true },
          },
        },
      }),
      prisma.clubMember.count({
        where: {
          userId: targetId,
          club: { status: 'ACTIVE', isDiscoverable: true },
        },
      }),
      prisma.pod.findMany({
        where: {
          meetupTime: { gte: new Date() },
          status: { in: ['FORMING', 'LOCKED'] },
          locationType: 'public',
          members: { some: { userId: targetId } },
        },
        orderBy: { meetupTime: 'asc' },
        take: 3,
        include: {
          activity: { select: { title: true } },
          _count: { select: { members: true } },
        },
      }),
    ]);

    const viewerFriendIds = new Set(
      viewerFriendships.map((row) =>
        row.userAId === req.user!.userId ? row.userBId : row.userAId,
      ),
    );
    const mutualFriendIds = targetFriendships
      .map((row) => (row.userAId === targetId ? row.userBId : row.userAId))
      .filter((id) => viewerFriendIds.has(id));
    const blockedIds = await getBlockedUserIds(req.user!.userId);
    const visibleMutualIds = mutualFriendIds.filter((id) => !blockedIds.has(id)).slice(0, 8);
    const mutualFriends = visibleMutualIds.length
      ? await prisma.user.findMany({
          where: { id: { in: visibleMutualIds }, accountStatus: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        })
      : [];

    const noShowPodCount = noShowPods.length;
    const podsAttended = Math.max(0, completedPodsJoined - noShowPodCount);
    const reliabilityScore =
      completedPodsJoined > 0 ? Math.round((podsAttended / completedPodsJoined) * 100) : null;

    res.json({
      id: user.id,
      name: isFriend ? getFullName(user) : getPublicName(user),
      firstName: user.firstName,
      lastName: isFriend ? user.lastName : '',
      verifiedUniversity: user.verifiedUniversity,
      avatarUrl: user.avatarUrl ?? null,
      podsJoined,
      podsAttended,
      reliabilityScore,
      joinedAt: user.createdAt.toISOString(),
      friendCount,
      sharedPodCount,
      mutualFriendCount: visibleMutualIds.length,
      mutualFriends: mutualFriends.map((friend) => withDisplayName(friend, 'full')),
      classYear: user.classYear ?? null,
      major: user.major ?? null,
      bio: user.bio ?? null,
      clubs: parseJsonArray(user.clubs),
      instagramHandle: user.instagramHandle ?? null,
      interestTags: parseJsonArray(user.interestTags),
      purpose: user.purpose ?? null,
      campusZones: parseJsonArray(user.campusZones),
      clubMemberships: clubMemberships.map(({ club }) => club),
      clubCount,
      upcomingPods: upcomingPods.map((pod) => ({
        id: pod.id,
        title: pod.title || pod.activity.title,
        meetupTime: pod.meetupTime.toISOString(),
        location: pod.location,
        memberCount: pod._count.members,
        maxMembers: pod.maxMembers,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users/:id/block – block target user
router.post('/:id/block', requireVerifiedAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const blockerId = req.user!.userId;
  const blockedId = req.params.id;

  if (blockerId === blockedId) {
    res.status(400).json({ error: "You can't block yourself" });
    return;
  }

  try {
    const target = await prisma.user.findUnique({ where: { id: blockedId } });
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let block = await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });

    if (block) {
      res.status(200).json({ success: true, blockId: block.id, createdAt: block.createdAt });
      return;
    }

    // Cancel pending friend requests and remove any friendship before creating the block
    await cancelPendingRequestsBetween(blockerId, blockedId);
    await removeFriendshipIfExists(blockerId, blockedId);

    block = await prisma.$transaction(async (tx) => {
      const created = await tx.block.create({
        data: { blockerId, blockedId },
      });

      // Cleanup: remove both users from any shared pods
      const podsWithBoth = await tx.pod.findMany({
        where: {
          AND: [
            { members: { some: { userId: blockerId } } },
            { members: { some: { userId: blockedId } } },
          ],
        },
        select: { id: true },
      });
      const uniquePodIds = podsWithBoth.map((p) => p.id);
      for (const podId of uniquePodIds) {
        await tx.podMember.deleteMany({
          where: {
            podId,
            userId: { in: [blockerId, blockedId] },
          },
        });
        const remaining = await tx.podMember.count({ where: { podId } });
        if (remaining === 0) {
          await tx.message.deleteMany({ where: { podId } });
          await tx.pod.delete({ where: { id: podId } });
        } else {
          const pod = await tx.pod.findUnique({ where: { id: podId } });
          if (pod?.creatorId && [blockerId, blockedId].includes(pod.creatorId)) {
            const nextCreator = await tx.podMember.findFirst({
              where: { podId },
              orderBy: { joinedAt: 'asc' },
            });
            if (nextCreator) {
              await tx.pod.update({
                where: { id: podId },
                data: { creatorId: nextCreator.userId },
              });
            }
          }
        }
      }

      return created;
    });

    res.status(200).json({ success: true, blockId: block.id, createdAt: block.createdAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /users/:id/block – unblock target user
router.delete('/:id/block', requireVerifiedAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const blockerId = req.user!.userId;
  const blockedId = req.params.id;

  try {
    const deleted = await prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });

    if (deleted.count === 0) {
      res.status(204).send();
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
