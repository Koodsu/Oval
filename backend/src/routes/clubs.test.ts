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

  // Unique name per call so the club-name collision guard (anti-squatting) doesn't
  // trip across tests, since the test DB isn't reset between cases.
  let clubNameSeq = 0;
  const validCreateBody = () => ({
    name: `Chess Society ${Date.now()}-${clubNameSeq++}`,
    description: 'Weekly casual games.',
    category: 'Gaming',
    emoji: '♟️',
  });

  describe('POST /clubs', () => {
    it('creates a club and adds creator as OWNER', async () => {
      const res = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: res.body.id }, data: { isDiscoverable: true } });

      expect(res.body.id).toBeDefined();
      expect(res.body.isMember).toBe(true);
      expect(res.body.myRole).toBe('OWNER');
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0].role).toBe('OWNER');
      expect(res.body.members[0].userId).toBe(userId);

      const row = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId: res.body.id, userId } },
      });
      expect(row?.role).toBe('OWNER');
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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      // New clubs start hidden; make this one discoverable so it appears in Explore.
      await prisma.club.update({
        where: { id: create.body.id },
        data: { isDiscoverable: true },
      });

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

  describe('Club lifecycle', () => {
    it('hides newly created clubs from GET /clubs until discoverable', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      expect(create.body.isDiscoverable).toBe(false);

      const list = await request(app)
        .get('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body.find((c: { id: string }) => c.id === create.body.id)).toBeUndefined();
    });

    it('lets a user follow and unfollow a discoverable club', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });
      await prisma.club.update({
        where: { id: create.body.id },
        data: { isDiscoverable: true },
      });

      const { token: token2 } = await registerAndGetToken(
        'Follower',
        `follower-${Date.now()}@example.com`,
        'password123'
      );

      const followed = await request(app)
        .post(`/clubs/${create.body.id}/follow`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(201);
      expect(followed.body.isFollower).toBe(true);
      expect(followed.body.followerCount).toBe(1);

      const unfollowed = await request(app)
        .delete(`/clubs/${create.body.id}/follow`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);
      expect(unfollowed.body.followerCount).toBe(0);
    });

    it('rejects discovery toggle when ineligible, allows it once verified', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      await request(app)
        .patch(`/clubs/${create.body.id}/discovery`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isDiscoverable: true })
        .expect(409);

      await prisma.club.update({
        where: { id: create.body.id },
        data: { verification: 'VERIFIED' },
      });

      const ok = await request(app)
        .patch(`/clubs/${create.body.id}/discovery`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isDiscoverable: true })
        .expect(200);
      expect(ok.body.isDiscoverable).toBe(true);
    });

    it('redeems an invite link to add a member', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const invite = await request(app)
        .post(`/clubs/${create.body.id}/invites`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201);
      expect(invite.body.code).toBeDefined();

      const { token: token2, user: u2 } = await registerAndGetToken(
        'Invitee',
        `invitee-${Date.now()}@example.com`,
        'password123'
      );

      await request(app)
        .post(`/clubs/join/${invite.body.code}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(201);

      const m = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId: create.body.id, userId: u2.id } },
      });
      expect(m?.role).toBe('MEMBER');
    });
  });

  describe('Club verification', () => {
    it('runs the Instagram claim -> proof -> approve flow and verifies the club', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      const clubId = create.body.id;

      const claim = await request(app)
        .post(`/clubs/${clubId}/claims`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'INSTAGRAM', handle: '@MyClub' })
        .expect(201);
      expect(claim.body.challengeCode).toMatch(/^OVAL-/);
      expect(claim.body.handleOrEmail).toBe('myclub');

      let club = await prisma.club.findUnique({ where: { id: clubId } });
      expect(club?.verification).toBe('PENDING_REVIEW');

      await request(app)
        .post(`/clubs/${clubId}/claims/${claim.body.id}/sent`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const { token: reviewerToken, user: reviewer } = await registerAndGetToken(
        'Reviewer',
        `reviewer-${Date.now()}@example.com`,
        'password123'
      );
      await prisma.user.update({
        where: { id: reviewer.id },
        data: { isClubReviewer: true },
      });

      const queue = await request(app)
        .get('/admin/club-claims')
        .set('Authorization', `Bearer ${reviewerToken}`)
        .expect(200);
      expect(queue.body.some((c: { id: string }) => c.id === claim.body.id)).toBe(true);

      await request(app)
        .post(`/admin/club-claims/${claim.body.id}/approve`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .expect(200);

      club = await prisma.club.findUnique({ where: { id: clubId } });
      expect(club?.verification).toBe('VERIFIED');
      expect(club?.instagramHandle).toBe('myclub');
      expect(club?.verifiedAt).not.toBeNull();
    });

    it('blocks non-officers from starting a claim', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({
        where: { id: create.body.id },
        data: { isDiscoverable: true },
      });

      const { token: memberToken } = await registerAndGetToken(
        'Member',
        `vmember-${Date.now()}@example.com`,
        'password123'
      );
      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(201);

      await request(app)
        .post(`/clubs/${create.body.id}/claims`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ method: 'INSTAGRAM', handle: 'club' })
        .expect(403);
    });

    it('blocks non-reviewers from the admin queue', async () => {
      await request(app)
        .get('/admin/club-claims')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('rejecting a claim returns the club to unverified', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      const clubId = create.body.id;

      const claim = await request(app)
        .post(`/clubs/${clubId}/claims`)
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'INSTAGRAM', handle: 'club' })
        .expect(201);
      await request(app)
        .post(`/clubs/${clubId}/claims/${claim.body.id}/sent`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const { token: reviewerToken, user: reviewer } = await registerAndGetToken(
        'Reviewer2',
        `reviewer2-${Date.now()}@example.com`,
        'password123'
      );
      await prisma.user.update({
        where: { id: reviewer.id },
        data: { isClubReviewer: true },
      });

      await request(app)
        .post(`/admin/club-claims/${claim.body.id}/reject`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ reason: 'Not the real club' })
        .expect(200);

      const club = await prisma.club.findUnique({ where: { id: clubId } });
      expect(club?.verification).toBe('UNVERIFIED');
    });
  });

  describe('Club applications', () => {
    it('runs open cycle -> apply -> accept -> member', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      const clubId = create.body.id;

      const cycle = await request(app)
        .post(`/clubs/${clubId}/application-cycles`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Fall 2026', questions: ['Why do you want to join?'] })
        .expect(201);
      expect(cycle.body.status).toBe('OPEN');
      expect(cycle.body.questions).toEqual(['Why do you want to join?']);

      const clubRow = await prisma.club.findUnique({ where: { id: clubId } });
      expect(clubRow?.joinPolicy).toBe('APPLICATION');

      const { token: token2, user: u2 } = await registerAndGetToken(
        'Applicant',
        `applicant-${Date.now()}@example.com`,
        'password123'
      );

      const applyInfo = await request(app)
        .get(`/clubs/${clubId}/apply`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);
      expect(applyInfo.body.openCycle.id).toBe(cycle.body.id);
      expect(applyInfo.body.isMember).toBe(false);

      await request(app)
        .post(`/clubs/${clubId}/application-cycles/${cycle.body.id}/apply`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ answers: ['I love chess'] })
        .expect(201);

      const list = await request(app)
        .get(`/clubs/${clubId}/application-cycles/${cycle.body.id}/applications`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body.applications).toHaveLength(1);
      expect(list.body.applications[0].answers).toEqual(['I love chess']);

      await request(app)
        .patch(`/clubs/${clubId}/applications/${list.body.applications[0].id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ stage: 'ACCEPTED' })
        .expect(200);

      const member = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId: u2.id } },
      });
      expect(member?.role).toBe('MEMBER');
    });

    it('blocks non-officers from opening a cycle', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      const { token: token2 } = await registerAndGetToken(
        'Rando',
        `rando-${Date.now()}@example.com`,
        'password123'
      );
      await request(app)
        .post(`/clubs/${create.body.id}/application-cycles`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ title: 'X', questions: ['Q'] })
        .expect(403);
    });

    it('rejects applying to a closed cycle', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      const clubId = create.body.id;
      const cycle = await request(app)
        .post(`/clubs/${clubId}/application-cycles`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'C', questions: ['Q'] })
        .expect(201);
      await request(app)
        .patch(`/clubs/${clubId}/application-cycles/${cycle.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CLOSED' })
        .expect(200);

      const { token: token2 } = await registerAndGetToken(
        'Late',
        `late-${Date.now()}@example.com`,
        'password123'
      );
      await request(app)
        .post(`/clubs/${clubId}/application-cycles/${cycle.body.id}/apply`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ answers: ['x'] })
        .expect(409);
    });
  });

  describe('GET /clubs/my', () => {
    it('returns memberships with next meeting', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const t1 = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const t2 = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      await prisma.clubMeeting.createMany({
        data: [
          { clubId: create.body.id, title: 'Second', location: 'A', meetingTime: t2, createdById: userId },
          { clubId: create.body.id, title: 'First', location: 'B', meetingTime: t1, createdById: userId },
        ],
      });
      await prisma.club.update({
        where: { id: create.body.id },
        data: { avatarUrl: '/uploads/club-avatars/chess.png' },
      });

      const res = await request(app)
        .get('/clubs/my')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const row = res.body.find((r: { club: { id: string } }) => r.club.id === create.body.id);
      expect(row).toBeDefined();
      expect(row!.club.memberCount).toBe(1);
      expect(row!.club.avatarUrl).toBe('/uploads/club-avatars/chess.png');
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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      await prisma.club.update({
        where: { id: create.body.id },
        data: { isDiscoverable: true },
      });

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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      await prisma.club.update({
        where: { id: create.body.id },
        data: { isDiscoverable: true },
      });

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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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

    it('allows OFFICER with the meeting permission to create a meeting', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({
        where: { id: create.body.id },
        data: { officerPermissions: JSON.stringify(['CREATE_MEETINGS']) },
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

  describe('DELETE /clubs/:id/meetings/:meetingId', () => {
    it('allows club admins to delete meetings', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const meeting = await prisma.clubMeeting.create({
        data: {
          clubId: create.body.id,
          title: 'Board meeting',
          location: 'Union',
          meetingTime: new Date(Date.now() + 86400000),
          createdById: userId,
        },
      });

      await request(app)
        .delete(`/clubs/${create.body.id}/meetings/${meeting.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const gone = await prisma.clubMeeting.findUnique({ where: { id: meeting.id } });
      expect(gone).toBeNull();
    });

    it('returns 403 for non-admin members', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const { token: token2 } = await registerAndGetToken(
        'MeetingMember',
        `meeting-member-${Date.now()}@example.com`,
        'password123'
      );
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${token2}`).expect(201);

      const meeting = await prisma.clubMeeting.create({
        data: {
          clubId: create.body.id,
          title: 'Member cannot delete',
          location: 'Union',
          meetingTime: new Date(Date.now() + 86400000),
          createdById: userId,
        },
      });

      await request(app)
        .delete(`/clubs/${create.body.id}/meetings/${meeting.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(403);
    });
  });

  describe('POST /clubs/meetings/:meetingId/rsvp', () => {
    it('upserts RSVP status', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({ where: { id: c1.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({ where: { id: c2.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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

  describe('POST /clubs/:id/announcements', () => {
    it('allows ADMIN to post', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const res = await request(app)
        .post(`/clubs/${create.body.id}/announcements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello all' })
        .expect(201);
      expect(res.body.content).toBe('Hello all');
      expect(res.body.user.name).toBeDefined();
    });

    it('returns 403 for MEMBER', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const { token: t2 } = await registerAndGetToken(
        'PlainMember',
        `plain-m-${Date.now()}@example.com`,
        'password123'
      );
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${t2}`).expect(201);

      await request(app)
        .post(`/clubs/${create.body.id}/announcements`)
        .set('Authorization', `Bearer ${t2}`)
        .send({ content: 'Nope' })
        .expect(403);
    });
  });

  describe('DELETE /clubs/:id/announcements/:announcementId', () => {
    it('allows club admins to delete announcements', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const announcement = await prisma.clubAnnouncement.create({
        data: {
          clubId: create.body.id,
          userId,
          content: 'Delete me',
        },
      });

      await request(app)
        .delete(`/clubs/${create.body.id}/announcements/${announcement.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const gone = await prisma.clubAnnouncement.findUnique({ where: { id: announcement.id } });
      expect(gone).toBeNull();
    });

    it('returns 403 for non-admin members', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const { token: token2 } = await registerAndGetToken(
        'AnnouncementMember',
        `announcement-member-${Date.now()}@example.com`,
        'password123'
      );
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${token2}`).expect(201);

      const announcement = await prisma.clubAnnouncement.create({
        data: {
          clubId: create.body.id,
          userId,
          content: 'Do not delete',
        },
      });

      await request(app)
        .delete(`/clubs/${create.body.id}/announcements/${announcement.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(403);
    });
  });

  describe('PATCH /clubs/:id/members/:userId', () => {
    it('demotes OFFICER to MEMBER', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const { token: t2, user: u2 } = await registerAndGetToken(
        'OfficerX',
        `offx-${Date.now()}@example.com`,
        'password123'
      );
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${t2}`).expect(201);
      await request(app)
        .post(`/clubs/${create.body.id}/members/${u2.id}/promote`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const res = await request(app)
        .patch(`/clubs/${create.body.id}/members/${u2.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'MEMBER' })
        .expect(200);
      expect(res.body.role).toBe('MEMBER');
    });

    it('returns 403 for non-admin', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const { token: t2, user: u2 } = await registerAndGetToken(
        'M1',
        `patch-m1-${Date.now()}@example.com`,
        'password123'
      );
      const { token: t3, user: u3 } = await registerAndGetToken(
        'M2',
        `patch-m2-${Date.now()}@example.com`,
        'password123'
      );
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${t2}`).expect(201);
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${t3}`).expect(201);

      await request(app)
        .patch(`/clubs/${create.body.id}/members/${u3.id}`)
        .set('Authorization', `Bearer ${t2}`)
        .send({ role: 'OFFICER' })
        .expect(403);
    });

    it('returns 400 when an ADMIN targets the OWNER', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const { token: t2, user: u2 } = await registerAndGetToken(
        'CoAdmin',
        `coad-${Date.now()}@example.com`,
        'password123'
      );
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${t2}`).expect(201);
      await prisma.clubMember.update({
        where: { clubId_userId: { clubId: create.body.id, userId: u2.id } },
        data: { role: 'ADMIN' },
      });

      await request(app)
        .patch(`/clubs/${create.body.id}/members/${userId}`)
        .set('Authorization', `Bearer ${t2}`)
        .send({ role: 'MEMBER' })
        .expect(400);
    });
  });

  describe('DELETE /clubs/:id/members/:userId', () => {
    it('allows ADMIN to remove MEMBER', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const { token: t2, user: u2 } = await registerAndGetToken(
        'KickMe',
        `kick-${Date.now()}@example.com`,
        'password123'
      );
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${t2}`).expect(201);

      await request(app)
        .delete(`/clubs/${create.body.id}/members/${u2.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const gone = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId: create.body.id, userId: u2.id } },
      });
      expect(gone).toBeNull();
    });

    it('returns 400 when an ADMIN removes the OWNER', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const { token: t2, user: u2 } = await registerAndGetToken(
        'OtherAdmin',
        `oadm-${Date.now()}@example.com`,
        'password123'
      );
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${t2}`).expect(201);
      await prisma.clubMember.update({
        where: { clubId_userId: { clubId: create.body.id, userId: u2.id } },
        data: { role: 'ADMIN' },
      });

      await request(app)
        .delete(`/clubs/${create.body.id}/members/${userId}`)
        .set('Authorization', `Bearer ${t2}`)
        .expect(400);
    });

    it('returns 403 for non-admin', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const { token: t2, user: u2 } = await registerAndGetToken(
        'A',
        `del-a-${Date.now()}@example.com`,
        'password123'
      );
      const { token: t3, user: u3 } = await registerAndGetToken(
        'B',
        `del-b-${Date.now()}@example.com`,
        'password123'
      );
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${t2}`).expect(201);
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${t3}`).expect(201);

      await request(app)
        .delete(`/clubs/${create.body.id}/members/${u3.id}`)
        .set('Authorization', `Bearer ${t2}`)
        .expect(403);
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
    it('includes rsvpCounts, myRsvp, and attendeeCount', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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
      expect(row.attendeeCount).toBe(0);
    });
  });

  describe('GET /clubs/:id/messages and POST', () => {
    it('returns 403 for non-member', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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

    it('returns 400 when content exceeds 500 characters', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const tooLong = 'a'.repeat(501);
      await request(app)
        .post(`/clubs/${create.body.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: tooLong })
        .expect(400);

      const ok500 = 'b'.repeat(500);
      const post = await request(app)
        .post(`/clubs/${create.body.id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: ok500 })
        .expect(201);
      expect(post.body.content).toHaveLength(500);
    });
  });

  describe('POST /clubs/:id/typing', () => {
    it('returns ok for a member', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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

  describe('Club member tags', () => {
    it('lets leadership create, assign, target, and delete member tags', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const { token: targetToken, user: target } = await registerAndGetToken(
        'Dues Target',
        `dues-target-${Date.now()}@example.com`,
        'password123'
      );
      const { token: otherToken } = await registerAndGetToken(
        'Dues Other',
        `dues-other-${Date.now()}@example.com`,
        'password123'
      );
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${targetToken}`).expect(201);
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${otherToken}`).expect(201);

      const role = await request(app)
        .post(`/clubs/${create.body.id}/roles`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: "Hasn't paid dues" })
        .expect(201);

      await request(app)
        .post(`/clubs/${create.body.id}/roles/${role.body.id}/members/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app)
        .post(`/clubs/${create.body.id}/announcements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Please pay dues', visibility: 'MEMBERS', targetRoleIds: [role.body.id] })
        .expect(201);

      const targetAnnouncements = await request(app)
        .get(`/clubs/${create.body.id}/announcements`)
        .set('Authorization', `Bearer ${targetToken}`)
        .expect(200);
      expect(targetAnnouncements.body.items).toHaveLength(1);
      expect(targetAnnouncements.body.items[0].targetRoleIds).toEqual([role.body.id]);

      const otherAnnouncements = await request(app)
        .get(`/clubs/${create.body.id}/announcements`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);
      expect(otherAnnouncements.body.items).toHaveLength(0);

      await request(app)
        .delete(`/clubs/${create.body.id}/roles/${role.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('prevents admins from assigning member tags to owners', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const { token: adminToken, user: admin } = await registerAndGetToken(
        'Role Admin',
        `role-admin-${Date.now()}@example.com`,
        'password123'
      );
      await request(app).post(`/clubs/${create.body.id}/join`).set('Authorization', `Bearer ${adminToken}`).expect(201);
      await request(app)
        .patch(`/clubs/${create.body.id}/members/${admin.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'ADMIN' })
        .expect(200);

      const role = await request(app)
        .post(`/clubs/${create.body.id}/roles`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Level 2 member' })
        .expect(201);

      await request(app)
        .post(`/clubs/${create.body.id}/roles/${role.body.id}/members/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('PATCH /clubs/:id (profile update)', () => {
    // Minimal 1×1 pixel PNG (valid image binary)
    const minimalPng = Buffer.from(
      '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d76360f8' +
      'cfc00000000200016ef7cba40000000049454e44ae426082',
      'hex'
    );

    it('allows ADMIN to upload avatar and returns avatarUrl', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const res = await request(app)
        .patch(`/clubs/${create.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .attach('image', minimalPng, { filename: 'club.png', contentType: 'image/png' })
        .expect(200);

      expect(res.body.avatarUrl).toMatch(/\/uploads\/club-avatars\//);

      const row = await prisma.club.findUnique({ where: { id: create.body.id } });
      expect(row?.avatarUrl).toMatch(/\/uploads\/club-avatars\//);
    });

    it('updates identity fields without requiring an image', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const res = await request(app)
        .patch(`/clubs/${create.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Scarlet Chess',
          description: 'Competitive and casual chess on campus.',
          isPublic: false,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        name: 'Scarlet Chess',
        description: 'Competitive and casual chess on campus.',
        isPublic: false,
      });
    });

    it('returns 400 when no updates are provided', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      await request(app)
        .patch(`/clubs/${create.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 403 for non-admin member', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const { token: token2 } = await registerAndGetToken(
        'NonAdmin',
        `non-admin-avatar-${Date.now()}@example.com`,
        'password123'
      );
      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(201);

      await request(app)
        .patch(`/clubs/${create.body.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .attach('image', minimalPng, { filename: 'club.png', contentType: 'image/png' })
        .expect(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      await request(app)
        .patch(`/clubs/${create.body.id}`)
        .attach('image', minimalPng, { filename: 'club.png', contentType: 'image/png' })
        .expect(401);
    });
  });

  describe('DELETE /clubs/:id', () => {
    it('returns 403 for non-admin member', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

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
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      await request(app)
        .delete(`/clubs/${create.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const gone = await prisma.club.findUnique({ where: { id: create.body.id } });
      expect(gone).toBeNull();
    });
  });

  describe('Club visibility and officer channels', () => {
    it('filters officer-only announcements for regular members', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const { token: token2, user: u2 } = await registerAndGetToken(
        'Officer Two',
        `officer-two-${Date.now()}@example.com`,
        'password123'
      );
      const { token: memberToken } = await registerAndGetToken(
        'Regular Member',
        `regular-member-${Date.now()}@example.com`,
        'password123'
      );
      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(201);
      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(201);

      await prisma.clubMember.update({
        where: { clubId_userId: { clubId: create.body.id, userId: u2.id } },
        data: { role: 'OFFICER' },
      });

      await request(app)
        .post(`/clubs/${create.body.id}/announcements`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ content: 'Officer eyes only', visibility: 'OFFICERS' })
        .expect(201);

      const memberRes = await request(app)
        .get(`/clubs/${create.body.id}/announcements`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(memberRes.body.items).toHaveLength(0);

      const officerRes = await request(app)
        .get(`/clubs/${create.body.id}/announcements`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(officerRes.body.items).toHaveLength(1);
      expect(officerRes.body.items[0].visibility).toBe('OFFICERS');
    });

    it('allows only officers and admins into the officer channel', async () => {
      const create = await request(app)
        .post('/clubs')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreateBody())
        .expect(201);
      await prisma.club.update({ where: { id: create.body.id }, data: { isDiscoverable: true } });

      const { token: token2, user: u2 } = await registerAndGetToken(
        'Channel Officer',
        `channel-officer-${Date.now()}@example.com`,
        'password123'
      );
      await request(app)
        .post(`/clubs/${create.body.id}/join`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(201);

      await request(app)
        .get(`/clubs/${create.body.id}/officer-messages`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(403);

      await prisma.clubMember.update({
        where: { clubId_userId: { clubId: create.body.id, userId: u2.id } },
        data: { role: 'OFFICER' },
      });

      await request(app)
        .post(`/clubs/${create.body.id}/officer-messages`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ content: 'Officer planning note' })
        .expect(201);

      const res = await request(app)
        .get(`/clubs/${create.body.id}/officer-messages`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(res.body.messages).toHaveLength(1);
      expect(res.body.messages[0].content).toBe('Officer planning note');
    });
  });
});
