import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from '../components/CampusMap';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchFeed,
  getClubsToday,
  getFriends,
  getInboxSummary,
  getMyPods,
  InboxSummary,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { ClubMeetingToday, FriendUser, Pod } from '../types';
import { RootStackParamList } from '../../App';
import {
  AppBackdrop,
  Avatar,
  AvatarStack,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  SectionHeader,
  SkeletonCard,
  Slab,
} from '../components/ui';
import { OSU_CAMPUS_CENTER, OSU_CAMPUS_DELTA, OSU_CAMPUS_POLYGON } from '../constants/campusMap';
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
import { formatTime } from '../utils/format';
import { sortUpcomingPods } from '../utils/experience';
import { useJoinPod } from '../hooks/useJoinPod';
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

/** "TONIGHT'S BEST PICK" / "TODAY'S BEST PICK" / "TOMORROW'S BEST PICK" / "FRIDAY'S BEST PICK" */
function bestPickKicker(time: string, now = new Date()): string {
  const date = new Date(time);
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startDate.getTime() - startToday.getTime()) / (24 * 60 * 60 * 1000));
  if (dayDiff === 0) return date.getHours() < 17 ? 'TODAY’S BEST PICK' : 'TONIGHT’S BEST PICK';
  if (dayDiff === 1) return 'TOMORROW’S BEST PICK';
  return `${date.toLocaleDateString([], { weekday: 'long' }).toUpperCase()}’S BEST PICK`;
}

