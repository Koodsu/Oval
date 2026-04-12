import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { getPodsByActivity, joinPod, joinWaitlist } from '../api';
import { Pod } from '../types';
import { useAuth } from '../context/AuthContext';
import PodCard from '../components/PodCard';
import GradientButton from '../components/GradientButton';
import FadeIn from '../components/FadeIn';
import GuidelinesModal from '../components/GuidelinesModal';
import { colors, spacing, radii, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PodList'>;

type SortOption = 'starting_soon' | 'date_posted' | 'most_members';

const SORT_OPTIONS: { key: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'starting_soon', label: 'Starting Soon', icon: 'time-outline' },
  { key: 'date_posted', label: 'Date Posted', icon: 'calendar-outline' },
  { key: 'most_members', label: 'Most Members', icon: 'people-outline' },
];

export default function PodListScreen({ route, navigation }: Props) {
  const { activityId, activityTitle, activityCategory } = route.params;
  const { user, hasAcceptedGuidelines, acceptGuidelines } = useAuth();

  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [waitlistingId, setWaitlistingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('starting_soon');
  const [pendingAction, setPendingAction] = useState<{ type: 'join'; podId: string } | { type: 'create' } | null>(null);

  const fetchPods = useCallback(async () => {
    try {
      const data = await getPodsByActivity(activityId, sortBy);
      setPods(data);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load pods');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activityId, sortBy]);

  useEffect(() => {
    fetchPods();
  }, [fetchPods]);

  const executeJoin = async (podId: string) => {
    setActionId(podId);
    try {
      const pod = await joinPod(podId);
      navigation.replace('Pod', { podId: pod.id });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to join pod');
    } finally {
      setActionId(null);
    }
  };

  const handleJoin = (podId: string) => {
    if (!hasAcceptedGuidelines) {
      setPendingAction({ type: 'join', podId });
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

  const executeCreate = () => {
    navigation.navigate('CreatePod', {
      activityId,
      activityTitle,
      activityCategory: activityCategory ?? 'Social',
    });
  };

  const handleCreate = () => {
    if (!hasAcceptedGuidelines) {
      setPendingAction({ type: 'create' });
    } else {
      executeCreate();
    }
  };

  const handleGuidelinesAccept = async () => {
    await acceptGuidelines();
    const action = pendingAction;
    setPendingAction(null);
    if (action?.type === 'join') {
      executeJoin(action.podId);
    } else if (action?.type === 'create') {
      executeCreate();
    }
  };

  const handleGuidelinesClose = () => {
    setPendingAction(null);
  };

  const isAlreadyMember = (pod: Pod) =>
    pod.members.some((m) => m.user.id === user?.id);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={pods}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPods();
            }}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <FadeIn delay={0}>
              <GradientButton
                title="Start a Pod"
                onPress={handleCreate}
                disabled={actionId !== null}
                icon="add-circle-outline"
              />
            </FadeIn>

            {/* Sort options */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sortRow}
            >
              {SORT_OPTIONS.map((opt) => {
                const isActive = sortBy === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.sortChip, isActive && styles.sortChipActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSortBy(opt.key);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={14}
                      color={isActive ? colors.textInverse : colors.textSecondary}
                    />
                    <Text style={[styles.sortText, isActive && styles.sortTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {pods.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color={colors.border} />
                <Text style={styles.emptyTitle}>No pods yet</Text>
                <Text style={styles.emptySubtitle}>Be the first to start one!</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <FadeIn delay={(index + 1) * 70}>
            <PodCard
              pod={item}
              currentUserId={user?.id}
              onJoin={() => handleJoin(item.id)}
              onView={() => navigation.navigate('Pod', { podId: item.id })}
              onJoinWaitlist={() => handleJoinWaitlist(item.id)}
              isJoining={actionId === item.id}
              isJoiningWaitlist={waitlistingId === item.id}
              isMember={isAlreadyMember(item)}
            />
          </FadeIn>
        )}
      />

      <GuidelinesModal
        visible={pendingAction !== null}
        onAccept={handleGuidelinesAccept}
        onClose={handleGuidelinesClose}
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
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm - 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sortTextActive: {
    color: colors.textInverse,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  emptySubtitle: {
    ...typography.caption,
  },
});
