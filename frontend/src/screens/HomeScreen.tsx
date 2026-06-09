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
  Hero,
  Panel,
  PrimaryButton,
  Screen,
  SectionHeader,
  SkeletonCard,
  Tap,
  UserAvatar,
} from '../components/ui';
import { OSU_CAMPUS_CENTER, OSU_CAMPUS_DELTA, OSU_CAMPUS_POLYGON } from '../constants/campusMap';
import { Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';
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
  const [agendaExpanded, setAgendaExpanded] = useState(false);

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
        <Entrance index={0}>
          <View style={styles.greetingRow}>
            <View style={styles.greetingCopy}>
              <Text style={styles.greetingEyebrow}>Today on campus</Text>
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
              <UserAvatar name={user?.name ?? 'User'} avatarUrl={user?.avatarUrl} size={42} ring />
            </Tap>
          </View>
        </Entrance>

        {(!granted && canAskAgain) || (notificationPermissionLoaded && !notificationsGranted) ? (
          <Entrance index={1}>
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

        <Entrance index={1}>
          <Hero
            eyebrow="Your day"
            title={agendaItems.length ? 'You have plans brewing.' : 'A blank slate kind of day.'}
            subtitle="A quick read on what you have lined up and what campus is doing around you."
          >
            <View style={styles.heroAgenda}>
              <TouchableOpacity
                style={styles.agendaToggle}
                activeOpacity={0.9}
                onPress={() => setAgendaExpanded((current) => !current)}
              >
                <View style={styles.agendaHeading}>
                  <View style={styles.agendaIcon}>
                    <Ionicons name="calendar-outline" size={16} color="#FFB38A" />
                  </View>
                  <View style={styles.agendaCopy}>
                    <Text style={styles.agendaTitle}>Today&apos;s plan</Text>
                    <Text style={styles.agendaBody}>
                      {agendaItems.length
                        ? `${agendaItems[0].kind === 'pod' ? 'Next pod' : 'Next meeting'} at ${formatTime(agendaItems[0].time)}`
                        : 'Nothing scheduled yet'}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={agendaExpanded ? 'remove-outline' : 'add-outline'}
                  size={20}
                  color="rgba(255,255,255,0.9)"
                />
              </TouchableOpacity>

              {agendaExpanded ? (
                agendaItems.length ? (
                  <View style={styles.agendaList}>
                    {agendaItems.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.agendaItem}
                        onPress={item.onPress}
                        activeOpacity={0.85}
                      >
                        <View style={styles.agendaTimePill}>
                          <Text style={styles.agendaTime}>{formatTime(item.time)}</Text>
                        </View>
                        <View style={styles.feedText}>
                          <Text style={styles.agendaItemTitle}>{item.title}</Text>
                          <Text style={styles.agendaItemBody} numberOfLines={1}>{item.detail}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.agendaEmpty}>
                    <Text style={styles.agendaItemBody}>No plans on the board yet. Explore to find something worth showing up for.</Text>
                  </View>
                )
              ) : null}
            </View>
          </Hero>
        </Entrance>

        <Entrance index={2}>
          {mappablePods.length ? (
            <Panel style={styles.mapPanel}>
              <View style={styles.mapHeader}>
                <View>
                  <Text style={styles.mapTitle}>Campus activity map</Text>
                  <Text style={styles.mapBody}>Tap a pod marker to navigate to its detail.</Text>
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

        <Entrance index={3} style={styles.section}>
          <SectionHeader
            title="Your next move"
            actionLabel="All pods"
            onActionPress={() => navigation.navigate('MainTabs', { screen: 'Pods' })}
          />
          {!loaded ? (
            <SkeletonCard />
          ) : yourNextPod ? (
            <Panel onPress={() => navigation.navigate('PodDetail', { podId: yourNextPod.id })}>
              <View style={styles.nextPodTop}>
                <View style={styles.timeBadge}>
                  <Ionicons name="time-outline" size={13} color={colors.primarySoftText} />
                  <Text style={styles.timeBadgeLabel}>{formatDateTime(yourNextPod.meetupTime)}</Text>
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
            </Panel>
          ) : (
            <EmptyState icon="sparkles-outline" title="No pod lined up yet" body="Use Explore to jump into the live campus flow or start one from an activity page." />
          )}
        </Entrance>

        <Entrance index={4} style={styles.section}>
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
                <View style={styles.feedText}>
                  <Text style={styles.cardTitle}>{pod.activity?.title ?? 'Pod'}</Text>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={14} color={colors.faint} />
                    <Text style={styles.cardBody} numberOfLines={1}>{pod.location}</Text>
                  </View>
                </View>
                <View style={styles.feedTimePill}>
                  <Text style={styles.feedMeta}>{formatTime(pod.meetupTime)}</Text>
                </View>
              </View>
            </Tap>
          )) : <EmptyState icon="moon-outline" title="The feed is quiet" body="When new pods spin up, they’ll land here first." />}
        </Entrance>

        <Entrance index={5} style={styles.section}>
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
                return (
                  <Tap
                    key={activity.id}
                    style={styles.activityCard}
                    onPress={() => navigation.navigate('ActivityPods', { activity })}
                    accessibilityLabel={activity.title}
                  >
                    <View style={[styles.categoryPill, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.categoryPillLabel, { color: tone.text }]}>{activity.category}</Text>
                    </View>
                    <Text style={styles.cardTitle}>{activity.title}</Text>
                    <Text style={styles.cardBody} numberOfLines={2}>{activity.description}</Text>
                  </Tap>
                );
              })}
            </ScrollView>
          )}
        </Entrance>

        <Entrance index={6} style={styles.section}>
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
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  greetingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.md,
    paddingHorizontal: 2,
    minHeight: 50,
  },
  greetingCopy: {
    flex: 1,
    gap: 2,
  },
  greetingEyebrow: {
    ...t.typography.label,
    color: t.colors.primary,
  },
  greeting: {
    ...t.typography.h1,
    fontSize: 25,
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
  heroAgenda: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  agendaToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: spacing.sm,
  },
  agendaHeading: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    flex: 1,
  },
  agendaIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(242,62,22,0.22)',
  },
  agendaCopy: {
    flex: 1,
    gap: 2,
  },
  agendaTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  agendaBody: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.68)',
  },
  agendaList: {
    gap: spacing.xs,
  },
  agendaItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  agendaTimePill: {
    minWidth: 62,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,138,61,0.22)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    alignItems: 'center' as const,
  },
  agendaTime: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: '#FFB38A',
  },
  agendaItemTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14.5,
    color: '#FFFFFF',
  },
  agendaItemBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.66)',
  },
  agendaEmpty: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radii.md,
    padding: spacing.sm,
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
    height: 220,
    borderRadius: radii.md,
    overflow: 'hidden' as const,
  },
  section: {
    gap: spacing.sm,
  },
  nextPodTop: {
    flexDirection: 'row' as const,
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
    justifyContent: 'space-between' as const,
    gap: spacing.md,
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
