// Change this to your machine's local IP if testing on a physical device
// e.g. 'http://192.168.1.100:3000'
export const API_BASE = 'http://localhost:3000';

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
  request<{ token: string; user: { id: string; name: string; email: string } }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });

export const login = (email: string, password: string) =>
  request<{ token: string; user: { id: string; name: string; email: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

// Activities
export const getActivities = (category?: string) =>
  request<import('./types').Activity[]>(
    category ? `/activities?category=${encodeURIComponent(category)}` : '/activities'
  );

// Pods
export const getMyPods = () => request<import('./types').Pod[]>('/pods/mine');

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

// Blocking
export const blockUser = (userId: string) =>
  request<{ success: boolean; blockId?: string; createdAt?: string }>(`/users/${userId}/block`, {
    method: 'POST',
  });

export const unblockUser = (userId: string) =>
  request<{ success?: boolean }>(`/users/${userId}/block`, {
    method: 'DELETE',
  });

// Notifications
export const registerPushToken = (token: string) =>
  request<{ success: boolean }>('/users/push-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

export const updateNotificationPreferences = (
  prefs: Partial<import('./types').NotificationPreferences>
) =>
  request<import('./types').User>('/users/notifications', {
    method: 'PATCH',
    body: JSON.stringify(prefs),
  });
