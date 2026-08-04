import type {
  ActivityRequest,
  DirectMessage,
  FriendRequest,
  FriendRelationship,
  FriendUser,
  PublicProfile,
} from '../types';

const now = Date.now();
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const hoursFromNow = (hours: number) => new Date(now + hours * 3_600_000).toISOString();

export const previewCurrentUserId = 'preview-me';

export const previewOtherUser: FriendUser = {
  id: 'preview-maya',
  name: 'Maya Chen',
  avatarUrl: null,
  verifiedUniversity: true,
  classYear: 'Junior',
  major: 'Psychology',
};

export const previewDirectMessages: DirectMessage[] = [
  {
    id: 'dm-1',
    threadId: 'preview-thread',
    senderId: previewOtherUser.id,
    content: 'Hey! Are you still up for the hike tomorrow morning?',
    createdAt: minutesAgo(8),
    sender: previewOtherUser,
    reactions: [],
  },
  {
    id: 'dm-2',
    threadId: 'preview-thread',
    senderId: previewOtherUser.id,
    content: 'Weather looks perfect ☀️ I’ll bring extra snacks!',
    createdAt: minutesAgo(7),
    sender: previewOtherUser,
    reactions: [],
  },
  {
    id: 'dm-3',
    threadId: 'preview-thread',
    senderId: previewCurrentUserId,
    content: 'Yes! Can’t wait.',
    createdAt: minutesAgo(6),
    sender: { id: previewCurrentUserId, name: 'You', avatarUrl: null },
    reactions: [
      { emoji: '❤️', userId: previewCurrentUserId },
      { emoji: '❤️', userId: previewOtherUser.id },
    ],
  },
  {
    id: 'dm-4',
    threadId: 'preview-thread',
    senderId: previewCurrentUserId,
    content: 'You’re the real MVP.',
    createdAt: minutesAgo(5),
    sender: { id: previewCurrentUserId, name: 'You', avatarUrl: null },
    replyTo: {
      id: 'dm-2',
      content: 'I’ll bring extra snacks!',
      senderId: previewOtherUser.id,
      sender: { id: previewOtherUser.id, name: previewOtherUser.name },
    },
    reactions: [],
  },
];

export const previewSuggestions: FriendUser[] = [
  {
    id: 'suggestion-1',
    name: 'Avery Johnson',
    verifiedUniversity: true,
    avatarUrl: null,
    major: 'Marketing',
    classYear: 'Sophomore',
    mutualFriendCount: 3,
  },
  {
    id: 'suggestion-2',
    name: 'Sophie Park',
    verifiedUniversity: true,
    avatarUrl: null,
    major: 'Psychology',
    classYear: 'Junior',
    sharedInterests: ['Music', 'Coffee'],
  },
  {
    id: 'suggestion-3',
    name: 'Ethan Nguyen',
    verifiedUniversity: true,
    avatarUrl: null,
    major: 'Mechanical Engineering',
    classYear: 'Sophomore',
    mutualFriendCount: 2,
  },
  {
    id: 'suggestion-4',
    name: 'Zoe Williams',
    verifiedUniversity: true,
    avatarUrl: null,
    major: 'Journalism',
    classYear: 'Senior',
    sharedInterests: ['Photography', 'Music'],
  },
];

export const previewFriendRequests: FriendRequest[] = [
  {
    id: 'request-1',
    senderId: 'requester-1',
    receiverId: previewCurrentUserId,
    status: 'PENDING',
    createdAt: minutesAgo(40),
    sender: previewSuggestions[0],
  },
];

export const previewProfile: PublicProfile = {
  id: 'preview-jordan',
  name: 'Jordan Lee',
  firstName: 'Jordan',
  lastName: 'Lee',
  verifiedUniversity: true,
  avatarUrl: null,
  podsJoined: 8,
  podsAttended: 7,
  reliabilityScore: 100,
  joinedAt: minutesAgo(100_000),
  friendCount: 28,
  sharedPodCount: 2,
  mutualFriendCount: 2,
  mutualFriends: [
    { id: 'mutual-1', name: 'Avery Johnson', avatarUrl: null },
    { id: 'mutual-2', name: 'Sophie Park', avatarUrl: null },
  ],
  classYear: 'Junior',
  major: 'Computer Science',
  bio: 'Coffee explorer. Sunrise chaser. Always up for a good plan.',
  interestTags: ['Coffee', 'Outdoors', 'Music', 'Sports'],
  purpose: 'Find friends',
  campusZones: ['North campus'],
  clubCount: 3,
  clubMemberships: [
    {
      id: 'club-outdoors',
      name: 'Outdoor Adventure Club',
      emoji: '🌲',
      category: 'Outdoors',
    },
    {
      id: 'club-tech',
      name: 'Tech Society',
      emoji: '💻',
      category: 'Academic',
    },
  ],
  upcomingPods: [
    {
      id: 'pod-coffee',
      title: 'Sunrise coffee walk',
      meetupTime: hoursFromNow(18),
      location: 'The Oval',
      memberCount: 4,
      maxMembers: 6,
    },
  ],
};

export const previewRelationship: FriendRelationship = { status: 'NONE' };

export const previewBlockedUsers = [
  {
    id: 'blocked-1',
    name: 'Maya Patel',
    avatarUrl: null,
    classYear: 'Junior',
    major: 'Psychology',
    blockedAt: minutesAgo(5_000),
  },
  {
    id: 'blocked-2',
    name: 'Lucas Bennett',
    avatarUrl: null,
    classYear: 'Senior',
    major: 'Business',
    blockedAt: minutesAgo(8_000),
  },
  {
    id: 'blocked-3',
    name: 'Nina Thompson',
    avatarUrl: null,
    classYear: 'Junior',
    major: 'Communications',
    blockedAt: minutesAgo(12_000),
  },
];

export const previewActivityRequests: ActivityRequest[] = [
  {
    id: 'activity-request-1',
    userId: 'student-1',
    title: 'Ceramics Studio Night',
    description: 'A relaxed evening of ceramic making and glazing for all skill levels.',
    category: 'Music & Arts',
    defaultLocation: 'Hopkins Hall',
    status: 'PENDING',
    createdAt: minutesAgo(60),
    requester: { id: 'student-1', name: 'Avery Johnson' },
  },
  {
    id: 'activity-request-2',
    userId: 'student-2',
    title: 'Beginner Pickleball',
    description: 'Learn the basics and play friendly games with other beginners.',
    category: 'Sports',
    defaultLocation: 'RPAC courts',
    status: 'PENDING',
    createdAt: minutesAgo(180),
    requester: { id: 'student-2', name: 'Ethan Nguyen' },
  },
  {
    id: 'activity-request-3',
    userId: 'student-3',
    title: 'Board Game Café',
    description: 'Drop in for board games, snacks, and good company.',
    category: 'Games',
    defaultLocation: 'Ohio Union',
    status: 'PENDING',
    createdAt: minutesAgo(360),
    requester: { id: 'student-3', name: 'Sophie Park' },
  },
];

export const previewReviewedRequests: ActivityRequest[] = [
  {
    ...previewActivityRequests[0],
    id: 'reviewed-1',
    status: 'APPROVED',
  },
  {
    ...previewActivityRequests[1],
    id: 'reviewed-2',
    status: 'REJECTED',
    reviewNote: 'Already covered by an existing activity.',
  },
];
