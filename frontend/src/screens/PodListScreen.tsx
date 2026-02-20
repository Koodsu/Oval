import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { getPodsByActivity, joinPod, createPod } from '../api';
import { Pod } from '../types';
import { useAuth } from '../context/AuthContext';
import PodCard from '../components/PodCard';
import GradientButton from '../components/GradientButton';
import FadeIn from '../components/FadeIn';
import { colors, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PodList'>;

export default function PodListScreen({ route, navigation }: Props) {
  const { activityId } = route.params;
  const { user } = useAuth();

  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchPods = useCallback(async () => {
    try {
      const data = await getPodsByActivity(activityId);
      const sorted = [...data].sort((a, b) => {
        const order: Record<string, number> = { FORMING: 0, LOCKED: 1, COMPLETED: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      });
      setPods(sorted);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load pods');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activityId]);

  useEffect(() => {
    fetchPods();
  }, [fetchPods]);

  const handleJoin = async (podId: string) => {
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

  const handleCreate = async () => {
    setActionId('new');
    try {
      const pod = await createPod(activityId);
      navigation.replace('Pod', { podId: pod.id });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create pod');
    } finally {
      setActionId(null);
    }
  };

  const isAlreadyMember = (pod: Pod) =>
    pod.members.some((m) => m.user.id === user?.id);

  const formingPods = pods.filter((p) => p.status === 'FORMING');
  const otherPods = pods.filter((p) => p.status !== 'FORMING');

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
                loading={actionId === 'new'}
                disabled={actionId !== null}
                icon="add-circle-outline"
              />
            </FadeIn>

            {formingPods.length > 0 && (
              <Text style={styles.sectionLabel}>Open Pods</Text>
            )}
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
              isJoining={actionId === item.id}
              isMember={isAlreadyMember(item)}
            />
            {item.status === 'FORMING' &&
              index < pods.length - 1 &&
              pods[index + 1].status !== 'FORMING' && (
                <Text style={styles.sectionLabel}>Past Pods</Text>
              )}
          </FadeIn>
        )}
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
  sectionLabel: {
    ...typography.label,
    marginTop: spacing.lg,
    marginBottom: spacing.sm + 4,
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
