import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';

describe('Messages API (integration)', () => {
  let token: string;
  let userId: string;
  let podId: string;

  beforeEach(async () => {
    const { token: t, user } = await registerAndGetToken(
      'Message Tester',
      `msg-test-${Date.now()}@example.com`,
      'password123'
    );
    token = t;
    userId = user.id;

    const activity = await prisma.activity.findFirst({
      where: { category: 'Academic' },
    });
    if (!activity) throw new Error('No Academic activity in seed');

    const meetupTime = new Date(Date.now() + 86400000);
    const createRes = await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${token}`)
      .send({
        activityId: activity.id,
        meetupTime: meetupTime.toISOString(),
        location: 'Thompson Library',
      })
      .expect(201);

    podId = createRes.body.id;
  });

  describe('GET /pods/:id/messages', () => {
    it('returns empty array when no messages', async () => {
      const res = await request(app)
        .get(`/pods/${podId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns 403 for non-member', async () => {
      const { token: otherToken } = await registerAndGetToken(
        'Stranger',
        `stranger-${Date.now()}@example.com`,
        'pass'
      );

      await request(app)
        .get(`/pods/${podId}/messages`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });

  describe('POST /pods/:id/messages', () => {
    it('creates a message and returns it', async () => {
      const res = await request(app)
        .post(`/pods/${podId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello, pod!' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.content).toBe('Hello, pod!');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBeDefined();
    });

    it('rejects empty content', async () => {
      await request(app)
        .post(`/pods/${podId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '' })
        .expect(400);

      await request(app)
        .post(`/pods/${podId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '   ' })
        .expect(400);
    });

    it('messages appear in GET', async () => {
      await request(app)
        .post(`/pods/${podId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'First message' })
        .expect(201);

      const res = await request(app)
        .get(`/pods/${podId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].content).toBe('First message');
    });

    it('cannot message when blocked relationship exists', async () => {
      const { token: tokenB, user: userB } = await registerAndGetToken(
        'Block Msg B',
        `block-msg-b-${Date.now()}@example.com`,
        'pass'
      );

      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ podId })
        .expect(201);

      await prisma.block.create({
        data: { blockerId: userB.id, blockedId: userId },
      });

      await request(app)
        .post(`/pods/${podId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Should fail' })
        .expect(403);
    });
  });
});
