import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';

describe('POST /auth/register', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: '@test-register.' } } });
  });

  it('creates a user and returns token', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        name: 'Alice',
        email: 'alice@test-register.com',
        password: 'securepass123',
      })
      .expect(201);

    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toEqual({
      id: expect.any(String),
      name: 'Alice',
      email: 'alice@test-register.com',
    });
    expect(res.body.user.id).toHaveLength(36); // UUID format
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

  it('rejects duplicate email', async () => {
    const email = 'dup@test-register.com';
    await request(app)
      .post('/auth/register')
      .send({ name: 'First', email, password: 'pass' })
      .expect(201);

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Second', email, password: 'pass' })
      .expect(409);

    expect(res.body.error).toContain('already in use');
  });
});

describe('POST /auth/login', () => {
  const email = 'login-test@test-register.com';
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
