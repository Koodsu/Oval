import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { hashOneTimeCode } from '../lib/oneTimeCodes';
import { CURRENT_TERMS_VERSION, PREVIOUS_TERMS_VERSIONS } from '../config/legal';

const TEST_DOMAIN = '@osu.edu';
const VALID_PROFILE = {
  classYear: 'Freshman',
  major: 'Computer Science',
  termsAccepted: true,
  ageConfirmed: true,
  termsVersion: CURRENT_TERMS_VERSION,
};

describe('POST /auth/register', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'test-register' } } });
  });

  it('creates a user and returns token', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        name: 'Alice',
        email: `alice-test-register${TEST_DOMAIN}`,
        password: 'securepass123',
        ...VALID_PROFILE,
      })
      .expect(201);

    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toMatchObject({
      id: expect.any(String),
      name: 'Alice',
      email: `alice-test-register${TEST_DOMAIN}`,
      verifiedUniversity: false,
      joinedAt: expect.any(String),
    });
    expect(res.body.user.id).toHaveLength(36); // UUID format
    expect(res.body.user.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(res.body.user.termsAcceptedAt).toEqual(expect.any(String));
    expect(res.body.user.ageAttestedAt).toEqual(expect.any(String));
  });

  it('requires age confirmation and acceptance of the current terms', async () => {
    await request(app)
      .post('/auth/register')
      .send({
        name: 'Terms User',
        email: `terms-test-register-${Date.now()}${TEST_DOMAIN}`,
        password: 'password123',
        classYear: 'Freshman',
        major: 'Computer Science',
      })
      .expect(400);
  });

  // Regression: the App Store build and the backend deploy are never
  // simultaneous. A client on the previously-shipped terms version must still
  // be able to register, or the terms screen becomes an inescapable wall
  // between the two deploys. See docs/PLAYBOOK.md → "Bumping the terms version".
  it.each(PREVIOUS_TERMS_VERSIONS)(
    'still registers a client on previous terms version %s',
    async (oldVersion) => {
      const email = `oldterms-test-register-${Date.now()}${TEST_DOMAIN}`;
      const res = await request(app)
        .post('/auth/register')
        .send({
          name: 'Old Build',
          email,
          password: 'password123',
          ...VALID_PROFILE,
          termsVersion: oldVersion,
        })
        .expect(201);

      // Records what that build actually displayed, not the current version.
      expect(res.body.user.termsVersion).toBe(oldVersion);
    }
  );

  it('rejects an unrecognized terms version', async () => {
    await request(app)
      .post('/auth/register')
      .send({
        name: 'Bogus Terms',
        email: `bogusterms-test-register-${Date.now()}${TEST_DOMAIN}`,
        password: 'password123',
        ...VALID_PROFILE,
        termsVersion: '1999-01-01',
      })
      .expect(400);
  });

  it('accepts @buckeyemail.osu.edu email', async () => {
    const email = `buckeye-test-register-${Date.now()}@buckeyemail.osu.edu`;
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Buckeye', email, password: 'password123', ...VALID_PROFILE })
      .expect(201);
    expect(res.body.user.email).toBe(email);
  });

  it('rejects email from other domains', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Bob', email: 'bob@gmail.com', password: 'password123' })
      .expect(400);

    expect(res.body.error).toMatch(/osu\.edu/);
  });

  it('rejects missing fields', async () => {
    await request(app)
      .post('/auth/register')
      .send({ name: 'Bob', email: 'bob@test.com' })
      .expect(400);

    await request(app)
      .post('/auth/register')
      .send({ email: 'bob@test.com', password: 'x' })
      .expect(400);
  });

  it('rejects invalid email format', async () => {
    await request(app)
      .post('/auth/register')
      .send({ name: 'Bob', email: 'not-an-email', password: 'password123' })
      .expect(400);

    await request(app)
      .post('/auth/register')
      .send({ name: 'Bob', email: 'missing@domain', password: 'password123' })
      .expect(400);
  });

  it('rejects short password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Bob', email: `bob-short-pw-test-register${TEST_DOMAIN}`, password: 'short' })
      .expect(400);
    expect(res.body.error).toContain('8 characters');
  });

  it('rejects name shorter than 2 characters', async () => {
    await request(app)
      .post('/auth/register')
      .send({ name: 'A', email: `a-test-register${TEST_DOMAIN}`, password: 'password123' })
      .expect(400);
  });

  it('rejects duplicate email', async () => {
    const email = `dup-test-register${TEST_DOMAIN}`;
    await request(app)
      .post('/auth/register')
      .send({ name: 'First', email, password: 'password123', ...VALID_PROFILE })
      .expect(201);

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Second', email, password: 'password123', ...VALID_PROFILE })
      .expect(409);

    expect(res.body.error).toContain('already in use');
  });
});

