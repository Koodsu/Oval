import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, radii, spacing, useTheme } from '../theme';

export function OvalWordmark({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();

  return (
    <View style={styles.wordmark}>
      <OvalMark size={compact ? 34 : 40} />
      <Text
        style={[
          styles.wordmarkText,
          {
            color: colors.ink,
            fontSize: compact ? 20 : 23,
          },
        ]}
      >
        Oval
      </Text>
    </View>
  );
}

export function OvalMark({ size = 40 }: { size?: number }) {
  const width = Math.round(size * 1.75);
  const sourceSize = Math.round(size * 2.65);

  return (
    <View
      accessibilityLabel="Oval"
      accessibilityRole="image"
      style={[
        styles.mark,
        {
          width,
          height: size,
        },
      ]}
    >
      <Image
        source={require('../../assets/brand/oval-open-1024-transparent.png')}
        resizeMode="contain"
        accessible={false}
        style={{ width: sourceSize, height: sourceSize }}
      />
    </View>
  );
}

export function OnboardingTopBar({
  current,
  total,
  label,
  onBack,
}: {
  current?: number;
  total?: number;
  label?: string;
  onBack?: () => void;
}) {
  const { colors } = useTheme();
  const progress =
    current && total ? Math.max(0, Math.min(1, current / total)) : label ? 1 : 0;

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressMeta}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            style={({ pressed }) => [styles.back, pressed && { opacity: 0.5 }]}
          >
            <Ionicons name="arrow-back" size={23} color={colors.ink} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <Text style={[styles.progressLabel, { color: colors.accentText }]}>
          {current && total ? `${current} of ${total}` : label}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.sunken }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${progress * 100}%`,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  wordmarkText: {
    fontFamily: fonts.display,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  progressWrap: {
    gap: spacing.sm,
  },
  progressMeta: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    width: 36,
    height: 34,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  progressLabel: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 14,
  },
  track: {
    height: 5,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
});
