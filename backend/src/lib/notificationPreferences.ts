export interface NotificationPreferences {
  podJoin: boolean;
  podInvite: boolean;
  friendRequest: boolean;
  newMessage: boolean;
  meetupReminder: boolean;
  recapPrompt: boolean;
  waitlistSpot: boolean;
  clubMeetingCreated: boolean;
  clubAnnouncementCreated: boolean;
  clubKick: boolean;
  clubRoleChange: boolean;
  clubAttendanceOpen: boolean;
  clubRsvpReminder: boolean;
  clubOutreach: boolean;
  clubRolePing: boolean;
  weeklyRecap: boolean;
  demandAlerts: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  podJoin: true,
  podInvite: true,
  friendRequest: true,
  newMessage: true,
  meetupReminder: true,
  recapPrompt: true,
  waitlistSpot: true,
  clubMeetingCreated: true,
  clubAnnouncementCreated: true,
  clubKick: true,
  clubRoleChange: true,
  clubAttendanceOpen: true,
  clubRsvpReminder: true,
  clubOutreach: true,
  clubRolePing: true,
  weeklyRecap: true,
  demandAlerts: true,
};

export function parseNotificationPreferences(
  raw: string | null | undefined,
): NotificationPreferences {
  if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  try {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}
