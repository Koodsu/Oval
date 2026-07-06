import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  API_USER_MESSAGE,
  checkInToClubMeeting,
  closeClubAttendance,
  deleteClubMeeting,
  getClubsToday,
  getClubMeetingAttendance,
  openClubAttendance,
  rsvpClubMeeting,
  sendClubRsvpReminders,
} from '../../api';
import type { RootStackParamList } from '../../../App';
import {
  AppBackdrop,
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  ListRow,
  ScreenHeader,
  Sheet,
  Sticker,
} from '../../components/ui';
import {
  ClubScreenLoading,
  DateBadge,
  RSVP_OPTIONS,
  SegmentedControl,
} from '../../components/clubs';
import { useClub } from '../../hooks/useClub';
import type { ClubMeetingAttendanceResponse } from '../../types';
import { formatDateTime } from '../../utils/format';
import { spacing, useTheme } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ClubMeeting'>;

export default function MeetingDetailScreen({ route, navigation }: Props) {
  const { clubId, meetingId } = route.params;
  const { club, meetings, can, loading, refresh, setMeetings } = useClub(clubId);
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const upcomingMeeting = useMemo(
    () => meetings.find((item) => item.id === meetingId),
    [meetingId, meetings],
  );
  const [fallbackMeeting, setFallbackMeeting] = useState<(typeof meetings)[number] | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(true);
  const meeting = upcomingMeeting ?? fallbackMeeting;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<ClubMeetingAttendanceResponse | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const canManageAttendance = can('CREATE_MEETINGS');
  const canDeleteMeeting = club?.myRole === 'OWNER' || club?.myRole === 'ADMIN';

  // "Live" = started within the last 2 hours, or attendance is open.
  const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;
  const isLive = useMemo(() => {
    if (!meeting) return false;
    if (meeting.attendanceCode) return true;
    const start = new Date(meeting.meetingTime).getTime();
    const now = Date.now();
    return now >= start && now - start <= LIVE_WINDOW_MS;
  }, [LIVE_WINDOW_MS, meeting]);

  const meetingStarted = useMemo(
    () => (meeting ? Date.now() >= new Date(meeting.meetingTime).getTime() : false),
    [meeting],
  );

  const targetRoleNames = useMemo(
    () => (meeting?.targetRoleIds ?? [])
      .map((id) => club?.roles?.find((role) => role.id === id)?.name)
      .filter((name): name is string => Boolean(name)),
    [club?.roles, meeting?.targetRoleIds],
  );

  useEffect(() => {
    if (!meeting || !canManageAttendance) return;
    void getClubMeetingAttendance(clubId, meetingId).then(setAttendance).catch(() => {});
  }, [canManageAttendance, clubId, meeting, meetingId]);

  useEffect(() => {
    if (loading || upcomingMeeting) {
      if (upcomingMeeting) setFallbackLoading(false);
      return;
    }
    setFallbackLoading(true);
    void getClubsToday()
      .then((rows) => {
        const row = rows.find((item) => item.clubId === clubId && item.id === meetingId);
        setFallbackMeeting(row ? {
          id: row.id,
          clubId: row.clubId,
          title: row.title,
          description: null,
          location: row.location,
          meetingTime: row.meetingTime,
          isPublic: row.isPublic,
          visibility: row.visibility,
          targetRoleIds: row.targetRoleIds,
          createdById: '',
          createdAt: row.meetingTime,
          rsvpCounts: { going: 0, maybe: 0, notGoing: 0 },
          myRsvp: null,
          attendeeCount: row.attendeeCount,
        } : null);
      })
      .catch(() => setFallbackMeeting(null))
      .finally(() => setFallbackLoading(false));
  }, [clubId, loading, meetingId, upcomingMeeting]);

  if ((loading && !club) || fallbackLoading) {
    return <ClubScreenLoading title="Meeting" onBack={() => navigation.goBack()} />;
  }

  if (!meeting) {
    return (
      <AppBackdrop>
        <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: insets.top + spacing.md }}>
          <ScreenHeader title="Meeting" onBack={() => navigation.goBack()} />
          <EmptyState
            icon="calendar-outline"
            title="Meeting not found"
            body="It may have been removed or ended."
            actionLabel="Back to club"
            onAction={() => navigation.navigate('ClubDetail', { clubId })}
          />
        </View>
      </AppBackdrop>
    );
  }

  const rsvp = async (status: 'GOING' | 'MAYBE' | 'NOT_GOING') => {
    const previous = meeting.myRsvp;
    setMeetings((current) => current.map((item) => item.id === meetingId ? { ...item, myRsvp: status } : item));
    setFallbackMeeting((current) => current ? { ...current, myRsvp: status } : current);
    try {
      await rsvpClubMeeting(meetingId, status);
      await refresh();
    } catch {
      setMeetings((current) => current.map((item) => item.id === meetingId ? { ...item, myRsvp: previous } : item));
      setFallbackMeeting((current) => current ? { ...current, myRsvp: previous } : current);
      Alert.alert('Could not RSVP', API_USER_MESSAGE);
    }
  };

  const openAttendance = async () => {
    setBusy('open');
    try {
      const result = await openClubAttendance(clubId, meetingId);
      setMeetings((current) => current.map((item) => item.id === meetingId ? { ...item, attendanceCode: result.attendanceCode } : item));
      setFallbackMeeting((current) => current ? { ...current, attendanceCode: result.attendanceCode } : current);
      void getClubMeetingAttendance(clubId, meetingId).then(setAttendance).catch(() => {});
    } catch {
      Alert.alert('Could not open attendance', API_USER_MESSAGE);
    } finally {
      setBusy(null);
    }
  };

  const closeAttendance = async () => {
    setBusy('close');
    try {
      await closeClubAttendance(clubId, meetingId);
      setMeetings((current) => current.map((item) => item.id === meetingId ? { ...item, attendanceCode: null } : item));
      setFallbackMeeting((current) => current ? { ...current, attendanceCode: null } : current);
      void getClubMeetingAttendance(clubId, meetingId).then(setAttendance).catch(() => {});
    } catch {
      Alert.alert('Could not close attendance', API_USER_MESSAGE);
    } finally {
      setBusy(null);
    }
  };

  const checkIn = async () => {
    if (!code.trim()) return;
    setBusy('checkin');
    try {
      await checkInToClubMeeting(clubId, meetingId, code.trim());
      setCode('');
      Alert.alert('Checked in', 'Your attendance has been recorded.');
      await refresh();
      if (canManageAttendance) {
        void getClubMeetingAttendance(clubId, meetingId).then(setAttendance).catch(() => {});
      }
    } catch {
      Alert.alert('Could not check in', API_USER_MESSAGE);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <ScreenHeader
          title="Meeting"
          kicker={club?.name}
          onBack={() => navigation.goBack()}
          right={canDeleteMeeting ? (
            <Button label="•••" size="sm" variant="secondary" onPress={() => setActionsOpen(true)} />
          ) : undefined}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <DateBadge iso={meeting.meetingTime} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={typography.title}>{meeting.title}</Text>
            <Text style={typography.caption}>{formatDateTime(meeting.meetingTime)} · {meeting.location}</Text>
          </View>
          {isLive ? (
            <Sticker label="Live" tint={colors.success} textColor={colors.onPrimary} icon="radio" small tilt={3} />
          ) : null}
        </View>

        {/* ── Live check-in theater: front and center while the meeting is on ── */}
        {isLive && club?.isMember ? (
          <Card padded style={{ borderColor: colors.success }}>
            <Text style={[typography.kicker, { color: colors.success }]}>HAPPENING NOW</Text>
            <Text style={[typography.subheading, { marginTop: spacing.xs }]}>
              Enter tonight's code to check in
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Field
                value={code}
                onChangeText={(value) => setCode(value.toUpperCase())}
                placeholder="CODE"
                style={{ flex: 1 }}
              />
              <Button label="Check in" loading={busy === 'checkin'} onPress={() => void checkIn()} />
            </View>
            <Text style={[typography.captionSmall, { marginTop: spacing.sm }]}>
              {attendance?.attendedCount ?? meeting.attendeeCount} of {meeting.rsvpCounts.going} RSVPs checked in
            </Text>
          </Card>
        ) : null}
        {/* Club → pod bridge (04 §2e): the meeting is a pre-aggregated audience —
            let officers spin up an after-hang while everyone's still together. */}
        {canManageAttendance && meetingStarted ? (
          <Card padded>
            <Text style={typography.subheading}>Meeting winding down?</Text>
            <Text style={[typography.captionSmall, { marginTop: 2 }]}>
              Anyone hanging out after? Spin up a pod while everyone's still here.
            </Text>
            <Button
              label="Spin up a hang"
              icon="sparkles"
              size="sm"
              onPress={() =>
                navigation.navigate('MainTabs', {
                  screen: 'Explore',
                  params: { startCreate: Date.now() },
                })
              }
              style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
            />
          </Card>
        ) : null}
        {meeting.description ? <Text style={typography.body}>{meeting.description}</Text> : null}
        <Text style={typography.captionSmall}>
          {meeting.targetRoleIds?.length
            ? `For ${targetRoleNames.length ? targetRoleNames.join(', ') : `${meeting.targetRoleIds.length} member tag${meeting.targetRoleIds.length === 1 ? '' : 's'}`}`
            : meeting.visibility === 'PUBLIC'
              ? 'Visible to everyone'
              : meeting.visibility === 'MEMBERS'
                ? 'Members only'
                : 'Officers only'}
        </Text>
        {club?.isMember ? (
          <SegmentedControl value={meeting.myRsvp} options={[...RSVP_OPTIONS]} onChange={(status) => void rsvp(status)} />
        ) : null}
        <Card padded>
          <Text style={typography.subheading}>RSVP snapshot</Text>
          <Text style={typography.captionSmall}>
            {meeting.rsvpCounts.going} going · {meeting.rsvpCounts.maybe} maybe · {meeting.rsvpCounts.notGoing} can't go
          </Text>
          {attendance?.attendees.length ? (
            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              <Text style={typography.captionSmall}>Checked in</Text>
              <View style={{ flexDirection: 'row' }}>
                {attendance.attendees.slice(0, 6).map((item, index) => (
                  <Avatar
                    key={item.id}
                    name={item.user?.name ?? 'Member'}
                    uri={item.user?.avatarUrl}
                    size={30}
                    style={{ marginLeft: index ? -7 : 0 }}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </Card>

        {club?.isMember && !isLive ? (
          <Card padded style={{ backgroundColor: colors.surfaceAlt }}>
            <Text style={typography.subheading}>Check in</Text>
            <Text style={typography.captionSmall}>Enter the code shared by a club leader.</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Field value={code} onChangeText={(value) => setCode(value.toUpperCase())} placeholder="Code" style={{ flex: 1 }} />
              <Button label="Check in" size="sm" loading={busy === 'checkin'} onPress={() => void checkIn()} />
            </View>
          </Card>
        ) : null}

        {canManageAttendance ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.kicker}>LEADERS ONLY</Text>
            <Card padded>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={typography.subheading}>Attendance console</Text>
                <Sticker label={meeting.attendanceCode ? 'OPEN' : 'CLOSED'} tint={meeting.attendanceCode ? colors.successSoft : colors.surfaceAlt} small />
              </View>
              {meeting.attendanceCode ? (
                <Text style={[typography.display, { marginVertical: spacing.md, letterSpacing: 4 }]}>
                  {meeting.attendanceCode}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <Button
                  label={meeting.attendanceCode ? 'Regenerate' : 'Open'}
                  size="sm"
                  variant="secondary"
                  loading={busy === 'open'}
                  onPress={() => void openAttendance()}
                />
                {meeting.attendanceCode ? (
                  <>
                    <Button label="Copy" size="sm" variant="secondary" onPress={() => void Clipboard.setStringAsync(meeting.attendanceCode!)} />
                    <Button label="Close" size="sm" variant="secondary" loading={busy === 'close'} onPress={() => void closeAttendance()} />
                  </>
                ) : null}
                <Button
                  label="Remind non-RSVPs"
                  size="sm"
                  variant="secondary"
                  loading={busy === 'remind'}
                  onPress={() => {
                    setBusy('remind');
                    void sendClubRsvpReminders(clubId, meetingId)
                      .then((result) => Alert.alert('Reminder sent', `${result.count} members matched.`))
                      .catch(() => Alert.alert('Could not send reminder', API_USER_MESSAGE))
                      .finally(() => setBusy(null));
                  }}
                />
              </View>
              <Text style={[typography.captionSmall, { marginTop: spacing.sm }]}>
                {attendance?.attendedCount ?? meeting.attendeeCount} checked in
              </Text>
            </Card>
          </View>
        ) : null}
      </ScrollView>
      <Sheet
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={meeting.title}
        kicker="MEETING ACTIONS"
      >
        <ListRow
          icon="trash-outline"
          title="Delete meeting"
          destructive
          last
          onPress={() => {
            setActionsOpen(false);
            Alert.alert(
              'Delete meeting?',
              `${meeting.title} will be removed from the club calendar.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    setBusy('delete');
                    void deleteClubMeeting(clubId, meetingId)
                      .then(() => {
                        setMeetings((current) => current.filter((item) => item.id !== meetingId));
                        navigation.goBack();
                      })
                      .catch(() => Alert.alert('Could not delete meeting', API_USER_MESSAGE))
                      .finally(() => setBusy(null));
                  },
                },
              ],
            );
          }}
        />
      </Sheet>
    </AppBackdrop>
  );
}
