// Set EXPO_PUBLIC_API_URL in your .env file (or EAS secrets for production builds).
// Falls back to localhost for local development.
// On a physical device, set this to your machine's local IP, e.g. http://192.168.1.100:3000
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/** Shown in alerts instead of raw server messages after API failures. */
export const API_USER_MESSAGE = 'Something went wrong, please try again';

const RETRY_BACKOFF_MS = [250, 500, 1000] as const;
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Resolves a stored avatar path (e.g. /uploads/avatars/x.jpg) to a full URL.
 * Handles relative backend paths and already-absolute URLs.
 */
export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | undefined {
  if (!avatarUrl) return undefined;
  if (avatarUrl.startsWith('http')) return avatarUrl;
  return `${API_BASE}${avatarUrl}`;
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setToken(token: string | null) {
  authToken = token;
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    if (signal?.aborted) {
      const e = new Error('Aborted');
      e.name = 'AbortError';
      throw e;
    }

    let res: Response;
    let data: unknown;
    try {
      res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal });
      data =
        res.status === 204
          ? {}
          : await res.json().catch((parseErr) => {
              if (__DEV__) {
                console.warn(`[api] JSON parse failed for ${path} (${res.status}):`, parseErr);
              }
              return {};
            });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      throw new Error(err instanceof Error ? err.message : 'Network request failed');
    }

    if (res.status === 401) {
      onUnauthorized?.();
      throw new Error((data as { error?: string }).error ?? 'Unauthorized');
    }

    if (res.ok) {
      return data as T;
    }

    const retryable = res.status === 429 || res.status === 503;
    if (retryable && attempt < MAX_RETRY_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
      continue;
    }

    if (retryable) {
      throw new Error(API_USER_MESSAGE);
    }

    throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`);
  }

  throw new Error(API_USER_MESSAGE);
}

// Auth
export const register = (name: string, email: string, password: string, classYear: string, major: string) =>
  request<{ token: string; user: import('./types').User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, classYear, major }),
  });

export const login = (email: string, password: string) =>
  request<{ token: string; user: import('./types').User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const verifyEmail = (code: string) =>
  request<{ user: import('./types').User }>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

export const resendVerification = () =>
  request<{ message: string }>('/auth/resend-verification', { method: 'POST' });

// Activities
export const getActivities = (category?: string, signal?: AbortSignal) =>
  request<import('./types').Activity[]>(
    category ? `/activities?category=${encodeURIComponent(category)}` : '/activities',
    {},
    signal
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

export const joinClub = (clubId: string) =>
  request<{ ok: true }>(`/clubs/${encodeURIComponent(clubId)}/join`, { method: 'POST' });

export const leaveClub = (clubId: string) =>
  request<{ ok: true }>(`/clubs/${encodeURIComponent(clubId)}/leave`, { method: 'DELETE' });

export const getClub = (clubId: string, signal?: AbortSignal) =>
  request<import('./types').ClubDetail>(`/clubs/${encodeURIComponent(clubId)}`, {}, signal);

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

export const getClubMessages = (clubId: string, signal?: AbortSignal) =>
  request<GetClubMessagesResponse>(`/clubs/${encodeURIComponent(clubId)}/messages`, {}, signal);

export const sendClubMessage = (clubId: string, content: string) =>
  request<import('./types').ClubMessage>(`/clubs/${encodeURIComponent(clubId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });

export const sendClubTyping = (clubId: string) =>
  request<{ ok: boolean }>(`/clubs/${encodeURIComponent(clubId)}/typing`, { method: 'POST' });

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

export const patchClubMemberRole = (
  clubId: string,
  memberUserId: string,
  body: { role: 'OFFICER' | 'MEMBER' }
) =>
  request<import('./types').ClubMemberWithUser>(
    `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberUserId)}`,
    { method: 'PATCH', body: JSON.stringify(body) }
  );

export const removeClubMember = (clubId: string, memberUserId: string) =>
  request<{ ok: true }>(
    `/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(memberUserId)}`,
    { method: 'DELETE' }
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
  isPublic?: boolean;
}

export const createClubMeeting = (clubId: string, body: CreateClubMeetingBody) =>
  request<import('./types').ClubMeetingWithMeta>(
    `/clubs/${encodeURIComponent(clubId)}/meetings`,
    { method: 'POST', body: JSON.stringify(body) }
  );

// Pods
export const getMyPods = (signal?: AbortSignal) =>
  request<import('./types').Pod[]>('/pods/mine', {}, signal);

export const fetchFeed = (params: { category?: string; limit?: number } = {}, signal?: AbortSignal) => {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return request<import('./types').Pod[]>(qs ? `/pods/feed?${qs}` : '/pods/feed', {}, signal);
};

export const getPodsByActivity = (activityId: string, sort?: string) => {
  const params = new URLSearchParams({ activityId });
  if (sort) params.set('sort', sort);
  return request<import('./types').Pod[]>(`/pods?${params.toString()}`);
};

export const joinPod = (podId: string) =>
  request<import('./types').Pod>('/pods/join', {
    method: 'POST',
    body: JSON.stringify({ podId }),
  });

export interface CreatePodOptions {
  minMembers?: number;
  maxMembers?: number;
  meetupTime?: string; // ISO string
  location?: string;
}

export const createPod = (activityId: string, options?: CreatePodOptions) =>
  request<import('./types').Pod>('/pods/join', {
    method: 'POST',
    body: JSON.stringify({ activityId, ...options }),
  });

