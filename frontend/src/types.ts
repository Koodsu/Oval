export interface NotificationPreferences {
  podJoin: boolean;
  newMessage: boolean;
  meetupReminder: boolean;
  recapPrompt: boolean;
  waitlistSpot: boolean;
  clubMeetingCreated: boolean;
  clubAnnouncementCreated: boolean;
  clubKick: boolean;
  clubRoleChange: boolean;
  clubAttendanceOpen: boolean;
}

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  verifiedUniversity: boolean;
  isAdmin?: boolean;
  avatarUrl?: string | null;
  joinedAt: string;
  classYear?: string | null;
  major?: string | null;
  bio?: string | null;
  clubs?: string[];
  instagramHandle?: string | null;
  interestTags?: string[];
  purpose?: string | null;
  campusZones?: string[];
  clubInterests?: string | null;
  termsVersion?: string | null;
  termsAcceptedAt?: string | null;
  ageAttestedAt?: string | null;
}

export interface PublicProfile {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  verifiedUniversity: boolean;
  avatarUrl?: string | null;
  podsJoined: number;
  podsAttended: number;
  reliabilityScore: number | null;
  joinedAt: string;
  friendCount?: number;
  classYear?: string | null;
  major?: string | null;
  bio?: string | null;
  clubs?: string[];
  instagramHandle?: string | null;
  interestTags?: string[];
  purpose?: string | null;
  campusZones?: string[];
}

export type FriendRelationshipStatus =
  | 'NONE'
  | 'PENDING_SENT'
  | 'PENDING_RECEIVED'
  | 'FRIENDS'
  | 'BLOCKED'
  | 'SELF';

export interface FriendRelationship {
  status: FriendRelationshipStatus;
  requestId?: string;
}

export interface FriendUser {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  verifiedUniversity: boolean;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  createdAt: string;
  respondedAt?: string | null;
  sender?: FriendUser;
  receiver?: FriendUser;
}

export interface DirectMessageThread {
  id: string;
  otherUser: FriendUser;
  lastMessage?: {
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
  updatedAt: string;
  hasUnread?: boolean;
}

export interface DirectMessageReplyTo {
  id: string;
  content: string;
  senderId: string;
  sender: { id: string; name: string };
}

export interface DirectMessage {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string; avatarUrl?: string | null };
  reactions?: DirectMessageReaction[];
  replyTo?: DirectMessageReplyTo | null;
}

export interface PodInvite {
  id: string;
  podId: string;
  senderId: string;
  receiverId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  createdAt: string;
  respondedAt?: string | null;
  pod?: Pod & { activity: Activity };
  sender?: FriendUser;
  receiver?: FriendUser;
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

export interface ActivityRequest {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  category: string;
  defaultLocation: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewerId?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  requester?: { id: string; name: string };
  user?: { id: string; name: string };
}

/** Row from GET /clubs */
export interface ClubDirectoryEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  emoji: string;
  avatarUrl?: string | null;
  isVerified: boolean;
  isPublic: boolean;
  university: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  upcomingMeetingCount: number;
  isMember: boolean;
}

/** Row from GET /clubs/today */
export interface ClubMeetingToday {
  id: string;
  title: string;
  location: string;
  meetingTime: string;
  isPublic: boolean;
  visibility: 'PUBLIC' | 'MEMBERS' | 'OFFICERS';
  targetRoleIds?: string[];
  clubId: string;
  clubName: string;
  clubEmoji: string;
  attendeeCount: number;
  /** Present on /clubs/week rows: whether the viewer belongs to this club. */
  isMyClub?: boolean;
}

export interface ClubMessage {
  id: string;
  clubId: string;
  channelId?: string | null;
  userId: string;
  content: string;
  mentionRoleIds?: string[];
  createdAt: string;
  user: { id: string; name: string; avatarUrl?: string | null };
}

export type ClubChannelKind = 'ANNOUNCEMENTS' | 'GENERAL' | 'OFFICERS' | 'CUSTOM';

/** Row from GET /clubs/:id/channels */
export interface ClubChannelRow {
  id: string;
  clubId: string;
  kind: ClubChannelKind;
  name: string;
  description: string | null;
  allowedRoleIds: string[];
  allowedUserIds: string[];
  position: number;
  createdAt: string;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  canPost: boolean;
}

export interface ClubOfficerMessage {
  id: string;
  clubId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl?: string | null };
}

export interface ClubMeetingWithMeta {
  id: string;
  clubId: string;
  title: string;
  description: string | null;
  location: string;
  meetingTime: string;
  isPublic: boolean;
  visibility: 'PUBLIC' | 'MEMBERS' | 'OFFICERS';
  targetRoleIds?: string[];
  createdById: string;
  createdAt: string;
  createdBy?: { id: string; name: string; avatarUrl?: string | null };
  attendanceCode?: string | null;
  rsvpReminderSentAt?: string | null;
  rsvpReminderStatus?: string | null;
  rsvpReminderCount?: number;
  rsvpReminderError?: string | null;
  rsvpCounts: { going: number; maybe: number; notGoing: number };
  myRsvp: 'GOING' | 'MAYBE' | 'NOT_GOING' | null;
  attendeeCount: number;
}

export interface ClubMeetingAttendeeRow {
  id: string;
  meetingId: string;
  userId: string;
  status: string;
  createdAt: string;
  user?: { id: string; name: string; avatarUrl?: string | null };
}

export interface ClubMeetingAttendanceResponse {
  attendees: ClubMeetingAttendeeRow[];
  attendedCount: number;
}

