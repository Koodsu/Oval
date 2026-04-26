import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  API_USER_MESSAGE,
  checkInToClubMeeting,
  closeClubAttendance,
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
  Hero,
  Panel,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  UserAvatar,
} from '../components/ui';
import { formatDateTime } from '../utils/format';
import { palette, radii, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ClubDetail'>;
type Mode = 'overview' | 'chat' | 'officer' | 'members';

const VISIBILITY_OPTIONS: Array<{ value: ClubVisibility; label: string }> = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'MEMBERS', label: 'Members' },
  { value: 'OFFICERS', label: 'Officers' },
];

const RSVP_OPTIONS: Array<{ value: 'GOING' | 'MAYBE' | 'NOT_GOING'; label: string }> = [
  { value: 'GOING', label: 'Going' },
  { value: 'MAYBE', label: 'Maybe' },
  { value: 'NOT_GOING', label: 'Skip' },
];

export default function ClubDetailScreen({ route, navigation }: Props) {
  const { clubId } = route.params;
  const [mode, setMode] = useState<Mode>('overview');
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
    () => club?.myRole === 'ADMIN' || club?.myRole === 'OFFICER',
    [club?.myRole]
  );
  const canManageMembers = club?.myRole === 'ADMIN';
  const isMember = !!club?.isMember;

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
        if (clubResponse.myRole === 'ADMIN' || clubResponse.myRole === 'OFFICER') {
          requests.push(getClubOfficerMessages(clubId));
        }

        const results = await Promise.all(requests);
        const meetingResponse = results[0] as ClubMeetingWithMeta[];
        const announcementResponse = results[1] as { items: ClubAnnouncementRow[] };
        const memberMessageResponse = clubResponse.isMember
          ? (results[2] as { messages: ClubMessage[]; typingUserIds: string[] })
          : null;
        const officerMessageResponse =
          clubResponse.myRole === 'ADMIN' || clubResponse.myRole === 'OFFICER'
            ? (results[clubResponse.isMember ? 3 : 2] as {
                messages: ClubOfficerMessage[];
                typingUserIds: string[];
              })
            : null;

        setClub(clubResponse);
        setMeetings(meetingResponse);
        setAnnouncements(announcementResponse.items);
        setMessages(memberMessageResponse?.messages ?? []);
        setTypingUserIds(memberMessageResponse?.typingUserIds ?? []);
        setOfficerMessages(officerMessageResponse?.messages ?? []);
        setOfficerTypingUserIds(officerMessageResponse?.typingUserIds ?? []);
        if (!clubResponse.isMember && mode === 'chat') {
          setMode('overview');
        }
        if (clubResponse.myRole !== 'ADMIN' && clubResponse.myRole !== 'OFFICER' && mode === 'officer') {
          setMode('overview');
        }
        setLoadError(null);
      } catch {
        setLoadError(API_USER_MESSAGE);
        if (showAlert) {
          Alert.alert('Could not load club', API_USER_MESSAGE);
        }
      }
    },
    [clubId, mode]
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
      });
      setAnnouncementText('');
      setAnnouncements((current) => [created, ...current]);
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
      Alert.alert('Choose a valid time', 'Meetings need to be scheduled sometime within the next 7 days.');
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
      });
      setMeetingTitle('');
      setMeetingLocation('');
      setMeetingDescription('');
      setMeetingVisibility('PUBLIC');
      setMeetings((current) => [newMeeting, ...current]);
      Alert.alert('Meeting created', 'Your club meeting is now live.');
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

  const handleRoleChange = async (memberUserId: string, role: 'OFFICER' | 'MEMBER') => {
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

  const handleRemoveMember = async (memberUserId: string) => {
    setMemberActionUserId(memberUserId);
    try {
      await removeClubMember(clubId, memberUserId);
      setClub((current) =>
        current
          ? {
              ...current,
              members: current.members.filter((member) => member.userId !== memberUserId),
              isMember: current.isMember,
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
    if (isMember) options.push({ value: 'chat', label: 'Chat' });
    if (canManageMeetings) options.push({ value: 'officer', label: 'Officers' });
    options.push({ value: 'members', label: 'Members' });
    return options;
  }, [canManageMeetings, isMember]);

  if (!club && loadError) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Club" onBack={() => navigation.goBack()} />
          <EmptyState icon="alert-circle-outline" title="Could not load club" body={loadError} />
          <PrimaryButton label="Try again" onPress={() => void load(false)} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {club ? (
          <>
            <ScreenHeader title="Club" onBack={() => navigation.goBack()} />
            <Hero eyebrow={club.category} title={`${club.emoji} ${club.name}`} subtitle={club.description}>
              <View style={styles.heroAction}>
                <PrimaryButton
                  label={club.isMember ? 'Leave club' : 'Join club'}
                  onPress={() => void handleMembership()}
                  loading={membershipBusy}
                />
                {canManageMembers ? (
                  <View style={styles.inlineAction}>
                    <PrimaryButton
                      label={club.avatarUrl ? 'Update club avatar' : 'Add club avatar'}
                      onPress={() => void handleUploadClubAvatar()}
                      loading={avatarBusy}
                      kind="ghost"
                    />
                  </View>
                ) : null}
              </View>
            </Hero>

            {loadError ? (
              <Panel>
                <Text style={styles.errorText}>{loadError}</Text>
              </Panel>
            ) : null}

            <SegmentedControl value={mode} options={modeOptions} onChange={setMode} />

            {mode === 'overview' ? (
              <>
                {canManageMeetings ? (
                  <Panel>
                    <Text style={styles.title}>Leader dashboard</Text>
                    <Text style={styles.body}>Run the club from here: schedule meetings, open attendance, publish announcements, and keep the officer room moving.</Text>
                    <View style={styles.leaderStats}>
                      <View style={styles.leaderStat}>
                        <Text style={styles.leaderStatValue}>{club.members.length}</Text>
                        <Text style={styles.metaText}>Members</Text>
                      </View>
                      <View style={styles.leaderStat}>
                        <Text style={styles.leaderStatValue}>{meetings.length}</Text>
                        <Text style={styles.metaText}>Upcoming meetings</Text>
                      </View>
                      <View style={styles.leaderStat}>
                        <Text style={styles.leaderStatValue}>{announcements.length}</Text>
                        <Text style={styles.metaText}>Announcements</Text>
                      </View>
                    </View>
                  </Panel>
                ) : null}

                {canManageMeetings ? (
                  <Panel>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.composerToggle}
                      onPress={() => setMeetingComposerOpen((current) => !current)}
                    >
                      <Text style={styles.title}>Create meeting</Text>
                      <Text style={styles.composerToggleMark}>{meetingComposerOpen ? '−' : '+'}</Text>
                    </TouchableOpacity>
                    {meetingComposerOpen ? (
                      <>
                        <Text style={styles.body}>Schedule an event and decide who should be able to see it.</Text>
                        <TextInput value={meetingTitle} onChangeText={setMeetingTitle} placeholder="Meeting title" placeholderTextColor={palette.slate} style={styles.input} />
                        <TextInput value={meetingLocation} onChangeText={setMeetingLocation} placeholder="Location" placeholderTextColor={palette.slate} style={styles.input} />
                        <TextInput value={meetingDescription} onChangeText={setMeetingDescription} placeholder="What is this meeting for?" placeholderTextColor={palette.slate} style={[styles.input, styles.inputTall]} multiline />
                        <Text style={styles.subtleLabel}>Visibility</Text>
                        <View style={styles.chipWrap}>
                          {VISIBILITY_OPTIONS.map((option) => (
                            <Chip
                              key={option.value}
                              label={option.label}
                              active={meetingVisibility === option.value}
                              onPress={() => setMeetingVisibility(option.value)}
                            />
                          ))}
                        </View>
                        <View style={styles.dateWrap}>
                          <Text style={styles.body}>Meeting time</Text>
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
                        <View style={styles.inlineAction}>
                          <PrimaryButton label="Create meeting" onPress={() => void handleCreateMeeting()} loading={meetingBusy} />
                        </View>
                      </>
                    ) : null}
                  </Panel>
                ) : null}

                {canManageMeetings ? (
                  <Panel>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.composerToggle}
                      onPress={() => setAnnouncementComposerOpen((current) => !current)}
                    >
                      <Text style={styles.title}>Create announcement</Text>
                      <Text style={styles.composerToggleMark}>{announcementComposerOpen ? '−' : '+'}</Text>
                    </TouchableOpacity>
                    {announcementComposerOpen ? (
                      <>
                        <Text style={styles.body}>Announcements can be public, member-only, or officer-only.</Text>
                        <TextInput
                          value={announcementText}
                          onChangeText={setAnnouncementText}
                          placeholder="Share an update..."
                          placeholderTextColor={palette.slate}
                          style={[styles.input, styles.inputTall]}
                          multiline
                        />
                        <Text style={styles.subtleLabel}>Visibility</Text>
                        <View style={styles.chipWrap}>
                          {VISIBILITY_OPTIONS.map((option) => (
                            <Chip
                              key={option.value}
                              label={option.label}
                              active={announcementVisibility === option.value}
                              onPress={() => setAnnouncementVisibility(option.value)}
                            />
                          ))}
                        </View>
                        <View style={styles.inlineAction}>
                          <PrimaryButton
                            label="Post announcement"
                            onPress={() => void handleCreateAnnouncement()}
                            loading={announcementBusy}
                          />
                        </View>
                      </>
                    ) : null}
                  </Panel>
                ) : null}

                <View style={styles.section}>
                  <SectionHeader title="Upcoming meetings" />
                  {meetings.length ? meetings.map((meeting) => (
                    <Panel key={meeting.id}>
                      <View style={styles.rowTop}>
                        <Text style={styles.title}>{meeting.title}</Text>
                        <Text style={styles.visibilityBadge}>{visibilityLabel(meeting.visibility)}</Text>
                      </View>
                      <Text style={styles.body}>{formatDateTime(meeting.meetingTime)}</Text>
                      <Text style={styles.body}>{meeting.location}</Text>
                      {meeting.description ? <Text style={styles.body}>{meeting.description}</Text> : null}
                      <Text style={styles.metaText}>
                        {meeting.rsvpCounts.going} going • {meeting.rsvpCounts.maybe} maybe • {meeting.attendeeCount} checked in
                      </Text>
                      <View style={styles.chipWrap}>
                        {RSVP_OPTIONS.map((option) => (
                          <Chip
                            key={option.value}
                            label={option.label}
                            active={meeting.myRsvp === option.value}
                            onPress={() => void handleRsvp(meeting.id, option.value)}
                          />
                        ))}
                      </View>
                      <View style={styles.attendancePanel}>
                        {canManageMeetings ? (
                          <>
                            <Text style={styles.body}>
                              {meeting.attendanceCode
                                ? `Attendance is open. Current code: ${meeting.attendanceCode}`
                                : 'Attendance is closed right now.'}
                            </Text>
                            <View style={styles.buttonStack}>
                              <PrimaryButton
                                label={meeting.attendanceCode ? 'Refresh attendance code' : 'Open attendance'}
                                onPress={() => void handleOpenAttendance(meeting.id)}
                                loading={attendanceBusyId === `open-${meeting.id}`}
                                kind="ghost"
                              />
                              {meeting.attendanceCode ? (
                                <PrimaryButton
                                  label="Close attendance"
                                  onPress={() => void handleCloseAttendance(meeting.id)}
                                  loading={attendanceBusyId === `close-${meeting.id}`}
                                  kind="ghost"
                                />
                              ) : null}
                              <PrimaryButton
                                label="View attendance"
                                onPress={() => void handleLoadAttendance(meeting.id)}
                                loading={attendanceBusyId === `view-${meeting.id}`}
                                kind="ghost"
                              />
                            </View>
                            {attendancePanels[meeting.id] ? (
                              attendancePanels[meeting.id]!.attendees.length ? (
                                <View style={styles.attendeeList}>
                                  {attendancePanels[meeting.id]!.attendees.map((attendee) => (
                                    <View key={attendee.id} style={styles.memberRow}>
                                      <UserAvatar name={attendee.user?.name ?? 'Attendee'} avatarUrl={attendee.user?.avatarUrl} size={30} />
                                      <Text style={styles.body}>{attendee.user?.name ?? 'Attendee'}</Text>
                                    </View>
                                  ))}
                                </View>
                              ) : (
                                <Text style={styles.body}>No one has checked in yet.</Text>
                              )
                            ) : null}
                          </>
                        ) : isMember ? (
                          <>
                            <Text style={styles.body}>Have the attendance code from a club leader? Check in here.</Text>
                            <TextInput
                              value={attendanceCodeDraft[meeting.id] ?? ''}
                              onChangeText={(value) => setAttendanceCodeDraft((current) => ({ ...current, [meeting.id]: value.toUpperCase() }))}
                              placeholder="Enter attendance code"
                              placeholderTextColor={palette.slate}
                              style={styles.input}
                              autoCapitalize="characters"
                            />
                            <View style={styles.inlineAction}>
                              <PrimaryButton
                                label="Check in"
                                onPress={() => void handleCheckIn(meeting.id)}
                                loading={attendanceBusyId === `checkin-${meeting.id}`}
                              />
                            </View>
                          </>
                        ) : null}
                      </View>
                    </Panel>
                  )) : <EmptyState icon="calendar-outline" title="No meetings yet" body="Once club events are scheduled, they’ll appear here." />}
                </View>

                <View style={styles.section}>
                  <SectionHeader title="Announcements" />
                  {announcements.length ? announcements.map((announcement) => (
                    <Panel key={announcement.id}>
                      <View style={styles.rowTop}>
                        <Text style={styles.title}>{announcement.user.name}</Text>
                        <Text style={styles.visibilityBadge}>{visibilityLabel(announcement.visibility)}</Text>
                      </View>
                      <Text style={styles.body}>{announcement.content}</Text>
                    </Panel>
                  )) : <EmptyState icon="megaphone-outline" title="No announcements yet" body="This panel will feel active once club leaders publish updates." />}
                </View>
              </>
            ) : null}

            {mode === 'chat' ? (
              <View style={styles.section}>
                <SectionHeader title="Club chat" />
                {messages.length ? messages.map((message) => (
                  <Panel key={message.id}>
                    <View style={styles.messageHeader}>
                      <UserAvatar name={message.user.name} avatarUrl={message.user.avatarUrl} size={34} />
                      <View style={styles.messageCopy}>
                        <Text style={styles.title}>{message.user.name}</Text>
                        <Text style={styles.body}>{message.content}</Text>
                      </View>
                    </View>
                  </Panel>
                )) : <EmptyState icon="chatbubbles-outline" title="No messages yet" body="Be the first to say something to the club." />}
                {typingUserIds.length ? (
                  <Text style={styles.metaText}>Someone is typing...</Text>
                ) : null}
                <Panel>
                  <TextInput
                    value={messageText}
                    onChangeText={(value) => {
                      setMessageText(value);
                      if (value.trim()) pingTyping();
                    }}
                    placeholder="Share an update or ask a question..."
                    placeholderTextColor={palette.slate}
                    style={styles.input}
                    multiline
                  />
                  <View style={styles.inlineAction}>
                    <PrimaryButton label="Send to club" onPress={() => void handleSend()} loading={sendBusy} />
                  </View>
                </Panel>
              </View>
            ) : null}

            {mode === 'officer' ? (
              <View style={styles.section}>
                <SectionHeader title="Officer channel" />
                {officerMessages.length ? officerMessages.map((message) => (
                  <Panel key={message.id}>
                    <View style={styles.messageHeader}>
                      <UserAvatar name={message.user.name} avatarUrl={message.user.avatarUrl} size={34} />
                      <View style={styles.messageCopy}>
                        <Text style={styles.title}>{message.user.name}</Text>
                        <Text style={styles.body}>{message.content}</Text>
                      </View>
                    </View>
                  </Panel>
                )) : <EmptyState icon="shield-checkmark-outline" title="Officer channel is quiet" body="Use this room for leadership coordination." />}
                {officerTypingUserIds.length ? (
                  <Text style={styles.metaText}>An officer is typing...</Text>
                ) : null}
                <Panel>
                  <TextInput
                    value={officerMessageText}
                    onChangeText={(value) => {
                      setOfficerMessageText(value);
                      if (value.trim()) pingOfficerTyping();
                    }}
                    placeholder="Coordinate with officers..."
                    placeholderTextColor={palette.slate}
                    style={styles.input}
                    multiline
                  />
                  <View style={styles.inlineAction}>
                    <PrimaryButton label="Send to officers" onPress={() => void handleOfficerSend()} loading={officerSendBusy} />
                  </View>
                </Panel>
              </View>
            ) : null}

            {mode === 'members' ? (
              <View style={styles.section}>
                <SectionHeader title="Members" />
                {club.members.length ? club.members.map((member) => (
                  <Panel key={member.id}>
                    <TouchableMember
                      name={member.user.name}
                      avatarUrl={member.user.avatarUrl}
                      subtitle={`${member.role} • ${member.user.major ?? 'Undeclared'}`}
                      onPress={() => navigation.navigate('UserProfile', { userId: member.userId })}
                    />
                    {canManageMembers && member.userId !== club.createdById ? (
                      <View style={styles.memberActions}>
                        {member.role === 'MEMBER' ? (
                          <PrimaryButton
                            label="Promote to officer"
                            onPress={() => void handleRoleChange(member.userId, 'OFFICER')}
                            loading={memberActionUserId === member.userId}
                          />
                        ) : member.role === 'OFFICER' ? (
                          <PrimaryButton
                            label="Demote to member"
                            onPress={() => void handleRoleChange(member.userId, 'MEMBER')}
                            kind="ghost"
                            loading={memberActionUserId === member.userId}
                          />
                        ) : null}
                        {member.role !== 'ADMIN' ? (
                          <PrimaryButton
                            label="Remove member"
                            onPress={() => void handleRemoveMember(member.userId)}
                            kind="ghost"
                            disabled={memberActionUserId === member.userId}
                          />
                        ) : null}
                      </View>
                    ) : null}
                  </Panel>
                )) : <EmptyState icon="people-outline" title="No members loaded" body="Member identity and roles will show up here once the backend returns them." />}
              </View>
            ) : null}
          </>
        ) : (
          <EmptyState icon="hourglass-outline" title="Loading club" body="Pulling meetings, announcements, members, and chat into the rebuilt club view." />
        )}
      </ScrollView>
    </Screen>
  );
}

