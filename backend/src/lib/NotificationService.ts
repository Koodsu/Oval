import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import prisma from '../prisma';

const expo = new Expo();

export interface NotificationPreferences {
  podJoin: boolean;
  newMessage: boolean;
  meetupReminder: boolean;
}

export const DEFAULT_PREFS: NotificationPreferences = {
  podJoin: true,
  newMessage: true,
  meetupReminder: true,
};

export function parsePreferences(raw: string | null | undefined): NotificationPreferences {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const parsed = JSON.parse(raw);
    return {
      podJoin: parsed.podJoin !== false,
      newMessage: parsed.newMessage !== false,
      meetupReminder: parsed.meetupReminder !== false,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export class NotificationService {
  /**
   * Notify the pod creator that a new member has joined.
   * Does NOT notify if the joiner is the creator (pod creation case).
   */
  static async notifyPodJoin(podId: string, joinerId: string): Promise<void> {
    try {
      const pod = await prisma.pod.findUnique({
        where: { id: podId },
        include: {
          activity: true,
          creator: { select: { id: true, name: true, pushToken: true, notificationPreferences: true } },
          members: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      });

      if (!pod || !pod.creator) return;
      if (pod.creator.id === joinerId) return;

      const prefs = parsePreferences(pod.creator.notificationPreferences);
      if (!prefs.podJoin) return;

      const token = pod.creator.pushToken;
      if (!token || !Expo.isExpoPushToken(token)) return;

      const joiner = pod.members.find((m) => m.user.id === joinerId)?.user;
      const joinerName = joiner?.name ?? 'Someone';
      const memberCount = pod.members.length;
      const spotsLeft = pod.maxMembers - memberCount;
      const spotsText = spotsLeft === 0 ? 'Pod is now full!' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`;

      await NotificationService.sendBatch([
        {
          to: token,
          title: `${joinerName} joined your pod`,
          body: `${pod.activity.title} · ${spotsText}`,
          data: { type: 'pod_join', podId },
        },
      ]);
    } catch (err) {
      console.error('[NotificationService] notifyPodJoin error:', err);
    }
  }

  /**
   * Notify all pod members (except the sender) that a new message was sent.
   */
  static async notifyNewMessage(podId: string, senderId: string): Promise<void> {
    try {
      const pod = await prisma.pod.findUnique({
        where: { id: podId },
        include: {
          activity: true,
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  pushToken: true,
                  notificationPreferences: true,
                },
              },
            },
          },
        },
      });

      if (!pod) return;

      const sender = pod.members.find((m) => m.user.id === senderId)?.user;
      const senderName = sender?.name ?? 'Someone';

      const messages: ExpoPushMessage[] = [];

      for (const member of pod.members) {
        if (member.user.id === senderId) continue;

        const prefs = parsePreferences(member.user.notificationPreferences);
        if (!prefs.newMessage) continue;

        const token = member.user.pushToken;
        if (!token || !Expo.isExpoPushToken(token)) continue;

        messages.push({
          to: token,
          title: pod.activity.title,
          body: `${senderName} sent a message`,
          data: { type: 'new_message', podId },
        });
      }

      if (messages.length > 0) {
        await NotificationService.sendBatch(messages);
      }
    } catch (err) {
      console.error('[NotificationService] notifyNewMessage error:', err);
    }
  }

  /**
   * Find pods whose meetupTime is between 55 and 65 minutes from now and
   * send a reminder to all members who have meetupReminder enabled.
   * The 10-minute window (±5 min around the 60-min mark) ensures a pod
   * running every 5 minutes will trigger exactly once per pod.
   */
  static async sendMeetupReminders(): Promise<void> {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 55 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 65 * 60 * 1000);

      const pods = await prisma.pod.findMany({
        where: {
          status: 'LOCKED',
          meetupTime: { gte: windowStart, lte: windowEnd },
        },
        include: {
          activity: true,
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  pushToken: true,
                  notificationPreferences: true,
                },
              },
            },
          },
        },
      });

      if (pods.length === 0) return;

      const messages: ExpoPushMessage[] = [];

      for (const pod of pods) {
        for (const member of pod.members) {
          const prefs = parsePreferences(member.user.notificationPreferences);
          if (!prefs.meetupReminder) continue;

          const token = member.user.pushToken;
          if (!token || !Expo.isExpoPushToken(token)) continue;

          messages.push({
            to: token,
            title: 'Meetup in 1 hour!',
            body: `${pod.activity.title} at ${pod.location}`,
            data: { type: 'meetup_reminder', podId: pod.id },
          });
        }
      }

      if (messages.length > 0) {
        await NotificationService.sendBatch(messages);
      }
    } catch (err) {
      console.error('[NotificationService] sendMeetupReminders error:', err);
    }
  }

  private static async sendBatch(messages: ExpoPushMessage[]): Promise<void> {
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        console.error('[NotificationService] sendBatch chunk error:', err);
      }
    }
  }
}
