import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';

async function createLockedPod(creatorToken: string, activityId: string, futureMinutes = 120) {
  const meetupTime = new Date(Date.now() + futureMinutes * 60 * 1000);
  const res = await request(app)
    .post('/pods/join')
    .set('Authorization', `Bearer ${creatorToken}`)
    .send({
      activityId,
      minMembers: 2,
      maxMembers: 4,
      meetupTime: meetupTime.toISOString(),
      location: 'Thompson Library',
    })
    .expect(201);
  const podId: string = res.body.id;
  await prisma.pod.update({ where: { id: podId }, data: { status: 'LOCKED' } });
  return podId;
}

async function createCompletedPod(
  creatorToken: string,
  activityId: string,
  secondUserId: string
) {
  // Create with a future time (route validates future only), then set to past + COMPLETED
  const res = await request(app)
    .post('/pods/join')
    .set('Authorization', `Bearer ${creatorToken}`)
    .send({
      activityId,
      minMembers: 2,
      maxMembers: 4,
      meetupTime: new Date(Date.now() + 86400000).toISOString(),
      location: 'Thompson Library',
    })
    .expect(201);
  const podId: string = res.body.id;

  await prisma.podMember.create({ data: { podId, userId: secondUserId } });
  await prisma.pod.update({
    where: { id: podId },
    data: {
      status: 'COMPLETED',
      meetupTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    },
  });
  return podId;
}

