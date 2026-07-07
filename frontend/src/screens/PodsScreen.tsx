import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  acceptPodInvite,
  declinePodInvite,
  getApiErrorMessage,
  getFriends,
  getMyPodHistory,
  getMyPods,
  getPodInvites,
} from '../api';
import { RootStackParamList } from '../../App';
import { FriendUser, Pod, PodInvite } from '../types';
import CreateSheet from '../components/CreateSheet';
import {
  AppBackdrop,
  Avatar,
  AvatarStack,
  Banner,
  Button,
  CountBubble,
  EmptyState,
  IconButton,
  SectionHeader,
  SkeletonCard,
  Slab,
  StatusTag,
  accentForSeed,
} from '../components/ui';
import { formatShortDate, formatTime } from '../utils/format';
import { sortUpcomingPods } from '../utils/experience';
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

type Nav = NativeStackNavigationProp<RootStackParamList>;

type PodWithUnread = Pod & {
  unreadCount?: number;
  chatUnreadCount?: number;
  unreadChatCount?: number;
};

function displayPodTitle(pod: Pod) {
  return pod.activity?.title ?? 'Pod';
}

function podIcon(pod: Pod): keyof typeof Ionicons.glyphMap {
  const source = `${pod.activity?.title ?? ''} ${pod.activity?.category ?? ''} ${pod.location}`;
  if (/basketball|hoops|volleyball|soccer|frisbee|tennis|sports|fitness/i.test(source)) {
    return 'basketball-outline';
  }
  if (/study|exam|homework|library|academic/i.test(source)) return 'book-outline';
  if (/jog|walk|trail|outdoor|lake/i.test(source)) return 'walk-outline';
  if (/coffee|boba|lunch|picnic|cooking|food|drink/i.test(source)) return 'cafe-outline';
  if (/music|movie|show|entertainment/i.test(source)) return 'musical-notes-outline';
  return 'people-outline';
}

function memberAvatars(pod: Pod) {
  return pod.members.map((member) => ({
    name: member.user.name,
    uri: member.user.avatarUrl,
  }));
}

function podWhenLine(pod: Pod) {
  return `${pod.location} · ${formatShortDate(pod.meetupTime)} at ${formatTime(pod.meetupTime)}`;
}

function historyWhenLine(pod: Pod) {
  return `${formatShortDate(pod.meetupTime)} at ${formatTime(pod.meetupTime)} · ${pod.members.length} went`;
}

function unreadCountForPod(pod: Pod) {
  const candidate = pod as PodWithUnread;
  const value = candidate.unreadCount ?? candidate.chatUnreadCount ?? candidate.unreadChatCount;
  return typeof value === 'number' && value > 0 ? value : 0;
}

function friendCountForPod(pod: Pod | undefined, friends: FriendUser[]) {
  if (!pod) return 0;
  const friendIds = new Set(friends.map((friend) => friend.id));
  return pod.members.filter((member) => friendIds.has(member.userId)).length;
}

function inviteContextLine(invite: PodInvite, friends: FriendUser[]) {
  const mutuals = friendCountForPod(invite.pod, friends);
  if (mutuals > 0) {
    return `${mutuals} mutual friend${mutuals === 1 ? '' : 's'}`;
  }
  if (invite.pod) {
    return podWhenLine(invite.pod);
  }
  return 'Pod invite';
}

function recentHistory(pods: Pod[]) {
  return [...pods]
    .filter((pod) => pod.status === 'COMPLETED' || pod.status === 'EXPIRED' || pod.status === 'CANCELLED')
    .sort((a, b) => new Date(b.meetupTime).getTime() - new Date(a.meetupTime).getTime());
}

function CircleAction({
  icon,
  label,
  onPress,
  primary,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Slab
      onPress={onPress}
      disabled={disabled}
      color={primary ? colors.primary : colors.surfaceAlt}
      radius={radii.pill}
      raised={false}
      faceStyle={circleActionStyles.face}
      accessibilityLabel={label}
    >
      <Ionicons
        name={icon}
        size={18}
        color={primary ? colors.onPrimary : colors.sub}
      />
    </Slab>
  );
}

