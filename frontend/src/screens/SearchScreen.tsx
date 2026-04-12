import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../App';
import { getActivities, fetchFeed, joinPod, joinWaitlist } from '../api';
import { Activity, Pod } from '../types';
import { useAuth } from '../context/AuthContext';
import ActivityCard from '../components/ActivityCard';
import CategoryFilter from '../components/CategoryFilter';
import FadeIn from '../components/FadeIn';
import PressableScale from '../components/PressableScale';
import GuidelinesModal from '../components/GuidelinesModal';
import TagPills from '../components/TagPills';
import { SkeletonPodCard } from '../components/SkeletonLoader';
import { colors, spacing, radii, typography, shadows } from '../theme';
import { CATEGORY_META } from '../constants/categories';
import { formatMeetupTime } from '../utils/format';

type Tab = 'pods' | 'activities';
type TimeFilter = 'all' | 'today' | 'week';

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isThisWeek(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 86_400_000);
  return d >= now && d <= weekFromNow;
}

interface SearchPodCardProps {
  pod: Pod;
  onJoin: () => void;
  onView: () => void;
  onJoinWaitlist?: () => void;
  isJoining: boolean;
  isJoiningWaitlist?: boolean;
  isMember: boolean;
  currentUserId?: string;
}

function SearchPodCard({ pod, onJoin, onView, onJoinWaitlist, isJoining, isJoiningWaitlist = false, isMember, currentUserId }: SearchPodCardProps) {
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

  return (
    <PressableScale
      style={[styles.podCard, shadows.md]}
      onPress={() => {
        isMember ? onView() : onJoin();
      }}
      haptic="light"
    >
      {/* Header: icon + title + "For You" badge */}
      <View style={styles.podCardHeader}>
        <View style={[styles.podCardIcon, { backgroundColor: accentColor + '18' }]}>
          <Ionicons name={meta?.icon ?? 'sparkles-outline'} size={18} color={accentColor} />
        </View>
        <View style={styles.podCardTitleBlock}>
          <Text style={styles.podCardTitle} numberOfLines={1}>
            {pod.activity?.title ?? 'Pod'}
          </Text>
          {pod.recommended && (
            <View style={[styles.forYouBadge, { backgroundColor: accentColor }]}>
              <Text style={styles.forYouBadgeText}>For You</Text>
            </View>
          )}
        </View>
      </View>

      {/* Meta */}
      <View style={styles.podCardMeta}>
        <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
        <Text style={styles.podCardMetaText}>{formatMeetupTime(pod.meetupTime)}</Text>
        <View style={styles.metaDot} />
        <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
        <Text style={[styles.podCardMetaText, { flex: 1 }]} numberOfLines={1}>
          {pod.location}
        </Text>
      </View>

      {/* Progress */}
      <View style={styles.podCardProgressRow}>
        <View style={styles.podCardProgressTrack}>
          <View
            style={[
              styles.podCardProgressFill,
              { width: `${progress * 100}%` as `${number}%`, backgroundColor: accentColor },
            ]}
          />
        </View>
        <Text style={styles.podCardMemberText}>{memberCount}/{pod.maxMembers} joined</Text>
      </View>

      {/* Member interest tag preview */}
      {(() => {
        const otherTags = pod.members
          .filter((m) => m.userId !== currentUserId)
          .flatMap((m) => m.user.interestTags ?? []);
        const uniqueTags = [...new Set(otherTags)];
        if (uniqueTags.length === 0) return null;
        return <TagPills tags={uniqueTags} max={3} size="sm" style={{ marginBottom: spacing.sm }} />;
      })()}

      {/* Footer */}
      <View style={styles.podCardFooter}>
        <View style={[styles.spotsBadge, { backgroundColor: spotsBg }]}>
          <Text style={[styles.spotsBadgeText, { color: spotsColor }]}>
            {spotsLeft <= 0 ? 'Full' : spotsLeft === 1 ? '1 spot left!' : `${spotsLeft} spots left`}
          </Text>
        </View>

        {isMember ? (
          <TouchableOpacity style={styles.viewBtn} onPress={onView} activeOpacity={0.7}>
            <Text style={styles.viewBtnText}>View Pod</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.primary} />
          </TouchableOpacity>
        ) : spotsLeft <= 0 && onJoinWaitlist ? (
          <TouchableOpacity
            style={[styles.waitlistBtn, isJoiningWaitlist && styles.joinBtnLoading]}
            onPress={onJoinWaitlist}
            disabled={isJoiningWaitlist}
            activeOpacity={0.8}
          >
            {isJoiningWaitlist ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="time-outline" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.waitlistBtnText}>Join Waitlist</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.joinBtn, isJoining && styles.joinBtnLoading]}
            onPress={onJoin}
            disabled={isJoining}
            activeOpacity={0.8}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Text style={styles.joinBtnText}>Join Pod</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </PressableScale>
  );
}