function TouchableMember({
  name,
  avatarUrl,
  subtitle,
  onPress,
}: {
  name: string;
  avatarUrl?: string | null;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <View style={styles.messageHeader}>
        <UserAvatar name={name} avatarUrl={avatarUrl} />
        <View style={styles.messageCopy}>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.body}>{subtitle}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function visibilityLabel(visibility: ClubVisibility): string {
  return {
    PUBLIC: 'Public',
    MEMBERS: 'Members',
    OFFICERS: 'Officers',
  }[visibility] ?? 'Public';
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  heroAction: {
    marginTop: spacing.sm,
  },
  composerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  composerToggleMark: {
    ...typography.h2,
    color: palette.scarlet,
  },
  section: {
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
  },
  leaderStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  leaderStat: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: palette.cream,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.sm,
    gap: 4,
  },
  leaderStatValue: {
    ...typography.h2,
  },
  subtleLabel: {
    ...typography.label,
    marginTop: spacing.sm,
  },
  metaText: {
    ...typography.body,
    color: palette.scarlet,
  },
  errorText: {
    ...typography.bodyStrong,
    color: palette.dangerText,
  },
  inlineAction: {
    marginTop: spacing.sm,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  visibilityBadge: {
    ...typography.label,
    color: palette.moss,
    letterSpacing: 0.6,
    textTransform: 'none',
  },
  messageHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  messageCopy: {
    flex: 1,
    gap: 4,
  },
  input: {
    borderRadius: radii.md,
    backgroundColor: palette.cream,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    ...typography.body,
    color: palette.ink,
    marginTop: spacing.sm,
  },
  inputTall: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateWrap: {
    marginTop: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
  },
  attendancePanel: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  buttonStack: {
    gap: spacing.sm,
  },
  attendeeList: {
    gap: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  memberActions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
});
