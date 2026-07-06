import prisma from '../prisma';
import { getBlockedUserIds } from './blocks';
import { countUnreadPodsForUser } from './podReadState';

export type InboxSummary = {
  dmUnread: number;
  podUnread: number;
  invites: number;
  friendRequests: number;
  total: number;
  friendsTonight: {
    count: number;
    avatars: Array<{ id: string; name: string; avatarUrl: string | null }>;
  };
};

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday(): Date {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

export async function getDmUnreadCount(userId: string, blockedIds: Set<string>): Promise<number> {
  const threads = await prisma.directMessageThread.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true, senderId: true },
      },
    },
  });

  return threads.filter((thread) => {
    const otherId = thread.userAId === userId ? thread.userBId : thread.userAId;
    if (blockedIds.has(otherId)) return false;
    const lastMessage = thread.messages[0];
    if (!lastMessage || lastMessage.senderId === userId) return false;
    const lastReadAt = thread.userAId === userId ? thread.userALastReadAt : thread.userBLastReadAt;
    return !lastReadAt || lastReadAt < lastMessage.createdAt;
  }).length;
}

async function getFriendsTonight(userId: string, blockedIds: Set<string>) {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      userA: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } },
      userB: { select: { id: true, name: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  const friendRows = friendships
    .map((friendship) => (friendship.userAId === userId ? friendship.userB : friendship.userA))
    .filter((friend) => !blockedIds.has(friend.id));
  const friendIds = friendRows.map((friend) => friend.id);
  if (friendIds.length === 0) return { count: 0, avatars: [] };

  const attending = await prisma.podMember.findMany({
    where: {
      userId: { in: friendIds },
      pod: {
        meetupTime: { gte: startOfToday(), lt: endOfToday() },
        status: { in: ['FORMING', 'LOCKED'] },
      },
    },
    select: { userId: true },
    distinct: ['userId'],
    take: 100,
  });

  const attendingIds = new Set(attending.map((row) => row.userId));
  const avatars = friendRows
    .filter((friend) => attendingIds.has(friend.id))
    .slice(0, 3)
    .map((friend) => ({
      id: friend.id,
      name: friend.firstName?.trim() || friend.name,
      avatarUrl: friend.avatarUrl,
    }));

  return { count: attendingIds.size, avatars };
}

export async function getInboxSummary(userId: string): Promise<InboxSummary> {
  const blockedIds = await getBlockedUserIds(userId);

  const [dmUnread, podUnread, invites, friendRequests, friendsTonight] = await Promise.all([
    getDmUnreadCount(userId, blockedIds),
    countUnreadPodsForUser(userId, blockedIds),
    prisma.podInvite.count({
      where: {
        receiverId: userId,
        status: 'PENDING',
        senderId: blockedIds.size ? { notIn: [...blockedIds] } : undefined,
        pod: {
          status: 'FORMING',
          meetupTime: { gt: new Date() },
        },
      },
    }),
    prisma.friendRequest.count({
      where: {
        receiverId: userId,
        status: 'PENDING',
        senderId: blockedIds.size ? { notIn: [...blockedIds] } : undefined,
      },
    }),
    getFriendsTonight(userId, blockedIds),
  ]);

  return {
    dmUnread,
    podUnread,
    invites,
    friendRequests,
    total: dmUnread + podUnread + invites + friendRequests,
    friendsTonight,
  };
}
