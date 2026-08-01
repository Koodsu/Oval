import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchFeed,
  getClubsWeek,
  getFriends,
  getInboxSummary,
  getMyClubs,
  getMyPods,
  resolveAvatarUrl,
  type InboxSummary,
} from '../api';
import { useAuth } from '../context/AuthContext';
import type {
  ClubMeetingToday,
  FriendUser,
  MyClubMembershipRow,
  Pod,
} from '../types';
import type { RootStackParamList } from '../../App';
import {
  AppBackdrop,
  Avatar,
  AvatarStack,
  Banner,
  Button,
  Card,
  Chip,
  SkeletonHero,
  SkeletonRow,
  Sticker,
  useDockClearance,
} from '../components/ui';
import { podDayLabel, podTimeLabel } from '../components/pulse';
import { activityImageFor } from '../constants/contentImages';
import { formatClassYear } from '../constants/classYears';
import { BORDER_W, radii, spacing, useTheme } from '../theme';
import { getPodTitle, sortUpcomingPods } from '../utils/experience';
import { relativeTime } from '../utils/format';
import { useJoinPod } from '../hooks/useJoinPod';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { useNotificationPermission } from '../hooks/useNotificationPermission';
import { toast } from '../lib/toast';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const homeHeroArt = require('../../assets/illustrations/runtime/cold-start/01-home-zero-start-network.jpg');

export type HomePreviewData = {
  pods: Pod[];
  myPods?: Pod[];
  clubMeetings?: ClubMeetingToday[];
  myClubs?: MyClubMembershipRow[];
  friends?: FriendUser[];
  summary?: InboxSummary | null;
};

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || 'Buckeye';
}

function meetingDateLabel(iso: string) {
  return `${podDayLabel(iso)} · ${podTimeLabel(iso)}`;
}

