import type {
  ClubAnnouncementRow,
  ClubChannelRow,
  ClubDetail,
  ClubMeetingWithMeta,
} from '../types';

const now = Date.now();
const iso = (hours: number) => new Date(now + hours * 60 * 60 * 1000).toISOString();

const people = [
  { id: 'preview-owner', name: 'Maya Singh', major: 'Visual Communication', classYear: 'Senior' },
  { id: 'preview-officer', name: 'Alex Chen', major: 'Journalism', classYear: 'Junior' },
  { id: 'preview-member-1', name: 'Jordan Kim', major: 'Design', classYear: 'Sophomore' },
  { id: 'preview-member-2', name: 'Taylor Brooks', major: 'Marketing', classYear: 'Junior' },
];

const roles = [
  {
    id: 'preview-role-photo',
    clubId: 'preview-photography',
    name: 'Photo Team',
    permissions: [],
    color: 'scarlet' as const,
    isSelfAssignable: true,
    position: 0,
    createdById: people[0].id,
    createdAt: iso(-720),
    updatedAt: iso(-720),
    memberCount: 3,
  },
  {
    id: 'preview-role-editor',
    clubId: 'preview-photography',
    name: 'Editors',
    permissions: [],
    color: 'green' as const,
    isSelfAssignable: true,
    position: 1,
    createdById: people[0].id,
    createdAt: iso(-700),
    updatedAt: iso(-700),
    memberCount: 2,
  },
];

const members: ClubDetail['members'] = people.map((person, index) => ({
  id: `preview-membership-${index}`,
  clubId: 'preview-photography',
  userId: person.id,
  role: index === 0 ? 'OWNER' : index === 1 ? 'OFFICER' : 'MEMBER',
  permissions: index === 1 ? ['CREATE_MEETINGS', 'POST_ANNOUNCEMENTS'] : null,
  joinedAt: iso(-900 + index),
  user: {
    ...person,
    avatarUrl: null,
    interestTags: ['Photography', 'Campus life'],
  },
  customRoles: index > 0
    ? [{
      id: `preview-assignment-${index}`,
      roleId: roles[index % roles.length].id,
      createdAt: iso(-600 + index),
      role: roles[index % roles.length],
    }]
    : [],
}));

const meeting: ClubMeetingWithMeta = {
  id: 'preview-meeting-sunrise',
  clubId: 'preview-photography',
  title: 'Sunrise Photo Walk',
  description: 'Meet at the trail entrance to catch the morning light. Bring your camera, layers, and good vibes.',
  location: 'Hillside Nature Trail',
  meetingTime: iso(18),
  isPublic: true,
  visibility: 'PUBLIC',
  targetRoleIds: [],
  createdById: people[0].id,
  createdAt: iso(-72),
  createdBy: { id: people[0].id, name: people[0].name, avatarUrl: null },
  attendanceCode: null,
  rsvpCounts: { going: 24, maybe: 4, notGoing: 2 },
  myRsvp: 'GOING',
  attendeeCount: 18,
};

const eventMeetings: ClubMeetingWithMeta[] = [
  meeting,
  {
    ...meeting,
    id: 'preview-meeting-critique',
    title: 'Photo Critique Night',
    description: 'Bring two or three recent images and leave with practical, encouraging feedback.',
    location: 'Media Center Room 204',
    meetingTime: iso(19),
    rsvpCounts: { going: 18, maybe: 3, notGoing: 1 },
    attendeeCount: 0,
    myRsvp: 'GOING',
  },
  {
    ...meeting,
    id: 'preview-meeting-editing',
    title: 'Editing Workshop',
    description: 'A hands-on color and composition session for every experience level.',
    location: 'Tech Lab B',
    meetingTime: iso(43),
    rsvpCounts: { going: 12, maybe: 6, notGoing: 2 },
    attendeeCount: 0,
    myRsvp: 'MAYBE',
  },
];

const announcements: ClubAnnouncementRow[] = [
  {
    id: 'preview-announcement',
    clubId: 'preview-photography',
    userId: people[0].id,
    content: 'Reminder: Photo Critique Night is this Saturday at 7:00 PM. Bring 2–3 of your favorite shots for feedback!',
    visibility: 'MEMBERS',
    targetRoleIds: [],
    meetingId: meeting.id,
    notifyMembers: true,
    meeting: {
      id: meeting.id,
      title: meeting.title,
      location: meeting.location,
      meetingTime: meeting.meetingTime,
    },
    createdAt: iso(-2),
    user: { id: people[0].id, name: people[0].name, avatarUrl: null },
  },
];

