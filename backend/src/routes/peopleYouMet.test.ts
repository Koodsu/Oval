import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';

async function createCompletedPodWithConfirm(
  creatorToken: string,
  activityId: string,
  secondUserId: string
) {
  const res = await request(app)
    .post('/pods/join')
    .set('Authorization', `Bearer ${creatorToken}`)
    .send({
      activityId,
      minMembers: 2,
      maxMembers: 4,
      meetupTime: new Date(Date.now() + 86400000).toISOString(),
      location: 'Thompson Library',
    })
    .expect(201);
  const podId: string = res.body.id;
  const creatorId: string = res.body.members[0].userId;

  await prisma.podMember.create({ data: { podId, userId: secondUserId } });

  // Mark both as confirmed
  await prisma.podMember.updateMany({
    where: { podId },
    data: { confirmedAt: new Date() },
  });

  // Set to COMPLETED
  await prisma.pod.update({
    where: { id: podId },
    data: { status: 'COMPLETED', meetupTime: new Date(Date.now() - 60 * 60 * 1000) },
  });

  return { podId, creatorId };
}

describe('People You Met API', () => {
  let token1: string;
  let userId1: string;
  let token2: string;
  let userId2: string;
  let activityId: string;

  beforeEach(async () => {
    const u1 = await registerAndGetToken('User One', `pym1-${Date.now()}@example.com`, 'password123');
    token1 = u1.token;
    userId1 = u1.user.id;

    const u2 = await registerAndGetToken('User Two', `pym2-${Date.now()}@example.com`, 'password123');
    token2 = u2.token;
    userId2 = u2.user.id;

    const activity = await prisma.activity.findFirst({ where: { category: 'Academic / Study' } });
    if (!activity) throw new Error('No activities in seed');
    activityId = activity.id;
  });

  it('returns non-friend confirmed attendees', async () => {
    const { podId } = await createCompletedPodWithConfirm(token1, activityId, userId2);

    const res = await request(app)
      .get(`/pods/${podId}/people-you-met`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].id).toBe(userId2);
    expect(res.body.users[0].name).toBeDefined();
  });

  it('excludes users who are already friends', async () => {
    const { podId } = await createCompletedPodWithConfirm(token1, activityId, userId2);

    // Create friendship
    await prisma.friendship.create({
      data: { userAId: userId1, userBId: userId2 },
    });

    const res = await request(app)
      .get(`/pods/${podId}/people-you-met`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(res.body.users).toHaveLength(0);
  });

  it('rejects non-confirmed members', async () => {
    const createRes = await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        activityId,
        minMembers: 2,
        maxMembers: 4,
        meetupTime: new Date(Date.now() + 86400000).toISOString(),
        location: 'Thompson Library',
      })
      .expect(201);
    const podId = createRes.body.id;

    await prisma.podMember.create({ data: { podId, userId: userId2 } });
    await prisma.pod.update({
      where: { id: podId },
      data: { status: 'COMPLETED', meetupTime: new Date(Date.now() - 60 * 60 * 1000) },
    });

    // User1 is a member but NOT confirmed
    const res = await request(app)
      .get(`/pods/${podId}/people-you-met`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(403);

    expect(res.body.error).toContain('confirmed attendee');
  });

  it('rejects requests for non-completed pods', async () => {
    const createRes = await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        activityId,
        minMembers: 2,
        maxMembers: 4,
        meetupTime: new Date(Date.now() + 86400000).toISOString(),
        location: 'Thompson Library',
      })
      .expect(201);

    const res = await request(app)
      .get(`/pods/${createRes.body.id}/people-you-met`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(400);

    expect(res.body.error).toContain('not completed');
  });

  it('excludes no-show reported users', async () => {
    const { podId } = await createCompletedPodWithConfirm(token1, activityId, userId2);

    // Report userId2 as no-show
    await prisma.noShowReport.create({
      data: { podId, reporterId: userId1, targetUserId: userId2 },
    });

    const res = await request(app)
      .get(`/pods/${podId}/people-you-met`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(res.body.users).toHaveLength(0);
  });
});
