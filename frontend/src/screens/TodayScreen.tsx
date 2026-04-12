import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../App';
import { fetchFeed, getActivities, joinPod, joinWaitlist, resolveAvatarUrl } from '../api';
import { Pod, Activity } from '../types';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import ActivityCard from '../components/ActivityCard';
import FadeIn from '../components/FadeIn';
import PressableScale from '../components/PressableScale';
import GuidelinesModal from '../components/GuidelinesModal';
import TagPills from '../components/TagPills';
import { SkeletonFeedCard, SkeletonActivityCard } from '../components/SkeletonLoader';
import { colors, spacing, radii, shadows, typography } from '../theme';
import { CATEGORY_META } from '../constants/categories';
import { formatMeetupTime } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
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
  currentUserId?: string;
}

function FeedPodCard({ pod, onJoin, onView, onJoinWaitlist, isJoining, isJoiningWaitlist = false, isMember, currentUserId }: FeedPodCardProps) {
  const memberCount = pod.members.length;
  const spotsLeft = pod.maxMembers - memberCount;
  const progress = memberCount / pod.maxMembers;
  const meta = pod.activity ? CATEGORY_META[pod.activity.category] : null;
  const accentColor = meta?.color ?? colors.primary;

  let spotsColor = colors.green;
  let spotsBg = colors.greenLight;
  if (spotsLeft === 1) {
    spotsColor = colors.red;
    spotsBg = '#fee2e2';
  } else if (spotsLeft === 2) {
    spotsColor = colors.amber;
    spotsBg = colors.amberLight;
  }

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    isMember ? onView() : onJoin();
  };

  return (
    <PressableScale onPress={handlePress} haptic="light" style={[styles.feedCard, shadows.md]}>
      {/* Activity icon + title */}
      <View style={styles.feedCardHeader}>
        <View style={[styles.feedCardIcon, { backgroundColor: accentColor + '1a' }]}>
          <Ionicons name={meta?.icon ?? 'sparkles-outline'} size={16} color={accentColor} />
        </View>
        <View style={styles.feedCardTitleRow}>
          <Text style={styles.feedCardTitle} numberOfLines={2}>{pod.activity?.title ?? 'Pod'}</Text>
          {pod.recommended && (
            <View style={styles.forYouBadge}>
              <Text style={styles.forYouBadgeText}>For You</Text>
            </View>
          )}
        </View>
      </View>

      {/* Time */}
      <View style={styles.feedCardMeta}>
        <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
        <Text style={styles.feedCardMetaText}>{formatMeetupTime(pod.meetupTime)}</Text>
      </View>

      {/* Location */}
      <View style={styles.feedCardMeta}>
        <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
        <Text style={styles.feedCardMetaText} numberOfLines={1}>{pod.location}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.feedCardProgressTrack}>
        <View
          style={[
            styles.feedCardProgressFill,
            { width: `${progress * 100}%` as `${number}%`, backgroundColor: accentColor },
          ]}
        />
      </View>

      {/* Member interest tag preview (non-self members only) */}
      {(() => {
        const otherTags = pod.members
          .filter((m) => m.userId !== currentUserId)
          .flatMap((m) => m.user.interestTags ?? []);
        const uniqueTags = [...new Set(otherTags)];
        if (uniqueTags.length === 0) return null;
        return <TagPills tags={uniqueTags} max={3} size="sm" style={styles.memberTagsPreview} />;
      })()}

      {/* Spots badge */}
      <View style={styles.feedCardFooter}>
        {spotsLeft > 0 ? (
          <View style={[styles.spotsBadge, { backgroundColor: spotsBg }]}>
            <Text style={[styles.spotsBadgeText, { color: spotsColor }]}>
              {spotsLeft === 1 ? '1 spot left!' : `${spotsLeft} spots left`}
            </Text>
          </View>
        ) : (
          <View style={[styles.spotsBadge, { backgroundColor: colors.borderLight }]}>
            <Text style={[styles.spotsBadgeText, { color: colors.textTertiary }]}>Full</Text>
          </View>
        )}
      </View>

      {/* Action */}
      {isMember ? (
        <TouchableOpacity style={styles.feedCardAction} onPress={onView} activeOpacity={0.7}>
          <Text style={styles.feedCardActionText}>View Pod</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      ) : spotsLeft <= 0 && onJoinWaitlist ? (
        <TouchableOpacity
          style={[styles.feedCardWaitlistBtn, isJoiningWaitlist && styles.feedCardJoinBtnLoading]}
          onPress={onJoinWaitlist}
          disabled={isJoiningWaitlist}
          activeOpacity={0.8}
        >
          {isJoiningWaitlist ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="time-outline" size={14} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.feedCardWaitlistText}>Join Waitlist</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.feedCardJoinBtn, isJoining && styles.feedCardJoinBtnLoading]}
          onPress={onJoin}
          disabled={isJoining}
          activeOpacity={0.8}
        >
          {isJoining ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Text style={styles.feedCardJoinText}>Join Pod</Text>
          )}
        </TouchableOpacity>
      )}
    </PressableScale>
  );
}

