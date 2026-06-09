import { NotificationService } from './NotificationService';
import { expireOldPods } from './expireOldPods';
import { deleteExpiredAbuseEvents } from './durableRateLimit';
import { deleteExpiredClosedReports } from './reportRetention';

export async function runMaintenanceJobs() {
  const expiry = await expireOldPods();

  const [, , , abuseEventsDeleted, closedReportsDeleted] = await Promise.all([
    NotificationService.sendMeetupReminders(),
    NotificationService.sendRecapPrompts(),
    NotificationService.expireStaleWaitlistEntries(),
    deleteExpiredAbuseEvents(),
    deleteExpiredClosedReports(),
  ]);

  return {
    ...expiry,
    abuseEventsDeleted,
    closedReportsDeleted,
    completedAt: new Date().toISOString(),
  };
}
