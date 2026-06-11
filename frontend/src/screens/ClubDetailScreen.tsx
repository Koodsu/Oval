import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  API_USER_MESSAGE,
  checkInToClubMeeting,
  closeClubAttendance,
  assignClubRole,
  createReport,
  createClubRole,
  deleteClub,
  deleteClubAnnouncement,
  deleteClubMeeting,
  deleteClubRole,
  getApiErrorMessage,
  getClubShareUrl,
  getClubMeetingAttendance,
  type ClubOutreachAudience,
  type ClubOutreachPreview,
  type ClubVisibility,
  createClubAnnouncement,
  createClubMeeting,
  getClub,
  getClubAnnouncements,
  getClubMeetings,
  getClubMessages,
  getClubOfficerMessages,
  joinClub,
  leaveClub,
  openClubAttendance,
  patchClubMemberRole,
  removeClubRole,
  removeClubMember,
  rsvpClubMeeting,
  previewClubOutreach,
  sendClubOutreach,
  sendClubMessage,
  sendClubOfficerMessage,
  sendClubRsvpReminders,
  sendClubOfficerTyping,
  sendClubTyping,
  updateOfficerPermissions,
  uploadClubAvatar,
} from '../api';
import { RootStackParamList } from '../../App';
import {
  ClubAnnouncementRow,
  ClubDetail,
  ClubMeetingAttendanceResponse,
  ClubMeetingWithMeta,
  ClubMemberWithUser,
  ClubMessage,
  ClubOfficerMessage,
  ClubRole,
} from '../types';
import {
  AppBackdrop,
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  ScreenHeader,
  SkeletonCard,
  Slab,
  Sticker,
  Tag,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { clubAccent, clubCategoryVisual } from '../constants/clubVisuals';
import { formatDateTime, formatShortDate, formatTime } from '../utils/format';
import { buildClubCalendarIcs } from '../utils/calendar';
import { exportTextFile } from '../utils/fileExport';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  fonts,
  radii,
  spacing,
  useTheme,
} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ClubDetail'>;
type Mode = 'overview' | 'chat' | 'members' | 'events' | 'analytics';
type ChatView = 'hub' | 'announcements' | 'general' | 'officers';
type OutreachAudienceType = 'ALL' | 'NON_RSVP' | 'PRIMARY_ROLE' | 'CUSTOM_ROLE' | 'MANUAL';

const VISIBILITY_OPTIONS: Array<{ value: ClubVisibility; label: string }> = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'MEMBERS', label: 'Members' },
  { value: 'OFFICERS', label: 'Officers' },
];

const RSVP_OPTIONS: Array<{ value: 'GOING' | 'MAYBE' | 'NOT_GOING'; label: string }> = [
  { value: 'GOING', label: 'Going' },
  { value: 'MAYBE', label: 'Maybe' },
  { value: 'NOT_GOING', label: "Can't go" },
];

const MODE_ICONS: Record<Mode, keyof typeof Ionicons.glyphMap> = {
  overview: 'home',
  chat: 'chatbubbles',
  members: 'people',
  events: 'calendar',
  analytics: 'pulse',
};

const CLUB_PERMISSION_OPTIONS = [
  {
    value: 'MANAGE_MEMBERS',
    title: 'Manage members',
    body: 'Remove members and manage roster actions.',
  },
  {
    value: 'MANAGE_ROLES',
    title: 'Manage member tags',
    body: 'Create, delete, and assign custom member tags.',
  },
  {
    value: 'CREATE_MEETINGS',
    title: 'Create meetings',
    body: 'Schedule meetings and manage attendance.',
  },
  {
    value: 'POST_ANNOUNCEMENTS',
    title: 'Post announcements',
    body: 'Publish official club updates.',
  },
  {
    value: 'DELETE_MESSAGES',
    title: 'Moderate messages',
    body: 'Delete member and officer chat messages.',
  },
  {
    value: 'MANAGE_CLUB',
    title: 'Manage club settings',
    body: 'Update club assets and delete the club.',
  },
] as const;

const DEFAULT_OFFICER_PERMISSIONS = ['POST_ANNOUNCEMENTS', 'DELETE_MESSAGES'];
const MEETING_HORIZON_MONTHS = 12;

function latestAllowedMeetingTime() {
  const max = new Date();
  max.setMonth(max.getMonth() + MEETING_HORIZON_MONTHS);
  return max;
}

function sortMeetings(items: ClubMeetingWithMeta[]) {
  return [...items].sort(
    (a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime(),
  );
}

function visibilityLabel(visibility: ClubVisibility): string {
  return (
    {
      PUBLIC: 'Public',
      MEMBERS: 'Members',
      OFFICERS: 'Officers',
    }[visibility] ?? 'Public'
  );
}

function roleRank(role: string | null | undefined) {
  if (role === 'OWNER') return 4;
  if (role === 'ADMIN') return 3;
  if (role === 'OFFICER') return 2;
  if (role === 'MEMBER') return 1;
  return 0;
}

function relativeDayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return formatShortDate(iso);
}

