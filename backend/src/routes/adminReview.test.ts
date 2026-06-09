import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { createAdminReviewToken } from '../lib/adminReviewToken';
import { createTestUser } from '../test/helpers';

const originalSecret = process.env.ADMIN_REVIEW_SECRET;

describe('signed admin report review page', () => {
  beforeEach(() => {
    process.env.ADMIN_REVIEW_SECRET = 'integration-test-review-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.ADMIN_REVIEW_SECRET;
    else process.env.ADMIN_REVIEW_SECRET = originalSecret;
  });

  it('loads and enforces moderation actions only with a valid report token', async () => {
    const reporter = await createTestUser();
    const target = await createTestUser();
    const pod = await prisma.pod.findFirstOrThrow();
    const message = await prisma.message.create({
      data: {
        podId: pod.id,
        userId: target.id,
        content: 'Reported abusive content',
      },
    });
    const report = await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetUserId: target.id,
        podId: pod.id,
        messageId: message.id,
        reason: 'HARASSMENT',
        severity: 'P1',
        targetType: 'POD_MESSAGE',
        details: 'Repeated abusive messages',
      },
    });
    const signed = createAdminReviewToken(report.id)!;
    const query = `expires=${signed.expires}&token=${signed.token}`;

    await request(app)
      .get(`/admin/reports/review/${report.id}?${query}`)
      .expect(200)
      .expect(/Repeated abusive messages/);

    await request(app)
      .post(`/admin/reports/review/${report.id}`)
      .type('form')
      .send({
        expires: String(signed.expires),
        token: signed.token,
        status: 'RESOLVED',
        adminNotes: 'User warned and content removed.',
        removeContent: 'true',
        accountAction: 'SUSPEND',
      })
      .expect(200)
      .expect(/Review updated/);

    const updated = await prisma.report.findUnique({ where: { id: report.id } });
    expect(updated?.status).toBe('RESOLVED');
    expect(updated?.adminNotes).toBe('User warned and content removed.');
    expect(updated?.contentRemovedAt).toBeTruthy();
    expect(updated?.accountAction).toBe('SUSPEND');
    expect(await prisma.message.findUnique({ where: { id: message.id } })).toBeNull();
    expect((await prisma.user.findUnique({ where: { id: target.id } }))?.accountStatus).toBe('SUSPENDED');
  });
});
