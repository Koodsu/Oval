import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';

describe('GET /users/:id', () => {
  it('returns public profile with podsAttended=0 and verifiedUniversity=false for new user', async () => {
    const { token, user } = await registerAndGetToken(
      'Profile User',
      `profile-get-${Date.now()}@example.com`,
      'password123'
    );

    const res = await request(app)
      .get(`/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: user.id,
      name: user.name,
      verifiedUniversity: false,
      podsAttended: 0,
      joinedAt: expect.any(String),
    });
  });

  it('counts only COMPLETED pods in podsAttended', async () => {
    const { token, user } = await registerAndGetToken(
      'Attended User',
      `attended-${Date.now()}@example.com`,
      'password123'
    );

    const activity = await prisma.activity.findFirst({ where: { category: 'Academic' } });
    if (!activity) throw new Error('No activity');

    // Create a COMPLETED pod and add the user as a member
    const pod = await prisma.pod.create({
      data: {
        activityId: activity.id,
        meetupTime: new Date(Date.now() - 3600000),
        location: 'Main Library',
        status: 'COMPLETED',
        creatorId: user.id,
        members: { create: { userId: user.id } },
      },
    });

    const res = await request(app)
      .get(`/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.podsAttended).toBe(1);

    await prisma.podMember.deleteMany({ where: { podId: pod.id } });
    await prisma.pod.delete({ where: { id: pod.id } });
  });

  it('reflects verifiedUniversity: true after DB update', async () => {
    const { token, user } = await registerAndGetToken(
      'Verified Profile',
      `verified-profile-${Date.now()}@example.com`,
      'password123'
    );

    await prisma.user.update({ where: { id: user.id }, data: { verifiedUniversity: true } });

    const res = await request(app)
      .get(`/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.verifiedUniversity).toBe(true);
  });

  it('returns 404 for non-existent user', async () => {
    const { token } = await registerAndGetToken(
      'Auth User',
      `auth-404-${Date.now()}@example.com`,
      'password123'
    );

    await request(app)
      .get('/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('requires auth', async () => {
    await request(app).get('/users/some-id').expect(401);
  });
});

describe('Block API (integration)', () => {
  let tokenA: string;
  let userIdA: string;
  let tokenB: string;
  let userIdB: string;
  let activityId: string;

  beforeEach(async () => {
    const a = await registerAndGetToken(
      'User A',
      `block-test-a-${Date.now()}@example.com`,
      'password123'
    );
    const b = await registerAndGetToken(
      'User B',
      `block-test-b-${Date.now()}@example.com`,
      'password123'
    );
    tokenA = a.token;
    userIdA = a.user.id;
    tokenB = b.token;
    userIdB = b.user.id;

    const activity = await prisma.activity.findFirst({
      where: { category: 'Academic' },
    });
    if (!activity) throw new Error('No activities in seed');
    activityId = activity.id;
  });

  describe('POST /users/:id/block', () => {
    it('cannot block self', async () => {
      const res = await request(app)
        .post(`/users/${userIdA}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.error).toContain("can't block yourself");
    });

    it('returns 404 for non-existent user', async () => {
      await request(app)
        .post('/users/00000000-0000-0000-0000-000000000000/block')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });

    it('creates block and returns success', async () => {
      const res = await request(app)
        .post(`/users/${userIdB}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.blockId).toBeDefined();
      expect(res.body.createdAt).toBeDefined();

      const block = await prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: userIdA, blockedId: userIdB } },
      });
      expect(block).toBeTruthy();
    });

    it('idempotent: returns success when already blocked', async () => {
      await request(app)
        .post(`/users/${userIdB}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const res = await request(app)
        .post(`/users/${userIdB}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const count = await prisma.block.count({
        where: { blockerId: userIdA, blockedId: userIdB },
      });
      expect(count).toBe(1);
    });

    it('rejects unauthenticated requests', async () => {
      await request(app).post(`/users/${userIdB}/block`).expect(401);
    });
  });

  describe('DELETE /users/:id/block', () => {
    it('removes block and returns success', async () => {
      await prisma.block.create({
        data: { blockerId: userIdA, blockedId: userIdB },
      });

      const res = await request(app)
        .delete(`/users/${userIdB}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const block = await prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: userIdA, blockedId: userIdB } },
      });
      expect(block).toBeNull();
    });

    it('idempotent: returns 204 when no block exists', async () => {
      await request(app)
        .delete(`/users/${userIdB}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);
    });

    it('rejects unauthenticated requests', async () => {
      await request(app).delete(`/users/${userIdB}/block`).expect(401);
    });
  });
});
