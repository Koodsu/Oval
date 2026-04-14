import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../App';
import { fetchFeed, getActivities, getMyPods, joinPod, joinWaitlist, resolveAvatarUrl } from '../api';
import { Pod, Activity } from '../types';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import ActivityCard from '../components/ActivityCard';
import FadeIn from '../components/FadeIn';
import PressableScale from '../components/PressableScale';
import GuidelinesModal from '../components/GuidelinesModal';
import { SkeletonActivityCard } from '../components/SkeletonLoader';
import { home, spacing, cardShadowHome, colors } from '../theme';
import { getActivityEmoji } from '../utils/activityEmoji';
import { getCategoryPillStyle } from '../utils/activityCategoryPill';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function getTimeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function mergedFeedPods(pods: Pod[]): Pod[] {
  return [...pods].sort(
    (a, b) => new Date(a.meetupTime).getTime() - new Date(b.meetupTime).getTime()
  );
}

function isSameLocalCalendarDay(iso: string, ref: Date = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function formatScheduleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function clubCircleBg(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors.avatarPalette[Math.abs(hash) % colors.avatarPalette.length];
}

function SectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionHeaderDot} />
      <Text style={styles.sectionHeaderLabel}>{label}</Text>
    </View>
  );
}

interface FeedPodCardProps {
  pod: Pod;
  onJoin: () => void;
  onView: () => void;
  onJoinWaitlist?: () => void;
  isJoining: boolean;
  isJoiningWaitlist?: boolean;
  isMember: boolean;
}

function FeedPodCard({
  pod,
  onJoin,
  onView,
  onJoinWaitlist,
  isJoining,
  isJoiningWaitlist = false,
  isMember,
}: FeedPodCardProps) {
  const memberCount = pod.members.length;
  const spotsLeft = pod.maxMembers - memberCount;
  const activity = pod.activity;
  const title = activity?.title ?? 'Pod';
  const category = activity?.category ?? '';
  const pill = getCategoryPillStyle(category);
  const emoji = getActivityEmoji(title, category);

  const statusPill =
    pod.status === 'LOCKED'
      ? { label: 'FORMING', bg: '#F0FDF4', text: '#16A34A' }
      : pod.status === 'FORMING' && memberCount < pod.maxMembers
        ? { label: 'OPEN', bg: '#FFF7ED', text: '#EA580C' }
        : pod.status === 'FORMING' && memberCount >= pod.maxMembers
          ? { label: 'FULL', bg: '#FEF2F2', text: '#CC0000' }
          : { label: 'Past', bg: '#F4F4F5', text: '#52525B' };

  const handlePress = () => {
    if (isJoining || isJoiningWaitlist) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isMember) {
      onView();
    } else if (spotsLeft > 0) {
      onJoin();
    } else if (onJoinWaitlist) {
      onJoinWaitlist();
    }
  };

  return (
    <PressableScale
      onPress={handlePress}
      haptic="none"
      disabled={isJoining || isJoiningWaitlist}
      style={[styles.feedCard, cardShadowHome]}
      testID="feed-pod-card"
    >
      {(isJoining || isJoiningWaitlist) && (
        <View style={styles.feedCardLoadingOverlay}>
          <ActivityIndicator size="small" color={home.scarlet} />
        </View>
      )}
      <View style={styles.feedCardTopRow}>
        <View style={[styles.emojiCircle, { backgroundColor: pill.emojiCircleBg }]}>
          <Text style={styles.emojiText}>{emoji}</Text>
        </View>
        <View style={styles.feedCardMainCol}>
          <View style={styles.feedCardTitleRow}>
            <Text style={styles.feedCardTitle} numberOfLines={1}>
              {title}
            </Text>
            <View style={[styles.categoryPill, styles.feedCardCategoryPill, { backgroundColor: pill.pillBg }]}>
              <Text style={[styles.categoryPillText, { color: pill.pillText }]}>{pill.label}</Text>
            </View>
          </View>
          {activity?.description ? (
            <Text style={styles.feedCardDesc} numberOfLines={2}>
              {activity.description}
            </Text>
          ) : null}
          <View style={styles.feedCardLocationRow}>
            <Ionicons name="location-outline" size={12} color={home.textMuted} />
            <Text style={styles.feedCardLocation} numberOfLines={1}>
              {pod.location}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.feedCardBottomRow}>
        <Text style={styles.joiningText}>{memberCount} joining</Text>
        <View style={[styles.statusPill, { backgroundColor: statusPill.bg }]}>
          <Text style={[styles.statusPillText, { color: statusPill.text }]}>{statusPill.label}</Text>
        </View>
      </View>
    </PressableScale>
  );
}

