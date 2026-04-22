import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getBlockedUserIds } from '../lib/blocks';
import { normalizeUserPair } from '../lib/friendUtils';
import {
  cancelPendingRequestsBetween,
  removeFriendshipIfExists,
} from '../services/friendService';
import { INTEREST_TAG_SET } from '../config/interestTags';

const VALID_CLASS_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad'] as const;
const MAJOR_REGEX = /^[a-zA-Z\s&\/\-,\.\(\)]+$/;
const INSTAGRAM_REGEX = /^[a-zA-Z0-9._]{1,30}$/;
const CLUB_REGEX = /^[a-zA-Z\s&\-]+$/;

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

const router = Router();

// ── Avatar upload setup ────────────────────────────────────────────────────────

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

const avatarStorage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, _file, cb) => {
    const userId = (req as AuthRequest).user!.userId;
    cb(null, `${userId}-${Date.now()}.jpg`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
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
      name: user.name,
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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /users/me — update profile fields ───────────────────────────────────

router.patch('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { classYear, major, bio, clubs, instagramHandle, interestTags } = req.body ?? {};

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
      name: updated.name,
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

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    try {
      // Delete old avatar file if it exists
      const existing = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
      if (existing?.avatarUrl) {
        safeUnlinkAvatar(existing.avatarUrl);
      }

      await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
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
    if (existing?.avatarUrl) {
      safeUnlinkAvatar(existing.avatarUrl);
    }
    await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    res.json({ avatarUrl: null });
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
router.get('/notifications', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const defaults = { podJoin: true, newMessage: true, meetupReminder: true, recapPrompt: true, waitlistSpot: true };
    const prefs = user?.notificationPreferences
      ? (() => {
          try { return { ...defaults, ...JSON.parse(user.notificationPreferences) }; } catch { return defaults; }
        })()
      : defaults;
    res.json({ preferences: prefs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /users/notifications — update notification preferences
router.patch('/notifications', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { podJoin, newMessage, meetupReminder, recapPrompt, waitlistSpot } = req.body;

  if (
    (podJoin !== undefined && typeof podJoin !== 'boolean') ||
    (newMessage !== undefined && typeof newMessage !== 'boolean') ||
    (meetupReminder !== undefined && typeof meetupReminder !== 'boolean') ||
    (recapPrompt !== undefined && typeof recapPrompt !== 'boolean') ||
    (waitlistSpot !== undefined && typeof waitlistSpot !== 'boolean')
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
    const defaults = { podJoin: true, newMessage: true, meetupReminder: true, recapPrompt: true, waitlistSpot: true };
    const updated = {
      ...defaults,
      ...current,
      ...(podJoin !== undefined && { podJoin }),
      ...(newMessage !== undefined && { newMessage }),
      ...(meetupReminder !== undefined && { meetupReminder }),
      ...(recapPrompt !== undefined && { recapPrompt }),
      ...(waitlistSpot !== undefined && { waitlistSpot }),
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
router.get('/search', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
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
        name: { contains: q, mode: 'insensitive' },
        id: { notIn: [...excluded] },
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        verifiedUniversity: true,
      },
      take: 20,
    });

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/:id — public profile
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const targetId = req.params.id;

  try {
    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

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
      name: user.name,
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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users/:id/block – block target user
router.post('/:id/block', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
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
router.delete('/:id/block', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
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
