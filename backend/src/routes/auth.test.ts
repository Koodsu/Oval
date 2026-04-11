import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';

const TEST_DOMAIN = '@osu.edu';

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
  });

  it('accepts @buckeyemail.osu.edu email', async () => {
    const email = `buckeye-test-register-${Date.now()}@buckeyemail.osu.edu`;
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Buckeye', email, password: 'password123' })
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
      .send({ name: 'First', email, password: 'password123' })
      .expect(201);

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Second', email, password: 'password123' })
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
      .send({ name: 'Login User', email, password })
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
      .send({ name: 'Verify User', email, password: 'password123' })
      .expect(201);

    const token = regRes.body.token as string;

    // Fetch the stored code directly from DB
    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser?.emailVerifyCode).toBeTruthy();

    const verifyRes = await request(app)
      .post('/auth/verify-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: dbUser!.emailVerifyCode })
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
      .send({ name: 'Bad Code', email, password: 'password123' })
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
      .send({ name: 'Expired Code', email, password: 'password123' })
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
      .send({ name: 'Already Verified', email, password: 'password123' })
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
      .send({ name: 'Resend User', email, password: 'password123' })
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
      .send({ name: 'Already Done', email, password: 'password123' })
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
