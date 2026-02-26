import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';

describe('Pods API (integration)', () => {
  let token: string;
  let userId: string;
  let activityId: string;

  beforeEach(async () => {
    const { token: t, user } = await registerAndGetToken(
      'Pod Tester',
      `pod-test-${Date.now()}@example.com`,
      'password123'
    );
    token = t;
    userId = user.id;

    const activity = await prisma.activity.findFirst({
      where: { category: 'Academic' },
    });
    if (!activity) throw new Error('No activities in seed');
    activityId = activity.id;
  });

  const validLocation = 'Thompson Library'; // Academic category

  describe('GET /pods/mine', () => {
    it('returns empty array when user has no pods', async () => {
      const res = await request(app)
        .get('/pods/mine')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns user pods after creating one', async () => {
      await request(app)
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

      const res = await request(app)
        .get('/pods/mine')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.length).toBe(1);
      expect(res.body[0].activityId).toBe(activityId);
      expect(res.body[0].activity).toBeDefined();
      expect(res.body[0].members).toBeDefined();
    });
  });

  describe('POST /pods/join (create pod)', () => {
    it('creates a new pod with valid data', async () => {
      const meetupTime = new Date(Date.now() + 86400000);
      const res = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId,
          minMembers: 2,
          maxMembers: 4,
          meetupTime: meetupTime.toISOString(),
          location: validLocation,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('FORMING');
      expect(res.body.creatorId).toBe(userId);
      expect(res.body.members).toHaveLength(1);
      expect(res.body.activity).toBeDefined();
    });

    it('rejects without location', async () => {
      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId,
          meetupTime: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(400);
    });

    it('rejects invalid location for activity category', async () => {
      const activity = await prisma.activity.findFirst({
        where: { category: 'Sports & Fitness' },
      });
      if (!activity) throw new Error('No Sports activity');

      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId: activity.id,
          meetupTime: new Date(Date.now() + 86400000).toISOString(),
          location: 'Invalid Building XYZ',
        })
        .expect(400);
    });

    it('rejects meetup time in the past', async () => {
      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId,
          meetupTime: new Date(Date.now() - 86400000).toISOString(),
          location: validLocation,
        })
        .expect(400);
    });
  });

  describe('GET /pods?activityId=', () => {
    it('returns FORMING pods for activity', async () => {
      const res = await request(app)
        .get('/pods')
        .query({ activityId })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('requires activityId', async () => {
      await request(app)
        .get('/pods')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('POST /pods/join (join existing pod)', () => {
    it('allows second user to join a pod', async () => {
      const meetupTime = new Date(Date.now() + 86400000);
      const createRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId,
          meetupTime: meetupTime.toISOString(),
          location: validLocation,
        })
        .expect(201);

      const podId = createRes.body.id;

      const { token: token2 } = await registerAndGetToken(
        'Joiner',
        `joiner-${Date.now()}@example.com`,
        'pass'
      );

      const joinRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token2}`)
        .send({ podId })
        .expect(201);

      expect(joinRes.body.members).toHaveLength(2);
    });
  });

  describe('GET /pods/:id', () => {
    it('returns pod details for member', async () => {
      const meetupTime = new Date(Date.now() + 86400000);
      const createRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId,
          meetupTime: meetupTime.toISOString(),
          location: validLocation,
        })
        .expect(201);

      const res = await request(app)
        .get(`/pods/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(createRes.body.id);
      expect(res.body.activity).toBeDefined();
      expect(res.body.members).toBeDefined();
    });

    it('returns 404 for unknown pod', async () => {
      await request(app)
        .get('/pods/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('Auth required', () => {
    it('rejects unauthenticated requests to protected routes', async () => {
      await request(app).get('/pods/mine').expect(401);
      await request(app).get('/pods').query({ activityId }).expect(401);
    });
  });
});
