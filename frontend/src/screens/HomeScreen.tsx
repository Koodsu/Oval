import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from '../components/CampusMap';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchFeed, getActivities, getApiErrorMessage, getClubsToday, getMyPods } from '../api';
import { useAuth } from '../context/AuthContext';
import { Activity, ClubMeetingToday, Pod } from '../types';
import { RootStackParamList } from '../../App';
import {
  AppBackdrop,
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  SectionHeader,
  SkeletonCard,
  Slab,
  Sticker,
  accentForSeed,
} from '../components/ui';
import { OSU_CAMPUS_CENTER, OSU_CAMPUS_DELTA, OSU_CAMPUS_POLYGON } from '../constants/campusMap';
import { CATEGORY_META } from '../constants/categories';
import {
  BORDER_W,
  DOCK_CLEARANCE,
  Theme,
  createThemedStyles,
  fonts,
  motion,
  radii,
  spacing,
  useTheme,
} from '../theme';
import { formatDateTime, formatTime } from '../utils/format';
import { getFeaturedActivities, sortUpcomingPods } from '../utils/experience';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { useNotificationPermission } from '../hooks/useNotificationPermission';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'UP LATE';
  if (hour < 12) return 'MORNING';
  if (hour < 17) return 'AFTERNOON';
  return 'EVENING';
}

