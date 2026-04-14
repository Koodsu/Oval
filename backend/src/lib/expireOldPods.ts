import prisma from '../prisma';

const FORMING = 'FORMING';
const LOCKED = 'LOCKED';
const COMPLETED = 'COMPLETED';
const EXPIRED = 'EXPIRED';

/**
 * Lifecycle cleanup for pods:
 * 1. LOCKED pods whose meetup time has passed → COMPLETED (matches GET /pods/:id lazy behavior).
 * 2. FORMING pods whose meetup was more than 2 hours ago → EXPIRED (never locked / abandoned).
 *
 * Does not delete rows. Skips pods already COMPLETED or EXPIRED.
 */
export async function expireOldPods(): Promise<{ lockedToCompleted: number; formingToExpired: number }> {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const lockedResult = await prisma.pod.updateMany({
    where: {
      status: LOCKED,
      meetupTime: { lt: now },
    },
    data: { status: COMPLETED },
  });

  const expiredResult = await prisma.pod.updateMany({
    where: {
      status: FORMING,
      meetupTime: { lt: twoHoursAgo },
    },
    data: { status: EXPIRED },
  });

  return {
    lockedToCompleted: lockedResult.count,
    formingToExpired: expiredResult.count,
  };
}
