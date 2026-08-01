import type { HomePreviewData } from '../screens/HomeScreen';
import type { ExplorePreviewData } from '../screens/ExploreScreen';
import type { PodsPreviewData } from '../screens/PodsScreen';
import type {
  Activity,
  ClubDirectoryEntry,
  ClubMeetingToday,
  FriendUser,
  MyClubMembershipRow,
  Pod,
  PodMember,
} from '../types';
import type { ClubsPreviewData } from '../screens/clubs/ClubsHomeScreen';

const activities: Activity[] = [
  {
    id: 'activity-basketball',
    title: 'Basketball Pickup Game',
    description: 'Friendly pickup games for any skill level.',
    category: 'Sports & Fitness',
    defaultLocation: 'RPAC courts',
    createdAt: new Date().toISOString(),
    demandCount: 8,
    myDemanded: true,
  },
  {
    id: 'activity-study',
    title: 'Study Group Sprint',
    description: 'Quiet focus with a small group.',
    category: 'Academic',
    defaultLocation: 'Thompson Library',
    createdAt: new Date().toISOString(),
    demandCount: 6,
  },
  {
    id: 'activity-trivia',
    title: 'Trivia Night',
    description: 'Form a team for a lively trivia round.',
    category: 'Social',
    defaultLocation: 'Ohio Union',
    createdAt: new Date().toISOString(),
    demandCount: 4,
  },
  {
    id: 'activity-walk',
    title: 'Sunset campus walk',
    description: 'Take a loop around campus after class.',
    category: 'Outdoors',
    defaultLocation: 'Mirror Lake',
    createdAt: new Date().toISOString(),
    demandCount: 3,
  },
  {
    id: 'activity-boba',
    title: 'Boba run',
    description: 'Walk over for an afternoon drink.',
    category: 'Food & Drink',
    defaultLocation: 'High Street',
    createdAt: new Date().toISOString(),
    demandCount: 2,
  },
  {
    id: 'activity-games',
    title: 'Board game break',
    description: 'One quick game between classes.',
    category: 'Gaming',
    defaultLocation: 'Ohio Union',
    createdAt: new Date().toISOString(),
    demandCount: 1,
  },
];

const people = [
  { id: 'person-avery', name: 'Avery', avatarUrl: null },
  { id: 'person-jordan', name: 'Jordan', avatarUrl: null },
  { id: 'person-sam', name: 'Sam', avatarUrl: null },
  { id: 'person-riley', name: 'Riley', avatarUrl: null },
  { id: 'person-devon', name: 'Devon', avatarUrl: null },
  { id: 'person-morgan', name: 'Morgan', avatarUrl: null },
];

function member(personIndex: number, podIndex: number): PodMember {
  const person = people[personIndex % people.length]!;
  return {
    id: `membership-${podIndex}-${person.id}`,
    userId: person.id,
    joinedAt: new Date().toISOString(),
    user: {
      id: person.id,
      name: person.name,
      avatarUrl: person.avatarUrl,
      interestTags: [],
      classYear: null,
      major: null,
    },
  };
}

