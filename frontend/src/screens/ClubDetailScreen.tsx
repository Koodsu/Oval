import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  createClubRole,
  deleteClubRole,
  getClubMeetingAttendance,
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
  sendClubMessage,
  sendClubOfficerMessage,
  sendClubOfficerTyping,
  sendClubTyping,
  uploadClubAvatar,
} from '../api';
import { RootStackParamList } from '../../App';
import {
  ClubAnnouncementRow,
  ClubDetail,
  ClubMeetingAttendanceResponse,
  ClubMeetingWithMeta,
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
  SegmentedControl,
  SkeletonCard,
  UserAvatar,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, formatShortDate, formatTime } from '../utils/format';
import { palette, radii, shadows, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ClubDetail'>;
type Mode = 'overview' | 'chat' | 'members' | 'events';
type ChatView = 'hub' | 'announcements' | 'general' | 'officers';

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
  const [attendanceCodeDraft, setAttendanceCodeDraft] = useState<Record<string, string>>({});
  const [attendanceBusyId, setAttendanceBusyId] = useState<string | null>(null);
  const [attendancePanels, setAttendancePanels] = useState<Record<string, ClubMeetingAttendanceResponse | null>>({});
  const [avatarBusy, setAvatarBusy] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const officerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canManageMeetings = useMemo(
    () => club?.myRole === 'OWNER' || club?.myRole === 'ADMIN' || club?.myRole === 'OFFICER',
    [club?.myRole]
  );
  const canManageMembers = club?.myRole === 'OWNER' || club?.myRole === 'ADMIN';
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
      } catch {
        setLoadError(API_USER_MESSAGE);
        if (showAlert) {
          Alert.alert('Could not load club', API_USER_MESSAGE);
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

  const pingTyping = useCallback(() => {
    if (!isMember || !messageText.trim()) return;
    if (typingTimerRef.current) return;
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 2500);
    void sendClubTyping(clubId).catch(() => {});
  }, [clubId, isMember, messageText]);

  const pingOfficerTyping = useCallback(() => {
    if (!canManageMeetings || !officerMessageText.trim()) return;
    if (officerTypingTimerRef.current) return;
    officerTypingTimerRef.current = setTimeout(() => {
      officerTypingTimerRef.current = null;
    }, 2500);
    void sendClubOfficerTyping(clubId).catch(() => {});
  }, [canManageMeetings, clubId, officerMessageText]);

  const handleMembership = async () => {
    if (!club) return;
    setMembershipBusy(true);
    try {
      if (club.isMember) {
        await leaveClub(club.id);
      } else {
        await joinClub(club.id);
      }
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
    } catch {
      Alert.alert('Could not send message', API_USER_MESSAGE);
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
    } catch {
      Alert.alert('Could not send officer message', API_USER_MESSAGE);
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

  const handleCreateMeeting = async () => {
    if (!club || !meetingTitle.trim() || !meetingLocation.trim()) {
      Alert.alert('Missing meeting info', 'Add a title and location before creating the meeting.');
      return;
    }
    const latestAllowed = Date.now() + 7 * 24 * 60 * 60 * 1000;
    if (meetingTime.getTime() > latestAllowed || meetingTime.getTime() < Date.now()) {
      Alert.alert('Choose a valid time', 'Meetings need to be scheduled within the next 7 days.');
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
    } catch {
      Alert.alert('Could not create meeting', API_USER_MESSAGE);
    } finally {
      setMeetingBusy(false);
    }
  };

  const handleOpenAttendance = async (meetingId: string) => {
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

  const handleRoleChange = async (memberUserId: string, role: 'ADMIN' | 'OFFICER' | 'MEMBER') => {
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

  const handleTogglePingRole = async (memberUserId: string, roleId: string, assigned: boolean) => {
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

  const modeOptions = useMemo(() => {
    const options: Array<{ value: Mode; label: string }> = [{ value: 'overview', label: 'Overview' }];
    if (isMember) options.push({ value: 'chat', label: 'Chats' });
    options.push({ value: 'members', label: 'Members' });
    options.push({ value: 'events', label: 'Events' });
    return options;
  }, [isMember]);

  const nextMeeting = useMemo(() => meetings[0] ?? null, [meetings]);
  const recentMembers = useMemo(() => club?.members.slice(0, 5) ?? [], [club?.members]);
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
    if (canManageMeetings) {
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
  }, [announcements.length, canManageMeetings, messages.length, officerMessages.length]);

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
              <LinearGradient colors={['#22160E', '#8C2E1F', '#C85C38']} style={styles.cover}>
                <View style={styles.coverTopBar}>
                  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.heroCircleButton}>
                    <Ionicons name="chevron-back" size={20} color={palette.ink} />
                  </TouchableOpacity>
                  <View style={styles.coverActions}>
                    {canManageMembers ? (
                      <TouchableOpacity
                        onPress={() => void handleUploadClubAvatar()}
                        style={styles.heroCircleButton}
                        disabled={avatarBusy}
                      >
                        <Ionicons name="camera-outline" size={18} color={palette.ink} />
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity style={styles.heroCircleButton}>
                      <Ionicons name="ellipsis-horizontal" size={18} color={palette.ink} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.coverArt}>
                  <Text style={styles.coverEmoji}>{club.emoji}</Text>
                </View>
              </LinearGradient>

              <View style={styles.heroCard}>
                <View style={styles.identityRow}>
                  <View style={styles.clubAvatarTile}>
                    <Text style={styles.clubAvatarEmoji}>{club.emoji}</Text>
                  </View>
                  <View style={styles.identityCopy}>
                    <Text style={styles.clubTitle}>{club.name}</Text>
                    <Text style={styles.clubMeta}>{club.category}</Text>
                  </View>
                </View>

                <Text style={styles.clubDescription}>{club.description}</Text>

                <View style={styles.summaryGrid}>
                  <View style={styles.summaryCard}>
                    <Ionicons name="calendar-outline" size={18} color={palette.slate} />
                    <Text style={styles.summaryLabel}>Next meeting</Text>
                    <Text style={styles.summaryValue}>
                      {nextMeeting ? `${relativeDayLabel(nextMeeting.meetingTime)} at ${formatTime(nextMeeting.meetingTime)}` : 'Nothing scheduled yet'}
                    </Text>
                    <Text style={styles.summarySubvalue}>{nextMeeting?.location ?? 'Club updates will land here.'}</Text>
                  </View>

                  <View style={styles.summaryCard}>
                    <Ionicons name="people-outline" size={18} color={palette.slate} />
                    <Text style={styles.summaryLabel}>Going</Text>
                    <Text style={styles.summaryValue}>
                      {nextMeeting ? `${nextMeeting.rsvpCounts.going} members going` : 'No RSVPs yet'}
                    </Text>
                    <View style={styles.summaryAvatarRail}>
                      {recentMembers.slice(0, 4).map((member, index) => (
                        <View key={member.id} style={{ marginLeft: index === 0 ? 0 : -8 }}>
                          <UserAvatar name={member.user.name} avatarUrl={member.user.avatarUrl} size={28} />
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.membershipRow}>
                  {club.isMember ? (
                    <TouchableOpacity
                      style={styles.leaveClubButton}
                      onPress={() => void handleMembership()}
                      disabled={membershipBusy}
                      activeOpacity={0.72}
                    >
                      <Ionicons name="log-out-outline" size={15} color={palette.slate} />
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
              <SegmentedControl
                value={mode}
                options={modeOptions}
                onChange={(value) => {
                  setMode(value);
                  if (value !== 'chat') setChatView('hub');
                }}
              />

              {mode === 'overview' ? (
                <View style={styles.section}>
                  <SectionHeaderRow
                    title="Upcoming"
                    actionLabel={meetings.length ? 'View calendar' : undefined}
                    onPress={() => setMode('events')}
                  />

                  {nextMeeting ? (
                    <View style={styles.upcomingCard}>
                      <LinearGradient colors={['#E8DCCB', '#F2ECE3']} style={styles.upcomingThumb}>
                        <Text style={styles.upcomingThumbEmoji}>{club.emoji}</Text>
                      </LinearGradient>

                      <View style={styles.upcomingCopy}>
                        <Text style={styles.upcomingTime}>
                          {relativeDayLabel(nextMeeting.meetingTime)} • {formatTime(nextMeeting.meetingTime)}
                        </Text>
                        <Text style={styles.upcomingTitle}>{nextMeeting.title}</Text>
                        <Text style={styles.upcomingLocation}>{nextMeeting.location}</Text>
                        <View style={styles.upcomingAttendees}>
                          {recentMembers.slice(0, 5).map((member, index) => (
                            <View key={member.id} style={{ marginLeft: index === 0 ? 0 : -8 }}>
                              <UserAvatar name={member.user.name} avatarUrl={member.user.avatarUrl} size={26} />
                            </View>
                          ))}
                          <Text style={styles.upcomingAttendeeCount}>+{nextMeeting.rsvpCounts.going}</Text>
                        </View>
                      </View>

                      <TouchableOpacity style={styles.goingButton} onPress={() => setMode('events')}>
                        <Text style={styles.goingButtonText}>Going</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <EmptyState
                      icon="calendar-outline"
                      title="No upcoming meetings"
                      body="Schedule your first event to kick the club dashboard into motion."
                    />
                  )}

                  {canManageMeetings ? (
                    <View style={styles.quickActionRow}>
                      <QuickActionCard
                        icon="megaphone-outline"
                        title="Create announcement"
                        body="Share an update with the club."
                        onPress={() => {
                          setMode('chat');
                          setChatView('announcements');
                          setAnnouncementComposerOpen(true);
                        }}
                      />
                      <QuickActionCard
                        icon="calendar-outline"
                        title="Schedule meeting"
                        body="Plan an event for your club."
                        onPress={() => {
                          setMode('events');
                          setMeetingComposerOpen(true);
                        }}
                      />
                    </View>
                  ) : null}

                  <SectionHeaderRow title="Recent announcements" actionLabel={announcements.length ? 'View all' : undefined} onPress={() => {
                    setMode('chat');
                    setChatView('announcements');
                  }} />

                  {announcements.length ? (
                    announcements.slice(0, 3).map((announcement) => (
                      <View key={announcement.id} style={styles.announcementCard}>
                        <View style={styles.announcementHead}>
                          <View style={styles.announcementAuthor}>
                            <UserAvatar name={announcement.user.name} avatarUrl={announcement.user.avatarUrl} size={34} />
                            <View style={styles.announcementCopy}>
                              <Text style={styles.cardTitle}>{announcement.user.name}</Text>
                              <Text style={styles.cardMeta}>
                                {relativeDayLabel(announcement.createdAt)} • {visibilityLabel(announcement.visibility)}
                              </Text>
                              {announcement.targetRoleIds?.length ? (
                                <Text style={styles.targetMeta}>{roleAudienceLabel(announcement.targetRoleIds)}</Text>
                              ) : null}
                            </View>
                          </View>
                          <TouchableOpacity onPress={() => {
                            setMode('chat');
                            setChatView('announcements');
                          }}>
                            <Text style={styles.linkText}>Open</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.cardBody}>{announcement.content}</Text>
                      </View>
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
                        {canManageMeetings ? (
                          <TouchableOpacity
                            style={styles.newChatButton}
                            activeOpacity={0.88}
                            onPress={() => {
                              setChatView('announcements');
                              setAnnouncementComposerOpen(true);
                            }}
                          >
                            <Ionicons name="add" size={16} color={palette.white} />
                            <Text style={styles.newChatButtonText}>New chat</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      {chatCards.map((item) => (
                        <TouchableOpacity
                          key={item.key}
                          style={styles.chatHubCard}
                          activeOpacity={0.92}
                          onPress={() => setChatView(item.key)}
                        >
                          <View style={styles.chatHubIcon}>
                            <Ionicons name={item.icon} size={20} color={palette.scarlet} />
                          </View>
                          <View style={styles.chatHubCopy}>
                            <Text style={styles.chatAudience}>{item.audience}</Text>
                            <Text style={styles.chatHubTitle}>{item.title}</Text>
                            <Text style={styles.chatHubMeta}>{item.subtitle}</Text>
                          </View>
                          <View style={styles.chatHubRight}>
                            {item.badge ? <View style={styles.chatBadge}><Text style={styles.chatBadgeText}>{item.badge}</Text></View> : null}
                            <Ionicons name="chevron-forward" size={18} color={palette.slate} />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  ) : (
                    <View style={styles.chatConversation}>
                      <View style={styles.chatConversationHeader}>
                        <TouchableOpacity onPress={() => setChatView('hub')} style={styles.chatBackButton}>
                          <Ionicons name="chevron-back" size={18} color={palette.ink} />
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
                          {canManageMeetings ? (
                            <View style={styles.composerCard}>
                              <TouchableOpacity
                                activeOpacity={0.86}
                                style={styles.composerHeader}
                                onPress={() => setAnnouncementComposerOpen((current) => !current)}
                              >
                                <Text style={styles.cardTitle}>Create announcement</Text>
                                <Ionicons name={announcementComposerOpen ? 'remove' : 'add'} size={20} color={palette.scarlet} />
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
                                    placeholderTextColor={palette.slate}
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

                          {announcements.length ? announcements.map((announcement, index) => (
                            <MessageBubble
                              key={announcement.id}
                              align={index % 3 === 1 ? 'right' : 'left'}
                              name={announcement.user.name}
                              avatarUrl={announcement.user.avatarUrl}
                              content={announcement.content}
                              time={formatTime(announcement.createdAt)}
                              audience={
                                announcement.targetRoleIds?.length
                                  ? roleAudienceLabel(announcement.targetRoleIds)
                                  : visibilityLabel(announcement.visibility)
                              }
                            />
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
                              align={message.userId === user?.id || index % 4 === 2 ? 'right' : 'left'}
                              name={message.user.name}
                              avatarUrl={message.user.avatarUrl}
                              content={message.content}
                              time={formatTime(message.createdAt)}
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
                                if (value.trim()) pingTyping();
                              }}
                              placeholder="Message members..."
                              placeholderTextColor={palette.slate}
                              style={styles.chatComposerInput}
                            />
                            <TouchableOpacity style={styles.sendFab} onPress={() => void handleSend()} disabled={sendBusy}>
                              <Ionicons name="paper-plane-outline" size={18} color={palette.white} />
                            </TouchableOpacity>
                          </View>
                        </>
                      ) : null}

                      {chatView === 'officers' ? (
                        <>
                          {officerMessages.length ? officerMessages.map((message, index) => (
                            <MessageBubble
                              key={message.id}
                              align={message.userId === user?.id || index % 4 === 2 ? 'right' : 'left'}
                              name={message.user.name}
                              avatarUrl={message.user.avatarUrl}
                              content={message.content}
                              time={formatTime(message.createdAt)}
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
                                if (value.trim()) pingOfficerTyping();
                              }}
                              placeholder="Coordinate with officers..."
                              placeholderTextColor={palette.slate}
                              style={styles.chatComposerInput}
                            />
                            <TouchableOpacity style={styles.sendFab} onPress={() => void handleOfficerSend()} disabled={officerSendBusy}>
                              <Ionicons name="paper-plane-outline" size={18} color={palette.white} />
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
                    {canManageMembers ? (
                      <TouchableOpacity
                        style={styles.manageRolesButton}
                        onPress={() => setRolePanelOpen((current) => !current)}
                        activeOpacity={0.82}
                      >
                        <Ionicons name="pricetags-outline" size={16} color={palette.scarlet} />
                        <Text style={styles.manageRolesButtonText}>Manage roles</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {canManageMembers && rolePanelOpen ? (
                    <View style={styles.roleManagerPanel}>
                      <View style={styles.roleManagerHeader}>
                        <View>
                          <Text style={styles.cardTitle}>Ping roles</Text>
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
                          placeholderTextColor={palette.slate}
                          style={styles.roleNameInput}
                        />
                        <TouchableOpacity
                          style={styles.roleCreateButton}
                          onPress={() => void handleCreateRole()}
                          disabled={roleBusyId === 'create'}
                        >
                          <Ionicons name="add" size={20} color={palette.white} />
                        </TouchableOpacity>
                      </View>
                      {(club.roles ?? []).length ? (
                        <View style={styles.roleList}>
                          {(club.roles ?? []).map((role) => (
                            <View key={role.id} style={styles.roleListItem}>
                              <View style={styles.roleListIcon}>
                                <Ionicons name="at-outline" size={15} color={palette.scarlet} />
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
                                <Ionicons name="trash-outline" size={16} color={palette.dangerText} />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.cardMeta}>No ping roles yet. Add one above, then assign it from a member card.</Text>
                      )}
                    </View>
                  ) : null}
                  {club.members.length ? club.members.map((member) => (
                    <View key={member.id} style={styles.memberCard}>
                      <TouchableOpacity
                        style={styles.memberTop}
                        activeOpacity={0.88}
                        onPress={() => navigation.navigate('UserProfile', { userId: member.userId })}
                      >
                        <UserAvatar name={member.user.name} avatarUrl={member.user.avatarUrl} size={44} />
                        <View style={styles.memberCopy}>
                          <Text style={styles.cardTitle}>{member.user.name}</Text>
                          <Text style={styles.cardMeta}>
                            {member.role} • {member.user.major ?? 'Undeclared'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      {(member.customRoles ?? []).length ? (
                        <View style={styles.roleChipWrap}>
                          {(member.customRoles ?? []).map((assignment) => (
                            <View key={assignment.id} style={styles.memberRoleChip}>
                              <Text style={styles.memberRoleChipText}>{assignment.role.name}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      {canManageMembers && (club.roles ?? []).length && canManageThisMember(member.role, member.userId) ? (
                        <TouchableOpacity
                          style={styles.memberRoleToggle}
                          onPress={() =>
                            setMemberRoleEditorUserId((current) =>
                              current === member.userId ? null : member.userId
                            )
                          }
                          activeOpacity={0.82}
                        >
                          <Ionicons name="pricetag-outline" size={15} color={palette.scarlet} />
                          <Text style={styles.memberRoleToggleText}>
                            {(member.customRoles ?? []).length ? 'Edit ping roles' : 'Assign ping roles'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {memberRoleEditorUserId === member.userId ? (
                        <View style={styles.roleAssignWrap}>
                          {(club.roles ?? []).map((role) => {
                            const assigned = (member.customRoles ?? []).some((assignment) => assignment.roleId === role.id);
                            const busy = roleBusyId === `${member.userId}:${role.id}`;
                            return (
                              <TouchableOpacity
                                key={role.id}
                                style={[styles.roleAssignButton, assigned ? styles.roleAssignButtonActive : null]}
                                onPress={() => void handleTogglePingRole(member.userId, role.id, assigned)}
                                disabled={busy}
                              >
                                <Ionicons
                                  name={assigned ? 'checkmark-circle' : 'add-circle-outline'}
                                  size={15}
                                  color={assigned ? palette.white : palette.scarlet}
                                />
                                <Text style={[styles.roleAssignText, assigned ? styles.roleAssignTextActive : null]}>
                                  {role.name}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : null}
                      {canManageMembers && canManageThisMember(member.role, member.userId) ? (
                        <View style={styles.memberButtons}>
                          {club.myRole === 'OWNER' && member.role !== 'ADMIN' ? (
                            <PrimaryButton
                              label="Make admin"
                              onPress={() => void handleRoleChange(member.userId, 'ADMIN')}
                              kind="ghost"
                              loading={memberActionUserId === member.userId}
                            />
                          ) : null}
                          {member.role === 'MEMBER' ? (
                            <PrimaryButton
                              label="Promote"
                              onPress={() => void handleRoleChange(member.userId, 'OFFICER')}
                              loading={memberActionUserId === member.userId}
                            />
                          ) : member.role === 'OFFICER' || member.role === 'ADMIN' ? (
                            <PrimaryButton
                              label="Demote"
                              onPress={() => void handleRoleChange(member.userId, member.role === 'ADMIN' ? 'OFFICER' : 'MEMBER')}
                              kind="ghost"
                              loading={memberActionUserId === member.userId}
                            />
                          ) : null}
                          <PrimaryButton
                            label="Remove"
                            onPress={() => void handleRemoveMember(member.userId)}
                            kind="ghost"
                            disabled={memberActionUserId === member.userId}
                          />
                        </View>
                      ) : null}
                    </View>
                  )) : (
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
                    <Text style={styles.screenSectionTitle}>Upcoming</Text>
                    {canManageMeetings ? (
                      <TouchableOpacity onPress={() => setMeetingComposerOpen((current) => !current)}>
                        <Text style={styles.linkText}>{meetingComposerOpen ? 'Close' : 'Create meeting'}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {canManageMeetings && meetingComposerOpen ? (
                    <View style={styles.composerCard}>
                      <Text style={styles.cardTitle}>Create meeting</Text>
                      <Text style={styles.cardBody}>Schedule an event for your club.</Text>
                      <TextInput
                        value={meetingTitle}
                        onChangeText={setMeetingTitle}
                        placeholder="Meeting title"
                        placeholderTextColor={palette.slate}
                        style={styles.input}
                      />
                      <TextInput
                        value={meetingLocation}
                        onChangeText={setMeetingLocation}
                        placeholder="Location"
                        placeholderTextColor={palette.slate}
                        style={styles.input}
                      />
                      <TextInput
                        value={meetingDescription}
                        onChangeText={setMeetingDescription}
                        placeholder="Description"
                        placeholderTextColor={palette.slate}
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
                          maximumDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
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
                        <View style={styles.eventThumb}>
                          <Text style={styles.eventThumbEmoji}>{club.emoji}</Text>
                        </View>
                        <View style={styles.eventCopy}>
                          <Text style={styles.eventDateLine}>
                            {relativeDayLabel(meeting.meetingTime)}, {formatShortDate(meeting.meetingTime)} • {formatTime(meeting.meetingTime)}
                          </Text>
                          <Text style={styles.eventTitle}>{meeting.title}</Text>
                          <Text style={styles.eventLocation}>{meeting.location}</Text>
                        </View>
                        <Text style={styles.eventGoing}>{meeting.rsvpCounts.going} going</Text>
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

                      {canManageMeetings || isMember ? (
                        <View style={styles.attendanceBox}>
                          {canManageMeetings ? (
                            <>
                              <Text style={styles.cardBody}>
                                {meeting.attendanceCode
                                  ? `Attendance is open. Code: ${meeting.attendanceCode}`
                                  : 'Attendance is closed right now.'}
                              </Text>
                              <View style={styles.eventButtonRow}>
                                <PrimaryButton
                                  label={meeting.attendanceCode ? 'Refresh code' : 'Open attendance'}
                                  onPress={() => void handleOpenAttendance(meeting.id)}
                                  loading={attendanceBusyId === `open-${meeting.id}`}
                                  kind="ghost"
                                />
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
                            </>
                          ) : isMember ? (
                            <>
                              <Text style={styles.cardBody}>Have the attendance code? Check in here.</Text>
                              <TextInput
                                value={attendanceCodeDraft[meeting.id] ?? ''}
                                onChangeText={(value) => setAttendanceCodeDraft((current) => ({ ...current, [meeting.id]: value.toUpperCase() }))}
                                placeholder="Enter attendance code"
                                placeholderTextColor={palette.slate}
                                style={styles.input}
                                autoCapitalize="characters"
                              />
                              <PrimaryButton
                                label="Check in"
                                onPress={() => void handleCheckIn(meeting.id)}
                                loading={attendanceBusyId === `checkin-${meeting.id}`}
                              />
                            </>
                          ) : null}
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
}: {
  title: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
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
  body,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickActionCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={18} color={palette.scarlet} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </TouchableOpacity>
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
  if (!roles.length) {
    return (
      <View style={styles.targetPickerEmpty}>
        <Ionicons name="pricetags-outline" size={16} color={palette.slate} />
        <Text style={styles.cardMeta}>Add ping roles from Members to target specific groups.</Text>
      </View>
    );
  }

  return (
    <View style={styles.targetPicker}>
      <View style={styles.targetPickerHeader}>
        <Text style={styles.targetPickerTitle}>Target ping roles</Text>
        <Text style={styles.targetPickerCount}>
          {selectedRoleIds.length ? `${selectedRoleIds.length} selected` : 'Optional'}
        </Text>
      </View>
      <View style={styles.roleChipWrap}>
        {roles.map((role) => {
          const selected = selectedRoleIds.includes(role.id);
          return (
            <TouchableOpacity
              key={role.id}
              style={[styles.targetRoleChip, selected ? styles.targetRoleChipActive : null]}
              onPress={() => onToggle(role.id)}
              activeOpacity={0.82}
            >
              <Ionicons
                name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                size={15}
                color={selected ? palette.white : palette.scarlet}
              />
              <Text style={[styles.targetRoleChipText, selected ? styles.targetRoleChipTextActive : null]}>
                {role.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
}: {
  align: 'left' | 'right';
  name: string;
  avatarUrl?: string | null;
  content: string;
  time: string;
  audience?: string;
}) {
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  heroShell: {
    paddingBottom: spacing.md,
  },
  cover: {
    minHeight: 214,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    justifyContent: 'space-between',
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
    backgroundColor: 'rgba(255,255,255,0.90)',
  },
  coverArt: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 44,
  },
  coverEmoji: {
    fontSize: 74,
  },
  heroCard: {
    marginTop: -38,
    marginHorizontal: spacing.md,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
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
  },
  clubAvatarEmoji: {
    fontSize: 40,
  },
  identityCopy: {
    flex: 1,
    gap: 4,
  },
  clubTitle: {
    ...typography.h1,
    fontSize: 24,
    lineHeight: 30,
  },
  clubMeta: {
    ...typography.bodyStrong,
    color: palette.slate,
  },
  clubDescription: {
    ...typography.body,
    color: palette.ink,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: 'rgba(248,248,248,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.md,
    gap: 6,
  },
  summaryLabel: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: palette.slate,
  },
  summaryValue: {
    ...typography.bodyStrong,
    color: palette.ink,
  },
  summarySubvalue: {
    ...typography.body,
    fontSize: 14,
  },
  summaryAvatarRail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  membershipRow: {
    marginTop: 2,
  },
  membershipButton: {
    borderRadius: 18,
    backgroundColor: palette.scarlet,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membershipButtonText: {
    color: palette.white,
    fontSize: 18,
    fontWeight: '800',
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
    ...typography.bodyStrong,
    color: palette.slate,
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
    ...typography.h2,
  },
  linkText: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: palette.scarlet,
  },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.md,
    ...shadows.card,
  },
  upcomingThumb: {
    width: 92,
    height: 92,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingThumbEmoji: {
    fontSize: 38,
  },
  upcomingCopy: {
    flex: 1,
    gap: 4,
  },
  upcomingTime: {
    ...typography.bodyStrong,
    fontSize: 13,
    color: '#6754D7',
  },
  upcomingTitle: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 24,
  },
  upcomingLocation: {
    ...typography.body,
    fontSize: 14,
  },
  upcomingAttendees: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  upcomingAttendeeCount: {
    marginLeft: 8,
    ...typography.bodyStrong,
    fontSize: 13,
    color: palette.slate,
  },
  goingButton: {
    borderRadius: radii.pill,
    backgroundColor: '#6A56DA',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  goingButtonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '800',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.md,
    gap: spacing.xs,
    ...shadows.card,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(199, 59, 34, 0.10)',
  },
  announcementCard: {
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
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
    ...typography.title,
  },
  cardMeta: {
    ...typography.body,
    fontSize: 13,
  },
  targetMeta: {
    ...typography.bodyStrong,
    color: palette.moss,
    fontSize: 12,
  },
  cardBody: {
    ...typography.body,
    color: palette.ink,
  },
  screenSectionTitle: {
    ...typography.h1,
    fontSize: 32,
    lineHeight: 36,
  },
  screenSectionBody: {
    ...typography.body,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  membersCount: {
    ...typography.bodyStrong,
    color: palette.slate,
    paddingBottom: 2,
  },
  manageRolesButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(199, 59, 34, 0.18)',
    backgroundColor: 'rgba(255,255,255,0.84)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  manageRolesButtonText: {
    ...typography.bodyStrong,
    color: palette.scarlet,
    fontSize: 13,
  },
  roleManagerPanel: {
    gap: spacing.sm,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.08)',
    padding: spacing.md,
    ...shadows.card,
  },
  roleManagerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    borderColor: 'rgba(16, 33, 43, 0.10)',
    backgroundColor: '#F8FAF9',
    paddingHorizontal: spacing.md,
    color: palette.ink,
    fontSize: 15,
  },
  roleCreateButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.scarlet,
  },
  roleList: {
    gap: 8,
  },
  roleListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 16,
    backgroundColor: '#F8FAF9',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.sm,
  },
  roleListIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(199, 59, 34, 0.10)',
  },
  roleListCopy: {
    flex: 1,
  },
  roleListTitle: {
    ...typography.bodyStrong,
    color: palette.ink,
  },
  roleIconButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.dangerBg,
  },
  roleChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberRoleChip: {
    borderRadius: radii.pill,
    backgroundColor: 'rgba(16, 33, 43, 0.07)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  memberRoleChipText: {
    ...typography.label,
    color: palette.ink,
  },
  memberRoleToggle: {
    alignSelf: 'flex-start',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(199, 59, 34, 0.18)',
    backgroundColor: 'rgba(199, 59, 34, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  memberRoleToggleText: {
    ...typography.bodyStrong,
    color: palette.scarlet,
    fontSize: 13,
  },
  roleAssignWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#F8FAF9',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.sm,
  },
  roleAssignButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(199, 59, 34, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: palette.white,
  },
  roleAssignButtonActive: {
    borderColor: palette.scarlet,
    backgroundColor: palette.scarlet,
  },
  roleAssignText: {
    ...typography.label,
    color: palette.scarlet,
  },
  roleAssignTextActive: {
    color: palette.white,
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
    backgroundColor: '#6A56DA',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  newChatButtonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '800',
  },
  chatHubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.md,
    ...shadows.card,
  },
  chatHubIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(199, 59, 34, 0.08)',
  },
  chatHubCopy: {
    flex: 1,
    gap: 2,
  },
  chatAudience: {
    ...typography.label,
    color: palette.slate,
  },
  chatHubTitle: {
    ...typography.title,
  },
  chatHubMeta: {
    ...typography.body,
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
    backgroundColor: palette.scarlet,
    paddingHorizontal: 6,
  },
  chatBadgeText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '800',
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
  },
  chatConversationTitleBlock: {
    flex: 1,
    gap: 2,
  },
  chatConversationTitle: {
    ...typography.title,
  },
  chatConversationMeta: {
    ...typography.body,
    fontSize: 13,
  },
  composerCard: {
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
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
    backgroundColor: '#F8FAF9',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.sm,
  },
  targetPickerEmpty: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 16,
    backgroundColor: '#F8FAF9',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.sm,
  },
  targetPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  targetPickerTitle: {
    ...typography.bodyStrong,
    fontSize: 13,
    color: palette.ink,
  },
  targetPickerCount: {
    ...typography.body,
    fontSize: 12,
    color: palette.slate,
  },
  targetRoleChip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(199, 59, 34, 0.22)',
    backgroundColor: palette.white,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  targetRoleChipActive: {
    borderColor: palette.scarlet,
    backgroundColor: palette.scarlet,
  },
  targetRoleChipText: {
    ...typography.label,
    color: palette.scarlet,
  },
  targetRoleChipTextActive: {
    color: palette.white,
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
    ...typography.bodyStrong,
    fontSize: 13,
  },
  bubbleAudience: {
    ...typography.body,
    fontSize: 12,
    color: palette.slate,
  },
  bubble: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleRight: {
    backgroundColor: '#6A56DA',
    borderColor: '#6A56DA',
  },
  bubbleText: {
    ...typography.body,
    color: palette.ink,
  },
  bubbleTextRight: {
    color: palette.white,
  },
  bubbleTime: {
    ...typography.body,
    fontSize: 12,
    color: palette.slate,
  },
  bubbleTimeRight: {
    textAlign: 'right',
  },
  typingText: {
    ...typography.body,
    color: palette.scarlet,
  },
  chatComposerDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: 8,
    ...shadows.card,
  },
  chatComposerInput: {
    flex: 1,
    borderRadius: radii.pill,
    backgroundColor: '#F7F4EE',
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...typography.body,
    color: palette.ink,
  },
  sendFab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6A56DA',
  },
  memberCard: {
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  memberTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  memberCopy: {
    flex: 1,
    gap: 2,
  },
  memberButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  datePickerCard: {
    borderRadius: 18,
    backgroundColor: '#F7F4EE',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
  },
  eventCard: {
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  eventHead: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  eventThumb: {
    width: 76,
    height: 76,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFE7DA',
  },
  eventThumbEmoji: {
    fontSize: 34,
  },
  eventCopy: {
    flex: 1,
    gap: 3,
  },
  eventDateLine: {
    ...typography.bodyStrong,
    fontSize: 13,
    color: '#6754D7',
  },
  eventTitle: {
    ...typography.title,
    fontSize: 21,
    lineHeight: 25,
  },
  eventLocation: {
    ...typography.body,
    fontSize: 14,
  },
  eventGoing: {
    ...typography.bodyStrong,
    color: palette.scarlet,
    alignSelf: 'center',
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
    backgroundColor: '#F7F4EE',
    padding: spacing.md,
    gap: spacing.sm,
  },
  eventButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
    ...typography.bodyStrong,
    color: palette.dangerText,
  },
  input: {
    borderRadius: 18,
    backgroundColor: '#F7F4EE',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.md,
    ...typography.body,
    color: palette.ink,
  },
  inputTall: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
});