export default function TodayScreen() {
  const navigation = useNavigation<Nav>();
  const { user, hasAcceptedGuidelines, acceptGuidelines } = useAuth();
  const insets = useSafeAreaInsets();

  const [pods, setPods] = useState<Pod[]>([]);
  const [myPods, setMyPods] = useState<Pod[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(null);
  const [waitlistingId, setWaitlistingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [feedPods, acts, mine] = await Promise.all([fetchFeed(), getActivities(), getMyPods()]);
      setPods(feedPods);
      setMyPods(mine);
      const sorted = [...acts].sort((a, b) => {
        const aC = a._count?.pods ?? 0;
        const bC = b._count?.pods ?? 0;
        if (bC !== aC) return bC - aC;
        return a.title.localeCompare(b.title);
      });
      setActivities(sorted);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const executeJoin = async (podId: string) => {
    setJoiningId(podId);
    try {
      const pod = await joinPod(podId);
      navigation.navigate('Pod', { podId: pod.id });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to join pod');
    } finally {
      setJoiningId(null);
    }
  };

  const handleJoin = (podId: string) => {
    if (!hasAcceptedGuidelines) {
      setPendingJoinId(podId);
    } else {
      executeJoin(podId);
    }
  };

  const handleGuidelinesAccept = async () => {
    await acceptGuidelines();
    const id = pendingJoinId;
    setPendingJoinId(null);
    if (id) executeJoin(id);
  };

  const handleJoinWaitlist = async (podId: string) => {
    setWaitlistingId(podId);
    try {
      const { position } = await joinWaitlist(podId);
      Alert.alert('Waitlisted!', `You're #${position} on the waitlist. We'll notify you when a spot opens.`);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to join waitlist');
    } finally {
      setWaitlistingId(null);
    }
  };

  const isMember = (pod: Pod) => pod.members.some((m) => m.user.id === user?.id);

  const feedPodsOrdered = useMemo(() => mergedFeedPods(pods), [pods]);
  const scheduleToday = useMemo(
    () =>
      myPods.filter(
        (p) =>
          p.status !== 'EXPIRED' &&
          isSameLocalCalendarDay(p.meetupTime) &&
          (p.status === 'FORMING' || p.status === 'LOCKED' || p.status === 'COMPLETED')
      ),
    [myPods]
  );
  const pickedActivities = useMemo(() => activities.slice(0, 3), [activities]);
  const clubNames = useMemo(() => user?.clubs?.filter(Boolean) ?? [], [user?.clubs]);

  const firstName = user?.name?.split(' ')[0] ?? '';
  const timeGreeting = getTimeOfDayGreeting();

  const renderFeedCard = (pod: Pod, index: number) => (
    <FadeIn key={pod.id} delay={index * 50}>
      <FeedPodCard
        pod={pod}
        onJoin={() => handleJoin(pod.id)}
        onView={() => navigation.navigate('Pod', { podId: pod.id })}
        onJoinWaitlist={() => handleJoinWaitlist(pod.id)}
        isJoining={joiningId === pod.id}
        isJoiningWaitlist={waitlistingId === pod.id}
        isMember={isMember(pod)}
      />
    </FadeIn>
  );

  const horizontalProps = {
    horizontal: true as const,
    showsHorizontalScrollIndicator: false,
    nestedScrollEnabled: Platform.OS === 'android',
    contentContainerStyle: styles.horizontalScrollContent,
  } as const;

  if (loading) {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.skeletonAvatar} />
              <View style={styles.headerText}>
                <View style={styles.skeletonLineLg} />
                <View style={styles.skeletonLineSm} />
              </View>
            </View>
            <View style={styles.skeletonBell} />
          </View>
          <View style={styles.heroSection}>
            <View style={styles.skeletonCta} />
            <View style={[styles.skeletonLineSm, { alignSelf: 'center', width: 220 }]} />
          </View>
          <View style={styles.sectionBlock}>
            <View style={styles.skeletonSectionHeader} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.skeletonScheduleRow}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.skeletonScheduleCard} />
                ))}
              </View>
            </ScrollView>
          </View>
          <View style={styles.sectionBlock}>
            <View style={styles.skeletonSectionHeader} />
            <View style={styles.sectionBodyPad}>
              {[0, 1, 2].map((i) => (
                <SkeletonActivityCard key={i} />
              ))}
            </View>
          </View>
          <View style={styles.sectionBlock}>
            <View style={styles.skeletonSectionHeader} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.skeletonScheduleRow}>
                {[0, 1].map((i) => (
                  <View key={i} style={styles.skeletonClubCard} />
                ))}
              </View>
            </ScrollView>
          </View>
          <View style={styles.sectionBlock}>
            <View style={styles.skeletonSectionHeader} />
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.feedCard, cardShadowHome, { opacity: 0.6 }]}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: colors.creamBorder,
                    }}
                  />
                  <View style={{ flex: 1, gap: 8 }}>
                    <View
                      style={{
                        height: 14,
                        borderRadius: 4,
                        width: '70%',
                        backgroundColor: colors.creamBorder,
                      }}
                    />
                    <View
                      style={{
                        height: 10,
                        borderRadius: 4,
                        width: '35%',
                        backgroundColor: colors.creamBorder,
                      }}
                    />
                    <View
                      style={{
                        height: 12,
                        borderRadius: 4,
                        width: '90%',
                        backgroundColor: colors.creamBorder,
                      }}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={home.scarlet}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Avatar name={user?.name ?? 'U'} size={44} uri={resolveAvatarUrl(user?.avatarUrl)} />
            <View style={styles.headerText}>
              <Text style={styles.greeting}>
                Hey, {firstName} 👋
              </Text>
              <Text style={styles.subtitle}>{timeGreeting}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('PodInvites')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={24} color={home.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroSection}>
          <PressableScale
            onPress={() => navigation.navigate('FindAGroup')}
            haptic="medium"
            style={[styles.heroButtonWrap, styles.heroButtonSolid]}
          >
            <Text style={styles.heroButtonText}>⚡ Find a Group</Text>
          </PressableScale>
          <Text style={styles.heroSubtext}>See open pods you can join right now</Text>
        </View>

        {/* Section 1 — Your day */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderPad}>
            <SectionHeader label="YOUR DAY" />
          </View>
          {scheduleToday.length === 0 ? (
            <View style={styles.sectionBodyPad}>
              <View style={styles.emptyDashedCard}>
                <Text style={styles.emptyDashedTitle}>Nothing yet</Text>
                <Text style={styles.emptyDashedSub}>Find something below</Text>
              </View>
            </View>
          ) : (
            <ScrollView {...horizontalProps}>
              {scheduleToday.map((pod) => (
                <TouchableOpacity
                  key={pod.id}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('Pod', { podId: pod.id })}
                  style={[styles.scheduleCard, cardShadowHome]}
                >
                  <Text style={styles.scheduleTime}>{formatScheduleTime(pod.meetupTime)}</Text>
                  <View style={styles.scheduleTitleWrap}>
                    <Text style={styles.scheduleTitle} numberOfLines={2}>
                      {pod.activity?.title ?? 'Pod'}
                    </Text>
                  </View>
                  <View style={styles.scheduleLocationRow}>
                    <Ionicons name="location-outline" size={11} color={home.textMuted} />
                    <Text style={styles.scheduleLocation} numberOfLines={1}>
                      {pod.location}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Section 2 — Picked for you */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderPad}>
            <SectionHeader label="PICKED FOR YOU" />
          </View>
          <View style={styles.sectionBodyPad}>
            {pickedActivities.length === 0 ? (
              <View style={styles.emptyDashedCard}>
                <Text style={styles.emptyDashedTitle}>Nothing yet</Text>
                <Text style={styles.emptyDashedSub}>Check back for new activities</Text>
              </View>
            ) : (
              pickedActivities.map((activity, index) => (
                <FadeIn key={activity.id} delay={index * 40}>
                  <ActivityCard
                    variant="home"
                    activity={activity}
                    onPress={() =>
                      navigation.navigate('PodList', {
                        activityId: activity.id,
                        activityTitle: activity.title,
                        activityCategory: activity.category,
                      })
                    }
                  />
                </FadeIn>
              ))
            )}
          </View>
        </View>

        {/* Section 3 — Your clubs */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderPad}>
            <SectionHeader label="YOUR CLUBS" />
          </View>
          {clubNames.length === 0 ? (
            <View style={styles.sectionBodyPad}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.emptyDashedCard}
                onPress={() => navigation.navigate('EditProfile')}
              >
                <Ionicons name="add-circle-outline" size={28} color={home.scarlet} style={{ marginBottom: 6 }} />
                <Text style={styles.emptyDashedTitle}>Join a club</Text>
                <Text style={styles.emptyDashedSub}>Add clubs on your profile</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView {...horizontalProps}>
              {clubNames.map((club) => (
                <TouchableOpacity
                  key={club}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('EditProfile')}
                  style={[styles.clubCard, cardShadowHome]}
                >
                  <View style={styles.clubCardTop}>
                    <View style={[styles.clubAvatar, { backgroundColor: clubCircleBg(club) }]}>
                      <Text style={styles.clubAvatarText}>{club.trim().charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.clubTextCol}>
                      <Text style={styles.clubName} numberOfLines={1}>
                        {club}
                      </Text>
                      <Text style={styles.clubMeta}>On your profile</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Section 4 — Happening now */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderPad}>
            <SectionHeader label="HAPPENING NOW" />
          </View>
          <View style={styles.sectionBodyPad}>
            {feedPodsOrdered.length === 0 ? (
              <View style={styles.emptyDashedCard}>
                <Text style={styles.emptyDashedTitle}>Nothing open right now</Text>
                <Text style={styles.emptyDashedSub}>Try Find a Group above</Text>
              </View>
            ) : (
              <View style={styles.verticalFeed}>{feedPodsOrdered.map((p, i) => renderFeedCard(p, i))}</View>
            )}
          </View>
        </View>
      </ScrollView>

      <GuidelinesModal
        visible={pendingJoinId !== null}
        onAccept={handleGuidelinesAccept}
        onClose={() => setPendingJoinId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: home.creamBg,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    gap: 2,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: home.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: home.textSecondary,
  },
  heroSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroButtonWrap: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    ...cardShadowHome,
  },
  heroButtonSolid: {
    backgroundColor: home.scarlet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  heroSubtext: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionHeaderPad: {
    paddingHorizontal: 16,
  },
  sectionBodyPad: {
    paddingHorizontal: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionHeaderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CC0000',
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#999999',
    textTransform: 'uppercase',
  },
  horizontalScrollContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
  },
  scheduleCard: {
    width: 140,
    height: 100,
    borderRadius: 14,
    backgroundColor: home.cardBg,
    padding: 10,
    marginRight: 10,
  },
  scheduleTime: {
    fontSize: 14,
    fontWeight: '700',
    color: home.scarlet,
    marginBottom: 4,
  },
  scheduleTitleWrap: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
  },
  scheduleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: home.textPrimary,
  },
  scheduleLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  scheduleLocation: {
    fontSize: 11,
    color: home.textMuted,
    flex: 1,
  },
  emptyDashedCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E8E3DB',
    backgroundColor: home.creamBg,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDashedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
    textAlign: 'center',
  },
  emptyDashedSub: {
    fontSize: 12,
    color: '#BBBBBB',
    textAlign: 'center',
    marginTop: 4,
  },
  clubCard: {
    width: 160,
    height: 90,
    borderRadius: 14,
    backgroundColor: home.cardBg,
    padding: 12,
    marginRight: 10,
  },
  clubCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  clubAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clubTextCol: {
    flex: 1,
    minWidth: 0,
  },
  clubName: {
    fontSize: 13,
    fontWeight: '700',
    color: home.textPrimary,
  },
  clubMeta: {
    fontSize: 11,
    color: home.textMuted,
    marginTop: 4,
  },
  verticalFeed: {
    gap: 10,
  },

  feedCard: {
    backgroundColor: home.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 0,
  },
  feedCardLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    zIndex: 2,
  },
  feedCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  emojiCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  feedCardMainCol: {
    flex: 1,
    minWidth: 0,
  },
  feedCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  feedCardCategoryPill: {
    marginLeft: 8,
  },
  feedCardTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '700',
    color: home.textPrimary,
  },
  categoryPill: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  feedCardDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: home.textSecondary,
    marginTop: 4,
    marginBottom: 0,
  },
  feedCardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  feedCardLocation: {
    fontSize: 12,
    color: home.textMuted,
    flex: 1,
  },
  feedCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  joiningText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999999',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.creamBorder,
  },
  skeletonBell: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.creamBorder,
  },
  skeletonLineLg: {
    width: 140,
    height: 18,
    borderRadius: 6,
    backgroundColor: colors.creamBorder,
  },
  skeletonLineSm: {
    width: 120,
    height: 12,
    borderRadius: 4,
    backgroundColor: colors.creamBorder,
    marginTop: 4,
  },
  skeletonCta: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.creamBorder,
  },
  skeletonSectionHeader: {
    width: 120,
    height: 12,
    borderRadius: 4,
    backgroundColor: colors.creamBorder,
    marginLeft: 16,
    marginBottom: 12,
  },
  skeletonScheduleRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 4,
  },
  skeletonScheduleCard: {
    width: 140,
    height: 100,
    borderRadius: 14,
    backgroundColor: colors.creamBorder,
  },
  skeletonClubCard: {
    width: 160,
    height: 90,
    borderRadius: 14,
    backgroundColor: colors.creamBorder,
  },
});
