import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';

describe('Clubs API (integration)', () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const { token: t, user } = await registerAndGetToken(
      'Club Tester',
      `club-test-${Date.now()}@example.com`,
      'password123'
    );
    token = t;
    userId = user.id;
  });

  const validCreateBody = () => ({
    name: 'Chess Society',
    description: 'Weekly casual games.',
    category: 'Gaming',
    emoji: '♟️',
  });

  describe('POST /clubs', () => {
    it('creates a club and adds creator as ADMIN', async () => {
      const res = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.isMember).toBe(true);
      expect(res.body.myRole).toBe('ADMIN');
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0].role).toBe('ADMIN');
      expect(res.body.members[0].userId).toBe(userId);

      const row = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId: res.body.id, userId } },
      });
      expect(row?.role).toBe('ADMIN');
    });

    it('returns 400 when required fields are missing', async () => {
      await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'x' })
        .expect(400);
    });
  });

  describe('GET /clubs', () => {
    it('lists public clubs with counts and isMember', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await prisma.clubMeeting.create({
        data: {
          clubId: create.body.id,
          title: 'Meet',
          location: 'Union',
          meetingTime: future,
          createdById: userId,
        },
      });

      const res = await request(app)
        .get('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .query({ category: 'Gaming' })
        .expect(200);

      const mine = res.body.find((c: { id: string }) => c.id === create.body.id);
      expect(mine).toBeDefined();
      expect(mine.memberCount).toBe(1);
      expect(mine.upcomingMeetingCount).toBe(1);
      expect(mine.isMember).toBe(true);
    });
  });

  describe('GET /clubs/my', () => {
    it('returns memberships with next meeting', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const t1 = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const t2 = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      await prisma.clubMeeting.createMany({
        data: [
          { clubId: create.body.id, title: 'Second', location: 'A', meetingTime: t2, createdById: userId },
          { clubId: create.body.id, title: 'First', location: 'B', meetingTime: t1, createdById: userId },
        ],
      });

      const res = await request(app)
        .get('/clubs/my')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const row = res.body.find((r: { club: { id: string } }) => r.club.id === create.body.id);
      expect(row).toBeDefined();
      expect(row!.club.memberCount).toBe(1);
      expect(row!.nextMeeting.title).toBe('First');
    });
  });

  describe('POST /clubs/:id/join', () => {
    it('returns 400 when already a member', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('allows a second user to join as MEMBER', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const { token: token2, user: u2 } = await registerAndGetToken(
        'Joiner',
        `joiner-${Date.now()}@example.com`,
        'password123'
      );

      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(201);

      const m = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId: create.body.id, userId: u2.id } },
      });
      expect(m?.role).toBe('MEMBER');
    });
  });

  describe('DELETE /clubs/:id/leave', () => {
    it('returns 400 for sole admin', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      await request(app)
        .delete(`/clubs/${create.body.id}/leave`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('POST /clubs/:id/meetings', () => {
    it('returns 403 for MEMBER', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const { token: token2 } = await registerAndGetToken(
        'Member',
        `member-${Date.now()}@example.com`,
        'password123'
      );
      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(201);

      const when = new Date(Date.now() + 86400000).toISOString();
      await request(app)
        .post(`/clubs/${create.body.id}/meetings`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ title: 'M', location: 'Here', meetingTime: when })
        .expect(403);
    });

    it('allows OFFICER to create a meeting', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const { token: token2, user: u2 } = await registerAndGetToken(
        'Officer',
        `officer-${Date.now()}@example.com`,
        'password123'
      );
      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(201);

      await prisma.clubMember.update({
        where: { clubId_userId: { clubId: create.body.id, userId: u2.id } },
        data: { role: 'OFFICER' },
      });

      const when = new Date(Date.now() + 86400000).toISOString();
      const res = await request(app)
        .post(`/clubs/${create.body.id}/meetings`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ title: 'Officer meet', location: 'RPAC', meetingTime: when })
        .expect(201);

      expect(res.body.title).toBe('Officer meet');
    });
  });

  describe('POST /clubs/meetings/:meetingId/rsvp', () => {
    it('upserts RSVP status', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const when = new Date(Date.now() + 86400000);
      const meeting = await prisma.clubMeeting.create({
        data: {
          clubId: create.body.id,
          title: 'RSVP test',
          location: 'X',
          meetingTime: when,
          isPublic: true,
          createdById: userId,
        },
      });

      const { token: token2, user: u2 } = await registerAndGetToken(
        'RsvpUser',
        `rsvp-${Date.now()}@example.com`,
        'password123'
      );

      const r1 = await request(app)
        .post(`/clubs/meetings/${meeting.id}/rsvp`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ status: 'GOING' })
        .expect(200);
      expect(r1.body.status).toBe('GOING');

      const r2 = await request(app)
        .post(`/clubs/meetings/${meeting.id}/rsvp`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ status: 'MAYBE' })
        .expect(200);
      expect(r2.body.status).toBe('MAYBE');

      const row = await prisma.clubMeetingAttendee.findUnique({
        where: { meetingId_userId: { meetingId: meeting.id, userId: u2.id } },
      });
      expect(row?.status).toBe('MAYBE');
    });
  });

  describe('GET /clubs/:id/announcements', () => {
    it('paginates newest first', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const base = Date.now();
      for (let i = 0; i < 5; i++) {
        await prisma.clubAnnouncement.create({
          data: {
            clubId: create.body.id,
            userId,
            content: `Ann ${i}`,
            createdAt: new Date(base + i * 1000),
          },
        });
      }

      const res = await request(app)
        .get(`/clubs/${create.body.id}/announcements`)
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(res.body.total).toBe(5);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
      expect(res.body.items[0].content).toBe('Ann 4');
      expect(res.body.items[1].content).toBe('Ann 3');
    });
  });

  describe('GET /clubs/:id (private)', () => {
    it('returns 404 for non-member', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validCreateBody(), name: 'Secret', isPublic: false })
        .expect(201);

      const { token: token2 } = await registerAndGetToken(
        'Outsider',
        `out-${Date.now()}@example.com`,
        'password123'
      );

      await request(app)
        .get(`/clubs/${create.body.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(404);
    });
  });

  describe('DELETE /clubs/:id', () => {
    it('returns 403 for non-admin member', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const { token: token2, user: u2 } = await registerAndGetToken(
        'NotAdmin',
        `noadmin-${Date.now()}@example.com`,
        'password123'
      );
      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(201);

      await request(app)
        .delete(`/clubs/${create.body.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(403);
    });

    it('allows ADMIN to delete', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      await request(app)
        .delete(`/clubs/${create.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const gone = await prisma.club.findUnique({ where: { id: create.body.id } });
      expect(gone).toBeNull();
    });
  });
});
