import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';

describe('GET /users/:id', () => {
  it('returns public profile with podsAttended=0 for a verified user', async () => {
    const { token, user } = await registerAndGetToken(
      'Profile User',
      `profile-get-${Date.now()}@example.com`,
      'password123'
    );

    const res = await request(app)
      .get(`/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: user.id,
      name: user.name,
      verifiedUniversity: true,
      podsAttended: 0,
      joinedAt: expect.any(String),
    });
  });

  it('counts only COMPLETED pods in podsAttended', async () => {
    const { token, user } = await registerAndGetToken(
      'Attended User',
      `attended-${Date.now()}@example.com`,
      'password123'
    );

    const activity = await prisma.activity.findFirst({ where: { category: 'Academic' } });
    if (!activity) throw new Error('No activity');

    // Create a COMPLETED pod and add the user as a member
    const pod = await prisma.pod.create({
      data: {
        activityId: activity.id,
        meetupTime: new Date(Date.now() - 3600000),
        location: 'Main Library',
        status: 'COMPLETED',
        creatorId: user.id,
        members: { create: { userId: user.id } },
      },
    });

    const res = await request(app)
      .get(`/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.podsAttended).toBe(1);

    await prisma.podMember.deleteMany({ where: { podId: pod.id } });
    await prisma.pod.delete({ where: { id: pod.id } });
  });

  it('reflects verifiedUniversity: true after DB update', async () => {
    const { token, user } = await registerAndGetToken(
      'Verified Profile',
      `verified-profile-${Date.now()}@example.com`,
      'password123'
    );

    await prisma.user.update({ where: { id: user.id }, data: { verifiedUniversity: true } });

    const res = await request(app)
      .get(`/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.verifiedUniversity).toBe(true);
  });

  it('returns 404 for non-existent user', async () => {
    const { token } = await registerAndGetToken(
      'Auth User',
      `auth-404-${Date.now()}@example.com`,
      'password123'
    );

    await request(app)
      .get('/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('requires auth', async () => {
    await request(app).get('/users/some-id').expect(401);
  });
});

describe('POST /users/push-token', () => {
  it('stores push token for authenticated user', async () => {
    const { token } = await registerAndGetToken(
      'Push User',
      `push-token-${Date.now()}@example.com`,
      'password123'
    );

    const res = await request(app)
      .post('/users/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'ExponentPushToken[test-token-abc]' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('returns 400 when token is missing', async () => {
    const { token } = await registerAndGetToken(
      'Push User 2',
      `push-token-missing-${Date.now()}@example.com`,
      'password123'
    );

    const res = await request(app)
      .post('/users/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    expect(res.body.error).toBeDefined();
  });

  it('requires auth', async () => {
    await request(app)
      .post('/users/push-token')
      .send({ token: 'ExponentPushToken[test]' })
      .expect(401);
  });
});

describe('GET /users/notifications', () => {
  it('returns default preferences for new user', async () => {
    const { token } = await registerAndGetToken(
      'Notif User',
      `notif-get-${Date.now()}@example.com`,
      'password123'
    );

    const res = await request(app)
      .get('/users/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.preferences).toMatchObject({
      podJoin: true,
      newMessage: true,
      meetupReminder: true,
    });
  });

  it('requires auth', async () => {
    await request(app).get('/users/notifications').expect(401);
  });
});

describe('PATCH /users/notifications', () => {
  it('updates meetupReminder preference', async () => {
    const { token } = await registerAndGetToken(
      'Notif Patch User',
      `notif-patch-${Date.now()}@example.com`,
      'password123'
    );

    const res = await request(app)
      .patch('/users/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({ meetupReminder: false })
      .expect(200);

    expect(res.body.preferences.meetupReminder).toBe(false);
    expect(res.body.preferences.podJoin).toBe(true);
    expect(res.body.preferences.newMessage).toBe(true);
  });

  it('updates multiple preferences at once', async () => {
    const { token } = await registerAndGetToken(
      'Multi Pref User',
      `notif-multi-${Date.now()}@example.com`,
      'password123'
    );

    const res = await request(app)
      .patch('/users/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({ podJoin: false, newMessage: false })
      .expect(200);

    expect(res.body.preferences.podJoin).toBe(false);
    expect(res.body.preferences.newMessage).toBe(false);
    expect(res.body.preferences.meetupReminder).toBe(true);
  });

  it('returns 400 for non-boolean preference value', async () => {
    const { token } = await registerAndGetToken(
      'Bad Pref User',
      `notif-bad-${Date.now()}@example.com`,
      'password123'
    );

    const res = await request(app)
      .patch('/users/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({ meetupReminder: 'yes' })
      .expect(400);

    expect(res.body.error).toBeDefined();
  });

  it('requires auth', async () => {
    await request(app)
      .patch('/users/notifications')
      .send({ meetupReminder: false })
      .expect(401);
  });

  it('persists across GET after PATCH', async () => {
    const { token } = await registerAndGetToken(
      'Persist Pref User',
      `notif-persist-${Date.now()}@example.com`,
      'password123'
    );

    await request(app)
      .patch('/users/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({ meetupReminder: false })
      .expect(200);

    const res = await request(app)
      .get('/users/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.preferences.meetupReminder).toBe(false);
    expect(res.body.preferences.podJoin).toBe(true);
  });
});

describe('GET /users/me', () => {
  it('returns own profile with avatarUrl for authenticated user', async () => {
    const { token, user } = await registerAndGetToken(
      'Me User',
      `me-get-${Date.now()}@example.com`,
      'password123'
    );

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: user.id,
      name: user.name,
      email: user.email,
      verifiedUniversity: true,
      avatarUrl: null,
      joinedAt: expect.any(String),
    });
  });

  it('requires auth', async () => {
    await request(app).get('/users/me').expect(401);
  });
});

describe('PATCH /users/me/avatar', () => {
  it('returns 400 when no file is attached', async () => {
    const { token } = await registerAndGetToken(
      'Avatar User',
      `avatar-nofile-${Date.now()}@example.com`,
      'password123'
    );

    const res = await request(app)
      .patch('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(res.body.error).toBeDefined();
  });

  it('uploads a valid image and returns avatarUrl', async () => {
    const { token, user } = await registerAndGetToken(
      'Avatar Upload User',
      `avatar-upload-${Date.now()}@example.com`,
      'password123'
    );

    // Minimal 1×1 pixel PNG (valid image binary)
    const minimalPng = Buffer.from(
      '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d76360f8' +
      'cfc00000000200016ef7cba40000000049454e44ae426082',
      'hex'
    );

    const res = await request(app)
      .patch('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', minimalPng, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(200);

    expect(res.body.avatarUrl).toMatch(/\/uploads\/avatars\//);

    // Verify it was persisted in the DB
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser?.avatarUrl).toMatch(/\/uploads\/avatars\//);
  });

  it('requires auth', async () => {
    await request(app).patch('/users/me/avatar').expect(401);
  });
});

describe('DELETE /users/me/avatar', () => {
  it('removes avatar and returns avatarUrl: null', async () => {
    const { token, user } = await registerAndGetToken(
      'Avatar Delete User',
      `avatar-delete-${Date.now()}@example.com`,
      'password123'
    );

    // Seed an avatarUrl directly
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: '/uploads/avatars/fake.jpg' } });

    const res = await request(app)
      .delete('/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.avatarUrl).toBeNull();

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser?.avatarUrl).toBeNull();
  });

  it('requires auth', async () => {
    await request(app).delete('/users/me/avatar').expect(401);
  });
});

describe('Privacy and account data APIs', () => {
  it('exports account data without authentication secrets', async () => {
    const { token, user } = await registerAndGetToken(
      'Data Export User',
      `data-export-${Date.now()}@example.com`,
      'password123'
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        bio: 'Export this profile',
        instagramHandle: 'bridgeexport',
        notificationPreferences: JSON.stringify({ newMessage: false }),
      },
    });

    const res = await request(app)
      .get('/users/me/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      formatVersion: 1,
      exportedAt: expect.any(String),
      account: {
        id: user.id,
        email: user.email,
      },
      profile: {
        bio: 'Export this profile',
        instagramHandle: 'bridgeexport',
      },
      notificationPreferences: {
        newMessage: false,
        podJoin: true,
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('password123');
    expect(res.body.account.password).toBeUndefined();
    expect(res.body.account.pushToken).toBeUndefined();
  });

  it('deletes the user, their posts, and memberships while transferring club ownership', async () => {
    const owner = await registerAndGetToken(
      'Delete Owner',
      `delete-owner-${Date.now()}@example.com`,
      'password123'
    );
    const successor = await registerAndGetToken(
      'Delete Successor',
      `delete-successor-${Date.now()}@example.com`,
      'password123'
    );

    const club = await prisma.club.create({
      data: {
        name: `Deletion Club ${Date.now()}`,
        description: 'Club used to verify account deletion',
        category: 'Academic',
        createdById: owner.user.id,
        members: {
          create: [
            { userId: owner.user.id, role: 'OWNER' },
            { userId: successor.user.id, role: 'ADMIN' },
          ],
        },
      },
    });
    await prisma.clubAnnouncement.create({
      data: { clubId: club.id, userId: owner.user.id, content: 'Delete this announcement' },
    });
    const clubMessage = await prisma.clubMessage.create({
      data: { clubId: club.id, userId: owner.user.id, content: 'Delete this message' },
    });
    const retainedReport = await prisma.report.create({
      data: {
        reporterId: successor.user.id,
        targetUserId: owner.user.id,
        clubId: club.id,
        clubMessageId: clubMessage.id,
        targetType: 'CLUB_MESSAGE',
        reason: 'HARASSMENT',
        severity: 'P1',
        reportedContent: clubMessage.content,
      },
    });

    await request(app)
      .delete('/users/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(204);

    expect(await prisma.user.findUnique({ where: { id: owner.user.id } })).toBeNull();
    expect(await prisma.clubMember.count({ where: { userId: owner.user.id } })).toBe(0);
    expect(await prisma.clubAnnouncement.count({ where: { userId: owner.user.id } })).toBe(0);
    expect(await prisma.clubMessage.count({ where: { userId: owner.user.id } })).toBe(0);
    expect(await prisma.report.findUnique({ where: { id: retainedReport.id } })).toMatchObject({
      reporterId: successor.user.id,
      targetUserId: null,
      clubMessageId: null,
      reportedContent: 'Delete this message',
    });

    const transferredClub = await prisma.club.findUnique({
      where: { id: club.id },
      include: { members: true },
    });
    expect(transferredClub?.createdById).toBe(successor.user.id);
    expect(transferredClub?.members.find((member) => member.userId === successor.user.id)?.role).toBe('OWNER');
  });

  it('requires auth for export and deletion', async () => {
    await request(app).get('/users/me/export').expect(401);
    await request(app).delete('/users/me').expect(401);
  });
});

describe('Block API (integration)', () => {
  let tokenA: string;
  let userIdA: string;
  let tokenB: string;
  let userIdB: string;
  let activityId: string;

  beforeEach(async () => {
    const a = await registerAndGetToken(
      'User A',
      `block-test-a-${Date.now()}@example.com`,
      'password123'
    );
    const b = await registerAndGetToken(
      'User B',
      `block-test-b-${Date.now()}@example.com`,
      'password123'
    );
    tokenA = a.token;
    userIdA = a.user.id;
    tokenB = b.token;
    userIdB = b.user.id;

    const activity = await prisma.activity.findFirst({
      where: { category: 'Academic' },
    });
    if (!activity) throw new Error('No activities in seed');
    activityId = activity.id;
  });

  describe('POST /users/:id/block', () => {
    it('cannot block self', async () => {
      const res = await request(app)
        .post(`/users/${userIdA}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(res.body.error).toContain("can't block yourself");
    });

    it('returns 404 for non-existent user', async () => {
      await request(app)
        .post('/users/00000000-0000-0000-0000-000000000000/block')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });

    it('creates block and returns success', async () => {
      const res = await request(app)
        .post(`/users/${userIdB}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.blockId).toBeDefined();
      expect(res.body.createdAt).toBeDefined();

      const block = await prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: userIdA, blockedId: userIdB } },
      });
      expect(block).toBeTruthy();
    });

    it('idempotent: returns success when already blocked', async () => {
      await request(app)
        .post(`/users/${userIdB}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const res = await request(app)
        .post(`/users/${userIdB}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const count = await prisma.block.count({
        where: { blockerId: userIdA, blockedId: userIdB },
      });
      expect(count).toBe(1);
    });

    it('rejects unauthenticated requests', async () => {
      await request(app).post(`/users/${userIdB}/block`).expect(401);
    });
  });

  describe('DELETE /users/:id/block', () => {
    it('removes block and returns success', async () => {
      await prisma.block.create({
        data: { blockerId: userIdA, blockedId: userIdB },
      });

      const res = await request(app)
        .delete(`/users/${userIdB}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const block = await prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: userIdA, blockedId: userIdB } },
      });
      expect(block).toBeNull();
    });

    it('idempotent: returns 204 when no block exists', async () => {
      await request(app)
        .delete(`/users/${userIdB}/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);
    });

    it('rejects unauthenticated requests', async () => {
      await request(app).delete(`/users/${userIdB}/block`).expect(401);
    });
  });
});
