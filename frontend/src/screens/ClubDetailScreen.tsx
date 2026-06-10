import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Image, ScrollView, Share, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
} from '../types';
import {
  Chip,
  EmptyState,
  Panel,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SkeletonCard,
  UserAvatar,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { clubCategoryVisual } from '../constants/clubVisuals';
import { formatDateTime, formatShortDate, formatTime } from '../utils/format';
import { buildClubCalendarIcs } from '../utils/calendar';
import { exportTextFile } from '../utils/fileExport';
import { Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ClubDetail'>;
type Mode = 'overview' | 'chat' | 'members' | 'events' | 'analytics';
type ChatView = 'hub' | 'announcements' | 'general' | 'officers';
type OutreachAudienceType = 'ALL' | 'NON_RSVP' | 'PRIMARY_ROLE' | 'CUSTOM_ROLE' | 'MANUAL';
type SectionHeaderRowProps = {
  title: string;
} & (
  | { actionLabel?: undefined; onPress?: undefined }
  | { actionLabel: string | undefined; onPress: () => void }
);

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
  overview: 'home-outline',
  chat: 'chatbubbles-outline',
  members: 'people-outline',
  events: 'calendar-outline',
  analytics: 'pulse-outline',
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
    (a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime()
  );
}

function visibilityLabel(visibility: ClubVisibility): string {
  return {
    PUBLIC: 'Public',
    MEMBERS: 'Members',
    OFFICERS: 'Officers',
  }[visibility] ?? 'Public';
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
  const { colors, isDark } = useTheme();
  const activeTabContent = isDark ? '#0C0D11' : '#FFFFFF';
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
  const [attendancePanels, setAttendancePanels] = useState<Record<string, ClubMeetingAttendanceResponse | null>>({});
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachAudienceType, setOutreachAudienceType] = useState<OutreachAudienceType>('ALL');
  const [outreachPrimaryRole, setOutreachPrimaryRole] = useState<'OWNER' | 'ADMIN' | 'OFFICER' | 'MEMBER'>('MEMBER');
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
    [effectivePermissions]
  );
  const canCreateMeetings = hasPermission('CREATE_MEETINGS');
  const canPostAnnouncements = hasPermission('POST_ANNOUNCEMENTS');
  const canManageMembers = hasPermission('MANAGE_MEMBERS');
  const canManageRoles = hasPermission('MANAGE_ROLES');
  const canManageClub = hasPermission('MANAGE_CLUB');
  const canDeleteClubContent = club?.myRole === 'OWNER' || club?.myRole === 'ADMIN';
  const canViewOfficerChat = club?.myRole === 'OWNER' || club?.myRole === 'ADMIN' || club?.myRole === 'OFFICER';
  const canConfigureOfficerPermissions = club?.myRole === 'OWNER' || club?.myRole === 'ADMIN';
  const canChangePrimaryRoles = club?.myRole === 'OWNER' || club?.myRole === 'ADMIN';
  const isSoleOwner =
    club?.myRole === 'OWNER' &&
    club.members.filter((member) => member.role === 'OWNER').length === 1;
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
    [clubRoles]
  );

  const nonRsvpCountForMeeting = useCallback(
    (meeting: ClubMeetingWithMeta) => {
      const responded =
        meeting.rsvpCounts.going + meeting.rsvpCounts.maybe + meeting.rsvpCounts.notGoing;
      const memberCount = (club?.members ?? []).filter((member) => member.userId !== user?.id).length;
      return Math.max(0, memberCount - responded);
    },
    [club?.members, user?.id]
  );

  const canManageThisMember = useCallback(
    (memberRole: string, memberUserId: string) => {
      if (!club?.myRole || memberUserId === user?.id) return false;
      return roleRank(memberRole) < roleRank(club.myRole);
    },
    [club?.myRole, user?.id]
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
        if (clubResponse.myRole === 'OWNER' || clubResponse.myRole === 'ADMIN' || clubResponse.myRole === 'OFFICER') {
          requests.push(getClubOfficerMessages(clubId));
        }

        const results = await Promise.all(requests);
        const meetingResponse = results[0] as ClubMeetingWithMeta[];
        const announcementResponse = results[1] as { items: ClubAnnouncementRow[] };
        const memberMessageResponse = clubResponse.isMember
          ? (results[2] as { messages: ClubMessage[]; typingUserIds: string[] })
          : null;
        const officerMessageResponse =
          clubResponse.myRole === 'OWNER' || clubResponse.myRole === 'ADMIN' || clubResponse.myRole === 'OFFICER'
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
          (clubResponse.myRole !== 'OWNER' && clubResponse.myRole !== 'ADMIN' && clubResponse.myRole !== 'OFFICER') &&
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
    [chatView, clubId, mode]
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
    }, [load])
  );

  const pingTyping = useCallback((draft: string) => {
    if (!isMember || !draft.trim()) return;
    if (typingTimerRef.current) return;
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 2500);
    void sendClubTyping(clubId).catch(() => {});
  }, [clubId, isMember]);

  const pingOfficerTyping = useCallback((draft: string) => {
    if (!canViewOfficerChat || !draft.trim()) return;
    if (officerTypingTimerRef.current) return;
    officerTypingTimerRef.current = setTimeout(() => {
      officerTypingTimerRef.current = null;
    }, 2500);
    void sendClubOfficerTyping(clubId).catch(() => {});
  }, [canViewOfficerChat, clubId]);

  const confirmDestructive = useCallback(
    (title: string, message: string, confirmLabel: string, onConfirm: () => void) => {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: confirmLabel, style: 'destructive', onPress: onConfirm },
      ]);
    },
    []
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
      const safeName = club.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'club';
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
      }
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
        }
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
      buttons.push({ text: 'Leave club', style: 'destructive', onPress: () => void handleMembership() });
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

  const handleRsvp = async (
    meetingId: string,
    status: 'GOING' | 'MAYBE' | 'NOT_GOING'
  ) => {
    const previous = meetings;
    setMeetings((current) =>
      current.map((meeting) => (meeting.id === meetingId ? { ...meeting, myRsvp: status } : meeting))
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
      }
    );
  };

  const handleCreateMeeting = async () => {
    if (!club || !meetingTitle.trim() || !meetingLocation.trim()) {
      Alert.alert('Missing meeting info', 'Add a title and location before creating the meeting.');
      return;
    }
    const latestAllowed = latestAllowedMeetingTime().getTime();
    if (meetingTime.getTime() > latestAllowed || meetingTime.getTime() < Date.now()) {
      Alert.alert('Choose a valid time', 'Meetings need to be scheduled between now and the next 12 months.');
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
      }
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
        }
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
        current.map((meeting) => (
          meeting.id === meetingId ? { ...meeting, attendanceCode: result.attendanceCode } : meeting
        ))
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
            current.map((meeting) => (
              meeting.id === meetingId ? { ...meeting, attendanceCode: null } : meeting
            ))
          );
        } catch {
          Alert.alert('Could not close attendance', API_USER_MESSAGE);
        } finally {
          setAttendanceBusyId(null);
        }
      }
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
        current.map((meeting) => (
          meeting.id === meetingId ? { ...meeting, attendeeCount: result.attendedCount } : meeting
        ))
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
      `This will notify members who have not RSVP’d for ${meeting.title}. You’ll see the exact count after the backend checks the audience.`,
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
                    : item
                )
              );
              Alert.alert(
                'Reminder sent',
                `${result.count} member${result.count === 1 ? '' : 's'} matched. ${result.sent} push notification${result.sent === 1 ? '' : 's'} queued.`
              );
            } catch {
              Alert.alert('Could not send reminder', API_USER_MESSAGE);
            } finally {
              setAttendanceBusyId(null);
            }
          },
        },
      ]
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
                `Sent ${sent.sent} push notification${sent.sent === 1 ? '' : 's'} to ${sent.count} matching member${sent.count === 1 ? '' : 's'}.`
              );
              setOutreachText('');
            } catch {
              Alert.alert('Could not send outreach', API_USER_MESSAGE);
            } finally {
              setOutreachBusy(false);
            }
          },
        },
      ]
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
      }
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
                member.userId === memberUserId ? updated : member
              ),
            }
          : current
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
        current ? { ...current, roles: [...(current.roles ?? []), created] } : current
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
      }
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
                customRoles: (member.customRoles ?? []).filter((assignment) => assignment.roleId !== roleId),
              })),
            }
          : current
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
                        customRoles: (member.customRoles ?? []).filter((role) => role.roleId !== roleId),
                      }
                    : member
                ),
              }
            : current
        );
      } else {
        const updated = await assignClubRole(club.id, roleId, memberUserId);
        setClub((current) =>
          current
            ? {
                ...current,
                members: current.members.map((member) =>
                  member.userId === memberUserId ? updated : member
                ),
              }
            : current
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
      }
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
          : current
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
        current ? { ...current, officerPermissions: updated.officerPermissions } : current
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
          ? Math.round(((rsvpGoing + rsvpMaybe + rsvpNotGoing) / (memberCount * upcomingCount)) * 100)
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

  const openMemberActions = useCallback((member: ClubMemberWithUser) => {
    const buttons: Array<{
      text: string;
      style?: 'default' | 'cancel' | 'destructive';
      onPress?: () => void;
    }> = [];
    if (canChangePrimaryRoles && club?.myRole === 'OWNER' && member.role !== 'ADMIN') {
      buttons.push({ text: 'Make admin', onPress: () => void handleRoleChange(member.userId, 'ADMIN') });
    }
    if (canChangePrimaryRoles && member.role === 'MEMBER') {
      buttons.push({ text: 'Promote to officer', onPress: () => void handleRoleChange(member.userId, 'OFFICER') });
    } else if (canChangePrimaryRoles && (member.role === 'OFFICER' || member.role === 'ADMIN')) {
      buttons.push({
        text: member.role === 'ADMIN' ? 'Demote to officer' : 'Demote to member',
        onPress: () => void handleRoleChange(member.userId, member.role === 'ADMIN' ? 'OFFICER' : 'MEMBER'),
      });
    }
    if (canManageRoles && clubRoles.length) {
      buttons.push({
        text: 'Manage member tags',
        onPress: () => setMemberRoleEditorUserId((current) => (current === member.userId ? null : member.userId)),
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
  }, [
    canChangePrimaryRoles,
    canManageMembers,
    canManageRoles,
    club?.myRole,
    clubRoles.length,
    handleRoleChange,
    handleRemoveMember,
  ]);
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
        title: 'Club Announcements',
        subtitle: 'Public club updates',
        badge: announcements.length,
        icon: 'megaphone-outline',
      },
      {
        key: 'general',
        audience: 'MEMBERS',
        title: 'General Chat',
        subtitle: 'Members-only conversation',
        badge: messages.length,
        icon: 'chatbubble-ellipses-outline',
      },
    ];
    if (canViewOfficerChat) {
      cards.push({
        key: 'officers',
        audience: 'OFFICERS',
        title: 'Officers Chat',
        subtitle: 'Leadership coordination',
        badge: officerMessages.length,
        icon: 'shield-checkmark-outline',
      });
    }
    return cards;
  }, [announcements.length, canViewOfficerChat, messages.length, officerMessages.length]);

  const renderMemberRow = (member: ClubMemberWithUser) => {
    const manageable = canManageThisMember(member.role, member.userId);
    const hasActions = manageable
      && (canManageMembers || canChangePrimaryRoles || (canManageRoles && clubRoles.length > 0));
    const tags = member.customRoles ?? [];
    return (
      <View style={styles.memberRow}>
        <View style={styles.memberRowMain}>
          <TouchableOpacity
            style={styles.memberRowProfile}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('UserProfile', { userId: member.userId })}
            accessibilityRole="button"
            accessibilityLabel={`Open ${member.user.name}'s profile`}
          >
            <UserAvatar name={member.user.name} avatarUrl={member.user.avatarUrl} size={40} />
            <View style={styles.memberCopy}>
              <View style={styles.memberNameRow}>
                <Text style={styles.memberName} numberOfLines={1}>{member.user.name}</Text>
                {member.role !== 'MEMBER' ? <RoleBadge role={member.role} /> : null}
              </View>
              <Text style={styles.memberMetaText} numberOfLines={1}>
                {member.user.major ?? 'Undeclared'}
                {tags.length ? ` · ${tags.map((assignment) => assignment.role.name).join(', ')}` : ''}
              </Text>
            </View>
          </TouchableOpacity>
          {hasActions ? (
            <TouchableOpacity
              style={styles.memberActionButton}
              onPress={() => openMemberActions(member)}
              disabled={memberActionUserId === member.userId}
              accessibilityRole="button"
              accessibilityLabel={`Actions for ${member.user.name}`}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.sub} />
            </TouchableOpacity>
          ) : null}
        </View>
        {memberRoleEditorUserId === member.userId ? (
          <View style={styles.roleAssignWrap}>
            {(club?.roles ?? []).map((role) => {
              const assigned = tags.some((assignment) => assignment.roleId === role.id);
              const busy = roleBusyId === `${member.userId}:${role.id}`;
              return (
                <TouchableOpacity
                  key={role.id}
                  style={[styles.roleAssignButton, assigned ? styles.roleAssignButtonActive : null]}
                  onPress={() => void handleToggleMemberTag(member.userId, role.id, assigned)}
                  disabled={busy}
                >
                  <Ionicons
                    name={assigned ? 'checkmark-circle' : 'add-circle-outline'}
                    size={15}
                    color={assigned ? '#FFFFFF' : colors.primary}
                  />
                  <Text style={[styles.roleAssignText, assigned ? styles.roleAssignTextActive : null]}>
                    {role.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  };

  if (!club && loadError) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
          <ScreenHeader title="Club" onBack={() => navigation.goBack()} />
          <EmptyState icon="alert-circle-outline" title="Could not load club" body={loadError} />
          <PrimaryButton label="Try again" onPress={() => void load(false)} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {club ? (
          <>
            <View style={styles.heroShell}>
              <LinearGradient
                colors={categoryVisual.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1.15 }}
                style={styles.cover}
              >
                <Text pointerEvents="none" style={styles.coverWatermark}>{club.emoji}</Text>
                <View style={styles.coverTopBar}>
                  <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.heroCircleButton}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                  >
                    <Ionicons name="chevron-back" size={20} color={colors.ink} />
                  </TouchableOpacity>
                  <View style={styles.coverActions}>
                    {canManageClub ? (
                      <TouchableOpacity
                        onPress={() => void handleUploadClubAvatar()}
                        style={styles.heroCircleButton}
                        disabled={avatarBusy}
                        accessibilityRole="button"
                        accessibilityLabel={club.avatarUrl ? 'Change club photo' : 'Add club photo'}
                      >
                        <Ionicons name="camera-outline" size={18} color={colors.ink} />
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={styles.heroCircleButton}
                      onPress={handleClubActions}
                      accessibilityRole="button"
                      accessibilityLabel="Club actions"
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.ink} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.coverArt}>
                  <View style={styles.coverIdentity}>
                    {club.avatarUrl ? (
                      <Image source={{ uri: club.avatarUrl }} style={styles.coverAvatar} />
                    ) : (
                      <Text style={styles.coverEmoji}>{club.emoji}</Text>
                    )}
                  </View>
                  <View style={styles.coverCategoryPill}>
                    <Ionicons name={categoryVisual.icon} size={13} color="#FFFFFF" />
                    <Text style={styles.coverCategoryText}>{club.category}</Text>
                    {club.isVerified ? (
                      <>
                        <View style={styles.coverPillDivider} />
                        <Ionicons name="checkmark-circle" size={13} color="#FFFFFF" />
                        <Text style={styles.coverCategoryText}>Verified</Text>
                      </>
                    ) : null}
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.heroCard}>
                <View style={styles.identityRow}>
                  <View style={styles.clubAvatarTile}>
                    {club.avatarUrl ? (
                      <Image source={{ uri: club.avatarUrl }} style={styles.clubAvatarImage} />
                    ) : (
                      <Text style={styles.clubAvatarEmoji}>{club.emoji}</Text>
                    )}
                  </View>
                  <View style={styles.identityCopy}>
                    <Text style={styles.clubTitle}>{club.name}</Text>
                    <Text style={styles.clubMeta}>{club.university}</Text>
                  </View>
                </View>

                <Text style={styles.clubDescription}>{club.description}</Text>

                <View style={styles.statStrip}>
                  <View style={styles.statCell}>
                    <Text style={styles.statCellValue}>{club.members.length}</Text>
                    <Text style={styles.statCellLabel}>Member{club.members.length === 1 ? '' : 's'}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statCellValue}>{meetings.length}</Text>
                    <Text style={styles.statCellLabel}>Upcoming</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statCellValue}>{nextMeeting ? nextMeeting.rsvpCounts.going : 0}</Text>
                    <Text style={styles.statCellLabel}>Going next</Text>
                  </View>
                </View>

                <View style={styles.membershipRow}>
                  {isSoleOwner ? (
                    <TouchableOpacity
                      style={styles.leaveClubButton}
                      onPress={handleClubActions}
                      activeOpacity={0.72}
                      accessibilityRole="button"
                      accessibilityLabel="Manage club"
                    >
                      <Ionicons name="settings-outline" size={15} color={colors.sub} />
                      <Text style={styles.leaveClubButtonText}>Manage club</Text>
                    </TouchableOpacity>
                  ) : club.isMember ? (
                    <TouchableOpacity
                      style={styles.leaveClubButton}
                      onPress={() => void handleMembership()}
                      disabled={membershipBusy}
                      activeOpacity={0.72}
                    >
                      <Ionicons name="log-out-outline" size={15} color={colors.sub} />
                      <Text style={styles.leaveClubButtonText}>
                        {membershipBusy ? 'Updating...' : 'Leave club'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.membershipButton}
                      onPress={() => void handleMembership()}
                      disabled={membershipBusy}
                      activeOpacity={0.88}
                    >
                      <Text style={styles.membershipButtonText}>
                        {membershipBusy ? 'Updating...' : 'Join club'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {loadError ? (
              <View style={styles.bodyWrap}>
                <Panel>
                  <Text style={styles.errorText}>{loadError}</Text>
                </Panel>
              </View>
            ) : null}

            <View style={styles.bodyWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabBar}
              >
                {modeOptions.map((option) => {
                  const active = mode === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.tabPill, active && styles.tabPillActive]}
                      activeOpacity={0.85}
                      onPress={() => {
                        setMode(option.value);
                        if (option.value !== 'chat') setChatView('hub');
                      }}
                      accessibilityRole="tab"
                      accessibilityLabel={option.label}
                      accessibilityState={{ selected: active }}
                    >
                      <Ionicons
                        name={MODE_ICONS[option.value]}
                        size={15}
                        color={active ? activeTabContent : colors.sub}
                      />
                      <Text style={[styles.tabPillLabel, active && styles.tabPillLabelActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {mode === 'overview' ? (
                <View style={styles.section}>
                  <SectionHeaderRow
                    title="Next meeting"
                    actionLabel={meetings.length ? 'See all' : undefined}
                    onPress={() => setMode('events')}
                  />

                  {nextMeeting ? (
                    <View style={styles.upcomingCard}>
                      <View style={styles.upcomingHead}>
                        <DateBadge iso={nextMeeting.meetingTime} size="large" />
                        <View style={styles.upcomingCopy}>
                          <Text style={styles.upcomingTime}>
                            {relativeDayLabel(nextMeeting.meetingTime)} • {formatTime(nextMeeting.meetingTime)}
                          </Text>
                          <Text style={styles.upcomingTitle} numberOfLines={2}>{nextMeeting.title}</Text>
                          <View style={styles.upcomingMetaRow}>
                            <Ionicons name="location-outline" size={13} color={colors.faint} />
                            <Text style={styles.upcomingLocation} numberOfLines={1}>{nextMeeting.location}</Text>
                          </View>
                          <View style={styles.upcomingAttendees}>
                            {recentMembers.slice(0, 4).map((member, index) => (
                              <View key={member.id} style={{ marginLeft: index === 0 ? 0 : -8 }}>
                                <UserAvatar name={member.user.name} avatarUrl={member.user.avatarUrl} size={24} />
                              </View>
                            ))}
                            <Text style={styles.upcomingAttendeeCount}>
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
                              active={nextMeeting.myRsvp === option.value}
                              onPress={() => void handleRsvp(nextMeeting.id, option.value)}
                            />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <EmptyState
                      icon="calendar-outline"
                      title="No upcoming meetings"
                      body="Schedule your first event to kick the club dashboard into motion."
                    />
                  )}

                  {canPostAnnouncements || canCreateMeetings ? (
                    <View style={styles.quickActionRow}>
                      {canPostAnnouncements ? (
                        <QuickActionCard
                          icon="megaphone-outline"
                          title="Announce"
                          onPress={() => {
                            setMode('chat');
                            setChatView('announcements');
                            setAnnouncementComposerOpen(true);
                          }}
                        />
                      ) : null}
                      {canCreateMeetings ? (
                        <QuickActionCard
                          icon="calendar-outline"
                          title="Schedule"
                          onPress={() => {
                            setMode('events');
                            setMeetingComposerOpen(true);
                          }}
                        />
                      ) : null}
                      <QuickActionCard
                        icon="share-outline"
                        title="Share"
                        onPress={() => void handleShareClub()}
                      />
                    </View>
                  ) : null}

                  <SectionHeaderRow title="Recent announcements" actionLabel={announcements.length ? 'View all' : undefined} onPress={() => {
                    setMode('chat');
                    setChatView('announcements');
                  }} />

                  {announcements.length ? (
                    announcements.slice(0, 3).map((announcement) => (
                      <TouchableOpacity
                        key={announcement.id}
                        style={styles.announcementPreview}
                        activeOpacity={0.88}
                        onPress={() => {
                          setMode('chat');
                          setChatView('announcements');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Announcement from ${announcement.user.name}`}
                      >
                        <View style={styles.announcementPreviewBar} />
                        <View style={styles.announcementPreviewBody}>
                          <View style={styles.announcementPreviewHead}>
                            <UserAvatar name={announcement.user.name} avatarUrl={announcement.user.avatarUrl} size={26} />
                            <Text style={styles.announcementPreviewName} numberOfLines={1}>
                              {announcement.user.name}
                            </Text>
                            <Text style={styles.announcementPreviewTime}>
                              {relativeDayLabel(announcement.createdAt)}
                            </Text>
                          </View>
                          <Text style={styles.announcementPreviewContent} numberOfLines={3}>
                            {announcement.content}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <EmptyState
                      icon="megaphone-outline"
                      title="No announcements yet"
                      body="Club updates will show up here once leaders start posting."
                    />
                  )}
                </View>
              ) : null}

              {mode === 'chat' ? (
                <View style={styles.section}>
                  {chatView === 'hub' ? (
                    <>
                      <View style={styles.chatHeader}>
                        <View>
                          <Text style={styles.screenSectionTitle}>Chats</Text>
                          <Text style={styles.screenSectionBody}>All conversations in one place.</Text>
                        </View>
                        {canPostAnnouncements ? (
                          <TouchableOpacity
                            style={styles.newChatButton}
                            activeOpacity={0.88}
                            onPress={() => {
                              setChatView('announcements');
                              setAnnouncementComposerOpen(true);
                            }}
                          >
                            <Ionicons name="add" size={16} color="#FFFFFF" />
                            <Text style={styles.newChatButtonText}>New announcement</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      {chatCards.map((item) => {
                        const accent = item.key === 'announcements'
                          ? { tint: colors.amber, soft: colors.amberSoft }
                          : item.key === 'general'
                            ? { tint: colors.blue, soft: colors.blueSoft }
                            : { tint: colors.violet, soft: colors.violetSoft };
                        return (
                          <TouchableOpacity
                            key={item.key}
                            style={styles.chatHubCard}
                            activeOpacity={0.92}
                            onPress={() => setChatView(item.key)}
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${item.title}`}
                          >
                            <View style={[styles.chatHubIcon, { backgroundColor: accent.soft }]}>
                              <Ionicons name={item.icon} size={20} color={accent.tint} />
                            </View>
                            <View style={styles.chatHubCopy}>
                              <Text style={styles.chatHubTitle}>{item.title}</Text>
                              <Text style={styles.chatHubMeta}>{item.subtitle}</Text>
                            </View>
                            <View style={styles.chatHubRight}>
                              {item.badge ? (
                                <View style={[styles.chatBadge, { backgroundColor: accent.tint }]}>
                                  <Text style={styles.chatBadgeText}>{item.badge}</Text>
                                </View>
                              ) : null}
                              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  ) : (
                    <View style={styles.chatConversation}>
                      <View style={styles.chatConversationHeader}>
                        <TouchableOpacity
                          onPress={() => setChatView('hub')}
                          style={styles.chatBackButton}
                          accessibilityRole="button"
                          accessibilityLabel="Back to club chats"
                        >
                          <Ionicons name="chevron-back" size={18} color={colors.ink} />
                        </TouchableOpacity>
                        <View style={styles.chatConversationTitleBlock}>
                          <Text style={styles.chatConversationTitle}>
                            {chatView === 'announcements'
                              ? 'Club Announcements'
                              : chatView === 'general'
                                ? 'General Chat'
                                : 'Officers Chat'}
                          </Text>
                          <Text style={styles.chatConversationMeta}>
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
                            <View style={styles.composerCard}>
                              <TouchableOpacity
                                activeOpacity={0.86}
                                style={styles.composerHeader}
                                onPress={() => setAnnouncementComposerOpen((current) => !current)}
                              >
                                <Text style={styles.cardTitle}>Create announcement</Text>
                                <Ionicons name={announcementComposerOpen ? 'remove' : 'add'} size={20} color={colors.primary} />
                              </TouchableOpacity>
                              {announcementComposerOpen ? (
                                <>
                                  <Text style={styles.cardBody}>Share an update with the club.</Text>
                                  <View style={styles.visibilityRow}>
                                    {VISIBILITY_OPTIONS.map((option) => (
                                      <Chip
                                        key={option.value}
                                        label={option.label}
                                        active={announcementVisibility === option.value}
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
                                          : [...current, roleId]
                                      )
                                    }
                                  />
                                  <TextInput
                                    value={announcementText}
                                    onChangeText={setAnnouncementText}
                                    placeholder="Share details, reminders, links, etc."
                                    placeholderTextColor={colors.faint}
                                    style={[styles.input, styles.inputTall]}
                                    multiline
                                  />
                                  <PrimaryButton
                                    label="Post announcement"
                                    onPress={() => void handleCreateAnnouncement()}
                                    loading={announcementBusy}
                                  />
                                </>
                              ) : null}
                            </View>
                          ) : null}

                          {announcements.length ? announcements.map((announcement) => (
                            <View key={announcement.id} style={styles.announcementCard}>
                              <View style={styles.announcementHead}>
                                <View style={styles.announcementAuthor}>
                                  <UserAvatar name={announcement.user.name} avatarUrl={announcement.user.avatarUrl} size={34} />
                                  <View style={styles.announcementCopy}>
                                    <Text style={styles.cardTitle}>{announcement.user.name}</Text>
                                    <Text style={styles.cardMeta}>
                                      {formatDateTime(announcement.createdAt)}
                                    </Text>
                                  </View>
                                </View>
                                <View style={styles.audiencePill}>
                                  <Text style={styles.audiencePillText}>
                                    {announcement.targetRoleIds?.length
                                      ? roleAudienceLabel(announcement.targetRoleIds)
                                      : visibilityLabel(announcement.visibility)}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.cardBody}>{announcement.content}</Text>
                              <View style={styles.inlineActionRow}>
                                {canDeleteClubContent ? (
                                  <TouchableOpacity
                                    onPress={() => void handleDeleteAnnouncement(announcement)}
                                    style={styles.reportInlineButton}
                                    disabled={deleteContentBusyId === `announcement:${announcement.id}`}
                                  >
                                    <Ionicons name="trash-outline" size={15} color={colors.dangerText} />
                                    <Text style={[styles.reportInlineText, styles.dangerInlineText]}>Delete</Text>
                                  </TouchableOpacity>
                                ) : null}
                                {announcement.user.id !== user?.id ? (
                                  <TouchableOpacity onPress={() => void reportAnnouncement(announcement)} style={styles.reportInlineButton}>
                                    <Ionicons name="flag-outline" size={15} color={colors.sub} />
                                    <Text style={styles.reportInlineText}>Report</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            </View>
                          )) : (
                            <EmptyState
                              icon="megaphone-outline"
                              title="No announcements yet"
                              body="This room will hold public updates and club-wide reminders."
                            />
                          )}
                        </>
                      ) : null}

                      {chatView === 'general' ? (
                        <>
                          {messages.length ? messages.map((message, index) => (
                            <MessageBubble
                              key={message.id}
                              align={message.userId === user?.id ? 'right' : 'left'}
                              name={message.user.name}
                              avatarUrl={message.user.avatarUrl}
                              content={message.content}
                              time={formatTime(message.createdAt)}
                              onReport={message.userId !== user?.id ? () => void reportClubMessage(message) : undefined}
                            />
                          )) : (
                            <EmptyState
                              icon="chatbubbles-outline"
                              title="No messages yet"
                              body="Be the first to kick off the conversation."
                            />
                          )}
                          {typingUserIds.length ? <Text style={styles.typingText}>Someone is typing...</Text> : null}
                          <View style={styles.chatComposerDock}>
                            <TextInput
                              value={messageText}
	                              onChangeText={(value) => {
	                                setMessageText(value);
	                                pingTyping(value);
	                              }}
                              placeholder="Message members..."
                              placeholderTextColor={colors.faint}
                              style={styles.chatComposerInput}
                            />
                            <TouchableOpacity
                              style={[styles.sendFab, (sendBusy || !messageText.trim()) && styles.sendFabDisabled]}
                              onPress={() => void handleSend()}
                              disabled={sendBusy || !messageText.trim()}
                              accessibilityRole="button"
                              accessibilityLabel="Send club message"
                              accessibilityState={{ disabled: sendBusy || !messageText.trim() }}
                            >
                              <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        </>
                      ) : null}

                      {chatView === 'officers' ? (
                        <>
                          {officerMessages.length ? officerMessages.map((message, index) => (
                            <MessageBubble
                              key={message.id}
                              align={message.userId === user?.id ? 'right' : 'left'}
                              name={message.user.name}
                              avatarUrl={message.user.avatarUrl}
                              content={message.content}
                              time={formatTime(message.createdAt)}
                              onReport={message.userId !== user?.id ? () => void reportClubMessage(message, true) : undefined}
                            />
                          )) : (
                            <EmptyState
                              icon="shield-checkmark-outline"
                              title="Officer chat is quiet"
                              body="Use this room for leadership coordination."
                            />
                          )}
                          {officerTypingUserIds.length ? <Text style={styles.typingText}>An officer is typing...</Text> : null}
                          <View style={styles.chatComposerDock}>
                            <TextInput
                              value={officerMessageText}
	                              onChangeText={(value) => {
	                                setOfficerMessageText(value);
	                                pingOfficerTyping(value);
	                              }}
                              placeholder="Coordinate with officers..."
                              placeholderTextColor={colors.faint}
                              style={styles.chatComposerInput}
                            />
                            <TouchableOpacity
                              style={[styles.sendFab, (officerSendBusy || !officerMessageText.trim()) && styles.sendFabDisabled]}
                              onPress={() => void handleOfficerSend()}
                              disabled={officerSendBusy || !officerMessageText.trim()}
                              accessibilityRole="button"
                              accessibilityLabel="Send officer message"
                              accessibilityState={{ disabled: officerSendBusy || !officerMessageText.trim() }}
                            >
                              <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        </>
                      ) : null}
                    </View>
                  )}
                </View>
              ) : null}

              {mode === 'members' ? (
                <View style={styles.section}>
                  <View style={styles.membersHeader}>
                    <View>
                      <Text style={styles.screenSectionTitle}>Members</Text>
                      <Text style={styles.membersCount}>
                        {club.members.length} {club.members.length === 1 ? 'member' : 'members'}
                      </Text>
                    </View>
                    {canManageRoles || canConfigureOfficerPermissions ? (
                      <TouchableOpacity
                        style={styles.manageRolesButton}
                        onPress={() => setRolePanelOpen((current) => !current)}
                        activeOpacity={0.82}
                      >
                        <Ionicons name="pricetags-outline" size={16} color={colors.primary} />
                        <Text style={styles.manageRolesButtonText}>Settings</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {(canManageRoles || canConfigureOfficerPermissions) && rolePanelOpen ? (
                    <View style={styles.roleManagerPanel}>
                      {canConfigureOfficerPermissions ? (
                        <View style={styles.permissionPanel}>
                          <View>
                            <Text style={styles.cardTitle}>Officer permissions</Text>
                            <Text style={styles.cardMeta}>
                              Choose what officers can do beyond posting announcements and moderating messages.
                            </Text>
                          </View>
                          <View style={styles.permissionList}>
                            {CLUB_PERMISSION_OPTIONS.map((permission) => {
                              const required = DEFAULT_OFFICER_PERMISSIONS.includes(permission.value);
                              const enabled = required || (club.officerPermissions ?? []).includes(permission.value);
                              return (
                                <TouchableOpacity
                                  key={permission.value}
                                  style={[styles.permissionRow, enabled ? styles.permissionRowActive : null]}
                                  onPress={() => required ? undefined : void handleToggleOfficerPermission(permission.value)}
                                  disabled={required || permissionBusy}
                                  activeOpacity={0.82}
                                >
                                  <View style={styles.permissionCopy}>
                                    <Text style={styles.permissionTitle}>{permission.title}</Text>
                                    <Text style={styles.cardMeta}>{required ? 'Always available to officers.' : permission.body}</Text>
                                  </View>
                                  <Ionicons
                                    name={enabled ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={22}
                                    color={enabled ? colors.primary : colors.sub}
                                  />
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      ) : null}
                      {canManageRoles ? (
                        <>
                          <View style={styles.roleManagerHeader}>
                            <View>
                              <Text style={styles.cardTitle}>Member tags</Text>
                              <Text style={styles.cardMeta}>
                                Create labels for dues, levels, committees, or cohorts.
                              </Text>
                            </View>
                          </View>
                          <View style={styles.roleCreateRow}>
                            <TextInput
                              value={roleNameDraft}
                              onChangeText={setRoleNameDraft}
                              placeholder="Hasn't paid dues"
                              placeholderTextColor={colors.faint}
                              style={styles.roleNameInput}
                            />
                            <TouchableOpacity
                              style={styles.roleCreateButton}
                              onPress={() => void handleCreateRole()}
                              disabled={roleBusyId === 'create'}
                            >
                              <Ionicons name="add" size={20} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                          {(club.roles ?? []).length ? (
                            <View style={styles.roleList}>
                              {(club.roles ?? []).map((role) => (
                                <View key={role.id} style={styles.roleListItem}>
                                  <View style={styles.roleListIcon}>
                                    <Ionicons name="at-outline" size={15} color={colors.primary} />
                                  </View>
                                  <View style={styles.roleListCopy}>
                                    <Text style={styles.roleListTitle}>{role.name}</Text>
                                    <Text style={styles.cardMeta}>{role.memberCount ?? 0} assigned</Text>
                                  </View>
                                  <TouchableOpacity
                                    onPress={() => void handleDeleteRole(role.id)}
                                    disabled={roleBusyId === `delete:${role.id}`}
                                    style={styles.roleIconButton}
                                  >
                                    <Ionicons name="trash-outline" size={16} color={colors.dangerText} />
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text style={styles.cardMeta}>No member tags yet. Add one above, then assign one from a member card.</Text>
                          )}
                        </>
                      ) : null}
                    </View>
                  ) : null}
                  {canPostAnnouncements ? (
                    <View style={styles.outreachPanel}>
                      <TouchableOpacity
                        style={styles.composerHeader}
                        activeOpacity={0.86}
                        onPress={() => setOutreachOpen((current) => !current)}
                      >
                        <View>
                          <Text style={styles.cardTitle}>Bulk outreach</Text>
                          <Text style={styles.cardMeta}>Preview recipients before sending a notification.</Text>
                        </View>
                        <Ionicons name={outreachOpen ? 'remove' : 'add'} size={20} color={colors.primary} />
                      </TouchableOpacity>
                      {outreachOpen ? (
                        <>
                          <View style={styles.visibilityRow}>
                            {(['ALL', 'NON_RSVP', 'PRIMARY_ROLE', 'CUSTOM_ROLE', 'MANUAL'] as OutreachAudienceType[]).map((type) => (
                              <Chip
                                key={type}
                                label={{
                                  ALL: 'All',
                                  NON_RSVP: 'Non-RSVPs',
                                  PRIMARY_ROLE: 'Role',
                                  CUSTOM_ROLE: 'Member tag',
                                  MANUAL: 'Manual',
                                }[type]}
                                active={outreachAudienceType === type}
                                onPress={() => {
                                  setOutreachAudienceType(type);
                                  setOutreachPreview(null);
                                }}
                              />
                            ))}
                          </View>

                          {outreachAudienceType === 'NON_RSVP' ? (
                            <Text style={styles.cardMeta}>
                              {nextMeeting
                                ? `${nonRsvpCountForMeeting(nextMeeting)} ${
                                    nonRsvpCountForMeeting(nextMeeting) === 1 ? 'member has' : 'members have'
                                  } not RSVP’d to ${nextMeeting.title}.`
                                : 'Schedule a meeting before targeting non-RSVPs.'}
                            </Text>
                          ) : null}
                          {outreachAudienceType === 'PRIMARY_ROLE' ? (
                            <View style={styles.roleChipWrap}>
                              {(['OWNER', 'ADMIN', 'OFFICER', 'MEMBER'] as const).map((role) => (
                                <Chip
                                  key={role}
                                  label={role}
                                  active={outreachPrimaryRole === role}
                                  onPress={() => {
                                    setOutreachPrimaryRole(role);
                                    setOutreachPreview(null);
                                  }}
                                />
                              ))}
                            </View>
                          ) : null}
                          {outreachAudienceType === 'CUSTOM_ROLE' ? (
                            <View style={styles.roleChipWrap}>
                              {clubRoles.length ? clubRoles.map((role) => (
                                <Chip
                                  key={role.id}
                                  label={role.name}
                                  active={outreachRoleId === role.id}
                                  onPress={() => {
                                    setOutreachRoleId(role.id);
                                    setOutreachPreview(null);
                                  }}
                                />
                              )) : (
                                <Text style={styles.cardMeta}>Create member tags before targeting them.</Text>
                              )}
                            </View>
                          ) : null}
                          {outreachAudienceType === 'MANUAL' ? (
                            <View style={styles.manualPicker}>
                              {club.members.map((member) => {
                                const selected = outreachManualIds.includes(member.userId);
                                return (
                                  <TouchableOpacity
                                    key={member.id}
                                    style={[styles.manualMemberChip, selected ? styles.manualMemberChipActive : null]}
                                    onPress={() => {
                                      setOutreachManualIds((current) =>
                                        selected
                                          ? current.filter((id) => id !== member.userId)
                                          : [...current, member.userId]
                                      );
                                      setOutreachPreview(null);
                                    }}
                                  >
                                    <Text style={[styles.manualMemberText, selected ? styles.manualMemberTextActive : null]}>
                                      {member.user.name}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          ) : null}

                          <TextInput
                            value={outreachText}
                            onChangeText={setOutreachText}
                            placeholder="Write a clear, specific message"
                            placeholderTextColor={colors.faint}
                            style={[styles.input, styles.inputTall]}
                            multiline
                          />
                          <View style={styles.eventButtonRow}>
                            <PrimaryButton
                              label="Preview audience"
                              onPress={() => void handlePreviewOutreach()}
                              loading={outreachBusy}
                              kind="ghost"
                            />
                            <PrimaryButton
                              label="Send outreach"
                              onPress={() => void handleSendOutreach()}
                              loading={outreachBusy}
                              disabled={!outreachPreview || outreachPreview.count === 0}
                            />
                          </View>
                          {outreachPreview ? (
                            <View style={styles.previewBox}>
                              <Text style={styles.cardTitle}>
                                {outreachPreview.count} recipient{outreachPreview.count === 1 ? '' : 's'}
                              </Text>
                              <Text style={styles.cardMeta}>{outreachPreview.audience}</Text>
                              {outreachPreview.recipients.slice(0, 12).map((recipient) => (
                                <Text key={recipient.id} style={styles.previewRecipient}>
                                  {recipient.name} • {recipient.role}
                                </Text>
                              ))}
                              {outreachPreview.recipients.length > 12 ? (
                                <Text style={styles.cardMeta}>+{outreachPreview.recipients.length - 12} more</Text>
                              ) : null}
                            </View>
                          ) : null}
                          {outreachResult ? <Text style={styles.successText}>{outreachResult}</Text> : null}
                        </>
                      ) : null}
                    </View>
                  ) : null}
                  {club.members.length ? (
                    <>
                      {memberGroups.leadership.length ? (
                        <View style={styles.memberGroup}>
                          <Text style={styles.memberGroupTitle}>Leadership</Text>
                          <View style={styles.memberGroupCard}>
                            {memberGroups.leadership.map((member, index) => (
                              <View key={member.id}>
                                {index > 0 ? <View style={styles.memberSeparator} /> : null}
                                {renderMemberRow(member)}
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}
                      {memberGroups.general.length ? (
                        <View style={styles.memberGroup}>
                          <Text style={styles.memberGroupTitle}>
                            Members · {memberGroups.general.length}
                          </Text>
                          <View style={styles.memberGroupCard}>
                            {memberGroups.general.map((member, index) => (
                              <View key={member.id}>
                                {index > 0 ? <View style={styles.memberSeparator} /> : null}
                                {renderMemberRow(member)}
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <EmptyState
                      icon="people-outline"
                      title="No members loaded"
                      body="Member details will show up here once the club roster loads in."
                    />
                  )}
                </View>
              ) : null}

              {mode === 'events' ? (
                <View style={styles.section}>
                  <View style={styles.eventsHeader}>
                    <Text style={styles.screenSectionTitle}>Events</Text>
                    <View style={styles.eventsHeaderActions}>
                      {meetings.length ? (
                        <TouchableOpacity
                          style={styles.eventsHeaderButton}
                          onPress={() => void handleExportCalendar()}
                          disabled={calendarExportBusy}
                          accessibilityRole="button"
                          accessibilityLabel="Export meetings as a calendar file"
                        >
                          <Ionicons name="download-outline" size={15} color={colors.ink} />
                          <Text style={styles.eventsHeaderButtonText}>
                            {calendarExportBusy ? 'Exporting…' : 'Export'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {canCreateMeetings ? (
                        <TouchableOpacity
                          style={[styles.eventsHeaderButton, styles.eventsHeaderButtonPrimary]}
                          onPress={() => setMeetingComposerOpen((current) => !current)}
                          accessibilityRole="button"
                          accessibilityLabel={meetingComposerOpen ? 'Close meeting composer' : 'Create meeting'}
                        >
                          <Ionicons name={meetingComposerOpen ? 'close' : 'add'} size={15} color="#FFFFFF" />
                          <Text style={[styles.eventsHeaderButtonText, styles.eventsHeaderButtonTextPrimary]}>
                            {meetingComposerOpen ? 'Close' : 'New'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {canCreateMeetings && meetingComposerOpen ? (
                    <View style={styles.composerCard}>
                      <Text style={styles.cardTitle}>Create meeting</Text>
                      <Text style={styles.cardBody}>Schedule an event for your club.</Text>
                      <TextInput
                        value={meetingTitle}
                        onChangeText={setMeetingTitle}
                        placeholder="Meeting title"
                        placeholderTextColor={colors.faint}
                        style={styles.input}
                      />
                      <TextInput
                        value={meetingLocation}
                        onChangeText={setMeetingLocation}
                        placeholder="Location"
                        placeholderTextColor={colors.faint}
                        style={styles.input}
                      />
                      <TextInput
                        value={meetingDescription}
                        onChangeText={setMeetingDescription}
                        placeholder="Description"
                        placeholderTextColor={colors.faint}
                        style={[styles.input, styles.inputTall]}
                        multiline
                      />
                      <View style={styles.visibilityRow}>
                        {VISIBILITY_OPTIONS.map((option) => (
                          <Chip
                            key={option.value}
                            label={option.label}
                            active={meetingVisibility === option.value}
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
                              : [...current, roleId]
                          )
                        }
                      />
                      <View style={styles.datePickerCard}>
                        <Text style={styles.cardMeta}>Date & time</Text>
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
                      <PrimaryButton
                        label="Create meeting"
                        onPress={() => void handleCreateMeeting()}
                        loading={meetingBusy}
                      />
                    </View>
                  ) : null}

                  {meetings.length ? meetings.map((meeting) => (
                    <View key={meeting.id} style={styles.eventCard}>
                      <View style={styles.eventHead}>
                        <DateBadge iso={meeting.meetingTime} />
                        <View style={styles.eventCopy}>
                          <Text style={styles.eventDateLine}>
                            {relativeDayLabel(meeting.meetingTime)}, {formatShortDate(meeting.meetingTime)} • {formatTime(meeting.meetingTime)}
                          </Text>
                          <Text style={styles.eventTitle}>{meeting.title}</Text>
                          <Text style={styles.eventLocation}>{meeting.location}</Text>
                        </View>
                        <View style={styles.eventActions}>
                          <View style={styles.eventGoingPill}>
                            <Ionicons name="people" size={12} color={colors.primarySoftText} />
                            <Text style={styles.eventGoingText}>{meeting.rsvpCounts.going}</Text>
                          </View>
                          {canDeleteClubContent ? (
                            <TouchableOpacity
                              style={styles.eventDeleteButton}
                              onPress={() => void handleDeleteMeeting(meeting)}
                              disabled={deleteContentBusyId === `meeting:${meeting.id}`}
                            >
                              <Ionicons name="trash-outline" size={16} color={colors.dangerText} />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.rsvpRow}>
                        {RSVP_OPTIONS.map((option) => (
                          <Chip
                            key={option.value}
                            label={option.label}
                            active={meeting.myRsvp === option.value}
                            onPress={() => void handleRsvp(meeting.id, option.value)}
                          />
                        ))}
                      </View>

                      {meeting.description ? (
                        <Text style={styles.cardBody}>{meeting.description}</Text>
                      ) : null}

                      <View style={styles.eventMetaRow}>
                        <Text style={styles.cardMeta}>{meeting.attendeeCount} checked in</Text>
                        <Text style={styles.cardMeta}>
                          {meeting.targetRoleIds?.length
                            ? roleAudienceLabel(meeting.targetRoleIds)
                            : visibilityLabel(meeting.visibility)}
                        </Text>
                      </View>

                      {canCreateMeetings ? (
                        <>
                          <TouchableOpacity
                            style={styles.leaderToolsToggle}
                            onPress={() => setLeaderToolsMeetingId((current) => (current === meeting.id ? null : meeting.id))}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel="Toggle leader tools"
                            accessibilityState={{ expanded: leaderToolsMeetingId === meeting.id }}
                          >
                            <Ionicons name="key-outline" size={15} color={colors.violet} />
                            <Text style={styles.leaderToolsToggleText}>Leader tools</Text>
                            {meeting.attendanceCode ? (
                              <View style={styles.leaderToolsOpenPill}>
                                <Text style={styles.leaderToolsOpenPillText}>Attendance open</Text>
                              </View>
                            ) : null}
                            <View style={styles.leaderToolsSpacer} />
                            <Ionicons
                              name={leaderToolsMeetingId === meeting.id ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={colors.sub}
                            />
                          </TouchableOpacity>
                          {leaderToolsMeetingId === meeting.id ? (
                            <View style={styles.attendanceBox}>
                              {meeting.attendanceCode ? (
                                <View style={styles.attendanceCodeBlock}>
                                  <Text style={styles.cardMeta}>Attendance code</Text>
                                  <Text style={styles.attendanceCodeText}>{meeting.attendanceCode}</Text>
                                  <Text style={styles.cardMeta}>Attendance is open. Regenerating this code makes the current one stop working.</Text>
                                </View>
                              ) : (
                                <Text style={styles.cardBody}>Attendance is closed right now.</Text>
                              )}
                              {meeting.rsvpReminderSentAt ? (
                                <Text style={styles.cardMeta}>
                                  Last RSVP reminder: {formatDateTime(meeting.rsvpReminderSentAt)} • {meeting.rsvpReminderStatus ?? 'sent'} • {meeting.rsvpReminderCount ?? 0} targeted
                                </Text>
                              ) : (
                                <Text style={styles.cardMeta}>
                                  {nonRsvpCountForMeeting(meeting)} member{nonRsvpCountForMeeting(meeting) === 1 ? '' : 's'} have not RSVP’d.
                                </Text>
                              )}
                              <View style={styles.eventButtonRow}>
                                <PrimaryButton
                                  label={meeting.attendanceCode ? 'Regenerate code' : 'Open attendance'}
                                  onPress={() => void handleOpenAttendance(meeting.id)}
                                  loading={attendanceBusyId === `open-${meeting.id}`}
                                  kind="ghost"
                                />
                                {meeting.attendanceCode ? (
                                  <>
                                    <PrimaryButton
                                      label="Copy"
                                      onPress={() => void handleCopyAttendanceCode(meeting.attendanceCode!)}
                                      kind="ghost"
                                    />
                                    <PrimaryButton
                                      label="Share"
                                      onPress={() => void handleShareAttendanceCode(meeting)}
                                      kind="ghost"
                                    />
                                  </>
                                ) : null}
                                {meeting.attendanceCode ? (
                                  <PrimaryButton
                                    label="Close"
                                    onPress={() => void handleCloseAttendance(meeting.id)}
                                    loading={attendanceBusyId === `close-${meeting.id}`}
                                    kind="ghost"
                                  />
                                ) : null}
                                <PrimaryButton
                                  label="Attendance"
                                  onPress={() => void handleLoadAttendance(meeting.id)}
                                  loading={attendanceBusyId === `view-${meeting.id}`}
                                  kind="ghost"
                                />
                                <PrimaryButton
                                  label="Remind non-RSVPs"
                                  onPress={() => void handleSendRsvpReminder(meeting)}
                                  loading={attendanceBusyId === `rsvp-${meeting.id}`}
                                  kind="ghost"
                                  disabled={nonRsvpCountForMeeting(meeting) === 0}
                                />
                              </View>
                              {attendancePanels[meeting.id]?.attendees.length ? (
                                <View style={styles.attendeeRow}>
                                  {attendancePanels[meeting.id]!.attendees.slice(0, 6).map((attendee) => (
                                    <UserAvatar
                                      key={attendee.id}
                                      name={attendee.user?.name ?? 'Attendee'}
                                      avatarUrl={attendee.user?.avatarUrl}
                                      size={28}
                                    />
                                  ))}
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                        </>
                      ) : isMember ? (
                        <View style={styles.attendanceBox}>
                          <Text style={styles.cardBody}>Have the attendance code? Check in here.</Text>
                              <TextInput
                                value={attendanceCodeDraft[meeting.id] ?? ''}
                                onChangeText={(value) => setAttendanceCodeDraft((current) => ({ ...current, [meeting.id]: value.toUpperCase() }))}
                                placeholder="Enter attendance code"
                                placeholderTextColor={colors.faint}
                                style={styles.input}
                                autoCapitalize="characters"
                              />
                          <PrimaryButton
                            label="Check in"
                            onPress={() => void handleCheckIn(meeting.id)}
                            loading={attendanceBusyId === `checkin-${meeting.id}`}
                          />
                        </View>
                      ) : null}
                    </View>
                  )) : (
                    <EmptyState
                      icon="calendar-outline"
                      title="No meetings yet"
                      body="Once club events are scheduled, they’ll appear here."
                    />
                  )}
                </View>
              ) : null}

              {mode === 'analytics' ? (
                <View style={styles.section}>
                  <View>
                    <Text style={styles.screenSectionTitle}>Club health</Text>
                    <Text style={styles.cardMeta}>
                      Snapshot based on current members, upcoming meetings, RSVPs, attendance, and announcements.
                    </Text>
                  </View>
                  <View style={styles.analyticsGrid}>
                    <MetricCard
                      icon="people-outline"
                      tint={colors.blue}
                      soft={colors.blueSoft}
                      label="Members"
                      value={String(analytics.memberCount)}
                      detail="Current roster"
                    />
                    <MetricCard
                      icon="calendar-outline"
                      tint={colors.violet}
                      soft={colors.violetSoft}
                      label="Upcoming"
                      value={String(analytics.upcomingCount)}
                      detail="Scheduled meetings"
                    />
                    <MetricCard
                      icon="checkbox-outline"
                      tint={colors.green}
                      soft={colors.greenSoft}
                      label="RSVPs"
                      value={`${analytics.rsvpGoing}/${analytics.rsvpMaybe}/${analytics.rsvpNotGoing}`}
                      detail="Going / maybe / can't go"
                    />
                    <MetricCard
                      icon="finger-print-outline"
                      tint={colors.teal}
                      soft={colors.tealSoft}
                      label="Attendance"
                      value={String(analytics.checkedIn)}
                      detail="Checked in across meetings"
                    />
                    <MetricCard
                      icon="megaphone-outline"
                      tint={colors.amber}
                      soft={colors.amberSoft}
                      label="Announcements"
                      value={String(analytics.announcements)}
                      detail="Visible recent posts"
                    />
                  </View>

                  <View style={styles.analyticsPanel}>
                    <View style={styles.responseHead}>
                      <Text style={styles.cardTitle}>RSVP response rate</Text>
                      <Text style={styles.responseValue}>
                        {analytics.responseRate == null ? '—' : `${analytics.responseRate}%`}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { flex: Math.min(Math.max(analytics.responseRate ?? 0, 0), 100) }]} />
                      <View style={{ flex: 100 - Math.min(Math.max(analytics.responseRate ?? 0, 0), 100) }} />
                    </View>
                    <Text style={styles.cardMeta}>
                      {analytics.responseRate == null
                        ? 'Schedule meetings to start building a response signal.'
                        : 'Share of member RSVPs across upcoming meetings.'}
                    </Text>
                  </View>
                  <View style={styles.analyticsPanel}>
                    <Text style={styles.cardTitle}>Upcoming meeting breakdown</Text>
                    {meetings.length ? meetings.slice(0, 5).map((meeting) => (
                      <View key={meeting.id} style={styles.analyticsMeetingRow}>
                        <View style={styles.feedText}>
                          <Text style={styles.cardTitle}>{meeting.title}</Text>
                          <Text style={styles.cardMeta}>{formatShortDate(meeting.meetingTime)} • {formatTime(meeting.meetingTime)}</Text>
                        </View>
                        <Text style={styles.analyticsCount}>
                          {meeting.rsvpCounts.going} going • {meeting.attendeeCount} checked in
                        </Text>
                      </View>
                    )) : (
                      <Text style={styles.cardMeta}>No upcoming meetings yet, so meeting trends are not available.</Text>
                    )}
                  </View>
                  <View style={styles.analyticsPanel}>
                    <Text style={styles.cardTitle}>Member count trend</Text>
                    <Text style={styles.cardMeta}>
                      Historical member snapshots are not stored yet. Showing the current roster count only.
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.loadingWrap}>
            <SkeletonCard />
            <SkeletonCard compact />
            <SkeletonCard compact />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function SectionHeaderRow({
  title,
  actionLabel,
  onPress,
}: SectionHeaderRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      {actionLabel && onPress ? (
        <TouchableOpacity onPress={onPress}>
          <Text style={styles.linkText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function QuickActionCard({
  icon,
  title,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={styles.quickActionCard}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.quickActionTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tint = role === 'OWNER' ? colors.warnText : role === 'ADMIN' ? colors.primarySoftText : colors.violet;
  const soft = role === 'OWNER' ? colors.amberSoft : role === 'ADMIN' ? colors.primarySoft : colors.violetSoft;
  return (
    <View style={[styles.roleBadge, { backgroundColor: soft }]}>
      <Text style={[styles.roleBadgeText, { color: tint }]}>{role.toLowerCase()}</Text>
    </View>
  );
}

function DateBadge({ iso, size = 'regular' }: { iso: string; size?: 'regular' | 'large' }) {
  const styles = useStyles();
  const date = new Date(iso);
  const large = size === 'large';
  return (
    <View style={[styles.dateBadge, large && styles.dateBadgeLarge]}>
      <Text style={styles.dateBadgeMonth}>
        {date.toLocaleDateString([], { month: 'short' }).toUpperCase()}
      </Text>
      <Text style={[styles.dateBadgeDay, large && styles.dateBadgeDayLarge]}>{date.getDate()}</Text>
      <Text style={styles.dateBadgeWeekday}>
        {date.toLocaleDateString([], { weekday: 'short' })}
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
  const styles = useStyles();
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={15} color={tint} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.cardMeta}>{detail}</Text>
    </View>
  );
}

function RoleTargetPicker({
  roles,
  selectedRoleIds,
  onToggle,
}: {
  roles: Array<{ id: string; name: string }>;
  selectedRoleIds: string[];
  onToggle: (roleId: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  if (!roles.length) {
    return (
      <View style={styles.targetPickerEmpty}>
        <Ionicons name="pricetags-outline" size={16} color={colors.sub} />
        <Text style={styles.cardMeta}>Add member tags from Members to target specific groups.</Text>
      </View>
    );
  }

  return (
    <View style={styles.targetPicker}>
      <View style={styles.targetPickerHeader}>
        <Text style={styles.targetPickerTitle}>Target member tags</Text>
        <Text style={styles.targetPickerCount}>
          {selectedRoleIds.length ? `${selectedRoleIds.length} selected` : 'Optional'}
        </Text>
      </View>
      <View style={styles.roleChipWrap}>
        {selectedRoleIds.map((roleId) => {
          const role = roles.find((item) => item.id === roleId);
          if (!role) return null;
          return (
            <TouchableOpacity
              key={role.id}
              style={[styles.targetRoleChip, styles.targetRoleChipActive]}
              onPress={() => onToggle(role.id)}
              activeOpacity={0.82}
            >
              <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
              <Text style={[styles.targetRoleChipText, styles.targetRoleChipTextActive]}>
                {role.name}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.targetRoleAddButton}
          onPress={() => setOpen((current) => !current)}
          activeOpacity={0.82}
          accessibilityLabel={open ? 'Close member tag picker' : 'Open member tag picker'}
        >
          <Ionicons name={open ? 'remove' : 'add'} size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
      {open ? (
        <View style={styles.targetRoleMenu}>
          {roles.map((role) => {
            const selected = selectedRoleIds.includes(role.id);
            return (
              <TouchableOpacity
                key={role.id}
                style={[styles.targetRoleMenuItem, selected ? styles.targetRoleMenuItemActive : null]}
                onPress={() => onToggle(role.id)}
                activeOpacity={0.82}
              >
                <Text style={styles.targetRoleMenuText}>{role.name}</Text>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                  size={18}
                  color={selected ? colors.primary : colors.sub}
                />
              </TouchableOpacity>
            );
          })}
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
  audience,
  onReport,
}: {
  align: 'left' | 'right';
  name: string;
  avatarUrl?: string | null;
  content: string;
  time: string;
  audience?: string;
  onReport?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isRight = align === 'right';
  return (
    <View style={[styles.bubbleRow, isRight && styles.bubbleRowRight]}>
      {!isRight ? <UserAvatar name={name} avatarUrl={avatarUrl} size={34} /> : null}
      <View style={[styles.bubbleWrap, isRight && styles.bubbleWrapRight]}>
        {!isRight ? <Text style={styles.bubbleName}>{name}</Text> : null}
        {audience ? <Text style={styles.bubbleAudience}>{audience}</Text> : null}
        <View style={[styles.bubble, isRight && styles.bubbleRight]}>
          <Text style={[styles.bubbleText, isRight && styles.bubbleTextRight]}>{content}</Text>
        </View>
        <Text style={[styles.bubbleTime, isRight && styles.bubbleTimeRight]}>{time}</Text>
        {onReport ? (
          <TouchableOpacity onPress={onReport} style={[styles.reportInlineButton, isRight && styles.reportInlineRight]}>
            <Ionicons name="flag-outline" size={15} color={colors.sub} />
            <Text style={styles.reportInlineText}>Report</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  page: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  heroShell: {
    paddingBottom: spacing.md,
  },
  cover: {
    minHeight: 224,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  coverWatermark: {
    position: 'absolute',
    right: -34,
    top: -26,
    fontSize: 190,
    lineHeight: 210,
    opacity: 0.13,
    transform: [{ rotate: '-12deg' }],
  },
  coverCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  coverCategoryText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  coverPillDivider: {
    width: 1,
    height: 12,
    marginHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  coverTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coverActions: {
    flexDirection: 'row',
    gap: 10,
  },
  heroCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surface,
  },
  coverArt: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  coverIdentity: {
    width: 92,
    height: 92,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  coverAvatar: {
    width: 92,
    height: 92,
  },
  coverEmoji: {
    color: '#FFFFFF',
    fontSize: 48,
    lineHeight: 56,
  },
  heroCard: {
    marginTop: -38,
    marginHorizontal: spacing.md,
    borderRadius: 30,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...t.shadows.card,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  clubAvatarTile: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(108, 79, 220, 0.10)',
    overflow: 'hidden',
  },
  clubAvatarImage: {
    width: 76,
    height: 76,
  },
  clubAvatarEmoji: {
    color: t.colors.primary,
    fontSize: 38,
    lineHeight: 46,
  },
  identityCopy: {
    flex: 1,
    gap: 4,
  },
  clubTitle: {
    ...t.typography.h1,
    fontSize: 24,
    lineHeight: 30,
  },
  clubMeta: {
    ...t.typography.bodyStrong,
    color: t.colors.sub,
  },
  clubDescription: {
    ...t.typography.body,
    color: t.colors.ink,
  },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: t.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingVertical: spacing.sm + 2,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statCellValue: {
    fontFamily: fonts.displayHeavy,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.5,
    color: t.colors.ink,
  },
  statCellLabel: {
    ...t.typography.caption,
    fontSize: 11.5,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: t.colors.border,
  },
  tabBar: {
    gap: spacing.xs,
    paddingRight: spacing.md,
    paddingBottom: 2,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    ...t.shadows.subtle,
  },
  tabPillActive: {
    backgroundColor: t.colors.ink,
    borderColor: t.colors.ink,
  },
  tabPillLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: t.colors.sub,
  },
  tabPillLabelActive: {
    color: t.isDark ? '#0C0D11' : '#FFFFFF',
  },
  membershipRow: {
    marginTop: 2,
  },
  membershipButton: {
    borderRadius: radii.pill,
    backgroundColor: t.colors.primary,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.shadows.glow,
  },
  membershipButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: fonts.bold,
  },
  leaveClubButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  leaveClubButtonText: {
    ...t.typography.bodyStrong,
    color: t.colors.sub,
    fontSize: 13,
  },
  bodyWrap: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  loadingWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionHeaderTitle: {
    ...t.typography.h2,
  },
  linkText: {
    ...t.typography.bodyStrong,
    fontSize: 14,
    color: t.colors.primary,
  },
  upcomingCard: {
    gap: spacing.sm,
    borderRadius: 24,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    ...t.shadows.card,
  },
  upcomingHead: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  upcomingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateBadge: {
    width: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingVertical: 10,
    gap: 1,
  },
  dateBadgeLarge: {
    width: 80,
    paddingVertical: 14,
    backgroundColor: t.colors.violetSoft,
    borderColor: 'transparent',
  },
  dateBadgeMonth: {
    ...t.typography.label,
    fontSize: 10,
    letterSpacing: 1.2,
    color: t.colors.violet,
  },
  dateBadgeDay: {
    fontFamily: fonts.displayHeavy,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.6,
    color: t.colors.ink,
  },
  dateBadgeDayLarge: {
    fontSize: 30,
    lineHeight: 34,
  },
  dateBadgeWeekday: {
    ...t.typography.caption,
    fontSize: 11,
  },
  upcomingCopy: {
    flex: 1,
    gap: 4,
  },
  upcomingTime: {
    ...t.typography.bodyStrong,
    fontSize: 13,
    color: t.colors.violet,
  },
  upcomingTitle: {
    ...t.typography.title,
    fontSize: 20,
    lineHeight: 24,
  },
  upcomingLocation: {
    ...t.typography.body,
    fontSize: 14,
  },
  upcomingAttendees: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  upcomingAttendeeCount: {
    marginLeft: 8,
    ...t.typography.bodyStrong,
    fontSize: 13,
    color: t.colors.sub,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    borderRadius: 18,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingVertical: spacing.sm + 4,
    ...t.shadows.subtle,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primarySoft,
  },
  quickActionTitle: {
    ...t.typography.bodyStrong,
    fontSize: 13,
  },
  announcementPreview: {
    flexDirection: 'row',
    borderRadius: 20,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    overflow: 'hidden',
    ...t.shadows.subtle,
  },
  announcementPreviewBar: {
    width: 4,
    backgroundColor: t.colors.amber,
  },
  announcementPreviewBody: {
    flex: 1,
    padding: spacing.sm + 2,
    gap: 6,
  },
  announcementPreviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  announcementPreviewName: {
    ...t.typography.bodyStrong,
    fontSize: 13.5,
    flex: 1,
  },
  announcementPreviewTime: {
    ...t.typography.caption,
  },
  announcementPreviewContent: {
    ...t.typography.body,
    fontSize: 14,
    color: t.colors.ink,
  },
  announcementCard: {
    borderRadius: 22,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...t.shadows.card,
  },
  announcementHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'center',
  },
  announcementAuthor: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    flex: 1,
  },
  announcementCopy: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    ...t.typography.title,
  },
  cardMeta: {
    ...t.typography.body,
    fontSize: 13,
  },
  targetMeta: {
    ...t.typography.bodyStrong,
    color: t.colors.green,
    fontSize: 12,
  },
  audiencePill: {
    maxWidth: 140,
    borderRadius: radii.pill,
    backgroundColor: t.colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  audiencePillText: {
    ...t.typography.label,
    color: t.colors.primary,
  },
  cardBody: {
    ...t.typography.body,
    color: t.colors.ink,
  },
  screenSectionTitle: {
    ...t.typography.h1,
    fontSize: 22,
    lineHeight: 27,
  },
  screenSectionBody: {
    ...t.typography.body,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  membersCount: {
    ...t.typography.bodyStrong,
    color: t.colors.sub,
    paddingBottom: 2,
  },
  manageRolesButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: t.colors.primary,
    backgroundColor: t.colors.glass,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  manageRolesButtonText: {
    ...t.typography.bodyStrong,
    color: t.colors.primary,
    fontSize: 13,
  },
  roleManagerPanel: {
    gap: spacing.sm,
    borderRadius: 20,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    ...t.shadows.card,
  },
  roleManagerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permissionPanel: {
    gap: spacing.sm,
    borderRadius: 18,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.sm,
  },
  permissionList: {
    gap: 8,
  },
  permissionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 16,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.sm,
  },
  permissionRowActive: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primarySoft,
  },
  permissionCopy: {
    flex: 1,
    gap: 2,
  },
  permissionTitle: {
    ...t.typography.bodyStrong,
    color: t.colors.ink,
  },
  roleCreateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  roleNameInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.inputBg,
    paddingHorizontal: spacing.md,
    color: t.colors.ink,
    fontSize: 15,
  },
  roleCreateButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primary,
  },
  roleList: {
    gap: 8,
  },
  roleListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 16,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.sm,
  },
  roleListIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primarySoft,
  },
  roleListCopy: {
    flex: 1,
  },
  roleListTitle: {
    ...t.typography.bodyStrong,
    color: t.colors.ink,
  },
  roleIconButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.dangerBg,
  },
  roleChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  outreachPanel: {
    borderRadius: 22,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...t.shadows.card,
  },
  manualPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  manualMemberChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  manualMemberChipActive: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  manualMemberText: {
    ...t.typography.bodyStrong,
    color: t.colors.ink,
    fontSize: 13,
  },
  manualMemberTextActive: {
    color: '#FFFFFF',
  },
  previewBox: {
    borderRadius: 18,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    gap: 5,
  },
  previewRecipient: {
    ...t.typography.body,
    color: t.colors.ink,
    fontSize: 14,
  },
  successText: {
    ...t.typography.bodyStrong,
    color: '#247A4B',
  },
  roleAssignWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderRadius: 16,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.sm,
  },
  roleAssignButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: t.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: t.colors.surface,
  },
  roleAssignButtonActive: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primary,
  },
  roleAssignText: {
    ...t.typography.label,
    color: t.colors.primary,
  },
  roleAssignTextActive: {
    color: '#FFFFFF',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: t.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  newChatButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  chatHubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 22,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    ...t.shadows.card,
  },
  chatHubIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primarySoft,
  },
  chatHubCopy: {
    flex: 1,
    gap: 2,
  },
  chatHubTitle: {
    ...t.typography.title,
  },
  chatHubMeta: {
    ...t.typography.body,
    fontSize: 13,
  },
  chatHubRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  chatBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primary,
    paddingHorizontal: 6,
  },
  chatBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  chatConversation: {
    gap: spacing.sm,
  },
  chatConversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chatBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  chatConversationTitleBlock: {
    flex: 1,
    gap: 2,
  },
  chatConversationTitle: {
    ...t.typography.title,
  },
  chatConversationMeta: {
    ...t.typography.body,
    fontSize: 13,
  },
  composerCard: {
    borderRadius: 22,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...t.shadows.card,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  visibilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  targetPicker: {
    gap: spacing.xs,
    borderRadius: 16,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.sm,
  },
  targetPickerEmpty: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 16,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.sm,
  },
  targetPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  targetPickerTitle: {
    ...t.typography.bodyStrong,
    fontSize: 13,
    color: t.colors.ink,
  },
  targetPickerCount: {
    ...t.typography.body,
    fontSize: 12,
    color: t.colors.sub,
  },
  targetRoleChip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: t.colors.primary,
    backgroundColor: t.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  targetRoleChipActive: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primary,
  },
  targetRoleChipText: {
    ...t.typography.label,
    color: t.colors.primary,
  },
  targetRoleChipTextActive: {
    color: '#FFFFFF',
  },
  targetRoleAddButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.colors.primary,
    backgroundColor: t.colors.surface,
  },
  targetRoleMenu: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
    paddingTop: spacing.xs,
  },
  targetRoleMenuItem: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: t.colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  targetRoleMenuItemActive: {
    backgroundColor: t.colors.dangerBg,
  },
  targetRoleMenuText: {
    ...t.typography.bodyStrong,
    color: t.colors.ink,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  bubbleRowRight: {
    justifyContent: 'flex-end',
  },
  bubbleWrap: {
    maxWidth: '78%',
    gap: 4,
  },
  bubbleWrapRight: {
    alignItems: 'flex-end',
  },
  bubbleName: {
    ...t.typography.bodyStrong,
    fontSize: 13,
  },
  bubbleAudience: {
    ...t.typography.body,
    fontSize: 12,
    color: t.colors.sub,
  },
  bubble: {
    borderRadius: 18,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleRight: {
    backgroundColor: t.colors.violet,
    borderColor: t.colors.violet,
  },
  bubbleText: {
    ...t.typography.body,
    color: t.colors.ink,
  },
  bubbleTextRight: {
    color: '#FFFFFF',
  },
  bubbleTime: {
    ...t.typography.body,
    fontSize: 12,
    color: t.colors.sub,
  },
  bubbleTimeRight: {
    textAlign: 'right',
  },
  reportInlineButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  reportInlineRight: {
    alignSelf: 'flex-end',
  },
  reportInlineText: {
    ...t.typography.bodyStrong,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.sub,
  },
  inlineActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  dangerInlineText: {
    color: t.colors.dangerText,
  },
  typingText: {
    ...t.typography.body,
    color: t.colors.primary,
  },
  chatComposerDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 22,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: 8,
    ...t.shadows.card,
  },
  chatComposerInput: {
    flex: 1,
    borderRadius: radii.pill,
    backgroundColor: t.colors.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...t.typography.body,
    color: t.colors.ink,
  },
  sendFab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.violet,
  },
  sendFabDisabled: {
    opacity: 0.42,
  },
  memberGroup: {
    gap: 6,
  },
  memberGroupTitle: {
    ...t.typography.label,
    paddingHorizontal: 2,
  },
  memberGroupCard: {
    borderRadius: 22,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: spacing.sm + 2,
    ...t.shadows.subtle,
  },
  memberSeparator: {
    height: 1,
    backgroundColor: t.colors.border,
    marginLeft: 52,
  },
  memberRow: {
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  memberRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  memberRowProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  memberCopy: {
    flex: 1,
    gap: 2,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    ...t.typography.bodyStrong,
    fontSize: 15.5,
    flexShrink: 1,
  },
  memberMetaText: {
    ...t.typography.caption,
    fontSize: 12.5,
  },
  memberActionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.inputBg,
  },
  roleBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  eventsHeaderActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  eventsHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  eventsHeaderButtonPrimary: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  eventsHeaderButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: t.colors.ink,
  },
  eventsHeaderButtonTextPrimary: {
    color: '#FFFFFF',
  },
  datePickerCard: {
    borderRadius: 18,
    backgroundColor: t.colors.surfaceAlt,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  eventCard: {
    borderRadius: 24,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...t.shadows.card,
  },
  eventHead: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  eventActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  eventDeleteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.dangerBg,
  },
  eventCopy: {
    flex: 1,
    gap: 3,
  },
  eventDateLine: {
    ...t.typography.bodyStrong,
    fontSize: 13,
    color: t.colors.violet,
  },
  eventTitle: {
    ...t.typography.title,
    fontSize: 21,
    lineHeight: 25,
  },
  eventLocation: {
    ...t.typography.body,
    fontSize: 14,
  },
  eventGoingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    backgroundColor: t.colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  eventGoingText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: t.colors.primarySoftText,
  },
  leaderToolsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: t.colors.violetSoft,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 10,
  },
  leaderToolsToggleText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: t.colors.violet,
  },
  leaderToolsOpenPill: {
    borderRadius: radii.pill,
    backgroundColor: t.colors.greenSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  leaderToolsOpenPillText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: t.colors.successText,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  leaderToolsSpacer: {
    flex: 1,
  },
  rsvpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  eventMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  attendanceBox: {
    borderRadius: 18,
    backgroundColor: t.colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.sm,
  },
  attendanceCodeBlock: {
    borderRadius: 18,
    backgroundColor: t.colors.glass,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    gap: 6,
  },
  attendanceCodeText: {
    ...t.typography.h1,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: 2,
    color: t.colors.ink,
  },
  eventButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    width: '48%',
    minWidth: 150,
    borderRadius: 18,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    gap: 4,
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    ...t.typography.bodyStrong,
    color: t.colors.sub,
    fontSize: 13,
  },
  metricValue: {
    ...t.typography.h1,
    fontSize: 25,
    lineHeight: 30,
  },
  responseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  responseValue: {
    fontFamily: fonts.displayHeavy,
    fontSize: 22,
    lineHeight: 26,
    color: t.colors.primary,
  },
  progressTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    backgroundColor: t.colors.inputBg,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: t.colors.primary,
    borderRadius: 4,
  },
  analyticsPanel: {
    borderRadius: 22,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  analyticsMeetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  feedText: {
    flex: 1,
  },
  analyticsCount: {
    ...t.typography.bodyStrong,
    color: t.colors.sub,
    fontSize: 13,
    textAlign: 'right',
  },
  attendeeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  content: {
    flexGrow: 1,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  errorText: {
    ...t.typography.bodyStrong,
    color: t.colors.dangerText,
  },
  input: {
    borderRadius: 18,
    backgroundColor: t.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    ...t.typography.body,
    color: t.colors.ink,
  },
  inputTall: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
}));
