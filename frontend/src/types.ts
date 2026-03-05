export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  category: string;
  defaultLocation: string;
  createdAt: string;
  _count?: { pods: number };
}

export interface PodMember {
  id: string;
  userId: string;
  joinedAt: string;
  user: { id: string; name: string };
}

export interface Pod {
  id: string;
  activityId: string;
  meetupTime: string;
  location: string;
  locationType: 'public' | 'private';
  minMembers: number;
  maxMembers: number;
  status: 'FORMING' | 'LOCKED' | 'COMPLETED';
  creatorId?: string | null;
  createdAt: string;
  activity?: Activity;
  creator?: { id: string } | null;
  members: PodMember[];
  recommended?: boolean;
}

export interface Message {
  id: string;
  podId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string };
}
