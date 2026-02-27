import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { getMyReports, REPORT_REASON_LABELS } from '../api';
import { colors, spacing, radii, typography, shadows } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MyReports'>;

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  REVIEWING: 'Under review',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
};

export default function MyReportsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<Awaited<ReturnType<typeof getMyReports>>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      const data = await getMyReports();
      setReports(data);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>My Reports</Text>
      <Text style={styles.subtitle}>
        Reports you've submitted and their status.
      </Text>

      {reports.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="flag-outline" size={48} color={colors.border} />
          <Text style={styles.emptyText}>No reports yet</Text>
          <Text style={styles.emptySubtext}>
            When you report a message, pod, or user, it will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {reports.map((r) => (
            <View key={r.id} style={[styles.card, shadows.sm]}>
              <View style={styles.cardHeader}>
                <Text style={styles.reason}>
                  {REPORT_REASON_LABELS[r.reason] ?? r.reason}
                </Text>
                <View style={[styles.statusBadge, styles[`status_${r.status}` as keyof typeof styles]]}>
                  <Text style={styles.statusText}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.date}>
                {new Date(r.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              {(r.podId || r.messageId || r.targetUserId) && (
                <Text style={styles.meta}>
                  {r.messageId ? 'Message' : r.podId ? 'Pod' : 'User'} report
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    marginBottom: spacing.lg,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  emptySubtext: {
    ...typography.caption,
    textAlign: 'center',
  },
  list: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  reason: {
    ...typography.bodyBold,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  status_OPEN: {
    backgroundColor: colors.amberLight,
  },
  status_REVIEWING: {
    backgroundColor: colors.blueLight,
  },
  status_RESOLVED: {
    backgroundColor: colors.greenLight,
  },
  status_DISMISSED: {
    backgroundColor: colors.border,
  },
  statusText: {
    ...typography.tiny,
    fontWeight: '600',
  },
  date: {
    ...typography.caption,
    marginBottom: 2,
  },
  meta: {
    ...typography.tiny,
    color: colors.textTertiary,
  },
});
