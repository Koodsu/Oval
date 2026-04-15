import React from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { home } from '../theme';

export interface ExplorePillItem {
  key: string;
  label: string;
}

interface ExplorePillRowProps {
  items: ExplorePillItem[];
  selectedKey: string;
  onSelect: (key: string) => void;
  contentPaddingHorizontal?: number;
}

export default function ExplorePillRow({
  items,
  selectedKey,
  onSelect,
  contentPaddingHorizontal = 16,
}: ExplorePillRowProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={[styles.row, { paddingHorizontal: contentPaddingHorizontal }]}
      >
        {items.map((item) => {
          const active = selectedKey === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(item.key);
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.text, active ? styles.textActive : styles.textInactive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
  },
  scrollView: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 280,
  },
  pillActive: {
    backgroundColor: home.scarlet,
    borderColor: home.scarlet,
  },
  pillInactive: {
    backgroundColor: home.cardBg,
    borderColor: '#E8E3DB',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  textActive: {
    color: '#FFFFFF',
  },
  textInactive: {
    color: home.textSecondary,
  },
});
