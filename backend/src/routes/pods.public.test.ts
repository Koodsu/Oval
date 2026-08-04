import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';
import { getActivityEmoji } from '../lib/activityEmoji';

describe('GET /pods/:id/public', () => {
  let activityId: string;
  const validLocation = 'Thompson Library';

  beforeEach(async () => {
    const activity = await prisma.activity.findFirst({ where: { category: 'Academic / Study' } });
    if (!activity) throw new Error('No activities in seed');
    activityId = activity.id;
  });

  it('returns safe public fields without auth', async () => {
    const { token } = await registerAndGetToken(
      'Public Pod User',
      `pub-pod-${Date.now()}@example.com`,
      'password123'
    );

    const createRes = await request(app)
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

    const podId = createRes.body.id as string;
    const activityTitle = createRes.body.activity.title as string;
    const category = createRes.body.activity.category as string;

    const res = await request(app).get(`/pods/${podId}/public`).expect(200);

    expect(res.body.expired).toBe(false);
    expect(res.body.podName).toBe(activityTitle);
    expect(res.body.activityName).toBe(activityTitle);
    expect(res.body.activityEmoji).toBe(getActivityEmoji(activityTitle, category));
    expect(res.body.location).toBe(validLocation);
    expect(res.body.memberCount).toBe(1);
    expect(res.body.maxMembers).toBe(4);
    expect(res.body.status).toBe('FORMING');
    expect(typeof res.body.meetupTime).toBe('string');

    expect(Object.keys(res.body).sort()).toEqual(
      [
        'activityEmoji',
        'activityName',
        'expired',
        'location',
        'maxMembers',
        'meetupTime',
        'memberCount',
        'podName',
        'status',
      ].sort()
    );
    expect(res.body.members).toBeUndefined();
    expect(res.body.messages).toBeUndefined();
    expect(res.body.user).toBeUndefined();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/pods/00000000-0000-4000-8000-000000000000/public')
      .expect(404);

    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns expired payload for EXPIRED pod', async () => {
    const { token } = await registerAndGetToken(
      'Expired Public',
      `pub-exp-${Date.now()}@example.com`,
      'password123'
    );

    const createRes = await request(app)
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

    const podId = createRes.body.id as string;
    const activityTitle = createRes.body.activity.title as string;
    await prisma.pod.update({
      where: { id: podId },
      data: { status: 'EXPIRED', meetupTime: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const res = await request(app).get(`/pods/${podId}/public`).expect(200);
    expect(res.body).toEqual({ expired: true, podName: activityTitle });
  });

  it('returns COMPLETED pods with full safe fields', async () => {
    const { token } = await registerAndGetToken(
      'Completed Public',
      `pub-done-${Date.now()}@example.com`,
      'password123'
    );

    const createRes = await request(app)
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

    const podId = createRes.body.id as string;
    const activityTitle = createRes.body.activity.title as string;
    const category = createRes.body.activity.category as string;
    await prisma.pod.update({
      where: { id: podId },
      data: { status: 'COMPLETED', meetupTime: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const res = await request(app).get(`/pods/${podId}/public`).expect(200);
    expect(res.body.expired).toBe(false);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.podName).toBe(activityTitle);
    expect(res.body.activityEmoji).toBe(getActivityEmoji(activityTitle, category));
  });
});
