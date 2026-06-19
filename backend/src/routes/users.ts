import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../prisma';
import { requireAuth, requireVerifiedAuth, AuthRequest } from '../middleware/auth';
import { isSupabaseStorageConfigured, supabaseStorage } from '../lib/supabaseStorage';
import { getBlockedUserIds } from '../lib/blocks';
import { areFriends, normalizeUserPair } from '../lib/friendUtils';
import {
  cancelPendingRequestsBetween,
  removeFriendshipIfExists,
} from '../services/friendService';
import { INTEREST_TAG_SET } from '../config/interestTags';
import { getFullName, getPublicName, withDisplayName } from '../lib/userNames';
import { moderateImageContent, moderateTextContent } from '../lib/contentModeration';

const VALID_CLASS_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad'] as const;
const MAJOR_REGEX = /^[a-zA-Z\s&\/\-,\.\(\)]+$/;
const INSTAGRAM_REGEX = /^[a-zA-Z0-9._]{1,30}$/;
const CLUB_REGEX = /^[a-zA-Z\s&\-]+$/;
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

function deletionSuccessorRank(role: string): number {
  if (role === 'ADMIN') return 3;
  if (role === 'OFFICER') return 2;
  return 1;
}

const router = Router();

// ── Avatar upload setup ────────────────────────────────────────────────────────

const USER_AVATAR_BUCKET = 'user-avatars';
const UPLOAD_DIR = path.join(__dirname, '../../uploads/avatars');
// Resolved once at startup; used to guard against path traversal when deleting old avatars.
const UPLOAD_DIR_RESOLVED = path.resolve(UPLOAD_DIR);
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch {
  // Vercel read-only filesystem — ignore
}

/**
 * Safely unlinks an avatar file. Resolves the stored path and verifies it
 * lives inside UPLOAD_DIR before deleting — prevents path traversal if the
 * DB record were ever tampered with.
 */
function safeUnlinkAvatar(storedUrl: string): void {
  const fullPath = path.resolve(path.join(__dirname, '../../', storedUrl));
  if (fullPath.startsWith(UPLOAD_DIR_RESOLVED + path.sep)) {
    fs.unlink(fullPath, () => {}); // best-effort, ignore ENOENT
  }
}

function avatarExtension(mimetype: string): string {
  if (mimetype === 'image/png') return 'png';
  if (mimetype === 'image/webp') return 'webp';
  return 'jpg';
}

function supabaseObjectNameFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

