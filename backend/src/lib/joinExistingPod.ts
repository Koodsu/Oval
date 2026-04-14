import prisma from '../prisma';
import { hasBlockingRelationship } from './blocks';
import { NotificationService } from './NotificationService';

/** Interactive transaction client for this app's PrismaClient (see prisma.$transaction callback). */
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Same shape as routes/pods — used for join responses and interestTags parsing. */
export const MEMBER_USER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  interestTags: true,
  classYear: true,
  major: true,
} as const;

export function parseMemberTags<T extends { user: { interestTags?: string | null } }>(member: T) {
  let tags: string[] = [];
  if (member.user.interestTags) {
    try {
      tags = JSON.parse(member.user.interestTags);
    } catch {
      /* ignore */
    }
  }
  return { ...member, user: { ...member.user, interestTags: tags } };
}

export function parsePodMembers<T extends { members: Array<{ user: { interestTags?: string | null } }> }>(pod: T) {
  return { ...pod, members: pod.members.map(parseMemberTags) };
}

const FORMING = 'FORMING';
const LOCKED = 'LOCKED';
const EXPIRED = 'EXPIRED';
const COMPLETED = 'COMPLETED';

const updatedPodInclude = {
  activity: true,
  creator: { select: { id: true } },
  members: { include: { user: { select: MEMBER_USER_SELECT } } },
} as const;

export type JoinExistingPodError = { ok: false; status: number; error: string };

/** Pod row with members + user fields suitable for parsePodMembers (exact Prisma shape varies by client). */
export type PodForMemberParse = {
  members: Array<{ user: { interestTags?: string | null } }>;
  creatorId?: string | null;
};

export type JoinExistingPodSuccess = {
  ok: true;
  updatedPod: PodForMemberParse;
  didAddMember: true;
};

export type JoinExistingPodResult = JoinExistingPodError | JoinExistingPodSuccess;

async function joinWithinTx(
  tx: PrismaTx,
  userId: string,
  podId: string,
  markInviteAcceptedId?: string
): Promise<JoinExistingPodResult> {
  const pod = await tx.pod.findUnique({
    where: { id: podId },
    include: { members: true, activity: true },
  });

  if (!pod) {
    return { ok: false, status: 404, error: 'Pod not found' };
  }

  if (pod.status === EXPIRED || pod.status === COMPLETED) {
    return { ok: false, status: 409, error: 'This pod is no longer available' };
  }

  if (pod.status !== FORMING) {
    return { ok: false, status: 409, error: 'This pod is no longer accepting members' };
  }

  if (pod.members.length >= pod.maxMembers) {
    return { ok: false, status: 409, error: 'This pod is full' };
  }

  if (pod.members.some((m) => m.userId === userId)) {
    return { ok: false, status: 409, error: 'Already a member of this pod' };
  }

  for (const m of pod.members) {
    if (await hasBlockingRelationship(userId, m.userId)) {
      return { ok: false, status: 403, error: "You can't join this pod." };
    }
  }

  const existingMembership = await tx.podMember.findFirst({
    where: {
      userId,
      pod: {
        activityId: pod.activityId,
        status: { in: [FORMING, LOCKED] },
      },
    },
  });

  if (existingMembership) {
    return { ok: false, status: 409, error: 'You are already in an active pod for this activity' };
  }

  if (markInviteAcceptedId) {
    const invite = await tx.podInvite.findUnique({ where: { id: markInviteAcceptedId } });
    if (!invite || invite.status !== 'PENDING' || invite.podId !== podId || invite.receiverId !== userId) {
      return { ok: false, status: 404, error: 'Invite not found or already responded' };
    }
  }

  await tx.podMember.create({ data: { podId, userId } });

  if (markInviteAcceptedId) {
    await tx.podInvite.update({
      where: { id: markInviteAcceptedId },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });
  }

  await tx.podWaitlist.updateMany({
    where: { podId, userId, status: { in: ['WAITING', 'NOTIFIED'] } },
    data: { status: 'JOINED' },
  });

  const memberCount = await tx.podMember.count({ where: { podId } });
  if (memberCount >= pod.maxMembers) {
    await tx.pod.update({ where: { id: podId }, data: { status: LOCKED } });
  }

  const updatedPod = await tx.pod.findUnique({
    where: { id: podId },
    include: updatedPodInclude,
  });

  if (!updatedPod) {
    return { ok: false, status: 500, error: 'Internal server error' };
  }

  return { ok: true, updatedPod: updatedPod as PodForMemberParse, didAddMember: true };
}

/**
 * Add the user to an existing FORMING pod (shared by POST /pods/join and invite accept).
 * Sends push to the pod creator when a new member row was created (single call site).
 */
export async function joinExistingPodMember(
  userId: string,
  podId: string,
  options?: { markInviteAcceptedId?: string }
): Promise<JoinExistingPodResult> {
  try {
    const result = await prisma.$transaction((tx) => joinWithinTx(tx, userId, podId, options?.markInviteAcceptedId));

    if (result.ok && result.didAddMember && result.updatedPod.creatorId && result.updatedPod.creatorId !== userId) {
      NotificationService.notifyPodJoin(podId, userId).catch(() => {});
    }

    return result;
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return { ok: false, status: 409, error: 'Already a member of this pod' };
    }
    throw err;
  }
}
