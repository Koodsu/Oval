import { CURRENT_TERMS_VERSION } from './constants/legal';

// Set EXPO_PUBLIC_API_URL in your .env file (or EAS env vars for production builds).
// Only local Expo development falls back to localhost.
// On a physical device, set this to your machine's local IP, e.g. http://192.168.1.100:3000
const configuredApiBase = process.env.EXPO_PUBLIC_API_URL?.trim();
const usingLocalhostApi =
  configuredApiBase != null &&
  /(^https?:\/\/localhost(?::\d+)?$)|(^https?:\/\/127\.0\.0\.1(?::\d+)?$)/i.test(configuredApiBase);

export const API_BASE =
  configuredApiBase && !(!__DEV__ && usingLocalhostApi)
    ? configuredApiBase
    : __DEV__
      ? 'http://localhost:3000'
      : 'https://ovalapp.vercel.app';
export const PUBLIC_SITE_URL = (process.env.EXPO_PUBLIC_APP_SITE_URL ?? 'https://www.theovalapp.com').replace(/\/$/, '');

// Logged once at startup so you can confirm which backend the app is actually
// talking to. If this prints http://localhost:3000 in your Metro logs while you
// expect ovalapp.vercel.app, your EXPO_PUBLIC_API_URL didn't load — restart with
// `npx expo start -c` to clear the cache.
console.log('[api] API_BASE =', API_BASE);

/** Fallback alert copy when an error has no safer or more specific message. */
export const API_USER_MESSAGE = 'We could not finish that. Please try again.';

export class ApiError extends Error {
  status?: number;
  userMessage: string;

  constructor(message: string, userMessage?: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.userMessage = userMessage ?? message;
  }
}

function messageFromData(data: unknown) {
  if (!data || typeof data !== 'object') return null;
  const error = (data as { error?: unknown }).error;
  if (typeof error === 'string' && error.trim()) return error.trim();
  const message = (data as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  return null;
}

function friendlyFailureMessage(status?: number, serverMessage?: string) {
  if (status === 401) return serverMessage ?? 'Your session has expired. Please sign in again.';
  if (status === 403) return serverMessage ?? 'You do not have permission to do that.';
  if (status === 404) return serverMessage ?? 'We could not find that item. It may have changed or been removed.';
  if (status === 409) return serverMessage ?? 'That conflicts with the latest data. Refresh and try again.';
  if (status === 429) return 'Oval is getting a lot of requests. Wait a moment, then try again.';
  if (status === 503) return 'Oval is temporarily unavailable. Try again in a minute.';
  if (status && status >= 500) return 'Oval hit a server error while trying that. Please try again in a minute.';
  return serverMessage ?? API_USER_MESSAGE;
}

export function getApiErrorMessage(error: unknown, fallback = API_USER_MESSAGE) {
  if (error instanceof ApiError) return error.userMessage || fallback;
  if (error instanceof Error) {
    if (error.name === 'AbortError') return fallback;
    if (/network request failed|failed to fetch|load failed/i.test(error.message)) {
      return 'Oval could not reach the server. Check your connection and try again.';
    }
    return error.message || fallback;
  }
  return fallback;
}

const RETRY_BACKOFF_MS = [250, 500, 1000] as const;
const MAX_RETRY_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;
const GET_CACHE_TTL_MS = 45_000;

type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

const getCache = new Map<string, CacheEntry>();

function cacheKey(path: string) {
  return `${authToken ?? 'anonymous'}:${path}`;
}

function isGetRequest(options: RequestInit) {
  return !options.method || options.method.toUpperCase() === 'GET';
}

export function clearApiCache(prefix?: string) {
  if (!prefix) {
    getCache.clear();
    return;
  }

  for (const key of getCache.keys()) {
    if (key.includes(`:${prefix}`)) {
      getCache.delete(key);
    }
  }
}

/**
 * Resolves a stored avatar path (e.g. /uploads/avatars/x.jpg) to a full URL.
 * Handles relative backend paths and already-absolute URLs.
 */
export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | undefined {
  if (!avatarUrl) return undefined;
  if (/^(https?:|file:|data:|content:|blob:)/.test(avatarUrl)) return avatarUrl;
  return `${API_BASE}${avatarUrl}`;
}

export function getPodShareUrl(podId: string, inviterUserId?: string | null): string {
  const url = `${PUBLIC_SITE_URL}/pod/${encodeURIComponent(podId)}`;
  return inviterUserId ? `${url}?ref=${encodeURIComponent(inviterUserId)}` : url;
}

export function getClubShareUrl(clubId: string): string {
  return `${PUBLIC_SITE_URL}/clubs/${encodeURIComponent(clubId)}`;
}

export function getUserProfileShareUrl(userId: string): string {
  return `${PUBLIC_SITE_URL}/users/${encodeURIComponent(userId)}`;
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setToken(token: string | null) {
  authToken = token;
  clearApiCache();
}

export function getToken(): string | null {
  return authToken;
}

/**
 * Register a callback that fires whenever a 401 is received.
 * AuthContext calls this so the API layer can trigger sign-out
 * without a circular dependency.
 */
export function setOnUnauthorized(cb: (() => void) | null) {
  onUnauthorized = cb;
}

async function request<T>(path: string, options: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  if (!API_BASE) {
    const message = 'App config error: EXPO_PUBLIC_API_URL is missing or invalid for this production build.';
    console.error(`[api] ${message}`);
    throw new Error(message);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const sentAuthToken = authToken;
  if (sentAuthToken) {
    headers['Authorization'] = `Bearer ${sentAuthToken}`;
  }

  const isGet = isGetRequest(options);
  // App data is shared and changes outside this device, so reads are fresh by
  // default. A genuinely immutable endpoint may explicitly opt into the short
  // in-memory cache with `cache: 'force-cache'`.
  const shouldUseCache = isGet && options.cache === 'force-cache';
  const requestOptions: RequestInit =
    isGet && options.cache == null ? { ...options, cache: 'no-store' } : options;
  const key = shouldUseCache ? cacheKey(path) : null;
  if (key) {
    const cached = getCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
  } else if (!isGet) {
    clearApiCache();
  }

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    if (signal?.aborted) {
      const e = new Error('Aborted');
      e.name = 'AbortError';
      throw e;
    }

    let res: Response;
    let data: unknown;
    // Per-attempt timeout so a hung connection surfaces a real error instead of
    // spinning forever. We abort via our own controller and chain any external
    // signal into it, so callers can still cancel.
    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', onExternalAbort);
    }
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...requestOptions,
        headers,
        signal: controller.signal,
      });
      if (res.status === 204) {
        data = {};
      } else {
        const body = await res.text();
        try {
          data = body ? JSON.parse(body) : {};
        } catch {
          data = body ? { error: body } : {};
        }
      }
    } catch (err) {
      // External cancellation by the caller — propagate as an abort.
      if (signal?.aborted) {
        const e = new Error('Aborted');
        e.name = 'AbortError';
        throw e;
      }
      // Our timeout fired.
      if (controller.signal.aborted) {
        throw new ApiError(
          `Request timed out after ${REQUEST_TIMEOUT_MS}ms`,
          'Oval could not reach the server. Check your connection and try again.'
        );
      }
      throw new ApiError(
        err instanceof Error ? err.message : 'Network request failed',
        'Oval could not reach the server. Check your connection and try again.'
      );
    } finally {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onExternalAbort);
    }

    if (res.status === 401) {
      if (sentAuthToken) {
        onUnauthorized?.();
      }
      const serverMessage = messageFromData(data) ?? 'Unauthorized';
      throw new ApiError(serverMessage, friendlyFailureMessage(res.status, serverMessage), res.status);
    }

    if (res.ok) {
      if (key) {
        getCache.set(key, {
          data,
          expiresAt: Date.now() + GET_CACHE_TTL_MS,
        });
      }
      return data as T;
    }

    const retryable = res.status === 429 || res.status === 503;
    if (retryable && attempt < MAX_RETRY_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
      continue;
    }

    if (retryable) {
      throw new ApiError(`Request failed: ${res.status}`, friendlyFailureMessage(res.status), res.status);
    }

    const serverMessage = messageFromData(data) ?? `Request failed: ${res.status}`;
    throw new ApiError(serverMessage, friendlyFailureMessage(res.status, serverMessage), res.status);
  }

  throw new ApiError('Request failed after retries', API_USER_MESSAGE);
}

