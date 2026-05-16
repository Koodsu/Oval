import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import prisma from '../prisma';
import { getPublicName } from './userNames';

const expo = new Expo();

interface NotificationPreferences {
  podJoin: boolean;
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
}

export const DEFAULT_PREFS: NotificationPreferences = {
  podJoin: true,
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
};

export function parsePreferences(raw: string | null | undefined): NotificationPreferences {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const WINDOW_EARLY_MS = 55 * 60 * 1000;
const WINDOW_LATE_MS = 65 * 60 * 1000;

async function send(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error('[NotificationService] Push send failed:', err);
    }
  }
}

async function sendAndCount(messages: ExpoPushMessage[]): Promise<number> {
  await send(messages);
  return messages.length;
}

function parseStringList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function roleRank(role: string | null | undefined): number {
  if (role === 'OWNER') return 4;
  if (role === 'ADMIN') return 3;
  if (role === 'OFFICER') return 2;
  if (role === 'MEMBER') return 1;
  return 0;
}

function canReceiveClubBroadcast(
  member: { role: string; customRoles?: Array<{ roleId: string }> },
  visibility: string,
  targetRoleIds: string[]
): boolean {
  if (visibility === 'OFFICERS' && roleRank(member.role) < roleRank('OFFICER')) return false;
  if (targetRoleIds.length === 0) return true;
  return member.customRoles?.some((assignment) => targetRoleIds.includes(assignment.roleId)) ?? false;
}

