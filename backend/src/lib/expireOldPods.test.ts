import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';
import request from 'supertest';
import app from '../server';
import { expireOldPods, resetExpireOldPodsThrottleForTests } from './expireOldPods';

describe('expireOldPods', () => {
  let activityId: string;
  const validLocation = 'Thompson Library';

  beforeEach(async () => {
    resetExpireOldPodsThrottleForTests();
    const activity = await prisma.activity.findFirst({ where: { category: 'Academic' } });
    if (!activity) throw new Error('No activities in seed');
    activityId = activity.id;
  });

  it('marks FORMING pods as EXPIRED when meetup time is in the past', async () => {
    const { token } = await registerAndGetToken(
      'Lib Exp A',
      `lib-exp-a-${Date.now()}@example.com`,
      'password123'
    );

    const res = await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${token}`)
      .send({
        activityId,
        minMembers: 2,
        maxMembers: 4,
        meetupTime: new Date(Date.now() + 86400000).toISOString(),
        location: validLocation,
      })
      .expect(201);

    const podId = res.body.id as string;
    await prisma.pod.update({
      where: { id: podId },
      data: { meetupTime: new Date(Date.now() - 5 * 60 * 60 * 1000) },
    });

    await expireOldPods();

    const pod = await prisma.pod.findUnique({ where: { id: podId } });
    expect(pod?.status).toBe('EXPIRED');
  });

  it('marks LOCKED pods with past meetup as COMPLETED', async () => {
    const { token } = await registerAndGetToken(
      'Lib Lock',
      `lib-lock-${Date.now()}@example.com`,
      'password123'
    );

    const res = await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${token}`)
      .send({
        activityId,
        minMembers: 2,
        maxMembers: 4,
        meetupTime: new Date(Date.now() + 86400000).toISOString(),
        location: validLocation,
      })
      .expect(201);

    const podId = res.body.id as string;
    await prisma.pod.update({
      where: { id: podId },
      data: {
        status: 'LOCKED',
        meetupTime: new Date(Date.now() - 60 * 60 * 1000),
      },
    });

    await expireOldPods();

    const pod = await prisma.pod.findUnique({ where: { id: podId } });
    expect(pod?.status).toBe('COMPLETED');
  });
});
