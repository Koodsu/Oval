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

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`);
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
export const getActivities = () =>
  request<import('./types').Activity[]>('/activities');

// Pods
export const getPodsByActivity = (activityId: string) =>
  request<import('./types').Pod[]>(`/pods?activityId=${activityId}`);

// Join an existing pod by its ID
export const joinPod = (podId: string) =>
  request<import('./types').Pod>('/pods/join', {
    method: 'POST',
    body: JSON.stringify({ podId }),
  });

// Create a brand new pod for an activity (you become the first member)
export const createPod = (activityId: string) =>
  request<import('./types').Pod>('/pods/join', {
    method: 'POST',
    body: JSON.stringify({ activityId }),
  });

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
