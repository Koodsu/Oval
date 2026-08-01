import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
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
  resolveAvatarUrl,
  rsvpClubMeeting,
  sendClubRsvpReminders,
} from '../../api';
import type { RootStackParamList } from '../../../App';
import {
  AppBackdrop,
  Avatar,
  Button,
  Card,
  ContentImage,
  Field,
  ListRow,
  ScreenHeader,
  Sheet,
  Sticker,
} from '../../components/ui';
import {
  ClubEmptyState,
  ClubScreenLoading,
  DateBadge,
  RSVP_OPTIONS,
  SegmentedControl,
} from '../../components/clubs';
import { useClub } from '../../hooks/useClub';
import type { ClubMeetingAttendanceResponse } from '../../types';
import { formatDateTime } from '../../utils/format';
import { buildClubCalendarIcs } from '../../utils/calendar';
import { exportTextFile } from '../../utils/fileExport';
import { spacing, useTheme } from '../../theme';
import { clubIdentityImageFor } from '../../constants/contentImages';
import { getUiPreviewMode } from '../../dev/previewMode';

import { toast } from '../../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'ClubMeeting'>;

export default function MeetingDetailScreen({ route, navigation }: Props) {
  const { clubId, meetingId } = route.params;
  const { club, meetings, can, loading, refresh, setMeetings } = useClub(clubId);
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [previewMode] = useState(getUiPreviewMode);
  const upcomingMeeting = useMemo(
    () => meetings.find((item) => item.id === meetingId),
    [meetingId, meetings],
  );
  const [fallbackMeeting, setFallbackMeeting] = useState<(typeof meetings)[number] | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(
    previewMode !== 'club-meeting-not-found',
  );
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
    if (previewMode?.startsWith('club-')) {
      setFallbackLoading(false);
      setFallbackMeeting(null);
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
  }, [clubId, loading, meetingId, previewMode, upcomingMeeting]);

  if ((loading && !club) || fallbackLoading) {
    return <ClubScreenLoading title="Meeting" onBack={() => navigation.goBack()} />;
  }

  if (!meeting) {
    return (
      <AppBackdrop>
        <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: insets.top + spacing.md }}>
          <ScreenHeader title="Meeting" onBack={() => navigation.goBack()} />
          <ClubEmptyState
            variant="calendar"
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
      toast.error('Could not RSVP', API_USER_MESSAGE);
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
      toast.error('Could not open attendance', API_USER_MESSAGE);
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
      toast.error('Could not close attendance', API_USER_MESSAGE);
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
      toast.success('Checked in', 'Your attendance has been recorded.');
      await refresh();
      if (canManageAttendance) {
        void getClubMeetingAttendance(clubId, meetingId).then(setAttendance).catch(() => {});
      }
    } catch {
      toast.error('Could not check in', API_USER_MESSAGE);
    } finally {
      setBusy(null);
    }
  };

  const shareMeeting = async () => {
    await Share.share({
      message: `${meeting.title} with ${club?.name ?? 'our club'}\n${formatDateTime(meeting.meetingTime)}\n${meeting.location}\nhttps://www.theovalapp.com/clubs/${encodeURIComponent(clubId)}`,
    });
  };

  const addToCalendar = async () => {
    if (!club) return;
    const safeName = meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meeting';
    await exportTextFile({
      filename: `${safeName}.ics`,
      contents: buildClubCalendarIcs(club, [meeting]),
      mimeType: 'text/calendar',
      uti: 'com.apple.ical.ics',
      title: `Add ${meeting.title} to Calendar`,
    });
  };

  const checkInTotal = Math.max(meeting.rsvpCounts.going, attendance?.attendedCount ?? meeting.attendeeCount, 1);
  const checkedIn = attendance?.attendedCount ?? meeting.attendeeCount;
  const checkInProgress = Math.min(1, checkedIn / checkInTotal);

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
          right={(
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button label="Share" size="sm" variant="secondary" onPress={() => void shareMeeting()} />
              {canDeleteMeeting ? (
                <Button label="•••" size="sm" variant="secondary" onPress={() => setActionsOpen(true)} />
              ) : null}
            </View>
          )}
        />
        <ContentImage
          source={
            club?.coverUrl
              ? { uri: resolveAvatarUrl(club.coverUrl) ?? club.coverUrl }
              : clubIdentityImageFor(club)
          }
          seed={`${club?.name ?? 'club'}-${meeting.title}`}
          aspectRatio={16 / 9}
          accessibilityLabel={`${meeting.title} event`}
          style={{ borderRadius: 20 }}
        >
          {isLive ? (
            <View style={{ position: 'absolute', left: spacing.md, top: spacing.md }}>
              <Sticker
                label="Happening now"
                tint={colors.primary}
                textColor={colors.onPrimary}
                icon="radio"
                small
              />
            </View>
          ) : null}
        </ContentImage>
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

        {/* Leaders see the live console before member controls or secondary
            meeting content so the screen is useful at the door. */}
        {canManageAttendance ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.kicker, { color: colors.primary }]}>LEADERS ONLY</Text>
            <Card padded style={{ borderColor: colors.primary, backgroundColor: colors.primarySoft }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={typography.subheading}>Attendance console</Text>
                <Sticker
                  label={meeting.attendanceCode ? 'OPEN' : 'CLOSED'}
                  tint={meeting.attendanceCode ? colors.successSoft : colors.surfaceAlt}
                  small
                />
              </View>
              {meeting.attendanceCode ? (
                <Text style={[typography.display, { marginTop: spacing.md, letterSpacing: 4 }]}>
                  {meeting.attendanceCode}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.sm }}>
                <Text style={typography.display}>{checkedIn}</Text>
                <Text style={[typography.title, { color: colors.sub }]}> of {checkInTotal}</Text>
                <Text style={[typography.captionSmall, { marginLeft: spacing.xs }]}>checked in</Text>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: checkInTotal, now: checkedIn }}
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.surfaceAlt,
                  overflow: 'hidden',
                  marginVertical: spacing.sm,
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${Math.round(checkInProgress * 100)}%`,
                    backgroundColor: colors.primary,
                    borderRadius: 4,
                  }}
                />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <Button
                  label={meeting.attendanceCode ? 'Regenerate' : 'Open check-in'}
                  size="sm"
                  variant="secondary"
                  loading={busy === 'open'}
                  onPress={() => void openAttendance()}
                />
                {meeting.attendanceCode ? (
                  <>
                    <Button label="Copy code" size="sm" variant="secondary" onPress={() => void Clipboard.setStringAsync(meeting.attendanceCode!)} />
                    <Button label="End check-in" size="sm" variant="secondary" loading={busy === 'close'} onPress={() => void closeAttendance()} />
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
                      .then((result) => toast.success('Reminder sent', `${result.count} members matched.`))
                      .catch(() => toast.error('Could not send reminder', API_USER_MESSAGE))
                      .finally(() => setBusy(null));
                  }}
                />
              </View>
            </Card>
          </View>
        ) : null}

        {/* ── Live check-in theater: front and center for members while the meeting is on ── */}
        {isLive && club?.isMember && !canManageAttendance ? (
          <Card padded style={{ borderColor: colors.success }}>
            <Text style={[typography.kicker, { color: colors.success }]}>HAPPENING NOW</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.sm }}>
              <Text style={typography.display}>{checkedIn}</Text>
              <Text style={[typography.title, { color: colors.sub }]}> of {checkInTotal}</Text>
            </View>
            <Text style={typography.captionSmall}>checked in</Text>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: checkInTotal, now: checkedIn }}
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.surfaceAlt,
                overflow: 'hidden',
                marginVertical: spacing.sm,
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${Math.round(checkInProgress * 100)}%`,
                  backgroundColor: colors.primary,
                  borderRadius: 4,
                }}
              />
            </View>
            <Text style={[typography.subheading, { marginTop: spacing.xs }]}>Member check-in</Text>
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
              Ask a club leader for today&apos;s code.
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
        <Card padded>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="location" size={25} color={colors.accentText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.subheading}>{meeting.location}</Text>
              <Text style={typography.captionSmall}>Open the location in your preferred maps app</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.sub} />
          </View>
        </Card>
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

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            label="Add to calendar"
            icon="calendar-outline"
            variant="secondary"
            onPress={() => void addToCalendar()}
            style={{ flex: 1 }}
          />
          <Button
            label="Share"
            icon="share-outline"
            onPress={() => void shareMeeting()}
            style={{ flex: 1 }}
          />
        </View>
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
                      .catch(() => toast.error('Could not delete meeting', API_USER_MESSAGE))
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
