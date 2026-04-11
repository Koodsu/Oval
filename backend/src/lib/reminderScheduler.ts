import prisma from '../prisma';
import { notifyMeetupReminder } from './NotificationService';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const WINDOW_EARLY_MS = 55 * 60 * 1000;  // 55 minutes from now
const WINDOW_LATE_MS = 65 * 60 * 1000;   // 65 minutes from now

// Track pods that have already received a reminder this server session
// to prevent duplicate sends (e.g. two ticks within the same 10-min window)
const remindedPodIds = new Set<string>();

async function tick(): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_EARLY_MS);
  const windowEnd = new Date(now.getTime() + WINDOW_LATE_MS);

  try {
    const pods = await prisma.pod.findMany({
      where: {
        status: 'LOCKED',
        meetupTime: { gte: windowStart, lte: windowEnd },
        id: { notIn: [...remindedPodIds] },
      },
      include: {
        activity: { select: { title: true } },
        members: {
          include: {
            user: { select: { pushToken: true, notificationPreferences: true } },
          },
        },
      },
    });

    for (const pod of pods) {
      const eligibleTokens = pod.members
        .filter((m) => {
          if (!m.user.pushToken) return false;
          const prefs = m.user.notificationPreferences
            ? (() => {
                try { return JSON.parse(m.user.notificationPreferences!); } catch { return {}; }
              })()
            : {};
          return prefs.meetupReminder !== false;
        })
        .map((m) => ({ pushToken: m.user.pushToken! }));

      if (eligibleTokens.length === 0) continue;

      remindedPodIds.add(pod.id);
      await notifyMeetupReminder(
        pod.id,
        pod.activity?.title ?? 'Your Meetup',
        pod.meetupTime,
        eligibleTokens
      );
      console.log(
        `[reminderScheduler] Sent reminders for pod ${pod.id} (${eligibleTokens.length} members)`
      );
    }
  } catch (err) {
    console.error('[reminderScheduler] tick error:', err);
  }
}

export function startReminderScheduler(): void {
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log('[reminderScheduler] Started — checking every 5 minutes');
}
