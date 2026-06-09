import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { adminListReports, adminUpdateReport, AdminReportPatch } from '../services/reportService';
import { isValidSeverity, isValidStatus, ReportStatus } from '../lib/reportReasons';

const router = Router();

router.use(requireAuth, requireAdmin);

// GET /admin/reports
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, severity, limit, cursor } = req.query;
  const filters = {
    status: typeof status === 'string' && isValidStatus(status) ? status : undefined,
    severity: typeof severity === 'string' && isValidSeverity(severity) ? severity : undefined,
    limit: typeof limit === 'string' ? parseInt(limit, 10) : 50,
    cursor: typeof cursor === 'string' && cursor ? cursor : undefined,
  };

  try {
    const result = await adminListReports(filters);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /admin/reports/:id
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, adminNotes, removeContent, accountAction } = req.body;

  const patch: AdminReportPatch = {};
  if (status && isValidStatus(status)) {
    patch.status = status as ReportStatus;
  }
  if (adminNotes !== undefined) {
    patch.adminNotes = typeof adminNotes === 'string' ? adminNotes : undefined;
  }
  if (removeContent === true) {
    patch.removeContent = true;
  }
  if (typeof accountAction === 'string' && ['SUSPEND', 'BAN', 'RESTORE'].includes(accountAction)) {
    patch.accountAction = accountAction as 'SUSPEND' | 'BAN' | 'RESTORE';
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  try {
    const report = await adminUpdateReport(id, patch);
    res.json(report);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    if (err instanceof Error && (
      err.message.includes('does not point to removable content') ||
      err.message.includes('does not have a target user') ||
      err.message.includes('Target user not found')
    )) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
