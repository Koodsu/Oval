import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest, optionalAuth, requireVerifiedAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import prisma from '../prisma';

const router = Router();

const EVENT_NAME_REGEX = /^[a-zA-Z0-9_.:-]{1,80}$/;
const MAX_PROPERTIES_BYTES = 4000;

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseDays(raw: unknown): number {
  const parsed = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  if (isNaN(parsed) || parsed <= 0) return 14;
  return Math.min(parsed, 90);
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dayKey(date: Date): string {
  // Explicit local-date key (server TZ is pinned to America/New_York in
  // server.ts). Never mix local midnight with toISOString(): that flips
  // dates on timezones east of UTC.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function hasReferral(properties: Prisma.JsonValue | null): boolean {
  return isJsonObject(properties) && (
    typeof properties.referredBy === 'string' ||
    typeof properties.ref === 'string'
  );
}

function numericProperty(properties: Prisma.JsonValue | null, key: string): number | null {
  if (!isJsonObject(properties)) return null;
  const value = properties[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringProperty(properties: Prisma.JsonValue | null, key: string): string | null {
  if (!isJsonObject(properties)) return null;
  const value = properties[key];
  return typeof value === 'string' ? value : null;
}

router.get(
  '/summary',
  requireVerifiedAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const days = parseDays(req.query.days);
    const now = new Date();
    const windowStart = addDays(startOfDay(now), -(days - 1));
    const retentionStart = addDays(windowStart, -7);

    try {
      const [
        activationEvents,
        appOpenEvents,
        loopEvents,
        users,
        inviteEvents,
        podCreatedEvents,
        demandEvents,
        activeDemandCounts,
        currentJoinablePods,
        joinedMembershipCount,
        attendedMembershipCount,
        attendedLast7Count,
      ] = await Promise.all([
        prisma.analyticsEvent.findMany({
          where: {
            name: 'verify.completed',
            userId: { not: null },
            createdAt: { gte: windowStart, lte: now },
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.analyticsEvent.findMany({
          where: {
            name: 'app.opened',
            userId: { not: null },
            createdAt: { gte: retentionStart, lte: now },
          },
          select: { userId: true, createdAt: true, properties: true },
        }),
        prisma.analyticsEvent.findMany({
          where: {
            name: {
              in: ['pod.created', 'pod.joined', 'pod.message_sent', 'friend.accepted', 'invite.shared'],
            },
            createdAt: { gte: windowStart, lte: now },
          },
          select: { name: true, createdAt: true },
        }),
        prisma.user.findMany({
          where: { createdAt: { gte: windowStart, lte: now } },
          select: { id: true, createdAt: true },
        }),
        prisma.analyticsEvent.findMany({
          where: {
            name: { in: ['invite.shared', 'invite.link_opened', 'auth.register'] },
            createdAt: { gte: windowStart, lte: now },
          },
          select: { name: true, properties: true, createdAt: true },
        }),
        prisma.analyticsEvent.findMany({
          where: {
            name: 'pod.created',
            createdAt: { gte: windowStart, lte: now },
          },
          select: { properties: true, createdAt: true },
        }),
        prisma.analyticsEvent.findMany({
          where: {
            name: { in: ['demand.signaled', 'demand.converted', 'demand.conversion_prompted'] },
            createdAt: { gte: windowStart, lte: now },
          },
          select: { name: true, properties: true, createdAt: true },
        }),
        prisma.podDemand.groupBy({
          by: ['activityId'],
          where: { consumedAt: null, expiresAt: { gt: now } },
          _count: { _all: true },
        }),
        prisma.pod.findMany({
          where: {
            status: 'FORMING',
            meetupTime: { gt: now },
            locationType: { not: 'private' },
          },
          select: {
            id: true,
            maxMembers: true,
            members: { select: { id: true } },
          },
        }),
        prisma.podMember.count({
          where: { joinedAt: { gte: windowStart, lte: now } },
        }),
        prisma.podMember.count({
          where: { confirmedAt: { not: null, gte: windowStart, lte: now } },
        }),
        prisma.podMember.count({
          where: { confirmedAt: { not: null, gte: addDays(now, -7), lte: now } },
        }),
      ]);

      const firstVerifyByUser = new Map<string, Date>();
      for (const event of activationEvents) {
        if (!event.userId || firstVerifyByUser.has(event.userId)) continue;
        firstVerifyByUser.set(event.userId, event.createdAt);
      }

      const activationUserIds = [...firstVerifyByUser.keys()];
      const activationActions = activationUserIds.length
        ? await prisma.analyticsEvent.findMany({
            where: {
              userId: { in: activationUserIds },
              name: { in: ['pod.joined', 'pod.created'] },
              createdAt: { gte: windowStart, lte: addDays(now, 3) },
            },
            select: { userId: true, createdAt: true },
          })
        : [];

      let within24h = 0;
      let within72h = 0;
      let attendedWithin7d = 0;
      const attendanceActions = activationUserIds.length
        ? await prisma.podMember.findMany({
            where: {
              userId: { in: activationUserIds },
              confirmedAt: { not: null },
            },
            select: { userId: true, confirmedAt: true },
          })
        : [];

      for (const [userId, verifiedAt] of firstVerifyByUser.entries()) {
        const userActions = activationActions.filter((event) => event.userId === userId);
        if (userActions.some((event) => event.createdAt > verifiedAt && event.createdAt <= new Date(verifiedAt.getTime() + 24 * 60 * 60 * 1000))) {
          within24h += 1;
        }
        if (userActions.some((event) => event.createdAt > verifiedAt && event.createdAt <= new Date(verifiedAt.getTime() + 72 * 60 * 60 * 1000))) {
          within72h += 1;
        }
        if (
          attendanceActions.some(
            (membership) =>
              membership.userId === userId &&
              membership.confirmedAt &&
              membership.confirmedAt > verifiedAt &&
              membership.confirmedAt <= new Date(verifiedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
          )
        ) {
          attendedWithin7d += 1;
        }
      }

      const dauMap = new Map<string, Set<string>>();
      for (const event of appOpenEvents) {
        if (!event.userId || event.createdAt < windowStart) continue;
        const key = dayKey(event.createdAt);
        if (!dauMap.has(key)) dauMap.set(key, new Set());
        dauMap.get(key)!.add(event.userId);
      }

      const wau = [];
      for (let i = 0; i < days; i++) {
        const day = addDays(windowStart, i);
        const dayEnd = addDays(day, 1);
        const rollingStart = addDays(day, -6);
        const usersInWindow = new Set(
          appOpenEvents
            .filter((event) => event.userId && event.createdAt >= rollingStart && event.createdAt < dayEnd)
            .map((event) => event.userId as string),
        );
        wau.push({ date: dayKey(day), users: usersInWindow.size });
      }

      const loop = [];
      for (let i = 0; i < days; i++) {
        const date = dayKey(addDays(windowStart, i));
        const eventsForDay = loopEvents.filter((event) => dayKey(event.createdAt) === date);
        loop.push({
          date,
          podCreated: eventsForDay.filter((event) => event.name === 'pod.created').length,
          podJoined: eventsForDay.filter((event) => event.name === 'pod.joined').length,
          podMessageSent: eventsForDay.filter((event) => event.name === 'pod.message_sent').length,
          friendAccepted: eventsForDay.filter((event) => event.name === 'friend.accepted').length,
          inviteShared: eventsForDay.filter((event) => event.name === 'invite.shared').length,
        });
      }

      const appOpenKeysByUser = new Map<string, Set<string>>();
      for (const event of appOpenEvents) {
        if (!event.userId) continue;
        if (!appOpenKeysByUser.has(event.userId)) appOpenKeysByUser.set(event.userId, new Set());
        appOpenKeysByUser.get(event.userId)!.add(dayKey(event.createdAt));
      }

      const cohortsByDay = new Map<string, typeof users>();
      for (const user of users) {
        const key = dayKey(user.createdAt);
        cohortsByDay.set(key, [...(cohortsByDay.get(key) ?? []), user]);
      }
      const retention = [...cohortsByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, cohort]) => {
        const d1 = cohort.filter((user) => appOpenKeysByUser.get(user.id)?.has(dayKey(addDays(user.createdAt, 1)))).length;
        const d7 = cohort.filter((user) => appOpenKeysByUser.get(user.id)?.has(dayKey(addDays(user.createdAt, 7)))).length;
        return {
          date,
          users: cohort.length,
          d1,
          d1Rate: rate(d1, cohort.length),
          d7,
          d7Rate: rate(d7, cohort.length),
        };
      });

      const dau = [...dauMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, userIds]) => ({ date, users: userIds.size }));

      const shares = inviteEvents.filter((event) => event.name === 'invite.shared').length;
      const opens = inviteEvents.filter((event) => event.name === 'invite.link_opened').length;
      const registrationsWithRef = inviteEvents.filter((event) => event.name === 'auth.register' && hasReferral(event.properties)).length;
      const podsCreated = podCreatedEvents.length;
      const templatedPodsCreated = podCreatedEvents.filter((event) => {
        const template = stringProperty(event.properties, 'template');
        return Boolean(template && template !== 'custom');
      }).length;

      const activeDemandActivityIds = activeDemandCounts.map((row) => row.activityId);
      const demandActivities = activeDemandActivityIds.length
        ? await prisma.activity.findMany({
            where: { id: { in: activeDemandActivityIds } },
            select: { id: true, title: true, category: true },
          })
        : [];
      const demandActivityById = new Map(demandActivities.map((activity) => [activity.id, activity]));
      const activeDemandByActivity = activeDemandCounts
        .map((row) => {
          const activity = demandActivityById.get(row.activityId);
          return {
            activityId: row.activityId,
            title: activity?.title ?? 'Unknown activity',
            category: activity?.category ?? null,
            count: row._count._all,
          };
        })
        .sort((a, b) => b.count - a.count);

      const currentJoinableCount = currentJoinablePods.filter(
        (pod) => pod.members.length < pod.maxMembers,
      ).length;
      const liquidity = [...dauMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, userIds]) => {
          const userIdsWithThree = new Set<string>();
          for (const event of appOpenEvents) {
            if (!event.userId || dayKey(event.createdAt) !== date) continue;
            const joinablePodCount = numericProperty(event.properties, 'joinablePodCount');
            if (joinablePodCount != null && joinablePodCount >= 3) {
              userIdsWithThree.add(event.userId);
            }
          }
          const hasInstrumentedEvents = appOpenEvents.some(
            (event) => dayKey(event.createdAt) === date && numericProperty(event.properties, 'joinablePodCount') != null,
          );
          const viewersWithThreeJoinablePods = hasInstrumentedEvents
            ? userIdsWithThree.size
            : currentJoinableCount >= 3
              ? userIds.size
              : 0;
          return {
            date,
            viewers: userIds.size,
            viewersWithThreeJoinablePods,
            ratio: rate(viewersWithThreeJoinablePods, userIds.size),
          };
        });

      const activeWau = wau.length ? wau[wau.length - 1].users : 0;

      res.json({
        days,
        activation: {
          verified: firstVerifyByUser.size,
          within24h,
          within24hRate: rate(within24h, firstVerifyByUser.size),
          within72h,
          within72hRate: rate(within72h, firstVerifyByUser.size),
          attendedWithin7d,
          attendedWithin7dRate: rate(attendedWithin7d, firstVerifyByUser.size),
        },
        attendance: {
          attendedPlans: attendedMembershipCount,
          weeklyActiveUsers: activeWau,
          // North star: both numerator and denominator over the same 7 days.
          weeklyAttendedPlansPerWau: rate(attendedLast7Count, activeWau),
          attendedLast7Days: attendedLast7Count,
          joinToAttend: {
            joins: joinedMembershipCount,
            attended: attendedMembershipCount,
            rate: rate(attendedMembershipCount, joinedMembershipCount),
          },
        },
        liquidity: {
          currentJoinablePods: currentJoinableCount,
          daily: liquidity,
        },
        templates: {
          podsCreated,
          templatedPodsCreated,
          templateShare: rate(templatedPodsCreated, podsCreated),
        },
        demand: {
          signaled: demandEvents.filter((event) => event.name === 'demand.signaled').length,
          conversionPrompts: demandEvents.filter((event) => event.name === 'demand.conversion_prompted').length,
          converted: demandEvents.filter((event) => event.name === 'demand.converted').length,
          activeByActivity: activeDemandByActivity,
        },
        dau,
        wau,
        retention,
        loop,
        invites: { shares, opens, registrationsWithRef },
      });
    } catch (err) {
      console.error('[analytics] Failed to build summary:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/events', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const properties = req.body?.properties;

  if (!EVENT_NAME_REGEX.test(name)) {
    res.status(400).json({ error: 'Invalid event name' });
    return;
  }

  if (properties !== undefined && !isJsonObject(properties)) {
    res.status(400).json({ error: 'properties must be an object when provided' });
    return;
  }

  if (properties !== undefined && Buffer.byteLength(JSON.stringify(properties), 'utf8') > MAX_PROPERTIES_BYTES) {
    res.status(400).json({ error: 'properties is too large' });
    return;
  }

  try {
    await prisma.analyticsEvent.create({
      data: {
        userId: req.user?.userId ?? null,
        name,
        properties: properties === undefined ? undefined : (properties as Prisma.InputJsonValue),
      },
    });
    res.status(204).send();
  } catch (err) {
    console.error('[analytics] Failed to record event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
