import type { InboxPreviewData } from '../screens/InboxScreen';
import type { Activity, FriendUser, Pod } from '../types';
import type { Stage2PreviewMode } from './stage2Fixtures';

const people: FriendUser[] = [
  { id: 'inbox-jordan', name: 'Jordan Lee', avatarUrl: null, verifiedUniversity: true },
  { id: 'inbox-taylor', name: 'Taylor Morgan', avatarUrl: null, verifiedUniversity: true },
  { id: 'inbox-riley', name: 'Riley Chen', avatarUrl: null, verifiedUniversity: true },
  { id: 'inbox-casey', name: 'Casey Brooks', avatarUrl: null, verifiedUniversity: true },
];

const activity: Activity = {
  id: 'inbox-study',
  title: 'Data Science Study Group',
  description: 'Practice problems and exam prep.',
  category: 'Academic',
  defaultLocation: 'Thompson Library',
  createdAt: new Date().toISOString(),
};

const pod: Pod = {
  id: 'inbox-pod-study',
  activityId: activity.id,
  meetupTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
  location: 'Thompson Library',
  locationType: 'public',
  minMembers: 2,
  maxMembers: 6,
  status: 'FORMING',
  createdAt: new Date().toISOString(),
  activity,
  members: people.slice(0, 3).map((person, index) => ({
    id: `inbox-member-${index + 1}`,
    userId: person.id,
    joinedAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString(),
    user: {
      id: person.id,
      name: person.name,
      avatarUrl: person.avatarUrl,
    },
  })),
  unreadCount: 2,
};

const inviteActivity: Activity = {
  id: 'inbox-women-stem',
  title: 'Women in STEM',
  description: 'A welcoming pod for women across STEM majors.',
  category: 'Academic',
  defaultLocation: '18th Avenue Library',
  createdAt: new Date().toISOString(),
};

const invitePod: Pod = {
  ...pod,
  id: 'inbox-pod-women-stem',
  activityId: inviteActivity.id,
  activity: inviteActivity,
  members: people.map((person, index) => ({
    id: `inbox-invite-member-${index + 1}`,
    userId: person.id,
    joinedAt: new Date(Date.now() - (index + 2) * 60 * 60 * 1000).toISOString(),
    user: {
      id: person.id,
      name: person.name,
      avatarUrl: person.avatarUrl,
    },
  })),
  unreadCount: 0,
};

const community: InboxPreviewData = {
  summary: {
    dmUnread: 1,
    podUnread: 2,
    invites: 1,
    friendRequests: 0,
    total: 4,
  },
  threads: [
    {
      id: 'thread-jordan',
      otherUser: people[0]!,
      lastMessage: {
        content: 'Study session at 6?',
        createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        senderId: people[0]!.id,
      },
      updatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      hasUnread: true,
    },
    {
      id: 'thread-taylor',
      otherUser: people[1]!,
      lastMessage: {
        content: 'Thanks for the notes!',
        createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
        senderId: people[1]!.id,
      },
      updatedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
      hasUnread: false,
    },
    {
      id: 'thread-riley',
      otherUser: people[2]!,
      lastMessage: {
        content: 'Want to grab coffee after class tomorrow?',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        senderId: people[2]!.id,
      },
      updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      hasUnread: false,
    },
  ],
  invites: [
    {
      id: 'invite-study',
      podId: invitePod.id,
      senderId: people[3]!.id,
      receiverId: 'preview-user',
      status: 'PENDING',
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      pod: { ...invitePod, activity: inviteActivity },
      sender: people[3],
    },
  ],
  requests: [],
  outgoingRequests: [],
  friends: people,
  pods: [
    {
      ...pod,
      lastMessageAt: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
      lastMessageSenderName: 'Casey',
      lastMessagePreview: 'I added the practice problems',
    },
  ],
};

const zero: InboxPreviewData = {
  summary: { dmUnread: 0, podUnread: 0, invites: 0, friendRequests: 0, total: 0 },
  threads: [],
  invites: [],
  requests: [],
  outgoingRequests: [],
  friends: [],
  pods: [],
};

const caughtUp: InboxPreviewData = {
  ...zero,
  friends: people,
};

export function inboxPreviewData(mode: Stage2PreviewMode): InboxPreviewData {
  if (mode === 'zero') return zero;
  if (mode === 'spotlight') return caughtUp;
  return community;
}
