import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiErrorMessage, getClubsWeek } from '../../api';
import type { RootStackParamList } from '../../../App';
import { ClubMeetingToday } from '../../types';
import {
  AppBackdrop,
  ClubMark,
  EmptyState,
  ScreenHeader,
  Slab,
  Sticker,
} from '../../components/ui';
import { formatTime } from '../../utils/format';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  fonts,
  motion,
  radii,
  spacing,
  useTheme,
} from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ClubMeetingsTonight'>;

type MeetingStatus = 'live' | 'soon' | 'upcoming' | 'past';

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
  if (now > time) return 'past';
  if (time - now <= SOON_WINDOW_MS) return 'soon';
  return 'upcoming';
}

function dayKey(date: Date): string {
  return date.toDateString();
}

function buildWeek(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(today);
    day.setDate(day.getDate() + offset);
    days.push(day);
  }
  return days;
}

function headerDateLabel(day: Date): string {
  const today = new Date();
  const isToday = day.toDateString() === today.toDateString();
  const label = day
    .toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase();
  return isToday ? `TONIGHT · ${label}` : label;
}

export default function ClubMeetingsTonightScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [meetings, setMeetings] = useState<ClubMeetingToday[]>([]);
  const week = useMemo(buildWeek, []);
  const [selectedDay, setSelectedDay] = useState<string>(dayKey(week[0]));

  const load = useCallback(async () => {
    try {
      const rows = await getClubsWeek();
      setMeetings(sortMeetings(rows));
    } catch (error) {
      Alert.alert("Could not load this week's meetings", getApiErrorMessage(error));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const byDay = useMemo(() => {
    const map = new Map<string, ClubMeetingToday[]>();
    for (const meeting of meetings) {
      const key = dayKey(new Date(meeting.meetingTime));
      map.set(key, [...(map.get(key) ?? []), meeting]);
    }
    return map;
  }, [meetings]);

  const items = useMemo(
    () => sortMeetings(byDay.get(selectedDay) ?? []),
    [byDay, selectedDay],
  );
  const selectedDate = week.find((day) => dayKey(day) === selectedDay) ?? week[0];
  const isToday = dayKey(week[0]) === selectedDay;
  const now = Date.now();
  const liveCount = isToday
    ? items.filter((item) => meetingStatus(item.meetingTime, now) === 'live').length
    : 0;

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
        <ScreenHeader
          title={isToday ? 'Tonight' : 'This week'}
          kicker={headerDateLabel(selectedDate)}
          onBack={() => navigation.goBack()}
        />

        <View style={styles.headerBlock}>
          <Text style={styles.headerTitle}>
            {isToday ? 'Tonight\non campus' : 'This week\non campus'}
          </Text>
          <Text style={[typography.body, { color: colors.sub }]}>
            {items.length
              ? `${items.length} club meeting${items.length === 1 ? '' : 's'} on the schedule${liveCount ? ` • ${liveCount} live now` : ''}`
              : 'Nothing on the schedule yet'}
          </Text>
        </View>

        {/* ── Day rail ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View style={styles.dayRail}>
            {week.map((day) => {
              const key = dayKey(day);
              const selected = key === selectedDay;
              const count = byDay.get(key)?.length ?? 0;
              return (
                <Pressable
                  key={key}
                  onPress={() => setSelectedDay(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${day.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}, ${count} meetings`}
                  style={[
                    styles.dayItem,
                    {
                      backgroundColor: selected ? colors.ink : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.dayName, { color: selected ? colors.surface : colors.sub }]}>
                    {day.toLocaleDateString([], { weekday: 'short' }).toUpperCase()}
                  </Text>
                  <Text style={[styles.dayNum, { color: selected ? colors.surface : colors.ink }]}>
                    {day.getDate()}
                  </Text>
                  <View
                    style={[
                      styles.dayDot,
                      {
                        backgroundColor: count
                          ? selected
                            ? colors.surface
                            : colors.primary
                          : 'transparent',
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {items.length ? (
          <View style={styles.timeline}>
            {items.map((meeting, index) => {
              const status = isToday ? meetingStatus(meeting.meetingTime, now) : 'upcoming';
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
                      onPress={() =>
                        navigation.navigate('ClubMeeting', {
                          clubId: meeting.clubId,
                          meetingId: meeting.id,
                        })
                      }
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
                        ) : meeting.isMyClub ? (
                          <Sticker label="My club" tint={colors.blueSoft} small tilt={-3} />
                        ) : null}
                      </View>

                      <View style={styles.metaRow}>
                        <Ionicons name="location" size={13} color={colors.sub} />
                        <Text style={[typography.captionSmall, { flex: 1 }]} numberOfLines={1}>
                          {meeting.location}
                        </Text>
                        <View style={styles.goingPill}>
                          <Ionicons name="people" size={11} color={colors.accentText} />
                          <Text style={[styles.goingText, { color: colors.accentText }]}>
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
            title={isToday ? 'No club meetings tonight' : 'No meetings this day'}
            body="Club meetings will show up here once they're posted."
            actionLabel={isToday ? 'Refresh' : 'Show tonight'}
            onAction={() => {
              if (isToday) {
                void load();
              } else {
                setSelectedDay(dayKey(week[0]));
              }
            }}
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
    fontFamily: fonts.display,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: t.colors.ink,
  },
  dayRail: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    paddingRight: spacing.xl,
    paddingVertical: 3,
  },
  dayItem: {
    width: 52,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    alignItems: 'center' as const,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  dayName: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 1,
  },
  dayNum: {
    fontFamily: fonts.display,
    fontSize: 17,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
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