async function cleanupAvatarUrl(avatarUrl: string | null | undefined): Promise<void> {
  if (!avatarUrl) return;

  const objectName = isSupabaseStorageConfigured()
    ? supabaseObjectNameFromPublicUrl(avatarUrl, USER_AVATAR_BUCKET)
    : null;
  if (objectName) {
    await supabaseStorage.storage.from(USER_AVATAR_BUCKET).remove([objectName]);
    return;
  }

  safeUnlinkAvatar(avatarUrl);
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
  try {
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const ownedClubs = await tx.club.findMany({
        where: { createdById: userId },
        include: {
          members: {
            where: { userId: { not: userId } },
            select: { userId: true, role: true, joinedAt: true },
          },
        },
      });

      for (const club of ownedClubs) {
        const successor = [...club.members].sort((a, b) => {
          const rankDifference = deletionSuccessorRank(b.role) - deletionSuccessorRank(a.role);
          return rankDifference || a.joinedAt.getTime() - b.joinedAt.getTime();
        })[0];

        if (!successor) {
          await tx.club.delete({ where: { id: club.id } });
          continue;
        }

        await tx.club.update({
          where: { id: club.id },
          data: { createdById: successor.userId },
        });
        await tx.clubMember.updateMany({
          where: { clubId: club.id, userId: successor.userId },
          data: { role: 'OWNER' },
        });
        await tx.clubRole.updateMany({
          where: { clubId: club.id, createdById: userId },
          data: { createdById: successor.userId },
        });
        await tx.clubMeeting.updateMany({
          where: { clubId: club.id, createdById: userId },
          data: { createdById: successor.userId },
        });
        await tx.clubMemberRole.updateMany({
          where: { clubId: club.id, assignedById: userId },
          data: { assignedById: successor.userId },
        });
      }

      const clubsWithRemainingAuthorship = await tx.club.findMany({
        where: {
          OR: [
            { roles: { some: { createdById: userId } } },
            { meetings: { some: { createdById: userId } } },
          ],
        },
        select: { id: true, createdById: true },
      });

      for (const club of clubsWithRemainingAuthorship) {
        await tx.clubRole.updateMany({
          where: { clubId: club.id, createdById: userId },
          data: { createdById: club.createdById },
        });
        await tx.clubMeeting.updateMany({
          where: { clubId: club.id, createdById: userId },
          data: { createdById: club.createdById },
        });
      }

      const assignmentClubIds = Array.from(new Set(
        (await tx.clubMemberRole.findMany({
          where: { assignedById: userId },
          select: { clubId: true },
        })).map((assignment) => assignment.clubId)
      ));
      for (const clubId of assignmentClubIds) {
        const club = await tx.club.findUnique({ where: { id: clubId }, select: { createdById: true } });
        if (club) {
          await tx.clubMemberRole.updateMany({
            where: { clubId, assignedById: userId },
            data: { assignedById: club.createdById },
          });
        }
      }

      const [podMessageIds, directMessageIds, clubMessageIds, officerMessageIds, announcementIds] =
        await Promise.all([
          tx.message.findMany({ where: { userId }, select: { id: true } }),
          tx.directMessage.findMany({ where: { senderId: userId }, select: { id: true } }),
          tx.clubMessage.findMany({ where: { userId }, select: { id: true } }),
          tx.clubOfficerMessage.findMany({ where: { userId }, select: { id: true } }),
          tx.clubAnnouncement.findMany({ where: { userId }, select: { id: true } }),
        ]);

      await Promise.all([
        tx.report.updateMany({
          where: { messageId: { in: podMessageIds.map((item) => item.id) } },
          data: { messageId: null },
        }),
        tx.report.updateMany({
          where: { directMessageId: { in: directMessageIds.map((item) => item.id) } },
          data: { directMessageId: null },
        }),
        tx.report.updateMany({
          where: { clubMessageId: { in: clubMessageIds.map((item) => item.id) } },
          data: { clubMessageId: null },
        }),
        tx.report.updateMany({
          where: { clubOfficerMessageId: { in: officerMessageIds.map((item) => item.id) } },
          data: { clubOfficerMessageId: null },
        }),
        tx.report.updateMany({
          where: { clubAnnouncementId: { in: announcementIds.map((item) => item.id) } },
          data: { clubAnnouncementId: null },
        }),
      ]);
      await tx.noShowReport.deleteMany({
        where: { OR: [{ reporterId: userId }, { targetUserId: userId }] },
      });

      await tx.message.deleteMany({ where: { userId } });
      await tx.directMessage.deleteMany({ where: { senderId: userId } });
      await tx.clubAnnouncement.deleteMany({ where: { userId } });
      await tx.clubMessage.deleteMany({ where: { userId } });
      await tx.clubOfficerMessage.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    await cleanupAvatarUrl(existing.avatarUrl);
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
    (clubAttendanceOpen !== undefined && typeof clubAttendanceOpen !== 'boolean')
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
        blocked: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(blocks.map((b) => ({ ...withDisplayName(b.blocked, 'full'), blockedAt: b.createdAt })));
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

    const [podsJoined, noShowPods, friendCount] = await Promise.all([
      prisma.podMember.count({ where: { userId: targetId, pod: { status: 'COMPLETED' } } }),
      prisma.noShowReport.groupBy({ by: ['podId'], where: { targetUserId: targetId } }),
      // Count friendships for this user (appears as userA or userB)
      prisma.friendship.count({
        where: { OR: [{ userAId: targetId }, { userBId: targetId }] },
      }),
    ]);

    const noShowPodCount = noShowPods.length;
    const podsAttended = podsJoined - noShowPodCount;
    const reliabilityScore =
      podsJoined > 0 ? Math.round((podsAttended / podsJoined) * 100) : null;

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
      classYear: user.classYear ?? null,
      major: user.major ?? null,
      bio: user.bio ?? null,
      clubs: parseJsonArray(user.clubs),
      instagramHandle: user.instagramHandle ?? null,
      interestTags: parseJsonArray(user.interestTags),
      purpose: user.purpose ?? null,
      campusZones: parseJsonArray(user.campusZones),
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
