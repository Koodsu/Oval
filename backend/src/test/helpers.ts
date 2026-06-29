/**
 * Test helpers: create users, get auth tokens, etc.
 */
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import bcrypt from 'bcryptjs';
import { normalizeNameParts } from '../lib/userNames';
import { issueAuthToken } from '../lib/authSession';
import { CURRENT_TERMS_VERSION } from '../config/legal';

let testUserCounter = 0;

function nextTestEmail(input: string): string {
  const localPart = input.includes('@') ? input.split('@')[0] : input;
  const safeLocalPart = localPart.replace(/[^a-zA-Z0-9._+-]/g, '-').replace(/^-+|-+$/g, '') || 'test-user';
  testUserCounter += 1;
  return `${safeLocalPart}-${Date.now()}-${testUserCounter}@osu.edu`;
}

export async function createTestUser(overrides: {
  name?: string;
  email?: string;
  password?: string;
  verified?: boolean;
} = {}) {
  const name = overrides.name ?? `Test User ${Date.now()}`;
  const email = overrides.email ?? nextTestEmail('test');
  const password = overrides.password ?? 'password123';
  const { firstName, lastName, fullName } = normalizeNameParts({ name });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: fullName,
      firstName,
      lastName,
      email,
      password: hashed,
      verifiedUniversity: overrides.verified ?? true,
    },
  });
  return { ...user, plainPassword: password };
}

export function getAuthToken(userId: string, email: string): string {
  return issueAuthToken({ id: userId, email, tokenVersion: 0 });
}

export async function registerAndGetToken(
  name: string,
  email: string,
  password: string,
  options: { verified?: boolean } = {}
): Promise<{ token: string; user: { id: string; name: string; email: string; verifiedUniversity: boolean; joinedAt: string } }> {
  // Registration enforces @osu.edu. Keep helper-created users unique across tests.
  const osuEmail = nextTestEmail(email);
  const nameParts = normalizeNameParts({ name });
  const firstName =
    nameParts.firstName && nameParts.firstName.length >= 2 ? nameParts.firstName : `${nameParts.firstName || 'Test'}x`;
  const lastName = nameParts.lastName && nameParts.lastName.length >= 2 ? nameParts.lastName : undefined;
  const res = await request(app)
    .post('/auth/register')
    .send({
      firstName,
      lastName,
      email: osuEmail,
      password,
      classYear: 'Freshman',
      major: 'Computer Science',
      termsAccepted: true,
      ageConfirmed: true,
      termsVersion: CURRENT_TERMS_VERSION,
    })
    .expect(201);

  if (options.verified !== false) {
    await prisma.user.update({
      where: { id: res.body.user.id },
      data: { verifiedUniversity: true, emailVerifyCode: null, emailVerifyExpiry: null },
    });
    res.body.user.verifiedUniversity = true;
  }

  return res.body;
}
