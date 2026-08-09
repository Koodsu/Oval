import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { getPublicName } from './userNames';
import { getInterestCategories } from '../config/interestTags';
import {
  PUSH_CHANNELS,
  clubAnnouncementCopy,
  clubAttendanceOpenCopy,
  clubMessageCopy,
  clubMeetingCreatedCopy,
  clubOutreachCopy,
  clubRemovalCopy,
  clubRoleChangeCopy,
  clubRsvpCopy,
  demandConversionCopy,
  demandPlanCreatedCopy,
  directMessageCopy,
  firstPlanNudgeCopy,
  friendRequestCopy,
  meetupReminderCopy,
  podCancelledCopy,
  podInviteCopy,
  podJoinCopy,
  podMessageCopy,
  podUpdateCopy,
  recapPromptCopy,
  waitlistSpotCopy,
  waitlistTwinCopy,
  weeklyPlanningCopy,
} from './notificationCopy';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  parseNotificationPreferences,
} from './notificationPreferences';

const expo = new Expo();

export const DEFAULT_PREFS = DEFAULT_NOTIFICATION_PREFERENCES;
export const parsePreferences = parseNotificationPreferences;

const MEETUP_REMINDER_EARLY_MS = 30 * 60 * 1000;
const MEETUP_REMINDER_LATE_MS = 70 * 60 * 1000;
const FIRST_POD_NUDGE_HOUR = 8;
const NON_TRANSACTIONAL_BUDGET_EVENT = 'notification.non_transactional_sent';
const NON_TRANSACTIONAL_DAILY_LIMIT = 1;
const DEMAND_POOL_THRESHOLD = 4;

function podUrl(podId: string): string {
  return `oval://pod/${podId}`;
}

function podDisplayTitle(
  pod: { title?: string | null; activity?: { title: string } | null },
  fallback: string,
): string {
  return pod.title?.trim() || pod.activity?.title || fallback;
}

function threadUrl(threadId: string): string {
  return `oval://thread/${threadId}`;
}

function inboxUrl(): string {
  return 'oval://inbox';
}

function clubUrl(clubId: string): string {
  return `oval://clubs/${clubId}`;
}

function clubMeetingUrl(clubId: string, meetingId: string): string {
  return `oval://clubs/${clubId}/events/${meetingId}`;
}

function clubChatUrl(clubId: string, channelId: string): string {
  return `oval://clubs/${clubId}/chat/${channelId}`;
}

function discoverUrl(): string {
  return 'oval://explore';
}

function tokenList(to: ExpoPushMessage['to']): string[] {
  return Array.isArray(to) ? to : [to];
}

async function send(messages: ExpoPushMessage[]): Promise<number> {
  if (messages.length === 0) return 0;
  let accepted = 0;
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      // Persist tickets durably (raw SQL: see PushReceipt model note in
      // schema.prisma) so the receipt check works across serverless
      // instances — an in-memory queue is always empty by the time the
      // cron instance runs.
      const rows: Array<{ id: string; token: string }> = [];
      const deadTokens: string[] = [];
      tickets.forEach((ticket, index) => {
        const [token] = tokenList(chunk[index].to);
        if (ticket.status === 'error') {
          console.error('[NotificationService] Push ticket rejected:', ticket.message, ticket.details);
          if (ticket.details?.error === 'DeviceNotRegistered' && token) {
            deadTokens.push(token);
          }
          return;
        }
        accepted += 1;
        if (token) rows.push({ id: ticket.id, token });
      });
      if (deadTokens.length > 0) {
        await prisma.user.updateMany({
          where: { pushToken: { in: deadTokens } },
          data: { pushToken: null },
        });
      }
      if (rows.length > 0) {
        try {
          await prisma.$executeRaw`
            INSERT INTO "PushReceipt" ("id", "token")
            VALUES ${Prisma.join(rows.map((row) => Prisma.sql`(${row.id}, ${row.token})`))}
            ON CONFLICT ("id") DO NOTHING
          `;
        } catch (persistErr) {
          console.error('[NotificationService] Failed to persist push tickets:', persistErr);
        }
      }
    } catch (err) {
      console.error('[NotificationService] Push send failed:', err);
    }
  }
  return accepted;
}

