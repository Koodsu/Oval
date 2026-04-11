import { NotificationService } from './NotificationService';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function startReminderScheduler(): void {
  setInterval(() => {
    NotificationService.sendMeetupReminders().catch((err) =>
      console.error('[reminderScheduler] error:', err)
    );
  }, CHECK_INTERVAL_MS);
  console.log('[reminderScheduler] Started — checking every 5 minutes');
}
