import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../App';
import { blockUser, getUserProfile } from '../api';
import { useAuth } from '../context/AuthContext';
import { PublicProfile } from '../types';
import Avatar from '../components/Avatar';
import ReportModal from '../components/ReportModal';
import { colors, spacing, radii, typography, shadows } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export default function UserProfileScreen({ route, navigation }: Props) {
  const { userId, name } = route.params;
  const { user } = useAuth();
  const [blocking, setBlocking] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    getUserProfile(userId)
      .then(setProfile)
      .catch(() => {
        // Profile stats are non-critical, fail silently
      });
  }, [userId]);

  const handleBlock = () => {
    Alert.alert(
      'Block User',
      `Block ${name}? You won't see each other in pods or be able to message. You'll both be removed from any shared pods.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setBlocking(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await blockUser(userId);
              navigation.pop(2);
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to block user');
            } finally {
              setBlocking(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, shadows.md]}>
        <Avatar name={name} size={80} />
        <Text style={styles.name}>{name}</Text>

        {profile?.verifiedUniversity && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={13} color={colors.green} />
            <Text style={styles.verifiedText}>OSU Verified</Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>
              {profile ? profile.podsAttended : '—'}
            </Text>
            <Text style={styles.statLabel}>Pods attended</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>
              {profile
                ? new Date(profile.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                : '—'}
            </Text>
            <Text style={styles.statLabel}>Joined</Text>
          </View>
        </View>
      </View>

      {!isOwnProfile && (
        <TouchableOpacity
          style={[styles.actionButton, styles.reportButton, shadows.sm]}
          onPress={() => setReportModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.reportButtonText}>Report User</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.actionButton, styles.blockButton, shadows.sm]}
        onPress={handleBlock}
        disabled={blocking}
        activeOpacity={0.8}
      >
        {blocking ? (
          <ActivityIndicator size="small" color={colors.red} />
        ) : (
          <>
            <Ionicons name="ban-outline" size={20} color={colors.red} />
            <Text style={styles.blockButtonText}>Block User</Text>
          </>
        )}
      </TouchableOpacity>

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        onSuccess={() => Alert.alert('Report submitted', 'Thanks.')}
        targetUserId={userId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.h2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.greenLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  verifiedText: {
    ...typography.tiny,
    color: colors.green,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.lg,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    ...typography.h3,
  },
  statLabel: {
    ...typography.tiny,
    color: colors.textTertiary,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
  },
  reportButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportButtonText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  blockButton: {
    marginTop: spacing.md,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: colors.red,
  },
  blockButtonText: {
    ...typography.bodyBold,
    color: colors.red,
  },
});
