import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchFeed, getApiErrorMessage, getFriends, getMyPodHistory, getMyPods, resolveAvatarUrl } from '../api';
import { RootStackParamList } from '../../App';
import { FriendUser, Pod, PodMember } from '../types';
import { EmptyState, Entrance, IconButton, Screen, SectionHeader, SkeletonCard, Tap } from '../components/ui';
import { formatShortDate, formatTime, getInitials } from '../utils/format';
import { sortUpcomingPods } from '../utils/experience';
import { Theme, ThemeColors, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';

type Mode = 'active' | 'past';
type Nav = NativeStackNavigationProp<RootStackParamList>;

function podStatusMeta(pod: Pod, colors: ThemeColors) {
  if (pod.status === 'COMPLETED') {
    return { label: 'Finished', bg: colors.blueSoft, text: colors.blue, icon: 'checkmark-circle-outline' as const };
  }
  if (pod.status === 'LOCKED') {
    return { label: 'Locked in', bg: colors.successBg, text: colors.successText, icon: 'sparkles-outline' as const };
  }
  if (new Date(pod.meetupTime).getTime() <= Date.now()) {
    return { label: 'Happening now', bg: colors.successBg, text: colors.successText, icon: 'flame-outline' as const };
  }
  return { label: 'Starts soon', bg: colors.warnBg, text: colors.warnText, icon: 'time-outline' as const };
}

function podIcon(pod: Pod): keyof typeof Ionicons.glyphMap {
  const source = `${pod.activity?.title ?? ''} ${pod.location}`;
  if (/basketball|hoops|volleyball|soccer|frisbee|tennis/i.test(source)) return 'basketball-outline';
  if (/study|exam|homework|library/i.test(source)) return 'book-outline';
  if (/jog|walk|trail|lake/i.test(source)) return 'walk-outline';
  if (/coffee|boba|lunch|picnic|cooking/i.test(source)) return 'cafe-outline';
  return 'people-outline';
}

function displayPodTitle(pod: Pod) {
  return pod.activity?.title ?? 'Pod';
}

function spotsFilledLabel(pod: Pod) {
  return `${pod.members.length} of ${pod.maxMembers} spots filled`;
}

function progressWidth(pod: Pod): `${number}%` {
  return `${Math.max(8, Math.min(100, (pod.members.length / Math.max(1, pod.maxMembers)) * 100))}%`;
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

function podDescriptors(pod: Pod) {
  const title = (pod.activity?.title ?? '').toLowerCase();
  if (title.includes('jog') || title.includes('walk')) return ['Walk/run', 'Campus meetup', 'Open spots'];
  if (title.includes('study') || title.includes('exam') || title.includes('homework')) return ['Study', 'Bring your work', 'Open spots'];
  if (title.includes('basketball') || title.includes('soccer') || title.includes('frisbee')) return ['Sport', 'Drop in', 'Open spots'];
  if (title.includes('coffee') || title.includes('lunch') || title.includes('boba')) return ['Food or coffee', 'Conversation', 'Open spots'];
  return ['Open invite', 'Campus meetup', 'Open spots'];
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
  return pods.flatMap((pod) => (
    pod.members
      .map((member) => {
        const friend = friendById.get(member.userId);
        return friend ? { friend, pod } : null;
      })
      .filter((item): item is { friend: FriendUser; pod: Pod } => item != null)
  )).slice(0, 8);
}

function Avatar({ member, size = 32 }: { member: PodMember; size?: number }) {
  const styles = useStyles();
  const uri = resolveAvatarUrl(member.user.avatarUrl);
  const initials = getInitials(member.user.name);
  if (uri) {
    return <Image source={{ uri }} style={[styles.realAvatar, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.initialAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.initialAvatarText}>{initials}</Text>
    </View>
  );
}

function FriendAvatar({ friend, size = 44 }: { friend: FriendUser; size?: number }) {
  const styles = useStyles();
  const uri = resolveAvatarUrl(friend.avatarUrl);
  const initials = getInitials(friend.name);
  if (uri) {
    return <Image source={{ uri }} style={[styles.realAvatar, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.initialAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.initialAvatarText}>{initials}</Text>
    </View>
  );
}

export default function PodsScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useStyles();
  const { colors, isDark } = useTheme();
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
    }, [load])
  );

  const currentPods = useMemo(() => sortUpcomingPods(activePods), [activePods]);
  const pastPods = useMemo(() => sortUpcomingPods(historyPods), [historyPods]);
  const primaryPod = currentPods[0] ?? null;
  const extraActivePods = currentPods.slice(1);

  const suggestedPods = useMemo(() => {
    const activeIds = new Set(currentPods.map((pod) => pod.id));
    return sortUpcomingPods(
      feedPods.filter((pod) => pod.status === 'FORMING' && !activeIds.has(pod.id))
    );
  }, [currentPods, feedPods]);

  const startingSoonPods = suggestedPods.slice(0, 4);
  const moreOpenPods = suggestedPods.slice(4, 9).length ? suggestedPods.slice(4, 9) : suggestedPods.slice(0, 5);
  const friendActivity = useMemo(() => activityFeedForFriends(friends, suggestedPods.length ? suggestedPods : currentPods), [friends, currentPods, suggestedPods]);
  const pastItems = mode === 'past' ? pastPods : [];
  const quickStartActivity = suggestedPods.find((pod) => pod.activity)?.activity
    ?? currentPods.find((pod) => pod.activity)?.activity
    ?? null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.pageEyebrow}>Your plans</Text>
            <Text style={styles.pageTitle}>Pods</Text>
          </View>
	          <IconButton
	            icon="add"
	            tooltip="Start a pod"
	            size={46}
	            iconSize={24}
	            onPress={() => quickStartActivity
	              ? navigation.navigate('ActivityPods', { activity: quickStartActivity, startCreate: true })
	              : navigation.navigate('MainTabs', { screen: 'Explore' })}
	          />
        </View>

        <View style={styles.modeTabs}>
          {([
            { value: 'active' as const, label: 'Active' },
            { value: 'past' as const, label: 'Past' },
          ]).map((item) => {
            const active = mode === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={styles.modeTab}
                activeOpacity={0.85}
                onPress={() => setMode(item.value)}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{item.label}</Text>
                <View style={[styles.modeUnderline, active && styles.modeUnderlineActive]} />
              </TouchableOpacity>
            );
          })}
        </View>

        {mode === 'active' ? (
          <>
            <View style={styles.section}>
              <SectionHeader
                title="Your active pods"
              />

              {!loaded ? (
                <SkeletonCard />
              ) : primaryPod ? (
                (() => {
                  const primaryFriendLabel = friendCountLabel(primaryPod, friends);
                  return (
                <Tap
                  onPress={() => navigation.navigate('PodDetail', { podId: primaryPod.id })}
                  style={styles.primaryCard}
                  accessibilityLabel={displayPodTitle(primaryPod)}
                >
                  <View style={styles.primaryTopRow}>
                    <View style={[styles.statusPill, { backgroundColor: podStatusMeta(primaryPod, colors).bg }]}>
                      <Ionicons
                        name={podStatusMeta(primaryPod, colors).icon}
                        size={14}
                        color={podStatusMeta(primaryPod, colors).text}
                      />
                      <Text style={[styles.statusLabel, { color: podStatusMeta(primaryPod, colors).text }]}>
                        {podStatusMeta(primaryPod, colors).label}
                      </Text>
                    </View>

                    <View style={styles.progressMeta}>
                      <Text style={styles.goingLabel}>
                        {primaryPod.members.length} / {primaryPod.maxMembers} going
                      </Text>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: progressWidth(primaryPod) }]} />
                      </View>
                    </View>
                  </View>

                  <Text style={styles.primaryTitle}>{displayPodTitle(primaryPod)}</Text>

                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color={colors.faint} />
                    <Text style={styles.detailText}>{primaryPod.location}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color={colors.faint} />
                    <Text style={styles.detailText}>
                      {formatShortDate(primaryPod.meetupTime)} at {formatTime(primaryPod.meetupTime)}
                    </Text>
                  </View>

                  <View style={styles.primaryFooterRow}>
                    <View style={styles.peopleMeta}>
                      <View style={styles.avatarRail}>
                        {primaryPod.members.slice(0, 4).map((member, index) => (
                          <View key={member.id} style={{ marginLeft: index === 0 ? 0 : -10 }}>
                            <Avatar member={member} size={34} />
                          </View>
                        ))}
                      </View>

                      <View style={styles.peopleTextBlock}>
                        <Text style={styles.peopleLine}>{spotsFilledLabel(primaryPod)}</Text>
                        {primaryFriendLabel ? <Text style={styles.peopleSubline}>{primaryFriendLabel}</Text> : null}
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.openButton}
                      activeOpacity={0.88}
                      onPress={() => navigation.navigate('PodDetail', { podId: primaryPod.id })}
                    >
                      <Text style={styles.openButtonText}>Open pod</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.descriptorRow}>
                    {podDescriptors(primaryPod).map((label, index) => (
                      <React.Fragment key={label}>
                        {index > 0 ? <Text style={styles.dotDivider}>•</Text> : null}
                        <Text style={styles.descriptorText}>{label}</Text>
                      </React.Fragment>
                    ))}
                  </View>
                </Tap>
                  );
                })()
              ) : (
                <View style={styles.emptyMomentumCard}>
                  <Text style={styles.emptyMomentumTitle}>Nothing planned yet tonight.</Text>
                  <Text style={styles.emptyMomentumBody}>
                    Explore shows open pods pulled from the current feed.
                  </Text>
                  <TouchableOpacity
                    style={styles.findButton}
                    activeOpacity={0.88}
                    onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
                  >
                    <Text style={styles.findButtonText}>Find something happening now</Text>
                  </TouchableOpacity>
                </View>
              )}

              {extraActivePods.length ? extraActivePods.map((pod) => (
                (() => {
                  const podFriendLabel = friendCountLabel(pod, friends);
                  return (
                <Tap
                  key={pod.id}
                  style={styles.secondaryActiveCard}
                  onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                  accessibilityLabel={displayPodTitle(pod)}
                >
                  <View style={styles.secondaryActiveTop}>
                    <Text style={styles.secondaryActiveTitle}>{displayPodTitle(pod)}</Text>
                    <Text style={styles.secondaryActiveMeta}>{minutesUntil(pod.meetupTime)}</Text>
                  </View>
                  <Text style={styles.secondaryActiveLocation}>{pod.location}</Text>
                  <Text style={styles.secondaryActiveSubline}>
                    {[`${pod.members.length} going`, podFriendLabel].filter(Boolean).join(' • ')}
                  </Text>
                </Tap>
                  );
                })()
              )) : null}
            </View>

            {!loaded || startingSoonPods.length ? (
            <View style={styles.section}>
              <SectionHeader
                title="Starting soon"
                actionLabel={startingSoonPods.length ? 'See all' : undefined}
                onActionPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
              />
              {!loaded ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
                  {[0, 1, 2].map((item) => <SkeletonCard key={item} compact />)}
                </ScrollView>
              ) : startingSoonPods.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
                  {startingSoonPods.map((pod) => (
                    <Tap
                      key={pod.id}
                      style={styles.miniCard}
                      onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                      accessibilityLabel={displayPodTitle(pod)}
                    >
                      <LinearGradient colors={isDark ? ['#1E2129', '#181B22'] : ['#FBF7F0', '#EDEFF6']} style={styles.miniCardMedia}>
                        <Ionicons name={podIcon(pod)} size={30} color={colors.primary} />
                        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(10,12,16,0.14)']} style={styles.miniOverlay}>
                          <View style={styles.miniBadge}>
                            <Text style={styles.miniBadgeText}>Starts in {minutesUntil(pod.meetupTime)}</Text>
                          </View>
                        </LinearGradient>
                      </LinearGradient>

                      <View style={styles.miniCardBody}>
                        <Text style={styles.miniCardTitle} numberOfLines={1}>{displayPodTitle(pod)}</Text>
                        <Text style={styles.miniCardLocation} numberOfLines={1}>{pod.location}</Text>
                        <View style={styles.miniCardFooter}>
                          <View style={styles.avatarRail}>
                            {pod.members.slice(0, 3).map((member, index) => (
                              <View key={member.id} style={{ marginLeft: index === 0 ? 0 : -8 }}>
                                <Avatar member={member} size={24} />
                              </View>
                            ))}
                          </View>
                          <Text style={styles.miniCardGoing}>{pod.members.length} going</Text>
                        </View>
                      </View>
                    </Tap>
                  ))}
                </ScrollView>
              ) : null}
            </View>
            ) : null}

            {!loaded || friendActivity.length ? (
            <View style={styles.section}>
              <SectionHeader title="Friends in pods" />
              {!loaded ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendActivityRow}>
                  {[0, 1, 2].map((item) => <SkeletonCard key={item} compact />)}
                </ScrollView>
              ) : friendActivity.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendActivityRow}>
                  {friendActivity.map((item) => (
                    <View key={`${item.friend.id}-${item.pod.id}`} style={styles.friendActivityCard}>
                      <FriendAvatar friend={item.friend} />
                      <View style={styles.friendActivityCopy}>
                        <View style={styles.friendActivityTop}>
                          <Text style={styles.friendName}>{item.friend.firstName ?? item.friend.name}</Text>
                        </View>
                        <Text style={styles.friendJoined}>is in this pod</Text>
                        <Text style={styles.friendPodName} numberOfLines={1}>{displayPodTitle(item.pod)}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </View>
            ) : null}

            {!loaded || moreOpenPods.length ? (
            <View style={styles.section}>
              <SectionHeader title="More open pods" />
              {!loaded ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
                  {[0, 1, 2].map((item) => <SkeletonCard key={item} compact />)}
                </ScrollView>
              ) : moreOpenPods.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
                  {moreOpenPods.map((pod) => (
                    <Tap
                      key={pod.id}
                      style={styles.recommendedCard}
                      onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                      accessibilityLabel={displayPodTitle(pod)}
                    >
                      <LinearGradient colors={isDark ? ['#1E2129', '#181B22'] : ['#FBF7F0', '#EDEFF6']} style={styles.recommendedMedia}>
                        <Ionicons name={podIcon(pod)} size={28} color={colors.primary} />
                        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(10,12,16,0.14)']} style={styles.recommendedOverlay}>
                          <View style={styles.recommendedCountPill}>
                            <Ionicons name="people-outline" size={13} color="#FFFFFF" />
                            <Text style={styles.recommendedCountText}>{pod.members.length}</Text>
                          </View>
                        </LinearGradient>
                      </LinearGradient>
                      <View style={styles.recommendedBody}>
                        <Text style={styles.recommendedTitle} numberOfLines={1}>{displayPodTitle(pod)}</Text>
                        <Text style={styles.recommendedLocation} numberOfLines={1}>{pod.location}</Text>
                        <Text style={styles.recommendedTime}>Starts in {minutesUntil(pod.meetupTime)}</Text>
                      </View>
                    </Tap>
                  ))}
                </ScrollView>
              ) : null}
            </View>
            ) : null}
          </>
        ) : (
          <View style={styles.section}>
            <SectionHeader title="Past pods" />
            {pastItems.length ? pastItems.map((pod) => (
              <Tap
                key={pod.id}
                style={styles.pastCard}
                onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                accessibilityLabel={displayPodTitle(pod)}
              >
                <View style={styles.pastTopRow}>
                  <Text style={styles.pastTitle}>{displayPodTitle(pod)}</Text>
                  <Text style={styles.pastStatus}>{pod.status === 'COMPLETED' ? 'Completed' : 'Closed'}</Text>
                </View>
                <Text style={styles.pastMeta}>{pod.location}</Text>
                <Text style={styles.pastMeta}>{formatShortDate(pod.meetupTime)} at {formatTime(pod.meetupTime)}</Text>
                <Text style={styles.pastMeta}>{pod.members.length} went</Text>
              </Tap>
            )) : (
              <EmptyState
                icon="time-outline"
                title="No past pods yet"
                body="Completed pods and recaps will show up here once you start joining more plans."
              />
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  pageEyebrow: {
    ...t.typography.label,
    color: t.colors.primary,
    marginBottom: 2,
  },
  pageTitle: {
    ...t.typography.display,
  },
  modeTabs: {
    flexDirection: 'row' as const,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  modeTab: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 10,
    paddingTop: 6,
  },
  modeLabel: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: t.colors.faint,
  },
  modeLabelActive: {
    color: t.colors.ink,
  },
  modeUnderline: {
    height: 3,
    width: '100%' as const,
    borderRadius: radii.pill,
    backgroundColor: 'transparent',
  },
  modeUnderlineActive: {
    backgroundColor: t.colors.primary,
  },
  section: {
    gap: spacing.sm,
  },
  primaryCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 26,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: 12,
    ...t.shadows.raised,
  },
  primaryTopRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusLabel: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },
  progressMeta: {
    alignItems: 'flex-end' as const,
    gap: 8,
    flex: 1,
    maxWidth: 110,
  },
  goingLabel: {
    ...t.typography.bodyStrong,
    fontSize: 15,
  },
  progressTrack: {
    width: '100%' as const,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: t.colors.inputBg,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%' as const,
    borderRadius: radii.pill,
    backgroundColor: t.colors.primary,
  },
  primaryTitle: {
    ...t.typography.h1,
    fontSize: 24,
    lineHeight: 30,
  },
  detailRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  detailText: {
    ...t.typography.body,
    flex: 1,
  },
  primaryFooterRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  peopleMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    flex: 1,
  },
  avatarRail: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  peopleTextBlock: {
    gap: 2,
    flex: 1,
  },
  peopleLine: {
    ...t.typography.bodyStrong,
  },
  peopleSubline: {
    ...t.typography.body,
    fontSize: 14,
  },
  openButton: {
    backgroundColor: t.colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 13,
    ...t.shadows.glow,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  descriptorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
    paddingTop: 12,
  },
  dotDivider: {
    color: t.colors.faint,
    fontSize: 14,
  },
  descriptorText: {
    ...t.typography.body,
    fontSize: 14,
  },
  secondaryActiveCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 20,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: 4,
    ...t.shadows.subtle,
  },
  secondaryActiveTop: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  secondaryActiveTitle: {
    ...t.typography.title,
    flex: 1,
  },
  secondaryActiveMeta: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: t.colors.primary,
  },
  secondaryActiveLocation: {
    ...t.typography.body,
  },
  secondaryActiveSubline: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: t.colors.sub,
  },
  emptyMomentumCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: spacing.sm,
    ...t.shadows.card,
  },
  emptyMomentumTitle: {
    ...t.typography.h2,
  },
  emptyMomentumBody: {
    ...t.typography.body,
  },
  findButton: {
    marginTop: 4,
    backgroundColor: t.colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignSelf: 'flex-start' as const,
    ...t.shadows.glow,
  },
  findButtonText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  horizontalRow: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  miniCard: {
    width: 286,
    backgroundColor: t.colors.surface,
    borderRadius: 20,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: t.colors.border,
    ...t.shadows.subtle,
  },
  miniCardMedia: {
    height: 108,
  },
  miniOverlay: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between' as const,
  },
  miniBadge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: t.colors.amber,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  miniBadgeText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  miniCardBody: {
    padding: 12,
    gap: 6,
  },
  miniCardTitle: {
    ...t.typography.title,
    fontSize: 18,
    lineHeight: 23,
  },
  miniCardLocation: {
    ...t.typography.body,
    fontSize: 14,
  },
  miniCardFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  miniCardGoing: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: t.colors.sub,
  },
  friendActivityRow: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  friendActivityCard: {
    width: 232,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: t.colors.surface,
    borderRadius: 20,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    ...t.shadows.subtle,
  },
  friendActivityCopy: {
    flex: 1,
    gap: 1,
  },
  friendActivityTop: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  friendName: {
    ...t.typography.bodyStrong,
  },
  friendJoined: {
    ...t.typography.body,
    fontSize: 13,
  },
  friendPodName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: t.colors.primary,
  },
  recommendedCard: {
    width: 214,
    backgroundColor: t.colors.surface,
    borderRadius: 20,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: t.colors.border,
    ...t.shadows.subtle,
  },
  recommendedMedia: {
    height: 116,
  },
  recommendedOverlay: {
    flex: 1,
    padding: 10,
    alignItems: 'flex-end' as const,
  },
  recommendedCountPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: 'rgba(12,13,17,0.55)',
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  recommendedCountText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  recommendedBody: {
    padding: 12,
    gap: 4,
  },
  recommendedTitle: {
    ...t.typography.title,
  },
  recommendedLocation: {
    ...t.typography.body,
    fontSize: 14,
  },
  recommendedTime: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: t.colors.primary,
  },
  pastCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 22,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: 4,
    ...t.shadows.subtle,
  },
  pastTopRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  pastTitle: {
    ...t.typography.title,
    flex: 1,
  },
  pastStatus: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: t.colors.faint,
  },
  pastMeta: {
    ...t.typography.body,
  },
  realAvatar: {
    borderWidth: 2,
    borderColor: t.colors.surface,
    backgroundColor: t.colors.surfaceAlt,
  },
  initialAvatar: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.surfaceAlt,
    borderWidth: 2,
    borderColor: t.colors.surface,
  },
  initialAvatarText: {
    color: t.colors.ink,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
}));
