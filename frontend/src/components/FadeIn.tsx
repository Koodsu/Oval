import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface FadeInProps {
  delay?: number;
  duration?: number;
  slideDistance?: number;
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function FadeIn({
  delay = 0,
  duration = 350,
  slideDistance = 14,
  children,
  style,
}: FadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slideDistance)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 140,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay, duration, opacity, translateY, slideDistance]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
