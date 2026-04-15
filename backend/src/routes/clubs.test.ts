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

  describe('POST /clubs/meetings/:meetingId/attend', () => {
    it('allows members to mark ATTENDED and returns attendedCount', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const when = new Date(Date.now() + 86400000);
      const meeting = await prisma.clubMeeting.create({
        data: {
          clubId: create.body.id,
          title: 'Attend test',
          location: 'Y',
          meetingTime: when,
          isPublic: true,
          createdById: userId,
        },
      });

      const { token: token2, user: u2 } = await registerAndGetToken(
        'AttendeeB',
        `attend-b-${Date.now()}@example.com`,
        'password123'
      );
      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(201);

      const r1 = await request(app)
        .post(`/clubs/meetings/${meeting.id}/attend`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(r1.body.attendedCount).toBe(1);

      const r2 = await request(app)
        .post(`/clubs/meetings/${meeting.id}/attend`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);
      expect(r2.body.attendedCount).toBe(2);

      const row1 = await prisma.clubMeetingAttendee.findUnique({
        where: { meetingId_userId: { meetingId: meeting.id, userId } },
      });
      const row2 = await prisma.clubMeetingAttendee.findUnique({
        where: { meetingId_userId: { meetingId: meeting.id, userId: u2.id } },
      });
      expect(row1?.status).toBe('ATTENDED');
      expect(row2?.status).toBe('ATTENDED');
    });

    it('returns 403 for non-member even on public meeting', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const when = new Date(Date.now() + 86400000);
      const meeting = await prisma.clubMeeting.create({
        data: {
          clubId: create.body.id,
          title: 'Public meet',
          location: 'Z',
          meetingTime: when,
          isPublic: true,
          createdById: userId,
        },
      });

      const { token: outsider } = await registerAndGetToken(
        'OutsiderAttend',
        `out-attend-${Date.now()}@example.com`,
        'password123'
      );

      await request(app)
        .post(`/clubs/meetings/${meeting.id}/attend`)
        .set('Authorization', `Bearer ${outsider}`)
        .expect(403);

      await request(app)
        .post(`/clubs/meetings/${meeting.id}/rsvp`)
        .set('Authorization', `Bearer ${outsider}`)
        .send({ status: 'GOING' })
        .expect(200);
    });
  });

  describe('GET /clubs/:id/meetings/:meetingId/attendance', () => {
    it('returns ATTENDED list for ADMIN', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const when = new Date(Date.now() + 86400000);
      const meeting = await prisma.clubMeeting.create({
        data: {
          clubId: create.body.id,
          title: 'Roll call',
          location: 'Hall',
          meetingTime: when,
          createdById: userId,
        },
      });

      await request(app)
        .post(`/clubs/meetings/${meeting.id}/attend`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const res = await request(app)
        .get(`/clubs/${create.body.id}/meetings/${meeting.id}/attendance`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.attendedCount).toBe(1);
      expect(res.body.attendees).toHaveLength(1);
      expect(res.body.attendees[0].userId).toBe(userId);
      expect(res.body.attendees[0].status).toBe('ATTENDED');
      expect(res.body.attendees[0].user.id).toBe(userId);
    });

    it('returns 200 for OFFICER', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const { token: officerTok, user: officer } = await registerAndGetToken(
        'OfficerAtt',
        `off-att-${Date.now()}@example.com`,
        'password123'
      );
      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${officerTok}`)
        .expect(201);
      await prisma.clubMember.update({
        where: { clubId_userId: { clubId: create.body.id, userId: officer.id } },
        data: { role: 'OFFICER' },
      });

      const when = new Date(Date.now() + 86400000);
      const meeting = await prisma.clubMeeting.create({
        data: {
          clubId: create.body.id,
          title: 'Officer view',
          location: 'A',
          meetingTime: when,
          createdById: userId,
        },
      });

      await request(app)
        .get(`/clubs/${create.body.id}/meetings/${meeting.id}/attendance`)
        .set('Authorization', `Bearer ${officerTok}`)
        .expect(200);
    });

    it('returns 403 for MEMBER', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const { token: memberTok } = await registerAndGetToken(
        'PlainMember',
        `plain-m-${Date.now()}@example.com`,
        'password123'
      );
      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${memberTok}`)
        .expect(201);

      const when = new Date(Date.now() + 86400000);
      const meeting = await prisma.clubMeeting.create({
        data: {
          clubId: create.body.id,
          title: 'Member blocked',
          location: 'B',
          meetingTime: when,
          createdById: userId,
        },
      });

      await request(app)
        .get(`/clubs/${create.body.id}/meetings/${meeting.id}/attendance`)
        .set('Authorization', `Bearer ${memberTok}`)
        .expect(403);
    });

    it('returns 404 when meetingId does not belong to club id', async () => {
      const c1 = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validCreateBody(), name: 'Club One Att' })
        .expect(201);

      const { token: token2 } = await registerAndGetToken(
        'OtherAdmin',
        `other-ad-${Date.now()}@example.com`,
        'password123'
      );
      const c2 = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token2}`)
        .send({ ...validCreateBody(), name: 'Club Two Att' })
        .expect(201);

      const when = new Date(Date.now() + 86400000);
      const meeting = await prisma.clubMeeting.create({
        data: {
          clubId: c1.body.id,
          title: 'Only in c1',
          location: 'C',
          meetingTime: when,
          createdById: userId,
        },
      });

      await request(app)
        .get(`/clubs/${c2.body.id}/meetings/${meeting.id}/attendance`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(404);
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

  describe('GET /clubs/:id/meetings (RSVP metadata)', () => {
    it('includes rsvpCounts, myRsvp, and attendeeCount as going count', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const { token: token2, user: u2 } = await registerAndGetToken(
        'RsvpUser',
        `rsvp-${Date.now()}@example.com`,
        'password123'
      );
      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(201);

      const when = new Date(Date.now() + 86400000).toISOString();
      const meetRes = await request(app)
        .post(`/clubs/${create.body.id}/meetings`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Board', location: 'Union', meetingTime: when })
        .expect(201);
      const meetingId = meetRes.body.id as string;

      await request(app)
        .post(`/clubs/meetings/${meetingId}/rsvp`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'GOING' })
        .expect(200);
      await request(app)
        .post(`/clubs/meetings/${meetingId}/rsvp`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ status: 'MAYBE' })
        .expect(200);

      const list = await request(app)
        .get(`/clubs/${create.body.id}/meetings`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const row = list.body.find((m: { id: string }) => m.id === meetingId);
      expect(row.rsvpCounts).toEqual({ going: 1, maybe: 1, notGoing: 0 });
      expect(row.myRsvp).toBe('GOING');
      expect(row.attendeeCount).toBe(1);
    });
  });

  describe('GET /clubs/:id/messages and POST', () => {
    it('returns 403 for non-member', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const { token: token2 } = await registerAndGetToken(
        'Out',
        `out-msg-${Date.now()}@example.com`,
        'password123'
      );

      await request(app)
        .get(`/clubs/${create.body.id}/messages`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(403);
    });

    it('lists and creates messages for members', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const empty = await request(app)
        .get(`/clubs/${create.body.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(empty.body.messages).toEqual([]);
      expect(Array.isArray(empty.body.typingUserIds)).toBe(true);

      const post = await request(app)
        .post(`/clubs/${create.body.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello club' })
        .expect(201);
      expect(post.body.content).toBe('Hello club');
      expect(post.body.user.name).toBeDefined();

      const list = await request(app)
        .get(`/clubs/${create.body.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body.messages).toHaveLength(1);
      expect(list.body.messages[0].content).toBe('Hello club');
    });
  });

  describe('POST /clubs/:id/typing', () => {
    it('returns ok for a member', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      await request(app)
        .post(`/clubs/${create.body.id}/typing`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('POST /clubs/:id/members/:userId/promote', () => {
    it('allows ADMIN to promote MEMBER to OFFICER', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const { token: token2, user: u2 } = await registerAndGetToken(
        'Promotee',
        `promo-${Date.now()}@example.com`,
        'password123'
      );
      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(201);

      const res = await request(app)
        .post(`/clubs/${create.body.id}/members/${u2.id}/promote`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.role).toBe('OFFICER');

      const row = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId: create.body.id, userId: u2.id } },
      });
      expect(row?.role).toBe('OFFICER');
    });

    it('returns 403 for non-admin', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const { token: t2, user: u2 } = await registerAndGetToken(
        'M1',
        `m1-${Date.now()}@example.com`,
        'password123'
      );
      const { token: t3, user: u3 } = await registerAndGetToken(
        'M2',
        `m2-${Date.now()}@example.com`,
        'password123'
      );
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${t2}`).expect(201);
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${t3}`).expect(201);

      await request(app)
        .post(`/clubs/${create.body.id}/members/${u3.id}/promote`)
        .set('Authorization', `Bearer ${t2}`)
        .expect(403);
    });

    it('is idempotent for OFFICER', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);

      const { token: t2, user: u2 } = await registerAndGetToken(
        'Off',
        `off-${Date.now()}@example.com`,
        'password123'
      );
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${t2}`).expect(201);
      await request(app)
        .post(`/clubs/${create.body.id}/members/${u2.id}/promote`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(app)
        .post(`/clubs/${create.body.id}/members/${u2.id}/promote`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
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
