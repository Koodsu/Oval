import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { createTestUser, getAuthToken } from '../test/helpers';

describe('Inbox summary', () => {
  beforeEach(async () => {
    await prisma.directMessage.deleteMany();
    await prisma.directMessageThread.deleteMany();
    await prisma.friendRequest.deleteMany();
    await prisma.podInvite.deleteMany();
    await prisma.message.deleteMany();
    await prisma.podReadState.deleteMany();
    await prisma.podMember.deleteMany();
    await prisma.pod.deleteMany();
  });

  it('returns unified DM, pod, invite, and friend-request counts', async () => {
    const [me, friend, inviter, requester] = await Promise.all([
      createTestUser({ name: 'Inbox Me' }),
      createTestUser({ name: 'Inbox Friend' }),
      createTestUser({ name: 'Inbox Inviter' }),
      createTestUser({ name: 'Inbox Requester' }),
    ]);
    const token = getAuthToken(me.id, me.email);
    const activity = await prisma.activity.findFirst({ where: { category: 'Academic / Study' } });
    if (!activity) throw new Error('No Academic activity in seed');

    const thread = await prisma.directMessageThread.create({
      data: { userAId: me.id, userBId: friend.id },
    });
    await prisma.directMessage.create({
      data: { threadId: thread.id, senderId: friend.id, content: 'Unread DM' },
    });

    const pod = await prisma.pod.create({
      data: {
        activityId: activity.id,
        creatorId: friend.id,
        meetupTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        location: 'Thompson Library',
        status: 'FORMING',
      },
    });
    // joinedAt explicitly in the past: message.createdAt must be strictly > joinedAt
    // to count as unread, and both default to now() at ms precision (flaky otherwise).
    const joinedAt = new Date(Date.now() - 60_000);
    await prisma.podMember.createMany({
      data: [
        { podId: pod.id, userId: me.id, joinedAt },
        { podId: pod.id, userId: friend.id, joinedAt },
      ],
    });
    await prisma.message.create({
      data: { podId: pod.id, userId: friend.id, content: 'Unread pod message' },
    });

    const invitePod = await prisma.pod.create({
      data: {
        activityId: activity.id,
        creatorId: inviter.id,
        meetupTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
        location: 'Thompson Library',
        status: 'FORMING',
      },
    });
    await prisma.podInvite.create({
      data: { podId: invitePod.id, senderId: inviter.id, receiverId: me.id, status: 'PENDING' },
    });
    await prisma.friendRequest.create({
      data: { senderId: requester.id, receiverId: me.id, status: 'PENDING' },
    });

    const res = await request(app)
      .get('/inbox/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      dmUnread: 1,
      podUnread: 1,
      invites: 1,
      friendRequests: 1,
      total: 4,
    });
  });
});
