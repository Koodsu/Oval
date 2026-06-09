import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { verifyAuthToken } from '../lib/authSession';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    tokenVersion: number;
    verifiedUniversity: boolean;
    accountStatus: string;
    termsVersion: string | null;
    ageAttestedAt: Date | null;
  };
}

async function resolveAuthenticatedUser(token: string) {
  const payload = verifyAuthToken(token);
  if (!Number.isInteger(payload.tokenVersion)) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      tokenVersion: true,
      verifiedUniversity: true,
      accountStatus: true,
      termsVersion: true,
      ageAttestedAt: true,
    },
  });

  if (
    !user ||
    user.email !== payload.email ||
    user.tokenVersion !== payload.tokenVersion ||
    user.accountStatus !== 'ACTIVE'
  ) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    tokenVersion: user.tokenVersion,
    verifiedUniversity: user.verifiedUniversity,
    accountStatus: user.accountStatus,
    termsVersion: user.termsVersion,
    ageAttestedAt: user.ageAttestedAt,
  };
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const user = await resolveAuthenticatedUser(token);
    if (!user) {
      res.status(401).json({ error: 'Your session is no longer active. Sign in again or contact support.' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  try {
    const user = await resolveAuthenticatedUser(token);
    if (user) req.user = user;
  } catch {
    // Analytics and other optional-auth surfaces should not break because a
    // stale token exists locally. Protected routes still use requireAuth.
  }
  next();
}

export async function requireVerifiedAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    if (!req.user!.verifiedUniversity) {
      res.status(403).json({ error: 'Verify your university email before using Bridge.' });
      return;
    }
    next();
  });
}
