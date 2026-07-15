import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { requireVerifiedAuth as requireAuth, AuthRequest } from '../middleware/auth';
import { getLocationsForCategory, getCoordinatesForLocation } from '../config/locations';
import { getInterestCategories } from '../config/interestTags';
import { getBlockedUserIds, hasBlockingRelationship } from '../lib/blocks';
import { NotificationService } from '../lib/NotificationService';
import { setTyping } from '../lib/typingStore';
import { expireOldPods } from '../lib/expireOldPods';
import { getActivityEmoji } from '../lib/activityEmoji';
import { joinExistingPodMember, parsePodMembers, MEMBER_USER_SELECT } from '../lib/joinExistingPod';
import { withDisplayName } from '../lib/userNames';
import { moderateTextContent } from '../lib/contentModeration';
import { broadcast, podTopic, REALTIME_EVENTS } from '../lib/realtime';
import { getPodUnreadCounts } from '../lib/podReadState';

const router = Router();

const FORMING = 'FORMING';
const LOCKED = 'LOCKED';
const COMPLETED = 'COMPLETED';
const EXPIRED = 'EXPIRED';
const CANCELLED = 'CANCELLED';
const PUBLIC_LOCATION_TYPE = 'public';
const PRIVATE_LOCATION_TYPE = 'private';
const MAX_LOCATION_LENGTH = 120;

/**
 * OSU campus geofence. Roads, clockwise from the northwest corner:
 * Lane Ave (north) → High St (east) → 10th Ave (south) → Kenny Rd (west).
 *
 * Vertices are anchored to real intersections (±~50m). The previous polygon's
 * east edge sat at -83.0190 — west of High St — which rejected pins on the
 * Oval, the Union, and everything east of the stadium.
 *
 * ⚠️ Keep in sync with frontend/src/constants/campusMap.ts, which draws this
 * fence on the map and pre-validates pins client-side.
 */
const OSU_CAMPUS_POLYGON = [
  // NW — Lane Ave & Kenny Rd
  { latitude: 40.0063, longitude: -83.0421 },
  // North — east along Lane Ave
  { latitude: 40.0061, longitude: -83.033 }, // Lane over west campus
  { latitude: 40.006, longitude: -83.0252 }, // Lane & Olentangy River Rd
  { latitude: 40.0061, longitude: -83.018 }, // Lane & Tuttle Park Pl
  // NE — Lane Ave & High St
  { latitude: 40.0062, longitude: -83.0093 },
  // East — south down High St
  { latitude: 40.003, longitude: -83.009 }, // Lane→17th block
  { latitude: 39.9991, longitude: -83.0086 }, // 15th & High (main gateway)
  { latitude: 39.9962, longitude: -83.0082 }, // 12th & High (Ohio Union block)
  // SE — 10th Ave & High St
  { latitude: 39.9935, longitude: -83.0078 },
  // South — west along 10th Ave (covers the Wexner Medical campus)
  { latitude: 39.9934, longitude: -83.018 }, // 10th & Neil
  { latitude: 39.9933, longitude: -83.026 }, // 10th line at the river
  { latitude: 39.9933, longitude: -83.034 }, // 10th line over west campus
  // SW — 10th Ave line extended to Kenny Rd
  { latitude: 39.9932, longitude: -83.0425 },
  // West — north up Kenny Rd
  { latitude: 40.0006, longitude: -83.0428 }, // Kenny & Kinnear Rd
];

