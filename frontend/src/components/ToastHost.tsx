import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BORDER_W, elevation, fonts, radii, spacing, useTheme } from '../theme';
import { subscribeToToasts, ToastPayload } from '../lib/toast';

const AUTO_DISMISS_MS = 4500;
const MAX_VISIBLE = 3;

/**
 * Renders app-wide toasts fired via `toast.error/success/info`.
 * Mounted once near the root (inside ThemeProvider + SafeAreaProvider).
 */
export function ToastHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = React.useState<ToastPayload[]>([]);
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  React.useEffect(() => {
    const unsubscribe = subscribeToToasts((payload) => {
      setToasts((current) => [...current, payload].slice(-MAX_VISIBLE));
      timers.current.set(
        payload.id,
        setTimeout(() => dismiss(payload.id), AUTO_DISMISS_MS),
      );
    });
    const pending = timers.current;
    return () => {
      unsubscribe();
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, [dismiss]);

  if (!toasts.length) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: insets.top + spacing.sm }]}
    >
      {toasts.map((t) => {
        const fg =
          t.kind === 'error' ? colors.danger : t.kind === 'success' ? colors.success : colors.blue;
        const tint =
          t.kind === 'error'
            ? colors.dangerSoft
            : t.kind === 'success'
              ? colors.successSoft
              : colors.blueSoft;
        const icon =
          t.kind === 'error'
            ? 'alert-circle'
            : t.kind === 'success'
              ? 'checkmark-circle'
              : 'information-circle';
        return (
          <Animated.View
            key={t.id}
            entering={FadeInUp.duration(220)}
            exiting={FadeOutUp.duration(180)}
            layout={LinearTransition.duration(180)}
          >
            <Pressable
              onPress={() => dismiss(t.id)}
              accessibilityRole="alert"
              accessibilityLabel={t.message ? `${t.title}. ${t.message}` : t.title}
              style={[
                styles.toast,
                elevation.floating,
                { backgroundColor: tint, borderColor: colors.border },
              ]}
            >
              <Ionicons name={icon} size={18} color={fg} style={styles.icon} />
              <View style={styles.copy}>
                <Text style={[styles.title, { color: colors.ink }]} numberOfLines={2}>
                  {t.title}
                </Text>
                {t.message ? (
                  <Text style={[styles.message, { color: colors.ink }]} numberOfLines={3}>
                    {t.message}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 1000,
    gap: spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  icon: {
    marginTop: 1,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  message: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
});
