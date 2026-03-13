import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';

export interface EmptyChatStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  title: string;
  subtitle?: string;
}

export default function EmptyChatState({
  icon = 'chatbubbles-outline',
  iconSize = 48,
  title,
  subtitle,
}: EmptyChatStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={iconSize} color={colors.border} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 80,
    gap: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