// Auth
export const register = (
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  classYear: string,
  major: string
) =>
  request<{ token: string; user: import('./types').User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName,
      lastName,
      email,
      password,
      classYear,
      major,
      termsAccepted: true,
      ageConfirmed: true,
      termsVersion: CURRENT_TERMS_VERSION,
    }),
  });

export const login = (email: string, password: string) =>
  request<{ token: string; user: import('./types').User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const requestPasswordReset = (email: string) =>
  request<{ message: string }>('/auth/request-password-reset', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const resetPassword = (email: string, code: string, password: string) =>
  request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, password }),
  });

export const verifyEmail = async (code: string) => {
  const result = await request<{ user: import('./types').User }>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  void trackEvent('verify.completed');
  return result;
};

export const resendVerification = () =>
  request<{ message: string }>('/auth/resend-verification', { method: 'POST' });

export const acceptCurrentTerms = () =>
  request<{ user: import('./types').User }>('/auth/accept-terms', {
    method: 'POST',
    body: JSON.stringify({
      termsAccepted: true,
      ageConfirmed: true,
      termsVersion: CURRENT_TERMS_VERSION,
    }),
  });

// Activities
export const getActivities = (category?: string, signal?: AbortSignal) =>
  request<import('./types').Activity[]>(
    category ? `/activities?category=${encodeURIComponent(category)}` : '/activities',
    {},
    signal
  );

