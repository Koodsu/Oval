import React from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { resolveAvatarUrl } from '../api';
import { getInitials } from '../utils/format';
import {
  Theme,
  createThemedStyles,
  fonts,
  motion,
  radii,
  spacing,
  useTheme,
} from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// Motion primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tap — the standard Bridge touchable. Spring press-scale + optional haptic.
 * Use everywhere a card, row, or control is pressable.
 */
export function Tap({
  children,
  onPress,
  onLongPress,
  disabled,
  haptic = false,
  scaleTo = 0.97,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
  testID,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  haptic?: boolean;
  scaleTo?: number;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'tab' | 'link';
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  testID?: string;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      onLongPress={onLongPress}
      disabled={disabled || !onPress}
      onPressIn={() => {
        scale.value = withSpring(scaleTo, motion.spring);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.springBouncy);
      }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      testID={testID}
    >
      <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Entrance — staggered fade-in-up wrapper for list/section reveals.
 * `index` staggers siblings; keep indexes small (0–8).
 */
export function Entrance({
  children,
  index = 0,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 55)
        .springify()
        .damping(18)
        .stiffness(190)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas
// ─────────────────────────────────────────────────────────────────────────────

function GlowBlob({
  color,
  size,
  position,
  drift = 14,
  duration = 7000,
}: {
  color: string;
  size: number;
  position: ViewStyle;
  drift?: number;
  duration?: number;
}) {
  const t = useSharedValue(0);
  React.useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [t, duration]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: t.value * drift },
      { translateX: t.value * -drift * 0.6 },
      { scale: 1 + t.value * 0.08 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        position,
        style,
      ]}
    />
  );
}

export function AppBackdrop({ children }: { children: React.ReactNode }) {
  const { gradients, isDark } = useTheme();
  return (
    <View style={baseStyles.flex}>
      <LinearGradient colors={gradients.app} style={StyleSheet.absoluteFill} />
      <GlowBlob
        color={isDark ? 'rgba(242,62,22,0.10)' : 'rgba(255,138,61,0.16)'}
        size={220}
        position={{ top: 40, right: -60 }}
      />
      <GlowBlob
        color={isDark ? 'rgba(111,85,242,0.10)' : 'rgba(111,85,242,0.10)'}
        size={260}
        position={{ bottom: 60, left: -80 }}
        duration={9000}
      />
      {children}
    </View>
  );
}

