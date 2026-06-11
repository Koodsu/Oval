import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchFeed,
  getApiErrorMessage,
  getFriends,
  getMyPodHistory,
  getMyPods,
  resolveAvatarUrl,
} from '../api';
import { RootStackParamList } from '../../App';
import { FriendUser, Pod } from '../types';
import {
  AppBackdrop,
  Avatar,
  AvatarStack,
  Button,
  Chip,
  EmptyState,
  IconButton,
  ProgressBar,
  SectionHeader,
  SkeletonCard,
  Slab,
  Sticker,
  accentForSeed,
} from '../components/ui';
import { formatShortDate, formatTime } from '../utils/format';
import { sortUpcomingPods } from '../utils/experience';
import {
  BORDER_W,
  DOCK_CLEARANCE,
  Theme,
  ThemeColors,
  createThemedStyles,
  fonts,
  motion,
  radii,
  spacing,
  useTheme,
} from '../theme';

type Mode = 'active' | 'past';
type Nav = NativeStackNavigationProp<RootStackParamList>;

function podStatusMeta(pod: Pod, colors: ThemeColors) {
  if (pod.status === 'COMPLETED') {
    return { label: 'Finished', tint: colors.blueSoft, icon: 'checkmark-circle' as const };
  }
  if (pod.status === 'LOCKED') {
    return { label: 'Locked in', tint: colors.successSoft, icon: 'sparkles' as const };
  }
  if (new Date(pod.meetupTime).getTime() <= Date.now()) {
    return { label: 'Happening now', tint: colors.successSoft, icon: 'flame' as const };
  }
  return { label: 'Starts soon', tint: colors.warningSoft, icon: 'time' as const };
}

function podIcon(pod: Pod): keyof typeof Ionicons.glyphMap {
  const source = `${pod.activity?.title ?? ''} ${pod.location}`;
  if (/basketball|hoops|volleyball|soccer|frisbee|tennis/i.test(source)) return 'basketball';
  if (/study|exam|homework|library/i.test(source)) return 'book';
  if (/jog|walk|trail|lake/i.test(source)) return 'walk';
  if (/coffee|boba|lunch|picnic|cooking/i.test(source)) return 'cafe';
  return 'people';
}

function displayPodTitle(pod: Pod) {
  return pod.activity?.title ?? 'Pod';
}

function friendCountForPod(pod: Pod, friends: FriendUser[]) {
  const friendIds = new Set(friends.map((friend) => friend.id));
  return pod.members.filter((member) => friendIds.has(member.userId)).length;
}

function friendCountLabel(pod: Pod, friends: FriendUser[]) {
  const count = friendCountForPod(pod, friends);
  if (count <= 0) return null;
  return `${count} friend${count === 1 ? '' : 's'} joined`;
}

