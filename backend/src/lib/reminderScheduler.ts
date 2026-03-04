import cron from 'node-cron';
import { NotificationService } from './NotificationService';

export function startReminderScheduler(): void {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await NotificationService.sendMeetupReminders();
  });
}