export function Screen({
  children,
  padded = true,
}: {
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <SafeAreaView style={baseStyles.flex} edges={['top', 'left', 'right']}>
      <AppBackdrop>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={baseStyles.flex}
        >
          <View style={[baseStyles.screen, !padded && { paddingHorizontal: 0 }]}>{children}</View>
        </KeyboardAvoidingView>
      </AppBackdrop>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Headers & heroes
// ─────────────────────────────────────────────────────────────────────────────

export function Hero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const styles = useUiStyles();
  const { gradients } = useTheme();
  return (
    <View style={styles.heroWrap}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1.1, y: 1.2 }}
        style={styles.hero}
      >
        <View pointerEvents="none" style={styles.heroEmber} />
        <View pointerEvents="none" style={styles.heroEmberSmall} />
        {eyebrow ? <Text style={styles.heroEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.heroTitle}>{title}</Text>
        {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
        {children}
      </LinearGradient>
    </View>
  );
}

export function CompactHeader({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const styles = useUiStyles();
  return (
    <View style={styles.compactHeader}>
      {eyebrow ? <Text style={styles.compactEyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.compactTitle}>{title}</Text>
      {subtitle ? <Text style={styles.compactSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const styles = useUiStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.screenHeader}>
      <View style={styles.screenHeaderSide}>
        {onBack ? (
          <Tooltip label="Go back">
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                onBack();
              }}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              accessibilityHint="Returns to the previous screen"
            >
              <Ionicons name="chevron-back" size={20} color={colors.ink} />
            </TouchableOpacity>
          </Tooltip>
        ) : null}
      </View>
      <Text style={styles.screenHeaderTitle} numberOfLines={1}>
        {title ?? ''}
      </Text>
      <View style={[styles.screenHeaderSide, styles.screenHeaderRight]}>{right}</View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Surfaces
// ─────────────────────────────────────────────────────────────────────────────

export function Panel({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const styles = useUiStyles();
  if (onPress) {
    return (
      <Tap onPress={onPress} style={[styles.panel, style as ViewStyle]}>
        {children}
      </Tap>
    );
  }
  return <View style={[styles.panel, style]}>{children}</View>;
}

type SectionHeaderProps = {
  title: string;
} & (
  | { actionLabel?: undefined; onActionPress?: undefined }
  | { actionLabel: string | undefined; onActionPress: () => void }
);

export function SectionHeader({ title, actionLabel, onActionPress }: SectionHeaderProps) {
  const styles = useUiStyles();
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onActionPress ? (
        <TouchableOpacity
          onPress={onActionPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const styles = useUiStyles();
  const { colors } = useTheme();
  return (
    <Panel style={styles.statTile}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Controls
// ─────────────────────────────────────────────────────────────────────────────

export function Chip({
  label,
  active = false,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const styles = useUiStyles();
  const { colors } = useTheme();
  const content = (
    <View style={[styles.chip, active && styles.chipActive]}>
      {icon ? (
        <Ionicons name={icon} size={14} color={active ? colors.onPrimary : colors.sub} />
      ) : null}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <Tap
      onPress={onPress}
      haptic
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {content}
    </Tap>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const styles = useUiStyles();
  const [width, setWidth] = React.useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const pad = 4;
  const gap = 6;
  const segWidth =
    width > 0 ? (width - pad * 2 - gap * (options.length - 1)) / options.length : 0;
  const x = useSharedValue(0);

  React.useEffect(() => {
    if (segWidth > 0) {
      x.value = withSpring(index * (segWidth + gap), motion.spring);
    }
  }, [index, segWidth, x]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View style={styles.segmented} onLayout={onLayout}>
      {segWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.segmentThumb, { width: segWidth }, thumbStyle]}
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={styles.segment}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  const styles = useUiStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={[styles.search, focused && styles.searchFocused]}>
      <Ionicons name="search" size={18} color={focused ? colors.primary : colors.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        style={styles.searchInput}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        clearButtonMode="while-editing"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  kind = 'solid',
  icon,
  tooltip,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  kind?: 'solid' | 'ghost' | 'soft' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  tooltip?: string;
}) {
  const styles = useUiStyles();
  const { colors, gradients } = useTheme();

  const labelColor =
    kind === 'solid'
      ? colors.onPrimary
      : kind === 'soft'
        ? colors.primarySoftText
        : kind === 'danger'
          ? colors.dangerText
          : colors.ink;

  const inner = (
    <View style={styles.buttonInner}>
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={17} color={labelColor} /> : null}
          <Text style={[styles.buttonLabel, { color: labelColor }]}>{label}</Text>
        </>
      )}
    </View>
  );

  const button = (
    <Tap
      onPress={onPress}
      disabled={disabled || loading}
      haptic
      scaleTo={0.96}
      accessibilityLabel={label}
      accessibilityHint={tooltip}
      accessibilityState={{ disabled: disabled || loading }}
      style={(disabled || loading ? [styles.buttonDim] : []) as ViewStyle[]}
    >
      {kind === 'solid' ? (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, styles.buttonSolid]}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.button,
            kind === 'ghost' && styles.buttonGhost,
            kind === 'soft' && styles.buttonSoft,
            kind === 'danger' && styles.buttonDanger,
          ]}
        >
          {inner}
        </View>
      )}
    </Tap>
  );

  return tooltip ? <Tooltip label={tooltip}>{button}</Tooltip> : button;
}

export function IconButton({
  icon,
  onPress,
  tooltip,
  size = 44,
  iconSize = 22,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tooltip: string;
  size?: number;
  iconSize?: number;
  style?: ViewStyle;
}) {
  const styles = useUiStyles();
  const { colors } = useTheme();
  return (
    <Tooltip label={tooltip}>
      <TouchableOpacity
        style={[styles.iconButton, { width: size, height: size, borderRadius: size / 2 }, style]}
        activeOpacity={0.8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={tooltip}
        accessibilityHint={tooltip}
      >
        <Ionicons name={icon} size={iconSize} color={colors.ink} />
      </TouchableOpacity>
    </Tooltip>
  );
}

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement<Record<string, unknown>>;
}) {
  const styles = useUiStyles();
  const [visible, setVisible] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), 1600);
  }, []);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const childProps = children.props as {
    onLongPress?: (...args: unknown[]) => void;
    delayLongPress?: number;
    onHoverIn?: (...args: unknown[]) => void;
    onHoverOut?: (...args: unknown[]) => void;
  };

  const child = React.cloneElement(children, {
    onLongPress: (...args: unknown[]) => {
      show();
      childProps.onLongPress?.(...args);
    },
    delayLongPress: childProps.delayLongPress ?? 300,
    onHoverIn: (...args: unknown[]) => {
      show();
      childProps.onHoverIn?.(...args);
    },
    onHoverOut: (...args: unknown[]) => {
      setVisible(false);
      childProps.onHoverOut?.(...args);
    },
  });

  return (
    <View style={styles.tooltipAnchor}>
      {child}
      {visible ? (
        <View style={styles.tooltipBubble} pointerEvents="none">
          <Text style={styles.tooltipText}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeletons (shimmer pulse)
// ─────────────────────────────────────────────────────────────────────────────

export function SkeletonBlock({
  width = '100%',
  height,
  radius = radii.md,
  color,
  style,
}: {
  width?: ViewStyle['width'];
  height: number;
  radius?: number;
  color?: string;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.6);
  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.6, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: color ?? colors.skeleton,
          overflow: 'hidden',
        },
        pulse,
        style,
      ]}
    />
  );
}

