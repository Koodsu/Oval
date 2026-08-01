import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server';
import prisma from '../prisma';
import { createTestUser, getAuthToken } from '../test/helpers';
import { normalizeUserPair } from '../lib/friendUtils';

async function makeUsers() {
  const a = await createTestUser({ name: 'Alice' });
  const b = await createTestUser({ name: 'Bob' });
  const tokenA = getAuthToken(a.id, a.email);
  const tokenB = getAuthToken(b.id, b.email);
  return { a, b, tokenA, tokenB };
}

describe('Friends routes', () => {
  beforeEach(async () => {
    await prisma.friendRequest.deleteMany();
    await prisma.friendship.deleteMany();
    await prisma.directMessageThread.deleteMany();
    await prisma.directMessage.deleteMany();
  });

  describe('POST /friends/requests', () => {
    it('sends a friend request', async () => {
      const { a, b, tokenA } = await makeUsers();
      const res = await request(app)
        .post('/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: b.id })
        .expect(201);
      expect(res.body.senderId).toBe(a.id);
      expect(res.body.receiverId).toBe(b.id);
      expect(res.body.status).toBe('PENDING');
    });

    it('cannot send to self', async () => {
      const { a, tokenA } = await makeUsers();
      await request(app)
        .post('/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: a.id })
        .expect(400);
    });

    it('cannot send duplicate pending request', async () => {
      const { a, b, tokenA } = await makeUsers();
      await request(app)
        .post('/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: b.id })
        .expect(201);
      await request(app)
        .post('/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: b.id })
        .expect(409);
    });

    it('returns 409 if reverse pending request exists (B already sent to A)', async () => {
      const { a, b, tokenA, tokenB } = await makeUsers();
      await request(app)
        .post('/friends/requests')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ receiverId: a.id })
        .expect(201);
      await request(app)
        .post('/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: b.id })
        .expect(409);
    });

    it('cannot send request if blocked', async () => {
      const { a, b, tokenA } = await makeUsers();
      await prisma.block.create({ data: { blockerId: b.id, blockedId: a.id } });
      await request(app)
        .post('/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: b.id })
        .expect(403);
    });

    it('cannot send request if already friends', async () => {
      const { a, b, tokenA } = await makeUsers();
      const [ua, ub] = normalizeUserPair(a.id, b.id);
      await prisma.friendship.create({ data: { userAId: ua, userBId: ub } });
      await request(app)
        .post('/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: b.id })
        .expect(409);
    });
  });

  describe('POST /friends/requests/:id/accept', () => {
    it('accepts a request, creates friendship and DM thread', async () => {
      const { a, b, tokenA, tokenB } = await makeUsers();
      const sendRes = await request(app)
        .post('/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: b.id })
        .expect(201);
      const reqId = sendRes.body.id;

      await request(app)
        .post(`/friends/requests/${reqId}/accept`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      const [ua, ub] = normalizeUserPair(a.id, b.id);
      const friendship = await prisma.friendship.findUnique({
        where: { userAId_userBId: { userAId: ua, userBId: ub } },
      });
      expect(friendship).not.toBeNull();

      const thread = await prisma.directMessageThread.findUnique({
        where: { userAId_userBId: { userAId: ua, userBId: ub } },
      });
      expect(thread).not.toBeNull();
    });

    it('only receiver can accept', async () => {
      const { a, b, tokenA } = await makeUsers();
      const sendRes = await request(app)
        .post('/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: b.id })
        .expect(201);
      await request(app)
        .post(`/friends/requests/${sendRes.body.id}/accept`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);
    });
  });

  describe('POST /friends/requests/:id/decline', () => {
    it('declines a request', async () => {
      const { a, b, tokenA, tokenB } = await makeUsers();
      const sendRes = await request(app)
        .post('/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: b.id })
        .expect(201);
      await request(app)
        .post(`/friends/requests/${sendRes.body.id}/decline`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      const req = await prisma.friendRequest.findUnique({ where: { id: sendRes.body.id } });
      expect(req?.status).toBe('DECLINED');
    });
  });

  describe('DELETE /friends/requests/:id', () => {
    it('sender can cancel a pending request', async () => {
      const { b, tokenA } = await makeUsers();
      const sendRes = await request(app)
        .post('/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: b.id })
        .expect(201);
      await request(app)
        .delete(`/friends/requests/${sendRes.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);

      const req = await prisma.friendRequest.findUnique({ where: { id: sendRes.body.id } });
      expect(req?.status).toBe('CANCELLED');
    });
  });

  describe('DELETE /friends/:userId', () => {
    it('unfriends an existing friend', async () => {
      const { a, b, tokenA } = await makeUsers();
      const [ua, ub] = normalizeUserPair(a.id, b.id);
      await prisma.friendship.create({ data: { userAId: ua, userBId: ub } });

      await request(app)
        .delete(`/friends/${b.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);

      const friendship = await prisma.friendship.findUnique({
        where: { userAId_userBId: { userAId: ua, userBId: ub } },
      });
      expect(friendship).toBeNull();
    });

    it('returns 404 if not friends', async () => {
      const { b, tokenA } = await makeUsers();
      await request(app)
        .delete(`/friends/${b.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });
  });

  describe('GET /friends', () => {
    it('returns friends list', async () => {
      const { a, b, tokenA } = await makeUsers();
      const [ua, ub] = normalizeUserPair(a.id, b.id);
      await prisma.friendship.create({ data: { userAId: ua, userBId: ub } });

      const res = await request(app)
        .get('/friends')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(b.id);
    });

    it('does not return blocked users in friends list', async () => {
      const { a, b, tokenA } = await makeUsers();
      const [ua, ub] = normalizeUserPair(a.id, b.id);
      await prisma.friendship.create({ data: { userAId: ua, userBId: ub } });
      await prisma.block.create({ data: { blockerId: a.id, blockedId: b.id } });

      const res = await request(app)
        .get('/friends')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.length).toBe(0);
    });
  });

  describe('GET /friends/relationship/:userId', () => {
    it('returns NONE when no relationship', async () => {
      const { b, tokenA } = await makeUsers();
      const res = await request(app)
        .get(`/friends/relationship/${b.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.status).toBe('NONE');
    });

    it('returns PENDING_SENT when request sent', async () => {
      const { b, tokenA } = await makeUsers();
      const sendRes = await request(app)
        .post('/friends/requests')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ receiverId: b.id });
      const reqId = sendRes.body.id;

      const res = await request(app)
        .get(`/friends/relationship/${b.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.status).toBe('PENDING_SENT');
      expect(res.body.requestId).toBe(reqId);
    });

    it('returns FRIENDS when friends', async () => {
      const { a, b, tokenA } = await makeUsers();
      const [ua, ub] = normalizeUserPair(a.id, b.id);
      await prisma.friendship.create({ data: { userAId: ua, userBId: ub } });

      const res = await request(app)
        .get(`/friends/relationship/${b.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.status).toBe('FRIENDS');
    });

    it('returns BLOCKED when block exists', async () => {
      const { a, b, tokenA } = await makeUsers();
      await prisma.block.create({ data: { blockerId: a.id, blockedId: b.id } });

      const res = await request(app)
        .get(`/friends/relationship/${b.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(res.body.status).toBe('BLOCKED');
    });
  });
});

describe('Direct Messages routes', () => {
  beforeEach(async () => {
    await prisma.directMessage.deleteMany();
    await prisma.directMessageThread.deleteMany();
    await prisma.friendship.deleteMany();
  });

  async function makeFriends() {
    const { a, b, tokenA, tokenB } = await (async () => {
      const a = await createTestUser({ name: 'Alice DM' });
      const b = await createTestUser({ name: 'Bob DM' });
      return { a, b, tokenA: getAuthToken(a.id, a.email), tokenB: getAuthToken(b.id, b.email) };
    })();
    const [ua, ub] = normalizeUserPair(a.id, b.id);
    const friendship = await prisma.friendship.create({ data: { userAId: ua, userBId: ub } });
    const thread = await prisma.directMessageThread.create({ data: { userAId: ua, userBId: ub } });
    return { a, b, tokenA, tokenB, friendship, thread };
  }

  it('GET /messages/threads returns threads for user', async () => {
    const { tokenA, thread } = await makeFriends();
    const res = await request(app)
      .get('/messages/threads')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((t: { id: string }) => t.id === thread.id)).toBe(true);
  });

  it('GET /messages/threads/:id returns messages', async () => {
    const { b, tokenA, thread } = await makeFriends();
    const res = await request(app)
      .get(`/messages/threads/${thread.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(Array.isArray(res.body.typingUserIds)).toBe(true);
    expect(res.body.otherUser).toMatchObject({ id: b.id, name: 'Bob DM' });
  });

  it('POST /messages/threads/:id/messages sends a message', async () => {
    const { a, tokenA, thread } = await makeFriends();
    const res = await request(app)
      .post(`/messages/threads/${thread.id}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'Hello Bob!' })
      .expect(201);
    expect(res.body.content).toBe('Hello Bob!');
    expect(res.body.senderId).toBe(a.id);
  });

  it('denies DM access after unfriending', async () => {
    const { a, b, tokenA, thread } = await makeFriends();
    const [ua, ub] = normalizeUserPair(a.id, b.id);
    await prisma.friendship.deleteMany({ where: { userAId: ua, userBId: ub } });

    await request(app)
      .get(`/messages/threads/${thread.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
  });

  it('denies DM when blocked', async () => {
    const { a, b, tokenA, thread } = await makeFriends();
    await prisma.block.create({ data: { blockerId: a.id, blockedId: b.id } });

    await request(app)
      .get(`/messages/threads/${thread.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    await prisma.block.deleteMany({ where: { blockerId: a.id, blockedId: b.id } });
  });

  it('rejects message exceeding 2000 chars', async () => {
    const { tokenA, thread } = await makeFriends();
    await request(app)
      .post(`/messages/threads/${thread.id}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'x'.repeat(2001) })
      .expect(400);
  });

  it('non-participant cannot access thread', async () => {
    const c = await createTestUser({ name: 'Charlie' });
    const tokenC = getAuthToken(c.id, c.email);
    const { thread } = await makeFriends();

    await request(app)
      .get(`/messages/threads/${thread.id}`)
      .set('Authorization', `Bearer ${tokenC}`)
      .expect(403);
  });
});

describe('User search', () => {
  it('GET /users/search returns users by name', async () => {
    const searcher = await createTestUser({ name: 'Searcher' });
    const target = await createTestUser({ name: 'UniqueSearchTarget123' });
    const token = getAuthToken(searcher.id, searcher.email);

    const res = await request(app)
      .get('/users/search?q=UniqueSearchTarget123')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.some((u: { id: string }) => u.id === target.id)).toBe(true);
  });

  it('does not return blocked users in search', async () => {
    const searcher = await createTestUser({ name: 'SearcherBlock' });
    const blocked = await createTestUser({ name: 'BlockedSearchTarget999' });
    const token = getAuthToken(searcher.id, searcher.email);
    await prisma.block.create({ data: { blockerId: searcher.id, blockedId: blocked.id } });

    const res = await request(app)
      .get('/users/search?q=BlockedSearchTarget999')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.every((u: { id: string }) => u.id !== blocked.id)).toBe(true);
    await prisma.block.deleteMany({ where: { blockerId: searcher.id, blockedId: blocked.id } });
  });

  it('does not return self in search', async () => {
    const searcher = await createTestUser({ name: 'SelfSearcher' });
    const token = getAuthToken(searcher.id, searcher.email);

    const res = await request(app)
      .get('/users/search?q=SelfSearcher')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.every((u: { id: string }) => u.id !== searcher.id)).toBe(true);
  });

  it('returns empty array for empty query', async () => {
    const searcher = await createTestUser({ name: 'EmptyQ' });
    const token = getAuthToken(searcher.id, searcher.email);

    const res = await request(app)
      .get('/users/search?q=')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });
});

describe('User profile friendCount', () => {
  it('GET /users/:id includes friendCount', async () => {
    const a = await createTestUser({ name: 'FriendCountA' });
    const b = await createTestUser({ name: 'FriendCountB' });
    const tokenA = getAuthToken(a.id, a.email);
    const [ua, ub] = normalizeUserPair(a.id, b.id);
    await prisma.friendship.create({ data: { userAId: ua, userBId: ub } });

    const res = await request(app)
      .get(`/users/${a.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body.friendCount).toBe(1);
    await prisma.friendship.deleteMany({ where: { userAId: ua, userBId: ub } });
  });
});

describe('Block cancels friend requests and friendship', () => {
  it('blocking a user cancels pending friend requests', async () => {
    const { a, b, tokenA } = await (async () => {
      const a = await createTestUser({ name: 'BlockerA' });
      const b = await createTestUser({ name: 'BlockedB' });
      return { a, b, tokenA: getAuthToken(a.id, a.email), tokenB: getAuthToken(b.id, b.email) };
    })();

    const sendRes = await request(app)
      .post('/friends/requests')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ receiverId: b.id })
      .expect(201);

    await request(app)
      .post(`/users/${b.id}/block`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const req = await prisma.friendRequest.findUnique({ where: { id: sendRes.body.id } });
    expect(req?.status).toBe('CANCELLED');
  });

  it('blocking a user removes existing friendship', async () => {
    const a = await createTestUser({ name: 'BlockFriendA' });
    const b = await createTestUser({ name: 'BlockFriendB' });
    const tokenA = getAuthToken(a.id, a.email);
    const [ua, ub] = normalizeUserPair(a.id, b.id);
    await prisma.friendship.create({ data: { userAId: ua, userBId: ub } });

    await request(app)
      .post(`/users/${b.id}/block`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const friendship = await prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId: ua, userBId: ub } },
    });
    expect(friendship).toBeNull();
    await prisma.block.deleteMany({ where: { blockerId: a.id, blockedId: b.id } });
  });
});
