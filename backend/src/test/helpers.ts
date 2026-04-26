/**
 * Test helpers: create users, get auth tokens, etc.
 */
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt';

export async function createTestUser(overrides: {
  name?: string;
  email?: string;
  password?: string;
} = {}) {
  const name = overrides.name ?? `Test User ${Date.now()}`;
  const email = overrides.email ?? `test-${Date.now()}@example.com`;
  const password = overrides.password ?? 'password123';

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed },
  });
  return { ...user, plainPassword: password };
}

export function getAuthToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, getJwtSecret(), { expiresIn: '7d' });
}

export async function registerAndGetToken(
  name: string,
  email: string,
  password: string
): Promise<{ token: string; user: { id: string; name: string; email: string; verifiedUniversity: boolean; joinedAt: string } }> {
  // Registration enforces @osu.edu — coerce any test email to that domain
  const osuEmail = email.includes('@') ? email.split('@')[0] + '@osu.edu' : email + '@osu.edu';
  const res = await request(app)
    .post('/auth/register')
    .send({ name, email: osuEmail, password, classYear: 'Freshman', major: 'Computer Science' })
    .expect(201);
  return res.body;
}
