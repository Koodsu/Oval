import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, radii } from '../theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

function SkeletonBone({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonPodCard() {
  return (
    <View style={styles.podCard}>
      <View style={styles.podCardHeader}>
        <SkeletonBone width={32} height={32} borderRadius={16} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonBone width="70%" height={14} />
          <SkeletonBone width="40%" height={10} />
        </View>
      </View>
      <SkeletonBone width="100%" height={4} borderRadius={2} style={{ marginVertical: 8 }} />
      <SkeletonBone width="50%" height={12} style={{ marginBottom: 8 }} />
      <SkeletonBone width="60%" height={12} />
    </View>
  );
}

export function SkeletonFeedCard() {
  return (
    <View style={styles.feedCard}>
      <View style={styles.podCardHeader}>
        <SkeletonBone width={32} height={32} borderRadius={16} />
        <SkeletonBone width="60%" height={14} />
      </View>
      <SkeletonBone width="80%" height={12} style={{ marginBottom: 6 }} />
      <SkeletonBone width="65%" height={12} style={{ marginBottom: 8 }} />
      <SkeletonBone width="100%" height={3} borderRadius={2} style={{ marginBottom: 8 }} />
      <SkeletonBone width="35%" height={20} borderRadius={10} />
    </View>
  );
}

export function SkeletonProfileCard() {
  return (
    <View style={styles.profileCard}>
      <SkeletonBone width={88} height={88} borderRadius={44} style={{ alignSelf: 'center' }} />
      <SkeletonBone width="50%" height={20} style={{ alignSelf: 'center', marginTop: 12 }} />
      <SkeletonBone width="40%" height={12} style={{ alignSelf: 'center', marginTop: 8 }} />
      <SkeletonBone width="60%" height={12} style={{ alignSelf: 'center', marginTop: 8 }} />
    </View>
  );
}

export function SkeletonMessageRow() {
  return (
    <View style={styles.messageRow}>
      <SkeletonBone width={48} height={48} borderRadius={24} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <SkeletonBone width="50%" height={14} />
          <SkeletonBone width="20%" height={10} />
        </View>
        <SkeletonBone width="75%" height={12} />
      </View>
    </View>
  );
}

export function SkeletonActivityCard() {
  return (
    <View style={styles.activityCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <SkeletonBone width={44} height={44} borderRadius={12} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonBone width="70%" height={15} />
          <SkeletonBone width="40%" height={11} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  podCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 12,
  },
  feedCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 16,
    width: 220,
  },
  podCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 8,
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 8,
  },
});

export default SkeletonBone;
