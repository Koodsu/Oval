import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  acceptPodInvite,
  declinePodInvite,
  fetchFeed,
  getApiErrorMessage,
  getFriends,
  getMyPodHistory,
  getMyPods,
  getPodInvites,
} from '../api';
import type { RootStackParamList } from '../../App';
import type { FriendUser, Pod, PodInvite } from '../types';
import {
  AppBackdrop,
  AvatarStack,
  Banner,
  Button,
  ContentImage,
  CountBubble,
  SkeletonCard,
  Slab,
  SpotIllustration,
  Sticker,
  useDockClearance,
} from '../components/ui';
import { podDayLabel, podTimeLabel } from '../components/pulse';
import { activityImageFor } from '../constants/contentImages';
import { useJoinPod } from '../hooks/useJoinPod';
import { getPodTitle, sortUpcomingPods } from '../utils/experience';
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
import { toast } from '../lib/toast';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DensityState = 'zero' | 'low' | 'recommended' | 'mine';

const firstPlanSpot = require('../../assets/illustrations/spot/cold-start/03-pods-first-plan.png');
const openWeekSpot = require('../../assets/illustrations/spot/cold-start/08-no-upcoming-personal.png');

export type PodsPreviewData = {
  activePods: Pod[];
  historyPods: Pod[];
  feed: Pod[];
  friends?: FriendUser[];
  invites?: PodInvite[];
};

type PodWithUnread = Pod & {
  unreadCount?: number;
  chatUnreadCount?: number;
  unreadChatCount?: number;
};

function displayPodTitle(pod: Pod) {
  return getPodTitle(pod);
}

function memberAvatars(pod: Pod) {
  return pod.members.map((member) => ({
    name: member.user.name,
    uri: member.user.avatarUrl,
  }));
}

function unreadCountForPod(pod: Pod) {
  const candidate = pod as PodWithUnread;
  const value = candidate.unreadCount ?? candidate.chatUnreadCount ?? candidate.unreadChatCount;
  return typeof value === 'number' && value > 0 ? value : 0;
}

function friendCountForPod(pod: Pod, friendIds: Set<string>) {
  return pod.members.filter((member) => friendIds.has(member.userId)).length;
}

function recentHistory(pods: Pod[]) {
  return [...pods]
    .filter(
      (pod) =>
        pod.status === 'COMPLETED' ||
        pod.status === 'EXPIRED' ||
        pod.status === 'CANCELLED',
    )
    .sort((a, b) => new Date(b.meetupTime).getTime() - new Date(a.meetupTime).getTime());
}

export function podsDensityState(myPodCount: number, globalPodCount: number): DensityState {
  if (myPodCount > 0) return 'mine';
  if (globalPodCount === 0) return 'zero';
  if (globalPodCount < 10) return 'low';
  return 'recommended';
}

function PodThumbnail({ pod, size = 58 }: { pod: Pod; size?: number }) {
  return (
    <ContentImage
      source={activityImageFor(pod.activity)}
      seed={pod.activity?.id ?? pod.activityId}
      accessibilityLabel={`${displayPodTitle(pod)} activity image`}
      aspectRatio={1}
      style={{ width: size, height: size, flexShrink: 0 }}
    />
  );
}

function ActionRow({
  icon,
  title,
  body,
  onPress,
  trailing = 'chevron-forward',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  onPress: () => void;
  trailing?: keyof typeof Ionicons.glyphMap;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <Slab
      onPress={onPress}
      raised={false}
      faceStyle={styles.actionRow}
      accessibilityLabel={title}
    >
      <Ionicons name={icon} size={24} color={colors.ink} />
      <View style={styles.actionCopy}>
        <Text maxFontSizeMultiplier={2} style={[typography.heading, { color: colors.ink }]}>{title}</Text>
        {body ? (
          <Text maxFontSizeMultiplier={2} style={[typography.captionSmall, { color: colors.sub }]}>{body}</Text>
        ) : null}
      </View>
      <Ionicons name={trailing} size={19} color={colors.sub} />
    </Slab>
  );
}