export default function ClubDetailScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { clubId } = route.params;
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('overview');
  const [chatView, setChatView] = useState<ChatView>('hub');
  const [club, setClub] = useState<ClubDetail | null>(null);
  const [meetings, setMeetings] = useState<ClubMeetingWithMeta[]>([]);
  const [announcements, setAnnouncements] = useState<ClubAnnouncementRow[]>([]);
  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [officerMessages, setOfficerMessages] = useState<ClubOfficerMessage[]>([]);
  const [officerTypingUserIds, setOfficerTypingUserIds] = useState<string[]>([]);
  const [messageText, setMessageText] = useState('');
  const [officerMessageText, setOfficerMessageText] = useState('');
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [officerSendBusy, setOfficerSendBusy] = useState(false);
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const [deleteContentBusyId, setDeleteContentBusyId] = useState<string | null>(null);
  const [memberActionUserId, setMemberActionUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingDescription, setMeetingDescription] = useState('');
  const [meetingVisibility, setMeetingVisibility] = useState<ClubVisibility>('PUBLIC');
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementVisibility, setAnnouncementVisibility] = useState<ClubVisibility>('PUBLIC');
  const [announcementTargetRoleIds, setAnnouncementTargetRoleIds] = useState<string[]>([]);
  const [roleNameDraft, setRoleNameDraft] = useState('');
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  const [rolePanelOpen, setRolePanelOpen] = useState(false);
  const [memberRoleEditorUserId, setMemberRoleEditorUserId] = useState<string | null>(null);
  const [meetingTargetRoleIds, setMeetingTargetRoleIds] = useState<string[]>([]);
  const [meetingTime, setMeetingTime] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [meetingComposerOpen, setMeetingComposerOpen] = useState(false);
  const [announcementComposerOpen, setAnnouncementComposerOpen] = useState(false);
  const [leaderToolsMeetingId, setLeaderToolsMeetingId] = useState<string | null>(null);
  const [attendanceCodeDraft, setAttendanceCodeDraft] = useState<Record<string, string>>({});
  const [attendanceBusyId, setAttendanceBusyId] = useState<string | null>(null);
  const [attendancePanels, setAttendancePanels] = useState<
    Record<string, ClubMeetingAttendanceResponse | null>
  >({});
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachAudienceType, setOutreachAudienceType] = useState<OutreachAudienceType>('ALL');
  const [outreachPrimaryRole, setOutreachPrimaryRole] = useState<
    'OWNER' | 'ADMIN' | 'OFFICER' | 'MEMBER'
  >('MEMBER');
  const [outreachRoleId, setOutreachRoleId] = useState<string | null>(null);
  const [outreachManualIds, setOutreachManualIds] = useState<string[]>([]);
  const [outreachText, setOutreachText] = useState('');
  const [outreachPreview, setOutreachPreview] = useState<ClubOutreachPreview | null>(null);
  const [outreachBusy, setOutreachBusy] = useState(false);
  const [outreachResult, setOutreachResult] = useState<string | null>(null);
  const [calendarExportBusy, setCalendarExportBusy] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const officerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectivePermissions = useMemo(() => {
    if (club?.myRole === 'OWNER' || club?.myRole === 'ADMIN') {
      return new Set(CLUB_PERMISSION_OPTIONS.map((permission) => permission.value));
    }
    if (club?.myRole === 'OFFICER') {
      return new Set([...DEFAULT_OFFICER_PERMISSIONS, ...(club.officerPermissions ?? [])]);
    }
    return new Set<string>();
  }, [club?.myRole, club?.officerPermissions]);
  const hasPermission = useCallback(
    (permission: string) => effectivePermissions.has(permission),
    [effectivePermissions],
  );
  const canCreateMeetings = hasPermission('CREATE_MEETINGS');
  const canPostAnnouncements = hasPermission('POST_ANNOUNCEMENTS');
  const canManageMembers = hasPermission('MANAGE_MEMBERS');
  const canManageRoles = hasPermission('MANAGE_ROLES');
  const canManageClub = hasPermission('MANAGE_CLUB');
  const canDeleteClubContent = club?.myRole === 'OWNER' || club?.myRole === 'ADMIN';
  const canViewOfficerChat =
    club?.myRole === 'OWNER' || club?.myRole === 'ADMIN' || club?.myRole === 'OFFICER';
  const canConfigureOfficerPermissions = club?.myRole === 'OWNER' || club?.myRole === 'ADMIN';
  const canChangePrimaryRoles = club?.myRole === 'OWNER' || club?.myRole === 'ADMIN';
  const isSoleOwner =
    club?.myRole === 'OWNER' && club.members.filter((member) => member.role === 'OWNER').length === 1;
  const isMember = !!club?.isMember;
  const clubRoles = club?.roles ?? [];

  const roleAudienceLabel = useCallback(
    (roleIds?: string[]) => {
      const ids = roleIds ?? [];
      if (!ids.length) return 'Everyone in visibility';
      const names = ids
        .map((id) => clubRoles.find((role) => role.id === id)?.name)
        .filter(Boolean);
      return names.length ? names.join(', ') : `${ids.length} selected`;
    },
    [clubRoles],
  );

  const nonRsvpCountForMeeting = useCallback(
    (meeting: ClubMeetingWithMeta) => {
      const responded =
        meeting.rsvpCounts.going + meeting.rsvpCounts.maybe + meeting.rsvpCounts.notGoing;
      const memberCount = (club?.members ?? []).filter((member) => member.userId !== user?.id)
        .length;
      return Math.max(0, memberCount - responded);
    },
    [club?.members, user?.id],
  );

  const canManageThisMember = useCallback(
    (memberRole: string, memberUserId: string) => {
      if (!club?.myRole || memberUserId === user?.id) return false;
      return roleRank(memberRole) < roleRank(club.myRole);
    },
    [club?.myRole, user?.id],
  );

  const load = useCallback(
    async (showAlert = true) => {
      try {
        const clubResponse = await getClub(clubId);
        const requests: Promise<unknown>[] = [
          getClubMeetings(clubId),
          getClubAnnouncements(clubId, { page: 1, limit: 20 }),
        ];

        if (clubResponse.isMember) {
          requests.push(getClubMessages(clubId));
        }
        if (
          clubResponse.myRole === 'OWNER' ||
          clubResponse.myRole === 'ADMIN' ||
          clubResponse.myRole === 'OFFICER'
        ) {
          requests.push(getClubOfficerMessages(clubId));
        }

        const results = await Promise.all(requests);
        const meetingResponse = results[0] as ClubMeetingWithMeta[];
        const announcementResponse = results[1] as { items: ClubAnnouncementRow[] };
        const memberMessageResponse = clubResponse.isMember
          ? (results[2] as { messages: ClubMessage[]; typingUserIds: string[] })
          : null;
        const officerMessageResponse =
          clubResponse.myRole === 'OWNER' ||
          clubResponse.myRole === 'ADMIN' ||
          clubResponse.myRole === 'OFFICER'
            ? (results[clubResponse.isMember ? 3 : 2] as {
                messages: ClubOfficerMessage[];
                typingUserIds: string[];
              })
            : null;

        setClub(clubResponse);
        setMeetings(sortMeetings(meetingResponse));
        setAnnouncements(announcementResponse.items);
        setMessages(memberMessageResponse?.messages ?? []);
        setTypingUserIds(memberMessageResponse?.typingUserIds ?? []);
        setOfficerMessages(officerMessageResponse?.messages ?? []);
        setOfficerTypingUserIds(officerMessageResponse?.typingUserIds ?? []);

        if (!clubResponse.isMember && mode === 'chat') {
          setMode('overview');
        }
        if (!clubResponse.isMember && chatView !== 'hub') {
          setChatView('hub');
        }
        if (
          clubResponse.myRole !== 'OWNER' &&
          clubResponse.myRole !== 'ADMIN' &&
          clubResponse.myRole !== 'OFFICER' &&
          chatView === 'officers'
        ) {
          setChatView('hub');
        }
        setLoadError(null);
      } catch (error) {
        setLoadError(getApiErrorMessage(error));
        if (showAlert) {
          Alert.alert('Could not load club', getApiErrorMessage(error));
        }
      }
    },
    [chatView, clubId, mode],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      const interval = setInterval(() => {
        void load(false);
      }, 4000);

      return () => {
        clearInterval(interval);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        if (officerTypingTimerRef.current) clearTimeout(officerTypingTimerRef.current);
      };
    }, [load]),
  );

  const pingTyping = useCallback(
    (draft: string) => {
      if (!isMember || !draft.trim()) return;
      if (typingTimerRef.current) return;
      typingTimerRef.current = setTimeout(() => {
        typingTimerRef.current = null;
      }, 2500);
      void sendClubTyping(clubId).catch(() => {});
    },
    [clubId, isMember],
  );

  const pingOfficerTyping = useCallback(
    (draft: string) => {
      if (!canViewOfficerChat || !draft.trim()) return;
      if (officerTypingTimerRef.current) return;
      officerTypingTimerRef.current = setTimeout(() => {
        officerTypingTimerRef.current = null;
      }, 2500);
      void sendClubOfficerTyping(clubId).catch(() => {});
    },
    [canViewOfficerChat, clubId],
  );

  const confirmDestructive = useCallback(
    (title: string, message: string, confirmLabel: string, onConfirm: () => void) => {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: confirmLabel, style: 'destructive', onPress: onConfirm },
      ]);
    },
    [],
  );

  const handleShareClub = useCallback(async () => {
    if (!club) return;
    try {
      await Share.share({
        title: club.name,
        message: `${club.name}\n${getClubShareUrl(club.id)}`,
      });
    } catch {
      Alert.alert('Could not share club', API_USER_MESSAGE);
    }
  }, [club]);

  const handleExportCalendar = useCallback(async () => {
    if (!club || meetings.length === 0) return;
    setCalendarExportBusy(true);
    try {
      const safeName =
        club.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'club';
      await exportTextFile({
        filename: `${safeName}-bridge-calendar.ics`,
        contents: buildClubCalendarIcs(club, meetings),
        mimeType: 'text/calendar',
        uti: 'com.apple.ical.ics',
        title: `Add ${club.name} to Apple Calendar`,
      });
    } catch (error) {
      Alert.alert('Could not export calendar', getApiErrorMessage(error));
    } finally {
      setCalendarExportBusy(false);
    }
  }, [club, meetings]);

  const handleDeleteClub = useCallback(() => {
    if (!club) return;
    confirmDestructive(
      'Delete club?',
      `This permanently deletes ${club.name}, including its members, meetings, announcements, and chats.`,
      'Delete club',
      async () => {
        setMembershipBusy(true);
        try {
          await deleteClub(club.id);
          navigation.goBack();
        } catch {
          Alert.alert('Could not delete club', API_USER_MESSAGE);
        } finally {
          setMembershipBusy(false);
        }
      },
    );
  }, [club, confirmDestructive, navigation]);

  const handleMembership = async () => {
    if (!club) return;
    if (club.isMember) {
      confirmDestructive(
        'Leave club?',
        `You will lose member access to ${club.name}'s private chats, meetings, and announcements.`,
        'Leave club',
        async () => {
          setMembershipBusy(true);
          try {
            await leaveClub(club.id);
            await load(false);
          } catch {
            Alert.alert('Could not update membership', API_USER_MESSAGE);
          } finally {
            setMembershipBusy(false);
          }
        },
      );
      return;
    }
    setMembershipBusy(true);
    try {
      await joinClub(club.id);
      await load(false);
    } catch {
      Alert.alert('Could not update membership', API_USER_MESSAGE);
    } finally {
      setMembershipBusy(false);
    }
  };

  const handleUploadClubAvatar = async () => {
    if (!club) return;
    setAvatarBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo permission needed', 'Allow photo access to upload a club avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      const uploaded = await uploadClubAvatar(club.id, result.assets[0].uri);
      setClub((current) => (current ? { ...current, avatarUrl: uploaded.avatarUrl } : current));
    } catch {
      Alert.alert('Could not update club avatar', API_USER_MESSAGE);
    } finally {
      setAvatarBusy(false);
    }
  };

  const reportClub = useCallback(async () => {
    if (!club) return;
    try {
      await createReport({
        clubId: club.id,
        reason: 'OTHER',
        details: `Club profile: ${club.name}`,
      });
      Alert.alert('Report sent', 'Thanks. We logged this club for review.');
    } catch (error) {
      Alert.alert('Could not send report', getApiErrorMessage(error));
    }
  }, [club]);

  const reportClubMessage = async (message: ClubMessage | ClubOfficerMessage, officer = false) => {
    try {
      await createReport({
        clubId,
        targetUserId: message.userId,
        [officer ? 'clubOfficerMessageId' : 'clubMessageId']: message.id,
        reason: 'HARASSMENT',
      });
      Alert.alert('Report sent', 'Thanks. We logged this message for review.');
    } catch (error) {
      Alert.alert('Could not send report', getApiErrorMessage(error));
    }
  };

  const reportAnnouncement = async (announcement: ClubAnnouncementRow) => {
    try {
      await createReport({
        clubId,
        targetUserId: announcement.user.id,
        clubAnnouncementId: announcement.id,
        reason: 'OTHER',
      });
      Alert.alert('Report sent', 'Thanks. We logged this announcement for review.');
    } catch (error) {
      Alert.alert('Could not send report', getApiErrorMessage(error));
    }
  };

  const handleClubActions = useCallback(() => {
    if (!club) return;
    const buttons: Array<{
      text: string;
      style?: 'default' | 'cancel' | 'destructive';
      onPress?: () => void;
    }> = [];

    if (canManageClub) {
      buttons.push({
        text: avatarBusy ? 'Updating photo...' : 'Update club photo',
        onPress: () => void handleUploadClubAvatar(),
      });
    }
    if (canConfigureOfficerPermissions) {
      buttons.push({
        text: 'Officer permissions',
        onPress: () => {
          setMode('members');
          setRolePanelOpen(true);
        },
      });
    }
    buttons.push({ text: 'Share club', onPress: () => void handleShareClub() });
    buttons.push({ text: 'Report club', onPress: () => void reportClub() });
    if (club.isMember) {
      buttons.push({
        text: 'Leave club',
        style: 'destructive',
        onPress: () => void handleMembership(),
      });
    }
    if (canManageClub) {
      buttons.push({ text: 'Delete club', style: 'destructive', onPress: handleDeleteClub });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Club actions', undefined, buttons);
  }, [
    avatarBusy,
    canConfigureOfficerPermissions,
    canManageClub,
    club,
    handleDeleteClub,
    handleShareClub,
    handleMembership,
    reportClub,
  ]);

  const handleRsvp = async (meetingId: string, status: 'GOING' | 'MAYBE' | 'NOT_GOING') => {
    const previous = meetings;
    setMeetings((current) =>
      current.map((meeting) =>
        meeting.id === meetingId ? { ...meeting, myRsvp: status } : meeting,
      ),
    );
    try {
      await rsvpClubMeeting(meetingId, status);
      await load(false);
    } catch {
      setMeetings(previous);
      Alert.alert('Could not RSVP', API_USER_MESSAGE);
    }
  };

  const handleSend = async () => {
    if (!messageText.trim()) return;
    setSendBusy(true);
    try {
      const sent = await sendClubMessage(clubId, messageText.trim());
      setMessageText('');
      setMessages((current) => [...current, sent]);
    } catch (error) {
      Alert.alert('Could not send message', getApiErrorMessage(error));
    } finally {
      setSendBusy(false);
    }
  };

  const handleOfficerSend = async () => {
    if (!officerMessageText.trim()) return;
    setOfficerSendBusy(true);
    try {
      const sent = await sendClubOfficerMessage(clubId, officerMessageText.trim());
      setOfficerMessageText('');
      setOfficerMessages((current) => [...current, sent]);
    } catch (error) {
      Alert.alert('Could not send officer message', getApiErrorMessage(error));
    } finally {
      setOfficerSendBusy(false);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!announcementText.trim()) {
      Alert.alert('Missing announcement', 'Write the announcement before posting it.');
      return;
    }
    setAnnouncementBusy(true);
    try {
      const created = await createClubAnnouncement(clubId, {
        content: announcementText.trim(),
        visibility: announcementVisibility,
        targetRoleIds: announcementTargetRoleIds,
      });
      setAnnouncementText('');
      setAnnouncementTargetRoleIds([]);
      setAnnouncements((current) => [created, ...current]);
      setChatView('announcements');
    } catch {
      Alert.alert('Could not post announcement', API_USER_MESSAGE);
    } finally {
      setAnnouncementBusy(false);
    }
  };

  const handleDeleteAnnouncement = (announcement: ClubAnnouncementRow) => {
    if (!club) return;
    confirmDestructive(
      'Delete announcement?',
      'This permanently removes the announcement from the club.',
      'Delete announcement',
      async () => {
        setDeleteContentBusyId(`announcement:${announcement.id}`);
        try {
          await deleteClubAnnouncement(club.id, announcement.id);
          setAnnouncements((current) => current.filter((item) => item.id !== announcement.id));
        } catch {
          Alert.alert('Could not delete announcement', API_USER_MESSAGE);
        } finally {
          setDeleteContentBusyId(null);
        }
      },
    );
  };

  const handleCreateMeeting = async () => {
    if (!club || !meetingTitle.trim() || !meetingLocation.trim()) {
      Alert.alert('Missing meeting info', 'Add a title and location before creating the meeting.');
      return;
    }
    const latestAllowed = latestAllowedMeetingTime().getTime();
    if (meetingTime.getTime() > latestAllowed || meetingTime.getTime() < Date.now()) {
      Alert.alert(
        'Choose a valid time',
        'Meetings need to be scheduled between now and the next 12 months.',
      );
      return;
    }
    setMeetingBusy(true);
    try {
      const newMeeting = await createClubMeeting(club.id, {
        title: meetingTitle.trim(),
        location: meetingLocation.trim(),
        description: meetingDescription.trim() || undefined,
        meetingTime: meetingTime.toISOString(),
        visibility: meetingVisibility,
        targetRoleIds: meetingTargetRoleIds,
      });
      setMeetingTitle('');
      setMeetingLocation('');
      setMeetingDescription('');
      setMeetingVisibility('PUBLIC');
      setMeetingTargetRoleIds([]);
      setMeetings((current) => sortMeetings([newMeeting, ...current]));
      setMeetingComposerOpen(false);
      setMode('events');
    } catch (error) {
      Alert.alert('Could not create meeting', getApiErrorMessage(error));
    } finally {
      setMeetingBusy(false);
    }
  };

  const handleDeleteMeeting = (meeting: ClubMeetingWithMeta) => {
    if (!club) return;
    confirmDestructive(
      'Delete meeting?',
      `${meeting.title} will be removed from the club calendar.`,
      'Delete meeting',
      async () => {
        setDeleteContentBusyId(`meeting:${meeting.id}`);
        try {
          await deleteClubMeeting(club.id, meeting.id);
          setMeetings((current) => current.filter((item) => item.id !== meeting.id));
          setAttendancePanels((current) => {
            const next = { ...current };
            delete next[meeting.id];
            return next;
          });
        } catch {
          Alert.alert('Could not delete meeting', API_USER_MESSAGE);
        } finally {
          setDeleteContentBusyId(null);
        }
      },
    );
  };

  const handleOpenAttendance = async (meetingId: string) => {
    if (!club) return;
    const meeting = meetings.find((item) => item.id === meetingId);
    if (meeting?.attendanceCode) {
      confirmDestructive(
        'Regenerate attendance code?',
        'The current attendance code will stop working and a new code will be shown.',
        'Regenerate code',
        () => {
          void handleOpenAttendanceNow(meetingId);
        },
      );
      return;
    }
    await handleOpenAttendanceNow(meetingId);
  };

  const handleOpenAttendanceNow = async (meetingId: string) => {
    if (!club) return;
    setAttendanceBusyId(`open-${meetingId}`);
    try {
      const result = await openClubAttendance(club.id, meetingId);
      setMeetings((current) =>
        current.map((meeting) =>
          meeting.id === meetingId ? { ...meeting, attendanceCode: result.attendanceCode } : meeting,
        ),
      );
    } catch {
      Alert.alert('Could not open attendance', API_USER_MESSAGE);
    } finally {
      setAttendanceBusyId(null);
    }
  };

  const handleCloseAttendance = async (meetingId: string) => {
    if (!club) return;
    confirmDestructive(
      'Close attendance?',
      'Members will no longer be able to check in with the current attendance code.',
      'Close attendance',
      async () => {
        setAttendanceBusyId(`close-${meetingId}`);
        try {
          await closeClubAttendance(club.id, meetingId);
          setMeetings((current) =>
            current.map((meeting) =>
              meeting.id === meetingId ? { ...meeting, attendanceCode: null } : meeting,
            ),
          );
        } catch {
          Alert.alert('Could not close attendance', API_USER_MESSAGE);
        } finally {
          setAttendanceBusyId(null);
        }
      },
    );
  };

  const handleCheckIn = async (meetingId: string) => {
    if (!club) return;
    const code = attendanceCodeDraft[meetingId]?.trim();
    if (!code) {
      Alert.alert('Attendance code required', 'Enter the code shared by a club leader to check in.');
      return;
    }
    setAttendanceBusyId(`checkin-${meetingId}`);
    try {
      const result = await checkInToClubMeeting(club.id, meetingId, code);
      setMeetings((current) =>
        current.map((meeting) =>
          meeting.id === meetingId ? { ...meeting, attendeeCount: result.attendedCount } : meeting,
        ),
      );
      setAttendanceCodeDraft((current) => ({ ...current, [meetingId]: '' }));
      Alert.alert('Checked in', 'Your attendance has been recorded.');
    } catch {
      Alert.alert('Could not check in', API_USER_MESSAGE);
    } finally {
      setAttendanceBusyId(null);
    }
  };

  const handleLoadAttendance = async (meetingId: string) => {
    if (!club) return;
    setAttendanceBusyId(`view-${meetingId}`);
    try {
      const attendance = await getClubMeetingAttendance(club.id, meetingId);
      setAttendancePanels((current) => ({ ...current, [meetingId]: attendance }));
    } catch {
      Alert.alert('Could not load attendance', API_USER_MESSAGE);
    } finally {
      setAttendanceBusyId(null);
    }
  };

  const handleCopyAttendanceCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      Alert.alert('Code copied', 'Attendance code copied to clipboard.');
    } catch {
      Alert.alert('Could not copy code', API_USER_MESSAGE);
    }
  };

  const handleShareAttendanceCode = async (meeting: ClubMeetingWithMeta) => {
    if (!meeting.attendanceCode) return;
    try {
      await Share.share({
        title: meeting.title,
        message: `${meeting.title} attendance code: ${meeting.attendanceCode}`,
      });
    } catch {
      Alert.alert('Could not share code', API_USER_MESSAGE);
    }
  };

  const handleSendRsvpReminder = (meeting: ClubMeetingWithMeta) => {
    if (!club) return;
    Alert.alert(
      'Send RSVP reminder?',
      `This will notify members who have not RSVP'd for ${meeting.title}. You'll see the exact count after the backend checks the audience.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send reminder',
          onPress: async () => {
            setAttendanceBusyId(`rsvp-${meeting.id}`);
            try {
              const result = await sendClubRsvpReminders(club.id, meeting.id);
              setMeetings((current) =>
                current.map((item) =>
                  item.id === meeting.id
                    ? {
                        ...item,
                        rsvpReminderSentAt: result.lastSentAt,
                        rsvpReminderStatus: result.status,
                        rsvpReminderCount: result.count,
                        rsvpReminderError: null,
                      }
                    : item,
                ),
              );
              Alert.alert(
                'Reminder sent',
                `${result.count} member${result.count === 1 ? '' : 's'} matched. ${result.sent} push notification${result.sent === 1 ? '' : 's'} queued.`,
              );
            } catch {
              Alert.alert('Could not send reminder', API_USER_MESSAGE);
            } finally {
              setAttendanceBusyId(null);
            }
          },
        },
      ],
    );
  };

  const handlePreviewOutreach = async () => {
    if (!club) return;
    const audience = buildOutreachAudience();
    if (!audience) {
      Alert.alert('Choose an audience', 'Select a meeting or role before previewing outreach.');
      return;
    }
    setOutreachBusy(true);
    try {
      const preview = await previewClubOutreach(club.id, audience);
      setOutreachPreview(preview);
      setOutreachResult(null);
    } catch (error) {
      Alert.alert('Could not preview audience', getApiErrorMessage(error));
    } finally {
      setOutreachBusy(false);
    }
  };

  const handleSendOutreach = async () => {
    if (!club) return;
    const audience = buildOutreachAudience();
    if (!audience) {
      Alert.alert('Choose an audience', 'Select a meeting or role before sending outreach.');
      return;
    }
    if (!outreachText.trim()) {
      Alert.alert('Write a message', 'Compose the outreach message before sending.');
      return;
    }
    const count = outreachPreview?.count ?? 0;
    Alert.alert(
      'Send outreach?',
      `This will notify ${count} member${count === 1 ? '' : 's'}. Review the recipient list before sending.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setOutreachBusy(true);
            try {
              const sent = await sendClubOutreach(club.id, audience, outreachText.trim());
              setOutreachPreview(sent);
              setOutreachResult(
                `Sent ${sent.sent} push notification${sent.sent === 1 ? '' : 's'} to ${sent.count} matching member${sent.count === 1 ? '' : 's'}.`,
              );
              setOutreachText('');
            } catch {
              Alert.alert('Could not send outreach', API_USER_MESSAGE);
            } finally {
              setOutreachBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleRoleChange = async (memberUserId: string, role: 'ADMIN' | 'OFFICER' | 'MEMBER') => {
    const member = club?.members.find((item) => item.userId === memberUserId);
    const verb = roleRank(role) > roleRank(member?.role) ? 'Promote' : 'Demote';
    confirmDestructive(
      `${verb} member?`,
      `${member?.user.name ?? 'This member'} will become ${role.toLowerCase()}. This changes their club access immediately.`,
      verb,
      async () => {
        await handleRoleChangeNow(memberUserId, role);
      },
    );
  };

  const handleRoleChangeNow = async (memberUserId: string, role: 'ADMIN' | 'OFFICER' | 'MEMBER') => {
    setMemberActionUserId(memberUserId);
    try {
      const updated = await patchClubMemberRole(clubId, memberUserId, { role });
      setClub((current) =>
        current
          ? {
              ...current,
              members: current.members.map((member) =>
                member.userId === memberUserId ? updated : member,
              ),
            }
          : current,
      );
    } catch {
      Alert.alert('Could not update role', API_USER_MESSAGE);
    } finally {
      setMemberActionUserId(null);
    }
  };

  const handleCreateRole = async () => {
    if (!club || !roleNameDraft.trim()) {
      Alert.alert('Role name required', 'Add a name before creating the role.');
      return;
    }
    setRoleBusyId('create');
    try {
      const created = await createClubRole(club.id, roleNameDraft.trim());
      setClub((current) =>
        current ? { ...current, roles: [...(current.roles ?? []), created] } : current,
      );
      setRoleNameDraft('');
    } catch {
      Alert.alert('Could not create role', API_USER_MESSAGE);
    } finally {
      setRoleBusyId(null);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!club) return;
    const role = club.roles?.find((item) => item.id === roleId);
    confirmDestructive(
      'Delete member tag?',
      `${role?.name ?? 'This role'} will be removed from the club and all assigned members.`,
      'Delete tag',
      async () => {
        await handleDeleteRoleNow(roleId);
      },
    );
  };

  const handleDeleteRoleNow = async (roleId: string) => {
    if (!club) return;
    setRoleBusyId(`delete:${roleId}`);
    try {
      await deleteClubRole(club.id, roleId);
      setClub((current) =>
        current
          ? {
              ...current,
              roles: (current.roles ?? []).filter((role) => role.id !== roleId),
              members: current.members.map((member) => ({
                ...member,
                customRoles: (member.customRoles ?? []).filter(
                  (assignment) => assignment.roleId !== roleId,
                ),
              })),
            }
          : current,
      );
      setAnnouncementTargetRoleIds((current) => current.filter((id) => id !== roleId));
      setMeetingTargetRoleIds((current) => current.filter((id) => id !== roleId));
    } catch {
      Alert.alert('Could not delete role', API_USER_MESSAGE);
    } finally {
      setRoleBusyId(null);
    }
  };

  const handleToggleMemberTag = async (memberUserId: string, roleId: string, assigned: boolean) => {
    if (!club) return;
    setRoleBusyId(`${memberUserId}:${roleId}`);
    try {
      if (assigned) {
        await removeClubRole(club.id, roleId, memberUserId);
        setClub((current) =>
          current
            ? {
                ...current,
                members: current.members.map((member) =>
                  member.userId === memberUserId
                    ? {
                        ...member,
                        customRoles: (member.customRoles ?? []).filter(
                          (role) => role.roleId !== roleId,
                        ),
                      }
                    : member,
                ),
              }
            : current,
        );
      } else {
        const updated = await assignClubRole(club.id, roleId, memberUserId);
        setClub((current) =>
          current
            ? {
                ...current,
                members: current.members.map((member) =>
                  member.userId === memberUserId ? updated : member,
                ),
              }
            : current,
        );
      }
    } catch {
      Alert.alert('Could not update role', API_USER_MESSAGE);
    } finally {
      setRoleBusyId(null);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    const member = club?.members.find((item) => item.userId === memberUserId);
    confirmDestructive(
      'Remove member?',
      `${member?.user.name ?? 'This member'} will lose access to member-only club spaces.`,
      'Remove',
      async () => {
        await handleRemoveMemberNow(memberUserId);
      },
    );
  };

  const handleRemoveMemberNow = async (memberUserId: string) => {
    setMemberActionUserId(memberUserId);
    try {
      await removeClubMember(clubId, memberUserId);
      setClub((current) =>
        current
          ? {
              ...current,
              members: current.members.filter((member) => member.userId !== memberUserId),
            }
          : current,
      );
    } catch {
      Alert.alert('Could not remove member', API_USER_MESSAGE);
    } finally {
      setMemberActionUserId(null);
    }
  };

  const handleToggleOfficerPermission = async (permission: string) => {
    if (!club) return;
    const currentPermissions = club.officerPermissions ?? [];
    const nextPermissions = currentPermissions.includes(permission)
      ? currentPermissions.filter((item) => item !== permission)
      : [...currentPermissions, permission];
    setPermissionBusy(true);
    try {
      const updated = await updateOfficerPermissions(club.id, nextPermissions);
      setClub((current) =>
        current ? { ...current, officerPermissions: updated.officerPermissions } : current,
      );
    } catch {
      Alert.alert('Could not update permissions', API_USER_MESSAGE);
    } finally {
      setPermissionBusy(false);
    }
  };

  const modeOptions = useMemo(() => {
    const options: Array<{ value: Mode; label: string }> = [{ value: 'overview', label: 'Overview' }];
    if (isMember) options.push({ value: 'chat', label: 'Chats' });
    options.push({ value: 'members', label: 'Members' });
    options.push({ value: 'events', label: 'Events' });
    if (canPostAnnouncements || canCreateMeetings || canManageMembers) {
      options.push({ value: 'analytics', label: 'Health' });
    }
    return options;
  }, [canCreateMeetings, canManageMembers, canPostAnnouncements, isMember]);

  const nextMeeting = useMemo(() => meetings[0] ?? null, [meetings]);
  const categoryVisual = useMemo(() => clubCategoryVisual(club?.category), [club?.category]);
  const accent = useMemo(() => clubAccent(colors, club?.category), [colors, club?.category]);
  const buildOutreachAudience = useCallback((): ClubOutreachAudience | null => {
    if (outreachAudienceType === 'ALL') return { type: 'ALL' };
    if (outreachAudienceType === 'NON_RSVP') {
      return nextMeeting ? { type: 'NON_RSVP', meetingId: nextMeeting.id } : null;
    }
    if (outreachAudienceType === 'PRIMARY_ROLE') {
      return { type: 'PRIMARY_ROLE', role: outreachPrimaryRole };
    }
    if (outreachAudienceType === 'CUSTOM_ROLE') {
      return outreachRoleId ? { type: 'CUSTOM_ROLE', roleId: outreachRoleId } : null;
    }
    return { type: 'MANUAL', userIds: outreachManualIds };
  }, [nextMeeting, outreachAudienceType, outreachManualIds, outreachPrimaryRole, outreachRoleId]);
  const analytics = useMemo(() => {
    const memberCount = club?.members.length ?? 0;
    const upcomingCount = meetings.length;
    const rsvpGoing = meetings.reduce((sum, meeting) => sum + meeting.rsvpCounts.going, 0);
    const rsvpMaybe = meetings.reduce((sum, meeting) => sum + meeting.rsvpCounts.maybe, 0);
    const rsvpNotGoing = meetings.reduce((sum, meeting) => sum + meeting.rsvpCounts.notGoing, 0);
    const checkedIn = meetings.reduce((sum, meeting) => sum + meeting.attendeeCount, 0);
    return {
      memberCount,
      upcomingCount,
      rsvpGoing,
      rsvpMaybe,
      rsvpNotGoing,
      checkedIn,
      announcements: announcements.length,
      responseRate:
        memberCount && upcomingCount
          ? Math.round(
              ((rsvpGoing + rsvpMaybe + rsvpNotGoing) / (memberCount * upcomingCount)) * 100,
            )
          : null,
    };
  }, [announcements.length, club?.members.length, meetings]);
  const recentMembers = useMemo(() => club?.members.slice(0, 5) ?? [], [club?.members]);
  const memberGroups = useMemo(() => {
    const members = club?.members ?? [];
    const leadership = members
      .filter((member) => roleRank(member.role) >= 2)
      .sort((a, b) => roleRank(b.role) - roleRank(a.role));
    const general = members.filter((member) => roleRank(member.role) < 2);
    return { leadership, general };
  }, [club?.members]);

  const openMemberActions = useCallback(
    (member: ClubMemberWithUser) => {
      const buttons: Array<{
        text: string;
        style?: 'default' | 'cancel' | 'destructive';
        onPress?: () => void;
      }> = [];
      if (canChangePrimaryRoles && club?.myRole === 'OWNER' && member.role !== 'ADMIN') {
        buttons.push({
          text: 'Make admin',
          onPress: () => void handleRoleChange(member.userId, 'ADMIN'),
        });
      }
      if (canChangePrimaryRoles && member.role === 'MEMBER') {
        buttons.push({
          text: 'Promote to officer',
          onPress: () => void handleRoleChange(member.userId, 'OFFICER'),
        });
      } else if (canChangePrimaryRoles && (member.role === 'OFFICER' || member.role === 'ADMIN')) {
        buttons.push({
          text: member.role === 'ADMIN' ? 'Demote to officer' : 'Demote to member',
          onPress: () =>
            void handleRoleChange(member.userId, member.role === 'ADMIN' ? 'OFFICER' : 'MEMBER'),
        });
      }
      if (canManageRoles && clubRoles.length) {
        buttons.push({
          text: 'Manage member tags',
          onPress: () =>
            setMemberRoleEditorUserId((current) =>
              current === member.userId ? null : member.userId,
            ),
        });
      }
      if (canManageMembers) {
        buttons.push({
          text: 'Remove from club',
          style: 'destructive',
          onPress: () => void handleRemoveMember(member.userId),
        });
      }
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert(member.user.name, member.role.toLowerCase(), buttons);
    },
    [
      canChangePrimaryRoles,
      canManageMembers,
      canManageRoles,
      club?.myRole,
      clubRoles.length,
      handleRoleChange,
      handleRemoveMember,
    ],
  );
  const chatCards = useMemo(() => {
    const cards: Array<{
      key: ChatView;
      audience: string;
      title: string;
      subtitle: string;
      badge?: number;
      icon: keyof typeof Ionicons.glyphMap;
    }> = [
      {
        key: 'announcements',
        audience: 'PUBLIC',
        title: 'Announcements',
        subtitle: 'Public club updates',
        badge: announcements.length,
        icon: 'megaphone',
      },
      {
        key: 'general',
        audience: 'MEMBERS',
        title: 'General Chat',
        subtitle: 'Members-only conversation',
        badge: messages.length,
        icon: 'chatbubble-ellipses',
      },
    ];
    if (canViewOfficerChat) {
      cards.push({
        key: 'officers',
        audience: 'OFFICERS',
        title: 'Officers Chat',
        subtitle: 'Leadership coordination',
        badge: officerMessages.length,
        icon: 'shield-checkmark',
      });
    }
    return cards;
  }, [announcements.length, canViewOfficerChat, messages.length, officerMessages.length]);

  const renderMemberRow = (member: ClubMemberWithUser) => {
    const manageable = canManageThisMember(member.role, member.userId);
    const hasActions =
      manageable &&
      (canManageMembers || canChangePrimaryRoles || (canManageRoles && clubRoles.length > 0));
    const tags = member.customRoles ?? [];
    return (
      <View style={styles.memberRow}>
        <View style={styles.memberRowMain}>
          <Pressable
            style={styles.memberRowProfile}
            onPress={() => navigation.navigate('UserProfile', { userId: member.userId })}
            accessibilityRole="button"
            accessibilityLabel={`Open ${member.user.name}'s profile`}
          >
            <Avatar name={member.user.name} uri={member.user.avatarUrl} size={40} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View style={styles.memberNameRow}>
                <Text style={typography.subheading} numberOfLines={1}>
                  {member.user.name}
                </Text>
                {member.role !== 'MEMBER' ? (
                  <Sticker
                    label={member.role}
                    tint={
                      member.role === 'OWNER'
                        ? colors.primarySoft
                        : member.role === 'ADMIN'
                          ? colors.violetSoft
                          : colors.blueSoft
                    }
                    small
                    tilt={-2}
                  />
                ) : null}
              </View>
              <Text style={typography.captionSmall} numberOfLines={1}>
                {member.user.major ?? 'Undeclared'}
                {tags.length
                  ? ` • ${tags.map((assignment) => assignment.role.name).join(', ')}`
                  : ''}
              </Text>
            </View>
          </Pressable>
          {hasActions ? (
            <Pressable
              style={styles.memberActionButton}
              onPress={() => openMemberActions(member)}
              disabled={memberActionUserId === member.userId}
              accessibilityRole="button"
              accessibilityLabel={`Actions for ${member.user.name}`}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.sub} />
            </Pressable>
          ) : null}
        </View>
        {memberRoleEditorUserId === member.userId ? (
          <View style={styles.roleAssignWrap}>
            {(club?.roles ?? []).map((role) => {
              const assigned = tags.some((assignment) => assignment.roleId === role.id);
              const busy = roleBusyId === `${member.userId}:${role.id}`;
              return (
                <Chip
                  key={role.id}
                  label={role.name}
                  selected={assigned}
                  icon={assigned ? 'checkmark-circle' : 'add-circle-outline'}
                  onPress={
                    busy ? undefined : () => void handleToggleMemberTag(member.userId, role.id, assigned)
                  }
                />
              );
            })}
          </View>
        ) : null}
      </View>
    );
  };

  if (!club && loadError) {
    return (
      <AppBackdrop>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <ScreenHeader title="Club" onBack={() => navigation.goBack()} />
          <EmptyState icon="alert-circle" title="Could not load club" body={loadError} />
          <Button label="Try again" onPress={() => void load(false)} />
        </ScrollView>
      </AppBackdrop>
    );
  }

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {club ? (
          <>
            <ScreenHeader
              title="Club"
              kicker={club.category}
              onBack={() => navigation.goBack()}
              right={
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {canManageClub ? (
                    <IconButton
                      icon="camera-outline"
                      onPress={() => void handleUploadClubAvatar()}
                      disabled={avatarBusy}
                      accessibilityLabel={club.avatarUrl ? 'Change club photo' : 'Add club photo'}
                    />
                  ) : null}
                  <IconButton
                    icon="ellipsis-horizontal"
                    onPress={handleClubActions}
                    accessibilityLabel="Club actions"
                  />
                </View>
              }
            />

            {/* Identity card */}
            <Slab color={accent.soft} radius={radii.lg} accessibilityRole="none" faceStyle={styles.heroFace}>
              <View style={styles.identityRow}>
                <View
                  style={[
                    styles.clubAvatar,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {club.avatarUrl ? (
                    <Image source={{ uri: club.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Text style={styles.clubEmoji}>{club.emoji}</Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={styles.clubTitle}>{club.name}</Text>
                  <Text style={typography.caption}>{club.university}</Text>
                  <View style={styles.stickerRow}>
                    <Sticker
                      label={club.category ?? 'Club'}
                      tint={colors.surface}
                      icon={categoryVisual.icon}
                      small
                      tilt={-2}
                    />
                    {club.isVerified ? (
                      <Sticker
                        label="Verified"
                        tint={colors.successSoft}
                        icon="checkmark-circle"
                        small
                        tilt={2}
                      />
                    ) : null}
                  </View>
                </View>
              </View>

              {club.description ? (
                <Text style={[typography.body, { color: colors.sub }]}>{club.description}</Text>
              ) : null}

              <View style={[styles.statStrip, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{club.members.length}</Text>
                  <Text style={styles.statLabel}>MEMBER{club.members.length === 1 ? '' : 'S'}</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.borderSoft }]} />
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>{meetings.length}</Text>
                  <Text style={styles.statLabel}>UPCOMING</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.borderSoft }]} />
                <View style={styles.statCell}>
                  <Text style={styles.statValue}>
                    {nextMeeting ? nextMeeting.rsvpCounts.going : 0}
                  </Text>
                  <Text style={styles.statLabel}>GOING NEXT</Text>
                </View>
              </View>

              {isSoleOwner ? (
                <Button
                  label="Manage club"
                  variant="secondary"
                  icon="settings"
                  onPress={handleClubActions}
                />
              ) : club.isMember ? (
                <Button
                  label={membershipBusy ? 'Updating…' : 'Leave club'}
                  variant="secondary"
                  icon="log-out"
                  onPress={() => void handleMembership()}
                  disabled={membershipBusy}
                />
              ) : (
                <Button
                  label={membershipBusy ? 'Updating…' : 'Join club'}
                  icon="flash"
                  onPress={() => void handleMembership()}
                  disabled={membershipBusy}
                  size="lg"
                />
              )}
            </Slab>

            {loadError ? <Banner message={loadError} kind="error" /> : null}

            {/* Mode tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabRow}
            >
              {modeOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  icon={MODE_ICONS[option.value]}
                  selected={mode === option.value}
                  onPress={() => {
                    setMode(option.value);
                    if (option.value !== 'chat') setChatView('hub');
                  }}
                />
              ))}
            </ScrollView>

            {/* ── OVERVIEW ── */}
            {mode === 'overview' ? (
              <View style={styles.section}>
                <SectionRow
                  title="Next meeting"
                  actionLabel={meetings.length ? 'See all' : undefined}
                  onPress={() => setMode('events')}
                />

                {nextMeeting ? (
                  <Card padded>
                    <View style={styles.upcomingHead}>
                      <DateBadge iso={nextMeeting.meetingTime} large />
                      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                        <Text style={[typography.kicker, { color: colors.primary }]}>
                          {relativeDayLabel(nextMeeting.meetingTime).toUpperCase()} •{' '}
                          {formatTime(nextMeeting.meetingTime)}
                        </Text>
                        <Text style={typography.heading} numberOfLines={2}>
                          {nextMeeting.title}
                        </Text>
                        <View style={styles.inlineMeta}>
                          <Ionicons name="location" size={12} color={colors.faint} />
                          <Text style={typography.captionSmall} numberOfLines={1}>
                            {nextMeeting.location}
                          </Text>
                        </View>
                        <View style={styles.attendeeRow}>
                          {recentMembers.slice(0, 4).map((member, index) => (
                            <Avatar
                              key={member.id}
                              name={member.user.name}
                              uri={member.user.avatarUrl}
                              size={24}
                              style={{ marginLeft: index === 0 ? 0 : -8 }}
                            />
                          ))}
                          <Text style={[typography.captionSmall, { marginLeft: 6 }]}>
                            {nextMeeting.rsvpCounts.going} going
                          </Text>
                        </View>
                      </View>
                    </View>

                    {isMember ? (
                      <View style={styles.rsvpRow}>
                        {RSVP_OPTIONS.map((option) => (
                          <Chip
                            key={option.value}
                            label={option.label}
                            selected={nextMeeting.myRsvp === option.value}
                            tint={
                              option.value === 'GOING'
                                ? colors.successSoft
                                : option.value === 'MAYBE'
                                  ? colors.warningSoft
                                  : colors.dangerSoft
                            }
                            onPress={() => void handleRsvp(nextMeeting.id, option.value)}
                          />
                        ))}
                      </View>
                    ) : null}
                  </Card>
                ) : (
                  <EmptyState
                    icon="calendar"
                    title="No upcoming meetings"
                    body="Schedule your first event to kick the club dashboard into motion."
                  />
                )}

                {canPostAnnouncements || canCreateMeetings ? (
                  <View style={styles.quickRow}>
                    {canPostAnnouncements ? (
                      <QuickAction
                        icon="megaphone"
                        title="Announce"
                        tint={colors.amberSoft}
                        onPress={() => {
                          setMode('chat');
                          setChatView('announcements');
                          setAnnouncementComposerOpen(true);
                        }}
                      />
                    ) : null}
                    {canCreateMeetings ? (
                      <QuickAction
                        icon="calendar"
                        title="Schedule"
                        tint={colors.violetSoft}
                        onPress={() => {
                          setMode('events');
                          setMeetingComposerOpen(true);
                        }}
                      />
                    ) : null}
                    <QuickAction
                      icon="share-social"
                      title="Share"
                      tint={colors.tealSoft}
                      onPress={() => void handleShareClub()}
                    />
                  </View>
                ) : null}

                <SectionRow
                  title="Recent announcements"
                  actionLabel={announcements.length ? 'View all' : undefined}
                  onPress={() => {
                    setMode('chat');
                    setChatView('announcements');
                  }}
                />

                {announcements.length ? (
                  announcements.slice(0, 3).map((announcement) => (
                    <Slab
                      key={announcement.id}
                      onPress={() => {
                        setMode('chat');
                        setChatView('announcements');
                      }}
                      faceStyle={styles.announcementPreviewFace}
                      accessibilityLabel={`Announcement from ${announcement.user.name}`}
                    >
                      <View style={styles.announcementHead}>
                        <Avatar name={announcement.user.name} uri={announcement.user.avatarUrl} size={26} />
                        <Text style={[typography.subheading, { flex: 1 }]} numberOfLines={1}>
                          {announcement.user.name}
                        </Text>
                        <Text style={typography.captionSmall}>
                          {relativeDayLabel(announcement.createdAt)}
                        </Text>
                      </View>
                      <Text style={[typography.body, { color: colors.sub }]} numberOfLines={3}>
                        {announcement.content}
                      </Text>
                    </Slab>
                  ))
                ) : (
                  <EmptyState
                    icon="megaphone"
                    title="No announcements yet"
                    body="Club updates will show up here once leaders start posting."
                  />
                )}
              </View>
            ) : null}

            {/* ── CHAT ── */}
            {mode === 'chat' ? (
              <View style={styles.section}>
                {chatView === 'hub' ? (
                  <>
                    <View style={styles.chatHubHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={typography.title}>Chats</Text>
                        <Text style={typography.captionSmall}>All conversations in one place.</Text>
                      </View>
                      {canPostAnnouncements ? (
                        <Button
                          label="New announcement"
                          size="sm"
                          icon="add"
                          onPress={() => {
                            setChatView('announcements');
                            setAnnouncementComposerOpen(true);
                          }}
                        />
                      ) : null}
                    </View>

                    {chatCards.map((item) => {
                      const hubAccent =
                        item.key === 'announcements'
                          ? { tint: colors.amber, soft: colors.amberSoft }
                          : item.key === 'general'
                            ? { tint: colors.blue, soft: colors.blueSoft }
                            : { tint: colors.violet, soft: colors.violetSoft };
                      return (
                        <Slab
                          key={item.key}
                          onPress={() => setChatView(item.key)}
                          faceStyle={styles.chatHubFace}
                          accessibilityLabel={`Open ${item.title}`}
                        >
                          <View
                            style={[
                              styles.chatHubIcon,
                              { backgroundColor: hubAccent.soft, borderColor: colors.border },
                            ]}
                          >
                            <Ionicons name={item.icon} size={19} color={hubAccent.tint} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={typography.heading}>{item.title}</Text>
                            <Text style={typography.captionSmall}>{item.subtitle}</Text>
                          </View>
                          {item.badge ? (
                            <Sticker
                              label={String(item.badge)}
                              tint={hubAccent.soft}
                              small
                              tilt={3}
                            />
                          ) : null}
                          <Ionicons name="arrow-forward" size={16} color={colors.faint} />
                        </Slab>
                      );
                    })}
                  </>
                ) : (
                  <View style={{ gap: spacing.md }}>
                    <View style={styles.chatConversationHeader}>
                      <IconButton
                        icon="arrow-back"
                        size={38}
                        onPress={() => setChatView('hub')}
                        accessibilityLabel="Back to club chats"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={typography.title}>
                          {chatView === 'announcements'
                            ? 'Announcements'
                            : chatView === 'general'
                              ? 'General Chat'
                              : 'Officers Chat'}
                        </Text>
                        <Text style={typography.captionSmall}>
                          {chatView === 'announcements'
                            ? 'Public club updates'
                            : chatView === 'general'
                              ? 'Members-only conversation'
                              : 'Leadership coordination'}
                        </Text>
                      </View>
                    </View>

                    {chatView === 'announcements' ? (
                      <>
                        {canPostAnnouncements ? (
                          <Card padded>
                            <Pressable
                              style={styles.composerToggle}
                              onPress={() => setAnnouncementComposerOpen((current) => !current)}
                              accessibilityRole="button"
                              accessibilityLabel="Toggle announcement composer"
                            >
                              <Text style={typography.title}>Create announcement</Text>
                              <Ionicons
                                name={announcementComposerOpen ? 'remove' : 'add'}
                                size={20}
                                color={colors.primary}
                              />
                            </Pressable>
                            {announcementComposerOpen ? (
                              <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                                <Text style={typography.caption}>Share an update with the club.</Text>
                                <View style={styles.chipWrap}>
                                  {VISIBILITY_OPTIONS.map((option) => (
                                    <Chip
                                      key={option.value}
                                      label={option.label}
                                      selected={announcementVisibility === option.value}
                                      onPress={() => setAnnouncementVisibility(option.value)}
                                    />
                                  ))}
                                </View>
                                <RoleTargetPicker
                                  roles={clubRoles}
                                  selectedRoleIds={announcementTargetRoleIds}
                                  onToggle={(roleId) =>
                                    setAnnouncementTargetRoleIds((current) =>
                                      current.includes(roleId)
                                        ? current.filter((id) => id !== roleId)
                                        : [...current, roleId],
                                    )
                                  }
                                />
                                <TextInput
                                  value={announcementText}
                                  onChangeText={setAnnouncementText}
                                  placeholder="Share details, reminders, links, etc."
                                  placeholderTextColor={colors.faint}
                                  style={[
                                    styles.input,
                                    styles.inputTall,
                                    {
                                      backgroundColor: colors.surfaceAlt,
                                      borderColor: colors.border,
                                      color: colors.ink,
                                    },
                                  ]}
                                  multiline
                                />
                                <Button
                                  label="Post announcement"
                                  onPress={() => void handleCreateAnnouncement()}
                                  loading={announcementBusy}
                                />
                              </View>
                            ) : null}
                          </Card>
                        ) : null}

                        {announcements.length ? (
                          announcements.map((announcement) => (
                            <Card key={announcement.id} padded>
                              <View style={styles.announcementHead}>
                                <Avatar
                                  name={announcement.user.name}
                                  uri={announcement.user.avatarUrl}
                                  size={34}
                                />
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={typography.subheading} numberOfLines={1}>
                                    {announcement.user.name}
                                  </Text>
                                  <Text style={typography.captionSmall}>
                                    {formatDateTime(announcement.createdAt)}
                                  </Text>
                                </View>
                                <Tag
                                  label={
                                    announcement.targetRoleIds?.length
                                      ? roleAudienceLabel(announcement.targetRoleIds)
                                      : visibilityLabel(announcement.visibility)
                                  }
                                />
                              </View>
                              <Text style={[typography.body, { marginTop: spacing.sm }]}>
                                {announcement.content}
                              </Text>
                              <View style={styles.inlineActionRow}>
                                {canDeleteClubContent ? (
                                  <Pressable
                                    onPress={() => void handleDeleteAnnouncement(announcement)}
                                    style={styles.inlineAction}
                                    disabled={
                                      deleteContentBusyId === `announcement:${announcement.id}`
                                    }
                                  >
                                    <Ionicons name="trash" size={14} color={colors.danger} />
                                    <Text style={[styles.inlineActionText, { color: colors.danger }]}>
                                      Delete
                                    </Text>
                                  </Pressable>
                                ) : null}
                                {announcement.user.id !== user?.id ? (
                                  <Pressable
                                    onPress={() => void reportAnnouncement(announcement)}
                                    style={styles.inlineAction}
                                  >
                                    <Ionicons name="flag" size={14} color={colors.sub} />
                                    <Text style={[styles.inlineActionText, { color: colors.sub }]}>
                                      Report
                                    </Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            </Card>
                          ))
                        ) : (
                          <EmptyState
                            icon="megaphone"
                            title="No announcements yet"
                            body="This room will hold public updates and club-wide reminders."
                          />
                        )}
                      </>
                    ) : null}

                    {chatView === 'general' ? (
                      <>
                        {messages.length ? (
                          messages.map((message) => (
                            <MessageBubble
                              key={message.id}
                              align={message.userId === user?.id ? 'right' : 'left'}
                              name={message.user.name}
                              avatarUrl={message.user.avatarUrl}
                              content={message.content}
                              time={formatTime(message.createdAt)}
                              onReport={
                                message.userId !== user?.id
                                  ? () => void reportClubMessage(message)
                                  : undefined
                              }
                            />
                          ))
                        ) : (
                          <EmptyState
                            icon="chatbubbles"
                            title="No messages yet"
                            body="Be the first to kick off the conversation."
                          />
                        )}
                        {typingUserIds.length ? (
                          <Text style={[typography.caption, { color: colors.primary }]}>
                            Someone is typing…
                          </Text>
                        ) : null}
                        <View style={styles.composerDock}>
                          <TextInput
                            value={messageText}
                            onChangeText={(value) => {
                              setMessageText(value);
                              pingTyping(value);
                            }}
                            placeholder="Message members…"
                            placeholderTextColor={colors.faint}
                            style={[
                              styles.input,
                              {
                                flex: 1,
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                                color: colors.ink,
                              },
                            ]}
                          />
                          <IconButton
                            icon="arrow-up"
                            size={48}
                            color={sendBusy || !messageText.trim() ? colors.faint : colors.primary}
                            iconColor={colors.onPrimary}
                            onPress={() => void handleSend()}
                            disabled={sendBusy || !messageText.trim()}
                            accessibilityLabel="Send club message"
                          />
                        </View>
                      </>
                    ) : null}

                    {chatView === 'officers' ? (
                      <>
                        {officerMessages.length ? (
                          officerMessages.map((message) => (
                            <MessageBubble
                              key={message.id}
                              align={message.userId === user?.id ? 'right' : 'left'}
                              name={message.user.name}
                              avatarUrl={message.user.avatarUrl}
                              content={message.content}
                              time={formatTime(message.createdAt)}
                              onReport={
                                message.userId !== user?.id
                                  ? () => void reportClubMessage(message, true)
                                  : undefined
                              }
                            />
                          ))
                        ) : (
                          <EmptyState
                            icon="shield-checkmark"
                            title="Officer chat is quiet"
                            body="Use this room for leadership coordination."
                          />
                        )}
                        {officerTypingUserIds.length ? (
                          <Text style={[typography.caption, { color: colors.primary }]}>
                            An officer is typing…
                          </Text>
                        ) : null}
                        <View style={styles.composerDock}>
                          <TextInput
                            value={officerMessageText}
                            onChangeText={(value) => {
                              setOfficerMessageText(value);
                              pingOfficerTyping(value);
                            }}
                            placeholder="Coordinate with officers…"
                            placeholderTextColor={colors.faint}
                            style={[
                              styles.input,
                              {
                                flex: 1,
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                                color: colors.ink,
                              },
                            ]}
                          />
                          <IconButton
                            icon="arrow-up"
                            size={48}
                            color={
                              officerSendBusy || !officerMessageText.trim()
                                ? colors.faint
                                : colors.primary
                            }
                            iconColor={colors.onPrimary}
                            onPress={() => void handleOfficerSend()}
                            disabled={officerSendBusy || !officerMessageText.trim()}
                            accessibilityLabel="Send officer message"
                          />
                        </View>
                      </>
                    ) : null}
                  </View>
                )}
              </View>
            ) : null}

            {/* ── MEMBERS ── */}
            {mode === 'members' ? (
              <View style={styles.section}>
                <View style={styles.chatHubHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.title}>Members</Text>
                    <Text style={typography.captionSmall}>
                      {club.members.length} {club.members.length === 1 ? 'member' : 'members'}
                    </Text>
                  </View>
                  {canManageRoles || canConfigureOfficerPermissions ? (
                    <Button
                      label="Settings"
                      size="sm"
                      variant="secondary"
                      icon="pricetags"
                      onPress={() => setRolePanelOpen((current) => !current)}
                    />
                  ) : null}
                </View>

                {(canManageRoles || canConfigureOfficerPermissions) && rolePanelOpen ? (
                  <Card padded>
                    {canConfigureOfficerPermissions ? (
                      <View style={{ gap: spacing.md }}>
                        <View>
                          <Text style={typography.title}>Officer permissions</Text>
                          <Text style={typography.captionSmall}>
                            Choose what officers can do beyond posting announcements and moderating
                            messages.
                          </Text>
                        </View>
                        <View style={{ gap: spacing.sm }}>
                          {CLUB_PERMISSION_OPTIONS.map((permission) => {
                            const required = DEFAULT_OFFICER_PERMISSIONS.includes(permission.value);
                            const enabled =
                              required ||
                              (club.officerPermissions ?? []).includes(permission.value);
                            return (
                              <Pressable
                                key={permission.value}
                                style={[
                                  styles.permissionRow,
                                  {
                                    borderColor: colors.border,
                                    backgroundColor: enabled
                                      ? colors.successSoft
                                      : colors.surfaceAlt,
                                  },
                                ]}
                                onPress={() =>
                                  required
                                    ? undefined
                                    : void handleToggleOfficerPermission(permission.value)
                                }
                                disabled={required || permissionBusy}
                              >
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={typography.subheading}>{permission.title}</Text>
                                  <Text style={typography.captionSmall}>
                                    {required ? 'Always available to officers.' : permission.body}
                                  </Text>
                                </View>
                                <Ionicons
                                  name={enabled ? 'checkmark-circle' : 'ellipse-outline'}
                                  size={22}
                                  color={enabled ? colors.success : colors.sub}
                                />
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                    {canManageRoles ? (
                      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                        <View>
                          <Text style={typography.title}>Member tags</Text>
                          <Text style={typography.captionSmall}>
                            Create labels for dues, levels, committees, or cohorts.
                          </Text>
                        </View>
                        <View style={styles.roleCreateRow}>
                          <TextInput
                            value={roleNameDraft}
                            onChangeText={setRoleNameDraft}
                            placeholder="Hasn't paid dues"
                            placeholderTextColor={colors.faint}
                            style={[
                              styles.input,
                              {
                                flex: 1,
                                backgroundColor: colors.surfaceAlt,
                                borderColor: colors.border,
                                color: colors.ink,
                              },
                            ]}
                          />
                          <IconButton
                            icon="add"
                            size={48}
                            color={colors.primary}
                            iconColor={colors.onPrimary}
                            onPress={() => void handleCreateRole()}
                            disabled={roleBusyId === 'create'}
                            accessibilityLabel="Create member tag"
                          />
                        </View>
                        {(club.roles ?? []).length ? (
                          <View style={{ gap: spacing.sm }}>
                            {(club.roles ?? []).map((role) => (
                              <View
                                key={role.id}
                                style={[
                                  styles.roleListItem,
                                  { borderColor: colors.borderSoft },
                                ]}
                              >
                                <Ionicons name="at" size={15} color={colors.primary} />
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={typography.subheading}>{role.name}</Text>
                                  <Text style={typography.captionSmall}>
                                    {role.memberCount ?? 0} assigned
                                  </Text>
                                </View>
                                <Pressable
                                  onPress={() => void handleDeleteRole(role.id)}
                                  disabled={roleBusyId === `delete:${role.id}`}
                                  hitSlop={8}
                                >
                                  <Ionicons name="trash" size={16} color={colors.danger} />
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={typography.captionSmall}>
                            No member tags yet. Add one above, then assign one from a member card.
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </Card>
                ) : null}

                {canPostAnnouncements ? (
                  <Card padded>
                    <Pressable
                      style={styles.composerToggle}
                      onPress={() => setOutreachOpen((current) => !current)}
                      accessibilityRole="button"
                      accessibilityLabel="Toggle bulk outreach"
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={typography.title}>Bulk outreach</Text>
                        <Text style={typography.captionSmall}>
                          Preview recipients before sending a notification.
                        </Text>
                      </View>
                      <Ionicons
                        name={outreachOpen ? 'remove' : 'add'}
                        size={20}
                        color={colors.primary}
                      />
                    </Pressable>
                    {outreachOpen ? (
                      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                        <View style={styles.chipWrap}>
                          {(
                            ['ALL', 'NON_RSVP', 'PRIMARY_ROLE', 'CUSTOM_ROLE', 'MANUAL'] as OutreachAudienceType[]
                          ).map((type) => (
                            <Chip
                              key={type}
                              label={
                                {
                                  ALL: 'All',
                                  NON_RSVP: 'Non-RSVPs',
                                  PRIMARY_ROLE: 'Role',
                                  CUSTOM_ROLE: 'Member tag',
                                  MANUAL: 'Manual',
                                }[type]
                              }
                              selected={outreachAudienceType === type}
                              onPress={() => {
                                setOutreachAudienceType(type);
                                setOutreachPreview(null);
                              }}
                            />
                          ))}
                        </View>

                        {outreachAudienceType === 'NON_RSVP' ? (
                          <Text style={typography.captionSmall}>
                            {nextMeeting
                              ? `${nonRsvpCountForMeeting(nextMeeting)} ${
                                  nonRsvpCountForMeeting(nextMeeting) === 1
                                    ? 'member has'
                                    : 'members have'
                                } not RSVP'd to ${nextMeeting.title}.`
                              : 'Schedule a meeting before targeting non-RSVPs.'}
                          </Text>
                        ) : null}
                        {outreachAudienceType === 'PRIMARY_ROLE' ? (
                          <View style={styles.chipWrap}>
                            {(['OWNER', 'ADMIN', 'OFFICER', 'MEMBER'] as const).map((role) => (
                              <Chip
                                key={role}
                                label={role}
                                selected={outreachPrimaryRole === role}
                                onPress={() => {
                                  setOutreachPrimaryRole(role);
                                  setOutreachPreview(null);
                                }}
                              />
                            ))}
                          </View>
                        ) : null}
                        {outreachAudienceType === 'CUSTOM_ROLE' ? (
                          <View style={styles.chipWrap}>
                            {clubRoles.length ? (
                              clubRoles.map((role) => (
                                <Chip
                                  key={role.id}
                                  label={role.name}
                                  selected={outreachRoleId === role.id}
                                  onPress={() => {
                                    setOutreachRoleId(role.id);
                                    setOutreachPreview(null);
                                  }}
                                />
                              ))
                            ) : (
                              <Text style={typography.captionSmall}>
                                Create member tags before targeting them.
                              </Text>
                            )}
                          </View>
                        ) : null}
                        {outreachAudienceType === 'MANUAL' ? (
                          <View style={styles.chipWrap}>
                            {club.members.map((member) => {
                              const selected = outreachManualIds.includes(member.userId);
                              return (
                                <Chip
                                  key={member.id}
                                  label={member.user.name}
                                  selected={selected}
                                  onPress={() => {
                                    setOutreachManualIds((current) =>
                                      selected
                                        ? current.filter((id) => id !== member.userId)
                                        : [...current, member.userId],
                                    );
                                    setOutreachPreview(null);
                                  }}
                                />
                              );
                            })}
                          </View>
                        ) : null}

                        <TextInput
                          value={outreachText}
                          onChangeText={setOutreachText}
                          placeholder="Write a clear, specific message"
                          placeholderTextColor={colors.faint}
                          style={[
                            styles.input,
                            styles.inputTall,
                            {
                              backgroundColor: colors.surfaceAlt,
                              borderColor: colors.border,
                              color: colors.ink,
                            },
                          ]}
                          multiline
                        />
                        <View style={styles.buttonRow}>
                          <Button
                            label="Preview audience"
                            variant="secondary"
                            size="sm"
                            onPress={() => void handlePreviewOutreach()}
                            loading={outreachBusy}
                          />
                          <Button
                            label="Send outreach"
                            size="sm"
                            onPress={() => void handleSendOutreach()}
                            loading={outreachBusy}
                            disabled={!outreachPreview || outreachPreview.count === 0}
                          />
                        </View>
                        {outreachPreview ? (
                          <View
                            style={[
                              styles.previewBox,
                              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                            ]}
                          >
                            <Text style={typography.subheading}>
                              {outreachPreview.count} recipient
                              {outreachPreview.count === 1 ? '' : 's'}
                            </Text>
                            <Text style={typography.captionSmall}>{outreachPreview.audience}</Text>
                            {outreachPreview.recipients.slice(0, 12).map((recipient) => (
                              <Text key={recipient.id} style={typography.caption}>
                                {recipient.name} • {recipient.role}
                              </Text>
                            ))}
                            {outreachPreview.recipients.length > 12 ? (
                              <Text style={typography.captionSmall}>
                                +{outreachPreview.recipients.length - 12} more
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                        {outreachResult ? (
                          <Banner message={outreachResult} kind="success" />
                        ) : null}
                      </View>
                    ) : null}
                  </Card>
                ) : null}

                {club.members.length ? (
                  <>
                    {memberGroups.leadership.length ? (
                      <View style={{ gap: spacing.sm }}>
                        <Text style={typography.kicker}>LEADERSHIP</Text>
                        <Card padded>
                          {memberGroups.leadership.map((member, index) => (
                            <View key={member.id}>
                              {index > 0 ? (
                                <View
                                  style={[styles.memberSeparator, { borderColor: colors.borderSoft }]}
                                />
                              ) : null}
                              {renderMemberRow(member)}
                            </View>
                          ))}
                        </Card>
                      </View>
                    ) : null}
                    {memberGroups.general.length ? (
                      <View style={{ gap: spacing.sm }}>
                        <Text style={typography.kicker}>
                          MEMBERS • {memberGroups.general.length}
                        </Text>
                        <Card padded>
                          {memberGroups.general.map((member, index) => (
                            <View key={member.id}>
                              {index > 0 ? (
                                <View
                                  style={[styles.memberSeparator, { borderColor: colors.borderSoft }]}
                                />
                              ) : null}
                              {renderMemberRow(member)}
                            </View>
                          ))}
                        </Card>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <EmptyState
                    icon="people"
                    title="No members loaded"
                    body="Member details will show up here once the club roster loads in."
                  />
                )}
              </View>
            ) : null}

            {/* ── EVENTS ── */}
            {mode === 'events' ? (
              <View style={styles.section}>
                <View style={styles.chatHubHeader}>
                  <Text style={[typography.title, { flex: 1 }]}>Events</Text>
                  {meetings.length ? (
                    <Button
                      label={calendarExportBusy ? 'Exporting…' : 'Export'}
                      size="sm"
                      variant="secondary"
                      icon="download"
                      onPress={() => void handleExportCalendar()}
                      disabled={calendarExportBusy}
                    />
                  ) : null}
                  {canCreateMeetings ? (
                    <Button
                      label={meetingComposerOpen ? 'Close' : 'New'}
                      size="sm"
                      icon={meetingComposerOpen ? 'close' : 'add'}
                      onPress={() => setMeetingComposerOpen((current) => !current)}
                    />
                  ) : null}
                </View>

                {canCreateMeetings && meetingComposerOpen ? (
                  <Card padded>
                    <View style={{ gap: spacing.md }}>
                      <View>
                        <Text style={typography.title}>Create meeting</Text>
                        <Text style={typography.captionSmall}>Schedule an event for your club.</Text>
                      </View>
                      <TextInput
                        value={meetingTitle}
                        onChangeText={setMeetingTitle}
                        placeholder="Meeting title"
                        placeholderTextColor={colors.faint}
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.surfaceAlt,
                            borderColor: colors.border,
                            color: colors.ink,
                          },
                        ]}
                      />
                      <TextInput
                        value={meetingLocation}
                        onChangeText={setMeetingLocation}
                        placeholder="Location"
                        placeholderTextColor={colors.faint}
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.surfaceAlt,
                            borderColor: colors.border,
                            color: colors.ink,
                          },
                        ]}
                      />
                      <TextInput
                        value={meetingDescription}
                        onChangeText={setMeetingDescription}
                        placeholder="Description"
                        placeholderTextColor={colors.faint}
                        style={[
                          styles.input,
                          styles.inputTall,
                          {
                            backgroundColor: colors.surfaceAlt,
                            borderColor: colors.border,
                            color: colors.ink,
                          },
                        ]}
                        multiline
                      />
                      <View style={styles.chipWrap}>
                        {VISIBILITY_OPTIONS.map((option) => (
                          <Chip
                            key={option.value}
                            label={option.label}
                            selected={meetingVisibility === option.value}
                            onPress={() => setMeetingVisibility(option.value)}
                          />
                        ))}
                      </View>
                      <RoleTargetPicker
                        roles={clubRoles}
                        selectedRoleIds={meetingTargetRoleIds}
                        onToggle={(roleId) =>
                          setMeetingTargetRoleIds((current) =>
                            current.includes(roleId)
                              ? current.filter((id) => id !== roleId)
                              : [...current, roleId],
                          )
                        }
                      />
                      <View
                        style={[
                          styles.dateWell,
                          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                        ]}
                      >
                        <Text style={typography.kicker}>Date & time</Text>
                        <DateTimePicker
                          value={meetingTime}
                          mode="datetime"
                          minimumDate={new Date()}
                          maximumDate={latestAllowedMeetingTime()}
                          onChange={(_, value) => {
                            if (value) setMeetingTime(value);
                          }}
                          display="default"
                        />
                      </View>
                      <Button
                        label="Create meeting"
                        onPress={() => void handleCreateMeeting()}
                        loading={meetingBusy}
                      />
                    </View>
                  </Card>
                ) : null}

                {meetings.length ? (
                  meetings.map((meeting) => (
                    <Card key={meeting.id} padded>
                      <View style={styles.eventHead}>
                        <DateBadge iso={meeting.meetingTime} />
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={[typography.kicker, { color: colors.primary }]}>
                            {relativeDayLabel(meeting.meetingTime).toUpperCase()} •{' '}
                            {formatTime(meeting.meetingTime)}
                          </Text>
                          <Text style={typography.heading}>{meeting.title}</Text>
                          <Text style={typography.captionSmall} numberOfLines={1}>
                            {meeting.location}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <Sticker
                            label={`${meeting.rsvpCounts.going} going`}
                            tint={colors.successSoft}
                            small
                            tilt={2}
                          />
                          {canDeleteClubContent ? (
                            <Pressable
                              onPress={() => void handleDeleteMeeting(meeting)}
                              disabled={deleteContentBusyId === `meeting:${meeting.id}`}
                              hitSlop={8}
                            >
                              <Ionicons name="trash" size={16} color={colors.danger} />
                            </Pressable>
                          ) : null}
                        </View>
                      </View>

                      <View style={[styles.rsvpRow, { marginTop: spacing.md }]}>
                        {RSVP_OPTIONS.map((option) => (
                          <Chip
                            key={option.value}
                            label={option.label}
                            selected={meeting.myRsvp === option.value}
                            tint={
                              option.value === 'GOING'
                                ? colors.successSoft
                                : option.value === 'MAYBE'
                                  ? colors.warningSoft
                                  : colors.dangerSoft
                            }
                            onPress={() => void handleRsvp(meeting.id, option.value)}
                          />
                        ))}
                      </View>

                      {meeting.description ? (
                        <Text style={[typography.body, { marginTop: spacing.sm }]}>
                          {meeting.description}
                        </Text>
                      ) : null}

                      <View style={styles.eventMetaRow}>
                        <Text style={typography.captionSmall}>
                          {meeting.attendeeCount} checked in
                        </Text>
                        <Text style={typography.captionSmall}>
                          {meeting.targetRoleIds?.length
                            ? roleAudienceLabel(meeting.targetRoleIds)
                            : visibilityLabel(meeting.visibility)}
                        </Text>
                      </View>

                      {canCreateMeetings ? (
                        <>
                          <Pressable
                            style={[styles.leaderToggle, { borderColor: colors.borderSoft }]}
                            onPress={() =>
                              setLeaderToolsMeetingId((current) =>
                                current === meeting.id ? null : meeting.id,
                              )
                            }
                            accessibilityRole="button"
                            accessibilityLabel="Toggle leader tools"
                            accessibilityState={{ expanded: leaderToolsMeetingId === meeting.id }}
                          >
                            <Ionicons name="key" size={14} color={colors.violet} />
                            <Text style={[styles.inlineActionText, { color: colors.violet }]}>
                              Leader tools
                            </Text>
                            {meeting.attendanceCode ? (
                              <Sticker
                                label="Attendance open"
                                tint={colors.successSoft}
                                small
                                tilt={-2}
                              />
                            ) : null}
                            <View style={{ flex: 1 }} />
                            <Ionicons
                              name={leaderToolsMeetingId === meeting.id ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={colors.sub}
                            />
                          </Pressable>
                          {leaderToolsMeetingId === meeting.id ? (
                            <View
                              style={[
                                styles.attendanceBox,
                                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                              ]}
                            >
                              {meeting.attendanceCode ? (
                                <View style={{ gap: 4 }}>
                                  <Text style={typography.kicker}>Attendance code</Text>
                                  <Text style={styles.attendanceCode}>{meeting.attendanceCode}</Text>
                                  <Text style={typography.captionSmall}>
                                    Attendance is open. Regenerating this code makes the current one
                                    stop working.
                                  </Text>
                                </View>
                              ) : (
                                <Text style={typography.caption}>
                                  Attendance is closed right now.
                                </Text>
                              )}
                              {meeting.rsvpReminderSentAt ? (
                                <Text style={typography.captionSmall}>
                                  Last RSVP reminder: {formatDateTime(meeting.rsvpReminderSentAt)} •{' '}
                                  {meeting.rsvpReminderStatus ?? 'sent'} •{' '}
                                  {meeting.rsvpReminderCount ?? 0} targeted
                                </Text>
                              ) : (
                                <Text style={typography.captionSmall}>
                                  {nonRsvpCountForMeeting(meeting)} member
                                  {nonRsvpCountForMeeting(meeting) === 1 ? '' : 's'} have not RSVP'd.
                                </Text>
                              )}
                              <View style={styles.buttonRow}>
                                <Button
                                  label={meeting.attendanceCode ? 'Regenerate' : 'Open attendance'}
                                  size="sm"
                                  variant="secondary"
                                  onPress={() => void handleOpenAttendance(meeting.id)}
                                  loading={attendanceBusyId === `open-${meeting.id}`}
                                />
                                {meeting.attendanceCode ? (
                                  <>
                                    <Button
                                      label="Copy"
                                      size="sm"
                                      variant="secondary"
                                      onPress={() =>
                                        void handleCopyAttendanceCode(meeting.attendanceCode!)
                                      }
                                    />
                                    <Button
                                      label="Share"
                                      size="sm"
                                      variant="secondary"
                                      onPress={() => void handleShareAttendanceCode(meeting)}
                                    />
                                    <Button
                                      label="Close"
                                      size="sm"
                                      variant="secondary"
                                      onPress={() => void handleCloseAttendance(meeting.id)}
                                      loading={attendanceBusyId === `close-${meeting.id}`}
                                    />
                                  </>
                                ) : null}
                                <Button
                                  label="Attendance"
                                  size="sm"
                                  variant="secondary"
                                  onPress={() => void handleLoadAttendance(meeting.id)}
                                  loading={attendanceBusyId === `view-${meeting.id}`}
                                />
                                <Button
                                  label="Remind non-RSVPs"
                                  size="sm"
                                  variant="secondary"
                                  onPress={() => void handleSendRsvpReminder(meeting)}
                                  loading={attendanceBusyId === `rsvp-${meeting.id}`}
                                  disabled={nonRsvpCountForMeeting(meeting) === 0}
                                />
                              </View>
                              {attendancePanels[meeting.id]?.attendees.length ? (
                                <View style={styles.attendeeRow}>
                                  {attendancePanels[meeting.id]!.attendees.slice(0, 6).map(
                                    (attendee) => (
                                      <Avatar
                                        key={attendee.id}
                                        name={attendee.user?.name ?? 'Attendee'}
                                        uri={attendee.user?.avatarUrl}
                                        size={28}
                                      />
                                    ),
                                  )}
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                        </>
                      ) : isMember ? (
                        <View
                          style={[
                            styles.attendanceBox,
                            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                          ]}
                        >
                          <Text style={typography.caption}>
                            Have the attendance code? Check in here.
                          </Text>
                          <TextInput
                            value={attendanceCodeDraft[meeting.id] ?? ''}
                            onChangeText={(value) =>
                              setAttendanceCodeDraft((current) => ({
                                ...current,
                                [meeting.id]: value.toUpperCase(),
                              }))
                            }
                            placeholder="Enter attendance code"
                            placeholderTextColor={colors.faint}
                            style={[
                              styles.input,
                              {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                                color: colors.ink,
                              },
                            ]}
                            autoCapitalize="characters"
                          />
                          <Button
                            label="Check in"
                            size="sm"
                            onPress={() => void handleCheckIn(meeting.id)}
                            loading={attendanceBusyId === `checkin-${meeting.id}`}
                          />
                        </View>
                      ) : null}
                    </Card>
                  ))
                ) : (
                  <EmptyState
                    icon="calendar"
                    title="No meetings yet"
                    body="Once club events are scheduled, they'll appear here."
                  />
                )}
              </View>
            ) : null}

            {/* ── ANALYTICS ── */}
            {mode === 'analytics' ? (
              <View style={styles.section}>
                <View>
                  <Text style={typography.title}>Club health</Text>
                  <Text style={typography.captionSmall}>
                    Snapshot based on current members, upcoming meetings, RSVPs, attendance, and
                    announcements.
                  </Text>
                </View>
                <View style={styles.metricGrid}>
                  <MetricCard
                    icon="people"
                    tint={colors.blue}
                    soft={colors.blueSoft}
                    label="Members"
                    value={String(analytics.memberCount)}
                    detail="Current roster"
                  />
                  <MetricCard
                    icon="calendar"
                    tint={colors.violet}
                    soft={colors.violetSoft}
                    label="Upcoming"
                    value={String(analytics.upcomingCount)}
                    detail="Scheduled meetings"
                  />
                  <MetricCard
                    icon="checkbox"
                    tint={colors.green}
                    soft={colors.greenSoft}
                    label="RSVPs"
                    value={`${analytics.rsvpGoing}/${analytics.rsvpMaybe}/${analytics.rsvpNotGoing}`}
                    detail="Going / maybe / can't go"
                  />
                  <MetricCard
                    icon="finger-print"
                    tint={colors.teal}
                    soft={colors.tealSoft}
                    label="Attendance"
                    value={String(analytics.checkedIn)}
                    detail="Checked in across meetings"
                  />
                  <MetricCard
                    icon="megaphone"
                    tint={colors.amber}
                    soft={colors.amberSoft}
                    label="Announcements"
                    value={String(analytics.announcements)}
                    detail="Visible recent posts"
                  />
                </View>

                <Card padded>
                  <View style={styles.responseHead}>
                    <Text style={typography.title}>RSVP response rate</Text>
                    <Text style={styles.responseValue}>
                      {analytics.responseRate == null ? '—' : `${analytics.responseRate}%`}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.progressTrack,
                      { backgroundColor: colors.sunken, borderColor: colors.border },
                    ]}
                  >
                    <View
                      style={{
                        flex: Math.min(Math.max(analytics.responseRate ?? 0, 0), 100),
                        backgroundColor: colors.primary,
                      }}
                    />
                    <View
                      style={{ flex: 100 - Math.min(Math.max(analytics.responseRate ?? 0, 0), 100) }}
                    />
                  </View>
                  <Text style={[typography.captionSmall, { marginTop: spacing.sm }]}>
                    {analytics.responseRate == null
                      ? 'Schedule meetings to start building a response signal.'
                      : 'Share of member RSVPs across upcoming meetings.'}
                  </Text>
                </Card>
                <Card padded>
                  <Text style={typography.title}>Upcoming meeting breakdown</Text>
                  {meetings.length ? (
                    meetings.slice(0, 5).map((meeting) => (
                      <View key={meeting.id} style={[styles.analyticsRow, { borderColor: colors.borderSoft }]}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={typography.subheading} numberOfLines={1}>
                            {meeting.title}
                          </Text>
                          <Text style={typography.captionSmall}>
                            {formatShortDate(meeting.meetingTime)} • {formatTime(meeting.meetingTime)}
                          </Text>
                        </View>
                        <Text style={typography.captionSmall}>
                          {meeting.rsvpCounts.going} going • {meeting.attendeeCount} checked in
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[typography.captionSmall, { marginTop: spacing.sm }]}>
                      No upcoming meetings yet, so meeting trends are not available.
                    </Text>
                  )}
                </Card>
                <Card padded>
                  <Text style={typography.title}>Member count trend</Text>
                  <Text style={[typography.captionSmall, { marginTop: 4 }]}>
                    Historical member snapshots are not stored yet. Showing the current roster count
                    only.
                  </Text>
                </Card>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.loadingWrap}>
            <SkeletonCard />
            <SkeletonCard compact />
            <SkeletonCard compact />
          </View>
        )}
      </ScrollView>
    </AppBackdrop>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function SectionRow({
  title,
  actionLabel,
  onPress,
}: {
  title: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  const { colors, typography } = useTheme();
  return (
    <View style={helperStylesStatic.sectionRow}>
      <Text style={[typography.title, { flex: 1 }]}>{title}</Text>
      {actionLabel && onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text style={[helperStylesStatic.sectionAction, { color: colors.primary }]}>
            {actionLabel} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function QuickAction({
  icon,
  title,
  tint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tint: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Slab
      onPress={onPress}
      color={tint}
      style={{ flex: 1 }}
      faceStyle={helperStylesStatic.quickFace}
      accessibilityLabel={title}
    >
      <Ionicons name={icon} size={19} color={colors.ink} />
      <Text style={[helperStylesStatic.quickLabel, { color: colors.ink }]}>{title}</Text>
    </Slab>
  );
}

function DateBadge({ iso, large }: { iso: string; large?: boolean }) {
  const { colors } = useTheme();
  const date = new Date(iso);
  const month = date.toLocaleDateString([], { month: 'short' }).toUpperCase();
  const day = date.getDate();
  const size = large ? 62 : 52;
  return (
    <View
      style={[
        helperStylesStatic.dateBadge,
        {
          width: size,
          height: size,
          backgroundColor: colors.primarySoft,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[helperStylesStatic.dateBadgeMonth, { color: colors.primary }]}>{month}</Text>
      <Text
        style={[
          helperStylesStatic.dateBadgeDay,
          { color: colors.ink, fontSize: large ? 22 : 18 },
        ]}
      >
        {day}
      </Text>
    </View>
  );
}

function MetricCard({
  icon,
  tint,
  soft,
  label,
  value,
  detail,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  soft: string;
  label: string;
  value: string;
  detail: string;
}) {
  const { colors, typography } = useTheme();
  return (
    <Slab
      accessibilityRole="none"
      color={soft}
      style={helperStylesStatic.metricSlot}
      faceStyle={helperStylesStatic.metricFace}
    >
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={[helperStylesStatic.metricValue, { color: colors.ink }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={typography.kicker}>{label}</Text>
      <Text style={typography.captionSmall} numberOfLines={1}>
        {detail}
      </Text>
    </Slab>
  );
}

function RoleTargetPicker({
  roles,
  selectedRoleIds,
  onToggle,
}: {
  roles: ClubRole[];
  selectedRoleIds: string[];
  onToggle: (roleId: string) => void;
}) {
  const { colors, typography } = useTheme();
  const [open, setOpen] = useState(false);
  if (!roles.length) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        style={helperStylesStatic.rolePickerToggle}
        accessibilityRole="button"
        accessibilityLabel="Target member tags"
      >
        <Ionicons name="pricetags" size={14} color={colors.primary} />
        <Text style={[typography.caption, { flex: 1 }]}>
          {selectedRoleIds.length
            ? `${selectedRoleIds.length} tag${selectedRoleIds.length === 1 ? '' : 's'} targeted`
            : 'Target specific member tags (optional)'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.sub} />
      </Pressable>
      {open ? (
        <View style={helperStylesStatic.rolePickerWrap}>
          {roles.map((role) => (
            <Chip
              key={role.id}
              label={role.name}
              selected={selectedRoleIds.includes(role.id)}
              onPress={() => onToggle(role.id)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MessageBubble({
  align,
  name,
  avatarUrl,
  content,
  time,
  onReport,
}: {
  align: 'left' | 'right';
  name: string;
  avatarUrl?: string | null;
  content: string;
  time: string;
  onReport?: () => void;
}) {
  const { colors } = useTheme();
  const mine = align === 'right';
  return (
    <View
      style={[
        helperStylesStatic.bubbleRow,
        mine && { justifyContent: 'flex-end' },
      ]}
    >
      {!mine ? <Avatar name={name} uri={avatarUrl} size={30} /> : null}
      <View style={[helperStylesStatic.bubbleStack, mine && { alignItems: 'flex-end' }]}>
        <View style={helperStylesStatic.bubbleMeta}>
          <Text style={[helperStylesStatic.bubbleName, { color: colors.sub }]}>
            {mine ? 'You' : name}
          </Text>
          <Text style={[helperStylesStatic.bubbleTime, { color: colors.faint }]}>{time}</Text>
        </View>
        <View
          style={[
            helperStylesStatic.bubble,
            {
              backgroundColor: mine ? colors.primary : colors.surfaceAlt,
              borderColor: colors.border,
            },
            mine
              ? { borderBottomRightRadius: 4 }
              : { borderBottomLeftRadius: 4 },
          ]}
        >
          <Text
            style={[
              helperStylesStatic.bubbleBody,
              { color: mine ? colors.onPrimary : colors.ink },
            ]}
          >
            {content}
          </Text>
        </View>
        {onReport ? (
          <Pressable
            onPress={onReport}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Report message from ${name}`}
          >
            <Text style={[helperStylesStatic.bubbleReport, { color: colors.faint }]}>Report</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

import { StyleSheet } from 'react-native';

const helperStylesStatic = StyleSheet.create({
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  sectionAction: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    paddingBottom: 2,
  },
  quickFace: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: 6,
  },
  quickLabel: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
  },
  dateBadge: {
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  dateBadgeMonth: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
  },
  dateBadgeDay: {
    fontFamily: fonts.displayMedium,
    lineHeight: 26,
  },
  metricSlot: {
    flexBasis: '46%',
    flexGrow: 1,
  },
  metricFace: {
    padding: spacing.md,
    gap: 4,
  },
  metricValue: {
    fontFamily: fonts.displayMedium,
    fontSize: 20,
    lineHeight: 26,
  },
  rolePickerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  rolePickerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  bubbleStack: {
    maxWidth: '78%',
    gap: 3,
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  bubbleName: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
  },
  bubbleTime: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
  },
  bubble: {
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  bubbleBody: {
    fontFamily: fonts.medium,
    fontSize: 14.5,
    lineHeight: 20,
  },
  bubbleReport: {
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
});

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  heroFace: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  identityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  clubAvatar: {
    width: 68,
    height: 68,
    borderRadius: radii.md,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
    transform: [{ rotate: '-3deg' }],
  },
  clubEmoji: {
    fontSize: 32,
    lineHeight: 40,
  },
  clubTitle: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: t.colors.ink,
  },
  stickerRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: 2,
  },
  statStrip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
  },
  statCell: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.displayMedium,
    fontSize: 19,
    color: t.colors.ink,
  },
  statLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1,
    color: t.colors.sub,
  },
  statDivider: {
    width: 2,
    height: 28,
  },
  tabRow: {
    gap: spacing.sm,
    paddingRight: spacing.xl,
    paddingVertical: 4,
  },
  section: {
    gap: spacing.md,
  },
  upcomingHead: {
    flexDirection: 'row' as const,
    gap: spacing.md,
  },
  inlineMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  attendeeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: 4,
  },
  rsvpRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  quickRow: {
    flexDirection: 'row' as const,
    gap: spacing.md,
  },
  announcementPreviewFace: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  announcementHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  chatHubHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  chatHubFace: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    padding: spacing.md,
  },
  chatHubIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    transform: [{ rotate: '-2deg' }],
  },
  chatConversationHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  composerToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  chipWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  input: {
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontFamily: fonts.medium,
    fontSize: 15,
    minHeight: 48,
  },
  inputTall: {
    minHeight: 96,
    textAlignVertical: 'top' as const,
  },
  composerDock: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  inlineActionRow: {
    flexDirection: 'row' as const,
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  inlineAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  inlineActionText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
  },
  permissionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  roleCreateRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  roleListItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    borderBottomWidth: 2,
    borderStyle: 'dashed' as const,
    paddingVertical: spacing.sm,
  },
  previewBox: {
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: 4,
  },
  buttonRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  memberRow: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  memberRowMain: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  memberRowProfile: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    minWidth: 0,
  },
  memberNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  memberActionButton: {
    width: 34,
    height: 34,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  memberSeparator: {
    borderBottomWidth: 2,
    borderStyle: 'dashed' as const,
  },
  roleAssignWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
    paddingLeft: 52,
  },
  eventHead: {
    flexDirection: 'row' as const,
    gap: spacing.md,
    alignItems: 'flex-start' as const,
  },
  eventMetaRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginTop: spacing.sm,
  },
  leaderToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderStyle: 'dashed' as const,
  },
  attendanceBox: {
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  attendanceCode: {
    fontFamily: fonts.displayMedium,
    fontSize: 24,
    letterSpacing: 4,
    color: t.colors.ink,
  },
  dateWell: {
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start' as const,
  },
  metricGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.md,
  },
  responseHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.sm,
  },
  responseValue: {
    fontFamily: fonts.displayMedium,
    fontSize: 21,
    color: t.colors.primary,
  },
  progressTrack: {
    flexDirection: 'row' as const,
    height: 12,
    borderRadius: 6,
    borderWidth: BORDER_W,
    overflow: 'hidden' as const,
  },
  analyticsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderStyle: 'dashed' as const,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center' as const,
    gap: spacing.md,
  },
}));