/** "starts in 45m" / "starts in 2h" / "starts Fri" */
function startsIn(time: string): string {
  const diffMs = new Date(time).getTime() - Date.now();
  const mins = Math.round(diffMs / 60000);
  if (mins <= 0) return 'starting now';
  if (mins < 60) return `starts in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours <= 24) return `starts in ${hours}h`;
  return `starts ${new Date(time).toLocaleDateString([], { weekday: 'short' })}`;
}

type HeroItem =
  | { kind: 'pod'; pod: Pod; mine: boolean }
  | { kind: 'meeting'; meeting: ClubMeetingToday };

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
  const [clubsToday, setClubsToday] = useState<ClubMeetingToday[]>([]);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [summary, setSummary] = useState<InboxSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const { join, busyPodId } = useJoinPod();

  const load = useCallback(async () => {
    if (!token) {
      setLoaded(true);
      setRefreshing(false);
      return;
    }

    const [feedResult, mineResult, clubResult, friendResult, summaryResult] =
      await Promise.allSettled([
        fetchFeed(
          userLocation
            ? { limit: 20, lat: userLocation.latitude, lng: userLocation.longitude }
            : { limit: 20 },
        ),
        getMyPods(),
        getClubsToday(),
        getFriends(),
        getInboxSummary(),
      ]);

    if (feedResult.status === 'fulfilled') setPods(feedResult.value);
    if (mineResult.status === 'fulfilled') setMyPods(mineResult.value);
    if (clubResult.status === 'fulfilled') setClubsToday(clubResult.value);
    if (friendResult.status === 'fulfilled') setFriends(friendResult.value);
    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);

    const coreFailed =
      feedResult.status === 'rejected' && mineResult.status === 'rejected';
    setLoadWarning(coreFailed ? "Couldn't refresh — pull to retry." : null);
    setLoaded(true);
    setRefreshing(false);
  }, [token, userLocation]);

  const explainAndRequestLocation = useCallback(() => {
    Alert.alert(
      'Use campus location?',
      'Oval uses your location only to sort nearby pods and show useful distances on campus.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            void requestLocation().then((allowed) => {
              if (!allowed) {
                Alert.alert(
                  'Location is off',
                  'You can still use Oval. Turn on location later if you want nearby pod sorting.',
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
      needsSettings ? 'Turn on Oval alerts' : 'Stay ahead of plans?',
      needsSettings
        ? 'Notifications are off for Oval. Open Settings to turn on meetup reminders, messages, and waitlist updates.'
        : 'Oval can alert you about meetup reminders, new messages, and waitlist openings. You can change each category later in Privacy & Data.',
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
                  'No problem. Oval still works normally without notifications.',
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

  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends]);

  const myNextPod = useMemo(
    () =>
      sortUpcomingPods(myPods).find(
        (pod) => pod.status === 'FORMING' || pod.status === 'LOCKED',
      ) ?? null,
    [myPods],
  );

  const nextMeeting = useMemo(() => {
    const upcoming = clubsToday
      .filter((meeting) => new Date(meeting.meetingTime).getTime() > Date.now() - 30 * 60000)
      .sort((a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime());
    return upcoming[0] ?? null;
  }, [clubsToday]);

  const joinablePods = useMemo(
    () =>
      sortUpcomingPods(pods).filter(
        (pod) =>
          pod.status === 'FORMING' &&
          pod.members.length < pod.maxMembers &&
          !pod.members.some((member) => member.userId === user?.id),
      ),
    [pods, user?.id],
  );

  // Hero: ONE next action. Your own soonest commitment wins; otherwise the
  // top-ranked joinable pod from the feed (interest-boosted server-side).
  const hero = useMemo<HeroItem | null>(() => {
    if (myNextPod && nextMeeting) {
      return new Date(myNextPod.meetupTime).getTime() <=
        new Date(nextMeeting.meetingTime).getTime()
        ? { kind: 'pod', pod: myNextPod, mine: true }
        : { kind: 'meeting', meeting: nextMeeting };
    }
    if (myNextPod) return { kind: 'pod', pod: myNextPod, mine: true };
    if (nextMeeting) return { kind: 'meeting', meeting: nextMeeting };
    if (joinablePods[0]) return { kind: 'pod', pod: joinablePods[0], mine: false };
    return null;
  }, [joinablePods, myNextPod, nextMeeting]);

  const heroPodId = hero?.kind === 'pod' ? hero.pod.id : null;
  const heroMeetingId = hero?.kind === 'meeting' ? hero.meeting.id : null;

  const openPodCount = useMemo(
    () => pods.filter((pod) => pod.status === 'FORMING').length,
    [pods],
  );

  const mappablePods = useMemo(
    () => pods.filter((pod) => pod.latitude != null && pod.longitude != null).slice(0, 10),
    [pods],
  );

  // Today: merged agenda minus whatever the hero already shows.
  const agendaItems = useMemo(() => {
    const podItems = sortUpcomingPods(myPods)
      .filter(
        (pod) =>
          (pod.status === 'FORMING' || pod.status === 'LOCKED') && pod.id !== heroPodId,
      )
      .slice(0, 4)
      .map((pod) => ({
        id: `pod-${pod.id}`,
        time: pod.meetupTime,
        title: pod.activity?.title ?? 'Pod',
        detail: pod.location,
        kind: 'pod' as const,
        onPress: () => navigation.navigate('PodDetail', { podId: pod.id }),
      }));

    const clubItems = clubsToday
      .filter((meeting) => meeting.id !== heroMeetingId)
      .slice(0, 4)
      .map((meeting) => ({
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
  }, [clubsToday, heroMeetingId, heroPodId, myPods, navigation]);

  // Happening soon: up to 3 joinable feed pods the hero isn't already showing.
  const happeningSoon = useMemo(
    () => joinablePods.filter((pod) => pod.id !== heroPodId).slice(0, 3),
    [heroPodId, joinablePods],
  );

  const friendsGoing = useCallback(
    (pod: Pod) => pod.members.filter((member) => friendIds.has(member.userId)),
    [friendIds],
  );

  const firstName = (user?.firstName ?? user?.name?.split(' ')[0] ?? 'friend').toUpperCase();
  const friendsTonight = summary?.friendsTonight ?? null;

  const openDiscover = useCallback(
    (startCreate?: boolean) =>
      navigation.navigate('MainTabs', {
        screen: 'Explore',
        params: startCreate ? { startCreate: Date.now() } : undefined,
      }),
    [navigation],
  );

  const renderHero = () => {
    if (!loaded) return <SkeletonCard />;
    if (!hero) {
      return (
        <EmptyState
          icon="flash"
          title="Nothing on the board. Yet."
          body="Campus is full of reasons to leave your room — start something in two taps."
          actionLabel="Start a pod"
          onAction={() => openDiscover(true)}
        />
      );
    }

    if (hero.kind === 'meeting') {
      const meeting = hero.meeting;
      return (
        <Slab
          onPress={() =>
            navigation.navigate('ClubMeeting', { clubId: meeting.clubId, meetingId: meeting.id })
          }
          color={colors.primary}
          radius={radii.lg}
          faceStyle={styles.heroFace}
          accessibilityLabel={`${meeting.title}, ${startsIn(meeting.meetingTime)}`}
        >
          <Text style={[styles.heroKicker, { color: colors.onPrimary }]}>
            YOUR NEXT MOVE · {formatTime(meeting.meetingTime)}
          </Text>
          <Text style={[styles.heroTitle, { color: colors.onPrimary }]} numberOfLines={2}>
            {meeting.title}
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.onPrimary }]} numberOfLines={1}>
            {meeting.clubName} · {meeting.location} · {startsIn(meeting.meetingTime)}
          </Text>
          <View style={styles.heroBottom}>
            <View style={{ flex: 1 }} />
            <View style={[styles.heroPill, { backgroundColor: colors.onPrimary }]}>
              <Text style={[styles.heroPillText, { color: colors.primary }]}>Open</Text>
            </View>
          </View>
        </Slab>
      );
    }

    const pod = hero.pod;
    const going = friendsGoing(pod);
    const spotsLeft = Math.max(0, pod.maxMembers - pod.members.length);
    return (
      <Slab
        onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
        color={colors.primary}
        radius={radii.lg}
        faceStyle={styles.heroFace}
        accessibilityLabel={`${pod.activity?.title ?? 'Pod'}, ${startsIn(pod.meetupTime)}`}
      >
        <Text style={[styles.heroKicker, { color: colors.onPrimary }]}>
          {hero.mine ? 'YOUR NEXT MOVE' : bestPickKicker(pod.meetupTime)} · {formatTime(pod.meetupTime)}
        </Text>
        <Text style={[styles.heroTitle, { color: colors.onPrimary }]} numberOfLines={2}>
          {pod.activity?.title ?? 'Pod'}
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.onPrimary }]} numberOfLines={1}>
          {pod.members.length}/{pod.maxMembers} going · {pod.location} · {startsIn(pod.meetupTime)}
        </Text>
        <View style={styles.heroBottom}>
          <AvatarStack
            names={pod.members.map((member) => ({
              name: member.user.name,
              uri: member.user.avatarUrl,
            }))}
            size={28}
          />
          {hero.mine ? (
            <View style={[styles.heroPill, { backgroundColor: colors.onPrimary }]}>
              <Text style={[styles.heroPillText, { color: colors.primary }]}>Open</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => void join(pod)}
              disabled={Boolean(busyPodId)}
              accessibilityRole="button"
              accessibilityLabel={`Join ${pod.activity?.title ?? 'pod'}`}
              hitSlop={8}
              style={({ pressed }) => [
                styles.heroPill,
                { backgroundColor: colors.onPrimary, opacity: pressed || busyPodId ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.heroPillText, { color: colors.primary }]}>
                {busyPodId === pod.id ? 'Joining…' : `Join · ${spotsLeft} left`}
              </Text>
            </Pressable>
          )}
        </View>
        {going.length > 0 ? (
          <Text style={[typography.captionSmall, { color: colors.onPrimary }]} numberOfLines={1}>
            {going.length === 1
              ? `${going[0].user.name.split(' ')[0]} is going`
              : `${going.length} friends are going`}
          </Text>
        ) : null}
      </Slab>
    );
  };

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
        {/* 1 — Masthead */}
        <Animated.View entering={FadeInDown.duration(motion.durBase)}>
          <View style={styles.masthead}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.kicker, { color: colors.accentText }]}>
                {datelineForNow()}
              </Text>
              <Text style={styles.greeting} numberOfLines={2}>
                {greetingForNow()},{'\n'}
                {firstName}.
              </Text>
            </View>
            <Slab
              onPress={() => navigation.navigate('Profile')}
              radius={radii.md}
              faceStyle={{ padding: 3 }}
              accessibilityLabel="Open profile"
            >
              <Avatar name={user?.name ?? 'User'} uri={user?.avatarUrl} size={48} />
            </Slab>
          </View>
        </Animated.View>
        {loadWarning ? <Banner message={loadWarning} kind="info" /> : null}

        {/* Permission nudges (between masthead and hero) */}
        {(!granted && canAskAgain) || (notificationPermissionLoaded && !notificationsGranted) ? (
          <Animated.View
            entering={FadeInDown.delay(motion.stagger).duration(motion.durBase)}
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

        {/* 2 — Hero: one next action */}
        <Animated.View entering={FadeInDown.delay(motion.stagger).duration(motion.durBase)}>
          {renderHero()}
        </Animated.View>

        {/* 3 — Pulse strip */}
        <Animated.View
          entering={FadeInDown.delay(motion.stagger * 2).duration(motion.durBase)}
          style={styles.pulseRow}
        >
          <Card padded faceStyle={styles.pulseStrip}>
            <Pressable
              onPress={() => openDiscover()}
              accessibilityRole="button"
              accessibilityLabel={`${openPodCount} pods open now`}
              style={({ pressed }) => [styles.pulseCol, pressed && { opacity: 0.6 }]}
            >
              <View style={styles.pulseValueRow}>
                <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.pulseNumber, { color: colors.accentText }]}>
                  {loaded ? openPodCount : '–'}
                </Text>
              </View>
              <Text style={[styles.pulseLabel, { color: colors.sub }]}>Pods open</Text>
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
            {friendsTonight ? (
              <>
                <View style={[styles.pulseDivide, { backgroundColor: colors.border }]} />
                <Pressable
                  onPress={() => navigation.navigate('MainTabs', { screen: 'Pods' })}
                  accessibilityRole="button"
                  accessibilityLabel={`${friendsTonight.count} friends out tonight`}
                  style={({ pressed }) => [styles.pulseCol, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[styles.pulseNumber, { color: colors.ink }]}>
                    {friendsTonight.count}
                  </Text>
                  <Text style={[styles.pulseLabel, { color: colors.sub }]}>Friends out</Text>
                </Pressable>
              </>
            ) : null}
          </Card>
        </Animated.View>

        {/* 4 — Today */}
        {agendaItems.length ? (
          <Animated.View
            entering={FadeInDown.delay(motion.stagger * 3).duration(motion.durBase)}
            style={styles.section}
          >
            <SectionHeader kicker="The lineup" title="Today" />
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
                    <View
                      style={[
                        styles.agendaTime,
                        {
                          backgroundColor:
                            item.kind === 'pod' ? colors.primarySoft : colors.violetSoft,
                        },
                      ]}
                    >
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
                    <Ionicons name="arrow-forward" size={16} color={colors.sub} />
                  </Slab>
                  {index < agendaItems.length - 1 ? (
                    <View style={[styles.agendaDivider, { borderColor: colors.borderSoft }]} />
                  ) : null}
                </View>
              ))}
            </Card>
          </Animated.View>
        ) : null}

        {/* 5 — Happening soon (inline join + social proof) */}
        <Animated.View
          entering={FadeInDown.delay(motion.stagger * 4).duration(motion.durBase)}
          style={styles.section}
        >
          <SectionHeader
            kicker="Fresh"
            title="Happening soon"
            actionLabel="Explore"
            onAction={() => openDiscover()}
          />
          {!loaded ? (
            <>
              <SkeletonCard compact />
              <SkeletonCard compact />
            </>
          ) : happeningSoon.length ? (
            happeningSoon.map((pod) => {
              const going = friendsGoing(pod);
              const spotsLeft = Math.max(0, pod.maxMembers - pod.members.length);
              return (
                <Slab
                  key={pod.id}
                  onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                  faceStyle={styles.podRowFace}
                  accessibilityLabel={pod.activity?.title ?? 'Pod'}
                >
                  <View
                    style={[
                      styles.podTimeBlock,
                      { backgroundColor: colors.primarySoft, borderColor: colors.border },
                    ]}
                  >
                    <Text style={styles.podTimeText}>{formatTime(pod.meetupTime)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={typography.heading} numberOfLines={1}>
                      {pod.activity?.title ?? 'Pod'}
                    </Text>
                    {going.length > 0 ? (
                      <View style={styles.inlineMeta}>
                        <AvatarStack
                          names={going.slice(0, 2).map((member) => ({
                            name: member.user.name,
                            uri: member.user.avatarUrl,
                          }))}
                          size={16}
                        />
                        <Text
                          style={[typography.captionSmall, { color: colors.success }]}
                          numberOfLines={1}
                        >
                          {going.length === 1
                            ? `${going[0].user.name.split(' ')[0]} is going`
                            : `${going.length} friends going`}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[typography.captionSmall, { color: colors.sub }]} numberOfLines={1}>
                        {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left · {pod.location}
                      </Text>
                    )}
                  </View>
                  <Button
                    label={busyPodId === pod.id ? 'Joining…' : 'Join'}
                    size="sm"
                    variant="secondary"
                    disabled={Boolean(busyPodId)}
                    onPress={() => void join(pod)}
                  />
                </Slab>
              );
            })
          ) : (
            <EmptyState
              icon="moon"
              title="The feed is quiet"
              body="When new pods spin up, they land here first."
              actionLabel="Start a pod"
              onAction={() => openDiscover(true)}
            />
          )}
        </Animated.View>

        {/* 6 — Map strip (compact → full-screen modal) */}
        {mappablePods.length ? (
          <Animated.View
            entering={FadeInDown.delay(motion.stagger * 5).duration(motion.durBase)}
            style={styles.section}
          >
            <Pressable
              onPress={() => setMapOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`${mappablePods.length} pods live on map. Open full map.`}
            >
              <Card padded={false}>
                <View pointerEvents="none">
                  <MapView
                    provider={PROVIDER_DEFAULT}
                    style={styles.mapStrip}
                    initialRegion={{ ...OSU_CAMPUS_CENTER, ...OSU_CAMPUS_DELTA }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                  >
                    {mappablePods.map((pod) => (
                      <Marker
                        key={pod.id}
                        coordinate={{
                          latitude: pod.latitude ?? 0,
                          longitude: pod.longitude ?? 0,
                        }}
                      />
                    ))}
                  </MapView>
                </View>
                <View style={[styles.mapStripPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
                  <Text style={typography.captionSmall}>
                    {mappablePods.length} {mappablePods.length === 1 ? 'pod' : 'pods'} live on map
                  </Text>
                </View>
              </Card>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Full-screen map modal */}
        <Modal
          visible={mapOpen}
          animationType="slide"
          onRequestClose={() => setMapOpen(false)}
        >
          <View style={[styles.mapModal, { backgroundColor: colors.bg }]}>
            <MapView
              provider={PROVIDER_DEFAULT}
              style={StyleSheet.absoluteFill}
              initialRegion={{ ...OSU_CAMPUS_CENTER, ...OSU_CAMPUS_DELTA }}
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
                  onPress={() => {
                    setMapOpen(false);
                    navigation.navigate('PodDetail', { podId: pod.id });
                  }}
                />
              ))}
            </MapView>
            <Pressable
              onPress={() => setMapOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close map"
              hitSlop={12}
              style={[
                styles.mapClose,
                {
                  top: insets.top + spacing.md,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>
        </Modal>
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
    fontWeight: '800' as const,
    color: t.colors.ink,
    marginTop: 4,
  },
  heroFace: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  heroKicker: {
    fontFamily: fonts.bold,
    fontWeight: '700' as const,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontWeight: '800' as const,
    fontSize: 24,
    lineHeight: 29,
  },
  heroBottom: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  heroPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radii.pill,
    minHeight: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  heroPillText: {
    fontFamily: fonts.bold,
    fontWeight: '700' as const,
    fontSize: 14,
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
    marginHorizontal: spacing.md,
  },
  pulseNumber: {
    fontFamily: fonts.display,
    fontWeight: '800' as const,
    fontSize: 24,
    lineHeight: 28,
  },
  pulseLabel: {
    fontFamily: fonts.medium,
    fontWeight: '500' as const,
    fontSize: 12,
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
    fontWeight: '700' as const,
    fontSize: 12,
    color: t.colors.ink,
  },
  agendaDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    fontWeight: '700' as const,
    fontSize: 12,
    color: t.colors.ink,
  },
  inlineMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  mapStrip: {
    height: 96,
  },
  mapStripPill: {
    position: 'absolute' as const,
    left: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: BORDER_W,
  },
  mapModal: {
    flex: 1,
  },
  mapClose: {
    position: 'absolute' as const,
    right: spacing.xl,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
}));
