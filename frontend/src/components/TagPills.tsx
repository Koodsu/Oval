import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { INTEREST_TAG_META } from '../constants/interestTags';
import { spacing, radii, typography } from '../theme';

interface Props {
  tags: string[];
  /** Maximum number of tags to show (shows "+N" overflow badge if exceeded) */
  max?: number;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export default function TagPills({ tags, max, size = 'md', style }: Props) {
  if (!tags || tags.length === 0) return null;

  const visible = max ? tags.slice(0, max) : tags;
  const overflow = max ? tags.length - max : 0;

  return (
    <View style={[styles.row, style]}>
      {visible.map((tag) => {
        const meta = INTEREST_TAG_META[tag];
        const bg = meta?.bg ?? '#e2e8f0';
        const color = meta?.color ?? '#64748b';
        return (
          <View
            key={tag}
            style={[
              styles.pill,
              size === 'sm' && styles.pillSm,
              { backgroundColor: bg },
            ]}
          >
            <Text
              style={[
                styles.label,
                size === 'sm' && styles.labelSm,
                { color },
              ]}
            >
              {tag}
            </Text>
          </View>
        );
      })}
      {overflow > 0 && (
        <View style={[styles.pill, size === 'sm' && styles.pillSm, styles.overflowPill]}>
          <Text style={[styles.label, size === 'sm' && styles.labelSm, styles.overflowLabel]}>
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  pillSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 13,
  },
  labelSm: {
    fontSize: 11,
  },
  overflowPill: {
    backgroundColor: '#f1f5f9',
  },
  overflowLabel: {
    color: '#64748b',
  },
});
