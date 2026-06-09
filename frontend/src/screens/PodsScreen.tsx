import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
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
import { EmptyState, IconButton, Screen, SectionHeader, SkeletonCard } from '../components/ui';
import { formatShortDate, formatTime, getInitials } from '../utils/format';
import { sortUpcomingPods } from '../utils/experience';
import { palette, radii, shadows, spacing, typography } from '../theme';

type Mode = 'active' | 'past';
type Nav = NativeStackNavigationProp<RootStackParamList>;

function podStatusMeta(pod: Pod) {
  if (pod.status === 'COMPLETED') {
    return { label: 'Finished', bg: '#E8EEF9', text: '#4A72A8', icon: 'checkmark-circle-outline' as const };
  }
  if (pod.status === 'LOCKED') {
    return { label: 'Locked in', bg: '#E8F6ED', text: '#2C6A45', icon: 'sparkles-outline' as const };
  }
  if (new Date(pod.meetupTime).getTime() <= Date.now()) {
    return { label: 'Happening now', bg: '#E8F6ED', text: '#2C6A45', icon: 'flame-outline' as const };
  }
  return { label: 'Starts soon', bg: '#FFF1DE', text: '#9A5E17', icon: 'time-outline' as const };
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
          <Text style={styles.pageTitle}>Pods</Text>
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
                <TouchableOpacity
                  activeOpacity={0.93}
                  onPress={() => navigation.navigate('PodDetail', { podId: primaryPod.id })}
                  style={styles.primaryCard}
                >
                  <View style={styles.primaryTopRow}>
                    <View style={[styles.statusPill, { backgroundColor: podStatusMeta(primaryPod).bg }]}>
                      <Ionicons
                        name={podStatusMeta(primaryPod).icon}
                        size={14}
                        color={podStatusMeta(primaryPod).text}
                      />
                      <Text style={[styles.statusLabel, { color: podStatusMeta(primaryPod).text }]}>
                        {podStatusMeta(primaryPod).label}
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
                    <Ionicons name="location-outline" size={16} color={palette.slate} />
                    <Text style={styles.detailText}>{primaryPod.location}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color={palette.slate} />
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
                </TouchableOpacity>
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
                <TouchableOpacity
                  key={pod.id}
                  style={styles.secondaryActiveCard}
                  activeOpacity={0.92}
                  onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                >
                  <View style={styles.secondaryActiveTop}>
                    <Text style={styles.secondaryActiveTitle}>{displayPodTitle(pod)}</Text>
                    <Text style={styles.secondaryActiveMeta}>{minutesUntil(pod.meetupTime)}</Text>
                  </View>
                  <Text style={styles.secondaryActiveLocation}>{pod.location}</Text>
                  <Text style={styles.secondaryActiveSubline}>
                    {[`${pod.members.length} going`, podFriendLabel].filter(Boolean).join(' • ')}
                  </Text>
                </TouchableOpacity>
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
                    <TouchableOpacity
                      key={pod.id}
                      style={styles.miniCard}
                      activeOpacity={0.92}
                      onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                    >
                      <LinearGradient colors={['#F7F4EE', '#E9EEF6']} style={styles.miniCardMedia}>
                        <Ionicons name={podIcon(pod)} size={30} color={palette.scarlet} />
                        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(16,33,43,0.12)']} style={styles.miniOverlay}>
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
                    </TouchableOpacity>
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
                    <TouchableOpacity
                      key={pod.id}
                      style={styles.recommendedCard}
                      activeOpacity={0.92}
                      onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                    >
                      <LinearGradient colors={['#F7F4EE', '#E9EEF6']} style={styles.recommendedMedia}>
                        <Ionicons name={podIcon(pod)} size={28} color={palette.scarlet} />
                        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(16,33,43,0.12)']} style={styles.recommendedOverlay}>
                          <View style={styles.recommendedCountPill}>
                            <Ionicons name="people-outline" size={13} color={palette.white} />
                            <Text style={styles.recommendedCountText}>{pod.members.length}</Text>
                          </View>
                        </LinearGradient>
                      </LinearGradient>
                      <View style={styles.recommendedBody}>
                        <Text style={styles.recommendedTitle} numberOfLines={1}>{displayPodTitle(pod)}</Text>
                        <Text style={styles.recommendedLocation} numberOfLines={1}>{pod.location}</Text>
                        <Text style={styles.recommendedTime}>Starts in {minutesUntil(pod.meetupTime)}</Text>
                      </View>
                    </TouchableOpacity>
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
              <TouchableOpacity
                key={pod.id}
                style={styles.pastCard}
                activeOpacity={0.92}
                onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
              >
                <View style={styles.pastTopRow}>
                  <Text style={styles.pastTitle}>{displayPodTitle(pod)}</Text>
                  <Text style={styles.pastStatus}>{pod.status === 'COMPLETED' ? 'Completed' : 'Closed'}</Text>
                </View>
                <Text style={styles.pastMeta}>{pod.location}</Text>
                <Text style={styles.pastMeta}>{formatShortDate(pod.meetupTime)} at {formatTime(pod.meetupTime)}</Text>
                <Text style={styles.pastMeta}>{pod.members.length} went</Text>
              </TouchableOpacity>
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

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    ...typography.h1,
    fontSize: 48,
    lineHeight: 52,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  modeTabs: {
    flexDirection: 'row',
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 33, 43, 0.08)',
  },
  modeTab: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    paddingTop: 6,
  },
  modeLabel: {
    ...typography.bodyStrong,
    fontSize: 18,
    color: palette.slate,
  },
  modeLabelActive: {
    color: palette.ink,
  },
  modeUnderline: {
    height: 3,
    width: '100%',
    borderRadius: radii.pill,
    backgroundColor: 'transparent',
  },
  modeUnderlineActive: {
    backgroundColor: palette.scarlet,
  },
  section: {
    gap: spacing.sm,
  },
  primaryCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 26,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    gap: 12,
    ...shadows.card,
  },
  primaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressMeta: {
    alignItems: 'flex-end',
    gap: 8,
    flex: 1,
    maxWidth: 110,
  },
  goingLabel: {
    ...typography.bodyStrong,
    fontSize: 15,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(16, 33, 43, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: palette.scarlet,
  },
  primaryTitle: {
    ...typography.h1,
    fontSize: 24,
    lineHeight: 30,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    ...typography.body,
    flex: 1,
    color: palette.slate,
  },
  primaryFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  peopleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  avatarRail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  peopleTextBlock: {
    gap: 2,
    flex: 1,
  },
  peopleLine: {
    ...typography.bodyStrong,
    color: palette.ink,
  },
  peopleSubline: {
    ...typography.body,
    fontSize: 14,
  },
  openButton: {
    backgroundColor: palette.scarlet,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  openButtonText: {
    color: palette.white,
    fontSize: 18,
    fontWeight: '800',
  },
  descriptorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 33, 43, 0.07)',
    paddingTop: 12,
  },
  dotDivider: {
    color: '#A4B2BA',
    fontSize: 14,
  },
  descriptorText: {
    ...typography.body,
    fontSize: 14,
    color: palette.slate,
  },
  secondaryActiveCard: {
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderRadius: 20,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.05)',
    gap: 4,
  },
  secondaryActiveTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  secondaryActiveTitle: {
    ...typography.title,
    flex: 1,
  },
  secondaryActiveMeta: {
    ...typography.bodyStrong,
    color: palette.scarlet,
  },
  secondaryActiveLocation: {
    ...typography.body,
  },
  secondaryActiveSubline: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: palette.slate,
  },
  emptyMomentumCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    gap: spacing.sm,
    ...shadows.card,
  },
  emptyMomentumTitle: {
    ...typography.h2,
  },
  emptyMomentumBody: {
    ...typography.body,
  },
  findButton: {
    marginTop: 4,
    backgroundColor: palette.scarlet,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignSelf: 'flex-start',
  },
  findButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '800',
  },
  horizontalRow: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  miniCard: {
    width: 286,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
  },
  miniCardMedia: {
    height: 108,
  },
  miniCardImage: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  miniOverlay: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  miniBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(230, 140, 34, 0.96)',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  miniBadgeText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '800',
  },
  miniCardBody: {
    padding: 12,
    gap: 6,
  },
  miniCardTitle: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 24,
  },
  miniCardLocation: {
    ...typography.body,
    fontSize: 14,
  },
  miniCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniCardGoing: {
    ...typography.bodyStrong,
    color: palette.slate,
  },
  friendActivityRow: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  friendActivityCard: {
    width: 232,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
  },
  friendActivityCopy: {
    flex: 1,
    gap: 1,
  },
  friendActivityTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  friendName: {
    ...typography.bodyStrong,
    color: palette.ink,
  },
  friendJoined: {
    ...typography.body,
    fontSize: 13,
  },
  friendPodName: {
    ...typography.bodyStrong,
    color: palette.scarlet,
  },
  inlineEmptyState: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.md,
    gap: 4,
  },
  inlineEmptyTitle: {
    ...typography.bodyStrong,
    color: palette.ink,
  },
  inlineEmptyBody: {
    ...typography.body,
    fontSize: 14,
  },
  recommendedCard: {
    width: 214,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
  },
  recommendedMedia: {
    height: 116,
  },
  recommendedImage: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  recommendedOverlay: {
    flex: 1,
    padding: 10,
    alignItems: 'flex-end',
  },
  recommendedCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 33, 43, 0.52)',
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  recommendedCountText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  recommendedBody: {
    padding: 12,
    gap: 4,
  },
  recommendedTitle: {
    ...typography.title,
  },
  recommendedLocation: {
    ...typography.body,
    fontSize: 14,
  },
  recommendedTime: {
    ...typography.bodyStrong,
    color: palette.scarlet,
    fontSize: 14,
  },
  pastCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 22,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    gap: 4,
  },
  pastTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pastTitle: {
    ...typography.title,
    flex: 1,
  },
  pastStatus: {
    ...typography.bodyStrong,
    color: palette.slate,
  },
  pastMeta: {
    ...typography.body,
  },
  realAvatar: {
    borderWidth: 2,
    borderColor: palette.white,
    backgroundColor: '#D7DEE2',
  },
  initialAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DDE7ED',
    borderWidth: 2,
    borderColor: palette.white,
  },
  initialAvatarText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '800',
  },
});
