/**
 * Business logic for friend requests and friendships.
 * Kept separate from the route handler to keep validation and DB logic testable.
 */
import prisma from '../prisma';
import { hasBlockingRelationship } from '../lib/blocks';
import { normalizeUserPair, areFriends } from '../lib/friendUtils';

export type FriendRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

/**
 * Returns any PENDING friend request between two users (either direction).
 */
export async function getPendingRequestBetween(userIdA: string, userIdB: string) {
  return prisma.friendRequest.findFirst({
    where: {
      status: 'PENDING',
      OR: [
        { senderId: userIdA, receiverId: userIdB },
        { senderId: userIdB, receiverId: userIdA },
      ],
    },
  });
}

/**
 * Send a friend request from senderId to receiverId.
 * Returns the created FriendRequest or throws a descriptive Error.
 */
export async function sendFriendRequest(senderId: string, receiverId: string) {
  if (senderId === receiverId) {
    throw Object.assign(new Error('Cannot send a friend request to yourself'), { status: 400 });
  }

  const blocked = await hasBlockingRelationship(senderId, receiverId);
  if (blocked) {
    throw Object.assign(new Error('Cannot send a friend request to this user'), { status: 403 });
  }

  const already = await areFriends(senderId, receiverId);
  if (already) {
    throw Object.assign(new Error('Already friends'), { status: 409 });
  }

  const existing = await getPendingRequestBetween(senderId, receiverId);
  if (existing) {
    if (existing.senderId === senderId) {
      throw Object.assign(new Error('Friend request already sent'), { status: 409 });
    }
    // Incoming request exists — tell caller to accept it instead
    throw Object.assign(new Error('This user has already sent you a friend request'), { status: 409 });
  }

  return prisma.friendRequest.create({
    data: { senderId, receiverId, status: 'PENDING' },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true, verifiedUniversity: true } },
      receiver: { select: { id: true, name: true, avatarUrl: true, verifiedUniversity: true } },
    },
  });
}

/**
 * Accept a pending friend request. Only the receiver may accept.
 * Creates a Friendship row and a DirectMessageThread in a transaction.
 */
export async function acceptFriendRequest(requestId: string, actingUserId: string) {
  const req = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== 'PENDING') {
    throw Object.assign(new Error('Friend request not found'), { status: 404 });
  }
  if (req.receiverId !== actingUserId) {
    throw Object.assign(new Error('Not authorized'), { status: 403 });
  }

  const blocked = await hasBlockingRelationship(req.senderId, req.receiverId);
  if (blocked) {
    throw Object.assign(new Error('Cannot accept request — a block exists'), { status: 403 });
  }

  const [userAId, userBId] = normalizeUserPair(req.senderId, req.receiverId);

  return prisma.$transaction(async (tx) => {
    const friendship = await tx.friendship.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      update: {},
      create: { userAId, userBId },
    });

    await tx.directMessageThread.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      update: {},
      create: { userAId, userBId },
    });

    await tx.friendRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });

    // Cancel any other pending requests between the same pair
    await tx.friendRequest.updateMany({
      where: {
        id: { not: requestId },
        status: 'PENDING',
        OR: [
          { senderId: req.senderId, receiverId: req.receiverId },
          { senderId: req.receiverId, receiverId: req.senderId },
        ],
      },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    });

    return friendship;
  });
}

/**
 * Decline a pending friend request. Only the receiver may decline.
 */
export async function declineFriendRequest(requestId: string, actingUserId: string) {
  const req = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== 'PENDING') {
    throw Object.assign(new Error('Friend request not found'), { status: 404 });
  }
  if (req.receiverId !== actingUserId) {
    throw Object.assign(new Error('Not authorized'), { status: 403 });
  }

  return prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: 'DECLINED', respondedAt: new Date() },
  });
}

/**
 * Cancel an outgoing pending friend request. Only the sender may cancel.
 */
export async function cancelFriendRequest(requestId: string, actingUserId: string) {
  const req = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== 'PENDING') {
    throw Object.assign(new Error('Friend request not found'), { status: 404 });
  }
  if (req.senderId !== actingUserId) {
    throw Object.assign(new Error('Not authorized'), { status: 403 });
  }

  return prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: 'CANCELLED', respondedAt: new Date() },
  });
}

/**
 * Remove a friendship between two users. The thread + messages are preserved
 * but will be inaccessible (areFriends check denies DM access after unfriending).
 */
export async function unfriend(actingUserId: string, otherUserId: string) {
  const [userAId, userBId] = normalizeUserPair(actingUserId, otherUserId);
  const friendship = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
  });
  if (!friendship) {
    throw Object.assign(new Error('Not friends'), { status: 404 });
  }
  await prisma.friendship.delete({ where: { id: friendship.id } });
}

/**
 * Cancel all PENDING friend requests between two users (used when a block is created).
 */
export async function cancelPendingRequestsBetween(userIdA: string, userIdB: string) {
  await prisma.friendRequest.updateMany({
    where: {
      status: 'PENDING',
      OR: [
        { senderId: userIdA, receiverId: userIdB },
        { senderId: userIdB, receiverId: userIdA },
      ],
    },
    data: { status: 'CANCELLED', respondedAt: new Date() },
  });
}

/**
 * Delete the Friendship row between two users (used when a block is created).
 */
export async function removeFriendshipIfExists(userIdA: string, userIdB: string) {
  const [a, b] = normalizeUserPair(userIdA, userIdB);
  await prisma.friendship.deleteMany({
    where: { userAId: a, userBId: b },
  });
}
