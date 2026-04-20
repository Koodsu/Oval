import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { getFriends, resolveAvatarUrl } from '../api';
import { FriendUser } from '../types';
import Avatar from '../components/Avatar';
import { colors, spacing, radii, typography, shadows } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Friends'>;

export default function FriendsScreen({ navigation }: Props) {
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      setLoading(true);
      getFriends(controller.signal)
        .then(setFriends)
        .catch((err) => {
          if (err instanceof Error && err.name === 'AbortError') return;
        })
        .finally(() => setLoading(false));
      return () => controller.abort();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={friends}
        keyExtractor={(f) => f.id}
        contentContainerStyle={friends.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptyBody}>
              Search for people by name to send friend requests.
            </Text>
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => navigation.navigate('UserSearch')}
            >
              <Text style={styles.searchBtnText}>Find People</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, shadows.sm]}
            onPress={() => navigation.navigate('UserProfile', { userId: item.id, name: item.name })}
            activeOpacity={0.8}
          >
            <Avatar name={item.name} size={44} uri={resolveAvatarUrl(item.avatarUrl)} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.name}</Text>
              {item.verifiedUniversity && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={11} color={colors.green} />
                  <Text style={styles.verifiedText}>OSU Verified</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      />
    </View>
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
  searchBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
  },
  searchBtnText: { ...typography.bodyBold, color: colors.textInverse },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { ...typography.bodyBold },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    backgroundColor: colors.greenLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
  },
  verifiedText: { ...typography.tiny, color: colors.green, fontWeight: '600' },
});
