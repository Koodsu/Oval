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
  title: 'Study group',
  description: 'Practice problems and exam prep.',
  category: 'Academic / Study',
  artworkKey: 'study-group',
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

const socialActivity: Activity = {
  id: 'inbox-boba',
  title: 'Grab coffee or tea',
  description: 'A quick High Street walk with whoever is free.',
  category: 'Food',
  artworkKey: 'grab-coffee-tea',
  defaultLocation: 'High Street',
  createdAt: new Date().toISOString(),
};

const socialPod: Pod = {
  ...pod,
  id: 'inbox-pod-boba',
  activityId: socialActivity.id,
  meetupTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
  location: 'High Street',
  activity: socialActivity,
  members: people.slice(1, 4).map((person, index) => ({
    id: `inbox-boba-member-${index + 1}`,
    userId: person.id,
    joinedAt: new Date(Date.now() - (index + 1) * 35 * 60 * 1000).toISOString(),
    user: {
      id: person.id,
      name: person.name,
      avatarUrl: person.avatarUrl,
    },
  })),
  unreadCount: 1,
};

const inviteActivity: Activity = {
  id: 'inbox-women-stem',
  title: 'Study group',
  description: 'A welcoming pod for women across STEM majors.',
  category: 'Academic / Study',
  artworkKey: 'study-group',
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
    dmUnread: 2,
    podUnread: 3,
    invites: 2,
    friendRequests: 0,
    total: 7,
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
        createdAt: new Date(Date.now() - 52 * 60 * 1000).toISOString(),
        senderId: people[1]!.id,
      },
      updatedAt: new Date(Date.now() - 52 * 60 * 1000).toISOString(),
      hasUnread: false,
    },
    {
      id: 'thread-riley',
      otherUser: people[2]!,
      lastMessage: {
        content: 'Want to grab coffee after class tomorrow?',
        createdAt: new Date(Date.now() - 78 * 60 * 1000).toISOString(),
        senderId: people[2]!.id,
      },
      updatedAt: new Date(Date.now() - 78 * 60 * 1000).toISOString(),
      hasUnread: true,
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
    {
      id: 'invite-boba',
      podId: socialPod.id,
      senderId: people[1]!.id,
      receiverId: 'preview-user',
      status: 'PENDING',
      createdAt: new Date(Date.now() - 72 * 60 * 1000).toISOString(),
      pod: { ...socialPod, activity: socialActivity },
      sender: people[1],
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
    {
      ...socialPod,
      lastMessageAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
      lastMessageSenderName: 'Taylor',
      lastMessagePreview: 'Meet by the Union entrance?',
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
