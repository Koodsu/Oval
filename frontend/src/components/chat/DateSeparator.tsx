import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { formatChatDateLabel } from '../../utils/format';

export interface DateSeparatorProps {
  date: string; // ISO string
}

export default function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{formatChatDateLabel(date)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  text: {
    ...typography.caption,
    color: colors.textTertiary,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