export default function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user, hasAcceptedGuidelines, acceptGuidelines } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('pods');
  const [query, setQuery] = useState('');

  // Pods tab state
  const [pods, setPods] = useState<Pod[]>([]);
  const [podsLoading, setPodsLoading] = useState(true);
  const [podsRefreshing, setPodsRefreshing] = useState(false);
  const [podCategory, setPodCategory] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [waitlistingId, setWaitlistingId] = useState<string | null>(null);
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(null);

  // Activities tab state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesRefreshing, setActivitiesRefreshing] = useState(false);
  const [activityCategory, setActivityCategory] = useState<string | null>(null);

  const fetchPods = useCallback(async () => {
    try {
      const data = await fetchFeed({ limit: 100 });
      // Sort by soonest meetup
      const sorted = [...data].sort(
        (a, b) => new Date(a.meetupTime).getTime() - new Date(b.meetupTime).getTime()
      );
      setPods(sorted);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load pods');
    } finally {
      setPodsLoading(false);
      setPodsRefreshing(false);
    }
  }, []);

  const fetchActivities = useCallback(async (category?: string | null) => {
    try {
      const data = await getActivities(category ?? undefined);
      setActivities(data);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setActivitiesLoading(false);
      setActivitiesRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPods();
  }, [fetchPods]);

  useEffect(() => {
    fetchActivities(activityCategory);
  }, [fetchActivities, activityCategory]);

  // Filtered pods: category, time, search query
  const filteredPods = useMemo(() => {
    let result = pods;

    if (podCategory) {
      result = result.filter((p) => p.activity?.category === podCategory);
    }

    if (timeFilter === 'today') {
      result = result.filter((p) => isToday(p.meetupTime));
    } else if (timeFilter === 'week') {
      result = result.filter((p) => isThisWeek(p.meetupTime));
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (p) =>
          (p.activity?.title ?? '').toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q)
      );
    }

    return result;
  }, [pods, podCategory, timeFilter, query]);

  // Filtered activities: category filter is server-side, just apply query
  const filteredActivities = useMemo(() => {
    if (!query.trim()) return activities;
    const q = query.toLowerCase();
    return activities.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.defaultLocation.toLowerCase().includes(q)
    );
  }, [activities, query]);

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

  const handleGuidelinesAccept = async () => {
    await acceptGuidelines();
    const id = pendingJoinId;
    setPendingJoinId(null);
    if (id) executeJoin(id);
  };

  const isMember = (pod: Pod) => pod.members.some((m) => m.user.id === user?.id);

  const handleTabChange = (tab: Tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    setQuery('');
  };

  const isLoading = activeTab === 'pods' ? podsLoading : activitiesLoading;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.heading}>Search</Text>
        </View>
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => <SkeletonPodCard key={i} />)}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>Search</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pods' && styles.tabActive]}
          onPress={() => handleTabChange('pods')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'pods' ? 'people' : 'people-outline'}
            size={16}
            color={activeTab === 'pods' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'pods' && styles.tabTextActive]}>Pods</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'activities' && styles.tabActive]}
          onPress={() => handleTabChange('activities')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'activities' ? 'grid' : 'grid-outline'}
            size={16}
            color={activeTab === 'activities' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'activities' && styles.tabTextActive]}>
            Activities
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchBarContainer}>
        <View style={[styles.searchBar, shadows.sm]}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'pods' ? 'Search pods by activity or location...' : 'Search activities, locations...'}
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textTertiary}
              onPress={() => setQuery('')}
            />
          )}
        </View>
      </View>

      {/* Pods tab */}
      {activeTab === 'pods' && (
        <FlatList
          data={filteredPods}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={podsRefreshing}
              onRefresh={() => {
                setPodsRefreshing(true);
                fetchPods();
              }}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <View>
              {/* Category filter */}
              <CategoryFilter
                selected={podCategory}
                onSelect={(cat) => setPodCategory(cat)}
              />

              {/* Time filter chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.timeFilterRow}
              >
                {([
                  { key: 'all', label: 'All Times', icon: 'calendar-outline' },
                  { key: 'today', label: 'Today', icon: 'sunny-outline' },
                  { key: 'week', label: 'This Week', icon: 'calendar-clear-outline' },
                ] as { key: TimeFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[]).map((opt) => {
                  const isActive = timeFilter === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.timeChip, isActive && styles.timeChipActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setTimeFilter(opt.key);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={13}
                        color={isActive ? colors.textInverse : colors.textSecondary}
                      />
                      <Text style={[styles.timeChipText, isActive && styles.timeChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          }
          renderItem={({ item, index }) => (
            <FadeIn delay={index * 50}>
              <SearchPodCard
                pod={item}
                onJoin={() => handleJoin(item.id)}
                onView={() => navigation.navigate('Pod', { podId: item.id })}
                onJoinWaitlist={() => handleJoinWaitlist(item.id)}
                isJoining={joiningId === item.id}
                isJoiningWaitlist={waitlistingId === item.id}
                isMember={isMember(item)}
                currentUserId={user?.id}
              />
            </FadeIn>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>
                {query.trim() ? 'No pods found' : 'No pods right now'}
              </Text>
              <Text style={styles.emptyText}>
                {query.trim()
                  ? `No pods match "${query}"`
                  : 'Check back later or browse activities to start one'}
              </Text>
            </View>
          }
        />
      )}

      {/* Activities tab */}
      {activeTab === 'activities' && (
        <FlatList
          data={filteredActivities}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={activitiesRefreshing}
              onRefresh={() => {
                setActivitiesRefreshing(true);
                fetchActivities(activityCategory);
              }}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <CategoryFilter
              selected={activityCategory}
              onSelect={(cat) => setActivityCategory(cat)}
            />
          }
          renderItem={({ item, index }) => (
            <FadeIn delay={index * 70}>
              <ActivityCard
                activity={item}
                onPress={() =>
                  navigation.navigate('PodList', {
                    activityId: item.id,
                    activityTitle: item.title,
                    activityCategory: item.category,
                  })
                }
              />
            </FadeIn>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="search-outline" size={40} color={colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>
                {query.trim() ? 'No results found' : 'No activities yet'}
              </Text>
              <Text style={styles.emptyText}>
                {query.trim()
                  ? `No activities match "${query}"`
                  : 'Find activities by name or location'}
              </Text>
            </View>
          }
        />
      )}

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
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  heading: {
    ...typography.h2,
  },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.borderLight,
    borderRadius: radii.md,
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  tabActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },

  /* Search bar */
  searchBarContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 44,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    paddingVertical: 0,
    letterSpacing: 0,
  },

  /* Time filter */
  timeFilterRow: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  timeChipTextActive: {
    color: colors.textInverse,
  },

  /* List */
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  /* Empty state */
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  emptyText: {
    ...typography.caption,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Pod card */
  podCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.sm + 4,
    padding: spacing.md,
  },
  podCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  podCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  podCardTitleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  podCardTitle: {
    ...typography.bodyBold,
    flex: 1,
  },
  forYouBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  forYouBadgeText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  podCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.sm,
    flexWrap: 'nowrap',
  },
  podCardMetaText: {
    ...typography.caption,
    fontSize: 12,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.border,
    marginHorizontal: 2,
  },
  podCardProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  podCardProgressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  podCardProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  podCardMemberText: {
    ...typography.tiny,
    fontWeight: '600',
  },
  podCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  spotsBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  spotsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewBtnText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 13,
  },
  joinBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    minWidth: 90,
    alignItems: 'center',
  },
  joinBtnLoading: {
    backgroundColor: colors.textTertiary,
  },
  joinBtnText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '700',
  },
  waitlistBtn: {
    borderRadius: radii.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    minWidth: 90,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  waitlistBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
