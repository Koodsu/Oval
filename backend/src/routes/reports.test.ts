import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken, getAuthToken, createTestUser } from '../test/helpers';
import { CURRENT_TERMS_VERSION } from '../config/legal';

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
      expect(res.body.severity).toBe('P1');

      const report = await prisma.report.findUnique({
        where: { id: res.body.reportId },
      });
      expect(report?.targetUserId).toBe(otherUserId);
      expect(report?.severity).toBe('P1');
      expect(report?.moderationEmailSentAt).toBeTruthy();
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

    it('deduplicates the same open report within 24 hours', async () => {
      const first = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetUserId: otherUserId, reason: 'HARASSMENT' })
        .expect(201);

      const second = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetUserId: otherUserId, reason: 'HARASSMENT' })
        .expect(201);

      expect(second.body.reportId).toBe(first.body.reportId);
      const reports = await prisma.report.findMany({
        where: { reporterId: userId, targetUserId: otherUserId, reason: 'HARASSMENT' },
      });
      expect(reports).toHaveLength(1);
    });

    it('marks urgent safety reasons as P0', async () => {
      const res = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetUserId: otherUserId, reason: 'VIOLENCE_THREATS' })
        .expect(201);

      expect(res.body.severity).toBe('P0');
      const report = await prisma.report.findUnique({ where: { id: res.body.reportId } });
      expect(report?.severity).toBe('P0');
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
      expect(res.body[0].severity).toBe('P2');
      expect(res.body[0].status).toBe('OPEN');
      expect(res.body[0].adminNotes).toBeUndefined();
    });

    it('requires auth', async () => {
      await request(app).get('/reports/mine').expect(401);
    });
  });

  describe('Admin endpoints', () => {
    let adminUserId: string;
    let adminToken: string;

    beforeEach(async () => {
      const admin = await createTestUser({ email: `admin-${Date.now()}@osu.edu` });
      adminUserId = admin.id;
      adminToken = getAuthToken(admin.id, admin.email);
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

      const res = await request(app)
        .get('/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.reports).toBeDefined();
      expect(res.body.reports.length).toBeGreaterThanOrEqual(1);
      const report = res.body.reports.find((r: { podId: string }) => r.podId === podId);
      expect(report).toBeDefined();
      expect(report.adminNotes).toBeDefined();
      expect(report.severity).toBe('P2');
      expect(report.moderationEmailSentAt).toBeTruthy();
    });

    it('admin can filter reports by severity', async () => {
      await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ podId, reason: 'VIOLENCE_THREATS' })
        .expect(201);

      const res = await request(app)
        .get('/admin/reports?severity=P0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.reports.length).toBeGreaterThanOrEqual(1);
      expect(res.body.reports.every((r: { severity: string }) => r.severity === 'P0')).toBe(true);
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

    it('admin can remove reported content and suspend its author', async () => {
      const createRes = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId, podId, reason: 'HARASSMENT' })
        .expect(201);
      const targetBefore = await prisma.user.findUnique({ where: { id: otherUserId } });

      await request(app)
        .patch(`/admin/reports/${createRes.body.reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'RESOLVED',
          adminNotes: 'Removed abusive content and suspended the account.',
          removeContent: true,
          accountAction: 'SUSPEND',
        })
        .expect(200);

      expect(await prisma.message.findUnique({ where: { id: messageId } })).toBeNull();
      const targetAfter = await prisma.user.findUnique({ where: { id: otherUserId } });
      expect(targetAfter?.accountStatus).toBe('SUSPENDED');
      expect(targetAfter?.tokenVersion).toBe((targetBefore?.tokenVersion ?? 0) + 1);

      const report = await prisma.report.findUnique({ where: { id: createRes.body.reportId } });
      expect(report?.contentRemovedAt).toBeTruthy();
      expect(report?.accountAction).toBe('SUSPEND');
    });

    it('admin bans revoke the target session and block re-registration', async () => {
      const target = await prisma.user.findUniqueOrThrow({ where: { id: otherUserId } });
      const targetToken = getAuthToken(target.id, target.email);
      const createRes = await request(app)
        .post('/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetUserId: otherUserId, reason: 'VIOLENCE_THREATS' })
        .expect(201);

      await request(app)
        .patch(`/admin/reports/${createRes.body.reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED', accountAction: 'BAN', adminNotes: 'Credible threat.' })
        .expect(200);

      await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${targetToken}`)
        .expect(401);

      await prisma.user.delete({ where: { id: otherUserId } });
      await request(app)
        .post('/auth/register')
        .send({
          name: 'Banned Return',
          email: target.email,
          password: 'password123',
          classYear: 'Freshman',
          major: 'Computer Science',
          termsAccepted: true,
          ageConfirmed: true,
          termsVersion: CURRENT_TERMS_VERSION,
        })
        .expect(403);
    });
  });
});