// Ray-casting point-in-polygon check. Exported so tests can assert every
// LOCATION_COORDINATES entry sits inside the fence.
export function isInsideCampus(lat: number, lng: number): boolean {
  let inside = false;
  const n = OSU_CAMPUS_POLYGON.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = OSU_CAMPUS_POLYGON[i].longitude;
    const yi = OSU_CAMPUS_POLYGON[i].latitude;
    const xj = OSU_CAMPUS_POLYGON[j].longitude;
    const yj = OSU_CAMPUS_POLYGON[j].latitude;
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Haversine distance in metres
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Round coordinates to 3 decimal places (~100m accuracy) for non-members
function approximateCoords<T extends { latitude: number | null; longitude: number | null }>(
  pod: T
): T {
  if (pod.latitude == null || pod.longitude == null) return pod;
  return {
    ...pod,
    latitude: Math.round(pod.latitude * 1000) / 1000,
    longitude: Math.round(pod.longitude * 1000) / 1000,
  };
}

function getMaxMeetupTime(): Date {
  const max = new Date();
  max.setDate(max.getDate() + 7);
  max.setHours(23, 59, 59, 999);
  return max;
}

// GET /pods/mine
router.get('/mine', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  try {
    const blockedIds = await getBlockedUserIds(userId);
    const pods = await prisma.pod.findMany({
      where: {
        status: { notIn: [EXPIRED, COMPLETED, CANCELLED] },
        members: {
          some: { userId },
          none: { userId: { in: [...blockedIds] } },
        },
      },
      include: {
        activity: true,
        members: {
          include: { user: { select: MEMBER_USER_SELECT } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const unreadCounts = await getPodUnreadCounts(userId, pods.map((pod) => pod.id), blockedIds);
    res.json(
      pods.map((pod) => ({
        ...parsePodMembers(pod),
        unreadCount: unreadCounts.get(pod.id) ?? 0,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods/mine/history — COMPLETED/EXPIRED pods from the last 14 days
router.get('/mine/history', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const since = new Date();
  since.setDate(since.getDate() - 14);

  try {
    const pods = await prisma.pod.findMany({
      where: {
        status: { in: [COMPLETED, EXPIRED, CANCELLED] },
        members: { some: { userId } },
        meetupTime: { gte: since },
      },
      include: {
        activity: true,
        members: {
          include: { user: { select: MEMBER_USER_SELECT } },
        },
      },
      orderBy: { meetupTime: 'desc' },
    });

    res.json(pods.map(parsePodMembers));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods/feed — cross-activity discovery feed, soonest first then most-joined
router.get('/feed', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { category, limit = '20', lat, lng } = req.query;
  const userId = req.user!.userId;
  const userLat = lat && typeof lat === 'string' ? parseFloat(lat) : null;
  const userLng = lng && typeof lng === 'string' ? parseFloat(lng) : null;
  const hasUserLocation = userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng);
  const now = new Date();

  try {
    await expireOldPods();

    const blockedIds = await getBlockedUserIds(userId);

    const where: Record<string, unknown> = {
      status: FORMING,
      meetupTime: { gt: now },
      members: { none: { userId: { in: [...blockedIds] } } },
      OR: [
        { locationType: { not: PRIVATE_LOCATION_TYPE } },
        { members: { some: { userId } } },
      ],
    };

    if (category && typeof category === 'string') {
      where.activity = { category };
    }

    const requestedLimit = Math.min(Number(limit) || 20, 50);
    const [pods, pastMembers, recaps, user] = await Promise.all([
      prisma.pod.findMany({
        where,
        include: {
          activity: true,
          members: {
            include: { user: { select: MEMBER_USER_SELECT } },
          },
        },
        orderBy: [{ meetupTime: 'asc' }, { id: 'asc' }],
        take: requestedLimit,
      }),
      prisma.podMember.findMany({
        where: { userId },
        include: { pod: { select: { activityId: true } } },
        take: 50,
      }),
      prisma.podRecap.findMany({
        where: { userId },
        include: { pod: { select: { activityId: true } } },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { interestTags: true },
      }),
    ]);

    // Build activity preference scores from past recaps
    // rating 3 = +1, rating 2 = 0, rating 1 = -1 (normalized to -1..+1)
    const activityRatingSum: Record<string, number> = {};
    const activityRatingCount: Record<string, number> = {};
    for (const recap of recaps) {
      const actId = recap.pod.activityId;
      activityRatingSum[actId] = (activityRatingSum[actId] ?? 0) + (recap.rating - 2);
      activityRatingCount[actId] = (activityRatingCount[actId] ?? 0) + 1;
    }

    const preferredActivityIds = new Set(pastMembers.map((pm) => pm.pod.activityId));
    const interestCategories = getInterestCategories(user?.interestTags);

    function getActivityScore(activityId: string): number {
      const count = activityRatingCount[activityId] ?? 0;
      if (count === 0) return 0;
      return (activityRatingSum[activityId] ?? 0) / count; // -1..+1
    }

    function interestMatch(pod: (typeof pods)[number]): number {
      return interestCategories.has(pod.activity.category) ? 1 : 0;
    }

    function compareTime(a: (typeof pods)[number], b: (typeof pods)[number]): number {
      return new Date(a.meetupTime).getTime() - new Date(b.meetupTime).getTime();
    }

    function compareMembersDesc(a: (typeof pods)[number], b: (typeof pods)[number]): number {
      return b.members.length - a.members.length;
    }

    pods.sort((a, b) => {
      if (pastMembers.length < 3) {
        const interestDiff = interestMatch(b) - interestMatch(a);
        if (interestDiff !== 0) return interestDiff;
        const timeDiff = compareTime(a, b);
        if (timeDiff !== 0) return timeDiff;
        const memberDiff = compareMembersDesc(a, b);
        if (memberDiff !== 0) return memberDiff;
        return a.id.localeCompare(b.id);
      }

      const scoreA = getActivityScore(a.activityId);
      const scoreB = getActivityScore(b.activityId);
      // Heavily negative activities (avg < -0.5) sink to the bottom
      const sinkA = scoreA < -0.5 ? 1 : 0;
      const sinkB = scoreB < -0.5 ? 1 : 0;
      if (sinkA !== sinkB) return sinkA - sinkB;
      // Otherwise sort by time then members
      const timeDiff = compareTime(a, b);
      if (timeDiff !== 0) return timeDiff;
      const memberDiff = compareMembersDesc(a, b);
      if (memberDiff !== 0) return memberDiff;
      const interestDiff = interestMatch(b) - interestMatch(a);
      if (interestDiff !== 0) return interestDiff;
      return a.id.localeCompare(b.id);
    });

    // Optional distance sort when caller provides their location
    if (hasUserLocation) {
      pods.sort((a, b) => {
        const aHasCoords = a.latitude != null && a.longitude != null;
        const bHasCoords = b.latitude != null && b.longitude != null;
        if (!aHasCoords && !bHasCoords) return 0;
        if (!aHasCoords) return 1;
        if (!bHasCoords) return -1;
        return (
          haversineDistance(userLat!, userLng!, a.latitude!, a.longitude!) -
          haversineDistance(userLat!, userLng!, b.latitude!, b.longitude!)
        );
      });
    }

    const memberPodIds = new Set(
      (await prisma.podMember.findMany({ where: { userId }, select: { podId: true } })).map(
        (m) => m.podId
      )
    );

    const result = pods.map((p) => {
      const parsed = parsePodMembers({ ...p, recommended: preferredActivityIds.has(p.activityId) });
      if (!memberPodIds.has(p.id)) return approximateCoords(parsed);
      return parsed;
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods?activityId=&sort=
// Returns upcoming FORMING pods for an activity (not locked/completed/expired — public browse)
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { activityId, sort, lat, lng } = req.query;
  const userLat = lat && typeof lat === 'string' ? parseFloat(lat) : null;
  const userLng = lng && typeof lng === 'string' ? parseFloat(lng) : null;
  const hasUserLocation = userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng);

  if (!activityId || typeof activityId !== 'string') {
    res.status(400).json({ error: 'activityId query parameter is required' });
    return;
  }

  try {
    await expireOldPods();

    const now = new Date();
    const blockedIds = await getBlockedUserIds(req.user!.userId);
    const where: Record<string, unknown> = {
      activityId,
      status: FORMING,
      meetupTime: { gt: now },
      members: { none: { userId: { in: [...blockedIds] } } },
      OR: [
        { locationType: { not: PRIVATE_LOCATION_TYPE } },
        { members: { some: { userId: req.user!.userId } } },
      ],
    };

    let orderBy: Record<string, string> = { createdAt: 'desc' };
    if (sort === 'starting_soon') {
      orderBy = { meetupTime: 'asc' };
    }

    const pods = await prisma.pod.findMany({
      where,
      include: {
        activity: true,
        members: {
          include: { user: { select: MEMBER_USER_SELECT } },
        },
      },
      orderBy,
    });

    let result = pods;
    if (sort === 'most_members') {
      result = [...pods].sort((a, b) => b.members.length - a.members.length);
    }

    if (hasUserLocation) {
      result = [...result].sort((a, b) => {
        const aHasCoords = a.latitude != null && a.longitude != null;
        const bHasCoords = b.latitude != null && b.longitude != null;
        if (!aHasCoords && !bHasCoords) return 0;
        if (!aHasCoords) return 1;
        if (!bHasCoords) return -1;
        return (
          haversineDistance(userLat!, userLng!, a.latitude!, a.longitude!) -
          haversineDistance(userLat!, userLng!, b.latitude!, b.longitude!)
        );
      });
    }

    const userId = req.user!.userId;
    const memberPodIds = new Set(
      (
        await prisma.podMember.findMany({
          where: { userId, podId: { in: result.map((p) => p.id) } },
          select: { podId: true },
        })
      ).map((m) => m.podId)
    );

    res.json(
      result.map((p) => {
        const parsed = parsePodMembers(p);
        if (!memberPodIds.has(p.id)) return approximateCoords(parsed);
        return parsed;
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/join
// Body option A – join a specific existing pod:  { podId }
// Body option B – create a brand new pod:         { activityId }
router.post('/join', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { podId, activityId } = req.body;

  if (!podId && !activityId) {
    res.status(400).json({ error: 'podId or activityId is required' });
    return;
  }

  try {
    // ── Option A: join a specific pod ─────────────────────────────────────────
    if (podId) {
      const result = await joinExistingPodMember(userId, podId);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.status(201).json(parsePodMembers(result.updatedPod));
      return;
    }

    // ── Option B: create a new pod for an activity ───────────────────────────
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    // Check user is not already in an active pod for this activity
    const existingMembership = await prisma.podMember.findFirst({
      where: {
        userId,
        pod: {
          activityId,
          status: { in: [FORMING, LOCKED] },
        },
      },
    });

    if (existingMembership) {
      res.status(409).json({ error: 'You are already in an active pod for this activity' });
      return;
    }

    const minMembers = Math.max(2, Math.min(10, Number(req.body.minMembers) || 2));
    const maxMembers = Math.max(minMembers, Math.min(10, Number(req.body.maxMembers) || 4));
    const locationInput = typeof req.body.location === 'string' ? req.body.location.trim() : '';
    const visibilityInput =
      typeof req.body.visibility === 'string'
        ? req.body.visibility.trim().toLowerCase()
        : typeof req.body.locationType === 'string'
          ? req.body.locationType.trim().toLowerCase()
          : PUBLIC_LOCATION_TYPE;

    if (![PUBLIC_LOCATION_TYPE, PRIVATE_LOCATION_TYPE].includes(visibilityInput)) {
      res.status(400).json({ error: 'visibility must be public or private' });
      return;
    }

    if (!locationInput) {
      res.status(400).json({ error: 'Location is required. Please select a location before creating a pod.' });
      return;
    }
    if (locationInput.length > MAX_LOCATION_LENGTH) {
      res.status(400).json({ error: `Location cannot exceed ${MAX_LOCATION_LENGTH} characters` });
      return;
    }

    const moderation = await moderateTextContent([locationInput]);
    if (moderation) {
      res.status(moderation.status).json({ error: moderation.message });
      return;
    }

    // Optional coordinates
    const rawLat = req.body.latitude != null ? parseFloat(req.body.latitude) : null;
    const rawLng = req.body.longitude != null ? parseFloat(req.body.longitude) : null;
    const hasCoords = rawLat !== null && rawLng !== null && !isNaN(rawLat) && !isNaN(rawLng);

    if (hasCoords && !isInsideCampus(rawLat!, rawLng!)) {
      res.status(400).json({ error: 'Location must be on or near OSU campus' });
      return;
    }

    let meetupTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (req.body.meetupTime) {
      const parsed = new Date(req.body.meetupTime);
      if (isNaN(parsed.getTime())) {
        res.status(400).json({ error: 'Invalid meetupTime' });
        return;
      }
      const now = new Date();
      const maxTime = getMaxMeetupTime();
      if (parsed <= now) {
        res.status(400).json({ error: 'Meetup time must be in the future' });
        return;
      }
      if (parsed > maxTime) {
        res.status(400).json({ error: 'Meetup time cannot be more than 1 week from now' });
        return;
      }
      meetupTime = parsed;
    }

    // Only enforce the location allowlist when the user did NOT pick coordinates on a map
    // (map already constrains to campus; allowlist is for the old chip-picker flow)
    if (!hasCoords) {
      let allowed = getLocationsForCategory(activity.category);
      if (activity.defaultLocation && !allowed.includes(activity.defaultLocation)) {
        allowed = [activity.defaultLocation, ...allowed];
      }
      if (allowed.length > 0 && !allowed.includes(locationInput)) {
        res.status(400).json({
          error: 'Invalid location. Must be from the activity category list.',
        });
        return;
      }
    }

    // No pin dropped: fill coordinates from the named-location table so
    // suggested-spot and template pods still show up on the map. Table entries
    // are verified on-campus by locations.test.ts, so no fence re-check needed.
    const namedCoords = hasCoords ? null : getCoordinatesForLocation(locationInput);

    const newPod = await prisma.pod.create({
      data: {
        activityId,
        meetupTime,
        location: locationInput,
        locationType: visibilityInput,
        minMembers,
        maxMembers,
        status: FORMING,
        creatorId: userId,
        latitude: hasCoords ? rawLat : namedCoords?.latitude ?? null,
        longitude: hasCoords ? rawLng : namedCoords?.longitude ?? null,
      },
    });

    await prisma.podMember.create({ data: { podId: newPod.id, userId } });

    // Demand pool: only public pods count as supply — a private pod must not
    // consume the pool or deep-link strangers to it. Fire-and-forget so pushes
    // never delay the create response.
    if (visibilityInput !== PRIVATE_LOCATION_TYPE) {
      NotificationService.notifyDemandPoolPodCreated(
        activityId,
        newPod.id,
        userId,
        newPod.meetupTime,
      ).catch(() => {});
    }

    // Twin pods: tell the original pod's waitlist a second pod just opened.
    const twinFromPodId =
      typeof req.body.twinFromPodId === 'string' ? req.body.twinFromPodId : null;
    if (twinFromPodId && visibilityInput !== PRIVATE_LOCATION_TYPE) {
      const twinSource = await prisma.pod.findUnique({
        where: { id: twinFromPodId },
        select: { activityId: true },
      });
      if (twinSource?.activityId === activityId) {
        NotificationService.notifyWaitlistTwin(twinFromPodId, newPod.id, userId).catch(() => {});
      }
    }

    const updatedPod = await prisma.pod.findUnique({
      where: { id: newPod.id },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: MEMBER_USER_SELECT } } },
      },
    });

    res.status(201).json(updatedPod ? parsePodMembers(updatedPod) : updatedPod);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /pods/:id/privacy - creator only; controls discovery visibility
router.patch('/:id/privacy', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const visibility =
    typeof req.body.visibility === 'string'
      ? req.body.visibility.trim().toLowerCase()
      : typeof req.body.locationType === 'string'
        ? req.body.locationType.trim().toLowerCase()
        : undefined;

  if (!visibility || ![PUBLIC_LOCATION_TYPE, PRIVATE_LOCATION_TYPE].includes(visibility)) {
    res.status(400).json({ error: 'visibility must be public or private' });
    return;
  }

  try {
    const pod = await prisma.pod.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    const creatorId = pod.creatorId ?? pod.members.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0]?.userId;
    if (creatorId !== userId) {
      res.status(403).json({ error: 'Only the pod creator can change pod privacy' });
      return;
    }

    if (pod.status === COMPLETED || pod.status === EXPIRED) {
      res.status(409).json({ error: 'Cannot change privacy for a completed or expired pod' });
      return;
    }

    const updated = await prisma.pod.update({
      where: { id },
      data: { locationType: visibility },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: MEMBER_USER_SELECT } } },
      },
    });

    res.json(parsePodMembers(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/lock – creator only; lock when memberCount >= minMembers
router.post('/:id/lock', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const pod = await prisma.pod.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }
    const creatorId = pod.creatorId ?? pod.members.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0]?.userId;
    if (creatorId !== userId) {
      res.status(403).json({ error: 'Only the pod creator can lock the pod' });
      return;
    }
    if (pod.status !== FORMING) {
      res.status(409).json({ error: 'Pod is already locked or completed' });
      return;
    }
    if (pod.members.length < pod.minMembers) {
      res.status(400).json({ error: `Need at least ${pod.minMembers} members to lock` });
      return;
    }

    const updated = await prisma.pod.update({
      where: { id },
      data: { status: LOCKED },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: MEMBER_USER_SELECT } } },
      },
    });
    res.json(parsePodMembers(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/leave – remove current user from pod; disband if empty
router.post('/:id/leave', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const pod = await prisma.pod.findUnique({
      where: { id },
      include: { members: true, activity: { select: { title: true } } },
    });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    const membership = pod.members.find((m) => m.userId === userId);
    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this pod' });
      return;
    }

    let podDeleted = false;
    const wasLocked = pod.status === LOCKED;

    await prisma.$transaction(async (tx) => {
      await tx.podMember.delete({ where: { id: membership.id } });
      const remainingCount = await tx.podMember.count({ where: { podId: id } });
      if (remainingCount === 0) {
        await tx.message.deleteMany({ where: { podId: id } });
        await tx.pod.delete({ where: { id } });
        podDeleted = true;
      } else {
        const updates: Record<string, unknown> = {};
        if (pod.creatorId === userId) {
          const nextCreator = await tx.podMember.findFirst({
            where: { podId: id },
            orderBy: { joinedAt: 'asc' },
          });
          if (nextCreator) updates.creatorId = nextCreator.userId;
        }
        // Business rule: a LOCKED pod requires all members to have confirmed.
        // If anyone leaves after locking, the pod drops back to FORMING so the
        // remaining members can invite/wait for a replacement before re-locking.
        if (wasLocked) updates.status = FORMING;
        if (Object.keys(updates).length > 0) {
          await tx.pod.update({ where: { id }, data: updates });
        }
      }
    });

    if (podDeleted) {
      res.json({ left: true, podDeleted: true });
      return;
    }

    // Notify first waitlisted user that a spot opened up (fire-and-forget)
    NotificationService.notifyWaitlistSpot(id, pod.activity?.title).catch(() => {});

    const updatedPod = await prisma.pod.findUnique({
      where: { id },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: MEMBER_USER_SELECT } } },
      },
    });
    res.json({ left: true, podDeleted: false, pod: updatedPod ? parsePodMembers(updatedPod) : updatedPod });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/unlock – creator only; unlock when memberCount < maxMembers
router.post('/:id/unlock', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const pod = await prisma.pod.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }
    const creatorId = pod.creatorId ?? pod.members.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0]?.userId;
    if (creatorId !== userId) {
      res.status(403).json({ error: 'Only the pod creator can unlock the pod' });
      return;
    }
    if (pod.status !== LOCKED) {
      res.status(409).json({ error: 'Pod is not locked' });
      return;
    }
    if (pod.members.length >= pod.maxMembers) {
      res.status(400).json({ error: 'Cannot unlock a full pod' });
      return;
    }

    const updated = await prisma.pod.update({
      where: { id },
      data: { status: FORMING },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: MEMBER_USER_SELECT } } },
      },
    });
    res.json(parsePodMembers(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /pods/:id — creator only; edit meetup time, location, and coordinates
router.patch('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const pod = await prisma.pod.findUnique({
      where: { id },
      include: { members: true, activity: true },
    });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }
    const creatorId =
      pod.creatorId ??
      pod.members.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0]?.userId;
    if (creatorId !== userId) {
      res.status(403).json({ error: 'Only the pod creator can edit the pod' });
      return;
    }
    if (pod.status !== FORMING && pod.status !== LOCKED) {
      res.status(409).json({ error: 'Completed, expired, or cancelled pods cannot be edited' });
      return;
    }

    const data: Record<string, unknown> = {};

    if (req.body.meetupTime != null) {
      const parsed = new Date(req.body.meetupTime);
      if (isNaN(parsed.getTime())) {
        res.status(400).json({ error: 'Invalid meetupTime' });
        return;
      }
      if (parsed <= new Date()) {
        res.status(400).json({ error: 'Meetup time must be in the future' });
        return;
      }
      if (parsed > getMaxMeetupTime()) {
        res.status(400).json({ error: 'Meetup time cannot be more than 1 week from now' });
        return;
      }
      data.meetupTime = parsed;
    }

    if (req.body.location != null) {
      const locationInput = typeof req.body.location === 'string' ? req.body.location.trim() : '';
      if (!locationInput) {
        res.status(400).json({ error: 'Location cannot be empty' });
        return;
      }
      if (locationInput.length > MAX_LOCATION_LENGTH) {
        res.status(400).json({ error: `Location cannot exceed ${MAX_LOCATION_LENGTH} characters` });
        return;
      }
      const moderation = await moderateTextContent([locationInput]);
      if (moderation) {
        res.status(moderation.status).json({ error: moderation.message });
        return;
      }
      data.location = locationInput;
    }

    const rawLat = req.body.latitude != null ? parseFloat(req.body.latitude) : null;
    const rawLng = req.body.longitude != null ? parseFloat(req.body.longitude) : null;
    const hasCoords = rawLat !== null && rawLng !== null && !isNaN(rawLat) && !isNaN(rawLng);
    if (hasCoords) {
      if (!isInsideCampus(rawLat!, rawLng!)) {
        res.status(400).json({ error: 'Location must be on or near OSU campus' });
        return;
      }
      data.latitude = rawLat;
      data.longitude = rawLng;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'Nothing to update' });
      return;
    }

    const updated = await prisma.pod.update({
      where: { id },
      data,
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: MEMBER_USER_SELECT } } },
      },
    });

    NotificationService.notifyPodPlanChange(id, userId, 'updated').catch(() => {});

    res.json(parsePodMembers(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/cancel — creator only; cancels a forming or locked pod
router.post('/:id/cancel', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const pod = await prisma.pod.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }
    const creatorId =
      pod.creatorId ??
      pod.members.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0]?.userId;
    if (creatorId !== userId) {
      res.status(403).json({ error: 'Only the pod creator can cancel the pod' });
      return;
    }
    if (pod.status !== FORMING && pod.status !== LOCKED) {
      res.status(409).json({ error: 'Only forming or locked pods can be cancelled' });
      return;
    }

    const memberUserIds = pod.members.map((m) => m.userId);

    const updated = await prisma.pod.update({
      where: { id },
      data: { status: CANCELLED },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: MEMBER_USER_SELECT } } },
      },
    });

    NotificationService.notifyPodPlanChange(id, userId, 'cancelled', memberUserIds).catch(() => {});

    res.json(parsePodMembers(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/kick/:memberId — creator-only member removal
router.post('/:id/kick/:memberId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id, memberId } = req.params;

  try {
    const pod = await prisma.pod.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    const creatorId = pod.creatorId ?? pod.members.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0]?.userId;
    if (creatorId !== userId) {
      res.status(403).json({ error: 'Only the pod creator can remove members' });
      return;
    }
    if (memberId === userId) {
      res.status(400).json({ error: 'Use the leave endpoint to leave your own pod' });
      return;
    }
    if (pod.status === COMPLETED || pod.status === EXPIRED) {
      res.status(409).json({ error: 'Cannot remove members from a completed or expired pod' });
      return;
    }

    const membership = pod.members.find((m) => m.userId === memberId);
    if (!membership) {
      res.status(404).json({ error: 'User is not a member of this pod' });
      return;
    }

    const wasLocked = pod.status === LOCKED;

    await prisma.$transaction(async (tx) => {
      await tx.podMember.delete({ where: { id: membership.id } });
      if (wasLocked) {
        await tx.pod.update({ where: { id }, data: { status: FORMING } });
      }
    });

    const updatedPod = await prisma.pod.findUnique({
      where: { id },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: { include: { user: { select: MEMBER_USER_SELECT } } },
      },
    });
    res.json(updatedPod ? parsePodMembers(updatedPod) : updatedPod);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /pods/:id/typing
router.post('/:id/typing', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id: podId } = req.params;
  const userId = req.user!.userId;
  try {
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      include: { members: true },
    });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }
    const membership = pod.members.find((m) => m.userId === userId);
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this pod' });
      return;
    }
    setTyping('pod', podId, userId);
    void broadcast(podTopic(podId), REALTIME_EVENTS.TYPING);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods/:id/public — unauthenticated share preview for landing / deep links
