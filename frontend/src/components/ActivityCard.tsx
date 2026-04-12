import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, shadows, typography } from '../theme';
import { Activity } from '../types';
import { CATEGORY_META } from '../constants/categories';
import PressableScale from './PressableScale';

interface ActivityCardProps {
  activity: Activity;
  onPress: () => void;
}

export default function ActivityCard({ activity, onPress }: ActivityCardProps) {
  const meta = CATEGORY_META[activity.category];
  const iconName = meta?.icon ?? 'sparkles-outline';
  const accentColor = meta?.color ?? colors.primary;

  return (
    <PressableScale
      style={[styles.card, shadows.md]}
      onPress={onPress}
      haptic="light"
    >
      <View style={[styles.iconCircle, { backgroundColor: accentColor + '15' }]}>
        <Ionicons name={iconName} size={22} color={accentColor} />
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{activity.title}</Text>
          <Text style={[styles.categoryLabel, { color: accentColor }]}>
            {activity.category}
          </Text>
        </View>
        <Text style={styles.desc} numberOfLines={2}>
          {activity.description}
        </Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
          <Text style={styles.location} numberOfLines={1}>{activity.defaultLocation}</Text>
        </View>
        {(activity._count?.pods ?? 0) > 0 && (
          <View style={styles.podCountRow}>
            <View style={styles.podCountDot} />
            <Text style={styles.podCountText}>
              {activity._count!.pods} {activity._count!.pods === 1 ? 'pod' : 'pods'} forming
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.border} style={styles.chevron} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 4,
  },
  content: {
    flex: 1,
    marginRight: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: 2,
  },
  title: {
    ...typography.h3,
    flex: 1,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  desc: {
    ...typography.caption,
    lineHeight: 18,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  location: {
    ...typography.tiny,
    flex: 1,
  },
  podCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  podCountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  podCountText: {
    ...typography.tiny,
    color: colors.green,
    fontWeight: '600',
  },
  chevron: {
    marginLeft: 2,
  },
});
