import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../prisma';

function getAdminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!getAdminUserIds().includes(req.user.userId)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

/**
 * Gate for club verification reviewers. Granted via the `User.isClubReviewer`
 * flag (set manually in the DB for now), independent of platform admins.
 */
export async function requireClubReviewer(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { isClubReviewer: true },
  });
  if (!user?.isClubReviewer) {
    res.status(403).json({ error: 'Club reviewer access required' });
    return;
  }
  next();
}
