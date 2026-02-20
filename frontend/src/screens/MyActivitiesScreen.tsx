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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { getMyPods } from '../api';
import { Pod } from '../types';
import { useAuth } from '../context/AuthContext';
import PodCard from '../components/PodCard';
import FadeIn from '../components/FadeIn';
import { colors, spacing, typography } from '../theme';

export default function MyActivitiesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPods = useCallback(async () => {
    try {
      const data = await getMyPods();
      setPods(data);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load your pods');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPods();
  }, [fetchPods]);

  const activePods = pods.filter((p) => p.status === 'FORMING' || p.status === 'LOCKED');
  const pastPods = pods.filter((p) => p.status === 'COMPLETED');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const sections: { title: string; data: Pod[] }[] = [];
  if (activePods.length > 0) sections.push({ title: 'Active Pods', data: activePods });
  if (pastPods.length > 0) sections.push({ title: 'Past Pods', data: pastPods });

  const flatData = sections.flatMap((s) => [
    { type: 'header' as const, title: s.title, id: `header-${s.title}` },
    ...s.data.map((pod) => ({ type: 'pod' as const, pod, id: pod.id })),
  ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Activities</Text>
        <Text style={styles.subtitle}>Pods you've joined</Text>
      </View>

      <FlatList
        data={flatData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
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
        renderItem={({ item, index }) => {
          if (item.type === 'header') {
            return <Text style={styles.sectionTitle}>{item.title}</Text>;
          }

          return (
            <FadeIn delay={index * 70}>
              <PodCard
                pod={item.pod}
                currentUserId={user?.id}
                isMember={true}
                isJoining={false}
                onJoin={() => {}}
                onView={() => navigation.navigate('Pod', { podId: item.pod.id })}
              />
            </FadeIn>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No pods yet</Text>
            <Text style={styles.emptyText}>
              Explore activities and join a pod to get started
            </Text>
          </View>
        }
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: 2,
  },
  heading: {
    ...typography.h2,
  },
  subtitle: {
    ...typography.caption,
  },
  sectionTitle: {
    ...typography.label,
    marginBottom: spacing.sm + 4,
    marginTop: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
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
});
