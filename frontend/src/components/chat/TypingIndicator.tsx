import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export interface TypingIndicatorProps {
  userName?: string;
}

export default function TypingIndicator({ userName }: TypingIndicatorProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    const bounce = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.spring(anim, {
            toValue: -4,
            useNativeDriver: true,
            speed: 20,
            bounciness: 12,
          }),
          Animated.spring(anim, {
            toValue: 0,
            useNativeDriver: true,
            speed: 20,
            bounciness: 12,
          }),
          Animated.delay(600 - delay),
        ])
      );
    };
    const a1 = bounce(dot1, 0);
    const a2 = bounce(dot2, 150);
    const a3 = bounce(dot3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3, fadeIn]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeIn }]}>
      <View style={styles.bubble}>
        <View style={styles.dots}>
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot1 }] }]} />
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot2 }] }]} />
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot3 }] }]} />
        </View>
      </View>
      {userName ? (
        <Text style={styles.label}>{userName} is typing...</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    height: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#AAAAAA',
  },
  label: {
    ...typography.tiny,
    marginTop: 4,
    marginLeft: 4,
    color: colors.textTertiary,
  },
});
