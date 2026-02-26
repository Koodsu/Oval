/**
 * Test helpers: create users, get auth tokens, etc.
 */
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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
  const secret = process.env.JWT_SECRET ?? 'bridge_dev_secret';
  return jwt.sign({ userId, email }, secret, { expiresIn: '7d' });
}

export async function registerAndGetToken(
  name: string,
  email: string,
  password: string
): Promise<{ token: string; user: { id: string; name: string; email: string } }> {
  const res = await request(app)
    .post('/auth/register')
    .send({ name, email, password })
    .expect(201);
  return res.body;
}
