import { NotificationService } from './NotificationService';
import { expireOldPods } from './expireOldPods';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const POD_EXPIRY_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function startReminderScheduler(): void {
  setInterval(() => {
    NotificationService.sendMeetupReminders().catch((err) =>
      console.error('[reminderScheduler] error:', err)
    );
  }, CHECK_INTERVAL_MS);
  console.log('[reminderScheduler] Started — checking every 5 minutes');
}

/** Run pod expiry cleanup on an interval (also invoked at the start of public feed GETs). */
export function startPodExpiryScheduler(): void {
  expireOldPods().catch((err) => console.error('[podExpiryScheduler] initial run:', err));
  setInterval(() => {
    expireOldPods().catch((err) => console.error('[podExpiryScheduler] error:', err));
  }, POD_EXPIRY_INTERVAL_MS);
  console.log('[podExpiryScheduler] Started — running every 30 minutes');
}
