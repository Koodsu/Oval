// Change this to your machine's local IP if testing on a physical device
// e.g. 'http://192.168.1.100:3000'
export const API_BASE = 'http://localhost:3000';

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  let res: Response;
  let data: unknown;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    data = res.status === 204 ? {} : await res.json();
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Network request failed');
  }

  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error(data.error ?? 'Unauthorized');
  }

  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`);
  }

  return data as T;
}

// Auth
export const register = (name: string, email: string, password: string) =>
  request<{ token: string; user: import('./types').User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
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
export const getActivities = (category?: string) =>
  request<import('./types').Activity[]>(
    category ? `/activities?category=${encodeURIComponent(category)}` : '/activities'
  );

// Pods
export const getMyPods = () => request<import('./types').Pod[]>('/pods/mine');

export const fetchFeed = (params: { category?: string; limit?: number } = {}) => {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return request<import('./types').Pod[]>(qs ? `/pods/feed?${qs}` : '/pods/feed');
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

export const getPod = (podId: string) => request<import('./types').Pod>(`/pods/${podId}`);

export const getMessages = (podId: string) =>
  request<import('./types').Message[]>(`/pods/${podId}/messages`);

export const sendMessage = (podId: string, content: string) =>
  request<import('./types').Message>(`/pods/${podId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
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
}

export const getNotificationPreferences = () =>
  request<{ preferences: NotificationPreferences }>('/users/notifications');

export const updateNotificationPreferences = (prefs: Partial<NotificationPreferences>) =>
  request<{ preferences: NotificationPreferences }>('/users/notifications', {
    method: 'PATCH',
    body: JSON.stringify(prefs),
  });

// User public profile
export const getUserProfile = (userId: string) =>
  request<import('./types').PublicProfile>(`/users/${userId}`);

// Own profile
export const getMe = () =>
  request<import('./types').User>('/users/me');

/**
 * Upload a profile picture. Uses FormData (multipart), not JSON.
 * `uri` is the local file URI returned by expo-image-picker / expo-image-manipulator.
 */
export const uploadAvatar = async (uri: string): Promise<{ avatarUrl: string }> => {
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
    });
  } catch (err) {
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
export const getFriends = () =>
  request<import('./types').FriendUser[]>('/friends');

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

export const getThreadMessages = (threadId: string) =>
  request<import('./types').DirectMessage[]>(`/messages/threads/${threadId}`);

export const sendDirectMessage = (threadId: string, content: string) =>
  request<import('./types').DirectMessage>(`/messages/threads/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });

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
