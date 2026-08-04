import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import prisma from '../prisma';

const router = Router();

router.use(requireAuth, requireAdmin);

function serializeRequest(row: {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  category: string;
  defaultLocation: string | null;
  status: string;
  reviewerId: string | null;
  reviewNote: string | null;
  createdAt: Date;
  user: { id: string; name: string };
}) {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    description: row.description,
    category: row.category,
    defaultLocation: row.defaultLocation,
    status: row.status,
    reviewerId: row.reviewerId,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt,
    requester: row.user,
  };
}

// GET /admin/activity-requests — pending suggestions by default, or the
// persisted approval/rejection history with ?status=reviewed.
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const reviewed = req.query.status === 'reviewed';
  try {
    const requests = await prisma.activityRequest.findMany({
      where: reviewed ? { status: { in: ['APPROVED', 'REJECTED'] } } : { status: 'PENDING' },
      orderBy: { createdAt: reviewed ? 'desc' : 'asc' },
      include: { user: { select: { id: true, name: true } } },
      take: reviewed ? 100 : undefined,
    });
    res.json({ requests: requests.map(serializeRequest) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/activity-requests/:id/approve — add to catalog if not present.
router.post('/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  const reviewerId = req.user!.userId;
  const { id } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const activityRequest = await tx.activityRequest.findUnique({ where: { id } });
      if (!activityRequest) return { status: 404 as const, body: { error: 'Activity request not found' } };
      if (activityRequest.status !== 'PENDING') {
        return { status: 409 as const, body: { error: 'This activity request has already been resolved.' } };
      }

      const existing = await tx.activity.findFirst({
        where: { title: { equals: activityRequest.title, mode: 'insensitive' } },
      });
      const maxSortOrder = await tx.activity.aggregate({ _max: { sortOrder: true } });
      const catalogData = {
        title: activityRequest.title,
        description: activityRequest.description ?? '',
        category: activityRequest.category,
        defaultLocation: activityRequest.defaultLocation ?? '',
        isActive: true,
        sortOrder: existing?.sortOrder || (maxSortOrder._max.sortOrder ?? 0) + 1,
      };
      const activity = existing
        ? await tx.activity.update({ where: { id: existing.id }, data: catalogData })
        : await tx.activity.create({ data: catalogData });

      const updated = await tx.activityRequest.update({
        where: { id },
        data: { status: 'APPROVED', reviewerId },
        include: { user: { select: { id: true, name: true } } },
      });

      return { status: 200 as const, body: { request: serializeRequest(updated), activity } };
    });

    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/activity-requests/:id/reject — close without catalog creation.
router.post('/:id/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  const reviewerId = req.user!.userId;
  const { id } = req.params;
  const reviewNote =
    typeof req.body?.reviewNote === 'string'
      ? req.body.reviewNote.trim().slice(0, 500) || null
      : typeof req.body?.reason === 'string'
        ? req.body.reason.trim().slice(0, 500) || null
        : null;

  try {
    const existing = await prisma.activityRequest.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Activity request not found' });
      return;
    }
    if (existing.status !== 'PENDING') {
      res.status(409).json({ error: 'This activity request has already been resolved.' });
      return;
    }

    const updated = await prisma.activityRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewerId, reviewNote },
      include: { user: { select: { id: true, name: true } } },
    });
    res.json({ request: serializeRequest(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
