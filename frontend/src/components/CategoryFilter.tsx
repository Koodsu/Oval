import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CATEGORIES, CATEGORY_META } from '../constants/categories';
import { colors, spacing, radii, typography } from '../theme';

interface CategoryFilterProps {
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export default function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  const handlePress = (category: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(category);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <TouchableOpacity
        style={[styles.chip, !selected && styles.chipActive]}
        onPress={() => handlePress(null)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="apps-outline"
          size={14}
          color={!selected ? colors.textInverse : colors.textSecondary}
        />
        <Text style={[styles.chipText, !selected && styles.chipTextActive]}>All</Text>
      </TouchableOpacity>

      {CATEGORIES.map((cat) => {
        const meta = CATEGORY_META[cat];
        const isActive = selected === cat;
        return (
          <TouchableOpacity
            key={cat}
            style={[
              styles.chip,
              isActive && { backgroundColor: meta.color },
            ]}
            onPress={() => handlePress(cat)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={meta.icon}
              size={14}
              color={isActive ? colors.textInverse : meta.color}
            />
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {meta.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textInverse,
  },
});