export interface ClubMemberWithUser {
  id: string;
  clubId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    interestTags?: string[];
    classYear?: string | null;
    major?: string | null;
  };
  customRoles?: Array<{
    id: string;
    roleId: string;
    createdAt: string;
    role: ClubRole;
  }>;
}

export type NamedClubRoleColor =
  | 'scarlet'
  | 'blue'
  | 'green'
  | 'amber'
  | 'pink'
  | 'violet'
  | 'teal';

export type ClubRoleColor = NamedClubRoleColor | `#${string}`;

export interface ClubRole {
  id: string;
  clubId: string;
  name: string;
  permissions: string[];
  color?: ClubRoleColor | null;
  isSelfAssignable?: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

export interface MyClubMembershipRow {
  membershipId: string;
  role: string;
  joinedAt: string;
  unreadCount?: number;
  club: {
    id: string;
    name: string;
    description: string;
    category: string;
    emoji: string;
    avatarUrl?: string | null;
    isVerified: boolean;
    isPublic: boolean;
    university: string;
    createdAt: string;
    updatedAt: string;
    memberCount: number;
  };
  nextMeeting: {
    id: string;
    clubId: string;
    title: string;
    description: string | null;
    location: string;
    meetingTime: string;
    isPublic: boolean;
    visibility: 'PUBLIC' | 'MEMBERS' | 'OFFICERS';
    createdById: string;
    createdAt: string;
  } | null;
}

export interface ClubAnnouncementRow {
  id: string;
  clubId: string;
  userId: string;
  content: string;
  visibility: 'PUBLIC' | 'MEMBERS' | 'OFFICERS';
  targetRoleIds?: string[];
  createdAt: string;
  user: { id: string; name: string; avatarUrl?: string | null };
}

/** GET /clubs/:id/announcements */
export interface GetClubAnnouncementsResponse {
  items: ClubAnnouncementRow[];
  page: number;
  limit: number;
  total: number;
}

/** GET /clubs/:id */
export interface ClubClaim {
  id: string;
  method: string;
  handleOrEmail: string;
  challengeCode: string;
  status: string;
  expiresAt: string;
  instructions: string;
}

export interface ClubInvite {
  id: string;
  code: string;
  maxUses: number | null;
  expiresAt: string | null;
}

export type ApplicationStage = 'APPLIED' | 'INTERVIEW' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

export interface ClubApplicationCycle {
  id: string;
  title: string;
  questions: string[];
  status: 'OPEN' | 'CLOSED' | 'DRAFT';
  opensAt: string | null;
  closesAt: string | null;
  createdAt: string;
  applicationCount: number;
}

export interface ApplyInfo {
  joinPolicy: string;
  isMember: boolean;
  openCycle: ClubApplicationCycle | null;
  myApplication: { id: string; stage: ApplicationStage } | null;
}

export interface ClubApplicationRow {
  id: string;
  stage: ApplicationStage;
  reviewNote: string | null;
  createdAt: string;
  answers: string[];
  user: { id: string; name: string; avatarUrl?: string | null; major?: string | null; classYear?: string | null };
}

export interface CycleApplications {
  cycle: ClubApplicationCycle;
  applications: ClubApplicationRow[];
}

export interface ClubDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  emoji: string;
  avatarUrl?: string | null;
  isVerified: boolean;
  isPublic: boolean;
  verification?: string;
  joinPolicy?: string;
  isDiscoverable?: boolean;
  status?: string;
  followerCount?: number;
  isFollower?: boolean;
  officerPermissions: string[];
  university: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  isMember: boolean;
  myRole: string | null;
  roles?: ClubRole[];
  members: ClubMemberWithUser[];
  meetings: Array<{
    id: string;
    clubId: string;
    title: string;
    description: string | null;
    location: string;
    meetingTime: string;
    isPublic: boolean;
    visibility: 'PUBLIC' | 'MEMBERS' | 'OFFICERS';
    targetRoleIds?: string[];
    createdById: string;
    createdAt: string;
    rsvpReminderSentAt?: string | null;
    rsvpReminderStatus?: string | null;
    rsvpReminderCount?: number;
    rsvpReminderError?: string | null;
  }>;
  announcements: ClubAnnouncementRow[];
}

export interface PodMember {
  id: string;
  userId: string;
  joinedAt: string;
  confirmedAt?: string | null;
  user: { id: string; name: string; avatarUrl?: string | null; interestTags?: string[]; classYear?: string | null; major?: string | null };
}

export interface PodRecap {
  id: string;
  podId: string;
  userId: string;
  rating: 1 | 2 | 3;
  note?: string | null;
  createdAt: string;
}

export interface Pod {
  id: string;
  activityId: string;
  meetupTime: string;
  location: string;
  locationType: 'public' | 'private';
  minMembers: number;
  maxMembers: number;
  status: 'FORMING' | 'LOCKED' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  creatorId?: string | null;
  createdAt: string;
  activity?: Activity;
  creator?: { id: string } | null;
  members: PodMember[];
  noShowUserIds?: string[];
  recommended?: boolean;
  averageRating?: number | null;
  myRecap?: PodRecap | null;
  waitlistCount?: number;
  myWaitlistPosition?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PeopleYouMetUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
  classYear?: string | null;
  major?: string | null;
  interestTags: string[];
}

export interface MessageReaction {
  emoji: string;
  userId: string;
}

export interface MessageReplyTo {
  id: string;
  content: string;
  userId: string;
  user: { id: string; name: string };
}

export interface Message {
  id: string;
  podId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl?: string | null };
  reactions?: MessageReaction[];
  replyTo?: MessageReplyTo | null;
}

export interface DirectMessageReaction {
  emoji: string;
  userId: string;
}
