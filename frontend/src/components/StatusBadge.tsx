import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii } from '../theme';

const LABELS: Record<string, string> = {
  FORMING: 'Forming',
  LOCKED: 'Locked',
  COMPLETED: 'Completed',
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const bg = colors.statusBg[status] ?? '#f1f5f9';
  const fg = colors.status[status] ?? '#64748b';

  return (
    <View style={[styles.badge, { backgroundColor: bg }, size === 'md' && styles.md]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[styles.text, { color: fg }, size === 'md' && styles.textMd]}>
        {LABELS[status] ?? status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  md: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  textMd: {
    fontSize: 12,
  },
});
