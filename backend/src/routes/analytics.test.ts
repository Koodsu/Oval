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
});
