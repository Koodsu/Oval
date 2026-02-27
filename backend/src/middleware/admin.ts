import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

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
