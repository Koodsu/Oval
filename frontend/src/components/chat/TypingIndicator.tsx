import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export interface TypingIndicatorProps {
  /** DM / legacy: first name; shown as "[name] is typing..." when `caption` is omitted */
  userName?: string;
  /** Pod: full line below the bubble (e.g. "Alex is typing..." or "Several people are typing...") */
  caption?: string;
  /** When false, fades out then unmounts internally */
  visible?: boolean;
}

const FADE_MS = 200;
const DOT_BOUNCE = -4;
const DOT_SPRING = { speed: 20, bounciness: 12, useNativeDriver: true as const };

function bounceOneDot(anim: Animated.Value) {
  return Animated.sequence([
    Animated.spring(anim, { toValue: DOT_BOUNCE, ...DOT_SPRING }),
    Animated.spring(anim, { toValue: 0, ...DOT_SPRING }),
  ]);
}

export default function TypingIndicator({
  userName,
  caption,
  visible = true,
}: TypingIndicatorProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  const [mounted, setMounted] = useState(visible);
  const latchedLabel = useRef('');

  useLayoutEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (visible) {
      if (caption) latchedLabel.current = caption;
      else if (userName) latchedLabel.current = `${userName} is typing...`;
      setMounted(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, opacity, caption, userName]);

  useEffect(() => {
    if (!mounted) return;

    const sequential = Animated.loop(
      Animated.sequence([
        bounceOneDot(dot1),
        bounceOneDot(dot2),
        bounceOneDot(dot3),
        Animated.delay(120),
      ])
    );
    sequential.start();
    return () => sequential.stop();
  }, [mounted, dot1, dot2, dot3]);

  if (!mounted) return null;

  const displayLabel = latchedLabel.current;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.bubble}>
        <View style={styles.dots}>
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot1 }] }]} />
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot2 }] }]} />
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot3 }] }]} />
        </View>
      </View>
      {displayLabel ? <Text style={styles.label}>{displayLabel}</Text> : null}
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
