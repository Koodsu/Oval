import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { getMyPods, getMyPodHistory, API_USER_MESSAGE } from '../api';
import { Pod } from '../types';
import { useAuth } from '../context/AuthContext';
import PodCard from '../components/PodCard';
import FadeIn from '../components/FadeIn';
import { colors, spacing, typography, radii, shadows } from '../theme';

export default function MyActivitiesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [history, setHistory] = useState<Pod[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchPods = useCallback(async () => {
    try {
      const data = await getMyPods();
      setPods(data);
    } catch {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void fetchPods();
    }, [fetchPods])
  );

  const openHistory = useCallback(async () => {
    setHistoryVisible(true);
    setHistoryLoading(true);
    try {
      const data = await getMyPodHistory();
      setHistory(data);
    } catch {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.tabLoadingInner}>
          <ActivityIndicator size="large" color={colors.scarlet} />
        </View>
      </View>
    );
  }

  const flatData = pods.map((pod) => ({ type: 'pod' as const, pod, id: pod.id }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.heading}>My Activities</Text>
            <Text style={styles.subtitle}>Pods you've joined</Text>
          </View>
          <TouchableOpacity style={styles.historyBtn} onPress={openHistory}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.historyBtnText}>History</Text>
          </TouchableOpacity>
        </View>
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
        renderItem={({ item, index }) => (
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
        )}
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

      <Modal
        visible={historyVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Completed Pods</Text>
            <TouchableOpacity onPress={() => setHistoryVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>Pods from the last 2 weeks</Text>

          {historyLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : history.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.modalEmptyTitle}>No completed pods</Text>
              <Text style={styles.modalEmptyBody}>Pods you complete will appear here for 2 weeks.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.modalList}>
              {history.map((pod) => (
                <TouchableOpacity
                  key={pod.id}
                  style={[styles.historyCard, shadows.sm]}
                  onPress={() => {
                    setHistoryVisible(false);
                    navigation.navigate('Pod', { podId: pod.id });
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.historyCardRow}>
                    <View style={styles.historyCardInfo}>
                      <Text style={styles.historyCardTitle}>{pod.activity?.title}</Text>
                      <Text style={styles.historyCardMeta}>
                        {new Date(pod.meetupTime).toLocaleDateString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                        {' · '}
                        {pod.members?.length ?? 0} members
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, pod.status === 'COMPLETED' ? styles.completedBadge : styles.expiredBadge]}>
                      <Text style={[styles.statusBadgeText, pod.status === 'COMPLETED' ? styles.completedText : styles.expiredText]}>
                        {pod.status === 'COMPLETED' ? 'Done' : 'Expired'}
                      </Text>
                    </View>
                  </View>
                  {pod.location ? (
                    <View style={styles.historyCardLocation}>
                      <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
                      <Text style={styles.historyCardLocationText}>{pod.location}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  tabLoadingInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heading: {
    ...typography.h2,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 2,
  },
  historyBtnText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
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
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  modalTitle: {
    ...typography.h2,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  modalEmptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  modalEmptyBody: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  modalList: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  historyCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  historyCardInfo: {
    flex: 1,
    gap: 2,
  },
  historyCardTitle: {
    ...typography.bodyBold,
  },
  historyCardMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  historyCardLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyCardLocationText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  completedBadge: {
    backgroundColor: colors.greenLight,
  },
  expiredBadge: {
    backgroundColor: colors.borderLight,
  },
  statusBadgeText: {
    ...typography.tiny,
    fontWeight: '600',
  },
  completedText: {
    color: colors.green,
  },
  expiredText: {
    color: colors.textTertiary,
  },
});