function futureIso(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

const communityPods: Pod[] = Array.from({ length: 12 }, (_, index) => {
  const activity = activities[index % activities.length]!;
  const memberTotal = 2 + (index % 3);
  return {
    id: `preview-pod-${index + 1}`,
    activityId: activity.id,
    meetupTime: futureIso(2 + index * 3),
    location: activity.defaultLocation,
    locationType: 'public',
    minMembers: 2,
    maxMembers: 6,
    status: 'FORMING',
    creatorId: people[index % people.length]!.id,
    createdAt: new Date().toISOString(),
    activity,
    members: Array.from({ length: memberTotal }, (_, memberIndex) =>
      member((index + memberIndex) % people.length, index),
    ),
    latitude: index < 7 ? 39.998 + index * 0.0005 : null,
    longitude: index < 7 ? -83.012 + index * 0.0006 : null,
  };
});

const friends: FriendUser[] = people.slice(0, 3).map((person) => ({
  ...person,
  verifiedUniversity: true,
}));

const clubMeeting: ClubMeetingToday = {
  id: 'meeting-design',
  title: 'Open studio night',
  location: 'Hopkins Hall',
  meetingTime: futureIso(5),
  isPublic: true,
  visibility: 'PUBLIC',
  clubId: 'club-design',
  clubName: 'Design at Ohio State',
  clubEmoji: '✏️',
  attendeeCount: 11,
  isMyClub: true,
};

const photographyMeeting: ClubMeetingToday = {
  id: 'meeting-photography',
  title: 'Golden hour photo walk',
  location: 'The Oval',
  meetingTime: futureIso(7),
  isPublic: true,
  visibility: 'PUBLIC',
  clubId: 'club-photography',
  clubName: 'Photography Club',
  clubEmoji: '📷',
  attendeeCount: 9,
  isMyClub: false,
};

const clubMembership: MyClubMembershipRow = {
  membershipId: 'membership-design',
  role: 'MEMBER',
  joinedAt: new Date().toISOString(),
  unreadCount: 2,
  club: {
    id: 'club-design',
    name: 'Design at Ohio State',
    description: 'A community for student designers.',
    category: 'Arts & Creative',
    emoji: '✏️',
    avatarUrl: null,
    isVerified: true,
    isPublic: true,
    university: 'Ohio State University',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    memberCount: 84,
  },
  nextMeeting: {
    id: clubMeeting.id,
    clubId: clubMeeting.clubId,
    title: clubMeeting.title,
    description: 'Bring a project or come meet the team.',
    location: clubMeeting.location,
    meetingTime: clubMeeting.meetingTime,
    isPublic: true,
    visibility: 'PUBLIC',
    createdById: 'person-avery',
    createdAt: new Date().toISOString(),
  },
  latestAnnouncement: {
    id: 'announcement-design',
    clubId: 'club-design',
    userId: 'person-avery',
    content: 'Portfolio review sign-ups are open. Claim a time before Thursday night.',
    visibility: 'PUBLIC',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    user: { id: 'person-avery', name: 'Avery', avatarUrl: null },
  },
};

const clubDirectory: ClubDirectoryEntry[] = [
  {
    ...clubMembership.club,
    upcomingMeetingCount: 1,
    isMember: true,
  },
  {
    id: 'club-photography',
    name: 'Photography Club',
    description: 'Photo walks, portraits, and a welcoming place to learn your camera.',
    category: 'Arts & Creative',
    emoji: '📷',
    avatarUrl: null,
    isVerified: true,
    isPublic: true,
    university: 'Ohio State University',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    memberCount: 68,
    upcomingMeetingCount: 2,
    isMember: false,
  },
  {
    id: 'club-business',
    name: 'Business Society',
    description: 'Guest speakers, workshops, and friends building their careers together.',
    category: 'Business',
    emoji: '💼',
    avatarUrl: null,
    isVerified: true,
    isPublic: true,
    university: 'Ohio State University',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    memberCount: 112,
    upcomingMeetingCount: 1,
    isMember: false,
  },
  {
    id: 'club-volleyball',
    name: 'Volleyball Club',
    description: 'Open gyms and competitive play for every experience level.',
    category: 'Sports & Fitness',
    emoji: '🏐',
    avatarUrl: null,
    isVerified: true,
    isPublic: true,
    university: 'Ohio State University',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    memberCount: 94,
    upcomingMeetingCount: 1,
    isMember: false,
  },
  {
    id: 'club-wellness',
    name: 'Student Wellness Collective',
    description: 'Small habits and supportive conversations for a healthier semester.',
    category: 'Wellness',
    emoji: '🌿',
    avatarUrl: null,
    isVerified: true,
    isPublic: true,
    university: 'Ohio State University',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    memberCount: 41,
    upcomingMeetingCount: 0,
    isMember: false,
  },
];

export type Stage2PreviewMode = 'zero' | 'spotlight' | 'community' | 'search';

export function homePreviewData(mode: Stage2PreviewMode): HomePreviewData {
  const pods =
    mode === 'zero' ? [] : mode === 'spotlight' ? communityPods.slice(0, 4) : communityPods;
  return {
    pods,
    myPods: mode === 'zero' ? [] : [pods[0]!],
    clubMeetings: mode === 'community' ? [clubMeeting] : [],
    myClubs: mode === 'community' ? [clubMembership] : [],
    friends,
    summary: {
      dmUnread: 1,
      podUnread: 1,
      invites: 0,
      friendRequests: 0,
      total: 2,
    },
  };
}

export function explorePreviewData(mode: Stage2PreviewMode): ExplorePreviewData {
  return {
    activities,
    feed:
      mode === 'zero' || mode === 'search'
        ? []
        : mode === 'spotlight'
          ? communityPods.slice(0, 4)
          : communityPods,
    friends,
    query: mode === 'search' ? 'midnight pottery' : '',
  };
}

export function podsPreviewData(mode: Stage2PreviewMode): PodsPreviewData {
  const feed =
    mode === 'zero'
      ? []
      : mode === 'spotlight'
        ? communityPods.slice(0, 4)
        : communityPods;
  return {
    activePods: mode === 'community' ? communityPods.slice(0, 3) : [],
    historyPods: communityPods
      .slice(6, 9)
      .map((pod, index) => ({
        ...pod,
        meetupTime: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
        status: 'COMPLETED' as const,
      })),
    feed,
    friends,
  };
}

export function clubsPreviewData(mode: Stage2PreviewMode): ClubsPreviewData {
  if (mode === 'zero') {
    return { clubs: [], myClubs: [], meetings: [] };
  }
  if (mode === 'spotlight') {
    return {
      clubs: [{ ...clubDirectory[1]!, memberCount: 1, upcomingMeetingCount: 0 }],
      myClubs: [],
      meetings: [],
    };
  }
  if (mode === 'search') {
    return { clubs: clubDirectory, myClubs: [], meetings: [] };
  }
  return {
    clubs: clubDirectory,
    myClubs: [clubMembership],
    meetings: [clubMeeting, photographyMeeting],
  };
}