export default function TodayScreen() {
  const navigation = useNavigation<Nav>();
  const { user, hasAcceptedGuidelines, acceptGuidelines } = useAuth();
  const insets = useSafeAreaInsets();

  const [pods, setPods] = useState<Pod[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(null);
  const [waitlistingId, setWaitlistingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [feedPods, acts] = await Promise.all([fetchFeed(), getActivities()]);
      setPods(feedPods);
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

  const todayPods = pods.filter((p) => isToday(p.meetupTime));
  const weekPods = pods.filter((p) => !isToday(p.meetupTime));
  const hasAnyPods = todayPods.length > 0 || weekPods.length > 0;
  const firstName = user?.name?.split(' ')[0] ?? '';

  const renderFeedCard = (pod: Pod, index: number) => (
    <FadeIn key={pod.id} delay={index * 60}>
      <FeedPodCard
        pod={pod}
        onJoin={() => handleJoin(pod.id)}
        onView={() => navigation.navigate('Pod', { podId: pod.id })}
        onJoinWaitlist={() => handleJoinWaitlist(pod.id)}
        isJoining={joiningId === pod.id}
        isJoiningWaitlist={waitlistingId === pod.id}
        isMember={isMember(pod)}
        currentUserId={user?.id}
      />
    </FadeIn>
  );

  const renderActivityList = (heading: string) => (
    <View style={[styles.section, styles.browseSection]}>
      <Text style={styles.sectionLabel}>{heading}</Text>
      {activities.length === 0 ? (
        <View style={styles.emptySection}>
          <Ionicons name="leaf-outline" size={32} color={colors.border} />
          <Text style={styles.emptySectionTitle}>No activities available</Text>
          <Text style={styles.emptySectionSub}>Check back soon — new activities are added regularly.</Text>
        </View>
      ) : (
        activities.map((activity, index) => (
          <FadeIn key={activity.id} delay={index * 30}>
            <ActivityCard
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
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.border }} />
              <View style={styles.headerText}>
                <View style={{ width: 120, height: 18, borderRadius: 6, backgroundColor: colors.border }} />
                <View style={{ width: 160, height: 12, borderRadius: 4, backgroundColor: colors.borderLight, marginTop: 4 }} />
              </View>
            </View>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
            <View style={{ width: '100%', height: 52, borderRadius: radii.md, backgroundColor: colors.border }} />
          </View>
          <View style={styles.section}>
            <View style={{ width: 120, height: 12, borderRadius: 4, backgroundColor: colors.borderLight, marginLeft: spacing.lg, marginBottom: spacing.md }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {[0, 1, 2].map((i) => <SkeletonFeedCard key={i} />)}
            </ScrollView>
          </View>
          <View style={[styles.section, styles.browseSection]}>
            <View style={{ width: 130, height: 12, borderRadius: 4, backgroundColor: colors.borderLight, marginBottom: spacing.md }} />
            {[0, 1, 2, 3].map((i) => <SkeletonActivityCard key={i} />)}
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
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Avatar name={user?.name ?? 'U'} size={42} uri={resolveAvatarUrl(user?.avatarUrl)} />
            <View style={styles.headerText}>
              <Text style={styles.greeting}>Hey, {firstName}</Text>
              <Text style={styles.subtitle}>What's happening today</Text>
            </View>
          </View>
        </View>

        {/* Find a Group CTA */}
        <View style={styles.heroSection}>
          <PressableScale
            style={styles.heroButton}
            onPress={() => navigation.navigate('FindAGroup')}
            haptic="medium"
          >
            <Ionicons name="flash" size={20} color={colors.textInverse} />
            <Text style={styles.heroButtonText}>Find a Group</Text>
          </PressableScale>
          <Text style={styles.heroSubtext}>See open pods you can join right now</Text>
        </View>

        {/* No pods: promote activity list to the top */}
        {!hasAnyPods && renderActivityList('Find something to join')}

        {/* Has pods: show pod sections, then activities below */}
        {hasAnyPods && (
          <>
            {/* Happening Today */}
            {todayPods.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Happening Today</Text>
                <FlatList
                  data={todayPods}
                  keyExtractor={(p) => p.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  renderItem={({ item, index }) => renderFeedCard(item, index)}
                />
              </View>
            )}

            {/* Starting This Week */}
            {weekPods.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Starting This Week</Text>
                <FlatList
                  data={weekPods}
                  keyExtractor={(p) => p.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  renderItem={({ item, index }) => renderFeedCard(item, index)}
                />
              </View>
            )}

            {/* Browse Activities */}
            {renderActivityList('Browse Activities')}
          </>
        )}
      </ScrollView>

      <GuidelinesModal
        visible={pendingJoinId !== null}
        onAccept={handleGuidelinesAccept}
        onClose={() => setPendingJoinId(null)}
      />
    </View>
  );
}

const FEED_CARD_WIDTH = 220;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  headerText: {
    gap: 2,
  },
  greeting: {
    ...typography.h2,
  },
  subtitle: {
    ...typography.caption,
  },
  heroSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    width: '100%',
    ...shadows.sm,
  },
  heroButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  heroSubtext: {
    ...typography.caption,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  browseSection: {
    paddingHorizontal: spacing.lg,
  },
  sectionLabel: {
    ...typography.label,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  horizontalList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm + 4,
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptySectionTitle: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  emptySectionSub: {
    ...typography.caption,
    textAlign: 'center',
  },

  /* Feed pod card */
  feedCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    width: FEED_CARD_WIDTH,
  },
  feedCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  feedCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  feedCardTitleRow: {
    flex: 1,
    gap: 4,
  },
  feedCardTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    lineHeight: 19,
  },
  forYouBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  forYouBadgeText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  feedCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  feedCardMetaText: {
    ...typography.caption,
    fontSize: 12,
    flex: 1,
  },
  feedCardProgressTrack: {
    height: 3,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.sm - 2,
  },
  feedCardProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  memberTagsPreview: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  feedCardFooter: {
    marginBottom: spacing.sm,
  },
  spotsBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  spotsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  feedCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  feedCardActionText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 13,
  },
  feedCardJoinBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 2,
  },
  feedCardJoinBtnLoading: {
    backgroundColor: colors.textTertiary,
  },
  feedCardJoinText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '700',
  },
  feedCardWaitlistBtn: {
    borderRadius: radii.sm,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 2,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  feedCardWaitlistText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