function datelineForNow(): string {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase();
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user, token } = useAuth();
  const theme = useTheme();
  const { colors, typography } = theme;
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { granted, canAskAgain, userLocation, requestLocation } = useLocationPermission();
  const {
    granted: notificationsGranted,
    canAskAgain: canAskForNotifications,
    loaded: notificationPermissionLoaded,
    requestNotifications,
  } = useNotificationPermission();
  const [pods, setPods] = useState<Pod[]>([]);
  const [myPods, setMyPods] = useState<Pod[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [clubsToday, setClubsToday] = useState<ClubMeetingToday[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoaded(true);
      setRefreshing(false);
      return;
    }

    try {
      const [feed, mine, activityList, clubList] = await Promise.all([
        fetchFeed(
          userLocation
            ? { limit: 20, lat: userLocation.latitude, lng: userLocation.longitude }
            : { limit: 20 },
        ),
        getMyPods(),
        getActivities(),
        getClubsToday(),
      ]);
      setPods(feed);
      setMyPods(mine);
      setActivities(activityList);
      setClubsToday(clubList);
      setLoadWarning(null);
    } catch {
      setLoadWarning("Couldn't refresh — pull to retry.");
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, [token, userLocation]);

  const explainAndRequestLocation = useCallback(() => {
    Alert.alert(
      'Use campus location?',
      'Bridge uses your location only to sort nearby pods and show useful distances on campus.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            void requestLocation().then((allowed) => {
              if (!allowed) {
                Alert.alert(
                  'Location is off',
                  'You can still use Bridge. Turn on location later if you want nearby pod sorting.',
                );
              }
            });
          },
        },
      ],
    );
  }, [requestLocation]);

  const explainAndRequestNotifications = useCallback(() => {
    const needsSettings = !canAskForNotifications;
    Alert.alert(
      needsSettings ? 'Turn on Bridge alerts' : 'Stay ahead of plans?',
      needsSettings
        ? 'Notifications are off for Bridge. Open Settings to turn on meetup reminders, messages, and waitlist updates.'
        : 'Bridge can alert you about meetup reminders, new messages, and waitlist openings. You can change each category later in Privacy & Data.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: needsSettings ? 'Open Settings' : 'Continue',
          onPress: () => {
            if (needsSettings) {
              void Linking.openSettings();
              return;
            }
            void requestNotifications().then((allowed) => {
              if (!allowed) {
                Alert.alert(
                  'Alerts are off',
                  'No problem. Bridge still works normally without notifications.',
                );
              }
            });
          },
        },
      ],
    );
  }, [canAskForNotifications, requestNotifications]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const featuredActivities = useMemo(
    () => getFeaturedActivities(activities, pods),
    [activities, pods],
  );
  const activePods = useMemo(
    () => sortUpcomingPods(pods).filter((pod) => pod.status === 'FORMING').slice(0, 4),
    [pods],
  );
  const openPodCount = useMemo(
    () => pods.filter((pod) => pod.status === 'FORMING').length,
    [pods],
  );
  const mappablePods = useMemo(
    () => pods.filter((pod) => pod.latitude != null && pod.longitude != null).slice(0, 10),
    [pods],
  );
  const yourNextPod = useMemo(
    () =>
      sortUpcomingPods(myPods).find((pod) => pod.status === 'FORMING' || pod.status === 'LOCKED') ??
      null,
    [myPods],
  );
  const agendaItems = useMemo(() => {
    const podItems = sortUpcomingPods(myPods)
      .filter((pod) => pod.status === 'FORMING' || pod.status === 'LOCKED')
      .slice(0, 3)
      .map((pod) => ({
        id: `pod-${pod.id}`,
        time: pod.meetupTime,
        title: pod.activity?.title ?? 'Pod',
        detail: pod.location,
        kind: 'pod' as const,
        onPress: () => navigation.navigate('PodDetail', { podId: pod.id }),
      }));

    const clubItems = clubsToday.slice(0, 3).map((meeting) => ({
      id: `club-${meeting.id}`,
      time: meeting.meetingTime,
      title: meeting.title,
      detail: `${meeting.clubName} • ${meeting.location}`,
      kind: 'club' as const,
      onPress: () =>
        navigation.navigate('ClubMeeting', {
          clubId: meeting.clubId,
          meetingId: meeting.id,
        }),
    }));

    return [...podItems, ...clubItems]
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .slice(0, 4);
  }, [clubsToday, myPods, navigation]);

  const firstName = (user?.firstName ?? user?.name?.split(' ')[0] ?? 'friend').toUpperCase();

  return (
    <AppBackdrop>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        {/* Masthead */}
        <Animated.View entering={FadeInDown.duration(motion.durBase)}>
          <View style={styles.masthead}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.kicker, { color: colors.primary }]}>{datelineForNow()}</Text>
              <Text style={styles.greeting} numberOfLines={2}>
                {greetingForNow()},{'\n'}
                {firstName}.
              </Text>
            </View>
            <Slab
              onPress={() => navigation.navigate('Profile')}
              radius={radii.md}
              tilt={2}
              faceStyle={{ padding: 3 }}
              accessibilityLabel="Open profile"
            >
              <Avatar name={user?.name ?? 'User'} uri={user?.avatarUrl} size={48} />
            </Slab>
          </View>
        </Animated.View>
        {loadWarning ? <Banner message={loadWarning} kind="info" /> : null}

        {/* Pulse — a single calm glass stat strip */}
        <Animated.View
          entering={FadeInDown.delay(motion.stagger).duration(motion.durBase)}
          style={styles.pulseRow}
        >
          <Card padded faceStyle={styles.pulseStrip}>
            <Pressable
              onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
              accessibilityRole="button"
              accessibilityLabel={`${openPodCount} pods open now`}
              style={({ pressed }) => [styles.pulseCol, pressed && { opacity: 0.6 }]}
            >
              <View style={styles.pulseValueRow}>
                <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.pulseNumber, { color: colors.primary }]}>
                  {loaded ? openPodCount : '–'}
                </Text>
              </View>
              <Text style={[styles.pulseLabel, { color: colors.sub }]}>Pods open now</Text>
            </Pressable>
            <View style={[styles.pulseDivide, { backgroundColor: colors.border }]} />
            <Pressable
              onPress={() => navigation.navigate('ClubMeetingsTonight')}
              accessibilityRole="button"
              accessibilityLabel={`${clubsToday.length} club meetings today`}
              style={({ pressed }) => [styles.pulseCol, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.pulseNumber, { color: colors.ink }]}>
                {loaded ? clubsToday.length : '–'}
              </Text>
              <Text style={[styles.pulseLabel, { color: colors.sub }]}>Meetings today</Text>
            </Pressable>
          </Card>
        </Animated.View>

        {/* Permission nudges */}
        {(!granted && canAskAgain) || (notificationPermissionLoaded && !notificationsGranted) ? (
          <Animated.View
            entering={FadeInDown.delay(motion.stagger * 2).duration(motion.durBase)}
            style={styles.nudgeRow}
          >
            {!granted && canAskAgain ? (
              <Chip
                label="Turn on nearby"
                icon="navigate"
                onPress={explainAndRequestLocation}
                tint={colors.tealSoft}
                selected
              />
            ) : null}
            {notificationPermissionLoaded && !notificationsGranted ? (
              <Chip
                label="Turn on alerts"
                icon="notifications"
                onPress={explainAndRequestNotifications}
                tint={colors.amberSoft}
                selected
              />
            ) : null}
          </Animated.View>
        ) : null}

        {/* Today's agenda */}
        <Animated.View
          entering={FadeInDown.delay(motion.stagger * 2).duration(motion.durBase)}
          style={styles.section}
        >
          <SectionHeader kicker="The lineup" title="Your day" />
          {agendaItems.length ? (
            <Card padded>
              {agendaItems.map((item, index) => (
                <View key={item.id}>
                  <Slab
                    onPress={item.onPress}
                    raised={false}
                    color="transparent"
                    borderColor="transparent"
                    faceStyle={styles.agendaRow}
                    accessibilityLabel={`${item.title} at ${formatTime(item.time)}`}
                  >
                    <View style={[styles.agendaTime, { backgroundColor: item.kind === 'pod' ? colors.primarySoft : colors.violetSoft }]}>
                      <Text style={styles.agendaTimeText}>{formatTime(item.time)}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={typography.heading} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={typography.caption} numberOfLines={1}>
                        {item.detail}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={colors.faint} />
                  </Slab>
                  {index < agendaItems.length - 1 ? (
                    <View style={[styles.agendaDivider, { borderColor: colors.borderSoft }]} />
                  ) : null}
                </View>
              ))}
            </Card>
          ) : (
            <Card padded>
              <View style={{ gap: spacing.md }}>
                <Sticker label="Blank slate" tint={colors.amberSoft} tilt={-2} icon="cafe" />
                <Text style={typography.title}>Nothing on the board. Yet.</Text>
                <Text style={typography.caption}>
                  Campus is full of reasons to leave your room — go find one.
                </Text>
                <Button
                  label="Find tonight's plan"
                  icon="sparkles"
                  onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
                />
              </View>
            </Card>
          )}
        </Animated.View>

        {/* Live campus map */}
        <Animated.View
          entering={FadeInDown.delay(motion.stagger * 3).duration(motion.durBase)}
          style={styles.section}
        >
          <SectionHeader kicker="Live" title="On the map" />
          {mappablePods.length ? (
            <Card padded={false}>
              <MapView
                provider={PROVIDER_DEFAULT}
                style={styles.map}
                initialRegion={{ ...OSU_CAMPUS_CENTER, ...OSU_CAMPUS_DELTA }}
                scrollEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Polygon
                  coordinates={OSU_CAMPUS_POLYGON}
                  fillColor="rgba(200,16,46,0.06)"
                  strokeColor="rgba(200,16,46,0.3)"
                />
                {mappablePods.map((pod) => (
                  <Marker
                    key={pod.id}
                    coordinate={{ latitude: pod.latitude ?? 0, longitude: pod.longitude ?? 0 }}
                    title={pod.activity?.title ?? 'Pod'}
                    description={pod.location}
                    onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                  />
                ))}
              </MapView>
              <View style={[styles.mapFooter, { borderTopColor: colors.border }]}>
                <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
                <Text style={typography.caption}>Tap a pin to jump into that pod.</Text>
              </View>
            </Card>
          ) : (
            <EmptyState
              icon="map"
              title="No live pins yet"
              body="Start or join a pod and the campus map lights up."
              actionLabel="Explore activities"
              onAction={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
            />
          )}
        </Animated.View>

        {/* Your next move */}
        <Animated.View
          entering={FadeInDown.delay(motion.stagger * 4).duration(motion.durBase)}
          style={styles.section}
        >
          <SectionHeader
            kicker="Locked in"
            title="Your next move"
            actionLabel="All pods"
            onAction={() => navigation.navigate('MainTabs', { screen: 'Pods' })}
          />
          {!loaded ? (
            <SkeletonCard />
          ) : yourNextPod ? (
            <Slab
              onPress={() => navigation.navigate('PodDetail', { podId: yourNextPod.id })}
              color={colors.primary}
              radius={radii.lg}
              faceStyle={styles.nextPodFace}
              accessibilityLabel={yourNextPod.activity?.title ?? 'Upcoming pod'}
            >
              <View style={styles.nextPodTop}>
                <Sticker
                  label={formatDateTime(yourNextPod.meetupTime)}
                  tint={colors.surface}
                  tilt={-1.5}
                  icon="time"
                />
                <View style={styles.nextPodCount}>
                  <Ionicons name="people" size={14} color={colors.onPrimary} />
                  <Text style={[styles.nextPodCountText, { color: colors.onPrimary }]}>
                    {yourNextPod.members.length}/{yourNextPod.maxMembers}
                  </Text>
                </View>
              </View>
              <Text style={[styles.nextPodTitle, { color: colors.onPrimary }]} numberOfLines={2}>
                {(yourNextPod.activity?.title ?? 'Upcoming pod').toUpperCase()}
              </Text>
              <View style={styles.nextPodLocation}>
                <Ionicons name="location" size={14} color={colors.onPrimary} />
                <Text style={[typography.bodyMedium, { color: colors.onPrimary, flex: 1 }]} numberOfLines={1}>
                  {yourNextPod.location}
                </Text>
              </View>
            </Slab>
          ) : (
            <EmptyState
              icon="flash"
              title="No pod lined up yet"
              body="Jump into the live campus flow from Explore, or start your own."
            />
          )}
        </Animated.View>

        {/* Open pods feed */}
        <Animated.View
          entering={FadeInDown.delay(motion.stagger * 5).duration(motion.durBase)}
          style={styles.section}
        >
          <SectionHeader
            kicker="Fresh"
            title="Open pods"
            actionLabel="Explore"
            onAction={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
          />
          {!loaded ? (
            <>
              <SkeletonCard compact />
              <SkeletonCard compact />
            </>
          ) : activePods.length ? (
            activePods.map((pod) => (
              <Slab
                key={pod.id}
                onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                faceStyle={styles.podRowFace}
                accessibilityLabel={pod.activity?.title ?? 'Pod'}
              >
                <View style={[styles.podTimeBlock, { backgroundColor: accentForSeed(colors, pod.activity?.title ?? pod.id).soft, borderColor: colors.border }]}>
                  <Text style={styles.podTimeText}>{formatTime(pod.meetupTime)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={typography.heading} numberOfLines={1}>
                    {pod.activity?.title ?? 'Pod'}
                  </Text>
                  <View style={styles.inlineMeta}>
                    <Ionicons name="location" size={12} color={colors.faint} />
                    <Text style={typography.caption} numberOfLines={1}>
                      {pod.location}
                    </Text>
                  </View>
                </View>
                <Ionicons name="arrow-forward" size={16} color={colors.faint} />
              </Slab>
            ))
          ) : (
            <EmptyState
              icon="moon"
              title="The feed is quiet"
              body="When new pods spin up, they land here first."
            />
          )}
        </Animated.View>

        {/* Activity rail */}
        <Animated.View
          entering={FadeInDown.delay(motion.stagger * 6).duration(motion.durBase)}
          style={styles.section}
        >
          <SectionHeader kicker="Jump in" title="Activities with open pods" />
          {!loaded ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <SkeletonCard compact style={{ flex: 1 }} />
              <SkeletonCard compact style={{ flex: 1 }} />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
            >
              {featuredActivities.map((activity, index) => {
                const accent = accentForSeed(colors, activity.category ?? activity.title);
                const meta = CATEGORY_META[activity.category];
                return (
                  <Slab
                    key={activity.id}
                    onPress={() => navigation.navigate('ActivityPods', { activity })}
                    color={accent.soft}
                    tilt={index % 2 === 0 ? -0.8 : 0.8}
                    style={styles.activityCard}
                    faceStyle={styles.activityFace}
                    accessibilityLabel={activity.title}
                  >
                    <View style={styles.activityTop}>
                      <View style={[styles.activityIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Ionicons name={meta?.icon ?? 'sparkles-outline'} size={19} color={accent.tint} />
                      </View>
                      <Sticker label={activity.category ?? 'Activity'} tint={colors.surface} small tilt={2} />
                    </View>
                    <Text style={typography.heading} numberOfLines={1}>
                      {activity.title}
                    </Text>
                    <Text style={typography.caption} numberOfLines={2}>
                      {activity.description}
                    </Text>
                  </Slab>
                );
              })}
            </ScrollView>
          )}
        </Animated.View>

        {/* Clubs today */}
        <Animated.View
          entering={FadeInDown.delay(motion.stagger * 7).duration(motion.durBase)}
          style={styles.section}
        >
          <SectionHeader kicker="IRL" title="Club meetings today" />
          {!loaded ? (
            <>
              <SkeletonCard compact />
              <SkeletonCard compact />
            </>
          ) : clubsToday.length ? (
            clubsToday.slice(0, 4).map((meeting) => (
              <Slab
                key={meeting.id}
                onPress={() =>
                  navigation.navigate('ClubMeeting', {
                    clubId: meeting.clubId,
                    meetingId: meeting.id,
                  })
                }
                faceStyle={styles.podRowFace}
                accessibilityLabel={meeting.title}
              >
                <View style={[styles.podTimeBlock, { backgroundColor: colors.violetSoft, borderColor: colors.border }]}>
                  <Text style={styles.podTimeText}>{formatTime(meeting.meetingTime)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={typography.heading} numberOfLines={1}>
                    {meeting.title}
                  </Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {meeting.clubName} • {meeting.location}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={colors.faint} />
              </Slab>
            ))
          ) : (
            <EmptyState
              icon="megaphone"
              title="No club meetings today"
              body="When leaders schedule meetings, they show up here."
            />
          )}
        </Animated.View>
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: DOCK_CLEARANCE,
    gap: spacing.xl,
  },
  masthead: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.lg,
  },
  greeting: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: t.colors.ink,
    marginTop: 4,
  },
  pulseRow: {
    alignSelf: 'stretch' as const,
  },
  pulseStrip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  pulseCol: {
    flex: 1,
    gap: 4,
  },
  pulseValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
  },
  pulseDivide: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch' as const,
    marginHorizontal: spacing.lg,
  },
  pulseNumber: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  pulseLabel: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 16,
  },
  nudgeRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  section: {
    gap: spacing.md,
  },
  agendaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  agendaTime: {
    minWidth: 72,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: radii.xs,
    borderWidth: BORDER_W,
    borderColor: t.colors.border,
    alignItems: 'center' as const,
  },
  agendaTimeText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: t.colors.ink,
  },
  agendaDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  map: {
    height: 200,
  },
  mapFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: BORDER_W,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nextPodFace: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  nextPodTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
    flexShrink: 1,
  },
  nextPodCount: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  nextPodCountText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  nextPodTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.5,
  },
  nextPodLocation: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  podRowFace: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    padding: spacing.md,
  },
  podTimeBlock: {
    minWidth: 70,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radii.xs,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
  },
  podTimeText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: t.colors.ink,
  },
  inlineMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  rail: {
    paddingRight: spacing.xl,
    paddingVertical: 4,
    gap: spacing.md,
  },
  activityCard: {
    width: 250,
  },
  activityFace: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  activityTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 2,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
}));