export const getActivityLocations = (activityId: string) =>
  request<string[]>(`/activities/${activityId}/locations`);

export const getLocationsByCategory = (category: string) =>
  request<string[]>(`/activities/locations?category=${encodeURIComponent(category)}`);

export const lockPod = (podId: string) =>
  request<import('./types').Pod>(`/pods/${podId}/lock`, { method: 'POST' });

export const unlockPod = (podId: string) =>
  request<import('./types').Pod>(`/pods/${podId}/unlock`, { method: 'POST' });

export interface LeavePodResponse {
  left: boolean;
  podDeleted: boolean;
  pod?: import('./types').Pod;
}

export const leavePod = (podId: string) =>
  request<LeavePodResponse>(`/pods/${podId}/leave`, { method: 'POST' });

export const getPod = (podId: string, signal?: AbortSignal) =>
  request<import('./types').Pod>(`/pods/${podId}`, {}, signal);

export interface GetMessagesResponse {
  messages: import('./types').Message[];
  typingUserIds: string[];
}

export const getMessages = (podId: string, signal?: AbortSignal) =>
  request<GetMessagesResponse>(`/pods/${podId}/messages`, {}, signal);

export const sendPodTyping = (podId: string) =>
  request<{ ok: boolean }>(`/pods/${podId}/typing`, { method: 'POST' });

export const sendMessage = (podId: string, content: string, replyToId?: string) =>
  request<import('./types').Message>(`/pods/${podId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, replyToId: replyToId || undefined }),
  });

export const addPodMessageReaction = (podId: string, msgId: string, emoji: string) =>
  request<import('./types').Message>(`/pods/${podId}/messages/${msgId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  });

export const removePodMessageReaction = (podId: string, msgId: string, emoji: string) =>
  request<import('./types').Message>(`/pods/${podId}/messages/${msgId}/reactions?emoji=${encodeURIComponent(emoji)}`, {
    method: 'DELETE',
  });

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
  targetUserId?: string;
  reason: string;
  details?: string;
}

export const createReport = (payload: CreateReportPayload) =>
  request<{ reportId: string; status: string }>('/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export interface MyReport {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  podId?: string | null;
  messageId?: string | null;
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
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
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
    onUnauthorized?.();
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

/**
 * Upload a club avatar. ADMIN only.
 * `uri` is the local file URI returned by expo-image-picker.
 */
export const uploadClubAvatar = async (clubId: string, uri: string, signal?: AbortSignal): Promise<{ avatarUrl: string }> => {
  const filename = uri.split('/').pop() ?? 'club-avatar.jpg';
  const formData = new FormData();
  formData.append('image', { uri, name: filename, type: 'image/jpeg' } as unknown as Blob);

  const headers: Record<string, string> = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
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
    onUnauthorized?.();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Upload failed: ${res.status}`);
  }

  return res.json();
};

// Blocking
export const blockUser = (userId: string) =>
  request<{ success: boolean; blockId?: string; createdAt?: string }>(`/users/${userId}/block`, {
    method: 'POST',
  });

export const unblockUser = (userId: string) =>
  request<{ success?: boolean }>(`/users/${userId}/block`, {
    method: 'DELETE',
  });

// User search
export const searchUsers = (q: string) =>
  request<import('./types').FriendUser[]>(`/users/search?q=${encodeURIComponent(q)}`);

// Friends
export const getFriends = (signal?: AbortSignal) =>
  request<import('./types').FriendUser[]>('/friends', {}, signal);

export const getFriendRequests = () =>
  request<{ incoming: import('./types').FriendRequest[]; outgoing: import('./types').FriendRequest[] }>(
    '/friends/requests'
  );

export const getFriendRelationship = (userId: string) =>
  request<import('./types').FriendRelationship>(`/friends/relationship/${userId}`);

export const sendFriendRequest = (receiverId: string) =>
  request<import('./types').FriendRequest>('/friends/requests', {
    method: 'POST',
    body: JSON.stringify({ receiverId }),
  });

export const acceptFriendRequest = (id: string) =>
  request<{ ok: boolean }>(`/friends/requests/${id}/accept`, { method: 'POST' });

export const declineFriendRequest = (id: string) =>
  request<{ ok: boolean }>(`/friends/requests/${id}/decline`, { method: 'POST' });

export const cancelFriendRequest = (id: string) =>
  request<void>(`/friends/requests/${id}`, { method: 'DELETE' });

export const unfriend = (userId: string) =>
  request<void>(`/friends/${userId}`, { method: 'DELETE' });

// Direct messages
export const getMessageThreads = () =>
  request<import('./types').DirectMessageThread[]>('/messages/threads');

export const getThreadByUser = (userId: string) =>
  request<{ id: string; otherUser: import('./types').FriendUser; updatedAt: string }>(
    `/messages/threads/by-user/${userId}`
  );

export interface GetThreadMessagesResponse {
  messages: import('./types').DirectMessage[];
  typingUserIds: string[];
  otherLastReadAt: string | null;
}

export const getThreadMessages = (threadId: string) =>
  request<GetThreadMessagesResponse>(`/messages/threads/${threadId}`);

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

// Pod recaps
export const submitRecap = (podId: string, data: { rating: 1 | 2 | 3; note?: string | null }) =>
  request<import('./types').PodRecap>(`/pods/${podId}/recap`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getMyRecap = (podId: string) =>
  request<import('./types').PodRecap | null>(`/pods/${podId}/recap`);

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
