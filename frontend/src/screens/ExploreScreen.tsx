import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSharedStateVersion } from '../context/SharedStateInvalidationContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  clearActivityDemand,
  fetchFeed,
  getActivities,
  getApiErrorMessage,
  getFriends,
  PUBLIC_SITE_URL,
  requestActivity,
  signalActivityDemand,
  trackEvent,
} from '../api';
import type { Activity, FriendUser, Pod } from '../types';
import type { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import {
  AppBackdrop,
  AvatarStack,
  Banner,
  Button,
  Card,
  ContentImage,
  Field,
  SearchBar,
  SectionHeader,
  Sheet,
  SkeletonHero,
  SkeletonRow,
  SpotIllustration,
  StateActions,
  StateCopy,
  accentForSeed,
  useDockClearance,
} from '../components/ui';
import { PodDiscoveryRow, podDayLabel, podTimeLabel } from '../components/pulse';
import { CATEGORY_META, CATEGORIES } from '../constants/categories';
import { activityImageFor } from '../constants/contentImages';
import { useJoinPod } from '../hooks/useJoinPod';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { BORDER_W, fonts, radii, spacing, useTheme } from '../theme';
import { getPodTitle, sortUpcomingPods } from '../utils/experience';
import { toast } from '../lib/toast';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const exploreZeroSpot = require('../../assets/illustrations/spot/cold-start/02-explore-first-move.png');
const searchMissSpot = require('../../assets/illustrations/spot/cold-start/07-no-search-results.png');
const inviteFriendsSpot = require('../../assets/illustrations/spot/invites/01-invite-friends.png');

export type ExplorePreviewData = {
  activities: Activity[];
  feed: Pod[];
  friends?: FriendUser[];
  query?: string;
  category?: string | null;
};

function activityMatches(activity: Activity, query: string) {
  if (!query) return true;
  return [activity.title, activity.description, activity.category, activity.defaultLocation]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function PodFeatureCard({
  pod,
  friendIds,
  mine,
  joining,
  onOpen,
  onJoin,
}: {
  pod: Pod;
  friendIds: Set<string>;
  mine: boolean;
  joining: boolean;
  onOpen: () => void;
  onJoin: () => void;
}) {
  const { colors, typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  const friendsGoing = pod.members.filter((member) => friendIds.has(member.userId));
  const title = getPodTitle(pod);

  return (
    <Card
      padded={false}
      style={[styles.featureCard, accessibilityLayout && styles.featureCardAccessible]}
      faceStyle={styles.featureCardFace}
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}
      >
        <ContentImage
          source={activityImageFor(pod.activity)}
          seed={pod.activity?.id ?? pod.activityId}
          aspectRatio={1}
          style={styles.featureImage}
        />
        <View style={styles.featureCopy}>
          <Text
            maxFontSizeMultiplier={2}
            style={[typography.heading, { color: colors.ink }]}
            numberOfLines={2}
          >
            {title}
          </Text>
          <Text
            maxFontSizeMultiplier={2}
            style={[typography.captionSmall, { color: colors.sub }]}
            numberOfLines={2}
          >
            {pod.location}
          </Text>
          <Text
            maxFontSizeMultiplier={2}
            style={[typography.captionSmall, { color: colors.sub }]}
            numberOfLines={2}
          >
            {podDayLabel(pod.meetupTime)} · {podTimeLabel(pod.meetupTime)}
          </Text>
          <View
            style={[
              styles.featureSocial,
              accessibilityLayout && styles.featureSocialAccessible,
            ]}
          >
            <AvatarStack
              names={pod.members.slice(0, 3).map((member) => ({
                name: member.user.name,
                uri: member.user.avatarUrl,
              }))}
              overflowCount={Math.max(0, pod.members.length - 3)}
              size={20}
            />
            <Text
              maxFontSizeMultiplier={2}
              style={[typography.captionSmall, { color: colors.sub }]}
              numberOfLines={2}
            >
              {friendsGoing.length
                ? `${friendsGoing.length} ${
                    friendsGoing.length === 1 ? 'friend' : 'friends'
                  } going`
                : `${pod.members.length} going`}
            </Text>
          </View>
        </View>
      </Pressable>
      <Button
        label={mine ? 'Open pod' : joining ? 'Joining…' : 'Join'}
        onPress={mine ? onOpen : onJoin}
        disabled={joining}
        variant={mine ? 'secondary' : 'primary'}
        size="sm"
        style={styles.featureButton}
      />
    </Card>
  );
}

function ActivityIdeaCard({
  activity,
  busy,
  onOpen,
  onStart,
  onDemand,
}: {
  activity: Activity;
  busy: boolean;
  onOpen: () => void;
  onStart: () => void;
  onDemand: () => void;
}) {
  const { colors, typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  const source = activityImageFor(activity);

  return (
    <Card
      padded={false}
      style={[styles.ideaCard, accessibilityLayout && styles.ideaCardAccessible]}
      faceStyle={styles.ideaCardFace}
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`View ${activity.title}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}
      >
        <ContentImage
          source={source}
          seed={activity.id}
          aspectRatio={4 / 3}
          style={styles.ideaImage}
        />
        <View style={styles.ideaCopy}>
          <Text
            maxFontSizeMultiplier={2}
            style={[typography.heading, { color: colors.ink }]}
            numberOfLines={2}
          >
            {activity.title}
          </Text>
          <Text
            maxFontSizeMultiplier={2}
            style={[typography.captionSmall, { color: colors.sub }]}
            numberOfLines={2}
          >
            {activity.category}
          </Text>
        </View>
      </Pressable>
      <View style={styles.ideaActions}>
        <Pressable
          onPress={onDemand}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={
            activity.myDemanded
              ? `Remove interest in ${activity.title}, ${activity.demandCount ?? 0} interested`
              : `Interested in ${activity.title}, ${activity.demandCount ?? 0} interested`
          }
          style={({ pressed }) => [
            styles.demandPill,
            {
              backgroundColor: activity.myDemanded ? colors.primarySoft : colors.surfaceAlt,
              opacity: busy ? 0.5 : pressed ? 0.68 : 1,
            },
          ]}
        >
          <Ionicons
            name={activity.myDemanded ? 'checkmark' : 'hand-left-outline'}
            size={13}
            color={activity.myDemanded ? colors.accentText : colors.sub}
          />
          <Text maxFontSizeMultiplier={2} style={[typography.captionSmall, { color: colors.sub }]}>
            {busy ? '…' : activity.demandCount ?? 0}
          </Text>
        </Pressable>
        <Button label="Start a pod" onPress={onStart} size="sm" />
      </View>
    </Card>
  );
}

function PromoBanner({
  kind,
  onPress,
}: {
  kind: 'request' | 'invite';
  onPress: () => void;
}) {
  const { colors, typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  const invite = kind === 'invite';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={invite ? 'Invite friends' : 'Request an activity'}
      style={({ pressed }) => [
        styles.promo,
        accessibilityLayout && styles.promoAccessible,
        {
          backgroundColor: invite ? colors.tealSoft : colors.amberSoft,
          borderColor: colors.border,
          opacity: pressed ? 0.74 : 1,
        },
      ]}
    >
      <View style={styles.promoCopy}>
        <Text maxFontSizeMultiplier={2} style={[typography.title, { color: colors.ink }]}>
          {invite ? 'Invite friends' : 'Request an activity'}
        </Text>
        <Text maxFontSizeMultiplier={2} style={[typography.caption, { color: colors.sub }]}>
          {invite ? 'More people means more possibilities.' : "Don't see it? Tell us what you want."}
        </Text>
        <View style={[styles.promoButton, { backgroundColor: colors.surface }]}>
          <Text maxFontSizeMultiplier={2} style={[typography.button, { color: colors.ink }]}>
            {invite ? 'Invite friends' : 'Request activity'}
          </Text>
          <Ionicons
            name={invite ? 'share-outline' : 'chevron-forward'}
            size={16}
            color={colors.ink}
          />
        </View>
      </View>
      {accessibilityLayout ? null : invite ? (
        <Image
          source={inviteFriendsSpot}
          resizeMode="contain"
          accessible={false}
          style={styles.promoArt}
        />
      ) : (
        <View style={styles.requestArt} accessibilityElementsHidden>
          <Ionicons name="chatbubble" size={58} color={colors.amber} />
          <Ionicons
            name="reorder-three"
            size={28}
            color={colors.surface}
            style={styles.requestLines}
          />
          <View style={[styles.requestBubbleBack, { backgroundColor: colors.surface }]} />
        </View>
      )}
    </Pressable>
  );
}

export default function ExploreScreen({
  startCreate,
  initialCategory,
  initialCategoryNonce,
  embedded,
  previewData,
}: {
  startCreate?: number;
  initialCategory?: string;
  initialCategoryNonce?: number;
  embedded?: boolean;
  previewData?: ExplorePreviewData;
}) {
  const sharedStateVersion = useSharedStateVersion('pods', 'activities', 'friends', 'users');
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  const dockClearance = useDockClearance();
  const { granted, canAskAgain, userLocation, requestLocation } = useLocationPermission();
  const [query, setQuery] = useState(previewData?.query ?? '');
  const [category, setCategory] = useState<string | null>(
    previewData?.category ?? initialCategory ?? null,
  );
  const [activities, setActivities] = useState<Activity[]>(previewData?.activities ?? []);
  const [feed, setFeed] = useState<Pod[]>(previewData?.feed ?? []);
  const [friends, setFriends] = useState<FriendUser[]>(previewData?.friends ?? []);
  const [loaded, setLoaded] = useState(Boolean(previewData));
  const [refreshing, setRefreshing] = useState(false);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(8);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestCategory, setRequestCategory] = useState(CATEGORIES[0]);
  const [requestDescription, setRequestDescription] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [demandBusyId, setDemandBusyId] = useState<string | null>(null);
  const [customHint, setCustomHint] = useState<string | null>(null);
  const { join, busyPodId } = useJoinPod();
  const handledStartCreateRef = React.useRef<number | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const load = useCallback(async () => {
    if (previewData) {
      setActivities(previewData.activities);
      setFeed(previewData.feed);
      setFriends(previewData.friends ?? []);
      setLoaded(true);
      setRefreshing(false);
      return;
    }
    const feedParams = {
      ...(category ? { category } : {}),
      limit: 50,
      ...(userLocation
        ? { lat: userLocation.latitude, lng: userLocation.longitude }
        : {}),
    };
    const [activityResult, feedResult, friendResult] = await Promise.allSettled([
      getActivities(category ?? undefined),
      fetchFeed(feedParams),
      getFriends(),
    ]);
    if (activityResult.status === 'fulfilled') setActivities(activityResult.value);
    if (feedResult.status === 'fulfilled') setFeed(feedResult.value);
    if (friendResult.status === 'fulfilled') setFriends(friendResult.value);
    setLoadWarning(
      activityResult.status === 'rejected' && feedResult.status === 'rejected'
        ? "Couldn't refresh — pull to retry."
        : null,
    );
    setLoaded(true);
    setRefreshing(false);
  }, [category, previewData, userLocation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, sharedStateVersion]),
  );

  useEffect(() => {
    setVisibleCount(8);
  }, [category, deferredQuery]);

  useEffect(() => {
    if (!initialCategory) return;
    setQuery('');
    setCategory(initialCategory);
  }, [initialCategory, initialCategoryNonce]);

  useEffect(() => {
    if (!startCreate || handledStartCreateRef.current === startCreate || !loaded) return;
    handledStartCreateRef.current = startCreate;
    setCategory(null);
    setQuery('');
    setCustomHint('Choose an activity below to start your pod.');
  }, [loaded, startCreate]);

  const explainAndRequestLocation = useCallback(() => {
    Alert.alert(
      'Use campus location?',
      'Oval uses your location to sort nearby pods. Your exact location is never posted.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            void requestLocation().then((allowed) => {
              if (!allowed) toast.info('Location is off', 'You can still browse and join normally.');
            });
          },
        },
      ],
    );
  }, [requestLocation]);

  const shareInvite = useCallback(async (surface: string) => {
    try {
      const result = await Share.share({
        title: 'Oval',
        message: 'Join me on Oval!',
        url: PUBLIC_SITE_URL,
      });
      if (result.action !== Share.dismissedAction) {
        void trackEvent('invite.shared', { surface });
      }
    } catch (error) {
      toast.error('Could not open sharing', getApiErrorMessage(error));
    }
  }, []);

  const openActivityRequest = () => {
    setRequestSubmitted(false);
    setRequestCategory(category ?? CATEGORIES[0]);
    setRequestOpen(true);
  };

  const submitActivityRequest = async () => {
    if (!requestTitle.trim()) {
      toast.error('Add a title', 'Name the activity you want added.');
      return;
    }
    setRequestBusy(true);
    try {
      await requestActivity({
        title: requestTitle.trim(),
        category: requestCategory,
        description: requestDescription.trim() || undefined,
      });
      setRequestTitle('');
      setRequestDescription('');
      setRequestSubmitted(true);
    } catch (error) {
      toast.error('Could not submit request', getApiErrorMessage(error));
    } finally {
      setRequestBusy(false);
    }
  };

  const toggleDemand = async (activity: Activity) => {
    setDemandBusyId(activity.id);
    try {
      const response = activity.myDemanded
        ? await clearActivityDemand(activity.id)
        : await signalActivityDemand(activity.id);
      setActivities((current) =>
        current.map((item) =>
          item.id === activity.id
            ? { ...item, demandCount: response.demandCount, myDemanded: response.myDemanded }
            : item,
        ),
      );
    } catch (error) {
      toast.error('Could not update interest', getApiErrorMessage(error));
    } finally {
      setDemandBusyId(null);
    }
  };

  const upcoming = useMemo(() => sortUpcomingPods(feed), [feed]);
  const filteredActivities = useMemo(
    () =>
      activities.filter(
        (activity) =>
          (!category || activity.category === category) &&
          activityMatches(activity, deferredQuery),
      ),
    [activities, category, deferredQuery],
  );
  const filteredPods = useMemo(
    () =>
      upcoming.filter((pod) => {
        if (category && pod.activity?.category !== category) return false;
        if (!deferredQuery) return true;
        return [
          pod.title,
          pod.activity?.title,
          pod.activity?.description,
          pod.activity?.category,
          pod.location,
        ]
          .join(' ')
          .toLowerCase()
          .includes(deferredQuery);
      }),
    [category, deferredQuery, upcoming],
  );
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends]);
  const searchMiss =
    Boolean(deferredQuery) && filteredActivities.length === 0 && filteredPods.length === 0;
  const featuredPods = filteredPods.slice(0, 3);
  const remainingPods = filteredPods.slice(3);
  const visiblePods = remainingPods.slice(0, visibleCount);
  const isMine = (pod: Pod) => pod.members.some((member) => member.userId === user?.id);
  const featuredActivityIds = new Set(featuredPods.map((pod) => pod.activityId));
  const orderedActivities = useMemo(
    () =>
      [...filteredActivities].sort((a, b) => {
        const featuredDifference =
          Number(featuredActivityIds.has(a.id)) - Number(featuredActivityIds.has(b.id));
        if (featuredDifference) return featuredDifference;
        return (b.demandCount ?? 0) - (a.demandCount ?? 0);
      }),
    [featuredActivityIds, filteredActivities],
  );

  const openPod = (pod: Pod) => navigation.navigate('PodDetail', { podId: pod.id });
  const openActivity = (activity: Activity, startCreate = false) =>
    navigation.navigate('ActivityPods', { activity, startCreate });

  const renderActivityRail = (title = 'Start with an activity') =>
    orderedActivities.length ? (
      <View style={styles.sectionStack}>
        <SectionHeader
          title={title}
          actionLabel="Browse all"
          onAction={() => {
            setCategory(null);
            setQuery('');
          }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalRail}
        >
          {orderedActivities.slice(0, 8).map((activity) => (
            <ActivityIdeaCard
              key={activity.id}
              activity={activity}
              busy={demandBusyId === activity.id}
              onOpen={() => openActivity(activity)}
              onStart={() => openActivity(activity, true)}
              onDemand={() => void toggleDemand(activity)}
            />
          ))}
        </ScrollView>
      </View>
    ) : null;

  const renderPromos = () => (
    <View style={styles.promoStack}>
      <PromoBanner kind="request" onPress={openActivityRequest} />
      <PromoBanner kind="invite" onPress={() => void shareInvite('explore_editorial')} />
    </View>
  );

  const renderZero = () => (
    <View style={styles.sectionStack}>
      <Card faceStyle={styles.zeroStateCard}>
        <View
          style={[
            styles.zeroStateIntro,
            accessibilityLayout && styles.zeroStateIntroAccessible,
          ]}
        >
          <SpotIllustration
            source={exploreZeroSpot}
            accessibilityLabel="A student making the first campus plan"
            height={112}
            style={[
              styles.zeroStateArt,
              accessibilityLayout && styles.zeroStateArtAccessible,
            ]}
          />
          <View style={styles.zeroStateCopy}>
            <Text maxFontSizeMultiplier={2} style={[typography.kicker, { color: colors.sub }]}>Campus starts here</Text>
            <Text maxFontSizeMultiplier={2} style={[styles.zeroStateTitle, { color: colors.ink }]}>
              Be the first plan on the board
            </Text>
            <Text maxFontSizeMultiplier={2} style={[typography.caption, { color: colors.sub }]}>
              Pick an activity and Oval will turn it into a small group.
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.zeroStateActions,
            accessibilityLayout && styles.zeroStateActionsAccessible,
          ]}
        >
          <Button
            label="Choose an activity"
            icon="search"
            onPress={() => setCustomHint('Choose an activity below to start your pod.')}
            style={styles.zeroStateAction}
          />
          <Button
            label="Invite a friend"
            icon="share-outline"
            onPress={() => void shareInvite('explore_zero')}
            variant="secondary"
            style={styles.zeroStateAction}
          />
        </View>
      </Card>
      {renderActivityRail('Choose your first activity')}
      {renderPromos()}
    </View>
  );

  const renderDiscovery = () => (
    <View style={styles.discoveryStack}>
      {featuredPods.length ? (
        <View style={styles.sectionStack}>
          <SectionHeader
            title={deferredQuery ? 'Matching pods' : 'Featured this week'}
            actionLabel="Browse activities"
            onAction={() => {
              setQuery('');
              setCategory(null);
              setCustomHint('Choose an activity below to start your pod.');
            }}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalRail}
          >
            {featuredPods.map((pod) => (
              <PodFeatureCard
                key={pod.id}
                pod={pod}
                friendIds={friendIds}
                mine={isMine(pod)}
                joining={busyPodId === pod.id}
                onOpen={() => openPod(pod)}
                onJoin={() => void join(pod)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {renderActivityRail(deferredQuery ? 'Matching activities' : 'Find an activity to start')}

      {visiblePods.length ? (
        <View style={styles.sectionStack}>
          <SectionHeader
            title={granted ? 'Pods near you' : 'More pods this week'}
            actionLabel={remainingPods.length > visibleCount ? 'Show more' : undefined}
            onAction={
              remainingPods.length > visibleCount
                ? () => setVisibleCount((count) => count + 8)
                : undefined
            }
          />
          <View style={styles.podList}>
            {visiblePods.map((pod) => (
              <PodDiscoveryRow
                key={pod.id}
                pod={pod}
                friendIds={friendIds}
                onOpen={() => openPod(pod)}
                onJoin={isMine(pod) ? undefined : () => void join(pod)}
                joining={busyPodId === pod.id}
              />
            ))}
          </View>
        </View>
      ) : null}

      {!deferredQuery ? renderPromos() : null}
    </View>
  );

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: embedded ? spacing.md : insets.top + spacing.md,
            paddingBottom: embedded ? spacing.xl : dockClearance,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
        <View style={styles.header}>
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={2}
            style={[styles.screenTitle, { color: colors.ink }]}
          >
            Explore
          </Text>
          {user?.isAdmin ? (
            <Pressable
              onPress={() => navigation.navigate('AdminActivityRequests')}
              accessibilityRole="button"
              accessibilityLabel="Review activity requests"
              style={({ pressed }) => [
                styles.adminButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.65 : 1,
                },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.sub} />
            </Pressable>
          ) : null}
        </View>

        <SearchBar
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder="Search pods, activities, and places"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRail}
        >
          <Pressable
            onPress={() => setCategory(null)}
            accessibilityRole="button"
            accessibilityLabel="All categories"
            accessibilityState={{ selected: !category }}
            style={({ pressed }) => [
              styles.filterPill,
              {
                backgroundColor: !category ? colors.primary : colors.surface,
                borderColor: !category ? colors.primary : colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              maxFontSizeMultiplier={2}
              style={[
                styles.filterLabel,
                { color: !category ? colors.onPrimary : colors.sub },
              ]}
            >
              All
            </Text>
          </Pressable>
          {CATEGORIES.map((value) => {
            const accent = accentForSeed(colors, value);
            const selected = category === value;
            return (
              <Pressable
                key={value}
                onPress={() => setCategory(selected ? null : value)}
                accessibilityRole="button"
                accessibilityLabel={CATEGORY_META[value]?.label ?? value}
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.filterPill,
                  {
                    backgroundColor: selected ? accent.tint : accent.soft,
                    borderColor: selected ? accent.tint : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  maxFontSizeMultiplier={2}
                  style={[
                    styles.filterLabel,
                    { color: selected ? colors.onPrimary : colors.ink },
                  ]}
                >
                  {CATEGORY_META[value]?.label.split(' & ')[0] ?? value}
                </Text>
              </Pressable>
            );
          })}
          {!granted && canAskAgain ? (
            <Pressable
              onPress={explainAndRequestLocation}
              accessibilityRole="button"
              accessibilityLabel="Enable nearby results"
              accessibilityHint="Requests location access"
              style={({ pressed }) => [
                styles.filterPill,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="location-outline" size={14} color={colors.sub} />
              <Text maxFontSizeMultiplier={2} style={[styles.filterLabel, { color: colors.sub }]}>Nearby</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        {customHint ? (
          <Banner message={customHint} kind="info" onDismiss={() => setCustomHint(null)} />
        ) : null}
        {loadWarning ? <Banner message={loadWarning} kind="info" /> : null}

        {!loaded ? (
          <View style={styles.sectionStack}>
            <SkeletonHero />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : searchMiss ? (
          <View style={styles.sectionStack}>
            <Card faceStyle={styles.stateCard}>
              <SpotIllustration
                source={searchMissSpot}
                accessibilityLabel="No plans matching this search"
                height={174}
              />
              <StateCopy
                eyebrow="No exact match"
                title={`Nothing for “${query.trim()}” yet`}
                body="Request this activity, clear the search, or start a pod from the catalog."
              />
              <StateActions
                primaryLabel="Request activity"
                onPrimary={openActivityRequest}
                secondaryLabel="Clear search"
                onSecondary={() => setQuery('')}
              />
            </Card>
            {renderPromos()}
          </View>
        ) : upcoming.length === 0 && !deferredQuery && !category ? (
          renderZero()
        ) : (
          renderDiscovery()
        )}
      </ScrollView>

      <Sheet
        visible={requestOpen}
        onClose={() => setRequestOpen(false)}
        title={requestSubmitted ? 'Request sent' : 'Request an activity'}
        kicker="Catalog"
        scrollable
      >
        {requestSubmitted ? (
          <View style={styles.sheetStack}>
            <StateCopy
              title="Thanks for the idea"
              body="Your request is in review. We’ll add it to the catalog if it fits the campus board."
            />
            <Button label="Done" onPress={() => setRequestOpen(false)} />
          </View>
        ) : (
          <View style={styles.sheetStack}>
            <Field
              label="Activity name"
              value={requestTitle}
              onChangeText={setRequestTitle}
              placeholder="Late-night breakfast"
            />
            <Text maxFontSizeMultiplier={2} style={typography.caption}>Category</Text>
            <View style={styles.requestCategories}>
              {CATEGORIES.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setRequestCategory(value)}
                  accessibilityRole="radio"
                  accessibilityLabel={CATEGORY_META[value]?.label ?? value}
                  accessibilityState={{ checked: requestCategory === value }}
                  style={({ pressed }) => [
                    styles.requestCategory,
                    {
                      backgroundColor:
                        requestCategory === value ? colors.primarySoft : colors.surface,
                      borderColor:
                        requestCategory === value ? colors.primary : colors.border,
                      opacity: pressed ? 0.68 : 1,
                    },
                  ]}
                >
                  <Text maxFontSizeMultiplier={2} style={[typography.chip, { color: colors.ink }]}>
                    {CATEGORY_META[value]?.label ?? value}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Field
              label="What should people know?"
              value={requestDescription}
              onChangeText={setRequestDescription}
              placeholder="Optional"
              multiline
            />
            <Button
              label={requestBusy ? 'Sending…' : 'Send request'}
              disabled={requestBusy}
              onPress={() => void submitActivityRequest()}
            />
          </View>
        )}
      </Sheet>

    </AppBackdrop>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontFamily: fonts.displayHeavy,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  adminButton: {
    width: 44,
    height: 44,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRail: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  filterPill: {
    minHeight: 44,
    borderWidth: BORDER_W,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  filterLabel: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 13,
  },
  discoveryStack: {
    gap: spacing.xxxl,
  },
  sectionStack: {
    gap: spacing.md,
  },
  horizontalRail: {
    gap: spacing.md,
    paddingRight: spacing.lg,
    paddingBottom: spacing.sm,
  },
  featureCard: {
    width: 172,
  },
  featureCardAccessible: {
    width: 292,
  },
  featureCardFace: {
    overflow: 'hidden',
    paddingBottom: spacing.md,
  },
  featureImage: {
    height: 164,
    borderWidth: 0,
    borderBottomWidth: BORDER_W,
    borderRadius: 0,
  },
  featureCopy: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
    minHeight: 140,
    gap: 3,
  },
  featureSocial: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  featureSocialAccessible: {
    flexWrap: 'wrap',
  },
  featureButton: {
    marginHorizontal: spacing.md,
  },
  ideaCard: {
    width: 184,
  },
  ideaCardAccessible: {
    width: 292,
  },
  ideaCardFace: {
    overflow: 'hidden',
    paddingBottom: spacing.md,
  },
  ideaImage: {
    height: 138,
    borderWidth: 0,
    borderBottomWidth: BORDER_W,
    borderRadius: 0,
  },
  ideaCopy: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
    minHeight: 88,
    gap: 3,
  },
  ideaActions: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  demandPill: {
    minWidth: 42,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  podList: {
    gap: spacing.sm,
  },
  promoStack: {
    gap: spacing.md,
  },
  promo: {
    minHeight: 148,
    borderWidth: BORDER_W,
    borderRadius: radii.lg,
    overflow: 'hidden',
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  promoAccessible: {
    minHeight: 0,
  },
  promoCopy: {
    flex: 1,
    zIndex: 2,
    gap: 4,
    alignItems: 'flex-start',
  },
  promoButton: {
    marginTop: 'auto',
    minHeight: 44,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  promoArt: {
    position: 'absolute',
    width: 172,
    height: 142,
    right: -14,
    bottom: -2,
  },
  requestArt: {
    width: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestLines: {
    position: 'absolute',
    left: 41,
    top: 45,
  },
  requestBubbleBack: {
    position: 'absolute',
    width: 52,
    height: 40,
    borderRadius: radii.md,
    right: -8,
    top: 18,
    opacity: 0.48,
  },
  stateCard: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  zeroStateCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  zeroStateIntro: {
    minHeight: 116,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  zeroStateIntroAccessible: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  zeroStateArt: {
    width: 126,
    flexShrink: 0,
  },
  zeroStateArtAccessible: {
    width: '100%',
  },
  zeroStateCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  zeroStateTitle: {
    fontFamily: fonts.displayHeavy,
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '800',
  },
  zeroStateActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  zeroStateActionsAccessible: {
    flexDirection: 'column',
  },
  zeroStateAction: {
    flex: 1,
    minWidth: 0,
  },
  sheetStack: {
    gap: spacing.lg,
  },
  requestCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  requestCategory: {
    borderWidth: BORDER_W,
    borderRadius: radii.pill,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
