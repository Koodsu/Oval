import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';

describe('Pod Waitlist API', () => {
  let creatorToken: string;
  let creatorId: string;
  let joinerToken: string;
  let joinerId: string;
  let waiterToken: string;
  let waiterId: string;
  let activityId: string;
  const validLocation = 'Thompson Library';

  beforeEach(async () => {
    const c = await registerAndGetToken('Creator', `wl-creator-${Date.now()}@example.com`, 'password123');
    creatorToken = c.token;
    creatorId = c.user.id;

    const j = await registerAndGetToken('Joiner', `wl-joiner-${Date.now()}@example.com`, 'password123');
    joinerToken = j.token;
    joinerId = j.user.id;

    const w = await registerAndGetToken('Waiter', `wl-waiter-${Date.now()}@example.com`, 'password123');
    waiterToken = w.token;
    waiterId = w.user.id;

    const activity = await prisma.activity.findFirst({ where: { category: 'Academic' } });
    if (!activity) throw new Error('No activities in seed');
    activityId = activity.id;
  });

  async function createFullPod(): Promise<string> {
    const res = await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        activityId,
        minMembers: 2,
        maxMembers: 2,
        meetupTime: new Date(Date.now() + 86400000).toISOString(),
        location: validLocation,
      })
      .expect(201);
    const podId = res.body.id;

    // Second user joins, filling the pod (auto-locks)
    await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${joinerToken}`)
      .send({ podId })
      .expect(201);

    // Unlock so it's FORMING but full
    await prisma.pod.update({ where: { id: podId }, data: { status: 'FORMING' } });
    return podId;
  }

  describe('POST /pods/:id/waitlist', () => {
    it('allows joining the waitlist when pod is full', async () => {
      const podId = await createFullPod();

      const res = await request(app)
        .post(`/pods/${podId}/waitlist`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(201);

      expect(res.body.position).toBe(1);
    });

    it('rejects when pod is not full', async () => {
      const createRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          activityId,
          minMembers: 2,
          maxMembers: 4,
          meetupTime: new Date(Date.now() + 86400000).toISOString(),
          location: validLocation,
        })
        .expect(201);

      await request(app)
        .post(`/pods/${createRes.body.id}/waitlist`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(400);
    });

    it('rejects duplicate waitlist entries', async () => {
      const podId = await createFullPod();

      await request(app)
        .post(`/pods/${podId}/waitlist`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(201);

      await request(app)
        .post(`/pods/${podId}/waitlist`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(409);
    });

    it('rejects existing members', async () => {
      const podId = await createFullPod();

      await request(app)
        .post(`/pods/${podId}/waitlist`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(409);
    });
  });

  describe('GET /pods/:id/waitlist', () => {
    it('returns count and position', async () => {
      const podId = await createFullPod();

      await request(app)
        .post(`/pods/${podId}/waitlist`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(201);

      const res = await request(app)
        .get(`/pods/${podId}/waitlist`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(200);

      expect(res.body.count).toBe(1);
      expect(res.body.myPosition).toBe(1);
    });

    it('returns null position for non-waitlisted user', async () => {
      const podId = await createFullPod();

      const res = await request(app)
        .get(`/pods/${podId}/waitlist`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(200);

      expect(res.body.count).toBe(0);
      expect(res.body.myPosition).toBeNull();
    });
  });

  describe('DELETE /pods/:id/waitlist', () => {
    it('removes user from waitlist', async () => {
      const podId = await createFullPod();

      await request(app)
        .post(`/pods/${podId}/waitlist`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(201);

      await request(app)
        .delete(`/pods/${podId}/waitlist`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(200);

      const info = await request(app)
        .get(`/pods/${podId}/waitlist`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(200);

      expect(info.body.count).toBe(0);
      expect(info.body.myPosition).toBeNull();
    });

    it('rejects when not on the waitlist', async () => {
      const podId = await createFullPod();

      await request(app)
        .delete(`/pods/${podId}/waitlist`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(404);
    });
  });

  describe('waitlist + leave integration', () => {
    it('includes waitlist info in GET /pods/:id', async () => {
      const podId = await createFullPod();

      await request(app)
        .post(`/pods/${podId}/waitlist`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(201);

      const res = await request(app)
        .get(`/pods/${podId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .expect(200);

      expect(res.body.waitlistCount).toBe(1);
    });

    it('marks waitlisted user as JOINED when they join', async () => {
      const podId = await createFullPod();

      await request(app)
        .post(`/pods/${podId}/waitlist`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(201);

      // Make room by having the joiner leave
      await request(app)
        .post(`/pods/${podId}/leave`)
        .set('Authorization', `Bearer ${joinerToken}`)
        .expect(200);

      // Now increase maxMembers so the waiter can join
      await prisma.pod.update({ where: { id: podId }, data: { maxMembers: 3 } });

      // Waiter joins
      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ podId })
        .expect(201);

      // Verify waitlist entry status is JOINED
      const entry = await prisma.podWaitlist.findUnique({
        where: { podId_userId: { podId, userId: waiterId } },
      });
      expect(entry?.status).toBe('JOINED');
    });
  });
});