export function SkeletonLine({ width = '100%' }: { width?: ViewStyle['width'] }) {
  return <SkeletonBlock width={width} height={12} radius={6} />;
}

export function SkeletonCard({ compact = false }: { compact?: boolean }) {
  const styles = useUiStyles();
  return (
    <Panel style={styles.skeletonCard}>
      <SkeletonBlock width={compact ? 72 : 120} height={14} radius={7} />
      <SkeletonBlock width="82%" height={compact ? 20 : 28} radius={8} />
      <SkeletonLine width="64%" />
      <View style={styles.skeletonRow}>
        <SkeletonBlock width={34} height={34} radius={17} />
        <View style={styles.skeletonTextStack}>
          <SkeletonLine width="78%" />
          <SkeletonLine width="48%" />
        </View>
      </View>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onActionPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel?: string;
  onActionPress?: () => void;
}) {
  const styles = useUiStyles();
  const { colors } = useTheme();
  return (
    <Panel style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {actionLabel && onActionPress ? (
        <View style={styles.emptyAction}>
          <PrimaryButton label={actionLabel} onPress={onActionPress} kind="soft" />
        </View>
      ) : null}
    </Panel>
  );
}

export function UserAvatar({
  name,
  avatarUrl,
  size = 42,
  ring = false,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const { colors, gradients } = useTheme();
  const uri = resolveAvatarUrl(avatarUrl);

  const core = uri ? (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <Image source={{ uri }} style={{ width: size, height: size }} />
    </View>
  ) : (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontFamily: fonts.bold,
          fontSize: size * 0.34,
        }}
      >
        {getInitials(name)}
      </Text>
    </LinearGradient>
  );

  if (!ring) return core;

  return (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size + 6,
        height: size + 6,
        borderRadius: (size + 6) / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size + 2,
          height: size + 2,
          borderRadius: (size + 2) / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        }}
      >
        {core}
      </View>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const baseStyles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
});

