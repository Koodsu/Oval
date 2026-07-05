import prisma from '../prisma';

const FORMING = 'FORMING';
const LOCKED = 'LOCKED';
const COMPLETED = 'COMPLETED';
const EXPIRED = 'EXPIRED';
const THROTTLE_MS = 60 * 1000;

// NOTE: module-level state — on serverless this throttles per warm instance,
// not globally. That's fine (load-shedding, not a correctness guard; the
// expiry updates are idempotent), just don't rely on it.
let lastRunAt = 0;

/**
 * Lifecycle cleanup for pods:
 * 1. LOCKED pods whose meetup time has passed → COMPLETED (matches GET /pods/:id lazy behavior).
 * 2. FORMING pods whose meetup time has passed → EXPIRED (never locked / abandoned).
 *
 * Does not delete rows. Skips pods already COMPLETED or EXPIRED.
 */
export async function expireOldPods(): Promise<{ lockedToCompleted: number; formingToExpired: number }> {
  const now = new Date();
  if (now.getTime() - lastRunAt < THROTTLE_MS) {
    return { lockedToCompleted: 0, formingToExpired: 0 };
  }
  lastRunAt = now.getTime();

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
      meetupTime: { lt: now },
    },
    data: { status: EXPIRED },
  });

  return {
    lockedToCompleted: lockedResult.count,
    formingToExpired: expiredResult.count,
  };
}

export function resetExpireOldPodsThrottleForTests(): void {
  if (process.env.NODE_ENV === 'test') {
    lastRunAt = 0;
  }
}
