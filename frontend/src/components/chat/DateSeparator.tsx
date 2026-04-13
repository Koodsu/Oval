import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing } from '../../theme';
import { formatPodChatDateSeparator } from '../../utils/format';

export interface DateSeparatorProps {
  date: string; // ISO string (first message of that calendar day)
}

export default function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.text}>{formatPodChatDateSeparator(date)}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    minHeight: 1,
    backgroundColor: '#E8E3DB',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999999',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginHorizontal: spacing.sm,
  },
});
