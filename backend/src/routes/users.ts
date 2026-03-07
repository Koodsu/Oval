import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ── Avatar upload setup ────────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
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
        const oldPath = path.join(__dirname, '../../', existing.avatarUrl);
        fs.unlink(oldPath, () => {}); // best-effort cleanup
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
      const oldPath = path.join(__dirname, '../../', existing.avatarUrl);
      fs.unlink(oldPath, () => {});
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
    const defaults = { podJoin: true, newMessage: true, meetupReminder: true };
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
  const { podJoin, newMessage, meetupReminder } = req.body;

  if (
    (podJoin !== undefined && typeof podJoin !== 'boolean') ||
    (newMessage !== undefined && typeof newMessage !== 'boolean') ||
    (meetupReminder !== undefined && typeof meetupReminder !== 'boolean')
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
    const defaults = { podJoin: true, newMessage: true, meetupReminder: true };
    const updated = {
      ...defaults,
      ...current,
      ...(podJoin !== undefined && { podJoin }),
      ...(newMessage !== undefined && { newMessage }),
      ...(meetupReminder !== undefined && { meetupReminder }),
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

// GET /users/:id — public profile
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const targetId = req.params.id;

  try {
    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const podsJoined = await prisma.podMember.count({
      where: { userId: targetId, pod: { status: 'COMPLETED' } },
    });

    const noShowPods = await prisma.noShowReport.groupBy({
      by: ['podId'],
      where: { targetUserId: targetId },
    });
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