export const requestActivity = (body: {
  title: string;
  category: string;
  description?: string;
  defaultLocation?: string;
}) =>
  request<import('./types').ActivityRequest>('/activities/requests', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const signalActivityDemand = (activityId: string) =>
  request<{ id: string; activityId: string; expiresAt: string; demandCount: number; myDemanded: boolean }>(
    `/activities/${encodeURIComponent(activityId)}/demand`,
    { method: 'POST' }
  );

export const clearActivityDemand = (activityId: string) =>
  request<{ removed: boolean; activityId: string; demandCount: number; myDemanded: boolean }>(
    `/activities/${encodeURIComponent(activityId)}/demand`,
    { method: 'DELETE' }
  );

export const getAdminActivityRequests = (
  status: 'pending' | 'reviewed' = 'pending',
  signal?: AbortSignal,
) =>
  request<{ requests: import('./types').ActivityRequest[] }>(
    `/admin/activity-requests${status === 'reviewed' ? '?status=reviewed' : ''}`,
    {},
    signal
  );

export const approveActivityRequest = (requestId: string) =>
  request<{ request: import('./types').ActivityRequest; activity: import('./types').Activity }>(
    `/admin/activity-requests/${encodeURIComponent(requestId)}/approve`,
    { method: 'POST' }
  );

export const rejectActivityRequest = (requestId: string, reviewNote?: string) =>
  request<{ request: import('./types').ActivityRequest }>(
    `/admin/activity-requests/${encodeURIComponent(requestId)}/reject`,
    { method: 'POST', body: JSON.stringify({ reviewNote }) }
  );

// Clubs
export const getClubs = (
  params?: { category?: string; search?: string },
  signal?: AbortSignal
) => {
  const q = new URLSearchParams();
  if (params?.category?.trim()) q.set('category', params.category.trim());
  if (params?.search?.trim()) q.set('search', params.search.trim());
  const qs = q.toString();
  return request<import('./types').ClubDirectoryEntry[]>(qs ? `/clubs?${qs}` : '/clubs', {}, signal);
};

export const getClubsToday = (signal?: AbortSignal) =>
  request<import('./types').ClubMeetingToday[]>('/clubs/today', {}, signal);

export const getClubsWeek = (signal?: AbortSignal) =>
  request<import('./types').ClubMeetingToday[]>('/clubs/week', {}, signal);

export const getMyClubs = (signal?: AbortSignal) =>
  request<import('./types').MyClubMembershipRow[]>('/clubs/my', {}, signal);

export const joinClub = async (clubId: string) => {
  const result = await request<{ ok: true }>(`/clubs/${encodeURIComponent(clubId)}/join`, {
    method: 'POST',
  });
  void trackEvent('club.joined', { clubId });
  return result;
};

export const leaveClub = (clubId: string) =>
  request<{ ok: true }>(`/clubs/${encodeURIComponent(clubId)}/leave`, { method: 'DELETE' });

export const deleteClub = (clubId: string) =>
  request<{ ok: true }>(`/clubs/${encodeURIComponent(clubId)}`, { method: 'DELETE' });

export const getClub = (clubId: string, signal?: AbortSignal) =>
  request<import('./types').ClubDetail>(`/clubs/${encodeURIComponent(clubId)}`, {}, signal);

export interface CreateClubBody {
  name: string;
  description: string;
  category: string;
  emoji: string;
  discoveryPreference?: 'CAMPUS' | 'INVITE_ONLY';
}

export const createClub = (body: CreateClubBody) =>
  request<import('./types').ClubDetail>('/clubs', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const startClubVerification = (
  clubId: string,
  body: { method: 'INSTAGRAM' | 'OFFICIAL_EMAIL'; handle?: string; email?: string }
) =>
  request<import('./types').ClubClaim>(`/clubs/${encodeURIComponent(clubId)}/claims`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const markClubVerificationSent = (clubId: string, claimId: string) =>
  request<{ ok: true; status: string }>(
    `/clubs/${encodeURIComponent(clubId)}/claims/${encodeURIComponent(claimId)}/sent`,
    { method: 'POST' }
  );

export const createClubInvite = (
  clubId: string,
  body: { maxUses?: number; expiresInHours?: number } = {}
) =>
  request<import('./types').ClubInvite>(`/clubs/${encodeURIComponent(clubId)}/invites`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const followClub = (clubId: string) =>
  request<{ ok: true; isFollower: boolean; followerCount: number }>(
    `/clubs/${encodeURIComponent(clubId)}/follow`,
    { method: 'POST' }
  );

export const unfollowClub = (clubId: string) =>
  request<{ ok: true; isFollower: boolean; followerCount: number }>(
    `/clubs/${encodeURIComponent(clubId)}/follow`,
    { method: 'DELETE' }
  );

export const setClubDiscovery = (clubId: string, isDiscoverable: boolean) =>
  request<{ ok: true; isDiscoverable: boolean }>(
    `/clubs/${encodeURIComponent(clubId)}/discovery`,
    { method: 'PATCH', body: JSON.stringify({ isDiscoverable }) }
  );

// ── Club applications ─────────────────────────────────────────────────────────

export const getApplyInfo = (clubId: string, signal?: AbortSignal) =>
  request<import('./types').ApplyInfo>(`/clubs/${encodeURIComponent(clubId)}/apply`, {}, signal);

export const submitApplication = (clubId: string, cycleId: string, answers: string[]) =>
  request<{ id: string; stage: string }>(
    `/clubs/${encodeURIComponent(clubId)}/application-cycles/${encodeURIComponent(cycleId)}/apply`,
    { method: 'POST', body: JSON.stringify({ answers }) }
  );

export const getApplicationCycles = (clubId: string, signal?: AbortSignal) =>
  request<import('./types').ClubApplicationCycle[]>(
    `/clubs/${encodeURIComponent(clubId)}/application-cycles`,
    {},
    signal
  );

export const createApplicationCycle = (
  clubId: string,
  body: { title: string; questions: string[]; closesAt?: string | null }
) =>
  request<import('./types').ClubApplicationCycle>(
    `/clubs/${encodeURIComponent(clubId)}/application-cycles`,
    { method: 'POST', body: JSON.stringify(body) }
  );

export const updateApplicationCycle = (
  clubId: string,
  cycleId: string,
  body: {
    title?: string;
    questions?: string[];
    status?: 'OPEN' | 'CLOSED';
    closesAt?: string | null;
  }
) =>
  request<import('./types').ClubApplicationCycle>(
    `/clubs/${encodeURIComponent(clubId)}/application-cycles/${encodeURIComponent(cycleId)}`,
    { method: 'PATCH', body: JSON.stringify(body) }
  );

export const getCycleApplications = (clubId: string, cycleId: string, signal?: AbortSignal) =>
  request<import('./types').CycleApplications>(
    `/clubs/${encodeURIComponent(clubId)}/application-cycles/${encodeURIComponent(cycleId)}/applications`,
    {},
    signal
  );

export const updateApplication = (
  clubId: string,
  applicationId: string,
  body: { stage: 'APPLIED' | 'INTERVIEW' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'; reviewNote?: string }
) =>
  request<{ ok: true; stage: string }>(
    `/clubs/${encodeURIComponent(clubId)}/applications/${encodeURIComponent(applicationId)}`,
    { method: 'PATCH', body: JSON.stringify(body) }
  );

export const withdrawClubApplication = (clubId: string, applicationId: string) =>
  request<{ ok: true; stage: 'WITHDRAWN' }>(
    `/clubs/${encodeURIComponent(clubId)}/applications/${encodeURIComponent(applicationId)}/withdraw`,
    { method: 'PATCH' },
  );

export const getClubMeetings = (clubId: string, signal?: AbortSignal) =>
  request<import('./types').ClubMeetingWithMeta[]>(
    `/clubs/${encodeURIComponent(clubId)}/meetings`,
    {},
    signal
  );

export interface GetClubMessagesResponse {
  messages: import('./types').ClubMessage[];
  typingUserIds: string[];
}

export interface GetClubOfficerMessagesResponse {
  messages: import('./types').ClubOfficerMessage[];
  typingUserIds: string[];
}

export const getClubMessages = (clubId: string, signal?: AbortSignal) =>
  request<GetClubMessagesResponse>(
    `/clubs/${encodeURIComponent(clubId)}/messages`,
    { cache: 'no-store' },
    signal,
  );

export const sendClubMessage = (clubId: string, content: string) =>
  request<import('./types').ClubMessage>(`/clubs/${encodeURIComponent(clubId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });

export const deleteClubMessage = (clubId: string, messageId: string) =>
  request<{ ok: true }>(
    `/clubs/${encodeURIComponent(clubId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' }
  );

export const sendClubTyping = (clubId: string) =>
  request<{ ok: boolean }>(`/clubs/${encodeURIComponent(clubId)}/typing`, { method: 'POST' });

export const getClubOfficerMessages = (clubId: string, signal?: AbortSignal) =>
  request<GetClubOfficerMessagesResponse>(
    `/clubs/${encodeURIComponent(clubId)}/officer-messages`,
    { cache: 'no-store' },
    signal
  );

export const sendClubOfficerMessage = (clubId: string, content: string) =>
  request<import('./types').ClubOfficerMessage>(
    `/clubs/${encodeURIComponent(clubId)}/officer-messages`,
    { method: 'POST', body: JSON.stringify({ content }) }
  );

export const deleteClubOfficerMessage = (clubId: string, messageId: string) =>
  request<{ ok: true }>(
    `/clubs/${encodeURIComponent(clubId)}/officer-messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' }
  );

export const sendClubOfficerTyping = (clubId: string) =>
  request<{ ok: boolean }>(`/clubs/${encodeURIComponent(clubId)}/officer-typing`, { method: 'POST' });

export const promoteClubMember = (clubId: string, memberUserId: string) =>
  request<import('./types').ClubMemberWithUser>(
    `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberUserId)}/promote`,
    { method: 'POST' }
  );

export const getClubAnnouncements = (
  clubId: string,
  params?: { page?: number; limit?: number },
  signal?: AbortSignal
) => {
  const q = new URLSearchParams();
  if (params?.page != null) q.set('page', String(params.page));
  if (params?.limit != null) q.set('limit', String(params.limit));
  const qs = q.toString();
  return request<import('./types').GetClubAnnouncementsResponse>(
    qs
      ? `/clubs/${encodeURIComponent(clubId)}/announcements?${qs}`
      : `/clubs/${encodeURIComponent(clubId)}/announcements`,
    {},
    signal
  );
};

export const postClubAnnouncement = (clubId: string, content: string) =>
  request<import('./types').ClubAnnouncementRow>(
    `/clubs/${encodeURIComponent(clubId)}/announcements`,
    { method: 'POST', body: JSON.stringify({ content }) }
  );

export type ClubVisibility = 'PUBLIC' | 'MEMBERS' | 'OFFICERS';

export const createClubAnnouncement = (
  clubId: string,
  body: {
    content: string;
    visibility: ClubVisibility;
    targetRoleIds?: string[];
    meetingId?: string | null;
    notifyMembers?: boolean;
  }
) =>
  request<import('./types').ClubAnnouncementRow>(
    `/clubs/${encodeURIComponent(clubId)}/announcements`,
    { method: 'POST', body: JSON.stringify(body) }
  );

export const deleteClubAnnouncement = (clubId: string, announcementId: string) =>
  request<{ ok: true }>(
    `/clubs/${encodeURIComponent(clubId)}/announcements/${encodeURIComponent(announcementId)}`,
    { method: 'DELETE' }
  );

export const patchClubMemberRole = (
  clubId: string,
  memberUserId: string,
  body: { role: 'ADMIN' | 'OFFICER' | 'MEMBER' }
) =>
  request<import('./types').ClubMemberWithUser>(
    `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberUserId)}`,
    { method: 'PATCH', body: JSON.stringify(body) }
  );

export const getClubRoles = (clubId: string) =>
  request<import('./types').ClubRole[]>(`/clubs/${encodeURIComponent(clubId)}/roles`);

export interface ClubRoleBody {
  name?: string;
  color?: import('./types').ClubRoleColor | null;
  isSelfAssignable?: boolean;
}

export const createClubRole = (clubId: string, body: string | ClubRoleBody) =>
  request<import('./types').ClubRole>(
    `/clubs/${encodeURIComponent(clubId)}/roles`,
    { method: 'POST', body: JSON.stringify(typeof body === 'string' ? { name: body } : body) }
  );

export const updateClubRole = (clubId: string, roleId: string, body: string | ClubRoleBody) =>
  request<import('./types').ClubRole>(
    `/clubs/${encodeURIComponent(clubId)}/roles/${encodeURIComponent(roleId)}`,
    { method: 'PATCH', body: JSON.stringify(typeof body === 'string' ? { name: body } : body) }
  );

export const reorderClubRoles = (clubId: string, roleIds: string[]) =>
  request<{ roleIds: string[] }>(
    `/clubs/${encodeURIComponent(clubId)}/roles/reorder`,
    { method: 'PATCH', body: JSON.stringify({ roleIds }) },
  );

export const selfAssignClubRole = (clubId: string, roleId: string) =>
  request<{ ok: true }>(
    `/clubs/${encodeURIComponent(clubId)}/roles/${encodeURIComponent(roleId)}/self`,
    { method: 'POST' }
  );

export const selfUnassignClubRole = (clubId: string, roleId: string) =>
  request<{ ok: true }>(
    `/clubs/${encodeURIComponent(clubId)}/roles/${encodeURIComponent(roleId)}/self`,
    { method: 'DELETE' }
  );

// ── Club channels ─────────────────────────────────────────────────────────────

export interface GetClubChannelsResponse {
  channels: import('./types').ClubChannelRow[];
}

export const getClubChannels = (clubId: string, signal?: AbortSignal) =>
  request<GetClubChannelsResponse>(`/clubs/${encodeURIComponent(clubId)}/channels`, {}, signal);

export interface ClubChannelBody {
  name?: string;
  description?: string;
  allowedRoleIds?: string[];
  allowedUserIds?: string[];
}

export const createClubChannel = (clubId: string, body: ClubChannelBody) =>
  request<import('./types').ClubChannelRow>(
    `/clubs/${encodeURIComponent(clubId)}/channels`,
    { method: 'POST', body: JSON.stringify(body) }
  );

export const updateClubChannel = (clubId: string, channelId: string, body: ClubChannelBody) =>
  request<import('./types').ClubChannelRow>(
    `/clubs/${encodeURIComponent(clubId)}/channels/${encodeURIComponent(channelId)}`,
    { method: 'PATCH', body: JSON.stringify(body) }
  );

export const reorderClubChannels = (clubId: string, channelIds: string[]) =>
  request<{ channelIds: string[] }>(
    `/clubs/${encodeURIComponent(clubId)}/channels/reorder`,
    { method: 'PATCH', body: JSON.stringify({ channelIds }) },
  );

export const deleteClubChannel = (clubId: string, channelId: string) =>
  request<{ ok: true }>(
    `/clubs/${encodeURIComponent(clubId)}/channels/${encodeURIComponent(channelId)}`,
    { method: 'DELETE' }
  );

export interface GetClubChannelMessagesResponse {
  channel: import('./types').ClubChannelRow;
  messages: import('./types').ClubMessage[];
  typingUserIds: string[];
}

export const getClubChannelMessages = (clubId: string, channelId: string, signal?: AbortSignal) =>
  request<GetClubChannelMessagesResponse>(
    `/clubs/${encodeURIComponent(clubId)}/channels/${encodeURIComponent(channelId)}/messages`,
    { cache: 'no-store' },
    signal
  );

export const sendClubChannelMessage = (
  clubId: string,
  channelId: string,
  content: string,
  mentionRoleIds?: string[],
  replyToId?: string,
  imageUrl?: string,
) =>
  request<import('./types').ClubMessage>(
    `/clubs/${encodeURIComponent(clubId)}/channels/${encodeURIComponent(channelId)}/messages`,
    { method: 'POST', body: JSON.stringify({ content, mentionRoleIds, replyToId, imageUrl }) }
  );

export const uploadClubMessageImage = async (
  clubId: string,
  channelId: string,
  uri: string,
): Promise<{ imageUrl: string }> => {
  const filename = uri.split('/').pop() ?? 'club-chat-photo.jpg';
  const extension = filename.split('.').pop()?.toLowerCase();
  const type = extension === 'png'
    ? 'image/png'
    : extension === 'webp'
      ? 'image/webp'
      : 'image/jpeg';
  const formData = new FormData();
  formData.append('image', { uri, name: filename, type } as unknown as Blob);

  const headers: Record<string, string> = {};
  const sentAuthToken = authToken;
  if (sentAuthToken) headers.Authorization = `Bearer ${sentAuthToken}`;

  const res = await fetch(
    `${API_BASE}/clubs/${encodeURIComponent(clubId)}/channels/${encodeURIComponent(channelId)}/messages/media`,
    { method: 'POST', headers, body: formData },
  );
  if (res.status === 401) {
    if (sentAuthToken) onUnauthorized?.();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Upload failed: ${res.status}`);
  }
  return res.json();
};

export const addClubMessageReaction = (
  clubId: string,
  channelId: string,
  messageId: string,
  emoji: string,
) =>
  request<import('./types').ClubMessage>(
    `/clubs/${encodeURIComponent(clubId)}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/reactions`,
    { method: 'POST', body: JSON.stringify({ emoji }) },
  );

export const removeClubMessageReaction = (
  clubId: string,
  channelId: string,
  messageId: string,
  emoji: string,
) =>
  request<import('./types').ClubMessage>(
    `/clubs/${encodeURIComponent(clubId)}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/reactions?emoji=${encodeURIComponent(emoji)}`,
    { method: 'DELETE' },
  );

export const deleteClubChannelMessage = (clubId: string, channelId: string, messageId: string) =>
  request<{ ok: true }>(
    `/clubs/${encodeURIComponent(clubId)}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' }
  );

export const sendClubChannelTyping = (clubId: string, channelId: string) =>
  request<{ ok: boolean }>(
    `/clubs/${encodeURIComponent(clubId)}/channels/${encodeURIComponent(channelId)}/typing`,
    { method: 'POST' }
  );

export const markClubChannelRead = (clubId: string, channelId: string) =>
  request<{ ok: true }>(
    `/clubs/${encodeURIComponent(clubId)}/channels/${encodeURIComponent(channelId)}/read`,
    { method: 'POST' }
  );

export const deleteClubRole = (clubId: string, roleId: string) =>
  request<{ ok: true }>(
    `/clubs/${encodeURIComponent(clubId)}/roles/${encodeURIComponent(roleId)}`,
    { method: 'DELETE' }
  );

export const assignClubRole = (clubId: string, roleId: string, memberUserId: string) =>
  request<import('./types').ClubMemberWithUser>(
    `/clubs/${encodeURIComponent(clubId)}/roles/${encodeURIComponent(roleId)}/members/${encodeURIComponent(memberUserId)}`,
    { method: 'POST' }
  );

export const removeClubRole = (clubId: string, roleId: string, memberUserId: string) =>
  request<{ ok: true }>(
    `/clubs/${encodeURIComponent(clubId)}/roles/${encodeURIComponent(roleId)}/members/${encodeURIComponent(memberUserId)}`,
    { method: 'DELETE' }
  );

export const updateOfficerPermissions = (clubId: string, permissions: string[]) =>
  request<{ id: string; officerPermissions: string[] }>(
    `/clubs/${encodeURIComponent(clubId)}/officer-permissions`,
    { method: 'PATCH', body: JSON.stringify({ permissions }) }
  );

export const updateClubMemberPermissions = (
  clubId: string,
  memberUserId: string,
  permissions: string[],
) =>
  request<{ userId: string; permissions: string[] }>(
    `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberUserId)}/permissions`,
    { method: 'PATCH', body: JSON.stringify({ permissions }) },
  );

export const removeClubMember = (clubId: string, memberUserId: string) =>
  request<{ ok: true }>(
    `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberUserId)}`,
    { method: 'DELETE' }
  );

export const transferClubOwnership = (clubId: string, newOwnerUserId: string) =>
  request<import('./types').TransferClubOwnershipResponse>(
    `/clubs/${encodeURIComponent(clubId)}/transfer-ownership`,
    {
      method: 'POST',
      body: JSON.stringify({ newOwnerUserId }),
    }
  );

export const getClubOwnershipHistory = (clubId: string) =>
  request<{ items: import('./types').ClubOwnershipTransfer[] }>(
    `/clubs/${encodeURIComponent(clubId)}/ownership-history`
  );

export type ClubMeetingRsvpStatus = 'GOING' | 'MAYBE' | 'NOT_GOING';

export const rsvpClubMeeting = (meetingId: string, status: ClubMeetingRsvpStatus) =>
  request<import('./types').ClubMeetingAttendeeRow>(
    `/clubs/meetings/${encodeURIComponent(meetingId)}/rsvp`,
    { method: 'POST', body: JSON.stringify({ status }) }
  );

export interface CreateClubMeetingBody {
  title: string;
  location: string;
  meetingTime: string;
  description?: string;
  visibility?: ClubVisibility;
  targetRoleIds?: string[];
  latitude?: number;
  longitude?: number;
}

export const createClubMeeting = (clubId: string, body: CreateClubMeetingBody) =>
  request<import('./types').ClubMeetingWithMeta>(
    `/clubs/${encodeURIComponent(clubId)}/meetings`,
    { method: 'POST', body: JSON.stringify(body) }
  );

export const deleteClubMeeting = (clubId: string, meetingId: string) =>
  request<{ ok: true }>(
    `/clubs/${encodeURIComponent(clubId)}/meetings/${encodeURIComponent(meetingId)}`,
    { method: 'DELETE' }
  );

export const openClubAttendance = (clubId: string, meetingId: string) =>
  request<{ attendanceCode: string }>(
    `/clubs/${encodeURIComponent(clubId)}/meetings/${encodeURIComponent(meetingId)}/attendance/open`,
    { method: 'POST' }
  );

export const closeClubAttendance = (clubId: string, meetingId: string) =>
  request<{ ok: true }>(
    `/clubs/${encodeURIComponent(clubId)}/meetings/${encodeURIComponent(meetingId)}/attendance/close`,
    { method: 'POST' }
  );

export const checkInToClubMeeting = (clubId: string, meetingId: string, code: string) =>
  request<{ ok: true; attendedCount: number }>(
    `/clubs/${encodeURIComponent(clubId)}/meetings/${encodeURIComponent(meetingId)}/attendance/checkin`,
    { method: 'POST', body: JSON.stringify({ code }) }
  );

export const getClubMeetingAttendance = (clubId: string, meetingId: string) =>
  request<import('./types').ClubMeetingAttendanceResponse>(
    `/clubs/${encodeURIComponent(clubId)}/meetings/${encodeURIComponent(meetingId)}/attendance`
  );

export type ClubOutreachAudience =
  | { type: 'ALL' }
  | { type: 'NON_RSVP'; meetingId?: string }
  | { type: 'PRIMARY_ROLE'; role: 'OWNER' | 'ADMIN' | 'OFFICER' | 'MEMBER' }
  | { type: 'CUSTOM_ROLE'; roleId: string }
  | { type: 'MANUAL'; userIds: string[] };

export interface ClubOutreachRecipient {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
}

export interface ClubOutreachPreview {
  audience: string;
  count: number;
  recipients: ClubOutreachRecipient[];
}

export interface ClubOutreachSendResponse extends ClubOutreachPreview {
  ok: true;
  sent: number;
  attempted: number;
  sentAt: string;
}

export const previewClubOutreach = (clubId: string, audience: ClubOutreachAudience) =>
  request<ClubOutreachPreview>(
    `/clubs/${encodeURIComponent(clubId)}/outreach/preview`,
    { method: 'POST', body: JSON.stringify({ audience }) }
  );

export const sendClubOutreach = (clubId: string, audience: ClubOutreachAudience, content: string) =>
  request<ClubOutreachSendResponse>(
    `/clubs/${encodeURIComponent(clubId)}/outreach/send`,
    { method: 'POST', body: JSON.stringify({ audience, content }) }
  );

export interface ClubRsvpReminderResponse {
  ok: true;
  count: number;
  recipients: ClubOutreachRecipient[];
  sent: number;
  attempted: number;
  lastSentAt: string;
  status: string;
}

export const sendClubRsvpReminders = (clubId: string, meetingId: string) =>
  request<ClubRsvpReminderResponse>(
    `/clubs/${encodeURIComponent(clubId)}/meetings/${encodeURIComponent(meetingId)}/rsvp-reminders`,
    { method: 'POST' }
  );

// Pods
export const getMyPods = (signal?: AbortSignal) =>
  request<import('./types').Pod[]>('/pods/mine', {}, signal);

export interface InboxSummary {
  dmUnread: number;
  podUnread: number;
  invites: number;
  friendRequests: number;
  total: number;
  friendsTonight?: {
    count: number;
    avatars: Array<{ id: string; name: string; avatarUrl: string | null }>;
  };
}

export const getInboxSummary = (signal?: AbortSignal) =>
  request<InboxSummary>('/inbox/summary', { cache: 'no-store' }, signal);

export const getMyPodHistory = () =>
  request<import('./types').Pod[]>('/pods/mine/history');

export const fetchFeed = (
  params: { category?: string; limit?: number; lat?: number; lng?: number } = {},
  signal?: AbortSignal
) => {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.lat != null) query.set('lat', String(params.lat));
  if (params.lng != null) query.set('lng', String(params.lng));
  const qs = query.toString();
  return request<import('./types').Pod[]>(qs ? `/pods/feed?${qs}` : '/pods/feed', {}, signal);
};

export const getPodsByActivity = (
  activityId: string,
  sort?: string,
  coords?: { lat?: number; lng?: number }
) => {
  const params = new URLSearchParams({ activityId });
  if (sort) params.set('sort', sort);
  if (coords?.lat != null) params.set('lat', String(coords.lat));
  if (coords?.lng != null) params.set('lng', String(coords.lng));
  return request<import('./types').Pod[]>(`/pods?${params.toString()}`);
};

export const joinPod = async (podId: string) => {
  const result = await request<import('./types').Pod>('/pods/join', {
    method: 'POST',
    body: JSON.stringify({ podId }),
  });
  void trackEvent('pod.joined', { podId, activityId: result?.activityId });
  return result;
};

export interface CreatePodOptions {
  title?: string;
  note?: string;
  minMembers?: number;
  maxMembers?: number;
  meetupTime?: string; // ISO string
  location?: string;
  locationAddress?: string;
  visibility?: 'public' | 'private';
  latitude?: number;
  longitude?: number;
  template?: string;
  twinFromPodId?: string;
}

export const createPod = async (activityId: string, options?: CreatePodOptions) => {
  const result = await request<import('./types').Pod>('/pods/join', {
    method: 'POST',
    body: JSON.stringify({ activityId, ...options }),
  });
  void trackEvent('pod.created', {
    activityId,
    visibility: options?.visibility,
    hasLocation: Boolean(options?.location),
    template: options?.template ?? 'custom',
    twinFromPodId: options?.twinFromPodId,
  });
  if (options?.twinFromPodId) {
    void trackEvent('pod.twinned', { fromPodId: options.twinFromPodId, podId: result.id, activityId });
  }
  return result;
};

export const getActivityLocations = (activityId: string) =>
  request<string[]>(`/activities/${activityId}/locations`);

export const getLocationsByCategory = (category: string) =>
  request<string[]>(`/activities/locations?category=${encodeURIComponent(category)}`);

export const lockPod = (podId: string) =>
  request<import('./types').Pod>(`/pods/${podId}/lock`, { method: 'POST' });

export const unlockPod = (podId: string) =>
  request<import('./types').Pod>(`/pods/${podId}/unlock`, { method: 'POST' });

export const updatePodPrivacy = (podId: string, visibility: 'public' | 'private') =>
  request<import('./types').Pod>(`/pods/${encodeURIComponent(podId)}/privacy`, {
    method: 'PATCH',
    body: JSON.stringify({ visibility }),
  });

export interface LeavePodResponse {
  left: boolean;
  podDeleted: boolean;
  pod?: import('./types').Pod;
}

export const leavePod = (podId: string) =>
  request<LeavePodResponse>(`/pods/${podId}/leave`, { method: 'POST' });

export interface EditPodPayload {
  title?: string;
  meetupTime?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
}

export const editPod = (podId: string, payload: EditPodPayload) =>
  request<import('./types').Pod>(`/pods/${encodeURIComponent(podId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const cancelPod = (podId: string) =>
  request<import('./types').Pod>(`/pods/${encodeURIComponent(podId)}/cancel`, { method: 'POST' });

export const getPod = (podId: string, signal?: AbortSignal) =>
  request<import('./types').Pod>(`/pods/${podId}`, {}, signal);

export interface GetMessagesResponse {
  messages: import('./types').Message[];
  typingUserIds: string[];
  hasMore?: boolean;
}

export interface MessagePageOptions {
  limit?: number;
  /** Only messages newer than this message id (cheap polling). */
  after?: string;
  /** Page of messages older than this message id (history). */
  before?: string;
}

function messagePageQuery(opts?: MessagePageOptions): string {
  if (!opts) return '';
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.after) params.set('after', opts.after);
  if (opts.before) params.set('before', opts.before);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const getMessages = (podId: string, opts?: MessagePageOptions, signal?: AbortSignal) =>
  request<GetMessagesResponse>(
    `/pods/${podId}/messages${messagePageQuery(opts)}`,
    { cache: 'no-store' },
    signal,
  );

export const sendPodTyping = (podId: string) =>
  request<{ ok: boolean }>(`/pods/${podId}/typing`, { method: 'POST' });

export const sendMessage = async (podId: string, content: string, replyToId?: string) => {
  const result = await request<import('./types').Message>(`/pods/${podId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, replyToId: replyToId || undefined }),
  });
  void trackEvent('pod.message_sent', { podId, isReply: Boolean(replyToId) });
  return result;
};

export const addPodMessageReaction = (podId: string, msgId: string, emoji: string) =>
  request<import('./types').Message>(`/pods/${podId}/messages/${msgId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  });

export const removePodMessageReaction = (podId: string, msgId: string, emoji: string) =>
  request<import('./types').Message>(`/pods/${podId}/messages/${msgId}/reactions?emoji=${encodeURIComponent(emoji)}`, {
    method: 'DELETE',
  });

export const deletePodMessage = (podId: string, msgId: string) =>
  request(`/pods/${podId}/messages/${msgId}`, { method: 'DELETE' });

export const kickPodMember = (podId: string, memberId: string) =>
  request<import('./types').Pod>(`/pods/${podId}/kick/${memberId}`, { method: 'POST' });

// Analytics
export async function trackEvent(name: string, properties?: Record<string, unknown>): Promise<void> {
  try {
    await request<void>('/analytics/events', {
      method: 'POST',
      body: JSON.stringify({ name, properties }),
    });
  } catch (err) {
    if (__DEV__) {
      console.warn('[analytics] event dropped', name, err);
    }
  }
}

// Reports
export const REPORT_REASONS = [
  'HARASSMENT',
  'HATE',
  'SPAM',
  'NUDITY_SEXUAL',
  'VIOLENCE_THREATS',
  'SELF_HARM',
  'SCAM_FRAUD',
  'ILLEGAL',
  'OTHER',
] as const;

export const REPORT_REASON_LABELS: Record<string, string> = {
  HARASSMENT: 'Harassment or bullying',
  HATE: 'Hate speech or symbols',
  SPAM: 'Spam',
  NUDITY_SEXUAL: 'Nudity or sexual content',
  VIOLENCE_THREATS: 'Violence or threats',
  SELF_HARM: 'Self-harm',
  SCAM_FRAUD: 'Scam or fraud',
  ILLEGAL: 'Illegal activity',
  OTHER: 'Other',
};

export interface CreateReportPayload {
  podId?: string;
  messageId?: string;
  directMessageId?: string;
  clubId?: string;
  clubMessageId?: string;
  clubOfficerMessageId?: string;
  clubAnnouncementId?: string;
  targetUserId?: string;
  reason: string;
  details?: string;
}

export const createReport = async (payload: CreateReportPayload) => {
  const result = await request<{ reportId: string; status: string; severity: string }>('/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  void trackEvent('safety.report_created', {
    reason: payload.reason,
    severity: result.severity,
    targetType: payload.messageId
      ? 'pod_message'
      : payload.directMessageId
        ? 'direct_message'
        : payload.clubMessageId || payload.clubOfficerMessageId
          ? 'club_message'
          : payload.clubAnnouncementId
            ? 'club_announcement'
            : payload.clubId
              ? 'club'
              : payload.podId
                ? 'pod'
                : payload.targetUserId
                  ? 'user'
                  : 'unknown',
  });
  return result;
};

export interface MyReport {
  id: string;
  reason: string;
  severity: string;
  status: string;
  createdAt: string;
  podId?: string | null;
  messageId?: string | null;
  directMessageId?: string | null;
  clubId?: string | null;
  clubMessageId?: string | null;
  clubOfficerMessageId?: string | null;
  clubAnnouncementId?: string | null;
  targetType?: string | null;
  targetUserId?: string | null;
}

export const getMyReports = () =>
  request<MyReport[]>('/reports/mine');

// Attendance
export const confirmAttendance = (podId: string) =>
  request<{ confirmedAt: string }>(`/pods/${podId}/confirm`, { method: 'POST' });

export const reportNoShow = (podId: string, userId: string) =>
  request<{ reported: boolean }>(`/pods/${podId}/no-show/${userId}`, { method: 'POST' });

// Notifications
export const registerPushToken = (token: string) =>
  request<{ success: boolean }>('/users/push-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

export interface NotificationPreferences {
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
  weeklyRecap: boolean;
  /** Demand-pool pushes ("6 people want a boba run" / "a pod just went up"). */
  demandAlerts: boolean;
}

export const getNotificationPreferences = () =>
  request<{ preferences: NotificationPreferences }>('/users/notifications');

export const updateNotificationPreferences = (prefs: Partial<NotificationPreferences>) =>
  request<{ preferences: NotificationPreferences }>('/users/notifications', {
    method: 'PATCH',
    body: JSON.stringify(prefs),
  });

// User public profile
export const getUserProfile = (userId: string, signal?: AbortSignal) =>
  request<import('./types').PublicProfile>(`/users/${userId}`, {}, signal);

// Own profile
export const getMe = () =>
  request<import('./types').User>('/users/me');

export const updateProfile = (data: {
  classYear?: string;
  major?: string;
  bio?: string | null;
  clubs?: string[];
  instagramHandle?: string | null;
  interestTags?: string[];
  purpose?: string | null;
  campusZones?: string[];
  clubInterests?: string | null;
}) =>
  request<import('./types').User>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

/**
 * Upload a profile picture. Uses FormData (multipart), not JSON.
 * `uri` is the local file URI returned by expo-image-picker / expo-image-manipulator.
 */
export const uploadAvatar = async (uri: string, signal?: AbortSignal): Promise<{ avatarUrl: string }> => {
  const filename = uri.split('/').pop() ?? 'avatar.jpg';
  const formData = new FormData();
  formData.append('avatar', { uri, name: filename, type: 'image/jpeg' } as unknown as Blob);

  const headers: Record<string, string> = {};
  const sentAuthToken = authToken;
  if (sentAuthToken) {
    headers['Authorization'] = `Bearer ${sentAuthToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/users/me/avatar`, {
      method: 'PATCH',
      headers,
      body: formData,
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new Error(err instanceof Error ? err.message : 'Upload failed');
  }

  if (res.status === 401) {
    if (sentAuthToken) {
      onUnauthorized?.();
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Upload failed: ${res.status}`);
  }

  return res.json();
};

export const deleteAvatar = () =>
  request<{ avatarUrl: null }>('/users/me/avatar', { method: 'DELETE' });

export const deleteMyAccount = (password: string) =>
  request<void>('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) });

export const downloadMyData = () =>
  request<Record<string, unknown>>('/users/me/export');

/**
 * Upload a club avatar. ADMIN only.
 * `uri` is the local file URI returned by expo-image-picker.
 */
const uploadClubImage = async (
  clubId: string,
  uri: string,
  imageKind: 'avatar' | 'cover',
  signal?: AbortSignal,
): Promise<{ avatarUrl?: string | null; coverUrl?: string | null }> => {
  const filename = uri.split('/').pop() ?? 'club-avatar.jpg';
  const formData = new FormData();
  formData.append('image', { uri, name: filename, type: 'image/jpeg' } as unknown as Blob);
  formData.append('imageKind', imageKind);

  const headers: Record<string, string> = {};
  const sentAuthToken = authToken;
  if (sentAuthToken) {
    headers['Authorization'] = `Bearer ${sentAuthToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/clubs/${encodeURIComponent(clubId)}`, {
      method: 'PATCH',
      headers,
      body: formData,
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new Error(err instanceof Error ? err.message : 'Upload failed');
  }

  if (res.status === 401) {
    if (sentAuthToken) {
      onUnauthorized?.();
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Upload failed: ${res.status}`);
  }

  return res.json();
};

export const uploadClubAvatar = (clubId: string, uri: string, signal?: AbortSignal) =>
  uploadClubImage(clubId, uri, 'avatar', signal) as Promise<{ avatarUrl: string }>;

export const uploadClubCover = (clubId: string, uri: string, signal?: AbortSignal) =>
  uploadClubImage(clubId, uri, 'cover', signal) as Promise<{ coverUrl: string }>;

export const updateClubProfile = (
  clubId: string,
  body: { name: string; description: string; category: string; isPublic: boolean },
) =>
  request<{
    id: string;
    name: string;
    description: string;
    category: string;
    isPublic: boolean;
    avatarUrl?: string | null;
    coverUrl?: string | null;
  }>(`/clubs/${encodeURIComponent(clubId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

// Blocking
export const blockUser = (userId: string) =>
  request<{ success: boolean; blockId?: string; createdAt?: string }>(`/users/${userId}/block`, {
    method: 'POST',
  });

export const unblockUser = (userId: string) =>
  request<{ success?: boolean }>(`/users/${userId}/block`, {
    method: 'DELETE',
  });

export const getBlockedUsers = () =>
  request<{
    id: string;
    name: string;
    avatarUrl: string | null;
    classYear?: string | null;
    major?: string | null;
    blockedAt: string;
  }[]>('/users/blocked');

// User search
export const searchUsers = (q: string) =>
  request<import('./types').FriendUser[]>(`/users/search?q=${encodeURIComponent(q)}`);

export const discoverUsers = (signal?: AbortSignal) =>
  request<import('./types').FriendUser[]>('/users/discover', {}, signal);

// Friends
export const getFriends = (signal?: AbortSignal) =>
  request<import('./types').FriendUser[]>('/friends', {}, signal);

export const getFriendRequests = () =>
  request<{ incoming: import('./types').FriendRequest[]; outgoing: import('./types').FriendRequest[] }>(
    '/friends/requests'
  );

export const getFriendRelationship = (userId: string) =>
  request<import('./types').FriendRelationship>(`/friends/relationship/${userId}`);

export const sendFriendRequest = async (receiverId: string) => {
  const result = await request<import('./types').FriendRequest>('/friends/requests', {
    method: 'POST',
    body: JSON.stringify({ receiverId }),
  });
  void trackEvent('friend.request_sent', { receiverId });
  return result;
};

export const acceptFriendRequest = async (id: string) => {
  const result = await request<{ ok: boolean }>(`/friends/requests/${id}/accept`, {
    method: 'POST',
  });
  void trackEvent('friend.accepted', { requestId: id });
  return result;
};

export const declineFriendRequest = (id: string) =>
  request<{ ok: boolean }>(`/friends/requests/${id}/decline`, { method: 'POST' });

export const cancelFriendRequest = (id: string) =>
  request<void>(`/friends/requests/${id}`, { method: 'DELETE' });

export const unfriend = (userId: string) =>
  request<void>(`/friends/${userId}`, { method: 'DELETE' });

// Direct messages
export const getMessageThreads = () =>
  request<import('./types').DirectMessageThread[]>('/messages/threads', { cache: 'no-store' });

export const getThreadByUser = (userId: string) =>
  request<{ id: string; otherUser: import('./types').FriendUser; updatedAt: string }>(
    `/messages/threads/by-user/${userId}`
  );

export interface GetThreadMessagesResponse {
  messages: import('./types').DirectMessage[];
  otherUser: import('./types').FriendUser;
  typingUserIds: string[];
  otherLastReadAt: string | null;
  hasMore?: boolean;
}

export const getThreadMessages = (threadId: string, opts?: MessagePageOptions) =>
  request<GetThreadMessagesResponse>(
    `/messages/threads/${threadId}${messagePageQuery(opts)}`,
    { cache: 'no-store' },
  );

export const markDMThreadRead = (threadId: string) =>
  request<{ ok: boolean }>(`/messages/threads/${threadId}/read`, { method: 'PATCH' });

export const sendDMTyping = (threadId: string) =>
  request<{ ok: boolean }>(`/messages/threads/${threadId}/typing`, { method: 'POST' });

export const sendDirectMessage = (threadId: string, content: string, replyToId?: string) =>
  request<import('./types').DirectMessage>(`/messages/threads/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, replyToId: replyToId || undefined }),
  });

export const addDMReaction = (threadId: string, msgId: string, emoji: string) =>
  request<import('./types').DirectMessage>(`/messages/threads/${threadId}/messages/${msgId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  });

export const removeDMReaction = (threadId: string, msgId: string, emoji: string) =>
  request<import('./types').DirectMessage>(
    `/messages/threads/${threadId}/messages/${msgId}/reactions?emoji=${encodeURIComponent(emoji)}`,
    { method: 'DELETE' }
  );

export const deleteDMMessage = (threadId: string, msgId: string) =>
  request(`/messages/threads/${threadId}/messages/${msgId}`, { method: 'DELETE' });

// Pod invites
export const getPodInvites = () =>
  request<import('./types').PodInvite[]>('/pods/invites');

export const sendPodInvite = (podId: string, receiverId: string) =>
  request<import('./types').PodInvite>(`/pods/${podId}/invite`, {
    method: 'POST',
    body: JSON.stringify({ receiverId }),
  });

export const acceptPodInvite = (id: string) =>
  request<import('./types').Pod>(`/pods/invites/${id}/accept`, { method: 'POST' });

export const declinePodInvite = (id: string) =>
  request<void>(`/pods/invites/${id}/decline`, { method: 'POST' });

// People You Met
export const getPeopleYouMet = (podId: string) =>
  request<{ users: import('./types').PeopleYouMetUser[] }>(`/pods/${podId}/people-you-met`);

// Pod waitlist
export const joinWaitlist = (podId: string) =>
  request<{ position: number }>(`/pods/${podId}/waitlist`, { method: 'POST' });

export const leaveWaitlist = (podId: string) =>
  request<{ removed: boolean }>(`/pods/${podId}/waitlist`, { method: 'DELETE' });

export const getWaitlistInfo = (podId: string) =>
  request<{ count: number; myPosition: number | null; myStatus: string | null }>(`/pods/${podId}/waitlist`);
