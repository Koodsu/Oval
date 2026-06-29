import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireClubReviewer } from '../middleware/admin';
import prisma from '../prisma';

const router = Router();

// All routes require an authenticated club reviewer (User.isClubReviewer).
router.use(requireAuth, requireClubReviewer);

// GET /admin/club-claims — verification queue (proofs awaiting review)
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const claims = await prisma.clubClaim.findMany({
      where: { status: 'PROOF_SENT' },
      orderBy: { createdAt: 'asc' },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            emoji: true,
            verification: true,
            isDiscoverable: true,
            _count: { select: { members: true } },
          },
        },
        user: { select: { id: true, name: true } },
      },
    });

    res.json(
      claims.map((c) => ({
        id: c.id,
        method: c.method,
        handleOrEmail: c.handleOrEmail,
        challengeCode: c.challengeCode,
        status: c.status,
        createdAt: c.createdAt,
        expiresAt: c.expiresAt,
        claimant: c.user,
        club: {
          id: c.club.id,
          name: c.club.name,
          emoji: c.club.emoji,
          verification: c.club.verification,
          isDiscoverable: c.club.isDiscoverable,
          memberCount: c.club._count.members,
        },
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/club-claims/:id/approve — grant the verified badge
router.post('/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  const reviewerId = req.user!.userId;
  const { id } = req.params;

  try {
    const claim = await prisma.clubClaim.findUnique({ where: { id } });
    if (!claim) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }
    if (claim.status !== 'PROOF_SENT' && claim.status !== 'PENDING') {
      res.status(409).json({ error: 'This claim has already been resolved.' });
      return;
    }

    const now = new Date();
    const isInstagram = claim.method === 'INSTAGRAM';

    await prisma.$transaction([
      prisma.clubClaim.update({
        where: { id: claim.id },
        data: { status: 'APPROVED', reviewerId, resolvedAt: now },
      }),
      prisma.club.update({
        where: { id: claim.clubId },
        data: {
          verification: 'VERIFIED',
          verificationMethod: claim.method,
          verifiedAt: now,
          verifiedByUserId: reviewerId,
          lastReaffirmedAt: now,
          isVerified: true,
          // A verified club is eligible for discovery but keeps its current
          // visibility — the officers turn discovery on when ready.
          instagramHandle: isInstagram ? claim.handleOrEmail : undefined,
          officialEmail: isInstagram ? undefined : claim.handleOrEmail,
        },
      }),
    ]);

    res.json({ ok: true, clubId: claim.clubId, verification: 'VERIFIED' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/club-claims/:id/reject — deny the claim (optional reason)
router.post('/:id/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  const reviewerId = req.user!.userId;
  const { id } = req.params;
  const reason =
    typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) || null : null;

  try {
    const claim = await prisma.clubClaim.findUnique({ where: { id } });
    if (!claim) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }
    if (claim.status !== 'PROOF_SENT' && claim.status !== 'PENDING') {
      res.status(409).json({ error: 'This claim has already been resolved.' });
      return;
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.clubClaim.update({
        where: { id: claim.id },
        data: { status: 'REJECTED', reviewerId, reviewNote: reason, resolvedAt: now },
      });
      // Only drop the in-progress badge state; never demote an already-verified club.
      const club = await tx.club.findUnique({
        where: { id: claim.clubId },
        select: { verification: true },
      });
      if (club?.verification === 'PENDING_REVIEW') {
        await tx.club.update({
          where: { id: claim.clubId },
          data: { verification: 'UNVERIFIED' },
        });
      }
    });

    res.json({ ok: true, clubId: claim.clubId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
