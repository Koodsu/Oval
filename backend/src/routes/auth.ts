import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendPasswordResetEmail, sendVerificationEmail } from '../lib/emailService';
import { getFullName, normalizeNameParts } from '../lib/userNames';
import { moderateTextContent } from '../lib/contentModeration';
import { CURRENT_TERMS_VERSION, isAcceptedTermsVersion } from '../config/legal';
import { issueAuthToken } from '../lib/authSession';
import { consumeDurableRateLimit } from '../lib/durableRateLimit';
import { hashEmailIdentity, normalizeEmail } from '../lib/identity';
import { isPlatformAdmin } from '../middleware/admin';
import {
  generateOneTimeCode,
  hashOneTimeCode,
  oneTimeCodeMatches,
} from '../lib/oneTimeCodes';

const router = Router();

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_EMAIL_SUFFIXES = ['@osu.edu', '@buckeyemail.osu.edu'];
const VERIFY_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000; // 15 minutes

const VALID_CLASS_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad'] as const;

// Allows letters, spaces, &, /, -, comma, period, parentheses — prevents garbage like "xoixhsiohxo"
const MAJOR_REGEX = /^[a-zA-Z\s&\/\-,\.\(\)]+$/;

function isAllowedEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return ALLOWED_EMAIL_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function isValidEmail(email: string): boolean {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

function requestIdentifiers(req: Request, email?: string): string[] {
  return [`ip:${req.ip || 'unknown'}`, ...(email ? [`email:${email}`] : [])];
}

function safeUser(user: {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  verifiedUniversity: boolean;
  avatarUrl?: string | null;
  createdAt: Date;
  classYear?: string | null;
  major?: string | null;
  bio?: string | null;
  clubs?: string | null;
  instagramHandle?: string | null;
  termsVersion?: string | null;
  termsAcceptedAt?: Date | null;
  ageAttestedAt?: Date | null;
}) {
  return {
    id: user.id,
    name: getFullName(user),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    verifiedUniversity: user.verifiedUniversity,
    isAdmin: isPlatformAdmin(user.id),
    avatarUrl: user.avatarUrl ?? null,
    joinedAt: user.createdAt.toISOString(),
    classYear: user.classYear ?? null,
    major: user.major ?? null,
    bio: user.bio ?? null,
    clubs: user.clubs ? (() => { try { return JSON.parse(user.clubs!); } catch { return []; } })() : [],
    instagramHandle: user.instagramHandle ?? null,
    termsVersion: user.termsVersion ?? null,
    termsAcceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
    ageAttestedAt: user.ageAttestedAt?.toISOString() ?? null,
  };
}

// POST /auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const rawName = req.body?.name;
  const rawFirstName = req.body?.firstName;
  const rawLastName = req.body?.lastName;
  const rawEmail = req.body?.email;
  const rawPassword = req.body?.password;
  const rawClassYear = req.body?.classYear;
  const rawMajor = req.body?.major;
  const termsAccepted = req.body?.termsAccepted === true;
  const ageConfirmed = req.body?.ageConfirmed === true;
  const termsVersion = typeof req.body?.termsVersion === 'string' ? req.body.termsVersion.trim() : '';

  const { firstName, lastName, fullName } = normalizeNameParts({
    firstName: typeof rawFirstName === 'string' ? rawFirstName : null,
    lastName: typeof rawLastName === 'string' ? rawLastName : null,
    name: typeof rawName === 'string' ? rawName : null,
  });
  const email = typeof rawEmail === 'string' ? normalizeEmail(rawEmail) : '';
  const password = typeof rawPassword === 'string' ? rawPassword : '';
  const classYear = typeof rawClassYear === 'string' ? rawClassYear.trim() : '';
  const major = typeof rawMajor === 'string' ? rawMajor.trim() : '';

  if (!firstName || !email || !password) {
    res.status(400).json({ error: 'firstName, email, and password are required' });
    return;
  }

  if (firstName.length < 2) {
    res.status(400).json({ error: 'First name must be at least 2 characters' });
    return;
  }

  if (lastName && lastName.length < 2) {
    res.status(400).json({ error: 'Last name must be at least 2 characters when provided' });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  if (!isAllowedEmail(email)) {
    res.status(400).json({ error: 'Only @osu.edu or @buckeyemail.osu.edu email addresses are allowed' });
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }

  if (!classYear || !(VALID_CLASS_YEARS as readonly string[]).includes(classYear)) {
    res.status(400).json({ error: 'classYear must be one of: Freshman, Sophomore, Junior, Senior, Grad' });
    return;
  }

  if (!major || major.length < 2) {
    res.status(400).json({ error: 'Major must be at least 2 characters' });
    return;
  }
  if (major.length > 60) {
    res.status(400).json({ error: 'Major must be 60 characters or fewer' });
    return;
  }
  if (!MAJOR_REGEX.test(major)) {
    res.status(400).json({ error: 'Major can only contain letters, spaces, and common punctuation (&, /, -, comma, period)' });
    return;
  }

  if (!termsAccepted || !ageConfirmed || !isAcceptedTermsVersion(termsVersion)) {
    res.status(400).json({
      error: 'You must confirm you are 18 or older and accept the current Terms and Community Guidelines.',
    });
    return;
  }

  const moderation = await moderateTextContent([firstName, lastName, major]);
  if (moderation) {
    res.status(moderation.status).json({ error: moderation.message });
    return;
  }

  try {
    const withinLimit = await consumeDurableRateLimit({
      action: 'auth.register',
      identifiers: requestIdentifiers(req, email),
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!withinLimit) {
      res.status(429).json({ error: 'Too many account creation attempts. Please try again later.' });
      return;
    }

    const bannedIdentity = await prisma.bannedIdentity.findUnique({
      where: { emailHash: hashEmailIdentity(email) },
      select: { id: true },
    });
    if (bannedIdentity) {
      res.status(403).json({ error: 'This account cannot be created. Contact Oval support for help.' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const code = generateOneTimeCode();
    const expiry = new Date(Date.now() + VERIFY_CODE_TTL_MS);

    const user = await prisma.user.create({
      data: {
        name: fullName,
        firstName,
        lastName,
        email: email.toLowerCase(),
        password: hashed,
        emailVerifyCode: hashOneTimeCode('email-verification', code),
        emailVerifyExpiry: expiry,
        classYear,
        major,
        // Record what the client actually displayed, not CURRENT_TERMS_VERSION —
        // an older build showed older text.
        termsVersion,
        termsAcceptedAt: new Date(),
        ageAttestedAt: new Date(),
      },
    });

    // Best-effort — don't block registration if email fails
    console.log(`[auth] Sending verification email to ${user.email} at ${new Date().toISOString()}`);
    sendVerificationEmail(user.email, code).catch((err) =>
      console.error('[auth] Failed to send verification email:', err)
    );

    const token = issueAuthToken(user);

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
    const withinLimit = await consumeDurableRateLimit({
      action: 'auth.login',
      identifiers: requestIdentifiers(req, email),
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!withinLimit) {
      res.status(429).json({ error: 'Too many sign-in attempts. Please wait and try again.' });
      return;
    }

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

    if (user.accountStatus !== 'ACTIVE') {
      res.status(403).json({ error: 'This account is unavailable. Contact Oval support for help.' });
      return;
    }

    const token = issueAuthToken(user);

    res.json({ token, user: safeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/request-password-reset
router.post('/request-password-reset', async (req: Request, res: Response): Promise<void> => {
  const rawEmail = req.body?.email;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

  if (!email) {
    res.status(400).json({ error: 'email is required' });
    return;
  }

  if (!isValidEmail(email) || !isAllowedEmail(email)) {
    res.status(400).json({ error: 'Use your OSU email address to reset your password.' });
    return;
  }

  try {
    const withinLimit = await consumeDurableRateLimit({
      action: 'auth.password-reset-request',
      identifiers: requestIdentifiers(req, email),
      limit: 3,
      windowMs: PASSWORD_RESET_TTL_MS,
    });
    if (!withinLimit) {
      res.status(429).json({ error: 'Too many attempts. Please wait before requesting another reset code.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.accountStatus === 'ACTIVE') {
      const code = generateOneTimeCode();
      const expiry = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetCode: hashOneTimeCode('password-reset', code),
          passwordResetExpiry: expiry,
        },
      });

      console.log(`[auth] Sending password reset email to ${user.email} at ${new Date().toISOString()}`);
      sendPasswordResetEmail(user.email, code).catch((err) =>
        console.error('[auth] Failed to send password reset email:', err)
      );
    }

    res.json({ message: 'If that email is on Oval, a reset code is on the way.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  const rawEmail = req.body?.email;
  const rawCode = req.body?.code;
  const rawPassword = req.body?.password;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  const password = typeof rawPassword === 'string' ? rawPassword : '';

  if (!email || !code || !password) {
    res.status(400).json({ error: 'email, code, and password are required' });
    return;
  }

  if (!isValidEmail(email) || !isAllowedEmail(email)) {
    res.status(400).json({ error: 'Use your OSU email address to reset your password.' });
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: 'Reset code must be 6 digits' });
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }

  try {
    const withinLimit = await consumeDurableRateLimit({
      action: 'auth.password-reset-submit',
      identifiers: requestIdentifiers(req, email),
      limit: 10,
      windowMs: PASSWORD_RESET_TTL_MS,
    });
    if (!withinLimit) {
      res.status(429).json({ error: 'Too many reset attempts. Request a new code later.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordResetCode || !user.passwordResetExpiry) {
      res.status(400).json({ error: 'Invalid or expired reset code' });
      return;
    }

    if (new Date() > user.passwordResetExpiry) {
      res.status(400).json({ error: 'Invalid or expired reset code' });
      return;
    }

    if (!oneTimeCodeMatches('password-reset', code, user.passwordResetCode)) {
      res.status(400).json({ error: 'Invalid or expired reset code' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        passwordResetCode: null,
        passwordResetExpiry: null,
        tokenVersion: { increment: 1 },
      },
    });

    res.json({ message: 'Password updated. Sign in with your new password.' });
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
    const withinLimit = await consumeDurableRateLimit({
      action: 'auth.email-verification-submit',
      identifiers: [`user:${userId}`, `ip:${req.ip || 'unknown'}`],
      limit: 10,
      windowMs: VERIFY_CODE_TTL_MS,
    });
    if (!withinLimit) {
      res.status(429).json({ error: 'Too many verification attempts. Request a new code later.' });
      return;
    }

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

    if (!oneTimeCodeMatches('email-verification', code, user.emailVerifyCode)) {
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

    // Idempotency: if a code was generated < 30s ago, don't send again
    const CODE_RECENT_THRESHOLD_MS = 30_000;
    if (user.emailVerifyExpiry) {
      const codeAge = VERIFY_CODE_TTL_MS - (user.emailVerifyExpiry.getTime() - Date.now());
      if (codeAge < CODE_RECENT_THRESHOLD_MS) {
        res.json({ message: 'Verification code sent' });
        return;
      }
    }

    // Rate limit: max 3 resends per 10 minutes per email
    const withinLimit = await consumeDurableRateLimit({
      action: 'auth.email-verification-resend',
      identifiers: [`user:${userId}`, `ip:${req.ip || 'unknown'}`],
      limit: 3,
      windowMs: VERIFY_CODE_TTL_MS,
    });
    if (!withinLimit) {
      res.status(429).json({ error: 'Too many attempts. Please wait before requesting another code.' });
      return;
    }

    const code = generateOneTimeCode();
    const expiry = new Date(Date.now() + VERIFY_CODE_TTL_MS);

    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifyCode: hashOneTimeCode('email-verification', code),
        emailVerifyExpiry: expiry,
      },
    });

    console.log(`[auth] Resending verification email to ${user.email} at ${new Date().toISOString()}`);
    sendVerificationEmail(user.email, code).catch((err) =>
      console.error('[auth] Failed to resend verification email:', err)
    );

    res.json({ message: 'Verification code sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/accept-terms
router.post('/accept-terms', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const submittedVersion =
    typeof req.body?.termsVersion === 'string' ? req.body.termsVersion.trim() : '';

  if (
    req.body?.termsAccepted !== true ||
    req.body?.ageConfirmed !== true ||
    !isAcceptedTermsVersion(submittedVersion)
  ) {
    res.status(400).json({ error: 'Accept the current Terms and confirm you are 18 or older.' });
    return;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        // Record what the client actually displayed, not CURRENT_TERMS_VERSION —
        // an older build showed older text.
        termsVersion: submittedVersion,
        termsAcceptedAt: new Date(),
        ageAttestedAt: new Date(),
      },
    });
    res.json({ user: safeUser(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
