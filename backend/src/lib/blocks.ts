import prisma from '../prisma';

/**
 * Returns true if there is a blocking relationship between userA and userB
 * (either A blocked B or B blocked A).
 */
export async function hasBlockingRelationship(
  userIdA: string,
  userIdB: string
): Promise<boolean> {
  if (userIdA === userIdB) return false;

  const count = await (prisma as any).block.count({
    where: {
      OR: [
        { blockerId: userIdA, blockedId: userIdB },
        { blockerId: userIdB, blockedId: userIdA },
      ],
    },
  });
  return count > 0;
}

/**
 * Returns user IDs that have a blocking relationship with the given user.
 */
export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  const blocks = await (prisma as any).block.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
  });
  const ids = new Set<string>();
  for (const b of blocks) {
    ids.add(b.blockerId);
    ids.add(b.blockedId);
  }
  ids.delete(userId);
  return ids;
}
