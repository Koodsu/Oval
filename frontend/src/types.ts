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
  status: 'FORMING' | 'LOCKED' | 'COMPLETED';
  createdAt: string;
  activity?: Activity;
  members: PodMember[];
}

export interface Message {
  id: string;
  podId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string };
}
