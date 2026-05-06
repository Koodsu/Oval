import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { API_USER_MESSAGE, getClubsToday } from '../api';
import type { RootStackParamList } from '../../App';
import { ClubMeetingToday } from '../types';
import { EmptyState, Screen, ScreenHeader } from '../components/ui';
import { formatTime } from '../utils/format';
import { palette, radii, shadows, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ClubMeetingsTonight'>;

function sortMeetings(items: ClubMeetingToday[]) {
  return [...items].sort(
    (a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime()
  );
}

export default function ClubMeetingsTonightScreen({ navigation }: Props) {
  const [meetings, setMeetings] = useState<ClubMeetingToday[]>([]);

  const load = useCallback(async () => {
    try {
      const rows = await getClubsToday();
      setMeetings(sortMeetings(rows));
    } catch {
      Alert.alert('Could not load tonight\'s meetings', API_USER_MESSAGE);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const items = useMemo(() => sortMeetings(meetings), [meetings]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Meeting tonight" onBack={() => navigation.goBack()} />

        {items.length ? items.map((meeting) => (
          <TouchableOpacity
            key={meeting.id}
            style={styles.card}
            activeOpacity={0.92}
            onPress={() => navigation.navigate('ClubDetail', { clubId: meeting.clubId })}
          >
            <View style={styles.iconTile}>
              <Text style={styles.iconEmoji}>{meeting.clubEmoji}</Text>
            </View>

            <View style={styles.copy}>
              <Text style={styles.title}>{meeting.clubName}</Text>
              <Text style={styles.meta}>Today • {formatTime(meeting.meetingTime)}</Text>
              <Text style={styles.meta}>{meeting.location}</Text>
            </View>

            <Text style={styles.going}>{meeting.attendeeCount} going</Text>
          </TouchableOpacity>
        )) : (
          <EmptyState
            icon="calendar-outline"
            title="No club meetings tonight"
            body="Tonight's club schedule will show up here once meetings are posted."
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 22,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    ...shadows.card,
  },
  iconTile: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 33, 43, 0.05)',
  },
  iconEmoji: {
    fontSize: 24,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.title,
    fontSize: 19,
    lineHeight: 23,
  },
  meta: {
    ...typography.body,
    fontSize: 14,
  },
  going: {
    ...typography.bodyStrong,
    color: palette.scarlet,
  },
});
