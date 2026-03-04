import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';

// Prevent real Expo push calls during integration tests
vi.mock('../lib/NotificationService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/NotificationService')>();
  return {
    ...actual,
    NotificationService: {
      notifyPodJoin: vi.fn().mockResolvedValue(undefined),
      notifyNewMessage: vi.fn().mockResolvedValue(undefined),
      sendMeetupReminders: vi.fn().mockResolvedValue(undefined),
    },
  };
});

describe('Push Token API (integration)', () => {
  let token: string;

  beforeEach(async () => {
    const result = await registerAndGetToken(
      'Token Tester',
      `push-token-${Date.now()}@example.com`,
      'password123'
    );
    token = result.token;
  });

  describe('POST /users/push-token', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app)
        .post('/users/push-token')
        .send({ token: 'ExponentPushToken[xxx]' })
        .expect(401);
    });

    it('rejects missing token', async () => {
      const res = await request(app)
        .post('/users/push-token')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
      expect(res.body.error).toContain('token is required');
    });

    it('rejects invalid Expo push token format', async () => {
      const res = await request(app)
        .post('/users/push-token')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'not-a-valid-expo-token' })
        .expect(400);
      expect(res.body.error).toContain('Invalid Expo push token');
    });

    it('saves valid Expo push token', async () => {
      const expoToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
      const res = await request(app)
        .post('/users/push-token')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: expoToken })
        .expect(200);
      expect(res.body.success).toBe(true);
    });
  });
});

describe('Notification Preferences API (integration)', () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const result = await registerAndGetToken(
      'Prefs Tester',
      `notif-prefs-${Date.now()}@example.com`,
      'password123'
    );
    token = result.token;
    userId = result.user.id;
  });

  describe('PATCH /users/notifications', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app)
        .patch('/users/notifications')
        .send({ podJoin: false })
        .expect(401);
    });

    it('rejects non-boolean preference values', async () => {
      const res = await request(app)
        .patch('/users/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ podJoin: 'yes' })
        .expect(400);
      expect(res.body.error).toContain('booleans');
    });

    it('updates a single preference and returns all prefs', async () => {
      const res = await request(app)
        .patch('/users/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ podJoin: false })
        .expect(200);

      expect(res.body.notificationPreferences.podJoin).toBe(false);
      expect(res.body.notificationPreferences.newMessage).toBe(true);
      expect(res.body.notificationPreferences.meetupReminder).toBe(true);
    });

    it('merges multiple preferences', async () => {
      const res = await request(app)
        .patch('/users/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ podJoin: false, meetupReminder: false })
        .expect(200);

      expect(res.body.notificationPreferences.podJoin).toBe(false);
      expect(res.body.notificationPreferences.newMessage).toBe(true);
      expect(res.body.notificationPreferences.meetupReminder).toBe(false);
    });

    it('persists preferences to the database', async () => {
      await request(app)
        .patch('/users/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ newMessage: false })
        .expect(200);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      const stored = JSON.parse(user!.notificationPreferences!);
      expect(stored.newMessage).toBe(false);
    });

    it('successive updates are cumulative', async () => {
      await request(app)
        .patch('/users/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ podJoin: false })
        .expect(200);

      const res = await request(app)
        .patch('/users/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ meetupReminder: false })
        .expect(200);

      expect(res.body.notificationPreferences.podJoin).toBe(false);
      expect(res.body.notificationPreferences.meetupReminder).toBe(false);
    });
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