const circleActionStyles = {
  face: {
    width: 38,
    height: 38,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};

export default function PodsScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [activePods, setActivePods] = useState<Pod[]>([]);
  const [historyPods, setHistoryPods] = useState<Pod[]>([]);
  const [invites, setInvites] = useState<PodInvite[]>([]);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    const [mineResult, historyResult, inviteResult, friendResult] = await Promise.allSettled([
      getMyPods(),
      getMyPodHistory(),
      getPodInvites(),
      getFriends(),
    ]);

    if (mineResult.status === 'fulfilled') {
      setActivePods(mineResult.value);
    }
    if (historyResult.status === 'fulfilled') {
      setHistoryPods(historyResult.value);
    }
    if (inviteResult.status === 'fulfilled') {
      setInvites(inviteResult.value);
    }
    if (friendResult.status === 'fulfilled') {
      setFriends(friendResult.value);
    }

    const failedSections = [
      mineResult.status === 'rejected' ? 'active plans' : null,
      historyResult.status === 'rejected' ? 'history' : null,
      inviteResult.status === 'rejected' ? 'invites' : null,
      friendResult.status === 'rejected' ? 'friends' : null,
    ].filter((section): section is string => section != null);

    setLoadWarning(
      failedSections.length
        ? `Some plans could not refresh: ${failedSections.join(', ')}.`
        : null,
    );
    setLoaded(true);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const currentPods = useMemo(() => sortUpcomingPods(activePods), [activePods]);
  const history = useMemo(() => recentHistory(historyPods), [historyPods]);
  const shownHistory = historyExpanded ? history : history.slice(0, 3);

  const openDiscover = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Explore' });
  }, [navigation]);

  const handleInvite = async (inviteId: string, accept: boolean) => {
    setBusyId(`${accept ? 'accept' : 'decline'}-${inviteId}`);
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
      Alert.alert('Could not update invite', getApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Animated.View entering={FadeInDown.duration(motion.durBase)}>
          <View style={styles.masthead}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.kicker, { color: colors.accentText }]}>ON YOUR CALENDAR</Text>
              <Text style={styles.pageTitle}>Plans</Text>
            </View>
            <IconButton
              icon="add"
              size={48}
              color={colors.primary}
              iconColor={colors.onPrimary}
              accessibilityLabel="Start a pod"
              onPress={() => setCreateOpen(true)}
            />
          </View>
        </Animated.View>

        {loadWarning ? (
          <View style={{ gap: spacing.sm }}>
            <Banner message={loadWarning} kind="info" />
            <Button label="Try again" size="sm" variant="secondary" onPress={() => void load()} />
          </View>
        ) : null}

        <Animated.View
          entering={FadeInDown.delay(motion.stagger).duration(motion.durBase)}
          style={styles.section}
        >
          <SectionHeader title="Active" />
          {!loaded ? (
            <>
              <SkeletonCard compact />
              <SkeletonCard compact />
            </>
          ) : currentPods.length ? (
            currentPods.map((pod, index) => {
              const accent = accentForSeed(colors, displayPodTitle(pod));
              const unreadCount = unreadCountForPod(pod);
              return (
                <Animated.View
                  key={pod.id}
                  entering={FadeInDown.delay(Math.min(index, 5) * motion.stagger).duration(
                    motion.durBase,
                  )}
                >
                  <Slab
                    onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                    faceStyle={styles.planRowFace}
                    accessibilityLabel={displayPodTitle(pod)}
                  >
                    <View
                      style={[
                        styles.iconWell,
                        { backgroundColor: accent.soft, borderColor: colors.border },
                      ]}
                    >
                      <Ionicons name={podIcon(pod)} size={20} color={accent.tint} />
                    </View>
                    <View style={styles.rowCopy}>
                      <View style={styles.titleLine}>
                        <Text style={[typography.heading, { flexShrink: 1 }]} numberOfLines={1}>
                          {displayPodTitle(pod)}
                        </Text>
                        {unreadCount > 0 ? <CountBubble count={unreadCount} /> : null}
                      </View>
                      <Text style={typography.caption} numberOfLines={1}>
                        {podWhenLine(pod)}
                      </Text>
                      <View style={styles.memberLine}>
                        <AvatarStack names={memberAvatars(pod)} size={24} max={3} />
                        <Text style={typography.captionSmall} numberOfLines={1}>
                          {pod.members.length} of {pod.maxMembers} in
                        </Text>
                      </View>
                    </View>
                    <StatusTag status={pod.status} style={styles.statusTag} />
                  </Slab>
                </Animated.View>
              );
            })
          ) : (
            <View style={styles.emptyActions}>
              <EmptyState
                icon="calendar-outline"
                title="Nothing planned yet"
                body="Find something forming nearby or start a pod when you have a spot in mind."
                actionLabel="Find a pod"
                onAction={openDiscover}
                style={styles.emptyState}
              />
              <Button
                label="Start one"
                variant="secondary"
                icon="add"
                onPress={() => setCreateOpen(true)}
                style={styles.secondaryEmptyAction}
              />
            </View>
          )}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(motion.stagger * 2).duration(motion.durBase)}
          style={styles.section}
        >
          <SectionHeader title="Invites" />
          {!loaded ? (
            <SkeletonCard compact />
          ) : invites.length ? (
            invites.map((invite, index) => {
              const title = invite.pod ? displayPodTitle(invite.pod) : 'Pod invite';
              const acceptBusy = busyId === `accept-${invite.id}`;
              const declineBusy = busyId === `decline-${invite.id}`;
              return (
                <Animated.View
                  key={invite.id}
                  entering={FadeInDown.delay(Math.min(index, 5) * motion.stagger).duration(
                    motion.durBase,
                  )}
                >
                  <Slab
                    onPress={() => navigation.navigate('PodDetail', { podId: invite.podId })}
                    faceStyle={styles.inviteFace}
                    accessibilityLabel={`Open invite for ${title}`}
                  >
                    <Avatar
                      name={invite.sender?.name ?? 'Someone'}
                      uri={invite.sender?.avatarUrl}
                      size={44}
                    />
                    <View style={styles.rowCopy}>
                      <Text style={typography.heading} numberOfLines={1}>
                        {title}
                      </Text>
                      <Text style={typography.caption} numberOfLines={1}>
                        {invite.sender?.name ?? 'Someone'} invited you
                      </Text>
                      <Text style={typography.captionSmall} numberOfLines={1}>
                        {inviteContextLine(invite, friends)}
                      </Text>
                    </View>
                    <View style={styles.inviteActions}>
                      <CircleAction
                        icon={acceptBusy ? 'ellipsis-horizontal' : 'checkmark'}
                        label={`Accept invite for ${title}`}
                        primary
                        disabled={Boolean(busyId)}
                        onPress={() => void handleInvite(invite.id, true)}
                      />
                      <CircleAction
                        icon={declineBusy ? 'ellipsis-horizontal' : 'close'}
                        label={`Decline invite for ${title}`}
                        disabled={Boolean(busyId)}
                        onPress={() => void handleInvite(invite.id, false)}
                      />
                    </View>
                  </Slab>
                </Animated.View>
              );
            })
          ) : (
            <EmptyState
              icon="mail-open-outline"
              title="No pod invites"
              body="Invites from friends will stay here until you answer."
              actionLabel="Find people"
              onAction={() => navigation.navigate('UserSearch')}
              tint={colors.surfaceAlt}
              style={styles.compactEmptyState}
            />
          )}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(motion.stagger * 3).duration(motion.durBase)}
          style={styles.section}
        >
          <SectionHeader
            title="History"
            actionLabel={
              history.length > 3
                ? historyExpanded
                  ? 'Show less'
                  : 'View all'
                : undefined
            }
            onAction={() => setHistoryExpanded((expanded) => !expanded)}
          />
          {!loaded ? (
            <SkeletonCard compact />
          ) : shownHistory.length ? (
            shownHistory.map((pod, index) => {
              const needsRecap = pod.status === 'COMPLETED' && !pod.myRecap;
              return (
                <Animated.View
                  key={pod.id}
                  entering={FadeInDown.delay(Math.min(index, 5) * motion.stagger).duration(
                    motion.durBase,
                  )}
                >
                  <Slab
                    onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                    faceStyle={styles.planRowFace}
                    accessibilityLabel={displayPodTitle(pod)}
                  >
                    <View
                      style={[
                        styles.iconWell,
                        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                      ]}
                    >
                      <Ionicons
                        name={pod.status === 'COMPLETED' ? 'checkmark-circle-outline' : 'time-outline'}
                        size={20}
                        color={pod.status === 'COMPLETED' ? colors.success : colors.sub}
                      />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={typography.heading} numberOfLines={1}>
                        {displayPodTitle(pod)}
                      </Text>
                      <Text style={typography.caption} numberOfLines={1}>
                        {pod.location}
                      </Text>
                      <Text style={typography.captionSmall} numberOfLines={1}>
                        {historyWhenLine(pod)}
                      </Text>
                    </View>
                    <View style={styles.historyRight}>
                      <StatusTag status={pod.status} style={styles.statusTag} />
                      {needsRecap ? (
                        <Pressable
                          onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                          accessibilityRole="button"
                          accessibilityLabel={`Rate ${displayPodTitle(pod)}`}
                          hitSlop={8}
                          style={({ pressed }) => [
                            styles.rateChip,
                            {
                              backgroundColor: colors.primarySoft,
                              opacity: pressed ? 0.62 : 1,
                            },
                          ]}
                        >
                          <Text style={[styles.rateText, { color: colors.accentText }]}>Rate it</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </Slab>
                </Animated.View>
              );
            })
          ) : (
            <EmptyState
              icon="time-outline"
              title="No history yet"
              body="Completed and expired plans will collect here."
              actionLabel="Find a pod"
              onAction={openDiscover}
              tint={colors.surfaceAlt}
              style={styles.compactEmptyState}
            />
          )}
        </Animated.View>
      </ScrollView>
      <CreateSheet visible={createOpen} onClose={() => setCreateOpen(false)} />
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
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  pageTitle: {
    fontFamily: fonts.display,
    fontWeight: '800' as const,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 0,
    color: t.colors.ink,
    marginTop: 4,
  },
  section: {
    gap: spacing.md,
  },
  planRowFace: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    padding: spacing.md,
  },
  inviteFace: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    padding: spacing.md,
  },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleLine: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    minWidth: 0,
  },
  memberLine: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginTop: 2,
  },
  statusTag: {
    flexShrink: 0,
  },
  inviteActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  historyRight: {
    alignItems: 'flex-end' as const,
    gap: spacing.sm,
  },
  rateChip: {
    minHeight: 30,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  rateText: {
    fontFamily: fonts.semibold,
    fontWeight: '600' as const,
    fontSize: 12,
  },
  emptyActions: {
    alignItems: 'center' as const,
  },
  emptyState: {
    paddingBottom: spacing.md,
  },
  compactEmptyState: {
    paddingVertical: spacing.xxl,
  },
  secondaryEmptyAction: {
    alignSelf: 'center' as const,
    minWidth: 180,
  },
}));
