import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { createTestUser, getAuthToken } from '../test/helpers';

describe('Analytics API', () => {
  it('records anonymous events', async () => {
    await request(app)
      .post('/analytics/events')
      .send({ name: 'landing.view', properties: { source: 'test' } })
      .expect(204);

    const event = await prisma.analyticsEvent.findFirst({
      where: { name: 'landing.view' },
      orderBy: { createdAt: 'desc' },
    });

    expect(event).toBeTruthy();
    expect(event?.userId).toBeNull();
    expect(event?.properties).toEqual({ source: 'test' });
  });

  it('records authenticated events with the user id', async () => {
    const user = await createTestUser({ email: `analytics-${Date.now()}@osu.edu` });
    const token = getAuthToken(user.id, user.email);

    await request(app)
      .post('/analytics/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'pod.joined', properties: { podId: 'pod-1' } })
      .expect(204);

    const event = await prisma.analyticsEvent.findFirst({
      where: { name: 'pod.joined', userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(event).toBeTruthy();
    expect(event?.properties).toEqual({ podId: 'pod-1' });
  });

  it('rejects invalid event names and non-object properties', async () => {
    await request(app)
      .post('/analytics/events')
      .send({ name: 'bad event name' })
      .expect(400);

    await request(app)
      .post('/analytics/events')
      .send({ name: 'valid.name', properties: ['nope'] })
      .expect(400);
  });

  it('returns admin-gated summary metrics with activation windows and invite attribution', async () => {
    await prisma.analyticsEvent.deleteMany();
    await prisma.podDemand.deleteMany();
    const previousAdmins = process.env.ADMIN_USER_IDS;
    const admin = await createTestUser({ email: `analytics-admin-${Date.now()}@osu.edu` });
    const activated = await createTestUser({ email: `activated-${Date.now()}@osu.edu` });
    const tooLate = await createTestUser({ email: `too-late-${Date.now()}@osu.edu` });
    const activity = await prisma.activity.findFirst({ where: { title: 'Grab coffee or tea' } });
    if (!activity) throw new Error('No coffee activity in seed');
    process.env.ADMIN_USER_IDS = admin.id;

    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    try {
      await prisma.analyticsEvent.createMany({
        data: [
          { userId: activated.id, name: 'verify.completed', createdAt: twoDaysAgo },
          {
            userId: activated.id,
            name: 'pod.joined',
            createdAt: new Date(twoDaysAgo.getTime() + 2 * 60 * 60 * 1000),
          },
          { userId: tooLate.id, name: 'verify.completed', createdAt: fiveDaysAgo },
          {
            userId: tooLate.id,
            name: 'pod.joined',
            createdAt: new Date(fiveDaysAgo.getTime() + 4 * 24 * 60 * 60 * 1000),
          },
          { userId: activated.id, name: 'app.opened', properties: { joinablePodCount: 3 }, createdAt: now },
          { userId: activated.id, name: 'invite.shared', createdAt: now },
          { userId: null, name: 'invite.link_opened', properties: { ref: 'abc' }, createdAt: now },
          { userId: activated.id, name: 'auth.register', properties: { referredBy: 'abc' }, createdAt: now },
          {
            userId: activated.id,
            name: 'pod.created',
            properties: { template: 'boba-tonight' },
            createdAt: now,
          },
          {
            userId: activated.id,
            name: 'demand.signaled',
            properties: { activityId: activity.id },
            createdAt: now,
          },
          {
            userId: null,
            name: 'demand.converted',
            properties: { activityId: activity.id, podId: 'pod-analytics' },
            createdAt: now,
          },
        ],
      });
      const pod = await prisma.pod.create({
        data: {
          activityId: activity.id,
          meetupTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
          location: 'Ohio Union',
          maxMembers: 4,
          creatorId: activated.id,
        },
      });
      await prisma.podMember.create({
        data: {
          userId: activated.id,
          podId: pod.id,
          joinedAt: new Date(twoDaysAgo.getTime() + 60 * 60 * 1000),
          confirmedAt: new Date(twoDaysAgo.getTime() + 2 * 60 * 60 * 1000),
        },
      });
      await prisma.podDemand.create({
        data: {
          userId: tooLate.id,
          activityId: activity.id,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .get('/analytics/summary?days=14')
        .set('Authorization', `Bearer ${getAuthToken(admin.id, admin.email)}`)
        .expect(200);

      expect(res.body.activation).toMatchObject({
        verified: 2,
        within24h: 1,
        within72h: 1,
      });
      expect(res.body.invites).toMatchObject({
        shares: 1,
        opens: 1,
        registrationsWithRef: 1,
      });
      expect(res.body.activation.attendedWithin7d).toBe(1);
      expect(res.body.templates).toMatchObject({
        podsCreated: 1,
        templatedPodsCreated: 1,
        templateShare: 1,
      });
      expect(res.body.demand.signaled).toBe(1);
      expect(res.body.demand.converted).toBe(1);
      const demandRow = res.body.demand.activeByActivity.find(
        (row: { activityId: string }) => row.activityId === activity.id,
      );
      expect(demandRow).toMatchObject({
        activityId: activity.id,
        count: 1,
      });
      expect(res.body.liquidity.daily.some((day: { ratio: number }) => day.ratio === 1)).toBe(true);
      expect(res.body.attendance.joinToAttend.rate).toBeGreaterThan(0);
      expect(res.body.dau.some((day: { users: number }) => day.users >= 1)).toBe(true);
    } finally {
      process.env.ADMIN_USER_IDS = previousAdmins;
    }
  });
});
