import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { registerAndGetToken } from '../test/helpers';
import { normalizeUserPair } from '../lib/friendUtils';

describe('Pod invites routes', () => {
  let senderToken: string;
  let receiverToken: string;
  let senderUserId: string;
  let receiverUserId: string;
  let podId: string;

  beforeEach(async () => {
    const { token: sender, user: senderUser } = await registerAndGetToken(
      'Invite Sender',
      `invite-sender-${Date.now()}@example.com`,
      'password123'
    );
    const { token: receiver, user: receiverUser } = await registerAndGetToken(
      'Invite Receiver',
      `invite-receiver-${Date.now()}@example.com`,
      'password123'
    );

    senderToken = sender;
    receiverToken = receiver;
    senderUserId = senderUser.id;
    receiverUserId = receiverUser.id;

    const [userAId, userBId] = normalizeUserPair(senderUserId, receiverUserId);
    await prisma.friendship.create({ data: { userAId, userBId } });

    const activity = await prisma.activity.findFirst({
      where: { category: 'Academic / Study' },
    });
    if (!activity) throw new Error('No Academic activity in seed');

    const createRes = await request(app)
      .post('/pods/join')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        activityId: activity.id,
        minMembers: 2,
        maxMembers: 4,
        meetupTime: new Date(Date.now() + 86400000).toISOString(),
        location: 'Thompson Library',
      })
      .expect(201);

    podId = createRes.body.id as string;
  });

  it('GET /pods/invites returns pending invites for the current user', async () => {
    const inviteRes = await request(app)
      .post(`/pods/${podId}/invite`)
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ receiverId: receiverUserId })
      .expect(201);

    const res = await request(app)
      .get('/pods/invites')
      .set('Authorization', `Bearer ${receiverToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(inviteRes.body.id);
    expect(res.body[0].pod.id).toBe(podId);
    expect(res.body[0].sender.id).toBe(senderUserId);
  });

  it('POST /pods/invites/:id/accept lets the invited user join the pod', async () => {
    const inviteRes = await request(app)
      .post(`/pods/${podId}/invite`)
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ receiverId: receiverUserId })
      .expect(201);

    const acceptRes = await request(app)
      .post(`/pods/invites/${inviteRes.body.id}/accept`)
      .set('Authorization', `Bearer ${receiverToken}`)
      .expect(201);

    expect(acceptRes.body.members.some((member: { userId: string }) => member.userId === receiverUserId)).toBe(true);

    const invite = await prisma.podInvite.findUnique({ where: { id: inviteRes.body.id } });
    expect(invite?.status).toBe('ACCEPTED');
  });

  it('POST /pods/invites/:id/decline updates the invite status', async () => {
    const inviteRes = await request(app)
      .post(`/pods/${podId}/invite`)
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ receiverId: receiverUserId })
      .expect(201);

    await request(app)
      .post(`/pods/invites/${inviteRes.body.id}/decline`)
      .set('Authorization', `Bearer ${receiverToken}`)
      .expect(204);

    const invite = await prisma.podInvite.findUnique({ where: { id: inviteRes.body.id } });
    expect(invite?.status).toBe('DECLINED');
  });
});