const useUiStyles = createThemedStyles((t: Theme) => ({
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.glass,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  tooltipAnchor: {
    position: 'relative' as const,
  },
  tooltipBubble: {
    position: 'absolute' as const,
    right: 0,
    bottom: '100%' as const,
    marginBottom: 8,
    maxWidth: 220,
    borderRadius: radii.sm,
    backgroundColor: t.isDark ? t.colors.surfaceAlt : t.colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 7,
    zIndex: 50,
  },
  tooltipText: {
    color: t.isDark ? t.colors.ink : '#FFFFFF',
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  skeletonCard: {
    gap: spacing.sm,
  },
  skeletonRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  skeletonTextStack: {
    flex: 1,
    gap: 8,
  },
  heroWrap: {
    borderRadius: radii.lg,
    ...t.shadows.raised,
  },
  hero: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
    overflow: 'hidden' as const,
  },
  heroEmber: {
    position: 'absolute' as const,
    top: -70,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(242,62,22,0.32)',
  },
  heroEmberSmall: {
    position: 'absolute' as const,
    bottom: -60,
    left: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(111,85,242,0.22)',
  },
  heroEyebrow: {
    ...t.typography.label,
    color: 'rgba(255,255,255,0.62)',
  },
  heroTitle: {
    ...t.typography.h1,
    color: t.colors.onHero,
  },
  heroSubtitle: {
    ...t.typography.body,
    color: t.colors.heroSub,
  },
  compactHeader: {
    gap: spacing.xs,
    paddingHorizontal: 2,
  },
  compactEyebrow: {
    ...t.typography.label,
    color: t.colors.primary,
  },
  compactTitle: {
    ...t.typography.h1,
  },
  compactSubtitle: {
    ...t.typography.body,
    maxWidth: '92%' as const,
  },
  screenHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: 46,
    marginBottom: spacing.md,
  },
  screenHeaderSide: {
    width: 52,
    alignItems: 'flex-start' as const,
    justifyContent: 'center' as const,
  },
  screenHeaderRight: {
    alignItems: 'flex-end' as const,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.glass,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  screenHeaderTitle: {
    flex: 1,
    textAlign: 'center' as const,
    ...t.typography.title,
  },
  panel: {
    backgroundColor: t.colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    ...t.shadows.card,
  },
  sectionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...t.typography.h2,
  },
  sectionAction: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: t.colors.primary,
  },
  statTile: {
    minWidth: 110,
    gap: spacing.xs,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.primarySoft,
  },
  statValue: {
    ...t.typography.h2,
    fontSize: 22,
  },
  statLabel: {
    ...t.typography.caption,
  },
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    marginRight: spacing.sm,
    ...t.shadows.subtle,
  },
  chipActive: {
    backgroundColor: t.colors.ink,
    borderColor: t.colors.ink,
  },
  chipLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: t.colors.ink,
  },
  chipLabelActive: {
    color: t.isDark ? '#0C0D11' : '#FFFFFF',
  },
  segmented: {
    flexDirection: 'row' as const,
    backgroundColor: t.colors.inputBg,
    borderRadius: radii.pill,
    padding: 4,
    gap: 6,
    position: 'relative' as const,
  },
  segmentThumb: {
    position: 'absolute' as const,
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: radii.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    ...t.shadows.subtle,
  },
  segment: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radii.pill,
    alignItems: 'center' as const,
  },
  segmentLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: t.colors.faint,
  },
  segmentLabelActive: {
    color: t.colors.ink,
  },
  search: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    backgroundColor: t.colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...t.shadows.subtle,
  },
  searchFocused: {
    borderColor: t.colors.primary,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: t.colors.ink,
    padding: 0,
  },
  button: {
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonInner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    minHeight: 20,
  },
  buttonSolid: {
    ...t.shadows.glow,
  },
  buttonGhost: {
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.borderStrong,
  },
  buttonSoft: {
    backgroundColor: t.colors.primarySoft,
  },
  buttonDanger: {
    backgroundColor: t.colors.dangerBg,
  },
  buttonDim: {
    opacity: 0.55,
  },
  buttonLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    letterSpacing: 0.1,
  },
  empty: {
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.primarySoft,
  },
  emptyTitle: {
    ...t.typography.title,
  },
  emptyBody: {
    ...t.typography.body,
    textAlign: 'center' as const,
    maxWidth: 280,
  },
  emptyAction: {
    marginTop: spacing.xs,
  },
}));
