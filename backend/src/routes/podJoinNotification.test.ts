import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';
import { NotificationService } from '../lib/NotificationService';
import { normalizeUserPair } from '../lib/friendUtils';

describe('notifyPodJoin — single call site', () => {
  let activityId: string;
  const validLocation = 'Thompson Library';

  beforeEach(async () => {
    const activity = await prisma.activity.findFirst({ where: { category: 'Academic / Study' } });
    if (!activity) throw new Error('No activities in seed');
    activityId = activity.id;
  });

  it('POST /pods/join with podId notifies creator exactly once', async () => {
    const spy = vi.spyOn(NotificationService, 'notifyPodJoin').mockResolvedValue(undefined);

    const { token: creatorToken, user: creatorUser } = await registerAndGetToken(
      'Pod Owner',
      `pod-owner-${Date.now()}@example.com`,
      'password123'
    );

    const meetupTime = new Date(Date.now() + 86400000);
    const createRes = await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        activityId,
        minMembers: 2,
        maxMembers: 4,
        meetupTime: meetupTime.toISOString(),
        location: validLocation,
      })
      .expect(201);

    const podId = createRes.body.id as string;

    const { token: joinerToken, user: joinerUser } = await registerAndGetToken(
      'Joiner One',
      `joiner-one-${Date.now()}@example.com`,
      'password123'
    );

    await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${joinerToken}`)
      .send({ podId })
      .expect(201);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(podId, joinerUser.id);

    spy.mockRestore();
  });

  it('POST /pods/invites/:id/accept notifies creator exactly once', async () => {
    const spy = vi.spyOn(NotificationService, 'notifyPodJoin').mockResolvedValue(undefined);

    const { token: creatorToken, user: creatorUser } = await registerAndGetToken(
      'Invite Sender',
      `invite-sender-${Date.now()}@example.com`,
      'password123'
    );
    const { token: receiverToken, user: receiverUser } = await registerAndGetToken(
      'Invite Receiver',
      `invite-rcv-${Date.now()}@example.com`,
      'password123'
    );

    const [userAId, userBId] = normalizeUserPair(creatorUser.id, receiverUser.id);
    await prisma.friendship.create({ data: { userAId, userBId } });

    const meetupTime = new Date(Date.now() + 86400000);
    const createRes = await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        activityId,
        minMembers: 2,
        maxMembers: 4,
        meetupTime: meetupTime.toISOString(),
        location: validLocation,
      })
      .expect(201);

    const podId = createRes.body.id as string;

    const inviteRes = await request(app)
      .post(`/pods/${podId}/invite`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ receiverId: receiverUser.id })
      .expect(201);

    await request(app)
      .post(`/pods/invites/${inviteRes.body.id}/accept`)
      .set('Authorization', `Bearer ${receiverToken}`)
      .expect(201);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(podId, receiverUser.id);

    spy.mockRestore();
  });

  it('does not notify when POST /pods/join is a no-op (already in pod)', async () => {
    const spy = vi.spyOn(NotificationService, 'notifyPodJoin').mockResolvedValue(undefined);

    const { token: creatorToken } = await registerAndGetToken(
      'Owner Two',
      `owner-two-${Date.now()}@example.com`,
      'password123'
    );

    const meetupTime = new Date(Date.now() + 86400000);
    const createRes = await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        activityId,
        minMembers: 2,
        maxMembers: 4,
        meetupTime: meetupTime.toISOString(),
        location: validLocation,
      })
      .expect(201);

    const podId = createRes.body.id as string;

    const { token: joinerToken } = await registerAndGetToken(
      'Joiner Two',
      `joiner-two-${Date.now()}@example.com`,
      'password123'
    );

    await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${joinerToken}`)
      .send({ podId })
      .expect(201);

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockClear();

    await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${joinerToken}`)
      .send({ podId })
      .expect(409);

    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });
});
