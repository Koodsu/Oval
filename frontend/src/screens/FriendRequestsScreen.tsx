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
import * as Haptics from 'expo-haptics';
import {
  API_USER_MESSAGE,
  getFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  resolveAvatarUrl,
} from '../api';
import { FriendRequest } from '../types';
import Avatar from '../components/Avatar';
import { colors, spacing, radii, typography, shadows } from '../theme';

export default function FriendRequestsScreen() {
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadRequests = useCallback(
    () =>
      getFriendRequests()
        .then(({ incoming: i, outgoing: o }) => {
          setIncoming(i);
          setOutgoing(o);
        })
        .catch(() => {}),
    []
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadRequests().finally(() => setLoading(false));
    }, [loadRequests])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRequests().finally(() => setRefreshing(false));
  }, [loadRequests]);

  const handleAccept = async (req: FriendRequest) => {
    setActionId(req.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await acceptFriendRequest(req.id);
      setIncoming((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (req: FriendRequest) => {
    setActionId(req.id);
    try {
      await declineFriendRequest(req.id);
      setIncoming((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (req: FriendRequest) => {
    setActionId(req.id);
    try {
      await cancelFriendRequest(req.id);
      setOutgoing((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const hasAny = incoming.length > 0 || outgoing.length > 0;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={hasAny ? styles.list : styles.emptyContainer}
      data={[]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={
        <>
          {!hasAny && (
            <View style={styles.emptyState}>
              <Ionicons name="person-add-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No pending requests</Text>
            </View>
          )}

          {incoming.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>INCOMING</Text>
              {incoming.map((req) => (
                <View key={req.id} style={[styles.card, shadows.sm]}>
                  <View style={styles.cardHeader}>
                    <Avatar
                      name={req.sender?.name ?? '?'}
                      size={44}
                      uri={resolveAvatarUrl(req.sender?.avatarUrl)}
                    />
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{req.sender?.name}</Text>
                      {req.sender?.verifiedUniversity && (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="shield-checkmark" size={11} color={colors.green} />
                          <Text style={styles.verifiedText}>OSU Verified</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.btn, styles.acceptBtn]}
                      onPress={() => handleAccept(req)}
                      disabled={actionId === req.id}
                    >
                      {actionId === req.id ? (
                        <ActivityIndicator size="small" color={colors.textInverse} />
                      ) : (
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, styles.declineBtn]}
                      onPress={() => handleDecline(req)}
                      disabled={actionId === req.id}
                    >
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

          {outgoing.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, incoming.length > 0 && { marginTop: spacing.lg }]}>
                SENT
              </Text>
              {outgoing.map((req) => (
                <View key={req.id} style={[styles.card, shadows.sm]}>
                  <View style={styles.cardHeader}>
                    <Avatar
                      name={req.receiver?.name ?? '?'}
                      size={44}
                      uri={resolveAvatarUrl(req.receiver?.avatarUrl)}
                    />
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{req.receiver?.name}</Text>
                      <Text style={styles.pendingLabel}>Request pending</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => handleCancel(req)}
                      disabled={actionId === req.id}
                    >
                      {actionId === req.id ? (
                        <ActivityIndicator size="small" color={colors.textSecondary} />
                      ) : (
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
        </>
      }
      renderItem={null}
      keyExtractor={() => ''}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, gap: spacing.sm },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', gap: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.textSecondary },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { ...typography.bodyBold },
  pendingLabel: { ...typography.caption, color: colors.textTertiary },
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
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: { backgroundColor: colors.primary },
  acceptBtnText: { ...typography.bodyBold, color: colors.textInverse },
  declineBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  declineBtnText: { ...typography.bodyBold, color: colors.textSecondary },
  cancelBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: { ...typography.caption, color: colors.textSecondary },
});
