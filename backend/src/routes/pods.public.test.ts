import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';

describe('GET /pods/:id/public', () => {
  let activityId: string;
  const validLocation = 'Thompson Library';

  beforeEach(async () => {
    const activity = await prisma.activity.findFirst({ where: { category: 'Academic' } });
    if (!activity) throw new Error('No activities in seed');
    activityId = activity.id;
  });

  it('returns minimal pod fields without auth', async () => {
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

    const res = await request(app).get(`/pods/${podId}/public`).expect(200);

    expect(res.body).toEqual({
      id: podId,
      name: expect.any(String),
      activityType: 'Academic',
      meetupTime: expect.any(String),
      location: validLocation,
      memberCount: 1,
      maxMembers: 4,
    });
    expect(res.body.name).toBeTruthy();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/pods/00000000-0000-4000-8000-000000000000/public')
      .expect(404);

    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 404 for expired pod', async () => {
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
    await prisma.pod.update({
      where: { id: podId },
      data: { status: 'EXPIRED', meetupTime: new Date(Date.now() - 60 * 60 * 1000) },
    });

    await request(app).get(`/pods/${podId}/public`).expect(404);
  });
});
