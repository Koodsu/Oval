import { NotificationService } from './NotificationService';
import { expireOldPods } from './expireOldPods';
import { deleteExpiredAbuseEvents } from './durableRateLimit';
import { deleteExpiredClosedReports } from './reportRetention';

export async function runMaintenanceJobs() {
  const expiry = await expireOldPods();

  const [
    pushReceipts,
    ,
    ,
    ,
    firstPodNudges,
    demandPrompts,
    weeklyRecaps,
    abuseEventsDeleted,
    closedReportsDeleted,
  ] = await Promise.all([
    NotificationService.checkPushReceipts(),
    NotificationService.sendMeetupReminders(),
    NotificationService.sendRecapPrompts(),
    NotificationService.expireStaleWaitlistEntries(),
    NotificationService.sendFirstPodNudges(),
    NotificationService.sendDemandConversionPrompts(),
    NotificationService.sendWeeklyRecaps(),
    deleteExpiredAbuseEvents(),
    deleteExpiredClosedReports(),
  ]);

  return {
    ...expiry,
    pushReceipts,
    firstPodNudges,
    demandPrompts,
    weeklyRecaps,
    abuseEventsDeleted,
    closedReportsDeleted,
    completedAt: new Date().toISOString(),
  };
}