describe('POST /auth/login', () => {
  const email = `login-test-register${TEST_DOMAIN}`;
  const password = 'mypassword';

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await request(app)
      .post('/auth/register')
      .send({ name: 'Login User', email, password, ...VALID_PROFILE })
      .expect(201);
  });

  it('returns token for valid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(email);
    expect(res.body.user).toHaveProperty('verifiedUniversity');
    expect(res.body.user).toHaveProperty('joinedAt');
  });

  it('rejects wrong password', async () => {
    await request(app)
      .post('/auth/login')
      .send({ email, password: 'wrong' })
      .expect(401);
  });

  it('rejects unknown email', async () => {
    await request(app)
      .post('/auth/login')
      .send({ email: 'nonexistent@test.com', password: 'x' })
      .expect(401);
  });

  it('rejects missing email or password', async () => {
    await request(app).post('/auth/login').send({ email }).expect(400);
    await request(app).post('/auth/login').send({ password }).expect(400);
  });
});

describe('POST /auth/verify-email', () => {
  it('verifies a valid code and sets verifiedUniversity: true', async () => {
    const email = `verify-test-${Date.now()}${TEST_DOMAIN}`;
    const regRes = await request(app)
      .post('/auth/register')
      .send({ name: 'Verify User', email, password: 'password123', ...VALID_PROFILE })
      .expect(201);

    const token = regRes.body.token as string;

    const code = '123456';
    await prisma.user.update({
      where: { email },
      data: { emailVerifyCode: hashOneTimeCode('email-verification', code) },
    });

    const verifyRes = await request(app)
      .post('/auth/verify-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ code })
      .expect(200);

    expect(verifyRes.body.user.verifiedUniversity).toBe(true);

    // Confirm DB was updated
    const updated = await prisma.user.findUnique({ where: { email } });
    expect(updated?.verifiedUniversity).toBe(true);
    expect(updated?.emailVerifyCode).toBeNull();
    expect(updated?.emailVerifyExpiry).toBeNull();
  });

  it('rejects an incorrect code with 400', async () => {
    const email = `verify-bad-${Date.now()}${TEST_DOMAIN}`;
    const regRes = await request(app)
      .post('/auth/register')
      .send({ name: 'Bad Code', email, password: 'password123', ...VALID_PROFILE })
      .expect(201);

    const token = regRes.body.token as string;

    await request(app)
      .post('/auth/verify-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' })
      .expect(400);
  });

  it('rejects an expired code with 400', async () => {
    const email = `verify-expired-${Date.now()}${TEST_DOMAIN}`;
    const regRes = await request(app)
      .post('/auth/register')
      .send({ name: 'Expired Code', email, password: 'password123', ...VALID_PROFILE })
      .expect(201);

    const token = regRes.body.token as string;

    // Force-expire the code
    await prisma.user.update({
      where: { email },
      data: { emailVerifyExpiry: new Date(Date.now() - 1000) },
    });

    const dbUser = await prisma.user.findUnique({ where: { email } });

    await request(app)
      .post('/auth/verify-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: dbUser!.emailVerifyCode })
      .expect(400);
  });

  it('requires auth', async () => {
    await request(app)
      .post('/auth/verify-email')
      .send({ code: '123456' })
      .expect(401);
  });

  it('is a no-op if already verified', async () => {
    const email = `verify-noop-${Date.now()}${TEST_DOMAIN}`;
    const regRes = await request(app)
      .post('/auth/register')
      .send({ name: 'Already Verified', email, password: 'password123', ...VALID_PROFILE })
      .expect(201);

    const token = regRes.body.token as string;
    await prisma.user.update({ where: { email }, data: { verifiedUniversity: true } });

    const res = await request(app)
      .post('/auth/verify-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'anything' })
      .expect(200);

    expect(res.body.user.verifiedUniversity).toBe(true);
  });
});

describe('POST /auth/resend-verification', () => {
  it('generates a new code and returns 200', async () => {
    const email = `resend-test-${Date.now()}${TEST_DOMAIN}`;
    const regRes = await request(app)
      .post('/auth/register')
      .send({ name: 'Resend User', email, password: 'password123', ...VALID_PROFILE })
      .expect(201);

    const token = regRes.body.token as string;
    const before = await prisma.user.findUnique({ where: { email } });

    const res = await request(app)
      .post('/auth/resend-verification')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.message).toBeTruthy();

    const after = await prisma.user.findUnique({ where: { email } });
    // A new code should have been set (may or may not be different from before due to randomness)
    expect(after?.emailVerifyCode).toBeTruthy();
    expect(after?.emailVerifyExpiry).toBeTruthy();
    // New expiry should be later than old expiry
    if (before?.emailVerifyExpiry && after?.emailVerifyExpiry) {
      expect(after.emailVerifyExpiry.getTime()).toBeGreaterThanOrEqual(
        before.emailVerifyExpiry.getTime()
      );
    }
  });

  it('returns 400 if already verified', async () => {
    const email = `resend-already-${Date.now()}${TEST_DOMAIN}`;
    const regRes = await request(app)
      .post('/auth/register')
      .send({ name: 'Already Done', email, password: 'password123', ...VALID_PROFILE })
      .expect(201);

    const token = regRes.body.token as string;
    await prisma.user.update({ where: { email }, data: { verifiedUniversity: true } });

    await request(app)
      .post('/auth/resend-verification')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('requires auth', async () => {
    await request(app).post('/auth/resend-verification').expect(401);
  });
});

describe('Password reset', () => {
  it('stores a reset code and updates the password when the code is valid', async () => {
    const email = `reset-test-${Date.now()}${TEST_DOMAIN}`;
    const oldPassword = 'password123';
    const newPassword = 'newpassword123';

    await request(app)
      .post('/auth/register')
      .send({ name: 'Reset User', email, password: oldPassword, ...VALID_PROFILE })
      .expect(201);

    await request(app)
      .post('/auth/request-password-reset')
      .send({ email })
      .expect(200);

    const userWithCode = await prisma.user.findUnique({ where: { email } });
    expect(userWithCode?.passwordResetCode).toMatch(/^[a-f0-9]{64}$/);
    expect(userWithCode?.passwordResetExpiry).toBeTruthy();

    const resetCode = '654321';
    await prisma.user.update({
      where: { email },
      data: { passwordResetCode: hashOneTimeCode('password-reset', resetCode) },
    });

    await request(app)
      .post('/auth/reset-password')
      .send({ email, code: resetCode, password: newPassword })
      .expect(200);

    const updated = await prisma.user.findUnique({ where: { email } });
    expect(updated?.passwordResetCode).toBeNull();
    expect(updated?.passwordResetExpiry).toBeNull();

    await request(app)
      .post('/auth/login')
      .send({ email, password: oldPassword })
      .expect(401);

    await request(app)
      .post('/auth/login')
      .send({ email, password: newPassword })
      .expect(200);
  });

  it('does not reveal whether an OSU email exists when requesting a reset', async () => {
    const res = await request(app)
      .post('/auth/request-password-reset')
      .send({ email: `missing-reset-${Date.now()}${TEST_DOMAIN}` })
      .expect(200);

    expect(res.body.message).toMatch(/reset code/i);
  });

  it('rejects invalid reset codes', async () => {
    const email = `reset-invalid-${Date.now()}${TEST_DOMAIN}`;

    await request(app)
      .post('/auth/register')
      .send({ name: 'Invalid Reset', email, password: 'password123', ...VALID_PROFILE })
      .expect(201);

    await request(app)
      .post('/auth/request-password-reset')
      .send({ email })
      .expect(200);

    await request(app)
      .post('/auth/reset-password')
      .send({ email, code: '000000', password: 'newpassword123' })
      .expect(400);
  });

  it('revokes existing sessions after a successful password reset', async () => {
    const email = `reset-revoke-${Date.now()}${TEST_DOMAIN}`;
    const registration = await request(app)
      .post('/auth/register')
      .send({ name: 'Reset Revoke', email, password: 'password123', ...VALID_PROFILE })
      .expect(201);

    const resetCode = '123456';
    await prisma.user.update({
      where: { email },
      data: {
        passwordResetCode: hashOneTimeCode('password-reset', resetCode),
        passwordResetExpiry: new Date(Date.now() + 60_000),
      },
    });

    await request(app)
      .post('/auth/reset-password')
      .send({ email, code: resetCode, password: 'newpassword123' })
      .expect(200);

    await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${registration.body.token}`)
      .expect(401);
  });
});

describe('POST /auth/accept-terms', () => {
  it('records the current terms and age attestation for an existing user', async () => {
    const email = `accept-terms-${Date.now()}${TEST_DOMAIN}`;
    const registration = await request(app)
      .post('/auth/register')
      .send({ name: 'Terms Existing', email, password: 'password123', ...VALID_PROFILE })
      .expect(201);

    await prisma.user.update({
      where: { email },
      data: { termsVersion: null, termsAcceptedAt: null, ageAttestedAt: null },
    });

    const response = await request(app)
      .post('/auth/accept-terms')
      .set('Authorization', `Bearer ${registration.body.token}`)
      .send({
        termsAccepted: true,
        ageConfirmed: true,
        termsVersion: CURRENT_TERMS_VERSION,
      })
      .expect(200);

    expect(response.body.user.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(response.body.user.ageAttestedAt).toEqual(expect.any(String));
  });

  it.each(PREVIOUS_TERMS_VERSIONS)(
    'still accepts a client on previous terms version %s',
    async (oldVersion) => {
      const email = `accept-old-terms-${Date.now()}${TEST_DOMAIN}`;
      const registration = await request(app)
        .post('/auth/register')
        .send({ name: 'Old Client', email, password: 'password123', ...VALID_PROFILE })
        .expect(201);

      await prisma.user.update({
        where: { email },
        data: { termsVersion: null, termsAcceptedAt: null, ageAttestedAt: null },
      });

      const response = await request(app)
        .post('/auth/accept-terms')
        .set('Authorization', `Bearer ${registration.body.token}`)
        .send({ termsAccepted: true, ageConfirmed: true, termsVersion: oldVersion })
        .expect(200);

      // The older build showed the older text, so that is what gets recorded.
      expect(response.body.user.termsVersion).toBe(oldVersion);
    }
  );

  it('rejects an unrecognized terms version', async () => {
    const email = `accept-bogus-terms-${Date.now()}${TEST_DOMAIN}`;
    const registration = await request(app)
      .post('/auth/register')
      .send({ name: 'Bogus Client', email, password: 'password123', ...VALID_PROFILE })
      .expect(201);

    await request(app)
      .post('/auth/accept-terms')
      .set('Authorization', `Bearer ${registration.body.token}`)
      .send({ termsAccepted: true, ageConfirmed: true, termsVersion: 'not-a-version' })
      .expect(400);
  });
});