const channels: ClubChannelRow[] = [
  {
    id: 'preview-channel-announcements',
    clubId: 'preview-photography',
    kind: 'ANNOUNCEMENTS',
    name: 'Announcements',
    description: 'Official club updates',
    allowedRoleIds: [],
    allowedUserIds: [],
    position: 0,
    createdAt: iso(-1000),
    unreadCount: 1,
    lastMessageAt: iso(-2),
    lastMessagePreview: announcements[0].content,
    canPost: true,
  },
  {
    id: 'preview-channel-general',
    clubId: 'preview-photography',
    kind: 'GENERAL',
    name: 'general',
    description: 'Club-wide conversation',
    allowedRoleIds: [],
    allowedUserIds: [],
    position: 1,
    createdAt: iso(-1000),
    unreadCount: 3,
    lastMessageAt: iso(-0.5),
    lastMessagePreview: 'Can’t wait for the next one.',
    canPost: true,
  },
  {
    id: 'preview-channel-photo',
    clubId: 'preview-photography',
    kind: 'CUSTOM',
    name: 'photo-team',
    description: 'Planning, critique, and field notes',
    allowedRoleIds: [roles[0].id],
    allowedUserIds: [],
    position: 10,
    createdAt: iso(-500),
    unreadCount: 0,
    lastMessageAt: iso(-5),
    lastMessagePreview: 'Final selects are in.',
    canPost: true,
  },
  {
    id: 'preview-channel-officers',
    clubId: 'preview-photography',
    kind: 'OFFICERS',
    name: 'officers',
    description: 'Leadership only',
    allowedRoleIds: [],
    allowedUserIds: [],
    position: 2,
    createdAt: iso(-1000),
    unreadCount: 0,
    lastMessageAt: iso(-8),
    lastMessagePreview: 'Agenda is ready.',
    canPost: true,
  },
];

export type ClubExperienceFixture = {
  club: ClubDetail;
  meetings: ClubMeetingWithMeta[];
  announcements: ClubAnnouncementRow[];
  channels: ClubChannelRow[];
};

export function clubExperienceFixture(mode?: string | null): ClubExperienceFixture | null {
  if (!mode?.startsWith('club-')) return null;
  const empty = [
    'club-home-empty',
    'club-events-empty',
    'club-applications-empty',
  ].includes(mode);
  const memberMode = [
    'club-home-member',
    'club-home-empty',
    'club-home-about',
    'club-home-actions',
    'club-chat-general',
    'club-chat-empty',
    'club-chat-announcements',
    'club-chat-private',
    'club-events',
    'club-events-empty',
    'club-meeting',
    'club-meeting-live',
    'club-members',
    'club-members-search-empty',
    'club-apply',
    'club-apply-status',
    'club-apply-closed',
    'club-manage-leader-required',
  ].includes(mode);
  const meetingMissing = mode === 'club-meeting-not-found';
  const eventsMode = mode === 'club-events';
  const liveMeeting = mode === 'club-meeting-live' || mode === 'club-meeting-attendance';
  const previewMeeting: ClubMeetingWithMeta = liveMeeting
    ? {
        ...meeting,
        meetingTime: iso(-0.5),
        attendanceCode: 'OVAL42',
        attendeeCount: 18,
      }
    : meeting;
  const club: ClubDetail = {
    id: 'preview-photography',
    name: 'Photography Club',
    description: 'A welcoming community for photo walks, portraits, editing sessions, and learning your camera with friends.',
    category: 'Arts & Creative',
    emoji: '📷',
    avatarUrl: null,
    coverUrl: null,
    isVerified: true,
    isPublic: true,
    verification: 'VERIFIED',
    joinPolicy: 'OPEN',
    isDiscoverable: true,
    status: 'ACTIVE',
    followerCount: 86,
    isFollower: false,
    officerPermissions: ['POST_ANNOUNCEMENTS', 'DELETE_MESSAGES'],
    myPermissions: memberMode
      ? []
      : ['MANAGE_MEMBERS', 'MANAGE_ROLES', 'CREATE_MEETINGS', 'POST_ANNOUNCEMENTS', 'DELETE_MESSAGES', 'MANAGE_CLUB'],
    university: 'The Ohio State University',
    createdById: people[0].id,
    createdAt: iso(-1200),
    updatedAt: iso(-1),
    isMember: true,
    myRole: memberMode ? 'MEMBER' : 'OWNER',
    roles,
    members,
    meetings: empty || meetingMissing ? [] : eventsMode ? eventMeetings : [previewMeeting],
    announcements: empty ? [] : announcements,
  };
  return {
    club,
    meetings: empty || meetingMissing ? [] : eventsMode ? eventMeetings : [previewMeeting],
    announcements: empty ? [] : announcements,
    channels,
  };
}