function PlanRow({
  pod,
  past,
  onOpen,
}: {
  pod: Pod;
  past?: boolean;
  onOpen: () => void;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const unreadCount = unreadCountForPod(pod);

  return (
    <Slab
      onPress={onOpen}
      raised={false}
      faceStyle={styles.planRow}
      accessibilityLabel={
        unreadCount > 0
          ? `Open ${displayPodTitle(pod)}, ${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}`
          : `Open ${displayPodTitle(pod)}`
      }
    >
      <PodThumbnail pod={pod} size={58} />
      <View style={styles.planCopy}>
        <Text maxFontSizeMultiplier={2} style={[typography.heading, { color: colors.ink }]} numberOfLines={2}>
          {displayPodTitle(pod)}
        </Text>
        <Text maxFontSizeMultiplier={2} style={[typography.captionSmall, { color: colors.sub }]} numberOfLines={2}>
          {podDayLabel(pod.meetupTime)} · {podTimeLabel(pod.meetupTime)} · {pod.location}
        </Text>
        <AvatarStack names={memberAvatars(pod)} size={20} max={4} />
      </View>
      <View style={styles.planTrailing}>
        {unreadCount > 0 ? (
          <View style={styles.unreadWrap}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.ink} />
            <CountBubble count={unreadCount} style={styles.unreadBubble} />
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.sub} />
      </View>
    </Slab>
  );
}

function RecommendationRow({
  pod,
  friendIds,
  joining,
  onOpen,
  onJoin,
}: {
  pod: Pod;
  friendIds: Set<string>;
  joining: boolean;
  onOpen: () => void;
  onJoin: () => void;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  const friendCount = friendCountForPod(pod, friendIds);
  const reason = pod.recommended
    ? `Matches your ${pod.activity?.category ?? 'interests'}`
    : friendCount
      ? `${friendCount} ${friendCount === 1 ? 'friend is' : 'friends are'} going`
      : 'Popular on campus';

  return (
    <Slab
      raised={false}
      faceStyle={styles.recommendationShell}
    >
      <View
        style={[
          styles.recommendationRow,
          accessibilityLayout && styles.recommendationRowAccessible,
        ]}
      >
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Open ${displayPodTitle(pod)}`}
          style={({ pressed }) => [
            styles.recommendationOpen,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <PodThumbnail pod={pod} size={64} />
          <View style={styles.recommendationCopy}>
            <Text maxFontSizeMultiplier={2} style={[typography.heading, { color: colors.ink }]} numberOfLines={2}>
              {displayPodTitle(pod)}
            </Text>
            <Text maxFontSizeMultiplier={2} style={[typography.captionSmall, { color: colors.sub }]} numberOfLines={2}>
              {podDayLabel(pod.meetupTime)} · {podTimeLabel(pod.meetupTime)} · {pod.location}
            </Text>
            <View style={styles.reasonRow}>
              <Sticker
                label={reason}
                tint={pod.recommended ? colors.blueSoft : colors.greenSoft}
                textColor={pod.recommended ? colors.blue : colors.green}
                small
              />
            </View>
            <View style={styles.goingRow}>
              <AvatarStack names={memberAvatars(pod)} size={18} max={3} />
              <Text maxFontSizeMultiplier={2} style={[typography.captionSmall, { color: colors.sub }]}>
                {pod.members.length} going
              </Text>
            </View>
          </View>
        </Pressable>
        <Button
          label={joining ? 'Joining…' : 'Join'}
          onPress={onJoin}
          disabled={joining}
          size="sm"
        />
      </View>
    </Slab>
  );
}

function InviteSection({
  invites,
  friends,
  busyId,
  onRespond,
  onOpen,
}: {
  invites: PodInvite[];
  friends: FriendUser[];
  busyId: string | null;
  onRespond: (inviteId: string, accept: boolean) => void;
  onOpen: (podId: string) => void;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends]);
  if (!invites.length) return null;

  return (
    <View style={styles.section}>
      <Text maxFontSizeMultiplier={2} style={[styles.sectionLabel, { color: colors.ink }]}>Invites</Text>
      {invites.map((invite) => {
        const pod = invite.pod;
        const friendCount = pod ? friendCountForPod(pod, friendIds) : 0;
        const acceptBusy = busyId === `accept-${invite.id}`;
        return (
          <Slab
            key={invite.id}
            raised={false}
            faceStyle={styles.inviteShell}
          >
            <View
              style={[
                styles.inviteRow,
                accessibilityLayout && styles.inviteRowAccessible,
              ]}
            >
              <Pressable
                onPress={() => onOpen(invite.podId)}
                accessibilityRole="button"
                accessibilityLabel={`Open invite for ${pod ? displayPodTitle(pod) : 'pod'}`}
                style={({ pressed }) => [
                  styles.inviteOpen,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                {pod ? <PodThumbnail pod={pod} size={58} /> : null}
                <View style={styles.planCopy}>
                  <Text maxFontSizeMultiplier={2} style={[typography.heading, { color: colors.ink }]} numberOfLines={2}>
                    {pod ? displayPodTitle(pod) : 'Pod invite'}
                  </Text>
                  <Text maxFontSizeMultiplier={2} style={[typography.captionSmall, { color: colors.sub }]} numberOfLines={2}>
                    {invite.sender?.name ?? 'Someone'} invited you
                  </Text>
                  <Text maxFontSizeMultiplier={2} style={[typography.captionSmall, { color: colors.sub }]} numberOfLines={2}>
                    {friendCount
                      ? `${friendCount} mutual ${friendCount === 1 ? 'friend' : 'friends'}`
                      : pod
                        ? `${podDayLabel(pod.meetupTime)} · ${podTimeLabel(pod.meetupTime)}`
                        : 'Tap to see the plan'}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.inviteButtons}>
                <Pressable
                  onPress={() => onRespond(invite.id, true)}
                  disabled={Boolean(busyId)}
                  accessibilityRole="button"
                  accessibilityLabel="Accept invite"
                  style={({ pressed }) => [
                    styles.inviteButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.68 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={acceptBusy ? 'ellipsis-horizontal' : 'checkmark'}
                    size={18}
                    color={colors.onPrimary}
                  />
                </Pressable>
                <Pressable
                  onPress={() => onRespond(invite.id, false)}
                  disabled={Boolean(busyId)}
                  accessibilityRole="button"
                  accessibilityLabel="Decline invite"
                  style={({ pressed }) => [
                    styles.inviteButton,
                    {
                      backgroundColor: colors.surfaceAlt,
                      opacity: pressed ? 0.68 : 1,
                    },
                  ]}
                >
                  <Ionicons name="close" size={18} color={colors.sub} />
                </Pressable>
              </View>
            </View>
          </Slab>
        );
      })}
    </View>
  );
}

function EmptyPodsState() {
  const styles = useStyles();
  const { colors, typography } = useTheme();

  return (
    <Animated.View entering={FadeInDown.duration(motion.durBase)} style={styles.stateStack}>
      <View style={styles.heroIntro}>
        <SpotIllustration
          source={firstPlanSpot}
          accessibilityLabel="A student planning a first pod"
          height={142}
          style={styles.stateIllustration}
        />
        <Text maxFontSizeMultiplier={2} style={[styles.stateTitle, { color: colors.ink }]}>
          Your first plan can be simple
        </Text>
        <Text maxFontSizeMultiplier={2} style={[styles.stateBody, { color: colors.sub }]}>
          Start with one idea. We’ll help you turn it into a pod.
        </Text>
      </View>

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={2} style={[styles.sectionLabel, { color: colors.ink }]}>Three easy steps</Text>
        <Slab raised={false} faceStyle={styles.stepList}>
          {[
            ['checkmark-circle-outline', '1. Choose an idea', 'Pick a topic or activity you care about.'],
            ['time-outline', '2. Pick a time', 'Find a time that works for you.'],
            ['person-add-outline', '3. Invite people', 'Bring classmates into the conversation.'],
          ].map(([icon, title, body], index) => (
            <View
              key={title}
              style={[
                styles.stepRow,
                index > 0 && { borderTopColor: colors.borderSoft, borderTopWidth: BORDER_W },
              ]}
            >
              <View style={[styles.stepIcon, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons
                  name={icon as keyof typeof Ionicons.glyphMap}
                  size={21}
                  color={colors.sub}
                />
              </View>
              <View style={styles.actionCopy}>
                <Text maxFontSizeMultiplier={2} style={[typography.subheading, { color: colors.ink }]}>{title}</Text>
                <Text maxFontSizeMultiplier={2} style={[typography.captionSmall, { color: colors.sub }]}>{body}</Text>
              </View>
            </View>
          ))}
        </Slab>
      </View>

    </Animated.View>
  );
}

function DiscoveryState({
  density,
  pods,
  friends,
  busyPodId,
  onOpen,
  onJoin,
}: {
  density: 'low' | 'recommended';
  pods: Pod[];
  friends: FriendUser[];
  busyPodId: string | null;
  onOpen: (pod: Pod) => void;
  onJoin: (pod: Pod) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends]);
  const low = density === 'low';
  const visible = pods.slice(0, low ? 2 : 3);

  return (
    <Animated.View entering={FadeInDown.duration(motion.durBase)} style={styles.stateStack}>
      <View style={styles.heroIntro}>
        <SpotIllustration
          source={openWeekSpot}
          accessibilityLabel="A student checking an open calendar"
          height={136}
          style={styles.stateIllustration}
        />
        <Text maxFontSizeMultiplier={2} style={[styles.stateTitle, { color: colors.ink }]}>
          {low ? 'Nothing on your calendar yet' : 'Your week is still open'}
        </Text>
        <Text maxFontSizeMultiplier={2} style={[styles.stateBody, { color: colors.sub }]}>
          {low
            ? 'You aren’t in any pods right now. Here are a couple you might like.'
            : 'You don’t have any upcoming pods. Here are some picks for you.'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={2} style={[styles.sectionLabel, { color: colors.ink }]}>
          {low ? 'Two good fits' : 'Recommended for you'}
        </Text>
        <View style={styles.cardStack}>
          {visible.map((pod) => (
            <RecommendationRow
              key={pod.id}
              pod={pod}
              friendIds={friendIds}
              joining={busyPodId === pod.id}
              onOpen={() => onOpen(pod)}
              onJoin={() => onJoin(pod)}
            />
          ))}
        </View>
      </View>

    </Animated.View>
  );
}

function NextUpHero({
  pod,
  onOpen,
  onChat,
}: {
  pod: Pod;
  onOpen: () => void;
  onChat: () => void;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  return (
    <View style={[styles.nextUp, { backgroundColor: colors.primary }]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open next pod, ${displayPodTitle(pod)}`}
        style={({ pressed }) => [
          styles.nextUpMain,
          accessibilityLayout && styles.nextUpMainAccessible,
          { opacity: pressed ? 0.82 : 1 },
        ]}
      >
        <View style={styles.nextUpCopy}>
          <Text maxFontSizeMultiplier={2} style={[typography.kicker, { color: colors.onPrimary }]}>Next up</Text>
          <Text
            maxFontSizeMultiplier={2}
            style={[styles.nextUpTitle, { color: colors.onPrimary }]}
            numberOfLines={accessibilityLayout ? undefined : 2}
          >
            {displayPodTitle(pod)}
          </Text>
          <Text maxFontSizeMultiplier={2} style={[typography.bodyMedium, { color: colors.onPrimary }]} numberOfLines={2}>
            {podDayLabel(pod.meetupTime)} · {podTimeLabel(pod.meetupTime)}
          </Text>
          <Text maxFontSizeMultiplier={2} style={[typography.bodyMedium, { color: colors.onPrimary }]} numberOfLines={2}>
            {pod.location}
          </Text>
        </View>
        <View
          style={[
            styles.nextUpVisual,
            accessibilityLayout && styles.nextUpVisualAccessible,
          ]}
        >
          <PodThumbnail pod={pod} size={78} />
          <AvatarStack
            names={memberAvatars(pod)}
            size={28}
            max={3}
            onColor
            style={styles.nextUpAvatars}
          />
        </View>
      </Pressable>
      <Pressable
        onPress={onChat}
        accessibilityRole="button"
        accessibilityLabel={`Open ${displayPodTitle(pod)} chat`}
        style={({ pressed }) => [
          styles.chatButton,
          {
            backgroundColor: colors.onPrimary,
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        <Text
          maxFontSizeMultiplier={2}
          numberOfLines={2}
          style={[typography.button, styles.chatButtonLabel, { color: colors.primary }]}
        >
          Open chat
        </Text>
      </Pressable>
    </View>
  );
}

function MyPodsState({
  upcoming,
  onOpen,
  onChat,
}: {
  upcoming: Pod[];
  onOpen: (pod: Pod) => void;
  onChat: (pod: Pod) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const nextPod = upcoming[0];

  return (
    <Animated.View entering={FadeInDown.duration(motion.durBase)} style={styles.stateStack}>
      {nextPod ? (
        <NextUpHero
          pod={nextPod}
          onOpen={() => onOpen(nextPod)}
          onChat={() => onChat(nextPod)}
        />
      ) : null}

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={2} style={[styles.sectionLabel, { color: colors.ink }]}>Upcoming pods</Text>
        <View style={styles.cardStack}>
          {upcoming.length ? (
            upcoming.map((pod) => (
              <PlanRow
                key={pod.id}
                pod={pod}
                onOpen={() => onOpen(pod)}
              />
            ))
          ) : (
            <View style={[styles.inlineEmpty, { borderColor: colors.border }]}>
              <Text maxFontSizeMultiplier={2} style={[styles.stateBody, { color: colors.sub }]}>
                No upcoming pods right now.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

function PastPodsSection({
  pods,
  onOpen,
}: {
  pods: Pod[];
  onOpen: (pod: Pod) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!pods.length) return null;

  return (
    <View style={styles.section}>
      <Text maxFontSizeMultiplier={2} style={[styles.sectionLabel, { color: colors.ink }]}>Past pods</Text>
      <View style={styles.cardStack}>
        {pods.map((pod) => (
          <PlanRow
            key={pod.id}
            pod={pod}
            past
            onOpen={() => onOpen(pod)}
          />
        ))}
      </View>
    </View>
  );
}

function PodActions({
  onExplore,
  onCreate,
  onInvite,
}: {
  onExplore: () => void;
  onCreate: () => void;
  onInvite: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <Text maxFontSizeMultiplier={2} style={[styles.sectionLabel, { color: colors.ink }]}>More to do</Text>
      <View style={styles.cardStack}>
        <ActionRow
          icon="search-outline"
          title="Explore pods"
          body="Find something happening around campus."
          onPress={onExplore}
        />
        <ActionRow
          icon="add-circle-outline"
          title="Create a pod"
          body="Choose an activity and make a plan."
          onPress={onCreate}
        />
        <ActionRow
          icon="person-add-outline"
          title="Invite friends"
          body="Bring someone along."
          onPress={onInvite}
        />
      </View>
    </View>
  );
}

export default function PodsScreen({ previewData }: { previewData?: PodsPreviewData }) {
  const navigation = useNavigation<Nav>();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dockClearance = useDockClearance();
  const [refreshing, setRefreshing] = useState(false);
  const [activePods, setActivePods] = useState<Pod[]>(previewData?.activePods ?? []);
  const [historyPods, setHistoryPods] = useState<Pod[]>(previewData?.historyPods ?? []);
  const [feed, setFeed] = useState<Pod[]>(previewData?.feed ?? []);
  const [invites, setInvites] = useState<PodInvite[]>(previewData?.invites ?? []);
  const [friends, setFriends] = useState<FriendUser[]>(previewData?.friends ?? []);
  const [loaded, setLoaded] = useState(Boolean(previewData));
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const { join, busyPodId } = useJoinPod();

  const load = useCallback(async () => {
    if (previewData) {
      setActivePods(previewData.activePods);
      setHistoryPods(previewData.historyPods);
      setFeed(previewData.feed);
      setInvites(previewData.invites ?? []);
      setFriends(previewData.friends ?? []);
      setLoaded(true);
      setRefreshing(false);
      return;
    }

    const [mineResult, historyResult, feedResult, inviteResult, friendResult] =
      await Promise.allSettled([
        getMyPods(),
        getMyPodHistory(),
        fetchFeed({ limit: 50 }),
        getPodInvites(),
        getFriends(),
      ]);

    if (mineResult.status === 'fulfilled') setActivePods(mineResult.value);
    if (historyResult.status === 'fulfilled') setHistoryPods(historyResult.value);
    if (feedResult.status === 'fulfilled') setFeed(feedResult.value);
    if (inviteResult.status === 'fulfilled') setInvites(inviteResult.value);
    if (friendResult.status === 'fulfilled') setFriends(friendResult.value);

    const failedSections = [
      mineResult.status === 'rejected' ? 'your pods' : null,
      feedResult.status === 'rejected' ? 'recommendations' : null,
      inviteResult.status === 'rejected' ? 'invites' : null,
    ].filter((section): section is string => section != null);
    setLoadWarning(
      failedSections.length ? `Some sections could not refresh: ${failedSections.join(', ')}.` : null,
    );
    setLoaded(true);
    setRefreshing(false);
  }, [previewData]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const currentPods = useMemo(() => sortUpcomingPods(activePods), [activePods]);
  const history = useMemo(() => recentHistory(historyPods), [historyPods]);
  const discoveryPods = useMemo(() => {
    const mineIds = new Set(currentPods.map((pod) => pod.id));
    return feed.filter((pod) => !mineIds.has(pod.id));
  }, [currentPods, feed]);
  const density = podsDensityState(currentPods.length, feed.length);

  const openPod = useCallback(
    (pod: Pod) => navigation.navigate('PodDetail', { podId: pod.id }),
    [navigation],
  );
  const openChat = useCallback(
    (pod: Pod) => navigation.navigate('PodChat', { podId: pod.id }),
    [navigation],
  );
  const openPeople = useCallback(() => navigation.navigate('UserSearch'), [navigation]);
  const openExplore = useCallback(() => {
    if (previewData) {
      (
        navigation as unknown as {
          navigate: (screen: 'Explore') => void;
        }
      ).navigate('Explore');
      return;
    }
    navigation.navigate('MainTabs', { screen: 'Explore' });
  }, [navigation, previewData]);
  const openCreate = useCallback(() => {
    const params = { startCreate: Date.now() };
    if (previewData) {
      (
        navigation as unknown as {
          navigate: (
            screen: 'Explore',
            routeParams: { startCreate: number },
          ) => void;
        }
      ).navigate('Explore', params);
      return;
    }
    navigation.navigate('MainTabs', {
      screen: 'Explore',
      params,
    });
  }, [navigation, previewData]);
  const handleInvite = async (inviteId: string, accept: boolean) => {
    setBusyInviteId(`${accept ? 'accept' : 'decline'}-${inviteId}`);
    const previousInvites = invites;
    setInvites((current) => current.filter((invite) => invite.id !== inviteId));
    try {
      if (accept) {
        const pod = await acceptPodInvite(inviteId);
        navigation.navigate('PodDetail', { podId: pod.id });
      } else {
        await declinePodInvite(inviteId);
      }
      await load();
    } catch (error) {
      setInvites(previousInvites);
      toast.error('Could not update invite', getApiErrorMessage(error));
    } finally {
      setBusyInviteId(null);
    }
  };

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: dockClearance },
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
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={2}
            style={[styles.pageTitle, { color: colors.ink }]}
          >
            My Pods
          </Text>
          <Pressable
            onPress={openPeople}
            accessibilityRole="button"
            accessibilityLabel="Invite friends"
            hitSlop={10}
            style={({ pressed }) => [
              styles.headerButton,
              { opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Ionicons name="person-add-outline" size={23} color={colors.ink} />
          </Pressable>
        </View>

        {loadWarning ? <Banner message={loadWarning} kind="info" /> : null}

        {!loaded ? (
          <View style={styles.cardStack}>
            <SkeletonCard />
            <SkeletonCard compact />
            <SkeletonCard compact />
          </View>
        ) : (
          <>
            <InviteSection
              invites={invites}
              friends={friends}
              busyId={busyInviteId}
              onRespond={(inviteId, accept) => void handleInvite(inviteId, accept)}
              onOpen={(podId) => navigation.navigate('PodDetail', { podId })}
            />

            {density === 'zero' ? (
              <EmptyPodsState />
            ) : density === 'low' || density === 'recommended' ? (
              <DiscoveryState
                density={density}
                pods={discoveryPods}
                friends={friends}
                busyPodId={busyPodId}
                onOpen={openPod}
                onJoin={(pod) => void join(pod)}
              />
            ) : (
              <MyPodsState
                upcoming={currentPods}
                onOpen={openPod}
                onChat={openChat}
              />
            )}

            <PastPodsSection pods={history} onOpen={openPod} />
            <PodActions
              onExplore={openExplore}
              onCreate={openCreate}
              onInvite={openPeople}
            />
          </>
        )}
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  masthead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  pageTitle: {
    fontFamily: fonts.display,
    fontWeight: '800' as const,
    fontSize: 28,
    lineHeight: 34,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stateStack: {
    gap: spacing.lg,
  },
  heroIntro: {
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  stateIllustration: {
    width: '100%' as const,
    marginBottom: -spacing.sm,
  },
  stateTitle: {
    fontFamily: fonts.display,
    fontWeight: '800' as const,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center' as const,
  },
  stateBody: {
    fontFamily: fonts.body,
    fontWeight: '400' as const,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center' as const,
    maxWidth: 330,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontWeight: '700' as const,
    fontSize: 14,
    lineHeight: 19,
  },
  cardStack: {
    gap: spacing.sm,
  },
  stepList: {
    padding: 0,
    overflow: 'hidden' as const,
  },
  stepRow: {
    minHeight: 66,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  actionRow: {
    minHeight: 66,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  recommendationShell: {
    padding: 0,
    overflow: 'hidden' as const,
  },
  recommendationRow: {
    minHeight: 98,
    padding: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  recommendationRowAccessible: {
    flexDirection: 'column' as const,
    alignItems: 'stretch' as const,
  },
  recommendationOpen: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  recommendationCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  reasonRow: {
    marginTop: 2,
  },
  goingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  nextUp: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden' as const,
  },
  nextUpMain: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  nextUpMainAccessible: {
    flexDirection: 'column' as const,
    alignItems: 'stretch' as const,
  },
  nextUpCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nextUpTitle: {
    fontFamily: fonts.display,
    fontWeight: '800' as const,
    fontSize: 22,
    lineHeight: 27,
  },
  nextUpVisual: {
    alignItems: 'flex-end' as const,
  },
  nextUpVisualAccessible: {
    alignItems: 'flex-start' as const,
  },
  nextUpAvatars: {
    marginTop: -12,
    marginRight: 4,
  },
  chatButton: {
    alignSelf: 'stretch' as const,
    minWidth: 156,
    minHeight: 44,
    borderRadius: radii.button,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chatButtonLabel: {
    textAlign: 'center' as const,
  },
  planRow: {
    minHeight: 86,
    padding: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  planCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  planTrailing: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  unreadWrap: {
    position: 'relative' as const,
    width: 28,
    height: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  unreadBubble: {
    position: 'absolute' as const,
    right: -5,
    top: -5,
  },
  inlineEmpty: {
    minHeight: 94,
    borderRadius: radii.md,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing.lg,
  },
  inviteShell: {
    padding: 0,
    overflow: 'hidden' as const,
  },
  inviteRow: {
    minHeight: 86,
    padding: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  inviteRowAccessible: {
    flexDirection: 'column' as const,
    alignItems: 'stretch' as const,
  },
  inviteOpen: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  inviteButtons: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  inviteButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
}));
