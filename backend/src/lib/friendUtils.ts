import prisma from '../prisma';

/**
 * Returns [smaller, larger] sorted lexicographically so that any pair (A, B)
 * and (B, A) map to the same canonical order. Used for Friendship and
 * DirectMessageThread uniqueness constraints.
 */
export function normalizeUserPair(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

/**
 * Returns true if a Friendship row exists for the given pair (order-independent).
 */
export async function areFriends(userIdA: string, userIdB: string): Promise<boolean> {
  const [a, b] = normalizeUserPair(userIdA, userIdB);
  const row = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId: a, userBId: b } },
    select: { id: true },
  });
  return row !== null;
}