describe('Attendance API', () => {
  let token1: string;
  let userId1: string;
  let token2: string;
  let userId2: string;
  let activityId: string;

  beforeEach(async () => {
    const ts = Date.now();

    const user1 = await registerAndGetToken(
      'Attend User1',
      `attend1-${ts}@example.com`,
      'password123'
    );
    token1 = user1.token;
    userId1 = user1.user.id;

    const user2 = await registerAndGetToken(
      'Attend User2',
      `attend2-${ts}@example.com`,
      'password123'
    );
    token2 = user2.token;
    userId2 = user2.user.id;

    const activity = await prisma.activity.findFirst({ where: { category: 'Academic' } });
    if (!activity) throw new Error('No Academic activity in seed');
    activityId = activity.id;
  });

  // ── POST /pods/:id/confirm ──────────────────────────────────────────────

  describe('POST /pods/:id/confirm', () => {
    it('allows a member to confirm attendance on a locked pod', async () => {
      const podId = await createLockedPod(token1, activityId);

      const res = await request(app)
        .post(`/pods/${podId}/confirm`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.confirmedAt).toBeDefined();

      const member = await prisma.podMember.findUnique({
        where: { podId_userId: { podId, userId: userId1 } },
      });
      expect(member?.confirmedAt).not.toBeNull();
    });

    it('is idempotent — confirming twice still succeeds', async () => {
      const podId = await createLockedPod(token1, activityId);

      await request(app)
        .post(`/pods/${podId}/confirm`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      await request(app)
        .post(`/pods/${podId}/confirm`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);
    });

    it('rejects confirmation on a FORMING pod', async () => {
      const createRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          activityId,
          minMembers: 2,
          maxMembers: 4,
          meetupTime: new Date(Date.now() + 86400000).toISOString(),
          location: 'Thompson Library',
        })
        .expect(201);

      await request(app)
        .post(`/pods/${createRes.body.id}/confirm`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(400);
    });

    it('rejects confirmation on a COMPLETED pod', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      await request(app)
        .post(`/pods/${podId}/confirm`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(400);
    });

    it('rejects confirmation when meetupTime has passed', async () => {
      const createRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          activityId,
          minMembers: 2,
          maxMembers: 4,
          meetupTime: new Date(Date.now() + 86400000).toISOString(),
          location: 'Thompson Library',
        })
        .expect(201);
      const podId = createRes.body.id;
      // Set status LOCKED and meetupTime to the past via Prisma directly
      await prisma.pod.update({
        where: { id: podId },
        data: { status: 'LOCKED', meetupTime: new Date(Date.now() - 60 * 1000) },
      });

      await request(app)
        .post(`/pods/${podId}/confirm`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(400);
    });

    it('rejects confirmation from a non-member', async () => {
      const podId = await createLockedPod(token1, activityId);

      await request(app)
        .post(`/pods/${podId}/confirm`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(403);
    });

    it('returns 401 without auth', async () => {
      const podId = await createLockedPod(token1, activityId);
      await request(app).post(`/pods/${podId}/confirm`).expect(401);
    });
  });

  // ── POST /pods/:id/no-show/:userId ──────────────────────────────────────

  describe('POST /pods/:id/no-show/:userId', () => {
    it('allows a member to report another member as a no-show', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      const res = await request(app)
        .post(`/pods/${podId}/no-show/${userId2}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.reported).toBe(true);

      const report = await prisma.noShowReport.findUnique({
        where: {
          podId_reporterId_targetUserId: { podId, reporterId: userId1, targetUserId: userId2 },
        },
      });
      expect(report).not.toBeNull();
    });

    it('is idempotent — reporting the same person twice succeeds', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      await request(app)
        .post(`/pods/${podId}/no-show/${userId2}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      await request(app)
        .post(`/pods/${podId}/no-show/${userId2}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);
    });

    it('rejects self-report', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      const res = await request(app)
        .post(`/pods/${podId}/no-show/${userId1}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(400);

      expect(res.body.error).toMatch(/yourself/);
    });

    it('rejects no-show report on a non-COMPLETED pod', async () => {
      const podId = await createLockedPod(token1, activityId);
      await prisma.podMember.create({ data: { podId, userId: userId2 } });

      await request(app)
        .post(`/pods/${podId}/no-show/${userId2}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(400);
    });

    it('rejects report from a non-member', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      const { token: outsiderToken } = await registerAndGetToken(
        'Outsider',
        `outsider-${Date.now()}@example.com`,
        'password123'
      );

      await request(app)
        .post(`/pods/${podId}/no-show/${userId2}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });

    it('rejects report if target was not a pod member', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      const { user: outsider } = await registerAndGetToken(
        'Non-member',
        `nonmember-${Date.now()}@example.com`,
        'password123'
      );

      await request(app)
        .post(`/pods/${podId}/no-show/${outsider.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(404);
    });

    it('returns 401 without auth', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);
      await request(app).post(`/pods/${podId}/no-show/${userId2}`).expect(401);
    });
  });

  // ── Reliability score on GET /users/:id ────────────────────────────────

  describe('GET /users/:id reliability score', () => {
    it('returns null reliabilityScore when user has no completed pods', async () => {
      const res = await request(app)
        .get(`/users/${userId1}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.podsJoined).toBe(0);
      expect(res.body.podsAttended).toBe(0);
      expect(res.body.reliabilityScore).toBeNull();
    });

    it('reflects a no-show report in the reliability score', async () => {
      const podId = await createCompletedPod(token1, activityId, userId2);

      // Confirm user1 is a member
      const member1 = await prisma.podMember.findUnique({
        where: { podId_userId: { podId, userId: userId1 } },
      });
      expect(member1).not.toBeNull();

      // user1 reports user2 as no-show
      await request(app)
        .post(`/pods/${podId}/no-show/${userId2}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const res = await request(app)
        .get(`/users/${userId2}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.podsJoined).toBe(1);
      expect(res.body.podsAttended).toBe(0);
      expect(res.body.reliabilityScore).toBe(0);
    });

    it('shows 100% reliability with no no-show reports', async () => {
      await createCompletedPod(token1, activityId, userId2);

      const res = await request(app)
        .get(`/users/${userId1}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.podsJoined).toBe(1);
      expect(res.body.podsAttended).toBe(1);
      expect(res.body.reliabilityScore).toBe(100);
    });
  });
});
