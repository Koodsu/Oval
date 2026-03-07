import prisma from '../prisma';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
}

interface NotificationPreferences {
  podJoin: boolean;
  newMessage: boolean;
  meetupReminder: boolean;
}

function parsePrefs(raw: string | null | undefined): NotificationPreferences {
  if (!raw) return { podJoin: true, newMessage: true, meetupReminder: true };
  try {
    return { podJoin: true, newMessage: true, meetupReminder: true, ...JSON.parse(raw) };
  } catch {
    return { podJoin: true, newMessage: true, meetupReminder: true };
  }
}

async function sendPushMessages(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error('[NotificationService] Push send failed:', err);
  }
}

/** Notify the pod creator when someone joins their pod. */
export async function notifyPodJoin(podId: string, joinerName: string): Promise<void> {
  try {
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      include: {
        activity: { select: { title: true } },
        creator: { select: { id: true, pushToken: true, notificationPreferences: true } },
      },
    });

    if (!pod?.creator?.pushToken) return;

    const prefs = parsePrefs(pod.creator.notificationPreferences);
    if (!prefs.podJoin) return;

    await sendPushMessages([
      {
        to: pod.creator.pushToken,
        title: pod.activity?.title ?? 'Your Pod',
        body: `${joinerName} joined your pod!`,
        data: { podId },
        sound: 'default',
      },
    ]);
  } catch (err) {
    console.error('[NotificationService] notifyPodJoin error:', err);
  }
}

/** Notify all other pod members when someone sends a message. */
export async function notifyNewMessage(
  podId: string,
  senderId: string,
  senderName: string,
  preview: string
): Promise<void> {
  try {
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      include: {
        activity: { select: { title: true } },
        members: {
          where: { userId: { not: senderId } },
          include: {
            user: { select: { pushToken: true, notificationPreferences: true } },
          },
        },
      },
    });

    if (!pod) return;

    const messages: ExpoPushMessage[] = [];
    for (const member of pod.members) {
      if (!member.user.pushToken) continue;
      const prefs = parsePrefs(member.user.notificationPreferences);
      if (!prefs.newMessage) continue;
      messages.push({
        to: member.user.pushToken,
        title: pod.activity?.title ?? 'Pod Message',
        body: `${senderName}: ${preview.slice(0, 100)}`,
        data: { podId },
        sound: 'default',
      });
    }

    await sendPushMessages(messages);
  } catch (err) {
    console.error('[NotificationService] notifyNewMessage error:', err);
  }
}

/** Send meetup reminder to all members of a pod. Called by reminderScheduler. */
export async function notifyMeetupReminder(
  podId: string,
  activityTitle: string,
  meetupTime: Date,
  memberTokens: Array<{ pushToken: string }>
): Promise<void> {
  const timeStr = meetupTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const messages: ExpoPushMessage[] = memberTokens.map(({ pushToken }) => ({
    to: pushToken,
    title: `Meetup in 1 hour — ${activityTitle}`,
    body: `Your pod meets at ${timeStr}. Tap to open the chat.`,
    data: { podId },
    sound: 'default',
  }));
  await sendPushMessages(messages);
}
