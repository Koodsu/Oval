import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from '../components/CampusMap';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { fetchFeed, getActivities, getApiErrorMessage, getClubsToday, getMyPods } from '../api';
import { useAuth } from '../context/AuthContext';
import { Activity, ClubMeetingToday, Pod } from '../types';
import { RootStackParamList } from '../../App';
import {
  Entrance,
  EmptyState,
  GradientEdgeCard,
  Hero,
  LiveDot,
  Panel,
  PrimaryButton,
  Screen,
  SectionHeader,
  SkeletonCard,
  Tap,
  UserAvatar,
} from '../components/ui';
import { OSU_CAMPUS_CENTER, OSU_CAMPUS_DELTA, OSU_CAMPUS_POLYGON } from '../constants/campusMap';
import { CATEGORY_META } from '../constants/categories';
import { DOCK_CLEARANCE, Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';
import { formatDateTime, formatTime } from '../utils/format';
import { getFeaturedActivities, sortUpcomingPods } from '../utils/experience';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { useNotificationPermission } from '../hooks/useNotificationPermission';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function datelineForNow(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

const CATEGORY_TONES = ['violet', 'teal', 'amber', 'pink', 'blue', 'green'] as const;

function categoryTone(theme: Theme, category: string | undefined) {
  const key = CATEGORY_TONES[
    Math.abs(
      (category ?? '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
    ) % CATEGORY_TONES.length
  ];
  return {
    text: theme.colors[key],
    bg: theme.colors[`${key}Soft` as const],
  };
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user, token } = useAuth();
  const theme = useTheme();
  const { colors } = theme;
  const styles = useStyles();
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
            : { limit: 20 }
        ),
        getMyPods(),
        getActivities(),
        getClubsToday(),
      ]);
      setPods(feed);
      setMyPods(mine);
      setActivities(activityList);
      setClubsToday(clubList);
    } catch (error) {
      Alert.alert('Could not load home', getApiErrorMessage(error));
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
                Alert.alert('Location is off', 'You can still use Bridge. Turn on location later if you want nearby pod sorting.');
              }
            });
          },
        },
      ]
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
                Alert.alert('Alerts are off', 'No problem. Bridge still works normally without notifications.');
              }
            });
          },
        },
      ]
    );
  }, [canAskForNotifications, requestNotifications]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const featuredActivities = useMemo(() => getFeaturedActivities(activities, pods), [activities, pods]);
  const activePods = useMemo(() => sortUpcomingPods(pods).filter((pod) => pod.status === 'FORMING').slice(0, 4), [pods]);
  const openPodCount = useMemo(() => pods.filter((pod) => pod.status === 'FORMING').length, [pods]);
  const mappablePods = useMemo(
    () => pods.filter((pod) => pod.latitude != null && pod.longitude != null).slice(0, 10),
    [pods]
  );
  const yourNextPod = useMemo(() => sortUpcomingPods(myPods).find((pod) => pod.status === 'FORMING' || pod.status === 'LOCKED') ?? null, [myPods]);
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
      onPress: () => navigation.navigate('ClubDetail', { clubId: meeting.clubId }),
    }));

    return [...podItems, ...clubItems]
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .slice(0, 4);
  }, [clubsToday, myPods, navigation]);

  const firstName = user?.firstName ?? user?.name?.split(' ')[0] ?? 'friend';

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
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
        <Entrance index={0}>
          <View style={styles.masthead}>
            <View style={styles.mastheadCopy}>
              <Text style={styles.dateline}>{datelineForNow()}</Text>
              <Text style={styles.greeting} numberOfLines={1}>
                {greetingForNow()}, {firstName}
              </Text>
            </View>
            <Tap
              onPress={() => navigation.navigate('Profile')}
              haptic
              accessibilityLabel="Open profile"
              accessibilityHint="Opens your profile and settings"
            >
              <UserAvatar name={user?.name ?? 'User'} avatarUrl={user?.avatarUrl} size={44} ring />
            </Tap>
          </View>
        </Entrance>

        {/* Live campus pulse strip */}
        <Entrance index={1}>
          <View style={styles.pulseStrip}>
            <View style={styles.pulseCell}>
              <LiveDot size={7} />
              <Text style={styles.pulseText}>
                {loaded ? `${openPodCount} pod${openPodCount === 1 ? '' : 's'} open now` : 'Reading campus…'}
              </Text>
            </View>
            <View style={styles.pulseDivider} />
            <View style={styles.pulseCell}>
              <Ionicons name="calendar-outline" size={13} color={colors.violet} />
              <Text style={styles.pulseText}>
                {loaded ? `${clubsToday.length} club meeting${clubsToday.length === 1 ? '' : 's'} today` : '—'}
              </Text>
            </View>
          </View>
        </Entrance>

        {(!granted && canAskAgain) || (notificationPermissionLoaded && !notificationsGranted) ? (
          <Entrance index={2}>
            <View style={styles.utilityRow}>
              {!granted && canAskAgain ? (
                <TouchableOpacity
                  style={styles.permissionChip}
                  activeOpacity={0.86}
                  onPress={explainAndRequestLocation}
                  accessibilityRole="button"
                  accessibilityLabel="Use campus location"
                  accessibilityHint="Explains why Bridge wants location before asking for permission"
                >
                  <Ionicons name="navigate-outline" size={15} color={colors.primary} />
                  <Text style={styles.permissionChipLabel}>Turn on nearby</Text>
                </TouchableOpacity>
              ) : null}
              {notificationPermissionLoaded && !notificationsGranted ? (
                <TouchableOpacity
                  style={styles.permissionChip}
                  activeOpacity={0.86}
                  onPress={explainAndRequestNotifications}
                  accessibilityRole="button"
                  accessibilityLabel="Turn on Bridge alerts"
                  accessibilityHint="Explains notification benefits before asking for permission"
                >
                  <Ionicons name="notifications-outline" size={15} color={colors.primary} />
                  <Text style={styles.permissionChipLabel}>Turn on alerts</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Entrance>
        ) : null}

        {/* Tonight, as a timeline */}
        <Entrance index={2}>
          <Hero
            eyebrow="Today's plan"
            title={agendaItems.length ? 'You have plans brewing.' : 'A blank slate kind of day.'}
            subtitle={
              agendaItems.length
                ? undefined
                : 'Nothing on the board yet — campus is full of reasons to leave your room.'
            }
          >
            {agendaItems.length ? (
              <View style={styles.timeline}>
                {agendaItems.map((item, itemIndex) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.timelineRow}
                    onPress={item.onPress}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title} at ${formatTime(item.time)}`}
                  >
                    <Text style={styles.timelineTime}>{formatTime(item.time)}</Text>
                    <View style={styles.timelineSpine}>
                      <View style={styles.timelineNode} />
                      {itemIndex < agendaItems.length - 1 ? (
                        <View style={styles.timelineTrack} />
                      ) : null}
                    </View>
                    <View style={styles.timelineBody}>
                      <Text style={styles.timelineTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.timelineDetail} numberOfLines={1}>{item.detail}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.45)" />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.heroAction}>
                <PrimaryButton
                  label="Find tonight's plan"
                  icon="sparkles-outline"
                  onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
                />
              </View>
            )}
          </Hero>
        </Entrance>

        {/* Campus map */}
        <Entrance index={3}>
          {mappablePods.length ? (
            <Panel style={styles.mapPanel}>
              <View style={styles.mapHeader}>
                <View style={styles.mapHeading}>
                  <View style={styles.mapTitleRow}>
                    <LiveDot size={7} color={colors.primary} />
                    <Text style={styles.mapTitle}>Live on campus</Text>
                  </View>
                  <Text style={styles.mapBody}>Tap a pin to jump into that pod.</Text>
                </View>
                <View style={styles.mapIconBadge}>
                  <Ionicons name="navigate-outline" size={18} color={colors.primary} />
                </View>
              </View>
              <MapView
                provider={PROVIDER_DEFAULT}
                style={styles.map}
                initialRegion={{ ...OSU_CAMPUS_CENTER, ...OSU_CAMPUS_DELTA }}
                scrollEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Polygon coordinates={OSU_CAMPUS_POLYGON} fillColor="rgba(239,62,27,0.06)" strokeColor="rgba(239,62,27,0.25)" />
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
            </Panel>
          ) : (
            <Panel style={styles.mapEmptyPanel}>
              <View style={styles.mapEmptyIcon}>
                <Ionicons name="map-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.mapEmptyCopy}>
                <Text style={styles.mapTitle}>No live campus pins yet</Text>
                <Text style={styles.mapBody}>Start or join a pod and the activity map will come alive here.</Text>
              </View>
              <PrimaryButton
                label="Explore activities"
                onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
                kind="soft"
              />
            </Panel>
          )}
        </Entrance>

        {/* Your next move */}
        <Entrance index={4} style={styles.section}>
          <SectionHeader
            title="Your next move"
            actionLabel="All pods"
            onActionPress={() => navigation.navigate('MainTabs', { screen: 'Pods' })}
          />
          {!loaded ? (
            <SkeletonCard />
          ) : yourNextPod ? (
            <GradientEdgeCard
              onPress={() => navigation.navigate('PodDetail', { podId: yourNextPod.id })}
              accessibilityLabel={yourNextPod.activity?.title ?? 'Upcoming pod'}
            >
              <View style={styles.nextPodTop}>
                <View style={styles.timeBadge}>
                  <Ionicons name="time-outline" size={13} color={colors.primarySoftText} />
                  <Text style={styles.timeBadgeLabel}>{formatDateTime(yourNextPod.meetupTime)}</Text>
                </View>
                <View style={styles.nextPodCount}>
                  <Ionicons name="people-outline" size={13} color={colors.faint} />
                  <Text style={styles.nextPodCountText}>
                    {yourNextPod.members.length}/{yourNextPod.maxMembers}
                  </Text>
                </View>
              </View>
              <Text style={styles.nextPodTitle}>{yourNextPod.activity?.title ?? 'Upcoming pod'}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={15} color={colors.faint} />
                <Text style={styles.cardBody}>{yourNextPod.location}</Text>
              </View>
              <View style={styles.inlineAction}>
                <PrimaryButton label="Open pod" icon="arrow-forward" onPress={() => navigation.navigate('PodDetail', { podId: yourNextPod.id })} />
              </View>
            </GradientEdgeCard>
          ) : (
            <EmptyState icon="sparkles-outline" title="No pod lined up yet" body="Use Explore to jump into the live campus flow or start one from an activity page." />
          )}
        </Entrance>

        {/* Open pods */}
        <Entrance index={5} style={styles.section}>
          <SectionHeader title="Open pods" actionLabel="Explore" onActionPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })} />
          {!loaded ? (
            <>
              <SkeletonCard compact />
              <SkeletonCard compact />
            </>
          ) : activePods.length ? activePods.map((pod) => (
            <Tap
              key={pod.id}
              style={styles.feedCard}
              onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
              accessibilityLabel={pod.activity?.title ?? 'Pod'}
            >
              <View style={styles.feedRow}>
                <View style={styles.feedTimeRail}>
                  <Text style={styles.feedTimeText}>{formatTime(pod.meetupTime)}</Text>
                </View>
                <View style={styles.feedText}>
                  <Text style={styles.cardTitle}>{pod.activity?.title ?? 'Pod'}</Text>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={14} color={colors.faint} />
                    <Text style={styles.cardBody} numberOfLines={1}>{pod.location}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.faint} />
              </View>
            </Tap>
          )) : <EmptyState icon="moon-outline" title="The feed is quiet" body="When new pods spin up, they’ll land here first." />}
        </Entrance>

        {/* Activity rail */}
        <Entrance index={6} style={styles.section}>
          <SectionHeader title="Activities with open pods" />
          {!loaded ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[0, 1, 2].map((item) => (
                <View key={item} style={styles.activityCard}>
                  <SkeletonCard compact />
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activityRail}>
              {featuredActivities.map((activity) => {
                const tone = categoryTone(theme, activity.category);
                const meta = CATEGORY_META[activity.category];
                return (
                  <Tap
                    key={activity.id}
                    style={styles.activityCard}
                    onPress={() => navigation.navigate('ActivityPods', { activity })}
                    accessibilityLabel={activity.title}
                  >
                    <View style={styles.activityTopRow}>
                      <View style={[styles.activityIcon, { backgroundColor: tone.bg }]}>
                        <Ionicons name={meta?.icon ?? 'sparkles-outline'} size={18} color={tone.text} />
                      </View>
                      <View style={[styles.categoryPill, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.categoryPillLabel, { color: tone.text }]}>{activity.category}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardTitle}>{activity.title}</Text>
                    <Text style={styles.cardBody} numberOfLines={2}>{activity.description}</Text>
                  </Tap>
                );
              })}
            </ScrollView>
          )}
        </Entrance>

        {/* Clubs today */}
        <Entrance index={7} style={styles.section}>
          <SectionHeader title="Club meetings today" />
          {!loaded ? (
            <>
              <SkeletonCard compact />
              <SkeletonCard compact />
            </>
          ) : clubsToday.length ? clubsToday.slice(0, 4).map((meeting) => (
            <Tap
              key={meeting.id}
              style={styles.clubRow}
              onPress={() => navigation.navigate('ClubDetail', { clubId: meeting.clubId })}
              accessibilityLabel={meeting.title}
            >
              <View style={styles.clubMeta}>
                <View style={styles.clubIcon}>
                  <Ionicons name="calendar-outline" size={20} color={colors.violet} />
                </View>
                <View style={styles.feedText}>
                  <Text style={styles.cardTitle}>{meeting.title}</Text>
                  <Text style={styles.cardBody} numberOfLines={1}>{meeting.clubName} • {meeting.location}</Text>
                </View>
              </View>
              <View style={styles.feedTimePill}>
                <Text style={styles.feedMeta}>{formatTime(meeting.meetingTime)}</Text>
              </View>
            </Tap>
          )) : <EmptyState icon="people-circle-outline" title="No club meetings today" body="Club meetings for today will appear here once leaders schedule them." />}
        </Entrance>
      </ScrollView>
    </Screen>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingTop: spacing.sm,
    paddingBottom: DOCK_CLEARANCE,
    gap: spacing.md,
  },
  masthead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.md,
    paddingHorizontal: 2,
    minHeight: 54,
  },
  mastheadCopy: {
    flex: 1,
    gap: 3,
  },
  dateline: {
    ...t.typography.label,
    color: t.colors.primary,
  },
  greeting: {
    ...t.typography.display,
    fontSize: 28,
    lineHeight: 34,
  },
  pulseStrip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    backgroundColor: t.colors.glass,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...t.shadows.subtle,
  },
  pulseCell: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    flexShrink: 1,
  },
  pulseDivider: {
    width: 1,
    height: 14,
    backgroundColor: t.colors.borderStrong,
  },
  pulseText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: t.colors.sub,
    flexShrink: 1,
  },
  utilityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
  },
  permissionChip: {
    height: 36,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: t.colors.primarySoft,
  },
  permissionChipLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: t.colors.primarySoftText,
  },
  timeline: {
    marginTop: spacing.md,
  },
  timelineRow: {
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    gap: spacing.sm,
  },
  timelineTime: {
    width: 64,
    paddingTop: 1,
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.4,
    color: '#FFB38A',
    textAlign: 'right' as const,
  },
  timelineSpine: {
    width: 12,
    alignItems: 'center' as const,
  },
  timelineNode: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    backgroundColor: '#FF8A3D',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  timelineTrack: {
    flex: 1,
    width: 1.5,
    marginVertical: 3,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  timelineBody: {
    flex: 1,
    paddingBottom: spacing.md,
    gap: 2,
  },
  timelineTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14.5,
    color: '#FFFFFF',
  },
  timelineDetail: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.62)',
  },
  heroAction: {
    marginTop: spacing.md,
    alignSelf: 'flex-start' as const,
  },
  mapPanel: {
    gap: spacing.md,
  },
  mapEmptyPanel: {
    gap: spacing.sm,
  },
  mapEmptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.primarySoft,
  },
  mapEmptyCopy: {
    gap: 2,
  },
  mapHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
  },
  mapHeading: {
    flex: 1,
    gap: 2,
  },
  mapTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  mapIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.primarySoft,
  },
  mapTitle: {
    ...t.typography.title,
  },
  mapBody: {
    ...t.typography.body,
    maxWidth: '88%' as const,
  },
  map: {
    height: 210,
    borderRadius: radii.md,
    overflow: 'hidden' as const,
  },
  section: {
    gap: spacing.sm,
  },
  nextPodTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.sm,
  },
  timeBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: t.colors.primarySoft,
  },
  timeBadgeLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: t.colors.primarySoftText,
  },
  nextPodCount: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  nextPodCountText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: t.colors.sub,
  },
  nextPodTitle: {
    ...t.typography.h2,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  cardTitle: {
    ...t.typography.title,
  },
  cardBody: {
    ...t.typography.body,
    flexShrink: 1,
  },
  inlineAction: {
    marginTop: spacing.md,
  },
  feedCard: {
    backgroundColor: t.colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    ...t.shadows.subtle,
  },
  feedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  feedTimeRail: {
    minWidth: 64,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: radii.sm,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center' as const,
  },
  feedTimeText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: t.colors.primarySoftText,
  },
  feedText: {
    flex: 1,
    gap: 4,
  },
  feedTimePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: t.colors.primarySoft,
  },
  feedMeta: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: t.colors.primarySoftText,
  },
  activityRail: {
    paddingRight: spacing.md,
  },
  activityCard: {
    width: 260,
    marginRight: spacing.sm,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...t.shadows.subtle,
  },
  activityTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  categoryPill: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  categoryPillLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  clubRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.md,
    backgroundColor: t.colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    ...t.shadows.subtle,
  },
  clubMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    flex: 1,
  },
  clubIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.violetSoft,
  },
}));
