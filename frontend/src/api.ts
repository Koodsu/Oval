// Change this to your machine's local IP if testing on a physical device
// e.g. 'http://192.168.1.100:3000'
export const API_BASE = 'http://localhost:3000';

let authToken: string | null = null;

export function setToken(token: string | null) {
  authToken = token;
}

export function getToken(): string | null {
  return authToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
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
export const getMyPods = () =>
  request<import('./types').Pod[]>('/pods/mine');

export const getPodsByActivity = (activityId: string, sort?: string) => {
  const params = new URLSearchParams({ activityId });
  if (sort) params.set('sort', sort);
  return request<import('./types').Pod[]>(`/pods?${params.toString()}`);
};

// Join an existing pod by its ID
export const joinPod = (podId: string) =>
  request<import('./types').Pod>('/pods/join', {
    method: 'POST',
    body: JSON.stringify({ podId }),
  });

// Create a brand new pod for an activity (you become the first member)
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

// Get public location options for an activity's category
export const getActivityLocations = (activityId: string) =>
  request<string[]>(`/activities/${activityId}/locations`);

// Get locations by category (fallback when activity lookup fails)
export const getLocationsByCategory = (category: string) =>
  request<string[]>(`/activities/locations?category=${encodeURIComponent(category)}`);

// Lock/unlock pod (creator only)
export const lockPod = (podId: string) =>
  request<import('./types').Pod>(`/pods/${podId}/lock`, { method: 'POST' });
export const unlockPod = (podId: string) =>
  request<import('./types').Pod>(`/pods/${podId}/unlock`, { method: 'POST' });

// Leave a pod (disbands if empty)
export interface LeavePodResponse {
  left: boolean;
  podDeleted: boolean;
  pod?: import('./types').Pod;
}
export const leavePod = (podId: string) =>
  request<LeavePodResponse>(`/pods/${podId}/leave`, { method: 'POST' });

export const getPod = (podId: string) =>
  request<import('./types').Pod>(`/pods/${podId}`);

// Messages
export const getMessages = (podId: string) =>
  request<import('./types').Message[]>(`/pods/${podId}/messages`);

export const sendMessage = (podId: string, content: string) =>
  request<import('./types').Message>(`/pods/${podId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
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
