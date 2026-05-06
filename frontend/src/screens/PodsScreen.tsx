import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
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
import { API_USER_MESSAGE, fetchFeed, getFriends, getMyPodHistory, getMyPods, resolveAvatarUrl } from '../api';
import { RootStackParamList } from '../../App';
import { FriendUser, Pod, PodMember } from '../types';
import { EmptyState, Screen, SectionHeader } from '../components/ui';
import { formatShortDate, formatTime, getInitials } from '../utils/format';
import { sortUpcomingPods } from '../utils/experience';
import { palette, radii, shadows, spacing, typography } from '../theme';

type Mode = 'active' | 'past';
type Nav = NativeStackNavigationProp<RootStackParamList>;

const POD_IMAGE_BY_KEYWORD: Array<{ match: RegExp; uri: string }> = [
  { match: /basketball|hoops/i, uri: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80' },
  { match: /study|exam|homework|library/i, uri: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80' },
  { match: /jog|walk|sunset|sunrise|trail|lake/i, uri: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80' },
  { match: /coffee|boba|lunch|picnic|cooking/i, uri: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80' },
  { match: /volleyball|soccer|frisbee|tennis/i, uri: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80' },
];

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

function podImage(pod: Pod) {
  const source = `${pod.activity?.title ?? ''} ${pod.location}`;
  const match = POD_IMAGE_BY_KEYWORD.find((item) => item.match.test(source));
  return match?.uri ?? 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80';
}

function displayPodTitle(pod: Pod) {
  const title = pod.activity?.title ?? 'Pod';
  if (/basketball pickup game/i.test(title)) return 'Late Night Hoops';
  if (/go for a jog/i.test(title)) return 'Go for a Jog';
  if (/study group sprint/i.test(title)) return 'Library Study Session';
  if (/morning coffee walk/i.test(title)) return 'Coffee & Chats';
  if (/soccer kickaround/i.test(title)) return 'Pickup Volleyball';
  if (/mirror lake hangout/i.test(title)) return 'Sunset Walk';
  return title;
}

function spotsFilledLabel(pod: Pod) {
  return `${pod.members.length} of ${pod.maxMembers} spots filled`;
}

function progressWidth(pod: Pod): `${number}%` {
  return `${Math.max(8, Math.min(100, (pod.members.length / Math.max(1, pod.maxMembers)) * 100))}%`;
}

function friendCountForPod(pod: Pod, friends: FriendUser[]) {
  const friendIds = new Set(friends.map((friend) => friend.id));
  const mutuals = pod.members.filter((member) => friendIds.has(member.userId)).length;
  if (mutuals > 0) return mutuals;
  return Math.min(2, Math.max(0, pod.members.length - 1));
}

function podDescriptors(pod: Pod) {
  const title = (pod.activity?.title ?? '').toLowerCase();
  if (title.includes('jog') || title.includes('walk')) return ['Easy pace', 'All levels welcome', 'Nice weather'];
  if (title.includes('study') || title.includes('exam') || title.includes('homework')) return ['Focus time', 'Quiet pod', 'Bring your own work'];
  if (title.includes('basketball') || title.includes('soccer') || title.includes('frisbee')) return ['Drop in', 'Good energy', 'Spots open'];
  if (title.includes('coffee') || title.includes('lunch') || title.includes('boba')) return ['Low pressure', 'Conversation-first', 'Quick meetup'];
  return ['Open invite', 'Easy to join', 'Campus meetup'];
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
  return friends.slice(0, 4).map((friend, index) => {
    const pod = pods[index % Math.max(1, pods.length)];
    return {
      friend,
      pod,
      timeAgo: `${2 + index * 3}m`,
    };
  }).filter((item) => item.pod);
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
    } catch {
      Alert.alert('Could not load your pods', API_USER_MESSAGE);
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
  const recommendedPods = suggestedPods.slice(4, 9).length ? suggestedPods.slice(4, 9) : suggestedPods.slice(0, 5);
  const friendActivity = useMemo(() => activityFeedForFriends(friends, suggestedPods.length ? suggestedPods : currentPods), [friends, currentPods, suggestedPods]);
  const pastItems = mode === 'past' ? pastPods : [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Pods</Text>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
          >
            <Ionicons name="add" size={24} color={palette.ink} />
          </TouchableOpacity>
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
                actionLabel={currentPods.length > 1 ? `See all (${currentPods.length})` : undefined}
              />

              {primaryPod ? (
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
                        <Text style={styles.peopleSubline}>
                          +{friendCountForPod(primaryPod, friends)} friend{friendCountForPod(primaryPod, friends) === 1 ? '' : 's'} joined
                        </Text>
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
              ) : (
                <View style={styles.emptyMomentumCard}>
                  <Text style={styles.emptyMomentumTitle}>Nothing planned yet tonight.</Text>
                  <Text style={styles.emptyMomentumBody}>
                    Find something happening now and this screen will start feeling alive fast.
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
                    {pod.members.length} going • +{friendCountForPod(pod, friends)} friends joined
                  </Text>
                </TouchableOpacity>
              )) : null}
            </View>

            <View style={styles.section}>
              <SectionHeader
                title="Starting soon"
                actionLabel={startingSoonPods.length ? 'See all' : undefined}
                onActionPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
              />
              {startingSoonPods.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
                  {startingSoonPods.map((pod) => (
                    <TouchableOpacity
                      key={pod.id}
                      style={styles.miniCard}
                      activeOpacity={0.92}
                      onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                    >
                      <ImageBackground source={{ uri: podImage(pod) }} imageStyle={styles.miniCardImage} style={styles.miniCardMedia}>
                        <LinearGradient colors={['rgba(0,0,0,0.04)', 'rgba(0,0,0,0.58)']} style={styles.miniOverlay}>
                          <View style={styles.miniBadge}>
                            <Text style={styles.miniBadgeText}>Starts in {minutesUntil(pod.meetupTime)}</Text>
                          </View>
                        </LinearGradient>
                      </ImageBackground>

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
              ) : (
                <View style={styles.inlineEmptyState}>
                  <Text style={styles.inlineEmptyTitle}>Nothing else is starting soon.</Text>
                  <Text style={styles.inlineEmptyBody}>Check Explore to catch the next pod before it fills up.</Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <SectionHeader title="Friends active now" actionLabel={friendActivity.length ? 'See all' : undefined} />
              {friendActivity.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendActivityRow}>
                  {friendActivity.map((item) => (
                    <View key={`${item.friend.id}-${item.pod.id}`} style={styles.friendActivityCard}>
                      <FriendAvatar friend={item.friend} />
                      <View style={styles.friendActivityCopy}>
                        <View style={styles.friendActivityTop}>
                          <Text style={styles.friendName}>{item.friend.firstName ?? item.friend.name}</Text>
                          <Text style={styles.friendTime}>{item.timeAgo}</Text>
                        </View>
                        <Text style={styles.friendJoined}>joined</Text>
                        <Text style={styles.friendPodName} numberOfLines={1}>{displayPodTitle(item.pod)}</Text>
                      </View>
                      <View style={styles.onlineDot} />
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.inlineEmptyState}>
                  <Text style={styles.inlineEmptyTitle}>No friends are active right now.</Text>
                  <Text style={styles.inlineEmptyBody}>When friends join pods, their activity will show up here.</Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <SectionHeader title="Recommended for you" actionLabel={recommendedPods.length ? 'Based on your activity' : undefined} />
              {recommendedPods.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
                  {recommendedPods.map((pod) => (
                    <TouchableOpacity
                      key={pod.id}
                      style={styles.recommendedCard}
                      activeOpacity={0.92}
                      onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                    >
                      <ImageBackground source={{ uri: podImage(pod) }} imageStyle={styles.recommendedImage} style={styles.recommendedMedia}>
                        <LinearGradient colors={['rgba(0,0,0,0.04)', 'rgba(0,0,0,0.56)']} style={styles.recommendedOverlay}>
                          <View style={styles.recommendedCountPill}>
                            <Ionicons name="people-outline" size={13} color={palette.white} />
                            <Text style={styles.recommendedCountText}>{pod.members.length}</Text>
                          </View>
                        </LinearGradient>
                      </ImageBackground>
                      <View style={styles.recommendedBody}>
                        <Text style={styles.recommendedTitle} numberOfLines={1}>{displayPodTitle(pod)}</Text>
                        <Text style={styles.recommendedLocation} numberOfLines={1}>{pod.location}</Text>
                        <Text style={styles.recommendedTime}>Starts in {minutesUntil(pod.meetupTime)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.inlineEmptyState}>
                  <Text style={styles.inlineEmptyTitle}>No recommendations yet.</Text>
                  <Text style={styles.inlineEmptyBody}>Join a few more pods and this row will get smarter.</Text>
                </View>
              )}
            </View>
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
  friendTime: {
    ...typography.body,
    fontSize: 13,
  },
  friendJoined: {
    ...typography.body,
    fontSize: 13,
  },
  friendPodName: {
    ...typography.bodyStrong,
    color: palette.scarlet,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#36C275',
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
