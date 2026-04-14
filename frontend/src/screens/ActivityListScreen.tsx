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
import { getActivities, resolveAvatarUrl, API_USER_MESSAGE } from '../api';
import { Activity } from '../types';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import ActivityCard from '../components/ActivityCard';
import CategoryFilter from '../components/CategoryFilter';
import FadeIn from '../components/FadeIn';
import { colors, spacing, typography } from '../theme';

export default function ActivityListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchActivities = useCallback(async (category?: string | null) => {
    try {
      const data = await getActivities(category ?? undefined);
      setActivities(data);
    } catch (err: unknown) {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities(selectedCategory);
  }, [fetchActivities, selectedCategory]);

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
          <Avatar name={user?.name ?? 'U'} size={42} uri={resolveAvatarUrl(user?.avatarUrl)} />
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Hey, {firstName}</Text>
            <Text style={styles.subtitle}>Find your next crew</Text>
          </View>
        </View>
      </View>

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
              fetchActivities(selectedCategory);
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.sectionTitle}>Explore Activities</Text>
            <CategoryFilter
              selected={selectedCategory}
              onSelect={(cat) => setSelectedCategory(cat)}
            />
          </View>
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
