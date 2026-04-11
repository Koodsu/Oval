import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../App';
import { fetchFeed, joinPod } from '../api';
import { Pod } from '../types';
import { useAuth } from '../context/AuthContext';
import GuidelinesModal from '../components/GuidelinesModal';
import FadeIn from '../components/FadeIn';
import { colors, spacing, radii, shadows, typography } from '../theme';
import { CATEGORY_META } from '../constants/categories';
import { formatMeetupTime } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface DiscoveryPodCardProps {
  pod: Pod;
  onJoin: () => void;
  onView: () => void;
  isJoining: boolean;
  isMember: boolean;
}

function DiscoveryPodCard({ pod, onJoin, onView, isJoining, isMember }: DiscoveryPodCardProps) {
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
    <TouchableOpacity
      style={[styles.card, shadows.md]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        isMember ? onView() : onJoin();
      }}
      activeOpacity={0.88}
    >
      {/* Header: icon + title + badge */}
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: accentColor + '18' }]}>
          <Ionicons name={meta?.icon ?? 'sparkles-outline'} size={18} color={accentColor} />
        </View>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardTitle} numberOfLines={1}>{pod.activity?.title ?? 'Pod'}</Text>
          {pod.recommended && (
            <View style={[styles.forYouBadge, { backgroundColor: accentColor }]}>
              <Text style={styles.forYouBadgeText}>For You</Text>
            </View>
          )}
        </View>
      </View>

      {/* Meta */}
      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
        <Text style={styles.metaText}>{formatMeetupTime(pod.meetupTime)}</Text>
        <View style={styles.metaDot} />
        <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
        <Text style={styles.metaText} numberOfLines={1}>{pod.location}</Text>
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%` as `${number}%`, backgroundColor: accentColor },
            ]}
          />
        </View>
        <Text style={styles.memberText}>{memberCount}/{pod.maxMembers} joined</Text>
      </View>

      {/* Footer: spots badge + action */}
      <View style={styles.cardFooter}>
        <View style={[styles.spotsBadge, { backgroundColor: spotsBg }]}>
          <Text style={[styles.spotsBadgeText, { color: spotsColor }]}>
            {spotsLeft === 1 ? '1 spot left!' : `${spotsLeft} spots left`}
          </Text>
        </View>

        {isMember ? (
          <TouchableOpacity style={styles.viewBtn} onPress={onView} activeOpacity={0.7}>
            <Text style={styles.viewBtnText}>View Pod</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.primary} />
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
    </TouchableOpacity>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

export default function FindAGroupScreen() {
  const navigation = useNavigation<Nav>();
  const { user, hasAcceptedGuidelines, acceptGuidelines } = useAuth();

  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const feedPods = await fetchFeed({ limit: 50 });
      setPods(feedPods);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load pods');
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

  const isMember = (pod: Pod) => pod.members.some((m) => m.user.id === user?.id);

  // Personalized: pods from activities the user has history with
  const forYouPods = pods.filter((p) => p.recommended);

  // Trending: pods with the most members, excluding already-recommended ones to avoid duplicates
  const trendingPods = [...pods]
    .filter((p) => !p.recommended)
    .sort((a, b) => b.members.length - a.members.length || new Date(a.meetupTime).getTime() - new Date(b.meetupTime).getTime());

  const renderCard = (pod: Pod, index: number) => (
    <FadeIn key={pod.id} delay={index * 50}>
      <DiscoveryPodCard
        pod={pod}
        onJoin={() => handleJoin(pod.id)}
        onView={() => navigation.navigate('Pod', { podId: pod.id })}
        isJoining={joiningId === pod.id}
        isMember={isMember(pod)}
      />
    </FadeIn>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isNewUser = forYouPods.length === 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
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
        {/* For You section — only shown for returning users */}
        {!isNewUser && (
          <View style={styles.section}>
            <SectionHeader
              title="For You"
              subtitle="Based on activities you've joined before"
            />
            {forYouPods.map((pod, i) => renderCard(pod, i))}
          </View>
        )}

        {/* Trending / Popular section */}
        <View style={styles.section}>
          <SectionHeader
            title={isNewUser ? 'Popular Right Now' : 'Trending Now'}
            subtitle={
              isNewUser
                ? 'New here? Check out what\'s filling up on campus'
                : 'Open pods with the most interest'
            }
          />
          {trendingPods.length > 0 ? (
            trendingPods.map((pod, i) => renderCard(pod, forYouPods.length + i))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="bonfire-outline" size={40} color={colors.border} />
              <Text style={styles.emptyTitle}>
                {isNewUser ? 'No open pods yet' : 'Nothing else right now'}
              </Text>
              <Text style={styles.emptySub}>
                {isNewUser
                  ? 'Be the first to start something — browse activities to create a pod.'
                  : 'All available pods are already in your "For You" list.'}
              </Text>
            </View>
          )}
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
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  content: {
    paddingVertical: spacing.md,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: 3,
  },
  sectionTitle: {
    ...typography.h3,
  },
  sectionSubtitle: {
    ...typography.caption,
  },

  /* Discovery pod card */
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm + 4,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  cardTitle: {
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.sm,
    flexWrap: 'nowrap',
  },
  metaText: {
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
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  memberText: {
    ...typography.tiny,
    fontWeight: '600',
  },
  cardFooter: {
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

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  emptySub: {
    ...typography.caption,
    textAlign: 'center',
    lineHeight: 19,
  },
});
