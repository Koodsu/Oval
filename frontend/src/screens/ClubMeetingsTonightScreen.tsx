import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiErrorMessage, getClubsToday } from '../api';
import type { RootStackParamList } from '../../App';
import { ClubMeetingToday } from '../types';
import {
  AppBackdrop,
  ClubMark,
  EmptyState,
  ScreenHeader,
  Slab,
  Sticker,
} from '../components/ui';
import { formatTime } from '../utils/format';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  fonts,
  motion,
  radii,
  spacing,
  useTheme,
} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ClubMeetingsTonight'>;

type MeetingStatus = 'live' | 'soon' | 'upcoming';

const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;
const SOON_WINDOW_MS = 60 * 60 * 1000;

function sortMeetings(items: ClubMeetingToday[]) {
  return [...items].sort(
    (a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime(),
  );
}

function meetingStatus(iso: string, now: number): MeetingStatus {
  const time = new Date(iso).getTime();
  if (now >= time && now - time <= LIVE_WINDOW_MS) return 'live';
  if (time > now && time - now <= SOON_WINDOW_MS) return 'soon';
  return 'upcoming';
}

function tonightDateLabel() {
  return new Date()
    .toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase();
}

export default function ClubMeetingsTonightScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [meetings, setMeetings] = useState<ClubMeetingToday[]>([]);

  const load = useCallback(async () => {
    try {
      const rows = await getClubsToday();
      setMeetings(sortMeetings(rows));
    } catch (error) {
      Alert.alert("Could not load tonight's meetings", getApiErrorMessage(error));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const items = useMemo(() => sortMeetings(meetings), [meetings]);
  const now = Date.now();
  const liveCount = items.filter((item) => meetingStatus(item.meetingTime, now) === 'live').length;

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
        <ScreenHeader title="Tonight" kicker={tonightDateLabel()} onBack={() => navigation.goBack()} />

        <View style={styles.headerBlock}>
          <Text style={styles.headerTitle}>TONIGHT{'\n'}ON CAMPUS.</Text>
          <Text style={[typography.body, { color: colors.sub }]}>
            {items.length
              ? `${items.length} club meeting${items.length === 1 ? '' : 's'} on the schedule${liveCount ? ` • ${liveCount} live now` : ''}`
              : 'Nothing on the schedule yet'}
          </Text>
        </View>

        {items.length ? (
          <View style={styles.timeline}>
            {items.map((meeting, index) => {
              const status = meetingStatus(meeting.meetingTime, now);
              return (
                <Animated.View
                  key={meeting.id}
                  entering={FadeInDown.delay(Math.min(index, 6) * motion.stagger).duration(
                    motion.durBase,
                  )}
                >
                  <View style={styles.timelineRow}>
                    <View style={styles.timeColumn}>
                      <Text
                        style={[
                          styles.timeText,
                          status === 'live' && { color: colors.success },
                        ]}
                      >
                        {formatTime(meeting.meetingTime)}
                      </Text>
                    </View>

                    <View style={styles.railColumn}>
                      <View
                        style={[
                          styles.railDot,
                          {
                            backgroundColor:
                              status === 'live'
                                ? colors.success
                                : status === 'soon'
                                  ? colors.warning
                                  : colors.borderSoft,
                            borderColor: colors.border,
                          },
                        ]}
                      />
                      {index < items.length - 1 ? (
                        <View style={[styles.railLine, { backgroundColor: colors.borderSoft }]} />
                      ) : null}
                    </View>

                    <Slab
                      onPress={() => navigation.navigate('ClubDetail', { clubId: meeting.clubId })}
                      style={{ flex: 1 }}
                      faceStyle={styles.meetingFace}
                      accessibilityLabel={`${meeting.clubName}, ${meeting.title}, at ${formatTime(meeting.meetingTime)}`}
                    >
                      <View style={styles.meetingTop}>
                        <ClubMark
                          name={meeting.clubName}
                          emoji={meeting.clubEmoji}
                          size={44}
                          tilt={-2}
                        />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={typography.heading} numberOfLines={1}>
                            {meeting.clubName}
                          </Text>
                          <Text style={typography.caption} numberOfLines={1}>
                            {meeting.title}
                          </Text>
                        </View>
                        {status === 'live' ? (
                          <Sticker
                            label="Live"
                            tint={colors.success}
                            textColor={colors.onPrimary}
                            icon="radio"
                            small
                            tilt={3}
                          />
                        ) : status === 'soon' ? (
                          <Sticker label="Soon" tint={colors.warningSoft} small tilt={-3} />
                        ) : null}
                      </View>

                      <View style={styles.metaRow}>
                        <Ionicons name="location" size={13} color={colors.faint} />
                        <Text style={[typography.captionSmall, { flex: 1 }]} numberOfLines={1}>
                          {meeting.location}
                        </Text>
                        <View style={styles.goingPill}>
                          <Ionicons name="people" size={11} color={colors.primary} />
                          <Text style={[styles.goingText, { color: colors.primary }]}>
                            {meeting.attendeeCount}
                          </Text>
                        </View>
                      </View>
                    </Slab>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="calendar"
            title="No club meetings tonight"
            body="Tonight's club schedule will show up here once meetings are posted."
          />
        )}
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  headerBlock: {
    gap: spacing.sm,
  },
  headerTitle: {
    fontFamily: fonts.displayHeavy,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.8,
    color: t.colors.ink,
  },
  timeline: {
    gap: spacing.md,
  },
  timelineRow: {
    flexDirection: 'row' as const,
    gap: spacing.xs,
  },
  timeColumn: {
    width: 60,
    paddingTop: spacing.md,
    alignItems: 'flex-end' as const,
  },
  timeText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: t.colors.sub,
    textAlign: 'right' as const,
  },
  railColumn: {
    width: 24,
    alignItems: 'center' as const,
    paddingTop: spacing.md + 2,
  },
  railDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  railLine: {
    flex: 1,
    width: 2,
    borderRadius: 1,
    marginTop: 4,
    marginBottom: -spacing.sm,
  },
  meetingFace: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  meetingTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  emojiTile: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    transform: [{ rotate: '-2deg' }],
  },
  emojiText: {
    fontSize: 21,
    lineHeight: 27,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  goingPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    borderRadius: radii.xs,
    backgroundColor: t.colors.primarySoft,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  goingText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
  },
}));
