import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken, getAuthToken } from '../test/helpers';

describe('Reports API', () => {
  let token: string;
  let userId: string;
  let podId: string;
  let messageId: string;
  let otherUserId: string;

  beforeEach(async () => {
    const { token: t, user } = await registerAndGetToken(
      'Report Tester',
      `report-test-${Date.now()}@example.com`,
      'password123'
    );
    token = t;
    userId = user.id;

    const activity = await prisma.activity.findFirst({ where: { category: 'Academic' } });
    if (!activity) throw new Error('No activity in seed');

    const createRes = await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${token}`)
      .send({
        activityId: activity.id,
        meetupTime: new Date(Date.now() + 86400000).toISOString(),
        location: 'Thompson Library',
      })
      .expect(201);

    podId = createRes.body.id;

    const { token: otherToken, user: otherUser } = await registerAndGetToken(
      'Other User',
      `other-${Date.now()}@example.com`,
      'password123'
    );
    otherUserId = otherUser.id;

    await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ podId })
      .expect(201);

    const msgRes = await request(app)
      .post(`/pods/${podId}/messages`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ content: 'A message to report' })
      .expect(201);

    messageId = msgRes.body.id;
  });

  describe('POST /reports', () => {
    it('must include at least one target (podId, messageId, or targetUserId)', async () => {
      await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'SPAM' })
        .expect(400);
    });

    it('cannot report self (targetUserId)', async () => {
      await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetUserId: userId, reason: 'SPAM' })
        .expect(400);
    });

    it('cannot report own message', async () => {
      const msgRes = await request(app)
        .post(`/pods/${podId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'My own message' })
        .expect(201);

      await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId: msgRes.body.id, podId, reason: 'SPAM' })
        .expect(400);
    });

    it('messageId auto-populates targetUserId', async () => {
      const res = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId, podId, reason: 'HARASSMENT', details: 'Bad message' })
        .expect(201);

      expect(res.body.reportId).toBeDefined();
      expect(res.body.status).toBe('OPEN');

      const report = await prisma.report.findUnique({
        where: { id: res.body.reportId },
      });
      expect(report?.targetUserId).toBe(otherUserId);
    });

    it('messageId must match podId when both provided', async () => {
      const activity = await prisma.activity.findFirst({
        where: { category: 'Social' },
      });
      if (!activity) throw new Error('No Social activity');

      const otherPodRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId: activity.id,
          meetupTime: new Date(Date.now() + 86400000).toISOString(),
          location: 'Student Union',
        })
        .expect(201);

      await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId, podId: otherPodRes.body.id, reason: 'SPAM' })
        .expect(400);
    });

    it('creates report for pod only', async () => {
      const res = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ podId, reason: 'SPAM', details: 'Unsafe group' })
        .expect(201);

      expect(res.body.reportId).toBeDefined();
      expect(res.body.status).toBe('OPEN');

      const report = await prisma.report.findUnique({
        where: { id: res.body.reportId },
      });
      expect(report?.podId).toBe(podId);
      expect(report?.messageId).toBeNull();
      expect(report?.targetUserId).toBeNull();
    });

    it('creates report for user only', async () => {
      const res = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetUserId: otherUserId, reason: 'HARASSMENT' })
        .expect(201);

      expect(res.body.reportId).toBeDefined();
      const report = await prisma.report.findUnique({
        where: { id: res.body.reportId },
      });
      expect(report?.targetUserId).toBe(otherUserId);
    });

    it('requires auth', async () => {
      await request(app)
        .post('/reports')
        .send({ podId, reason: 'SPAM' })
        .expect(401);
    });

    it('rejects invalid reason', async () => {
      await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ podId, reason: 'INVALID_REASON' })
        .expect(400);
    });
  });

  describe('GET /reports/mine', () => {
    it('returns user reports', async () => {
      await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ podId, reason: 'SPAM' })
        .expect(201);

      const res = await request(app)
        .get('/reports/mine')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].reason).toBe('SPAM');
      expect(res.body[0].status).toBe('OPEN');
      expect(res.body[0].adminNotes).toBeUndefined();
    });

    it('requires auth', async () => {
      await request(app).get('/reports/mine').expect(401);
    });
  });

  describe('Admin endpoints', () => {
    const adminUserId = 'admin-user-id-for-tests';

    beforeEach(() => {
      process.env.ADMIN_USER_IDS = adminUserId;
    });

    it('GET /admin/reports requires admin', async () => {
      await request(app)
        .get('/admin/reports')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('admin can list reports', async () => {
      await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ podId, reason: 'SPAM' })
        .expect(201);

      const adminToken = getAuthToken(adminUserId, 'admin@test.com');

      const res = await request(app)
        .get('/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.reports).toBeDefined();
      expect(res.body.reports.length).toBeGreaterThanOrEqual(1);
      const report = res.body.reports.find((r: { podId: string }) => r.podId === podId);
      expect(report).toBeDefined();
      expect(report.adminNotes).toBeDefined();
    });

    it('non-admin cannot see adminNotes in GET /reports/mine', async () => {
      const createRes = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ podId, reason: 'SPAM' })
        .expect(201);

      await prisma.report.update({
        where: { id: createRes.body.reportId },
        data: { adminNotes: 'Secret admin note' },
      });

      const res = await request(app)
        .get('/reports/mine')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body[0].adminNotes).toBeUndefined();
    });

    it('PATCH /admin/reports/:id requires admin', async () => {
      const createRes = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ podId, reason: 'SPAM' })
        .expect(201);

      await request(app)
        .patch(`/admin/reports/${createRes.body.reportId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'RESOLVED' })
        .expect(403);
    });
  });
});
