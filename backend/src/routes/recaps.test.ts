import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';

async function createCompletedPod(creatorToken: string, activityId: string, secondUserId: string) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { defaultLocation: true } });
  const res = await request(app)
    .post('/pods/join')
    .set('Authorization', `Bearer ${creatorToken}`)
    .send({
      activityId,
      minMembers: 2,
      maxMembers: 4,
      meetupTime: new Date(Date.now() + 86400000).toISOString(),
      location: activity?.defaultLocation ?? 'Thompson Library',
    })
    .expect(201);
  const podId: string = res.body.id;

  await prisma.podMember.create({ data: { podId, userId: secondUserId } });
  await prisma.pod.update({
    where: { id: podId },
    data: { status: 'COMPLETED', meetupTime: new Date(Date.now() - 60 * 60 * 1000) },
  });
  return podId;
}

describe('Recaps API', () => {
  let token1: string;
  let userId1: string;
  let token2: string;
  let userId2: string;
  let tokenOutsider: string;
  let activityId: string;

  beforeEach(async () => {
    const u1 = await registerAndGetToken('Recap User1', 'recap1', 'password123');
    token1 = u1.token;
    userId1 = u1.user.id;

    const u2 = await registerAndGetToken('Recap User2', 'recap2', 'password123');
    token2 = u2.token;
    userId2 = u2.user.id;

    const u3 = await registerAndGetToken('Recap Outsider', 'recapout', 'password123');
    tokenOutsider = u3.token;

    const activity = await prisma.activity.findFirst();
    activityId = activity!.id;
  });

  describe('POST /pods/:id/recap', () => {
    it('submits a recap with rating 3', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      const res = await request(app)
        .post(`/pods/${podId}/recap`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ rating: 3 })
        .expect(200);

      expect(res.body.rating).toBe(3);
      expect(res.body.podId).toBe(podId);
      expect(res.body.userId).toBe(userId1);
      expect(res.body.note).toBeNull();
    });

    it('submits a recap with a note', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      const res = await request(app)
        .post(`/pods/${podId}/recap`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ rating: 2, note: 'Pretty fun!' })
        .expect(200);

      expect(res.body.rating).toBe(2);
      expect(res.body.note).toBe('Pretty fun!');
    });

    it('updates an existing recap (upsert)', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      await request(app)
        .post(`/pods/${podId}/recap`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ rating: 1 })
        .expect(200);

      const res = await request(app)
        .post(`/pods/${podId}/recap`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ rating: 3, note: 'Changed my mind!' })
        .expect(200);

      expect(res.body.rating).toBe(3);
      expect(res.body.note).toBe('Changed my mind!');
    });

    it('rejects invalid rating values', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      await request(app)
        .post(`/pods/${podId}/recap`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ rating: 5 })
        .expect(400);
    });

    it('rejects recap for non-completed pod', async () => {
      const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { defaultLocation: true } });
      const res = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          activityId,
          minMembers: 2,
          maxMembers: 4,
          meetupTime: new Date(Date.now() + 86400000).toISOString(),
          location: activity?.defaultLocation ?? 'Thompson Library',
        })
        .expect(201);
      const podId: string = res.body.id;

      await request(app)
        .post(`/pods/${podId}/recap`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ rating: 3 })
        .expect(400);
    });

    it('rejects recap from non-member', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      await request(app)
        .post(`/pods/${podId}/recap`)
        .set('Authorization', `Bearer ${tokenOutsider}`)
        .send({ rating: 3 })
        .expect(403);
    });

    it('requires auth', async () => {
      await request(app)
        .post('/pods/some-id/recap')
        .send({ rating: 3 })
        .expect(401);
    });
  });

  describe('GET /pods/:id/recap', () => {
    it('returns null when no recap submitted', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      const res = await request(app)
        .get(`/pods/${podId}/recap`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body).toBeNull();
    });

    it('returns the submitted recap', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      await request(app)
        .post(`/pods/${podId}/recap`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ rating: 3, note: 'Great time!' })
        .expect(200);

      const res = await request(app)
        .get(`/pods/${podId}/recap`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.rating).toBe(3);
      expect(res.body.note).toBe('Great time!');
    });

    it('returns null for other user with no recap', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      await request(app)
        .post(`/pods/${podId}/recap`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ rating: 3 })
        .expect(200);

      const res = await request(app)
        .get(`/pods/${podId}/recap`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(res.body).toBeNull();
    });
  });

  describe('GET /pods/:id includes averageRating', () => {
    it('includes averageRating and myRecap for completed pods', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      await request(app)
        .post(`/pods/${podId}/recap`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ rating: 3 })
        .expect(200);

      await request(app)
        .post(`/pods/${podId}/recap`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ rating: 1 })
        .expect(200);

      const res = await request(app)
        .get(`/pods/${podId}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.averageRating).toBe(2); // (3+1)/2
      expect(res.body.myRecap).toBeDefined();
      expect(res.body.myRecap.rating).toBe(3);
    });

    it('averageRating is null when no recaps exist', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      const res = await request(app)
        .get(`/pods/${podId}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.averageRating).toBeNull();
      expect(res.body.myRecap).toBeNull();
    });
  });
});
