export interface NotificationPreferences {
  podJoin: boolean;
  newMessage: boolean;
  meetupReminder: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  verifiedUniversity: boolean;
  avatarUrl?: string | null;
  joinedAt: string;
  classYear?: string | null;
  major?: string | null;
  bio?: string | null;
  clubs?: string[];
  instagramHandle?: string | null;
  interestTags?: string[];
}

export interface PublicProfile {
  id: string;
  name: string;
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

/** Row from GET /clubs */
export interface ClubDirectoryEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  emoji: string;
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
  clubId: string;
  clubName: string;
  clubEmoji: string;
  attendeeCount: number;
}

export interface ClubMessage {
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
  createdById: string;
  createdAt: string;
  createdBy?: { id: string; name: string; avatarUrl?: string | null };
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
}

export interface ClubAnnouncementRow {
  id: string;
  clubId: string;
  userId: string;
  content: string;
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
export interface ClubDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  emoji: string;
  isVerified: boolean;
  isPublic: boolean;
  university: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  isMember: boolean;
  myRole: string | null;
  members: ClubMemberWithUser[];
  meetings: Array<{
    id: string;
    clubId: string;
    title: string;
    description: string | null;
    location: string;
    meetingTime: string;
    isPublic: boolean;
    createdById: string;
    createdAt: string;
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
  status: 'FORMING' | 'LOCKED' | 'COMPLETED' | 'EXPIRED';
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
