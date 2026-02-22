import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radii, shadows, typography } from '../theme';
import { Pod } from '../types';
import { AvatarStack } from './Avatar';
import StatusBadge from './StatusBadge';
import GradientButton from './GradientButton';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface PodCardProps {
  pod: Pod;
  currentUserId?: string;
  onJoin: () => void;
  onView: () => void;
  isJoining: boolean;
  isMember: boolean;
}

export default function PodCard({
  pod,
  currentUserId,
  onJoin,
  onView,
  isJoining,
  isMember,
}: PodCardProps) {
  const memberCount = pod.members.length;
  const maxMembers = pod.maxMembers ?? 4;
  const isForming = pod.status === 'FORMING';
  const canJoin = isForming && memberCount < maxMembers && !isMember;
  const progress = memberCount / maxMembers;

  const handleView = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onView();
  };

  return (
    <TouchableOpacity
      style={[styles.card, shadows.md]}
      onPress={isMember ? handleView : undefined}
      activeOpacity={isMember ? 0.7 : 1}
    >
      <View style={styles.topRow}>
        <AvatarStack members={pod.members} currentUserId={currentUserId} size={34} />
        <StatusBadge status={pod.status} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.memberLabel}>
        {memberCount}/{maxMembers} members
        {memberCount < maxMembers && isForming ? ` · ${maxMembers - memberCount} spots open` : ''}
      </Text>

      {/* Meta */}
      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
        <Text style={styles.metaText}>{formatTime(pod.meetupTime)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons
          name={pod.locationType === 'private' ? 'location-outline' : 'business-outline'}
          size={14}
          color={colors.textTertiary}
        />
        <Text style={styles.metaText}>{pod.location}</Text>
      </View>

      {/* Actions */}
      {isMember ? (
        <TouchableOpacity style={styles.viewRow} onPress={handleView}>
          <Text style={styles.viewText}>View Pod</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      ) : canJoin ? (
        <View style={styles.actionRow}>
          <GradientButton
            title="Join Pod"
            onPress={onJoin}
            loading={isJoining}
            disabled={isJoining}
            icon="person-add-outline"
            size="md"
          />
        </View>
      ) : !isMember && isForming && memberCount >= maxMembers ? (
        <Text style={styles.fullText}>Pod is full</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  memberLabel: {
    ...typography.caption,
    fontSize: 12,
    marginBottom: spacing.sm + 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    ...typography.caption,
    fontSize: 13,
  },
  actionRow: {
    marginTop: spacing.sm + 4,
    alignItems: 'flex-start',
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.sm + 4,
    gap: 4,
  },
  viewText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  fullText: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.sm + 4,
    color: colors.textTertiary,
  },
});
