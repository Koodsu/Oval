import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { getJwtSecret } from '../config/jwt';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendVerificationEmail } from '../lib/emailService';

const router = Router();

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OSU_EMAIL_SUFFIX = '@osu.edu';
const VERIFY_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function isValidEmail(email: string): boolean {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

function generateVerifyCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function safeUser(user: {
  id: string;
  name: string;
  email: string;
  verifiedUniversity: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    verifiedUniversity: user.verifiedUniversity,
    joinedAt: user.createdAt.toISOString(),
  };
}

// POST /auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const rawName = req.body?.name;
  const rawEmail = req.body?.email;
  const rawPassword = req.body?.password;

  const name = typeof rawName === 'string' ? rawName.trim() : '';
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const password = typeof rawPassword === 'string' ? rawPassword : '';

  if (!name || !email || !password) {
    res.status(400).json({ error: 'name, email, and password are required' });
    return;
  }

  if (name.length < 2) {
    res.status(400).json({ error: 'Name must be at least 2 characters' });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  if (!email.endsWith(OSU_EMAIL_SUFFIX)) {
    res.status(400).json({ error: 'Only @osu.edu email addresses are allowed' });
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const code = generateVerifyCode();
    const expiry = new Date(Date.now() + VERIFY_CODE_TTL_MS);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        password: hashed,
        emailVerifyCode: code,
        emailVerifyExpiry: expiry,
      },
    });

    // Best-effort — don't block registration if email fails
    sendVerificationEmail(user.email, code).catch((err) =>
      console.error('[auth] Failed to send verification email:', err)
    );

    const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), {
      expiresIn: '7d',
    });

    res.status(201).json({ token, user: safeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const rawEmail = req.body?.email;
  const rawPassword = req.body?.password;

  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const password = typeof rawPassword === 'string' ? rawPassword : '';

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), {
      expiresIn: '7d',
    });

    res.json({ token, user: safeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/verify-email
router.post('/verify-email', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const rawCode = req.body?.code;

  if (!rawCode || typeof rawCode !== 'string') {
    res.status(400).json({ error: 'code is required' });
    return;
  }

  const code = rawCode.trim();

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.verifiedUniversity) {
      res.json({ user: safeUser(user) });
      return;
    }

    if (!user.emailVerifyCode || !user.emailVerifyExpiry) {
      res.status(400).json({ error: 'No verification code on file. Request a new one.' });
      return;
    }

    if (new Date() > user.emailVerifyExpiry) {
      res.status(400).json({ error: 'Verification code has expired. Request a new one.' });
      return;
    }

    if (user.emailVerifyCode !== code) {
      res.status(400).json({ error: 'Invalid verification code' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        verifiedUniversity: true,
        emailVerifyCode: null,
        emailVerifyExpiry: null,
      },
    });

    res.json({ user: safeUser(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/resend-verification
router.post('/resend-verification', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.verifiedUniversity) {
      res.status(400).json({ error: 'Email is already verified' });
      return;
    }

    const code = generateVerifyCode();
    const expiry = new Date(Date.now() + VERIFY_CODE_TTL_MS);

    await prisma.user.update({
      where: { id: userId },
      data: { emailVerifyCode: code, emailVerifyExpiry: expiry },
    });

    sendVerificationEmail(user.email, code).catch((err) =>
      console.error('[auth] Failed to resend verification email:', err)
    );

    res.json({ message: 'Verification code sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
