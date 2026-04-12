import React, { useRef } from 'react';
import {
  TouchableWithoutFeedback,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, radii, typography } from '../theme';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'outline';
  size?: 'md' | 'lg';
}

export default function GradientButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  icon,
  variant = 'primary',
  size = 'lg',
}: GradientButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
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

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  if (variant === 'outline') {
    return (
      <TouchableWithoutFeedback
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
      >
        <Animated.View
          style={[
            styles.outline,
            size === 'md' && styles.sizeMd,
            isDisabled && styles.outlineDisabled,
            { transform: [{ scale }] },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <View style={styles.row}>
              {icon && (
                <Ionicons
                  name={icon}
                  size={size === 'md' ? 16 : 18}
                  color={colors.primary}
                  style={styles.icon}
                />
              )}
              <Text style={[styles.outlineText, size === 'md' && styles.textMd]}>
                {title}
              </Text>
            </View>
          )}
        </Animated.View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <TouchableWithoutFeedback
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
    >
      <Animated.View style={[size === 'md' ? styles.sizeMd : undefined, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={isDisabled ? ['#cbd5e1', '#cbd5e1'] : [...colors.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, size === 'md' && styles.sizeMd]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={styles.row}>
              {icon && (
                <Ionicons
                  name={icon}
                  size={size === 'md' ? 16 : 18}
                  color="#fff"
                  style={styles.icon}
                />
              )}
              <Text style={[styles.text, size === 'md' && styles.textMd]}>{title}</Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: radii.md,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  textMd: {
    fontSize: 14,
  },
  sizeMd: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.sm,
  },
  outline: {
    borderRadius: radii.md,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  outlineDisabled: {
    borderColor: '#cbd5e1',
  },
  outlineText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 16,
  },
});
