import prisma from '../prisma';

const ACTIVE_POD_STATUSES = ['FORMING', 'LOCKED', 'COMPLETED'] as const;
const UNREAD_CAP = 100;

export async function stampPodReadState(userId: string, podId: string, at = new Date()): Promise<void> {
  await prisma.podReadState.upsert({
    where: { userId_podId: { userId, podId } },
    create: { userId, podId, lastReadAt: at },
    update: { lastReadAt: at },
  });
}

/**
 * One query each for read states + memberships, keyed by podId.
 * Falls back to the member's joinedAt when no read state exists yet.
 */
async function getReadFloors(userId: string, podIds: string[]): Promise<Map<string, Date>> {
  if (podIds.length === 0) return new Map();
  const [readStates, memberships] = await Promise.all([
    prisma.podReadState.findMany({
      where: { userId, podId: { in: podIds } },
      select: { podId: true, lastReadAt: true },
    }),
    prisma.podMember.findMany({
      where: { userId, podId: { in: podIds } },
      select: { podId: true, joinedAt: true },
    }),
  ]);

  const floors = new Map<string, Date>();
  for (const membership of memberships) floors.set(membership.podId, membership.joinedAt);
  for (const readState of readStates) floors.set(readState.podId, readState.lastReadAt);
  return floors;
}

export async function getPodUnreadMessageCount(
  userId: string,
  podId: string,
  blockedIds: Set<string> = new Set(),
): Promise<number> {
  const counts = await getPodUnreadCounts(userId, [podId], blockedIds);
  return counts.get(podId) ?? 0;
}

export async function getPodUnreadCounts(
  userId: string,
  podIds: string[],
  blockedIds: Set<string> = new Set(),
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const floors = await getReadFloors(userId, podIds);

  await Promise.all(
    podIds.map(async (podId) => {
      const floor = floors.get(podId);
      if (!floor) {
        counts.set(podId, 0);
        return;
      }
      // Blocked users' messages are hidden in the chat, so they must not
      // count as unread either — filter by sender, never by pod.
      const unread = await prisma.message.findMany({
        where: {
          podId,
          userId: blockedIds.size
            ? { not: userId, notIn: [...blockedIds] }
            : { not: userId },
          createdAt: { gt: floor },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: UNREAD_CAP,
      });
      counts.set(podId, unread.length);
    }),
  );
  return counts;
}

export async function countUnreadPodsForUser(
  userId: string,
  blockedIds: Set<string> = new Set(),
): Promise<number> {
  const memberships = await prisma.podMember.findMany({
    where: {
      userId,
      pod: { status: { in: [...ACTIVE_POD_STATUSES] } },
    },
    select: { podId: true, joinedAt: true },
  });
  if (memberships.length === 0) return 0;

  const podIds = memberships.map((membership) => membership.podId);
  const readStates = await prisma.podReadState.findMany({
    where: { userId, podId: { in: podIds } },
    select: { podId: true, lastReadAt: true },
  });
  const readAtByPod = new Map(readStates.map((state) => [state.podId, state.lastReadAt]));

  let count = 0;
  await Promise.all(
    memberships.map(async (membership) => {
      const unread = await prisma.message.findFirst({
        where: {
          podId: membership.podId,
          userId: blockedIds.size
            ? { not: userId, notIn: [...blockedIds] }
            : { not: userId },
          createdAt: { gt: readAtByPod.get(membership.podId) ?? membership.joinedAt },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (unread) count += 1;
    }),
  );

  return count;
}