router.get('/:id/public', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    await expireOldPods();

    const pod = await prisma.pod.findUnique({
      where: { id },
      include: {
        activity: { select: { title: true, category: true } },
        _count: { select: { members: true } },
      },
    });

    if (!pod?.activity) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.status === EXPIRED) {
      res.json({ expired: true, podName: pod.activity.title });
      return;
    }

    const title = pod.activity.title;
    const category = pod.activity.category;
    res.json({
      expired: false,
      podName: title,
      activityName: title,
      activityEmoji: getActivityEmoji(title, category),
      meetupTime: pod.meetupTime.toISOString(),
      location: pod.location,
      memberCount: pod._count.members,
      maxMembers: pod.maxMembers,
      status: pod.status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.userId;

  const memberInclude = {
    include: { user: { select: MEMBER_USER_SELECT } },
  };

  try {
    await expireOldPods();

    const nowAccess = new Date();
    let pod = await prisma.pod.findFirst({
      where: {
        id,
        OR: [
          { members: { some: { userId } } },
          {
            AND: [
              { status: { notIn: [EXPIRED, COMPLETED] } },
              { meetupTime: { gt: nowAccess } },
            ],
          },
        ],
      },
      include: {
        activity: true,
        creator: { select: { id: true } },
        members: memberInclude,
      },
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    // Hide pod if any member has blocking relationship with current user
    for (const m of pod.members) {
      if (await hasBlockingRelationship(userId, m.userId)) {
        res.status(404).json({ error: 'Pod not found' });
        return;
      }
    }

    // Lazy COMPLETED transition (skip if already expired)
    if (pod.status === LOCKED && pod.meetupTime < new Date()) {
      pod = await prisma.pod.update({
        where: { id },
        data: { status: COMPLETED },
        include: {
          activity: true,
          creator: { select: { id: true } },
          members: memberInclude,
        },
      });
    }

    // Include no-show user IDs + recap data for completed pods
    const [noShowUserIds, averageRating, myRecap] =
      pod.status === COMPLETED
        ? await Promise.all([
            prisma.noShowReport
              .findMany({
                where: { podId: id },
                select: { targetUserId: true },
                distinct: ['targetUserId'],
              })
              .then((r) => r.map((x) => x.targetUserId)),
            prisma.podRecap
              .aggregate({ where: { podId: id }, _avg: { rating: true } })
              .then((r) => r._avg.rating),
            prisma.podRecap.findUnique({
              where: { podId_userId: { podId: id, userId } },
            }),
          ])
        : [[], null, null];

    // Waitlist info
    const [waitlistCount, myWaitlistEntry] = await Promise.all([
      prisma.podWaitlist.count({ where: { podId: id, status: 'WAITING' } }),
      prisma.podWaitlist.findUnique({ where: { podId_userId: { podId: id, userId } } }),
    ]);
    const myWaitlistPosition =
      myWaitlistEntry && (myWaitlistEntry.status === 'WAITING' || myWaitlistEntry.status === 'NOTIFIED')
        ? myWaitlistEntry.position
        : null;

    const isMember = pod.members.some((m) => m.userId === userId);
    const podData = parsePodMembers({
      ...pod,
      noShowUserIds,
      averageRating,
      myRecap,
      waitlistCount,
      myWaitlistPosition,
    });

    res.json(isMember ? podData : approximateCoords(podData));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /pods/:id/people-you-met — confirmed attendees who are not yet friends
router.get('/:id/people-you-met', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.userId;

  try {
    const pod = await prisma.pod.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                classYear: true,
                major: true,
                interestTags: true,
              },
            },
          },
        },
      },
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.status !== COMPLETED) {
      res.status(400).json({ error: 'Pod is not completed' });
      return;
    }

    const myMember = pod.members.find((m) => m.userId === userId);
    if (!myMember || !myMember.confirmedAt) {
      res.status(403).json({ error: 'You must be a confirmed attendee of this pod' });
      return;
    }

    // Other confirmed members (not the caller)
    const confirmedOthers = pod.members.filter(
      (m) => m.userId !== userId && m.confirmedAt
    );

    if (confirmedOthers.length === 0) {
      res.json({ users: [] });
      return;
    }

    const otherUserIds = confirmedOthers.map((m) => m.userId);

    // Exclude users who are already friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userAId: userId, userBId: { in: otherUserIds } },
          { userBId: userId, userAId: { in: otherUserIds } },
        ],
      },
    });
    const friendIds = new Set(
      friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId))
    );

    // Exclude users with pending friend requests (either direction)
    const pendingRequests = await prisma.friendRequest.findMany({
      where: {
        status: 'PENDING',
        OR: [
          { senderId: userId, receiverId: { in: otherUserIds } },
          { receiverId: userId, senderId: { in: otherUserIds } },
        ],
      },
    });
    const pendingIds = new Set(
      pendingRequests.map((r) => (r.senderId === userId ? r.receiverId : r.senderId))
    );

    // Exclude no-show reported users
    const noShows = await prisma.noShowReport.findMany({
      where: { podId: id, targetUserId: { in: otherUserIds } },
      select: { targetUserId: true },
      distinct: ['targetUserId'],
    });
    const noShowIds = new Set(noShows.map((n) => n.targetUserId));

    const users = confirmedOthers
      .filter((m) => !friendIds.has(m.userId) && !pendingIds.has(m.userId) && !noShowIds.has(m.userId))
      .map((m) => {
        let interestTags: string[] = [];
        if (m.user.interestTags) {
          try { interestTags = JSON.parse(m.user.interestTags as string); } catch { /* ignore */ }
        }
        return {
          id: m.user.id,
          name: withDisplayName(m.user, 'public').name,
          avatarUrl: m.user.avatarUrl,
          classYear: m.user.classYear,
          major: m.user.major,
          interestTags,
        };
      });

    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
