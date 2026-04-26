import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getBlockedUsers, unblockUser, resolveAvatarUrl, API_USER_MESSAGE } from '../api';
import Avatar from '../components/Avatar';
import { colors, spacing, radii, typography, shadows } from '../theme';

type BlockedUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
  blockedAt: string;
};

export default function BlockedUsersScreen() {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const loadUsers = useCallback(
    () => getBlockedUsers().then(setUsers).catch(() => {}),
    []
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadUsers().finally(() => setLoading(false));
    }, [loadUsers])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUsers().finally(() => setRefreshing(false));
  }, [loadUsers]);

  const handleUnblock = (user: BlockedUser) => {
    Alert.alert(
      'Unblock User',
      `Unblock ${user.name}? They will be able to see your profile and send you messages again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblockingId(user.id);
            try {
              await unblockUser(user.id);
              setUsers((prev) => prev.filter((u) => u.id !== user.id));
            } catch {
              Alert.alert('Error', API_USER_MESSAGE);
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={users.length === 0 ? styles.emptyContainer : styles.list}
      data={users}
      keyExtractor={(u) => u.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="ban-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No blocked users</Text>
          <Text style={styles.emptyBody}>Users you block will appear here.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.row, shadows.sm]}>
          <Avatar name={item.name} size={44} uri={resolveAvatarUrl(item.avatarUrl)} />
          <Text style={styles.rowName}>{item.name}</Text>
          <TouchableOpacity
            style={[styles.unblockBtn, unblockingId === item.id && styles.unblockBtnDisabled]}
            onPress={() => handleUnblock(item)}
            disabled={unblockingId !== null}
          >
            {unblockingId === item.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.unblockBtnText}>Unblock</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyState: { alignItems: 'center', gap: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.textSecondary },
  emptyBody: { ...typography.body, color: colors.textTertiary, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowName: { ...typography.bodyBold, flex: 1 },
  unblockBtn: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 80,
    alignItems: 'center',
  },
  unblockBtnDisabled: { opacity: 0.5 },
  unblockBtnText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