export const NotificationService = {
  /** Notify the pod creator when someone else joins their pod. */
  async notifyPodJoin(podId: string, joinerId: string): Promise<void> {
    try {
      const pod = await prisma.pod.findUnique({
        where: { id: podId },
        include: {
          activity: { select: { title: true } },
          creator: {
            select: { id: true, name: true, firstName: true, lastName: true, pushToken: true, notificationPreferences: true },
          },
          members: { include: { user: { select: { id: true, name: true, firstName: true, lastName: true } } } },
        },
      });

      if (!pod?.creator) return;
      if (pod.creator.id === joinerId) return;
      if (!pod.creator.pushToken || !Expo.isExpoPushToken(pod.creator.pushToken)) return;

      const prefs = parsePreferences(pod.creator.notificationPreferences);
      if (!prefs.podJoin) return;

      const joiner = pod.members.find((m) => m.user.id === joinerId);
      const joinerName = joiner?.user ? getPublicName(joiner.user) : 'Someone';

      await send([
        {
          to: pod.creator.pushToken,
          title: pod.activity?.title ?? 'Your Pod',
          body: `${joinerName} joined your pod!`,
          data: { type: 'pod_join', podId },
          sound: 'default',
        },
      ]);
    } catch (err) {
      console.error('[NotificationService] notifyPodJoin error:', err);
    }
  },

  /** Notify all other pod members when someone sends a message. */
  async notifyNewMessage(podId: string, senderId: string): Promise<void> {
    try {
      const pod = await prisma.pod.findUnique({
        where: { id: podId },
        include: {
          activity: { select: { title: true } },
          members: {
            include: {
              user: {
                select: { id: true, name: true, firstName: true, lastName: true, pushToken: true, notificationPreferences: true },
              },
            },
          },
        },
      });

      if (!pod) return;

      const sender = pod.members.find((m) => m.user.id === senderId);
      const senderName = sender?.user ? getPublicName(sender.user) : 'Someone';

      const messages: ExpoPushMessage[] = [];
      for (const member of pod.members) {
        if (member.user.id === senderId) continue;
        if (!member.user.pushToken || !Expo.isExpoPushToken(member.user.pushToken)) continue;
        const prefs = parsePreferences(member.user.notificationPreferences);
        if (!prefs.newMessage) continue;
        messages.push({
          to: member.user.pushToken,
          title: pod.activity?.title ?? 'Pod Message',
          body: `${senderName} sent a message`,
          data: { type: 'new_message', podId },
          sound: 'default',
        });
      }

      await send(messages);
    } catch (err) {
      console.error('[NotificationService] notifyNewMessage error:', err);
    }
  },

  /** Send meetup reminders for pods in the 55–65 min window. Called by reminderScheduler. */
  async sendMeetupReminders(): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() + WINDOW_EARLY_MS);
    const windowEnd = new Date(now.getTime() + WINDOW_LATE_MS);

    try {
      const pods = await prisma.pod.findMany({
        where: {
          status: 'LOCKED',
          meetupTime: { gte: windowStart, lte: windowEnd },
        },
        include: {
          activity: { select: { title: true } },
          members: {
            include: {
              user: {
                select: { id: true, pushToken: true, notificationPreferences: true },
              },
            },
          },
        },
      });

      const messages: ExpoPushMessage[] = [];
      for (const pod of pods) {
        for (const member of pod.members) {
          if (!member.user.pushToken || !Expo.isExpoPushToken(member.user.pushToken)) continue;
          const prefs = parsePreferences(member.user.notificationPreferences);
          if (!prefs.meetupReminder) continue;
          messages.push({
            to: member.user.pushToken,
            title: 'Meetup in 1 hour!',
            body: `${pod.activity?.title ?? 'Your meetup'} at ${pod.location}`,
            data: { type: 'meetup_reminder', podId: pod.id },
            sound: 'default',
          });
        }
      }

      await send(messages);
    } catch (err) {
      console.error('[NotificationService] sendMeetupReminders error:', err);
    }
  },

  /**
   * Send "How was it?" recap prompts to members of pods that completed
   * between 1 and 2 hours ago and haven't been notified yet.
   * Called by the reminder scheduler every 5 minutes.
   */
  async sendRecapPrompts(): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2h ago
    const windowEnd = new Date(now.getTime() - 60 * 60 * 1000);       // 1h ago

    try {
      const pods = await prisma.pod.findMany({
        where: {
          status: 'COMPLETED',
          meetupTime: { gte: windowStart, lte: windowEnd },
          recapNotifiedAt: null,
        },
        include: {
          activity: { select: { title: true } },
          members: {
            include: {
              user: {
                select: { id: true, pushToken: true, notificationPreferences: true },
              },
            },
          },
        },
      });

      if (pods.length === 0) return;

      const messages: ExpoPushMessage[] = [];
      for (const pod of pods) {
        for (const member of pod.members) {
          if (!member.user.pushToken || !Expo.isExpoPushToken(member.user.pushToken)) continue;
          const prefs = parsePreferences(member.user.notificationPreferences);
          if (!prefs.recapPrompt) continue;
          messages.push({
            to: member.user.pushToken,
            title: 'How was it?',
            body: `Rate your ${pod.activity?.title ?? 'meetup'} experience`,
            data: { type: 'recap_prompt', podId: pod.id },
            sound: 'default',
          });
        }

        // Mark notified regardless of whether individual members had tokens,
        // to prevent re-sending on next scheduler tick.
        await prisma.pod.update({
          where: { id: pod.id },
          data: { recapNotifiedAt: now },
        });
      }

      await send(messages);
    } catch (err) {
      console.error('[NotificationService] sendRecapPrompts error:', err);
    }
  },

  /**
   * Notify the first WAITING user on a pod's waitlist that a spot opened up.
   * Updates their status to NOTIFIED. Called from the leave-pod handler.
   */
  async notifyWaitlistSpot(podId: string, activityTitle?: string | null): Promise<void> {
    try {
      const entry = await prisma.podWaitlist.findFirst({
        where: { podId, status: 'WAITING' },
        orderBy: { position: 'asc' },
        include: {
          user: { select: { id: true, pushToken: true, notificationPreferences: true } },
        },
      });

      if (!entry) return;

      await prisma.podWaitlist.update({
        where: { id: entry.id },
        data: { status: 'NOTIFIED', notifiedAt: new Date() },
      });

      if (!entry.user.pushToken || !Expo.isExpoPushToken(entry.user.pushToken)) return;
      const prefs = parsePreferences(entry.user.notificationPreferences);
      if (!prefs.waitlistSpot) return;

      await send([
        {
          to: entry.user.pushToken,
          title: 'A spot opened up!',
          body: `A spot opened up in ${activityTitle ?? 'a pod'} — join now before it fills up`,
          data: { type: 'waitlist_spot', podId },
          sound: 'default',
        },
      ]);
    } catch (err) {
      console.error('[NotificationService] notifyWaitlistSpot error:', err);
    }
  },

  /**
   * Expire NOTIFIED waitlist entries older than 30 minutes and promote the
   * next WAITING user. Called by the reminder scheduler.
   */
  async expireStaleWaitlistEntries(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    try {
      const stale = await prisma.podWaitlist.findMany({
        where: { status: 'NOTIFIED', notifiedAt: { lte: cutoff } },
        include: { pod: { select: { id: true, activity: { select: { title: true } } } } },
      });

      for (const entry of stale) {
        await prisma.podWaitlist.update({
          where: { id: entry.id },
          data: { status: 'EXPIRED' },
        });
        // Notify the next person in line
        await NotificationService.notifyWaitlistSpot(
          entry.pod.id,
          entry.pod.activity?.title
        );
      }
    } catch (err) {
      console.error('[NotificationService] expireStaleWaitlistEntries error:', err);
    }
  },

  /** Notify visible club members (except creator) when a new meeting is created. */
  async notifyClubMeetingCreated(meetingId: string, creatorId: string): Promise<void> {
    try {
      const meeting = await prisma.clubMeeting.findUnique({
        where: { id: meetingId },
        include: {
          club: {
            include: {
              members: {
                include: {
                  user: { select: { id: true, pushToken: true, notificationPreferences: true } },
                  customRoles: { select: { roleId: true } },
                },
              },
            },
          },
        },
      });
      if (!meeting) return;
      const targetRoleIds = parseStringList(meeting.targetRoleIds);

      const meetingDate = new Date(meeting.meetingTime).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      const messages: ExpoPushMessage[] = [];
      for (const member of meeting.club.members) {
        if (member.user.id === creatorId) continue;
        if (!canReceiveClubBroadcast(member, meeting.visibility, targetRoleIds)) continue;
        if (!member.user.pushToken || !Expo.isExpoPushToken(member.user.pushToken)) continue;
        const prefs = parsePreferences(member.user.notificationPreferences);
        if (!prefs.clubMeetingCreated) continue;
        messages.push({
          to: member.user.pushToken,
          title: meeting.club.name,
          body: `New meeting: ${meeting.title} on ${meetingDate}`,
          data: { type: 'club_meeting_created', clubId: meeting.clubId, meetingId },
          sound: 'default',
        });
      }
      await send(messages);
    } catch (err) {
      console.error('[NotificationService] notifyClubMeetingCreated error:', err);
    }
  },

  /** Notify visible club members (except creator) when a new announcement is posted. */
  async notifyClubAnnouncementCreated(announcementId: string, creatorId: string): Promise<void> {
    try {
      const announcement = await prisma.clubAnnouncement.findUnique({
        where: { id: announcementId },
        include: {
          club: {
            include: {
              members: {
                include: {
                  user: { select: { id: true, pushToken: true, notificationPreferences: true } },
                  customRoles: { select: { roleId: true } },
                },
              },
            },
          },
        },
      });
      if (!announcement) return;

      const targetRoleIds = parseStringList(announcement.targetRoleIds);
      const messages: ExpoPushMessage[] = [];
      for (const member of announcement.club.members) {
        if (member.user.id === creatorId) continue;
        if (!canReceiveClubBroadcast(member, announcement.visibility, targetRoleIds)) continue;
        if (!member.user.pushToken || !Expo.isExpoPushToken(member.user.pushToken)) continue;
        const prefs = parsePreferences(member.user.notificationPreferences);
        if (!prefs.clubAnnouncementCreated) continue;
        messages.push({
          to: member.user.pushToken,
          title: announcement.club.name,
          body: announcement.content.length > 120 ? `${announcement.content.slice(0, 117)}...` : announcement.content,
          data: { type: 'club_announcement_created', clubId: announcement.clubId, announcementId },
          sound: 'default',
        });
      }
      await send(messages);
    } catch (err) {
      console.error('[NotificationService] notifyClubAnnouncementCreated error:', err);
    }
  },

  /** Notify a member that they were removed from a club. */
  async notifyClubKick(kickedUserId: string, clubId: string): Promise<void> {
    try {
      const [club, user] = await Promise.all([
        prisma.club.findUnique({ where: { id: clubId }, select: { name: true } }),
        prisma.user.findUnique({
          where: { id: kickedUserId },
          select: { pushToken: true, notificationPreferences: true },
        }),
      ]);
      if (!club || !user) return;
      if (!user.pushToken || !Expo.isExpoPushToken(user.pushToken)) return;
      const prefs = parsePreferences(user.notificationPreferences);
      if (!prefs.clubKick) return;
      await send([
        {
          to: user.pushToken,
          title: club.name,
          body: `You have been removed from ${club.name}`,
          data: { type: 'club_kick', clubId },
          sound: 'default',
        },
      ]);
    } catch (err) {
      console.error('[NotificationService] notifyClubKick error:', err);
    }
  },

  /** Notify a member that their role in a club has changed. */
  async notifyClubRoleChange(targetUserId: string, clubId: string, newRole: string): Promise<void> {
    try {
      const [club, user] = await Promise.all([
        prisma.club.findUnique({ where: { id: clubId }, select: { name: true } }),
        prisma.user.findUnique({
          where: { id: targetUserId },
          select: { pushToken: true, notificationPreferences: true },
        }),
      ]);
      if (!club || !user) return;
      if (!user.pushToken || !Expo.isExpoPushToken(user.pushToken)) return;
      const prefs = parsePreferences(user.notificationPreferences);
      if (!prefs.clubRoleChange) return;
      const roleLabel = newRole === 'OFFICER' ? 'Officer' : 'Member';
      await send([
        {
          to: user.pushToken,
          title: club.name,
          body: `Your role in ${club.name} has been updated to ${roleLabel}`,
          data: { type: 'club_role_change', clubId, newRole },
          sound: 'default',
        },
      ]);
    } catch (err) {
      console.error('[NotificationService] notifyClubRoleChange error:', err);
    }
  },

  /** Notify all Going RSVPs when attendance is opened for a meeting. */
  async notifyClubAttendanceOpen(meetingId: string): Promise<void> {
    try {
      const meeting = await prisma.clubMeeting.findUnique({
        where: { id: meetingId },
        include: {
          club: { select: { name: true } },
          attendees: {
            where: { status: 'GOING' },
            include: {
              user: { select: { id: true, pushToken: true, notificationPreferences: true } },
            },
          },
        },
      });
      if (!meeting) return;

      const messages: ExpoPushMessage[] = [];
      for (const attendee of meeting.attendees) {
        if (!attendee.user.pushToken || !Expo.isExpoPushToken(attendee.user.pushToken)) continue;
        const prefs = parsePreferences(attendee.user.notificationPreferences);
        if (!prefs.clubAttendanceOpen) continue;
        messages.push({
          to: attendee.user.pushToken,
          title: meeting.club.name,
          body: `${meeting.club.name} meeting started — check in now!`,
          data: { type: 'club_attendance_open', meetingId },
          sound: 'default',
        });
      }
      await send(messages);
    } catch (err) {
      console.error('[NotificationService] notifyClubAttendanceOpen error:', err);
    }
  },

  /** Send an RSVP reminder to selected club members who have not answered yet. */
  async notifyClubRsvpReminder(meetingId: string, recipientIds: string[]): Promise<{ attempted: number; sent: number }> {
    try {
      const meeting = await prisma.clubMeeting.findUnique({
        where: { id: meetingId },
        include: {
          club: { select: { id: true, name: true } },
        },
      });
      if (!meeting || recipientIds.length === 0) return { attempted: recipientIds.length, sent: 0 };

      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(new Set(recipientIds)) } },
        select: { id: true, pushToken: true, notificationPreferences: true },
      });

      const meetingDate = new Date(meeting.meetingTime).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      const messages: ExpoPushMessage[] = [];
      for (const user of users) {
        if (!user.pushToken || !Expo.isExpoPushToken(user.pushToken)) continue;
        const prefs = parsePreferences(user.notificationPreferences);
        if (!prefs.clubRsvpReminder) continue;
        messages.push({
          to: user.pushToken,
          title: meeting.club.name,
          body: `RSVP for ${meeting.title} on ${meetingDate}`,
          data: { type: 'club_rsvp_reminder', clubId: meeting.club.id, meetingId },
          sound: 'default',
        });
      }

      return { attempted: recipientIds.length, sent: await sendAndCount(messages) };
    } catch (err) {
      console.error('[NotificationService] notifyClubRsvpReminder error:', err);
      return { attempted: recipientIds.length, sent: 0 };
    }
  },

  /** Send a leader-composed outreach notification to a resolved member audience. */
  async notifyClubOutreach(
    clubId: string,
    senderId: string,
    recipientIds: string[],
    content: string
  ): Promise<{ attempted: number; sent: number }> {
    try {
      const club = await prisma.club.findUnique({ where: { id: clubId }, select: { name: true } });
      if (!club || recipientIds.length === 0) return { attempted: recipientIds.length, sent: 0 };

      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(new Set(recipientIds)).filter((id) => id !== senderId) } },
        select: { id: true, pushToken: true, notificationPreferences: true },
      });

      const messages: ExpoPushMessage[] = [];
      for (const user of users) {
        if (!user.pushToken || !Expo.isExpoPushToken(user.pushToken)) continue;
        const prefs = parsePreferences(user.notificationPreferences);
        if (!prefs.clubOutreach) continue;
        messages.push({
          to: user.pushToken,
          title: club.name,
          body: content.length > 120 ? `${content.slice(0, 117)}...` : content,
          data: { type: 'club_outreach', clubId },
          sound: 'default',
        });
      }

      return { attempted: recipientIds.length, sent: await sendAndCount(messages) };
    } catch (err) {
      console.error('[NotificationService] notifyClubOutreach error:', err);
      return { attempted: recipientIds.length, sent: 0 };
    }
  },

  /** Start a cron-like interval that checks every 5 minutes for upcoming meetups. */
  startReminderScheduler(): void {
    setInterval(() => {
      NotificationService.sendMeetupReminders().catch((err) =>
        console.error('[NotificationService] scheduler error:', err)
      );
      NotificationService.sendRecapPrompts().catch((err) =>
        console.error('[NotificationService] recap scheduler error:', err)
      );
      NotificationService.expireStaleWaitlistEntries().catch((err) =>
        console.error('[NotificationService] waitlist expiry error:', err)
      );
    }, CHECK_INTERVAL_MS);
    console.log('[NotificationService] Reminder scheduler started — checking every 5 minutes');
  },
};
