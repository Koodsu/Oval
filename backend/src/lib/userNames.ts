import prisma from '../prisma';

export type NameFields = {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export const USER_NAME_SELECT = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
} as const;

export function normalizeNameParts(input: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
}): { firstName: string; lastName: string; fullName: string } {
  const explicitFirst = input.firstName?.trim() ?? '';
  const explicitLast = input.lastName?.trim() ?? '';

  if (explicitFirst) {
    const fullName = [explicitFirst, explicitLast].filter(Boolean).join(' ').trim();
    return { firstName: explicitFirst, lastName: explicitLast, fullName };
  }

  const legacyName = input.name?.trim() ?? '';
  if (!legacyName) {
    return { firstName: '', lastName: '', fullName: '' };
  }

  const [firstToken, ...rest] = legacyName.split(/\s+/);
  const lastName = rest.join(' ').trim();
  return {
    firstName: firstToken ?? '',
    lastName,
    fullName: [firstToken, lastName].filter(Boolean).join(' ').trim(),
  };
}

export function getPublicName(user: Pick<NameFields, 'name' | 'firstName' | 'lastName'>): string {
  const normalized = normalizeNameParts(user);
  return normalized.firstName || normalized.fullName;
}

export function getFullName(user: Pick<NameFields, 'name' | 'firstName' | 'lastName'>): string {
  const normalized = normalizeNameParts(user);
  return normalized.fullName || normalized.firstName;
}

export function withDisplayName<T extends Pick<NameFields, 'name' | 'firstName' | 'lastName'>>(
  user: T,
  mode: 'public' | 'full'
): T & { name: string } {
  return {
    ...user,
    name: mode === 'full' ? getFullName(user) : getPublicName(user),
  };
}

export async function getFriendIdSet(viewerId: string, candidateIds: string[]): Promise<Set<string>> {
  const uniqueIds = [...new Set(candidateIds.filter((id) => id && id !== viewerId))];
  if (uniqueIds.length === 0) return new Set<string>();

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { userAId: viewerId, userBId: { in: uniqueIds } },
        { userBId: viewerId, userAId: { in: uniqueIds } },
      ],
    },
    select: { userAId: true, userBId: true },
  });

  return new Set(
    friendships.map((friendship) => (friendship.userAId === viewerId ? friendship.userBId : friendship.userAId))
  );
}

export async function formatNameForViewer<T extends NameFields>(
  viewerId: string,
  user: T
): Promise<T & { name: string }> {
  if (user.id === viewerId) return withDisplayName(user, 'full');
  const friendIds = await getFriendIdSet(viewerId, [user.id]);
  return withDisplayName(user, friendIds.has(user.id) ? 'full' : 'public');
}
