import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  API_USER_MESSAGE,
  createClubMeeting,
  rsvpClubMeeting,
  type ClubVisibility,
} from '../../api';
import type { RootStackParamList } from '../../../App';
import {
  AppBackdrop,
  Button,
  Chip,
  DateTimeField,
  Field,
  ScreenHeader,
  Sheet,
} from '../../components/ui';
import {
  ClubEmptyState,
  ClubScreenLoading,
  MeetingCard,
  RoleTargetPicker,
} from '../../components/clubs';
import { useClub } from '../../hooks/useClub';
import { buildClubCalendarIcs } from '../../utils/calendar';
import { exportTextFile } from '../../utils/fileExport';
import { spacing, useTheme } from '../../theme';

import { toast } from '../../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'ClubEvents'>;

export default function ClubEventsScreen({ route, navigation }: Props) {
  const { clubId, startCreate } = route.params;
  const { club, meetings, can, loading, refresh } = useClub(clubId);
  const { typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [visibility, setVisibility] = useState<ClubVisibility>('PUBLIC');
  const [targetRoleIds, setTargetRoleIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canCreate = can('CREATE_MEETINGS');

  useEffect(() => {
    if (!startCreate) return;
    if (__DEV__ && club?.id === 'preview-photography') {
      setTitle('Photo Critique Night');
      setLocation('Media Center Room 204');
      setDescription('Share your work, get thoughtful feedback, and level up your photography. All skill levels welcome.');
      const previewTime = new Date();
      previewTime.setDate(previewTime.getDate() + 3);
      previewTime.setHours(19, 0, 0, 0);
      setTime(previewTime);
    }
    const timer = setTimeout(() => setComposerOpen(true), 250);
    return () => clearTimeout(timer);
  }, [club?.id, startCreate]);
  const latestMeetingDate = useMemo(() => {
    const latest = new Date();
    latest.setFullYear(latest.getFullYear() + 1);
    return latest;
  }, []);

  const months = useMemo(() => {
    const result: Array<{ key: string; label: string }> = [];
    const cursor = new Date();
    cursor.setDate(1);
    for (let index = 0; index < 6; index += 1) {
      const month = new Date(cursor.getFullYear(), cursor.getMonth() + index, 1);
      result.push({
        key: `${month.getFullYear()}-${month.getMonth()}`,
        label: month.toLocaleDateString([], { month: 'short' }),
      });
    }
    return result;
  }, []);

  const activeMonth = selectedMonth ?? months[0]?.key ?? null;
  const visibleMeetings = useMemo(() => meetings.filter((meeting) => {
    const date = new Date(meeting.meetingTime);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    const normalizedQuery = query.trim().toLowerCase();
    return monthKey === activeMonth && (
      !normalizedQuery
      || meeting.title.toLowerCase().includes(normalizedQuery)
      || meeting.location.toLowerCase().includes(normalizedQuery)
    );
  }), [activeMonth, meetings, query]);

  const groups = useMemo(() => {
    const tonight: typeof meetings = [];
    const upcoming: typeof meetings = [];
    const today = new Date();
    for (const meeting of visibleMeetings) {
      const date = new Date(meeting.meetingTime);
      const sameDay = date.getFullYear() === today.getFullYear()
        && date.getMonth() === today.getMonth()
        && date.getDate() === today.getDate();
      (sameDay ? tonight : upcoming).push(meeting);
    }
    return [
      ...(tonight.length ? [['TONIGHT', tonight] as const] : []),
      ...(upcoming.length ? [['UPCOMING', upcoming] as const] : []),
    ];
  }, [meetings, visibleMeetings]);

  const updateRsvp = async (
    meetingId: string,
    status: 'GOING' | 'MAYBE' | 'NOT_GOING',
  ) => {
    try {
      await rsvpClubMeeting(meetingId, status);
      await refresh();
    } catch {
      toast.error('Could not RSVP', API_USER_MESSAGE);
    }
  };

  const createMeeting = async () => {
    if (!title.trim() || !location.trim()) {
      toast.error('Missing meeting info', 'Add a title and location.');
      return;
    }
    if (time.getTime() <= Date.now() || time.getTime() > latestMeetingDate.getTime()) {
      toast.error('Choose a valid time', 'Meetings must be scheduled within the next 12 months.');
      return;
    }
    setBusy(true);
    try {
      const created = await createClubMeeting(clubId, {
        title: title.trim(),
        location: location.trim(),
        description: description.trim() || undefined,
        meetingTime: time.toISOString(),
        visibility,
        targetRoleIds,
      });
      setComposerOpen(false);
      setTitle('');
      setLocation('');
      setDescription('');
      setVisibility('PUBLIC');
      setTargetRoleIds([]);
      setTime(new Date(Date.now() + 24 * 60 * 60 * 1000));
      await refresh();
      navigation.navigate('ClubMeeting', { clubId, meetingId: created.id });
    } catch {
      toast.error('Could not create meeting', API_USER_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  const exportCalendar = async () => {
    if (!club) return;
    const safeName = club.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'club';
    await exportTextFile({
      filename: `${safeName}-oval-calendar.ics`,
      contents: buildClubCalendarIcs(club, meetings),
      mimeType: 'text/calendar',
      uti: 'com.apple.ical.ics',
      title: `Add ${club.name} to Calendar`,
    });
  };

  if (loading && !club) {
    return <ClubScreenLoading title="Events" onBack={() => navigation.goBack()} />;
  }

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <ScreenHeader
          title="Events"
          kicker={club?.name}
          onBack={() => navigation.goBack()}
          right={
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {meetings.length ? <Button label="Export" icon="calendar-outline" size="sm" variant="secondary" onPress={() => void exportCalendar()} /> : null}
              {canCreate ? <Button label="+ New" size="sm" onPress={() => setComposerOpen(true)} /> : null}
            </View>
          }
        />
        <ScrollView
          horizontal
          style={{ flexGrow: 0 }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {months.map((month) => (
            <Chip
              key={month.key}
              label={month.label}
              selected={activeMonth === month.key}
              onPress={() => setSelectedMonth(month.key)}
            />
          ))}
        </ScrollView>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Search meetings or locations"
          autoCapitalize="none"
        />
        {groups.length ? groups.map(([month, rows]) => (
          <View key={month} style={{ gap: spacing.sm }}>
            <Text style={typography.kicker}>{month.toUpperCase()}</Text>
            {rows.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onPress={() => navigation.navigate('ClubMeeting', { clubId, meetingId: meeting.id })}
                onRsvp={club?.isMember
                  ? (status) => void updateRsvp(meeting.id, status)
                  : undefined}
              />
            ))}
          </View>
        )) : (
          <ClubEmptyState
            variant="calendar"
            title="No upcoming meetings"
            body="When leaders post the next gathering, it will show up here."
            actionLabel={canCreate ? 'Create meeting' : query ? 'Clear search' : 'Back to club'}
            onAction={() => {
              if (canCreate) {
                setComposerOpen(true);
              } else if (query) {
                setQuery('');
              } else {
                navigation.navigate('ClubDetail', { clubId });
              }
            }}
          />
        )}
      </ScrollView>
      <Sheet
        visible={canCreate && composerOpen}
        onClose={() => setComposerOpen(false)}
        title="New meeting"
        kicker={club?.name}
        scrollable
      >
        <View style={{ gap: spacing.md }}>
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="Photo Critique Night" />
          <Field label="Location" value={location} onChangeText={setLocation} placeholder="Media Center Room 204" />
          <Field label="Description" value={description} onChangeText={setDescription} multiline placeholder="What should members know?" />
          <DateTimeField
            value={time}
            minimumDate={new Date()}
            maximumDate={latestMeetingDate}
            onChange={setTime}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {([
              ['PUBLIC', 'Everyone'],
              ['MEMBERS', 'Members'],
              ['OFFICERS', 'Officers'],
            ] as Array<[ClubVisibility, string]>).map(([value, label]) => (
              <Chip
                key={value}
                label={label}
                selected={visibility === value}
                onPress={() => setVisibility(value)}
              />
            ))}
          </View>
          <RoleTargetPicker
            roles={club?.roles ?? []}
            selectedRoleIds={targetRoleIds}
            onChange={setTargetRoleIds}
          />
          <Button label="Create meeting" loading={busy} onPress={() => void createMeeting()} />
        </View>
      </Sheet>
    </AppBackdrop>
  );
}
