import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../App';
import { getPodInvites, acceptPodInvite, declinePodInvite, resolveAvatarUrl } from '../api';
import { PodInvite } from '../types';
import Avatar from '../components/Avatar';
import { colors, spacing, radii, typography, shadows } from '../theme';

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function PodInvitesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [invites, setInvites] = useState<PodInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getPodInvites()
        .then(setInvites)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  const handleAccept = async (invite: PodInvite) => {
    setActionId(invite.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const pod = await acceptPodInvite(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      navigation.navigate('Pod', { podId: pod.id });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (invite: PodInvite) => {
    setActionId(invite.id);
    try {
      await declinePodInvite(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to decline');
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

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={invites.length === 0 ? styles.emptyContainer : styles.list}
      data={invites}
      keyExtractor={(i) => i.id}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="mail-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No pod invites</Text>
          <Text style={styles.emptyBody}>When a friend invites you to a pod, it'll appear here.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const pod = item.pod;
        const activity = pod?.activity;
        return (
          <View style={[styles.card, shadows.sm]}>
            <View style={styles.cardHeader}>
              <Avatar
                name={item.sender?.name ?? '?'}
                size={40}
                uri={resolveAvatarUrl(item.sender?.avatarUrl)}
              />
              <View style={styles.cardInfo}>
                <Text style={styles.cardSender}>{item.sender?.name}</Text>
                <Text style={styles.cardSubtitle}>invited you to a pod</Text>
              </View>
              <Text style={styles.cardTime}>{formatTime(item.createdAt)}</Text>
            </View>

            {activity && (
              <View style={styles.podInfo}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                {pod?.meetupTime && (
                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
                    <Text style={styles.metaText}>
                      {new Date(pod.meetupTime).toLocaleDateString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                )}
                {pod?.location && (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
                    <Text style={styles.metaText}>{pod.location}</Text>
                  </View>
                )}
                <View style={styles.metaRow}>
                  <Ionicons name="people-outline" size={14} color={colors.textTertiary} />
                  <Text style={styles.metaText}>
                    {pod?.members?.length ?? 0}/{pod?.maxMembers ?? '?'} members
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.btn, styles.acceptBtn]}
                onPress={() => handleAccept(item)}
                disabled={actionId === item.id}
              >
                {actionId === item.id ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Text style={styles.acceptBtnText}>Join Pod</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.declineBtn]}
                onPress={() => handleDecline(item)}
                disabled={actionId === item.id}
              >
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.lg, gap: spacing.md },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyState: { alignItems: 'center', gap: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.textSecondary },
  emptyBody: { ...typography.body, color: colors.textTertiary, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardInfo: { flex: 1 },
  cardSender: { ...typography.bodyBold },
  cardSubtitle: { ...typography.caption, color: colors.textTertiary },
  cardTime: { ...typography.tiny, color: colors.textTertiary },
  podInfo: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  activityTitle: { ...typography.bodyBold, marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...typography.caption, color: colors.textSecondary },
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
});
