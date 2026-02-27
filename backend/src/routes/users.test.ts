import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';

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
