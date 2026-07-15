import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';
import { resetExpireOldPodsThrottleForTests } from '../lib/expireOldPods';

describe('Pods API (integration)', () => {
  let token: string;
  let userId: string;
  let activityId: string;

  beforeEach(async () => {
    resetExpireOldPodsThrottleForTests();
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

    it('fills coordinates from the named-location table when no pin is dropped', async () => {
      const res = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId,
          minMembers: 2,
          maxMembers: 4,
          meetupTime: new Date(Date.now() + 86400000).toISOString(),
          location: 'Thompson Library', // suggested chip, no map pin
        })
        .expect(201);

      // Suggested-spot pods used to save null coords and never show on the map.
      expect(res.body.latitude).toBeCloseTo(39.9992, 3);
      expect(res.body.longitude).toBeCloseTo(-83.0155, 3);
    });

    it('keeps explicit pin coordinates over the named-location table', async () => {
      const res = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId,
          minMembers: 2,
          maxMembers: 4,
          meetupTime: new Date(Date.now() + 86400000).toISOString(),
          location: 'Thompson Library',
          latitude: 39.9989,
          longitude: -83.0131, // pin on the Oval, not the library
        })
        .expect(201);

      expect(res.body.latitude).toBeCloseTo(39.9989, 4);
      expect(res.body.longitude).toBeCloseTo(-83.0131, 4);
    });

    it('rejects off-campus pins and accepts pins on core campus (the Oval)', async () => {
      // East of High St (off-campus bars block) — outside the fence. Runs
      // first so the rejected request doesn't trip the one-active-pod rule.
      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId,
          minMembers: 2,
          maxMembers: 4,
          meetupTime: new Date(Date.now() + 86400000).toISOString(),
          location: validLocation,
          latitude: 39.9989,
          longitude: -83.002,
        })
        .expect(400);

      // The Oval itself — regression guard: the pre-2026-07 polygon's east
      // edge sat west of High St and rejected this exact point.
      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId,
          minMembers: 2,
          maxMembers: 4,
          meetupTime: new Date(Date.now() + 86400000).toISOString(),
          location: validLocation,
          latitude: 39.9989,
          longitude: -83.0131,
        })
        .expect(201);
    });
  });

  describe('PATCH /pods/:id/privacy', () => {
    it('lets the creator make a pod private and removes it from discovery', async () => {
      const createRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId,
          meetupTime: new Date(Date.now() + 86400000).toISOString(),
          location: validLocation,
        })
        .expect(201);

      const podId = createRes.body.id as string;

      const privacyRes = await request(app)
        .patch(`/pods/${podId}/privacy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ visibility: 'private' })
        .expect(200);

      expect(privacyRes.body.locationType).toBe('private');

      const { token: viewerToken } = await registerAndGetToken(
        'Private Viewer',
        `private-viewer-${Date.now()}@example.com`,
        'password123'
      );

      const feedRes = await request(app)
        .get('/pods/feed')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(feedRes.body.map((p: { id: string }) => p.id)).not.toContain(podId);
    });

    it('rejects privacy changes from non-creators', async () => {
      const createRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId,
          meetupTime: new Date(Date.now() + 86400000).toISOString(),
          location: validLocation,
        })
        .expect(201);

      const { token: otherToken } = await registerAndGetToken(
        'Privacy Other',
        `privacy-other-${Date.now()}@example.com`,
        'password123'
      );

      await request(app)
        .patch(`/pods/${createRes.body.id}/privacy`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ visibility: 'private' })
        .expect(403);
    });
  });

  describe('GET /pods/feed', () => {
    it('returns empty array when no pods exist', async () => {
      const res = await request(app)
        .get('/pods/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns FORMING pods across activities sorted by meetupTime asc', async () => {
      const soonTime = new Date(Date.now() + 2 * 3600000);
      const laterTime = new Date(Date.now() + 48 * 3600000);

      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId,
          meetupTime: laterTime.toISOString(),
          location: validLocation,
        })
        .expect(201);

      const { token: token2 } = await registerAndGetToken(
        'Feed User 2',
        `feed-user2-${Date.now()}@example.com`,
        'password123'
      );

      const sportsActivity = await prisma.activity.findFirst({
        where: { category: 'Sports & Fitness' },
      });
      if (!sportsActivity) throw new Error('No Sports activity');

      const sportsLocation = 'RPAC';
      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          activityId: sportsActivity.id,
          meetupTime: soonTime.toISOString(),
          location: sportsLocation,
        })
        .expect(201);

      const res = await request(app)
        .get('/pods/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);

      // Should be sorted by meetupTime ascending
      const times = res.body.map((p: { meetupTime: string }) => new Date(p.meetupTime).getTime());
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
      }

      // Should include activity and members
      expect(res.body[0].activity).toBeDefined();
      expect(res.body[0].members).toBeDefined();
    });

    it('filters by category', async () => {
      const res = await request(app)
        .get('/pods/feed?category=Academic')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((p: { activity: { category: string } }) => {
        expect(p.activity.category).toBe('Academic');
      });
    });

    it('requires auth', async () => {
      await request(app).get('/pods/feed').expect(401);
    });

    it('sorts by memberCount desc when two pods have the same meetupTime', async () => {
      const sameTime = new Date(Date.now() + 3 * 3600000).toISOString();

      const { token: tokenA } = await registerAndGetToken(
        'Sort A',
        `sort-a-${Date.now()}@example.com`,
        'password123'
      );
      const { token: tokenB } = await registerAndGetToken(
        'Sort B',
        `sort-b-${Date.now()}@example.com`,
        'password123'
      );
      const { token: tokenC } = await registerAndGetToken(
        'Sort C',
        `sort-c-${Date.now()}@example.com`,
        'password123'
      );

      const sportsActivity = await prisma.activity.findFirst({
        where: { category: 'Sports & Fitness' },
      });
      if (!sportsActivity) throw new Error('No Sports activity');

      // tokenA creates a pod (1 member)
      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ activityId: sportsActivity.id, meetupTime: sameTime, location: 'RPAC' })
        .expect(201);

      // tokenB creates another pod (1 member), then tokenC joins it (2 members total)
      const podBRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ activityId, meetupTime: sameTime, location: validLocation })
        .expect(201);

      // join always returns 201 (same handler, join or create)
      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({ podId: podBRes.body.id })
        .expect(201);

      const res = await request(app)
        .get('/pods/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Find the two pods with matching meetupTime
      const samePods = res.body.filter(
        (p: { meetupTime: string }) => new Date(p.meetupTime).toISOString() === new Date(sameTime).toISOString()
      );
      if (samePods.length >= 2) {
        expect(samePods[0].members.length).toBeGreaterThanOrEqual(samePods[1].members.length);
      }
    });

    it('boosts matching interest categories for users with fewer than 3 pod memberships', async () => {
      const { token: feedToken, user: feedUser } = await registerAndGetToken(
        'Interest Feed',
        `interest-feed-${Date.now()}@example.com`,
        'password123'
      );
      await prisma.user.update({
        where: { id: feedUser.id },
        data: { interestTags: JSON.stringify(['Gym']) },
      });

      const { token: academicCreator } = await registerAndGetToken(
        'Academic Creator',
        `academic-creator-${Date.now()}@example.com`,
        'password123'
      );
      const { token: sportsCreator } = await registerAndGetToken(
        'Sports Creator',
        `sports-creator-${Date.now()}@example.com`,
        'password123'
      );
      const sportsActivity = await prisma.activity.findFirst({
        where: { category: 'Sports & Fitness' },
      });
      if (!sportsActivity) throw new Error('No Sports activity');

      const academicRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${academicCreator}`)
        .send({
          activityId,
          meetupTime: new Date(Date.now() + 2 * 3600000).toISOString(),
          location: validLocation,
        })
        .expect(201);

      const sportsRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${sportsCreator}`)
        .send({
          activityId: sportsActivity.id,
          meetupTime: new Date(Date.now() + 4 * 3600000).toISOString(),
          location: 'RPAC',
        })
        .expect(201);

      const res = await request(app)
        .get('/pods/feed')
        .set('Authorization', `Bearer ${feedToken}`)
        .expect(200);

      const ids = res.body.map((pod: { id: string }) => pod.id);
      expect(ids.indexOf(sportsRes.body.id)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(academicRes.body.id)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(sportsRes.body.id)).toBeLessThan(ids.indexOf(academicRes.body.id));
    });

    it('marks recommended=true for pods in activities the user has previously joined', async () => {
      const { token: tokenR } = await registerAndGetToken(
        'Rec User',
        `rec-user-${Date.now()}@example.com`,
        'password123'
      );

      const { token: tokenOther } = await registerAndGetToken(
        'Rec Other',
        `rec-other-${Date.now()}@example.com`,
        'password123'
      );

      const sportsActivity = await prisma.activity.findFirst({
        where: { category: 'Sports & Fitness' },
      });
      if (!sportsActivity) throw new Error('No Sports activity');

      // userR creates an academic pod — establishes activity preference in PodMember history
      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenR}`)
        .send({
          activityId,
          meetupTime: new Date(Date.now() + 2 * 3600000).toISOString(),
          location: validLocation,
        })
        .expect(201);

      // tokenOther creates a second academic pod (same activityId, different time)
      // — should be recommended for userR because activityId is in their history
      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenOther}`)
        .send({
          activityId,
          meetupTime: new Date(Date.now() + 4 * 3600000).toISOString(),
          location: validLocation,
        })
        .expect(201);

      // tokenOther creates a sports pod — NOT in userR's PodMember history
      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenOther}`)
        .send({
          activityId: sportsActivity.id,
          meetupTime: new Date(Date.now() + 6 * 3600000).toISOString(),
          location: 'RPAC',
        })
        .expect(201);

      const res = await request(app)
        .get('/pods/feed')
        .set('Authorization', `Bearer ${tokenR}`)
        .expect(200);

      // Find any academic pod that belongs to tokenOther (not the one userR is in)
      const academicPods = res.body.filter(
        (p: { activityId: string }) => p.activityId === activityId
      );
      const sportsPod = res.body.find(
        (p: { activityId: string }) => p.activityId === sportsActivity.id
      );

      // All academic pods should be recommended because activityId is in userR's history
      expect(academicPods.length).toBeGreaterThanOrEqual(1);
      academicPods.forEach((p: { recommended: boolean }) => {
        expect(p.recommended).toBe(true);
      });

      // Sports pod is not in userR's history
      if (sportsPod) {
        expect(sportsPod.recommended).toBe(false);
      }
    });

    it('each pod in the feed has a recommended boolean field', async () => {
      const { token: tokenNew } = await registerAndGetToken(
        'Bool Check',
        `bool-check-${Date.now()}@example.com`,
        'password123'
      );

      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token}`)
        .send({
          activityId,
          meetupTime: new Date(Date.now() + 5 * 3600000).toISOString(),
          location: validLocation,
        })
        .expect(201);

      const res = await request(app)
        .get('/pods/feed')
        .set('Authorization', `Bearer ${tokenNew}`)
        .expect(200);

      res.body.forEach((p: { recommended: unknown }) => {
        expect(typeof p.recommended).toBe('boolean');
      });
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
        'password123'
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

    it('returns 404 for non-members when pod is completed', async () => {
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

      const podId = createRes.body.id as string;
      await prisma.pod.update({
        where: { id: podId },
        data: { status: 'COMPLETED', meetupTime: new Date(Date.now() - 60 * 60 * 1000) },
      });

      const { token: outsider } = await registerAndGetToken(
        'Outsider',
        `outsider-pod-${Date.now()}@example.com`,
        'password123'
      );

      await request(app).get(`/pods/${podId}`).set('Authorization', `Bearer ${outsider}`).expect(404);

      await request(app).get(`/pods/${podId}`).set('Authorization', `Bearer ${token}`).expect(200);
    });
  });

  describe('Auth required', () => {
    it('rejects unauthenticated requests to protected routes', async () => {
      await request(app).get('/pods/mine').expect(401);
      await request(app).get('/pods').query({ activityId }).expect(401);
    });
  });

  describe('Blocking', () => {
    it('blocked users filtered from pod lists (GET /pods/mine)', async () => {
      const { token: tokenA, user: userA } = await registerAndGetToken(
        'Blocked A',
        `block-pod-a-${Date.now()}@example.com`,
        'password123'
      );
      const { token: tokenB, user: userB } = await registerAndGetToken(
        'Blocked B',
        `block-pod-b-${Date.now()}@example.com`,
        'password123'
      );

      const meetupTime = new Date(Date.now() + 86400000);
      const createRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          activityId,
          meetupTime: meetupTime.toISOString(),
          location: validLocation,
        })
        .expect(201);

      const podId = createRes.body.id;

      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ podId })
        .expect(201);

      await request(app)
        .post(`/users/${userB.id}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const mineA = await request(app)
        .get('/pods/mine')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(mineA.body).toHaveLength(0);

      const mineB = await request(app)
        .get('/pods/mine')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      expect(mineB.body).toHaveLength(0);
    });

    it('blocked users filtered from browse (GET /pods)', async () => {
      const { token: tokenA } = await registerAndGetToken(
        'Browse A',
        `browse-a-${Date.now()}@example.com`,
        'password123'
      );
      const { token: tokenB, user: userB } = await registerAndGetToken(
        'Browse B',
        `browse-b-${Date.now()}@example.com`,
        'password123'
      );

      const meetupTime = new Date(Date.now() + 86400000);
      const createRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          activityId,
          meetupTime: meetupTime.toISOString(),
          location: validLocation,
        })
        .expect(201);

      await request(app)
        .post(`/users/${userB.id}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const browse = await request(app)
        .get('/pods')
        .query({ activityId })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const podIds = browse.body.map((p: { id: string }) => p.id);
      expect(podIds).not.toContain(createRes.body.id);
    });

    it('cannot join pod with blocked relationship', async () => {
      const { token: tokenA } = await registerAndGetToken(
        'Join Block A',
        `join-block-a-${Date.now()}@example.com`,
        'password123'
      );
      const { token: tokenB, user: userB } = await registerAndGetToken(
        'Join Block B',
        `join-block-b-${Date.now()}@example.com`,
        'password123'
      );

      const meetupTime = new Date(Date.now() + 86400000);
      const createRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          activityId,
          meetupTime: meetupTime.toISOString(),
          location: validLocation,
        })
        .expect(201);

      await request(app)
        .post(`/users/${userB.id}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ podId: createRes.body.id })
        .expect(403);
    });

    it('GET /pods/:id returns 404 when blocked', async () => {
      const { token: tokenA } = await registerAndGetToken(
        'View Block A',
        `view-block-a-${Date.now()}@example.com`,
        'password123'
      );
      const { token: tokenB, user: userB } = await registerAndGetToken(
        'View Block B',
        `view-block-b-${Date.now()}@example.com`,
        'password123'
      );

      const meetupTime = new Date(Date.now() + 86400000);
      const createRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          activityId,
          meetupTime: meetupTime.toISOString(),
          location: validLocation,
        })
        .expect(201);

      await request(app)
        .post(`/users/${userB.id}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      await request(app)
        .get(`/pods/${createRes.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });

    it('GET /pods/feed excludes pods from blocked users', async () => {
      const { token: tokenA } = await registerAndGetToken(
        'Feed Block A',
        `feed-block-a-${Date.now()}@example.com`,
        'password123'
      );
      const { token: tokenB, user: userB } = await registerAndGetToken(
        'Feed Block B',
        `feed-block-b-${Date.now()}@example.com`,
        'password123'
      );

      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          activityId,
          meetupTime: new Date(Date.now() + 86400000).toISOString(),
          location: validLocation,
        })
        .expect(201);

      // Block userB: pod should disappear from A's feed
      await request(app)
        .post(`/users/${userB.id}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const res = await request(app)
        .get('/pods/feed')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const creatorIds = res.body.flatMap((p: { members: { userId: string }[] }) =>
        p.members.map((m) => m.userId)
      );
      expect(creatorIds).not.toContain(userB.id);
    });

    it('cleanup: blocking removes both users from shared pod', async () => {
      const { token: tokenA, user: userA } = await registerAndGetToken(
        'Cleanup A',
        `cleanup-a-${Date.now()}@example.com`,
        'password123'
      );
      const { token: tokenB, user: userB } = await registerAndGetToken(
        'Cleanup B',
        `cleanup-b-${Date.now()}@example.com`,
        'password123'
      );

      const meetupTime = new Date(Date.now() + 86400000);
      const createRes = await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          activityId,
          meetupTime: meetupTime.toISOString(),
          location: validLocation,
        })
        .expect(201);

      const podId = createRes.body.id;

      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ podId })
        .expect(201);

      const membersBefore = await prisma.podMember.findMany({ where: { podId } });
      expect(membersBefore).toHaveLength(2);

      await request(app)
        .post(`/users/${userB.id}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const membersAfter = await prisma.podMember.findMany({ where: { podId } });
      expect(membersAfter).toHaveLength(0);

      const podExists = await prisma.pod.findUnique({ where: { id: podId } });
      expect(podExists).toBeNull();
    });
  });

  describe('expireOldPods + public feeds', () => {
    it('GET /pods/feed expires stale FORMING pods and omits them from the response', async () => {
      const { token } = await registerAndGetToken(
        'Feed Expire',
        `feed-exp-${Date.now()}@example.com`,
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
        data: { meetupTime: new Date(Date.now() - 5 * 60 * 60 * 1000) },
      });

      const { token: token2 } = await registerAndGetToken(
        'Feed Viewer',
        `feed-view-${Date.now()}@example.com`,
        'password123'
      );

      const feedRes = await request(app)
        .get('/pods/feed')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(feedRes.body.map((p: { id: string }) => p.id)).not.toContain(podId);

      const updated = await prisma.pod.findUnique({ where: { id: podId } });
      expect(updated?.status).toBe('EXPIRED');
    });

    it('GET /pods?activityId expires stale pods and omits past meetups from browse', async () => {
      const { token } = await registerAndGetToken(
        'Browse Expire',
        `browse-exp-${Date.now()}@example.com`,
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
        data: { meetupTime: new Date(Date.now() - 5 * 60 * 60 * 1000) },
      });

      const listRes = await request(app)
        .get('/pods')
        .query({ activityId })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(listRes.body.map((p: { id: string }) => p.id)).not.toContain(podId);
    });

    it('rejects joining an EXPIRED pod by id', async () => {
      const { token } = await registerAndGetToken(
        'Join Expired',
        `join-exp-${Date.now()}@example.com`,
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
        data: {
          status: 'EXPIRED',
          meetupTime: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
      });

      const { token: token2 } = await registerAndGetToken(
        'Join Expired B',
        `join-exp-b-${Date.now()}@example.com`,
        'password123'
      );

      await request(app)
        .post('/pods/join')
        .set('Authorization', `Bearer ${token2}`)
        .send({ podId })
        .expect(409);
    });

    it('GET /pods/mine/history returns EXPIRED pods for history', async () => {
      const { token } = await registerAndGetToken(
        'Mine Expired',
        `mine-exp-${Date.now()}@example.com`,
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
        data: { meetupTime: new Date(Date.now() - 5 * 60 * 60 * 1000) },
      });

      await request(app).get('/pods/feed').set('Authorization', `Bearer ${token}`).expect(200);

      const mine = await request(app).get('/pods/mine/history').set('Authorization', `Bearer ${token}`).expect(200);

      const minePod = mine.body.find((p: { id: string }) => p.id === podId);
      expect(minePod).toBeDefined();
      expect(minePod.status).toBe('EXPIRED');
    });
  });
});
