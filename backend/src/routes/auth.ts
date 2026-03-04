import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { getJwtSecret } from '../config/jwt';

const router = Router();

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
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
    const user = await prisma.user.create({
      data: { name: name.trim(), email: email.toLowerCase(), password: hashed },
    });

    const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), {
      expiresIn: '7d',
    });

    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
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

    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
