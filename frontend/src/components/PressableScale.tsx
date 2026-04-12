import React, { useRef } from 'react';
import {
  Animated,
  TouchableWithoutFeedback,
  ViewStyle,
  StyleProp,
  GestureResponderEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';

interface PressableScaleProps {
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: () => void;
  disabled?: boolean;
  activeScale?: number;
  haptic?: 'light' | 'medium' | 'heavy' | 'none';
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export default function PressableScale({
  onPress,
  onLongPress,
  disabled = false,
  activeScale = 0.96,
  haptic = 'none',
  style,
  children,
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: activeScale,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  const handlePress = (e: GestureResponderEvent) => {
    if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (haptic === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (haptic === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onPress?.(e);
  };

  return (
    <TouchableWithoutFeedback
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}
