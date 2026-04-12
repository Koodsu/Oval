import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, shadows, typography } from '../theme';
import { Pod } from '../types';
import { AvatarStack } from './Avatar';
import StatusBadge from './StatusBadge';
import GradientButton from './GradientButton';
import PressableScale from './PressableScale';
import { formatPodTime } from '../utils/format';

interface PodCardProps {
  pod: Pod;
  currentUserId?: string;
  onJoin: () => void;
  onView: () => void;
  onJoinWaitlist?: () => void;
  isJoining: boolean;
  isJoiningWaitlist?: boolean;
  isMember: boolean;
}

export default function PodCard({
  pod,
  currentUserId,
  onJoin,
  onView,
  onJoinWaitlist,
  isJoining,
  isJoiningWaitlist = false,
  isMember,
}: PodCardProps) {
  const memberCount = pod.members.length;
  const maxMembers = pod.maxMembers ?? 4;
  const isForming = pod.status === 'FORMING';
  const canJoin = isForming && memberCount < maxMembers && !isMember;
  const isFull = isForming && memberCount >= maxMembers && !isMember;
  const progress = memberCount / maxMembers;

  const activityTitle = pod.activity?.title;

  return (
    <PressableScale
      style={[styles.card, shadows.md]}
      onPress={isMember ? onView : undefined}
      disabled={!isMember}
      haptic="light"
    >
      {activityTitle ? (
        <Text style={styles.activityTitle} numberOfLines={1}>
          {activityTitle}
        </Text>
      ) : null}
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
        <Text style={styles.metaText}>{formatPodTime(pod.meetupTime)}</Text>
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
        <TouchableOpacity style={styles.viewRow} onPress={onView}>
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
      ) : isFull && onJoinWaitlist ? (
        <View style={styles.actionRow}>
          <GradientButton
            title="Join Waitlist"
            onPress={onJoinWaitlist}
            loading={isJoiningWaitlist}
            disabled={isJoiningWaitlist}
            icon="time-outline"
            variant="outline"
            size="md"
          />
        </View>
      ) : isFull ? (
        <Text style={styles.fullText}>Pod is full</Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
  },
  activityTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
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