function countdownLabel(iso: string) {
  const totalMinutes = Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function HomeSectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.homeSectionHeader}>
      <Text style={[styles.homeSectionTitle, { color: colors.ink }]}>{title}</Text>
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
      >
        <Text style={[styles.homeSectionAction, { color: colors.primary }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function PodThumbnail({ pod }: { pod: Pod }) {
  const { colors } = useTheme();
  const source = activityImageFor(pod.activity);

  return (
    <View
      style={[
        styles.podThumb,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
      ]}
    >
      <Image
        source={source}
        resizeMode="cover"
        accessibilityLabel={`${pod.activity?.title ?? 'Pod'} image`}
        style={styles.fillImage}
      />
    </View>
  );
}

function ClubThumbnail({ membership }: { membership: MyClubMembershipRow }) {
  const { colors } = useTheme();
  const uri = resolveAvatarUrl(membership.club.avatarUrl);

  return (
    <View
      style={[
        styles.clubThumb,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          resizeMode="cover"
          accessibilityLabel={`${membership.club.name} image`}
          style={styles.fillImage}
        />
      ) : (
        <Ionicons name="image-outline" size={22} color={colors.faint} />
      )}
    </View>
  );
}

function CampusPulse({
  friendCount,
  clubCount,
  podCount,
  planCount,
}: {
  friendCount: number;
  clubCount: number;
  podCount: number;
  planCount: number;
}) {
  const { colors, typography } = useTheme();
  const items: Array<{
    label: string;
    value: number;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }> = [
    { label: 'Friends', value: friendCount, icon: 'people', color: colors.primary },
    { label: 'Clubs', value: clubCount, icon: 'people', color: colors.blue },
    { label: 'Pods', value: podCount, icon: 'people', color: colors.primary },
    { label: 'Plans', value: planCount, icon: 'sunny', color: colors.amber },
  ];

  return (
    <Card faceStyle={styles.pulseCard}>
      <Text style={[typography.subheading, styles.pulseTitle, { color: colors.ink }]}>
        Campus pulse
      </Text>
      <View style={styles.pulseMetrics}>
        {items.map((item, index) => (
          <React.Fragment key={item.label}>
            {index ? <View style={[styles.pulseDivider, { backgroundColor: colors.border }]} /> : null}
            <View style={styles.pulseMetric}>
              <Ionicons name={item.icon} size={20} color={item.color} />
              <Text style={[styles.pulseValue, { color: colors.ink }]}>{item.value}</Text>
              <Text style={[typography.captionSmall, styles.pulseLabel, { color: colors.sub }]}>
                {item.label}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </Card>
  );
}

function NextPlanHero({ pod, onOpen }: { pod: Pod; onOpen: () => void }) {
  const { colors, typography } = useTheme();
  const progress = Math.min(1, pod.members.length / Math.max(1, pod.maxMembers));
  const title = getPodTitle(pod);

  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryPress]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.nextPlanHero}
    >
      <Text style={[typography.kicker, styles.onPrimaryKicker, { color: colors.onPrimary }]}>
        NEXT PLAN
      </Text>
      <Text style={[styles.nextPlanTitle, { color: colors.onPrimary }]} numberOfLines={2}>
        {title}
      </Text>
      <View style={styles.nextPlanMeta}>
        <Ionicons name="time" size={16} color={colors.onPrimary} />
        <Text style={[styles.onPrimaryMeta, { color: colors.onPrimary }]}>
          {podDayLabel(pod.meetupTime)} · {podTimeLabel(pod.meetupTime)}
        </Text>
      </View>
      <View style={styles.nextPlanMeta}>
        <Ionicons name="location" size={16} color={colors.onPrimary} />
        <Text
          style={[styles.onPrimaryMeta, styles.metaText, { color: colors.onPrimary }]}
          numberOfLines={1}
        >
          {pod.location}
        </Text>
      </View>
      <View style={styles.nextPlanSocial}>
        <AvatarStack
          names={pod.members.slice(0, 4).map((member) => ({
            name: member.user.name,
            uri: member.user.avatarUrl,
          }))}
          overflowCount={Math.max(0, pod.members.length - 4)}
          size={27}
          onColor
        />
        <Text
          style={[typography.captionSmall, styles.goingText, { color: colors.onPrimary }]}
          numberOfLines={1}
        >
          {pod.members.length} {pod.members.length === 1 ? 'person' : 'people'} going
        </Text>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Open ${title}`}
          style={({ pressed }) => [
            styles.openPlanButton,
            { backgroundColor: colors.onPrimary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[styles.openPlanLabel, { color: colors.primary }]}>Open</Text>
        </Pressable>
      </View>
      <View style={styles.nextPlanProgressRow}>
        <View style={styles.nextPlanTrack}>
          <View
            style={[
              styles.nextPlanProgress,
              { width: `${Math.max(12, progress * 100)}%`, backgroundColor: colors.onPrimary },
            ]}
          />
        </View>
        <Ionicons name="stopwatch-outline" size={15} color={colors.onPrimary} />
        <Text style={[styles.countdownText, { color: colors.onPrimary }]}>
          {countdownLabel(pod.meetupTime)}
        </Text>
      </View>
    </LinearGradient>
  );
}

function EmptyPlanHero({
  onExplore,
  onCreate,
}: {
  onExplore: () => void;
  onCreate: () => void;
}) {
  const { colors, typography, isDark } = useTheme();

  return (
    <Card padded={false} faceStyle={styles.emptyHero}>
      <View style={styles.emptyHeroArtWrap}>
        <Image
          source={homeHeroArt}
          resizeMode="cover"
          accessibilityLabel="Students meeting on the Oval"
          style={styles.emptyHeroImage}
        />
        <LinearGradient
          colors={[
            isDark ? 'rgba(20,23,30,0)' : 'rgba(255,255,255,0)',
            colors.surface,
          ]}
          style={styles.emptyHeroFade}
        />
      </View>
      <View style={styles.emptyHeroCopy}>
        <Text style={[styles.emptyHeroTitle, { color: colors.ink }]}>Nothing planned yet</Text>
        <Text style={[typography.caption, { color: colors.sub }]}>
          Open the door to something new.
        </Text>
      </View>
      <View style={styles.emptyHeroActions}>
        <Button
          label="Find something"
          icon="search"
          onPress={onExplore}
          size="md"
          style={styles.fullButton}
        />
        <Button
          label="Start a pod"
          icon="add-circle-outline"
          variant="secondary"
          onPress={onCreate}
          size="md"
          style={styles.fullButton}
        />
      </View>
    </Card>
  );
}

function CompactPodRow({
  pod,
  mine,
  friendIds,
  joining,
  onOpen,
  onJoin,
}: {
  pod: Pod;
  mine: boolean;
  friendIds: Set<string>;
  joining: boolean;
  onOpen: () => void;
  onJoin: () => void;
}) {
  const { colors, typography } = useTheme();
  const title = getPodTitle(pod);
  const friendsGoing = pod.members.filter((member) => friendIds.has(member.userId));
  const socialMembers = friendsGoing.length ? friendsGoing : pod.members;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      style={({ pressed }) => [
        styles.compactRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.74 : 1,
        },
      ]}
    >
      <PodThumbnail pod={pod} />
      <View style={styles.compactCopy}>
        <Text style={[typography.subheading, { color: colors.ink }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[typography.captionSmall, { color: colors.sub }]} numberOfLines={1}>
          {podDayLabel(pod.meetupTime)} · {podTimeLabel(pod.meetupTime)} · {pod.location}
        </Text>
        <View style={styles.compactSocial}>
          <AvatarStack
            names={socialMembers.slice(0, 4).map((member) => ({
              name: member.user.name,
              uri: member.user.avatarUrl,
            }))}
            overflowCount={Math.max(0, socialMembers.length - 4)}
            size={19}
          />
          <Text style={[typography.captionSmall, styles.metaText, { color: colors.sub }]} numberOfLines={1}>
            {friendsGoing.length
              ? `${friendsGoing.length} ${friendsGoing.length === 1 ? 'friend' : 'friends'} going`
              : `${pod.members.length} going`}
          </Text>
        </View>
      </View>
      <Button
        label={mine ? 'Open' : 'Join'}
        variant={mine ? 'secondary' : 'primary'}
        loading={joining}
        onPress={mine ? onOpen : onJoin}
        size="sm"
        style={styles.compactButton}
      />
    </Pressable>
  );
}

function MembershipClubRow({
  membership,
  onOpen,
}: {
  membership: MyClubMembershipRow;
  onOpen: () => void;
}) {
  const { colors, typography } = useTheme();
  const isNew = (membership.unreadCount ?? 0) > 0;
  const meeting = membership.nextMeeting;
  const announcement = membership.latestAnnouncement;
  const detail = meeting
    ? meeting.title
    : announcement?.content ?? `${membership.club.memberCount} members`;
  const meta = meeting
    ? `${meetingDateLabel(meeting.meetingTime)} · ${meeting.location}`
    : announcement
      ? `${announcement.user.name} · ${relativeTime(announcement.createdAt)}`
      : `${membership.club.memberCount} members`;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open ${membership.club.name}`}
      style={({ pressed }) => [
        styles.clubRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.74 : 1,
        },
      ]}
    >
      <ClubThumbnail membership={membership} />
      <View style={styles.compactCopy}>
        <View style={styles.clubTitleLine}>
          <Text
            style={[typography.subheading, styles.metaText, { color: colors.ink }]}
            numberOfLines={1}
          >
            {membership.club.name}
          </Text>
          {isNew ? (
            <Sticker
              label="New"
              tint={colors.primary}
              textColor={colors.onPrimary}
              small
            />
          ) : null}
        </View>
        <Text style={[typography.captionSmall, { color: colors.ink }]} numberOfLines={1}>
          {detail}
        </Text>
        <Text style={[typography.captionSmall, { color: colors.sub }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Button
        label="Details"
        variant="secondary"
        onPress={onOpen}
        size="sm"
        style={styles.compactButton}
      />
    </Pressable>
  );
}

function BringClubRow({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Bring your club to Oval"
      style={({ pressed }) => [
        styles.bringClubRow,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.bringClubIcon}>
        <Ionicons name="people-outline" size={22} color={colors.ink} />
        <Ionicons
          name="sparkles"
          size={11}
          color={colors.primary}
          style={styles.bringClubSparkle}
        />
      </View>
      <Text style={[styles.bringClubLabel, { color: colors.ink }]}>
        Bring your club to Oval
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.ink} />
    </Pressable>
  );
}

export default function HomeScreen({ previewData }: { previewData?: HomePreviewData }) {
  const navigation = useNavigation<Nav>();
  const { user, token } = useAuth();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const dockClearance = useDockClearance();
  const { granted, canAskAgain, userLocation, requestLocation } = useLocationPermission();
  const {
    granted: notificationsGranted,
    canAskAgain: canAskForNotifications,
    loaded: notificationPermissionLoaded,
    requestNotifications,
  } = useNotificationPermission();
  const [pods, setPods] = useState<Pod[]>(previewData?.pods ?? []);
  const [myPods, setMyPods] = useState<Pod[]>(previewData?.myPods ?? []);
  const [clubMeetings, setClubMeetings] = useState<ClubMeetingToday[]>(
    previewData?.clubMeetings ?? [],
  );
  const [myClubs, setMyClubs] = useState<MyClubMembershipRow[]>(previewData?.myClubs ?? []);
  const [friends, setFriends] = useState<FriendUser[]>(previewData?.friends ?? []);
  const [summary, setSummary] = useState<InboxSummary | null>(previewData?.summary ?? null);
  const [loaded, setLoaded] = useState(Boolean(previewData));
  const [refreshing, setRefreshing] = useState(false);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const { join, busyPodId } = useJoinPod();

  const load = useCallback(async () => {
    if (previewData) {
      setPods(previewData.pods);
      setMyPods(previewData.myPods ?? []);
      setClubMeetings(previewData.clubMeetings ?? []);
      setMyClubs(previewData.myClubs ?? []);
      setFriends(previewData.friends ?? []);
      setSummary(previewData.summary ?? null);
      setLoaded(true);
      setRefreshing(false);
      return;
    }
    if (!token) {
      setLoaded(true);
      setRefreshing(false);
      return;
    }

    const [feedResult, mineResult, meetingResult, clubsResult, friendResult, summaryResult] =
      await Promise.allSettled([
        fetchFeed(
          userLocation
            ? { limit: 50, lat: userLocation.latitude, lng: userLocation.longitude }
            : { limit: 50 },
        ),
        getMyPods(),
        getClubsWeek(),
        getMyClubs(),
        getFriends(),
        getInboxSummary(),
      ]);

    if (feedResult.status === 'fulfilled') setPods(feedResult.value);
    if (mineResult.status === 'fulfilled') setMyPods(mineResult.value);
    if (meetingResult.status === 'fulfilled') setClubMeetings(meetingResult.value);
    if (clubsResult.status === 'fulfilled') setMyClubs(clubsResult.value);
    if (friendResult.status === 'fulfilled') setFriends(friendResult.value);
    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
    setLoadWarning(
      feedResult.status === 'rejected' && mineResult.status === 'rejected'
        ? "Couldn't refresh — pull to retry."
        : null,
    );
    setLoaded(true);
    setRefreshing(false);
  }, [previewData, token, userLocation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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
                toast.info('Location is off', 'You can still use Oval without nearby sorting.');
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
        ? 'Notifications are off for Oval. Open Settings to turn on reminders and messages.'
        : 'Oval can alert you about meetup reminders, club updates, and messages.',
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
              if (!allowed) toast.info('Alerts are off', 'Oval still works normally.');
            });
          },
        },
      ],
    );
  }, [canAskForNotifications, requestNotifications]);

  const upcomingPods = useMemo(() => sortUpcomingPods(pods), [pods]);
  const upcomingMine = useMemo(() => sortUpcomingPods(myPods), [myPods]);
  const myPodIds = useMemo(() => new Set(upcomingMine.map((pod) => pod.id)), [upcomingMine]);
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends]);
  const nextPersonalPod = upcomingMine[0] ?? null;
  const happeningSoon = useMemo(
    () => upcomingPods.filter((pod) => pod.id !== nextPersonalPod?.id).slice(0, 2),
    [nextPersonalPod?.id, upcomingPods],
  );
  const membershipClubs = useMemo(
    () =>
      [...myClubs]
        .sort((a, b) => {
          const aTime = a.nextMeeting
            ? new Date(a.nextMeeting.meetingTime).getTime()
            : a.latestAnnouncement
              ? new Date(a.latestAnnouncement.createdAt).getTime()
              : 0;
          const bTime = b.nextMeeting
            ? new Date(b.nextMeeting.meetingTime).getTime()
            : b.latestAnnouncement
              ? new Date(b.latestAnnouncement.createdAt).getTime()
              : 0;
          return bTime - aTime;
        })
        .slice(0, 2),
    [myClubs],
  );

  const openPod = (pod: Pod) => navigation.navigate('PodDetail', { podId: pod.id });

  const pulse = (
    <CampusPulse
      friendCount={friends.length}
      clubCount={myClubs.length}
      podCount={upcomingMine.length}
      planCount={upcomingPods.length + clubMeetings.length}
    />
  );

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: dockClearance },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.masthead}>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <Avatar name={user?.name ?? 'You'} uri={user?.avatarUrl} size={46} />
          </Pressable>
          <View style={styles.mastheadCopy}>
            <Text style={[typography.subheading, styles.greeting, { color: colors.ink }]}>
              {greetingForNow()}, {firstName(user?.firstName ?? user?.name)} 👋
            </Text>
            <Text style={[typography.captionSmall, { color: colors.sub }]}>
              {formatClassYear(user?.classYear, 'osu') ?? 'What’s your move today?'}
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('MainTabs', { screen: 'Inbox' })}
            accessibilityRole="button"
            accessibilityLabel="Open inbox"
            style={({ pressed }) => [
              styles.notificationButton,
              { opacity: pressed ? 0.58 : 1 },
            ]}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.ink} />
            {summary?.total ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: colors.primary, borderColor: colors.surface },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
                  {summary.total > 9 ? '9+' : summary.total}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {loadWarning ? <Banner message={loadWarning} kind="info" /> : null}

        {!loaded ? (
          <View style={styles.section}>
            <SkeletonHero />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : (
          <>
            {nextPersonalPod ? (
              <>
                <NextPlanHero pod={nextPersonalPod} onOpen={() => openPod(nextPersonalPod)} />
                {pulse}
              </>
            ) : (
              <>
                {pulse}
                <EmptyPlanHero
                  onExplore={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
                  onCreate={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
                />
              </>
            )}

            {happeningSoon.length ? (
              <View style={styles.section}>
                <HomeSectionHeader
                  title="Happening soon"
                  actionLabel="See all"
                  onAction={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
                />
                <View style={styles.flushList}>
                  {happeningSoon.map((pod) => (
                    <CompactPodRow
                      key={pod.id}
                      pod={pod}
                      mine={myPodIds.has(pod.id)}
                      friendIds={friendIds}
                      joining={busyPodId === pod.id}
                      onOpen={() => openPod(pod)}
                      onJoin={() => void join(pod)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {nextPersonalPod && membershipClubs.length ? (
              <View style={styles.section}>
                <HomeSectionHeader
                  title="From your clubs"
                  actionLabel="See all"
                  onAction={() => navigation.navigate('MainTabs', { screen: 'Clubs' })}
                />
                <View style={styles.flushList}>
                  {membershipClubs.map((membership) => (
                    <MembershipClubRow
                      key={membership.membershipId}
                      membership={membership}
                      onOpen={() =>
                        navigation.navigate('ClubDetail', { clubId: membership.club.id })
                      }
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {!nextPersonalPod ? (
              <View style={styles.section}>
                <HomeSectionHeader
                  title="Find your campus circle"
                  actionLabel="See all"
                  onAction={() => navigation.navigate('MainTabs', { screen: 'Clubs' })}
                />
                <View style={styles.flushList}>
                  {membershipClubs.map((membership) => (
                    <MembershipClubRow
                      key={membership.membershipId}
                      membership={membership}
                      onOpen={() =>
                        navigation.navigate('ClubDetail', { clubId: membership.club.id })
                      }
                    />
                  ))}
                </View>
                <BringClubRow
                  onPress={() => navigation.navigate('MainTabs', { screen: 'Clubs' })}
                />
              </View>
            ) : null}
          </>
        )}

        <View style={styles.permissionRow}>
          {!granted && canAskAgain ? (
            <Chip
              label="Use location for nearby pods"
              icon="location-outline"
              onPress={explainAndRequestLocation}
            />
          ) : null}
          {notificationPermissionLoaded && !notificationsGranted ? (
            <Chip
              label="Turn on plan reminders"
              icon="notifications-outline"
              onPress={explainAndRequestNotifications}
            />
          ) : null}
        </View>
      </ScrollView>

    </AppBackdrop>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 13,
    gap: 11,
  },
  masthead: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mastheadCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  greeting: {
    fontWeight: '700',
  },
  notificationButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 1,
    top: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  pulseCard: {
    padding: 11,
    gap: 7,
  },
  pulseTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  pulseMetrics: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  pulseMetric: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  pulseDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  pulseValue: {
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '800',
  },
  pulseLabel: {
    fontSize: 10,
  },
  nextPlanHero: {
    minHeight: 176,
    borderRadius: radii.md,
    padding: 14,
    overflow: 'hidden',
    gap: 5,
  },
  onPrimaryKicker: {
    fontSize: 10,
    fontWeight: '800',
  },
  nextPlanTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    marginBottom: 2,
  },
  nextPlanMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  onPrimaryMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  nextPlanSocial: {
    minHeight: 39,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  goingText: {
    flex: 1,
    fontWeight: '700',
  },
  openPlanButton: {
    minWidth: 74,
    height: 36,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openPlanLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  nextPlanProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextPlanTrack: {
    flex: 1,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  nextPlanProgress: {
    height: '100%',
    borderRadius: radii.pill,
  },
  countdownText: {
    minWidth: 45,
    fontSize: 10,
    fontWeight: '800',
  },
  emptyHero: {
    overflow: 'hidden',
    paddingBottom: 11,
  },
  emptyHeroArtWrap: {
    height: 184,
  },
  emptyHeroImage: {
    width: '100%',
    height: '100%',
  },
  emptyHeroFade: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    top: '58%',
  },
  emptyHeroCopy: {
    alignItems: 'center',
    gap: 2,
    marginTop: -26,
    paddingHorizontal: spacing.lg,
  },
  emptyHeroTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyHeroActions: {
    paddingHorizontal: 10,
    marginTop: 11,
    gap: 7,
  },
  fullButton: {
    width: '100%',
  },
  section: {
    gap: 6,
  },
  homeSectionHeader: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  homeSectionTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  homeSectionAction: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  flushList: {
    gap: 0,
  },
  compactRow: {
    minHeight: 74,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  podThumb: {
    width: 68,
    height: 62,
    borderRadius: radii.xs,
    borderWidth: BORDER_W,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillImage: {
    width: '100%',
    height: '100%',
  },
  compactCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  compactSocial: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  compactButton: {
    minWidth: 64,
  },
  clubRow: {
    minHeight: 72,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clubTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
  },
  clubThumb: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: BORDER_W,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bringClubRow: {
    minHeight: 48,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bringClubIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bringClubSparkle: {
    position: 'absolute',
    right: -2,
    top: -2,
  },
  bringClubLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  permissionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