async function sendAndCount(messages: ExpoPushMessage[]): Promise<number> {
  return send(messages);
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

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function sameLocalDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatPlanWhen(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTime(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "tonight" / "today" / "tomorrow" / "on Saturday" for push copy. */
function meetupDayLabel(meetupTime: Date, now = new Date()): string {
  const dayDiff = Math.round(
    (startOfDay(meetupTime).getTime() - startOfDay(now).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (dayDiff <= 0) return meetupTime.getHours() >= 17 ? 'tonight' : 'today';
  if (dayDiff === 1) return 'tomorrow';
  return `on ${meetupTime.toLocaleDateString('en-US', { weekday: 'long' })}`;
}

async function canSpendNonTransactionalBudget(userId: string, now: Date): Promise<boolean> {
  const sentToday = await prisma.analyticsEvent.count({
    where: {
      userId,
      name: NON_TRANSACTIONAL_BUDGET_EVENT,
      createdAt: { gte: startOfDay(now) },
    },
  });
  return sentToday < NON_TRANSACTIONAL_DAILY_LIMIT;
}

async function sendNonTransactional(
  user: { id: string; pushToken: string | null; notificationPreferences: string | null },
  message: Omit<ExpoPushMessage, 'to'>,
  surface: string,
  now = new Date()
): Promise<boolean> {
  if (!user.pushToken || !Expo.isExpoPushToken(user.pushToken)) return false;
  if (!(await canSpendNonTransactionalBudget(user.id, now))) return false;
  const accepted = await send([{ ...message, to: user.pushToken }]);
  if (accepted === 0) return false;
  await prisma.analyticsEvent.create({
    data: {
      userId: user.id,
      name: NON_TRANSACTIONAL_BUDGET_EVENT,
      properties: { surface },
      createdAt: now,
    },
  });
  return true;
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
  /**
   * Checks Expo receipts for durably-persisted tickets and clears dead push
   * tokens (DeviceNotRegistered). Tickets are read from the PushReceipt table
   * after a 15-minute settling delay (Expo receipts are not immediately
   * available) and deleted after one check, whether or not the receipt fetch
   * succeeded, so the table cannot grow unboundedly.
   */
  async checkPushReceipts(): Promise<{ checked: number; cleared: number }> {
    const settledBefore = new Date(Date.now() - 15 * 60 * 1000);
    try {
      const batch = await prisma.$queryRaw<Array<{ id: string; token: string }>>`
        SELECT "id", "token" FROM "PushReceipt"
        WHERE "createdAt" < ${settledBefore}
        ORDER BY "createdAt" ASC
        LIMIT 300
      `;
      if (batch.length === 0) return { checked: 0, cleared: 0 };

      let cleared = 0;
      const tokenByTicketId = new Map(batch.map((row) => [row.id, row.token]));

      for (const chunk of expo.chunkPushNotificationReceiptIds([...tokenByTicketId.keys()])) {
        try {
          const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
          for (const [ticketId, receipt] of Object.entries(receipts)) {
            if (receipt.status !== 'error') continue;
            if (receipt.details?.error !== 'DeviceNotRegistered') continue;
            const token = tokenByTicketId.get(ticketId);
            if (!token) continue;
            const result = await prisma.user.updateMany({
              where: { pushToken: token },
              data: { pushToken: null },
            });
            cleared += result.count;
          }
        } catch (err) {
          console.error('[NotificationService] Push receipt check failed:', err);
        }
      }

      await prisma.$executeRaw`
        DELETE FROM "PushReceipt"
        WHERE "id" IN (${Prisma.join(batch.map((row) => row.id))})
      `;

      return { checked: batch.length, cleared };
    } catch (err) {
      console.error('[NotificationService] checkPushReceipts error:', err);
      return { checked: 0, cleared: 0 };
    }
  },

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
      const planTitle = podDisplayTitle(pod, 'your plan');
      const copy = podJoinCopy(
        joinerName,
        planTitle,
        pod.members.length,
        pod.maxMembers,
        formatPlanWhen(pod.meetupTime),
      );

      await send([
        {
          to: pod.creator.pushToken,
          ...copy,
          data: { type: 'pod_join', podId, url: podUrl(podId) },
          sound: 'default',
          channelId: PUSH_CHANNELS.plans,
        },
      ]);
    } catch (err) {
      console.error('[NotificationService] notifyPodJoin error:', err);
    }
  },

  /** Notify a user that a friend invited them to a forming plan. */
  async notifyPodInvite(inviteId: string): Promise<void> {
    try {
      const invite = await prisma.podInvite.findUnique({
        where: { id: inviteId },
        include: {
          sender: { select: { name: true, firstName: true, lastName: true } },
          receiver: { select: { pushToken: true, notificationPreferences: true } },
          pod: {
            include: {
              activity: { select: { title: true } },
              members: { select: { userId: true } },
            },
          },
        },
      });
      if (!invite?.receiver.pushToken || !Expo.isExpoPushToken(invite.receiver.pushToken)) return;
      const prefs = parsePreferences(invite.receiver.notificationPreferences);
      if (!prefs.podInvite) return;

      const copy = podInviteCopy(
        getPublicName(invite.sender),
        podDisplayTitle(invite.pod, 'a plan'),
        formatPlanWhen(invite.pod.meetupTime),
        invite.pod.location,
        Math.max(0, invite.pod.maxMembers - invite.pod.members.length),
      );
      await send([{
        to: invite.receiver.pushToken,
        ...copy,
        data: { type: 'pod_invite', inviteId, podId: invite.podId, url: podUrl(invite.podId) },
        sound: 'default',
        channelId: PUSH_CHANNELS.plans,
      }]);
    } catch (err) {
      console.error('[NotificationService] notifyPodInvite error:', err);
    }
  },

  /** Notify a user about an incoming friend request. */
  async notifyFriendRequest(requestId: string): Promise<void> {
    try {
      const request = await prisma.friendRequest.findUnique({
        where: { id: requestId },
        include: {
          sender: { select: { id: true, name: true, firstName: true, lastName: true } },
          receiver: { select: { pushToken: true, notificationPreferences: true } },
        },
      });
      if (!request?.receiver.pushToken || !Expo.isExpoPushToken(request.receiver.pushToken)) return;
      const prefs = parsePreferences(request.receiver.notificationPreferences);
      if (!prefs.friendRequest) return;
      const senderName = getPublicName(request.sender);
      const copy = friendRequestCopy(senderName);
      await send([{
        to: request.receiver.pushToken,
        ...copy,
        data: { type: 'friend_request', requestId, userId: request.sender.id, url: inboxUrl() },
        sound: 'default',
        channelId: PUSH_CHANNELS.messages,
      }]);
    } catch (err) {
      console.error('[NotificationService] notifyFriendRequest error:', err);
    }
  },

  /**
   * Notify all pod members except the actor that the pod's plan changed
   * (details edited) or the pod was cancelled. Uses the meetupReminder
   * preference since both are plan-critical updates.
   */
  async notifyPodPlanChange(
    podId: string,
    actorId: string,
    kind: 'updated' | 'cancelled',
    memberUserIds?: string[],
    changedFields: string[] = [],
  ): Promise<void> {
    try {
      const pod = await prisma.pod.findUnique({
        where: { id: podId },
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
      if (!pod) return;

      // For cancellations the members may already be detached — allow callers
      // to pass the recipient list captured before the write.
      const recipients = memberUserIds?.length
        ? await prisma.user.findMany({
            where: { id: { in: memberUserIds } },
            select: { id: true, pushToken: true, notificationPreferences: true },
          })
        : pod.members.map((m) => m.user);

      const planTitle = podDisplayTitle(pod, 'Your plan');
      const copy = kind === 'cancelled'
        ? podCancelledCopy(planTitle, formatPlanWhen(pod.meetupTime))
        : podUpdateCopy(
            planTitle,
            changedFields,
            formatPlanWhen(pod.meetupTime),
            pod.location,
          );

      const messages: ExpoPushMessage[] = [];
      for (const user of recipients) {
        if (user.id === actorId) continue;
        if (!user.pushToken || !Expo.isExpoPushToken(user.pushToken)) continue;
        const prefs = parsePreferences(user.notificationPreferences);
        if (!prefs.meetupReminder) continue;
        messages.push({
          to: user.pushToken,
          ...copy,
          data: { type: kind === 'cancelled' ? 'pod_cancelled' : 'pod_updated', podId, url: podUrl(podId) },
          sound: 'default',
          channelId: PUSH_CHANNELS.plans,
        });
      }
      await send(messages);
    } catch (err) {
      console.error('[NotificationService] notifyPodPlanChange error:', err);
    }
  },

  /** Notify all other pod members when someone sends a message. */
  async notifyNewMessage(podId: string, senderId: string, preview?: string): Promise<void> {
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
      const copy = podMessageCopy(senderName, podDisplayTitle(pod, 'Your plan'), preview);

      const messages: ExpoPushMessage[] = [];
      for (const member of pod.members) {
        if (member.user.id === senderId) continue;
        if (!member.user.pushToken || !Expo.isExpoPushToken(member.user.pushToken)) continue;
        const prefs = parsePreferences(member.user.notificationPreferences);
        if (!prefs.newMessage) continue;
        messages.push({
          to: member.user.pushToken,
          ...copy,
          data: { type: 'new_message', podId, url: podUrl(podId) },
          sound: 'default',
          channelId: PUSH_CHANNELS.messages,
        });
      }

      await send(messages);
    } catch (err) {
      console.error('[NotificationService] notifyNewMessage error:', err);
    }
  },

  /** Notify the other participant when someone sends a DM. */
  async notifyDirectMessage(threadId: string, senderId: string, preview?: string): Promise<void> {
    try {
      const thread = await prisma.directMessageThread.findUnique({
        where: { id: threadId },
        include: {
          userA: {
            select: { id: true, name: true, firstName: true, lastName: true, pushToken: true, notificationPreferences: true },
          },
          userB: {
            select: { id: true, name: true, firstName: true, lastName: true, pushToken: true, notificationPreferences: true },
          },
        },
      });
      if (!thread) return;

      const sender = thread.userAId === senderId ? thread.userA : thread.userB;
      const recipient = thread.userAId === senderId ? thread.userB : thread.userA;
      if (!recipient.pushToken || !Expo.isExpoPushToken(recipient.pushToken)) return;
      const prefs = parsePreferences(recipient.notificationPreferences);
      if (!prefs.newMessage) return;
      const copy = directMessageCopy(getPublicName(sender), preview);

      await send([
        {
          to: recipient.pushToken,
          ...copy,
          data: { type: 'direct_message', threadId, url: threadUrl(threadId) },
          sound: 'default',
          channelId: PUSH_CHANNELS.messages,
        },
      ]);
    } catch (err) {
      console.error('[NotificationService] notifyDirectMessage error:', err);
    }
  },

  /** Send meetup reminders once for pods meeting in the next 30-70 minutes. */
  async sendMeetupReminders(): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() + MEETUP_REMINDER_EARLY_MS);
    const windowEnd = new Date(now.getTime() + MEETUP_REMINDER_LATE_MS);

    try {
      const pods = await prisma.pod.findMany({
        where: {
          status: 'LOCKED',
          meetupTime: { gte: windowStart, lte: windowEnd },
          meetupReminderSentAt: null,
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
        const claimed = await prisma.pod.updateMany({
          where: { id: pod.id, meetupReminderSentAt: null },
          data: { meetupReminderSentAt: now },
        });
        if (claimed.count === 0) continue;

        for (const member of pod.members) {
          if (!member.user.pushToken || !Expo.isExpoPushToken(member.user.pushToken)) continue;
          const prefs = parsePreferences(member.user.notificationPreferences);
          if (!prefs.meetupReminder) continue;
          const copy = meetupReminderCopy(
            podDisplayTitle(pod, 'Your plan'),
            formatTime(pod.meetupTime),
            pod.location,
            pod.members.length,
          );
          messages.push({
            to: member.user.pushToken,
            ...copy,
            data: { type: 'meetup_reminder', podId: pod.id, url: podUrl(pod.id) },
            sound: 'default',
            channelId: PUSH_CHANNELS.plans,
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
          if (!member.confirmedAt) continue;
          if (!member.user.pushToken || !Expo.isExpoPushToken(member.user.pushToken)) continue;
          const prefs = parsePreferences(member.user.notificationPreferences);
          if (!prefs.recapPrompt) continue;
          const copy = recapPromptCopy(podDisplayTitle(pod, 'your plan'));
          messages.push({
            to: member.user.pushToken,
            ...copy,
            data: { type: 'recap_prompt', podId: pod.id, url: podUrl(pod.id) },
            sound: 'default',
            channelId: PUSH_CHANNELS.plans,
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
  /**
   * A full pod got a twin: tell everyone waiting on the original that a second
   * pod just opened. Transactional (waitlist category), so it uses the
   * waitlistSpot preference rather than the daily non-transactional budget.
   */
  async notifyWaitlistTwin(fromPodId: string, newPodId: string, creatorId: string): Promise<void> {
    try {
      const [entries, newPod] = await Promise.all([
        prisma.podWaitlist.findMany({
          where: { podId: fromPodId, status: { in: ['WAITING', 'NOTIFIED'] } },
          include: {
            user: { select: { id: true, pushToken: true, notificationPreferences: true } },
          },
        }),
        prisma.pod.findUnique({
          where: { id: newPodId },
          include: { activity: { select: { title: true } } },
        }),
      ]);
      if (!newPod || entries.length === 0) return;

      const messages: ExpoPushMessage[] = [];
      const copy = waitlistTwinCopy(
        podDisplayTitle(newPod, 'plan'),
        formatPlanWhen(newPod.meetupTime),
        newPod.location,
      );
      for (const entry of entries) {
        if (entry.userId === creatorId) continue;
        if (!entry.user.pushToken || !Expo.isExpoPushToken(entry.user.pushToken)) continue;
        const prefs = parsePreferences(entry.user.notificationPreferences);
        if (!prefs.waitlistSpot) continue;
        messages.push({
          to: entry.user.pushToken,
          ...copy,
          data: { type: 'waitlist_twin', podId: newPodId, url: podUrl(newPodId) },
          sound: 'default',
          channelId: PUSH_CHANNELS.plans,
        });
      }
      await send(messages);
    } catch (err) {
      console.error('[NotificationService] notifyWaitlistTwin error:', err);
    }
  },

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
      const copy = waitlistSpotCopy(activityTitle ?? 'your plan');

      await send([
        {
          to: entry.user.pushToken,
          ...copy,
          data: { type: 'waitlist_spot', podId, url: podUrl(podId) },
          sound: 'default',
          channelId: PUSH_CHANNELS.plans,
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

  /** Send a same-day nudge to members whose first-ever pod is happening later today. */
  async sendFirstPodNudges(now = new Date()): Promise<{ attempted: number; sent: number }> {
    if (now.getHours() < FIRST_POD_NUDGE_HOUR) return { attempted: 0, sent: 0 };

    try {
      const dayEnd = startOfDay(now);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const candidates = await prisma.podMember.findMany({
        where: {
          firstPodNudgeSentAt: null,
          pod: {
            meetupTime: { gt: now, lt: dayEnd },
            status: { in: ['FORMING', 'LOCKED'] },
          },
        },
        include: {
          user: { select: { id: true, pushToken: true, notificationPreferences: true } },
          pod: {
            include: {
              activity: { select: { title: true } },
              members: {
                orderBy: { joinedAt: 'asc' },
                include: { user: { select: { id: true, name: true, firstName: true, lastName: true } } },
              },
            },
          },
        },
      });

      let attempted = 0;
      const messages: ExpoPushMessage[] = [];
      for (const membership of candidates) {
        if (!sameLocalDate(now, membership.pod.meetupTime)) continue;
        const earlierMemberships = await prisma.podMember.count({
          where: { userId: membership.userId, joinedAt: { lt: membership.joinedAt } },
        });
        if (earlierMemberships > 0) {
          await prisma.podMember.update({
            where: { id: membership.id },
            data: { firstPodNudgeSentAt: now },
          });
          continue;
        }

        attempted += 1;
        await prisma.podMember.update({
          where: { id: membership.id },
          data: { firstPodNudgeSentAt: now },
        });

        if (!membership.user.pushToken || !Expo.isExpoPushToken(membership.user.pushToken)) continue;
        const prefs = parsePreferences(membership.user.notificationPreferences);
        if (!prefs.meetupReminder) continue;

        const anchorMember =
          membership.pod.members.find((member) => member.user.id !== membership.userId)?.user ?? null;
        const anchorName = anchorMember ? getPublicName(anchorMember) : null;
        const others = Math.max(0, membership.pod.members.length - 1);
        const peopleLine =
          anchorName && others > 1
            ? `${anchorName} + ${others - 1} ${others - 1 === 1 ? 'other' : 'others'} are going`
            : anchorName
              ? `${anchorName} is going`
              : "You're the first one in";
        const meetupTime = membership.pod.meetupTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });
        const copy = firstPlanNudgeCopy(
          podDisplayTitle(membership.pod, 'Your plan'),
          meetupTime,
          membership.pod.location,
          peopleLine,
        );

        messages.push({
          to: membership.user.pushToken,
          ...copy,
          data: { type: 'first_pod_nudge', podId: membership.podId, url: podUrl(membership.podId) },
          sound: 'default',
          channelId: PUSH_CHANNELS.plans,
        });
      }

      await send(messages);
      return { attempted, sent: messages.length };
    } catch (err) {
      console.error('[NotificationService] sendFirstPodNudges error:', err);
      return { attempted: 0, sent: 0 };
    }
  },

  /** Prompt demand pools once they cross the cold-start threshold and no pod exists yet. */
  async sendDemandConversionPrompts(now = new Date()): Promise<{ pools: number; attempted: number; sent: number }> {
    try {
      const activeGroups = await prisma.podDemand.groupBy({
        by: ['activityId'],
        where: { consumedAt: null, expiresAt: { gt: now } },
        _count: { _all: true },
      });

      const recentPromptEvents = await prisma.analyticsEvent.findMany({
        where: {
          name: 'demand.conversion_prompted',
          createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { properties: true },
      });
      const recentlyPrompted = new Set(
        recentPromptEvents
          .map((event) =>
            event.properties &&
            typeof event.properties === 'object' &&
            !Array.isArray(event.properties) &&
            typeof event.properties.activityId === 'string'
              ? event.properties.activityId
              : null,
          )
          .filter((activityId): activityId is string => Boolean(activityId)),
      );

      let pools = 0;
      let attempted = 0;
      let sent = 0;
      for (const group of activeGroups) {
        if (group._count._all < DEMAND_POOL_THRESHOLD) continue;
        if (recentlyPrompted.has(group.activityId)) continue;

        const openPodCount = await prisma.pod.count({
          where: {
            activityId: group.activityId,
            status: 'FORMING',
            meetupTime: { gt: now },
            locationType: { not: 'private' },
          },
        });
        if (openPodCount > 0) continue;

        const activity = await prisma.activity.findFirst({
          where: { id: group.activityId, isActive: true },
        });
        if (!activity) continue;
        const demands = await prisma.podDemand.findMany({
          where: { activityId: group.activityId, consumedAt: null, expiresAt: { gt: now } },
          include: { user: { select: { id: true, pushToken: true, notificationPreferences: true } } },
        });

        pools += 1;
        attempted += demands.length;
        const copy = demandConversionCopy(demands.length, activity.title);
        for (const demand of demands) {
          const prefs = parsePreferences(demand.user.notificationPreferences);
          if (!prefs.demandAlerts) continue;
          const didSend = await sendNonTransactional(
            demand.user,
            {
              ...copy,
              data: { type: 'demand_conversion', activityId: activity.id, url: discoverUrl() },
              channelId: PUSH_CHANNELS.discovery,
            },
            'demand_conversion',
            now,
          );
          if (didSend) sent += 1;
        }

        await prisma.analyticsEvent.create({
          data: {
            userId: null,
            name: 'demand.conversion_prompted',
            properties: { activityId: activity.id, count: demands.length },
            createdAt: now,
          },
        });
      }

      return { pools, attempted, sent };
    } catch (err) {
      console.error('[NotificationService] sendDemandConversionPrompts error:', err);
      return { pools: 0, attempted: 0, sent: 0 };
    }
  },

  /** Notify active demand signals that supply appeared, then consume the signals. */
  async notifyDemandPoolPodCreated(
    activityId: string,
    podId: string,
    creatorId: string,
    meetupTime?: Date | null
  ): Promise<{ attempted: number; sent: number }> {
    const now = new Date();
    try {
      const [pod, demands] = await Promise.all([
        prisma.pod.findUnique({
          where: { id: podId },
          select: { title: true, location: true, activity: { select: { title: true } } },
        }),
        prisma.podDemand.findMany({
          where: { activityId, consumedAt: null, expiresAt: { gt: now } },
          include: { user: { select: { id: true, pushToken: true, notificationPreferences: true } } },
        }),
      ]);

      if (demands.length === 0) return { attempted: 0, sent: 0 };

      const dayLabel = meetupTime ? meetupDayLabel(meetupTime, now) : 'this week';
      const copy = demandPlanCreatedCopy(
        pod ? podDisplayTitle(pod, 'A plan') : 'A plan',
        dayLabel,
        meetupTime ? formatTime(meetupTime) : undefined,
        pod?.location,
      );
      let attempted = 0;
      let sent = 0;
      for (const demand of demands) {
        if (demand.userId === creatorId) continue;
        attempted += 1;
        const prefs = parsePreferences(demand.user.notificationPreferences);
        if (!prefs.demandAlerts) continue;
        const didSend = await sendNonTransactional(
            demand.user,
            {
            ...copy,
            data: { type: 'demand_pod_created', activityId, podId, url: podUrl(podId) },
            channelId: PUSH_CHANNELS.discovery,
          },
          'demand_pod_created',
          now,
        );
        if (didSend) sent += 1;
      }

      await prisma.podDemand.updateMany({
        where: { activityId, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      await prisma.analyticsEvent.create({
        data: {
          userId: null,
          name: 'demand.converted',
          properties: { activityId, podId, count: demands.length },
          createdAt: now,
        },
      });

      return { attempted, sent };
    } catch (err) {
      console.error('[NotificationService] notifyDemandPoolPodCreated error:', err);
      return { attempted: 0, sent: 0 };
    }
  },

  /** Send the Sunday planning recap only when there is something real to say. */
  async sendWeeklyRecaps(now = new Date()): Promise<{ attempted: number; sent: number }> {
    // Window, not exact-hour equality: the maintenance cron has no guarantee
    // of landing inside a specific hour. The 1/day non-transactional budget
    // in sendNonTransactional makes repeat runs within the window idempotent.
    if (now.getDay() !== 0 || now.getHours() < 18) return { attempted: 0, sent: 0 };

    try {
      const recapStart = new Date(now);
      recapStart.setDate(recapStart.getDate() - 7);
      const planningEnd = new Date(now);
      planningEnd.setDate(planningEnd.getDate() + 7);
      const joinablePods = await prisma.pod.findMany({
        where: {
          status: 'FORMING',
          meetupTime: { gt: now, lte: planningEnd },
          locationType: { not: 'private' },
        },
        include: {
          activity: { select: { category: true } },
          members: { select: { userId: true } },
        },
      });

      const users = await prisma.user.findMany({
        where: { verifiedUniversity: true, pushToken: { not: null } },
        select: {
          id: true,
          pushToken: true,
          notificationPreferences: true,
          interestTags: true,
        },
      });

      let attempted = 0;
      let sent = 0;
      for (const user of users) {
        const prefs = parsePreferences(user.notificationPreferences);
        if (!prefs.weeklyRecap) continue;

        const attendedMemberships = await prisma.podMember.findMany({
          where: {
            userId: user.id,
            confirmedAt: { not: null, gte: recapStart, lte: now },
          },
          include: {
            pod: {
              include: {
                members: {
                  where: { confirmedAt: { not: null } },
                  select: { userId: true },
                },
              },
            },
          },
        });

        const interestCategories = getInterestCategories(user.interestTags);
        const matchingJoinableCount = joinablePods.filter((pod) => {
          if (pod.members.some((member) => member.userId === user.id)) return false;
          if (interestCategories.size === 0) return true;
          return interestCategories.has(pod.activity.category);
        }).length;

        if (attendedMemberships.length === 0 && matchingJoinableCount === 0) continue;

        const metUserIds = new Set<string>();
        for (const membership of attendedMemberships) {
          for (const member of membership.pod.members) {
            if (member.userId !== user.id) metUserIds.add(member.userId);
          }
        }

        // "New people" means a first co-attendance, not merely everyone in
        // this week's plans. Exclude anyone the user had already attended a
        // plan with before the recap window.
        let newPeopleCount = metUserIds.size;
        if (metUserIds.size > 0) {
          const earlierMemberships = await prisma.podMember.findMany({
            where: { userId: user.id, confirmedAt: { not: null, lt: recapStart } },
            select: {
              pod: {
                select: {
                  members: {
                    where: { confirmedAt: { not: null } },
                    select: { userId: true },
                  },
                },
              },
            },
          });
          const priorCoattendees = new Set<string>();
          for (const membership of earlierMemberships) {
            for (const member of membership.pod.members) priorCoattendees.add(member.userId);
          }
          newPeopleCount = [...metUserIds].filter((userId) => !priorCoattendees.has(userId)).length;
        }

        const copy = weeklyPlanningCopy(
          attendedMemberships.length,
          newPeopleCount,
          matchingJoinableCount,
        );
        if (!copy) continue;
        attempted += 1;

        const didSend = await sendNonTransactional(
          user,
          {
            ...copy,
            data: { type: 'weekly_recap', url: discoverUrl() },
            channelId: PUSH_CHANNELS.discovery,
          },
          'weekly_recap',
          now,
        );
        if (didSend) sent += 1;
      }

      return { attempted, sent };
    } catch (err) {
      console.error('[NotificationService] sendWeeklyRecaps error:', err);
      return { attempted: 0, sent: 0 };
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
      const copy = clubMeetingCreatedCopy(
        meeting.club.name,
        meeting.title,
        meetingDate,
        meeting.location,
      );
      for (const member of meeting.club.members) {
        if (member.user.id === creatorId) continue;
        if (!canReceiveClubBroadcast(member, meeting.visibility, targetRoleIds)) continue;
        if (!member.user.pushToken || !Expo.isExpoPushToken(member.user.pushToken)) continue;
        const prefs = parsePreferences(member.user.notificationPreferences);
        if (!prefs.clubMeetingCreated) continue;
        messages.push({
          to: member.user.pushToken,
          ...copy,
          data: { type: 'club_meeting_created', clubId: meeting.clubId, meetingId, url: clubMeetingUrl(meeting.clubId, meetingId) },
          channelId: PUSH_CHANNELS.clubs,
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
      const copy = clubAnnouncementCopy(announcement.club.name, announcement.content);
      const messages: ExpoPushMessage[] = [];
      for (const member of announcement.club.members) {
        if (member.user.id === creatorId) continue;
        if (!canReceiveClubBroadcast(member, announcement.visibility, targetRoleIds)) continue;
        if (!member.user.pushToken || !Expo.isExpoPushToken(member.user.pushToken)) continue;
        const prefs = parsePreferences(member.user.notificationPreferences);
        if (!prefs.clubAnnouncementCreated) continue;
        messages.push({
          to: member.user.pushToken,
          ...copy,
          data: { type: 'club_announcement_created', clubId: announcement.clubId, announcementId, url: clubUrl(announcement.clubId) },
          channelId: PUSH_CHANNELS.clubs,
        });
      }
      await send(messages);
    } catch (err) {
      console.error('[NotificationService] notifyClubAnnouncementCreated error:', err);
    }
  },

  /** Notify eligible members about a club chat message without double-sending role mentions. */
  async notifyClubMessage(
    clubId: string,
    senderId: string,
    preview: string,
    options: {
      channelId?: string | null;
      channelKind?: 'GENERAL' | 'OFFICERS';
      mentionedRoleIds?: string[];
    } = {},
  ): Promise<void> {
    try {
      const [club, channel] = await Promise.all([
        prisma.club.findUnique({
          where: { id: clubId },
          include: {
            roles: { select: { id: true, name: true } },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                    pushToken: true,
                    notificationPreferences: true,
                  },
                },
                customRoles: { select: { roleId: true } },
              },
            },
          },
        }),
        options.channelId
          ? prisma.clubChannel.findFirst({ where: { id: options.channelId, clubId } })
          : prisma.clubChannel.findFirst({
              where: { clubId, kind: options.channelKind ?? 'GENERAL' },
            }),
      ]);
      if (!club || !channel) return;

      const senderMember = club.members.find((member) => member.user.id === senderId);
      const senderName = senderMember ? getPublicName(senderMember.user) : 'Someone';
      const allowedRoleIds = parseStringList(channel.allowedRoleIds);
      const allowedUserIds = parseStringList(channel.allowedUserIds);
      const mentionedRoleIds = new Set(options.mentionedRoleIds ?? []);
      const mentionedRoleNames = club.roles
        .filter((role) => mentionedRoleIds.has(role.id))
        .map((role) => `@${role.name}`);
      const mentionLabel = mentionedRoleNames.length === 1 ? mentionedRoleNames[0] : 'your role';
      const messages: ExpoPushMessage[] = [];

      for (const member of club.members) {
        const user = member.user;
        if (user.id === senderId) continue;
        const memberRoleIds = member.customRoles.map((assignment) => assignment.roleId);
        const canRead =
          channel.kind === 'GENERAL' ||
          (channel.kind === 'OFFICERS' && roleRank(member.role) >= roleRank('OFFICER')) ||
          (channel.kind === 'CUSTOM' &&
            ((allowedRoleIds.length === 0 && allowedUserIds.length === 0) ||
              allowedUserIds.includes(user.id) ||
              memberRoleIds.some((roleId) => allowedRoleIds.includes(roleId))));
        if (!canRead) continue;
        if (!user.pushToken || !Expo.isExpoPushToken(user.pushToken)) continue;

        const prefs = parsePreferences(user.notificationPreferences);
        const isMentioned = memberRoleIds.some((roleId) => mentionedRoleIds.has(roleId));
        if (isMentioned ? !prefs.clubRolePing && !prefs.newMessage : !prefs.newMessage) continue;
        const copy = clubMessageCopy(
          senderName,
          club.name,
          channel.name,
          preview,
          isMentioned && prefs.clubRolePing ? mentionLabel : undefined,
        );
        messages.push({
          to: user.pushToken,
          ...copy,
          data: {
            type: isMentioned && prefs.clubRolePing ? 'club_role_ping' : 'club_message',
            clubId,
            channelId: channel.id,
            url: clubChatUrl(clubId, channel.id),
          },
          sound: 'default',
          channelId: PUSH_CHANNELS.messages,
        });
      }
      await send(messages);
    } catch (err) {
      console.error('[NotificationService] notifyClubMessage error:', err);
    }
  },

  /** Notify members holding any of the pinged roles that they were mentioned in club chat. */
  async notifyClubRolePing(
    clubId: string,
    senderId: string,
    roleIds: string[],
    channelName: string,
    preview: string
  ): Promise<void> {
    if (roleIds.length === 0) return;
    try {
      const [club, sender, holders] = await Promise.all([
        prisma.club.findUnique({ where: { id: clubId }, select: { name: true } }),
        prisma.user.findUnique({
          where: { id: senderId },
          select: { id: true, name: true, firstName: true, lastName: true },
        }),
        prisma.clubMemberRole.findMany({
          where: { clubId, roleId: { in: roleIds } },
          include: {
            role: { select: { name: true } },
            member: {
              include: {
                user: { select: { id: true, pushToken: true, notificationPreferences: true } },
              },
            },
          },
        }),
      ]);
      if (!club) return;

      const senderName = sender ? getPublicName(sender) : 'Someone';
      const roleNames = Array.from(new Set(holders.map((row) => row.role.name)));
      const mentionLabel = roleNames.length === 1 ? `@${roleNames[0]}` : `${roleIds.length} roles`;
      const copy = clubMessageCopy(senderName, club.name, channelName, preview, mentionLabel);

      const seen = new Set<string>();
      const messages: ExpoPushMessage[] = [];
      for (const row of holders) {
        const user = row.member.user;
        if (user.id === senderId || seen.has(user.id)) continue;
        seen.add(user.id);
        if (!user.pushToken || !Expo.isExpoPushToken(user.pushToken)) continue;
        const prefs = parsePreferences(user.notificationPreferences);
        if (!prefs.clubRolePing) continue;
        messages.push({
          to: user.pushToken,
          ...copy,
          data: { type: 'club_role_ping', clubId, url: clubUrl(clubId) },
          sound: 'default',
          channelId: PUSH_CHANNELS.messages,
        });
      }
      await send(messages);
    } catch (err) {
      console.error('[NotificationService] notifyClubRolePing error:', err);
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
      const copy = clubRemovalCopy(club.name);
      await send([
        {
          to: user.pushToken,
          ...copy,
          data: { type: 'club_kick', clubId, url: 'oval://clubs-home' },
          channelId: PUSH_CHANNELS.clubs,
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
      const copy = clubRoleChangeCopy(club.name, newRole);
      await send([
        {
          to: user.pushToken,
          ...copy,
          data: { type: 'club_role_change', clubId, newRole, url: clubUrl(clubId) },
          channelId: PUSH_CHANNELS.clubs,
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
      const copy = clubAttendanceOpenCopy(meeting.title, meeting.club.name);
      for (const attendee of meeting.attendees) {
        if (!attendee.user.pushToken || !Expo.isExpoPushToken(attendee.user.pushToken)) continue;
        const prefs = parsePreferences(attendee.user.notificationPreferences);
        if (!prefs.clubAttendanceOpen) continue;
        messages.push({
          to: attendee.user.pushToken,
          ...copy,
          data: { type: 'club_attendance_open', meetingId, url: clubMeetingUrl(meeting.clubId, meetingId) },
          sound: 'default',
          channelId: PUSH_CHANNELS.plans,
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
      const copy = clubRsvpCopy(meeting.title, meeting.club.name, meetingDate);

      const messages: ExpoPushMessage[] = [];
      for (const user of users) {
        if (!user.pushToken || !Expo.isExpoPushToken(user.pushToken)) continue;
        const prefs = parsePreferences(user.notificationPreferences);
        if (!prefs.clubRsvpReminder) continue;
        messages.push({
          to: user.pushToken,
          ...copy,
          data: { type: 'club_rsvp_reminder', clubId: meeting.club.id, meetingId, url: clubMeetingUrl(meeting.club.id, meetingId) },
          sound: 'default',
          channelId: PUSH_CHANNELS.clubs,
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
      const copy = clubOutreachCopy(club.name, content);

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
          ...copy,
          data: { type: 'club_outreach', clubId, url: clubUrl(clubId) },
          channelId: PUSH_CHANNELS.clubs,
        });
      }

      return { attempted: recipientIds.length, sent: await sendAndCount(messages) };
    } catch (err) {
      console.error('[NotificationService] notifyClubOutreach error:', err);
      return { attempted: recipientIds.length, sent: 0 };
    }
  },

};
