import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radii, shadows, typography } from '../theme';
import { Activity } from '../types';

const ACTIVITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Morning Coffee Walk': 'cafe-outline',
  'Study Group Sprint': 'book-outline',
  'Frisbee on the Lawn': 'disc-outline',
  'Lunch Together': 'restaurant-outline',
  'Evening Campus Walk': 'moon-outline',
};

const ACTIVITY_COLORS: Record<string, string> = {
  'Morning Coffee Walk': '#f59e0b',
  'Study Group Sprint': '#6366f1',
  'Frisbee on the Lawn': '#22c55e',
  'Lunch Together': '#ef4444',
  'Evening Campus Walk': '#8b5cf6',
};

interface ActivityCardProps {
  activity: Activity;
  onPress: () => void;
}

export default function ActivityCard({ activity, onPress }: ActivityCardProps) {
  const iconName = ACTIVITY_ICONS[activity.title] ?? 'sparkles-outline';
  const accentColor = ACTIVITY_COLORS[activity.title] ?? colors.primary;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.card, shadows.md]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconCircle, { backgroundColor: accentColor + '15' }]}>
        <Ionicons name={iconName} size={22} color={accentColor} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{activity.title}</Text>
        <Text style={styles.desc} numberOfLines={2}>
          {activity.description}
        </Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
          <Text style={styles.location}>{activity.defaultLocation}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.border} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.h3,
    marginBottom: 3,
  },
  desc: {
    ...typography.caption,
    lineHeight: 18,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    ...typography.tiny,
  },
});
