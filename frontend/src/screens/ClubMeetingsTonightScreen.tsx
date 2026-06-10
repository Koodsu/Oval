import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getApiErrorMessage, getClubsToday } from '../api';
import type { RootStackParamList } from '../../App';
import { ClubMeetingToday } from '../types';
import { EmptyState, Entrance, LiveDot, Screen, ScreenHeader, Tap } from '../components/ui';
import { clubGradientForSeed } from '../constants/clubVisuals';
import { formatTime } from '../utils/format';
import { Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ClubMeetingsTonight'>;

type MeetingStatus = 'live' | 'soon' | 'upcoming';

const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;
const SOON_WINDOW_MS = 60 * 60 * 1000;

function sortMeetings(items: ClubMeetingToday[]) {
  return [...items].sort(
    (a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime()
  );
}

function meetingStatus(iso: string, now: number): MeetingStatus {
  const time = new Date(iso).getTime();
  if (now >= time && now - time <= LIVE_WINDOW_MS) return 'live';
  if (time > now && time - now <= SOON_WINDOW_MS) return 'soon';
  return 'upcoming';
}

function tonightDateLabel() {
  return new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function ClubMeetingsTonightScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [meetings, setMeetings] = useState<ClubMeetingToday[]>([]);

  const load = useCallback(async () => {
    try {
      const rows = await getClubsToday();
      setMeetings(sortMeetings(rows));
    } catch (error) {
      Alert.alert('Could not load tonight\'s meetings', getApiErrorMessage(error));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const items = useMemo(() => sortMeetings(meetings), [meetings]);
  const now = Date.now();
  const liveCount = items.filter((item) => meetingStatus(item.meetingTime, now) === 'live').length;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <ScreenHeader title="Tonight" onBack={() => navigation.goBack()} />

        <View style={styles.headerBlock}>
          <Text style={styles.headerEyebrow}>{tonightDateLabel()}</Text>
          <Text style={styles.headerTitle}>Tonight on campus</Text>
          <Text style={styles.headerSub}>
            {items.length
              ? `${items.length} club meeting${items.length === 1 ? '' : 's'} on the schedule${liveCount ? ` · ${liveCount} live now` : ''}`
              : 'Nothing on the schedule yet'}
          </Text>
        </View>

        {items.length ? (
          <View style={styles.timeline}>
            {items.map((meeting, index) => {
              const status = meetingStatus(meeting.meetingTime, now);
              return (
                <Entrance key={meeting.id} index={Math.min(index, 6)}>
                  <View style={styles.timelineRow}>
                    <View style={styles.timeColumn}>
                      <Text style={[styles.timeText, status === 'live' && styles.timeTextLive]}>
                        {formatTime(meeting.meetingTime)}
                      </Text>
                    </View>

                    <View style={styles.railColumn}>
                      <View style={[
                        styles.railDot,
                        status === 'live' && styles.railDotLive,
                        status === 'soon' && styles.railDotSoon,
                      ]} />
                      {index < items.length - 1 ? <View style={styles.railLine} /> : null}
                    </View>

                    <Tap
                      haptic
                      style={styles.meetingCard}
                      onPress={() => navigation.navigate('ClubDetail', { clubId: meeting.clubId })}
                      accessibilityLabel={`${meeting.clubName}, ${meeting.title}, at ${formatTime(meeting.meetingTime)}`}
                    >
                      <View style={styles.meetingTop}>
                        <LinearGradient
                          colors={clubGradientForSeed(meeting.clubId)}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.emojiTile}
                        >
                          <Text style={styles.emojiText}>{meeting.clubEmoji}</Text>
                        </LinearGradient>
                        <View style={styles.meetingCopy}>
                          <Text style={styles.meetingClub} numberOfLines={1}>{meeting.clubName}</Text>
                          <Text style={styles.meetingTitle} numberOfLines={1}>{meeting.title}</Text>
                        </View>
                        {status === 'live' ? (
                          <View style={styles.liveBadge}>
                            <LiveDot size={6} color="#FFFFFF" />
                            <Text style={styles.liveBadgeText}>Live</Text>
                          </View>
                        ) : status === 'soon' ? (
                          <View style={styles.soonBadge}>
                            <Text style={styles.soonBadgeText}>Soon</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.meetingMetaRow}>
                        <Ionicons name="location-outline" size={14} color={colors.faint} />
                        <Text style={styles.meetingMetaText} numberOfLines={1}>{meeting.location}</Text>
                        <View style={styles.goingPill}>
                          <Ionicons name="people" size={12} color={colors.primary} />
                          <Text style={styles.goingPillText}>{meeting.attendeeCount}</Text>
                        </View>
                      </View>
                    </Tap>
                  </View>
                </Entrance>
              );
            })}
          </View>
        ) : (
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

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  headerBlock: {
    gap: 4,
    paddingHorizontal: 2,
  },
  headerEyebrow: {
    ...t.typography.label,
    color: t.colors.primary,
  },
  headerTitle: {
    ...t.typography.h1,
  },
  headerSub: {
    ...t.typography.body,
  },
  timeline: {
    gap: spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row' as const,
    gap: spacing.xs,
  },
  timeColumn: {
    width: 62,
    paddingTop: spacing.sm + 2,
    alignItems: 'flex-end' as const,
  },
  timeText: {
    fontFamily: fonts.displayMedium,
    fontSize: 13,
    letterSpacing: -0.2,
    color: t.colors.sub,
    textAlign: 'right' as const,
  },
  timeTextLive: {
    color: t.colors.green,
  },
  railColumn: {
    width: 22,
    alignItems: 'center' as const,
    paddingTop: spacing.sm + 6,
  },
  railDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: t.colors.borderStrong,
  },
  railDotLive: {
    backgroundColor: t.colors.green,
  },
  railDotSoon: {
    backgroundColor: t.colors.amber,
  },
  railLine: {
    flex: 1,
    width: 2,
    borderRadius: 1,
    marginTop: 4,
    marginBottom: -spacing.sm + 4,
    backgroundColor: t.colors.border,
  },
  meetingCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.sm + 2,
    gap: spacing.xs,
    ...t.shadows.subtle,
  },
  meetingTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  emojiTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emojiText: {
    fontSize: 22,
    lineHeight: 28,
  },
  meetingCopy: {
    flex: 1,
    gap: 1,
  },
  meetingClub: {
    ...t.typography.title,
    fontSize: 16,
    lineHeight: 21,
  },
  meetingTitle: {
    ...t.typography.body,
    fontSize: 13.5,
  },
  liveBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: t.colors.green,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  soonBadge: {
    borderRadius: radii.pill,
    backgroundColor: t.colors.amberSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  soonBadgeText: {
    color: t.colors.warnText,
    fontFamily: fonts.bold,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  meetingMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  meetingMetaText: {
    ...t.typography.caption,
    flex: 1,
  },
  goingPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    borderRadius: radii.pill,
    backgroundColor: t.colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  goingPillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: t.colors.primarySoftText,
  },
}));
