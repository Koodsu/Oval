import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  API_USER_MESSAGE,
  createClubMeeting,
  type ClubVisibility,
} from '../../api';
import type { RootStackParamList } from '../../../App';
import {
  AppBackdrop,
  Button,
  Chip,
  DateTimeField,
  EmptyState,
  Field,
  ScreenHeader,
  Sheet,
} from '../../components/ui';
import { ClubScreenLoading, MeetingCard, RoleTargetPicker } from '../../components/clubs';
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
  const [composerOpen, setComposerOpen] = useState(Boolean(startCreate));
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [visibility, setVisibility] = useState<ClubVisibility>('PUBLIC');
  const [targetRoleIds, setTargetRoleIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const canCreate = can('CREATE_MEETINGS');
  const latestMeetingDate = useMemo(() => {
    const latest = new Date();
    latest.setFullYear(latest.getFullYear() + 1);
    return latest;
  }, []);

  const groups = useMemo(() => {
    const result = new Map<string, typeof meetings>();
    for (const meeting of meetings) {
      const key = new Date(meeting.meetingTime).toLocaleDateString([], { month: 'long', year: 'numeric' });
      result.set(key, [...(result.get(key) ?? []), meeting]);
    }
    return [...result.entries()];
  }, [meetings]);

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
              {meetings.length ? <Button label=".ics" size="sm" variant="secondary" onPress={() => void exportCalendar()} /> : null}
              {canCreate ? <Button label="+ New" size="sm" onPress={() => setComposerOpen(true)} /> : null}
            </View>
          }
        />
        {groups.length ? groups.map(([month, rows]) => (
          <View key={month} style={{ gap: spacing.sm }}>
            <Text style={typography.kicker}>{month.toUpperCase()}</Text>
            {rows.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onPress={() => navigation.navigate('ClubMeeting', { clubId, meetingId: meeting.id })}
              />
            ))}
          </View>
        )) : (
          <EmptyState
            icon="calendar-outline"
            title="No upcoming meetings"
            body="Scheduled club events will appear here."
            actionLabel={canCreate ? 'Create meeting' : 'Back to club'}
            onAction={() => {
              if (canCreate) {
                setComposerOpen(true);
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
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="Combat bot build night" />
          <Field label="Location" value={location} onChangeText={setLocation} placeholder="Scott Lab E040" />
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
