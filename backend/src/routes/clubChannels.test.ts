import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';

/**
 * Club channels, per-channel read state, role colors/self-assign, and @role pings.
 */
describe('Club channels API (integration)', () => {
  let ownerToken: string;
  let ownerId: string;
  let memberToken: string;
  let memberId: string;
  let clubId: string;

  const createClub = async () => {
    const res = await request(app)
      .post('/clubs')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Channel Club ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description: 'Channel testing club',
        category: 'Gaming',
        emoji: '♟️',
      })
      .expect(201);
    return res.body.id as string;
  };

  beforeEach(async () => {
    const owner = await registerAndGetToken(
      'Channel Owner',
      `channel-owner-${Date.now()}@example.com`,
      'password123'
    );
    ownerToken = owner.token;
    ownerId = owner.user.id;

    const member = await registerAndGetToken(
      'Channel Member',
      `channel-member-${Date.now()}@example.com`,
      'password123'
    );
    memberToken = member.token;
    memberId = member.user.id;

    clubId = await createClub();
    await request(app)
      .post(`/clubs/${clubId}/join`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(201);
  });

  describe('GET /clubs/:id/channels', () => {
    it('lazily creates built-in channels and lists them for members', async () => {
      const res = await request(app)
        .get(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const kinds = res.body.channels.map((c: any) => c.kind);
      expect(kinds).toContain('ANNOUNCEMENTS');
      expect(kinds).toContain('GENERAL');
      expect(kinds).toContain('OFFICERS');
      const general = res.body.channels.find((c: any) => c.kind === 'GENERAL');
      expect(general.unreadCount).toBe(0);
      expect(general.canPost).toBe(true);
    });

    it('hides the officers channel from plain members', async () => {
      const res = await request(app)
        .get(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      const kinds = res.body.channels.map((c: any) => c.kind);
      expect(kinds).toContain('GENERAL');
      expect(kinds).not.toContain('OFFICERS');
    });
  });

  describe('custom channels', () => {
    it('owner can create a role-gated channel that only role holders see', async () => {
      const role = await request(app)
        .post(`/clubs/${clubId}/roles`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Competitive Team', color: 'violet' })
        .expect(201);

      const channel = await request(app)
        .post(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'team-chat', allowedRoleIds: [role.body.id] })
        .expect(201);
      expect(channel.body.kind).toBe('CUSTOM');
      expect(channel.body.allowedRoleIds).toEqual([role.body.id]);

      // Plain member can't see or read it yet
      const memberList = await request(app)
        .get(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(memberList.body.channels.map((c: any) => c.id)).not.toContain(channel.body.id);

      await request(app)
        .get(`/clubs/${clubId}/channels/${channel.body.id}/messages`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);

      // Assign the role → channel becomes visible
      await request(app)
        .post(`/clubs/${clubId}/roles/${role.body.id}/members/${memberId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const afterAssign = await request(app)
        .get(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(afterAssign.body.channels.map((c: any) => c.id)).toContain(channel.body.id);

      await request(app)
        .get(`/clubs/${clubId}/channels/${channel.body.id}/messages`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
    });

    it('members cannot create channels; built-ins cannot be deleted', async () => {
      await request(app)
        .post(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'nope' })
        .expect(403);

      const list = await request(app)
        .get(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const general = list.body.channels.find((c: any) => c.kind === 'GENERAL');

      await request(app)
        .delete(`/clubs/${clubId}/channels/${general.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);
    });

    it('deleting a custom channel removes its messages', async () => {
      const channel = await request(app)
        .post(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'temp-channel' })
        .expect(201);

      const message = await request(app)
        .post(`/clubs/${clubId}/channels/${channel.body.id}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'will vanish' })
        .expect(201);

      await request(app)
        .delete(`/clubs/${clubId}/channels/${channel.body.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const gone = await prisma.clubMessage.findUnique({ where: { id: message.body.id } });
      expect(gone).toBeNull();
    });
  });

  describe('channel messages and read state', () => {
    it('general channel messages flow through the legacy table (channelId null)', async () => {
      const list = await request(app)
        .get(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const general = list.body.channels.find((c: any) => c.kind === 'GENERAL');

      await request(app)
        .post(`/clubs/${clubId}/channels/${general.id}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'hello from channels api' })
        .expect(201);

      // Visible via the legacy endpoint too
      const legacy = await request(app)
        .get(`/clubs/${clubId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(legacy.body.messages.some((m: any) => m.content === 'hello from channels api')).toBe(true);
    });

    it('tracks unread counts and clears them on view', async () => {
      const list = await request(app)
        .get(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      const general = list.body.channels.find((c: any) => c.kind === 'GENERAL');

      await request(app)
        .post(`/clubs/${clubId}/channels/${general.id}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'unread ping' })
        .expect(201);

      const before = await request(app)
        .get(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      const generalBefore = before.body.channels.find((c: any) => c.kind === 'GENERAL');
      expect(generalBefore.unreadCount).toBe(1);
      expect(generalBefore.lastMessagePreview).toBe('unread ping');

      // Viewing marks read
      await request(app)
        .get(`/clubs/${clubId}/channels/${general.id}/messages`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      const after = await request(app)
        .get(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(after.body.channels.find((c: any) => c.kind === 'GENERAL').unreadCount).toBe(0);
    });

    it('includes per-club unread totals in GET /clubs/my', async () => {
      const list = await request(app)
        .get(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      const general = list.body.channels.find((c: any) => c.kind === 'GENERAL');

      await request(app)
        .post(`/clubs/${clubId}/channels/${general.id}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'digest unread' })
        .expect(201);

      const my = await request(app)
        .get('/clubs/my')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      const row = my.body.find((r: any) => r.club.id === clubId);
      expect(row.unreadCount).toBeGreaterThanOrEqual(1);
    });

    it('supports explicit mark-read for the announcements channel', async () => {
      await request(app)
        .post(`/clubs/${clubId}/announcements`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'Big announcement' })
        .expect(201);

      const list = await request(app)
        .get(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      const announcements = list.body.channels.find((c: any) => c.kind === 'ANNOUNCEMENTS');
      expect(announcements.unreadCount).toBe(1);

      await request(app)
        .post(`/clubs/${clubId}/channels/${announcements.id}/read`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      const after = await request(app)
        .get(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(after.body.channels.find((c: any) => c.kind === 'ANNOUNCEMENTS').unreadCount).toBe(0);
    });
  });

  describe('@role pings', () => {
    it('officers can ping roles; plain members cannot', async () => {
      const role = await request(app)
        .post(`/clubs/${clubId}/roles`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Pingable' })
        .expect(201);

      const list = await request(app)
        .get(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const general = list.body.channels.find((c: any) => c.kind === 'GENERAL');

      const pinged = await request(app)
        .post(`/clubs/${clubId}/channels/${general.id}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'meeting moved to 8pm @Pingable', mentionRoleIds: [role.body.id] })
        .expect(201);
      expect(pinged.body.mentionRoleIds).toEqual([role.body.id]);

      await request(app)
        .post(`/clubs/${clubId}/channels/${general.id}/messages`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ content: 'sneaky ping', mentionRoleIds: [role.body.id] })
        .expect(403);
    });

    it('rejects pings of roles from other clubs', async () => {
      const otherClubId = await createClub();
      const foreignRole = await request(app)
        .post(`/clubs/${otherClubId}/roles`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Foreign' })
        .expect(201);

      const list = await request(app)
        .get(`/clubs/${clubId}/channels`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const general = list.body.channels.find((c: any) => c.kind === 'GENERAL');

      await request(app)
        .post(`/clubs/${clubId}/channels/${general.id}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'bad ping', mentionRoleIds: [foreignRole.body.id] })
        .expect(400);
    });
  });

  describe('role colors and self-assign', () => {
    it('stores color and self-assignable flag', async () => {
      const role = await request(app)
        .post(`/clubs/${clubId}/roles`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Intramural', color: 'teal', isSelfAssignable: true })
        .expect(201);
      expect(role.body.color).toBe('teal');
      expect(role.body.isSelfAssignable).toBe(true);

      await request(app)
        .post(`/clubs/${clubId}/roles`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Bad Color', color: 'neon' })
        .expect(400);

      const updated = await request(app)
        .patch(`/clubs/${clubId}/roles/${role.body.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ color: 'pink', isSelfAssignable: false })
        .expect(200);
      expect(updated.body.color).toBe('pink');
      expect(updated.body.isSelfAssignable).toBe(false);
    });

    it('members can join and leave self-assignable roles only', async () => {
      const selfRole = await request(app)
        .post(`/clubs/${clubId}/roles`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Casual Squad', isSelfAssignable: true })
        .expect(201);
      const lockedRole = await request(app)
        .post(`/clubs/${clubId}/roles`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Officers Only Tag' })
        .expect(201);

      await request(app)
        .post(`/clubs/${clubId}/roles/${selfRole.body.id}/self`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(201);

      const membership = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId: memberId } },
        include: { customRoles: true },
      });
      expect(membership?.customRoles.some((r) => r.roleId === selfRole.body.id)).toBe(true);

      await request(app)
        .post(`/clubs/${clubId}/roles/${lockedRole.body.id}/self`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);

      await request(app)
        .delete(`/clubs/${clubId}/roles/${selfRole.body.id}/self`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      const afterLeave = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId: memberId } },
        include: { customRoles: true },
      });
      expect(afterLeave?.customRoles.some((r) => r.roleId === selfRole.body.id)).toBe(false);
    });
  });
});