function minutesUntil(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  const mins = Math.max(0, Math.round(diffMs / 60000));
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function activityFeedForFriends(friends: FriendUser[], pods: Pod[]) {
  const friendById = new Map(friends.map((friend) => [friend.id, friend]));
  return pods
    .flatMap((pod) =>
      pod.members
        .map((member) => {
          const friend = friendById.get(member.userId);
          return friend ? { friend, pod } : null;
        })
        .filter((item): item is { friend: FriendUser; pod: Pod } => item != null),
    )
    .slice(0, 8);
}

export default function PodsScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('active');
  const [activePods, setActivePods] = useState<Pod[]>([]);
  const [historyPods, setHistoryPods] = useState<Pod[]>([]);
  const [feedPods, setFeedPods] = useState<Pod[]>([]);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mine, history, feed, friendRows] = await Promise.all([
        getMyPods(),
        getMyPodHistory(),
        fetchFeed({ limit: 18 }),
        getFriends(),
      ]);
      setActivePods(mine);
      setHistoryPods(history);
      setFeedPods(feed);
      setFriends(friendRows);
    } catch (error) {
      Alert.alert('Could not load your pods', getApiErrorMessage(error));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const currentPods = useMemo(() => sortUpcomingPods(activePods), [activePods]);
  const pastPods = useMemo(() => sortUpcomingPods(historyPods), [historyPods]);
  const primaryPod = currentPods[0] ?? null;
  const extraActivePods = currentPods.slice(1);

  const suggestedPods = useMemo(() => {
    const activeIds = new Set(currentPods.map((pod) => pod.id));
    return sortUpcomingPods(
      feedPods.filter((pod) => pod.status === 'FORMING' && !activeIds.has(pod.id)),
    );
  }, [currentPods, feedPods]);

  const startingSoonPods = suggestedPods.slice(0, 4);
  const moreOpenPods = suggestedPods.slice(4, 9).length
    ? suggestedPods.slice(4, 9)
    : suggestedPods.slice(0, 5);
  const friendActivity = useMemo(
    () => activityFeedForFriends(friends, suggestedPods.length ? suggestedPods : currentPods),
    [friends, currentPods, suggestedPods],
  );
  const pastItems = mode === 'past' ? pastPods : [];
  const quickStartActivity =
    suggestedPods.find((pod) => pod.activity)?.activity ??
    currentPods.find((pod) => pod.activity)?.activity ??
    null;

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Masthead */}
        <Animated.View entering={FadeInDown.duration(motion.durBase)}>
          <View style={styles.masthead}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.kicker, { color: colors.primary }]}>YOUR PLANS</Text>
              <Text style={styles.pageTitle}>PODS.</Text>
            </View>
            <IconButton
              icon="add"
              size={48}
              color={colors.primary}
              iconColor={colors.onPrimary}
              accessibilityLabel="Start a pod"
              onPress={() =>
                quickStartActivity
                  ? navigation.navigate('ActivityPods', {
                      activity: quickStartActivity,
                      startCreate: true,
                    })
                  : navigation.navigate('MainTabs', { screen: 'Explore' })
              }
            />
          </View>
        </Animated.View>

        {/* Active / Past switch */}
        <Animated.View
          entering={FadeInDown.delay(motion.stagger).duration(motion.durBase)}
          style={styles.modeRow}
        >
          <Chip label="Active" selected={mode === 'active'} onPress={() => setMode('active')} />
          <Chip label="Past" selected={mode === 'past'} onPress={() => setMode('past')} />
        </Animated.View>

        {mode === 'active' ? (
          <>
            <Animated.View
              entering={FadeInDown.delay(motion.stagger * 2).duration(motion.durBase)}
              style={styles.section}
            >
              <SectionHeader kicker="On deck" title="Your active pods" />

              {!loaded ? (
                <SkeletonCard />
              ) : primaryPod ? (
                (() => {
                  const status = podStatusMeta(primaryPod, colors);
                  const primaryFriendLabel = friendCountLabel(primaryPod, friends);
                  return (
                    <Slab
                      onPress={() => navigation.navigate('PodDetail', { podId: primaryPod.id })}
                      radius={radii.lg}
                      faceStyle={styles.primaryFace}
                      accessibilityLabel={displayPodTitle(primaryPod)}
                    >
                      <View style={styles.primaryTop}>
                        <Sticker label={status.label} tint={status.tint} icon={status.icon} tilt={-2} />
                        <Text style={styles.primaryCount}>
                          {primaryPod.members.length}/{primaryPod.maxMembers}
                        </Text>
                      </View>
                      <Text style={styles.primaryTitle} numberOfLines={2}>
                        {displayPodTitle(primaryPod).toUpperCase()}
                      </Text>
                      <ProgressBar
                        value={primaryPod.members.length / Math.max(1, primaryPod.maxMembers)}
                        height={10}
                      />
                      <View style={styles.detailRow}>
                        <Ionicons name="location" size={15} color={colors.sub} />
                        <Text style={typography.bodyMedium} numberOfLines={1}>
                          {primaryPod.location}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Ionicons name="calendar" size={15} color={colors.sub} />
                        <Text style={typography.bodyMedium}>
                          {formatShortDate(primaryPod.meetupTime)} at {formatTime(primaryPod.meetupTime)}
                        </Text>
                      </View>
                      <View style={styles.primaryFooter}>
                        <AvatarStack
                          names={primaryPod.members.slice(0, 4).map((member) => ({
                            name: member.user.name,
                            uri: resolveAvatarUrl(member.user.avatarUrl),
                          }))}
                          size={32}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={typography.caption}>
                            {primaryPod.members.length} of {primaryPod.maxMembers} spots filled
                          </Text>
                          {primaryFriendLabel ? (
                            <Text style={[typography.captionSmall, { color: colors.primary }]}>
                              {primaryFriendLabel}
                            </Text>
                          ) : null}
                        </View>
                        <Button
                          label="Open"
                          size="sm"
                          onPress={() => navigation.navigate('PodDetail', { podId: primaryPod.id })}
                        />
                      </View>
                    </Slab>
                  );
                })()
              ) : (
                <EmptyState
                  icon="flash"
                  title="Nothing planned yet tonight"
                  body="Explore shows open pods pulled from the live feed."
                  actionLabel="Find something now"
                  onAction={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
                />
              )}

              {extraActivePods.length
                ? extraActivePods.map((pod) => {
                    const podFriendLabel = friendCountLabel(pod, friends);
                    return (
                      <Slab
                        key={pod.id}
                        onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                        faceStyle={styles.rowFace}
                        accessibilityLabel={displayPodTitle(pod)}
                      >
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={typography.heading} numberOfLines={1}>
                            {displayPodTitle(pod)}
                          </Text>
                          <Text style={typography.caption} numberOfLines={1}>
                            {pod.location}
                          </Text>
                          <Text style={typography.captionSmall}>
                            {[`${pod.members.length} going`, podFriendLabel].filter(Boolean).join(' • ')}
                          </Text>
                        </View>
                        <Sticker
                          label={minutesUntil(pod.meetupTime)}
                          tint={colors.warningSoft}
                          tilt={2}
                          small
                        />
                      </Slab>
                    );
                  })
                : null}
            </Animated.View>

            {!loaded || startingSoonPods.length ? (
              <Animated.View
                entering={FadeInDown.delay(motion.stagger * 3).duration(motion.durBase)}
                style={styles.section}
              >
                <SectionHeader
                  kicker="Countdown"
                  title="Starting soon"
                  actionLabel={startingSoonPods.length ? 'See all' : undefined}
                  onAction={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
                />
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
                    {startingSoonPods.map((pod, index) => {
                      const accent = accentForSeed(colors, displayPodTitle(pod));
                      return (
                        <Slab
                          key={pod.id}
                          onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                          color={accent.soft}
                          tilt={index % 2 === 0 ? -0.8 : 0.8}
                          style={styles.soonCard}
                          faceStyle={styles.soonFace}
                          accessibilityLabel={displayPodTitle(pod)}
                        >
                          <View style={styles.soonTop}>
                            <View
                              style={[
                                styles.soonIcon,
                                { backgroundColor: colors.surface, borderColor: colors.border },
                              ]}
                            >
                              <Ionicons name={podIcon(pod)} size={20} color={accent.tint} />
                            </View>
                            <Sticker
                              label={`in ${minutesUntil(pod.meetupTime)}`}
                              tint={colors.primary}
                              textColor={colors.onPrimary}
                              tilt={3}
                              small
                            />
                          </View>
                          <Text style={typography.heading} numberOfLines={1}>
                            {displayPodTitle(pod)}
                          </Text>
                          <Text style={typography.caption} numberOfLines={1}>
                            {pod.location}
                          </Text>
                          <View style={styles.soonFooter}>
                            <AvatarStack
                              names={pod.members.slice(0, 3).map((member) => ({
                                name: member.user.name,
                                uri: resolveAvatarUrl(member.user.avatarUrl),
                              }))}
                              size={24}
                            />
                            <Text style={typography.captionSmall}>{pod.members.length} going</Text>
                          </View>
                        </Slab>
                      );
                    })}
                  </ScrollView>
                )}
              </Animated.View>
            ) : null}

            {!loaded || friendActivity.length ? (
              <Animated.View
                entering={FadeInDown.delay(motion.stagger * 4).duration(motion.durBase)}
                style={styles.section}
              >
                <SectionHeader kicker="Your people" title="Friends in pods" />
                {!loaded ? (
                  <SkeletonCard compact />
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.rail}
                  >
                    {friendActivity.map((item) => (
                      <Slab
                        key={`${item.friend.id}-${item.pod.id}`}
                        onPress={() => navigation.navigate('PodDetail', { podId: item.pod.id })}
                        style={styles.friendCard}
                        faceStyle={styles.friendFace}
                        accessibilityLabel={`${item.friend.name} is in ${displayPodTitle(item.pod)}`}
                      >
                        <Avatar
                          name={item.friend.name}
                          uri={resolveAvatarUrl(item.friend.avatarUrl)}
                          size={42}
                          tilt={-2}
                        />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={typography.subheading} numberOfLines={1}>
                            {item.friend.firstName ?? item.friend.name}
                          </Text>
                          <Text style={typography.captionSmall}>is in this pod</Text>
                          <Text
                            style={[typography.caption, { color: colors.primary, fontFamily: fonts.bold }]}
                            numberOfLines={1}
                          >
                            {displayPodTitle(item.pod)}
                          </Text>
                        </View>
                      </Slab>
                    ))}
                  </ScrollView>
                )}
              </Animated.View>
            ) : null}

            {!loaded || moreOpenPods.length ? (
              <Animated.View
                entering={FadeInDown.delay(motion.stagger * 5).duration(motion.durBase)}
                style={styles.section}
              >
                <SectionHeader kicker="Keep scrolling" title="More open pods" />
                {!loaded ? (
                  <SkeletonCard compact />
                ) : (
                  moreOpenPods.map((pod) => {
                    const accent = accentForSeed(colors, displayPodTitle(pod));
                    return (
                      <Slab
                        key={pod.id}
                        onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                        faceStyle={styles.rowFace}
                        accessibilityLabel={displayPodTitle(pod)}
                      >
                        <View
                          style={[
                            styles.rowIcon,
                            { backgroundColor: accent.soft, borderColor: colors.border },
                          ]}
                        >
                          <Ionicons name={podIcon(pod)} size={18} color={accent.tint} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text style={typography.heading} numberOfLines={1}>
                            {displayPodTitle(pod)}
                          </Text>
                          <Text style={typography.caption} numberOfLines={1}>
                            {pod.location}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 3 }}>
                          <Text style={[typography.caption, { color: colors.primary, fontFamily: fonts.bold }]}>
                            in {minutesUntil(pod.meetupTime)}
                          </Text>
                          <Text style={typography.captionSmall}>{pod.members.length} going</Text>
                        </View>
                      </Slab>
                    );
                  })
                )}
              </Animated.View>
            ) : null}
          </>
        ) : (
          <Animated.View
            entering={FadeInDown.delay(motion.stagger * 2).duration(motion.durBase)}
            style={styles.section}
          >
            <SectionHeader kicker="The archive" title="Past pods" />
            {pastItems.length ? (
              pastItems.map((pod) => (
                <Slab
                  key={pod.id}
                  onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                  faceStyle={styles.rowFace}
                  accessibilityLabel={displayPodTitle(pod)}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={typography.heading} numberOfLines={1}>
                      {displayPodTitle(pod)}
                    </Text>
                    <Text style={typography.caption} numberOfLines={1}>
                      {pod.location}
                    </Text>
                    <Text style={typography.captionSmall}>
                      {formatShortDate(pod.meetupTime)} at {formatTime(pod.meetupTime)} •{' '}
                      {pod.members.length} went
                    </Text>
                  </View>
                  <Sticker
                    label={pod.status === 'COMPLETED' ? 'Done' : 'Closed'}
                    tint={colors.blueSoft}
                    tilt={2}
                    small
                  />
                </Slab>
              ))
            ) : (
              <EmptyState
                icon="time"
                title="No past pods yet"
                body="Completed pods and recaps land here once you start joining plans."
              />
            )}
          </Animated.View>
        )}
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: DOCK_CLEARANCE,
    gap: spacing.lg,
  },
  masthead: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
  },
  pageTitle: {
    fontFamily: fonts.displayHeavy,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -1,
    color: t.colors.ink,
    marginTop: 4,
  },
  modeRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  section: {
    gap: spacing.md,
  },
  primaryFace: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  primaryTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  primaryCount: {
    fontFamily: fonts.displayMedium,
    fontSize: 17,
    color: t.colors.ink,
  },
  primaryTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.5,
    color: t.colors.ink,
  },
  detailRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  primaryFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    marginTop: 2,
  },
  rowFace: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    padding: spacing.md,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  rail: {
    gap: spacing.md,
    paddingRight: spacing.xl,
    paddingVertical: 4,
  },
  soonCard: {
    width: 250,
  },
  soonFace: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  soonTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  soonIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  soonFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: 2,
  },
  friendCard: {
    width: 240,
  },
  friendFace: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    padding: spacing.md,
  },
}));
