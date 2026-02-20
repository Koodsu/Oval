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
import { getActivities } from '../api';
import { Activity } from '../types';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import ActivityCard from '../components/ActivityCard';
import FadeIn from '../components/FadeIn';
import { colors, spacing, typography } from '../theme';

export default function ActivityListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivities = useCallback(async () => {
    try {
      const data = await getActivities();
      setActivities(data);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar name={user?.name ?? 'U'} size={42} />
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Hey, {firstName}</Text>
            <Text style={styles.subtitle}>Find your next crew</Text>
          </View>
        </View>
      </View>

      {/* Section */}
      <Text style={styles.sectionTitle}>Explore Activities</Text>

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchActivities();
            }}
            tintColor={colors.primary}
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
                })
              }
            />
          </FadeIn>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="leaf-outline" size={48} color={colors.border} />
            <Text style={styles.emptyText}>No activities available yet</Text>
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
  sectionTitle: {
    ...typography.label,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.caption,
    fontSize: 15,
  },
});
