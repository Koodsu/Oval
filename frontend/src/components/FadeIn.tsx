import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface FadeInProps {
  delay?: number;
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function FadeIn({ delay = 0, children, style }: FadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 350,
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
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
