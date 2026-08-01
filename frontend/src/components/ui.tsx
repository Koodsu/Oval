import React from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  ImageStyle,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BORDER_W,
  SLAB_OFFSET,
  ThemeColors,
  elevation,
  fonts,
  motion,
  radii,
  spacing,
  useTheme,
} from '../theme';
import { resolveAvatarUrl } from '../api';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CAMPUS PULSE COMPONENT KIT
 *
 * Content surfaces are solid, calm, and native-feeling. Blur is reserved for
 * chrome such as the dock and bottom sheets.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Fire a light haptic tick, safely (no-ops in tests/web). */
function tick() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)?.catch?.(() => {});
  } catch {
    // haptics unavailable
  }
}

// ── Accent hashing — stable crayon color per entity ─────────────────────────

const ACCENT_KEYS = ['blue', 'green', 'amber', 'pink', 'violet', 'teal'] as const;
export type AccentKey = (typeof ACCENT_KEYS)[number];

export function accentKeyForSeed(seed: string): AccentKey {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return ACCENT_KEYS[hash % ACCENT_KEYS.length];
}

/**
 * Pick a legible label color for an arbitrary fill. Saturated fills (the
 * scarlet primary) take `onPrimary`; pale crayon tints take `ink`.
 */
export function readableInkOn(colors: ThemeColors, fill: string): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(fill.trim());
  if (!match) return colors.ink;
  const value = match[1];
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? colors.ink : colors.onPrimary;
}

export function accentForSeed(colors: ThemeColors, seed: string) {
  const key = accentKeyForSeed(seed);
  return {
    key,
    tint: colors[key],
    soft: colors[`${key}Soft` as const],
  };
}

// ── Dock clearance ───────────────────────────────────────────────────────────

/** Height of the floating dock's own content (padding + icon + label). */
const DOCK_HEIGHT = 66;

/**
 * Bottom padding scroll content must reserve so nothing hides under the
 * floating dock. Unlike the static DOCK_CLEARANCE constant (tuned for iPhone
 * home-indicator insets), this follows the device's real bottom inset —
 * Android 3-button nav has a taller inset and was clipping content.
 */
export function useDockClearance(): number {
  const insets = useSafeAreaInsets();
  return DOCK_HEIGHT + 12 + Math.max(insets.bottom, 10);
}

// ── Slab — the signature pressable surface ───────────────────────────────────

export type SlabProps = {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Face background. Defaults to surface. */
  color?: string;
  /** Border color. Defaults to theme border. */
  borderColor?: string;
  radius?: number;
  /** @deprecated Kept for call-site compatibility. Campus Pulse surfaces sit flat. */
  tilt?: number;
  /** Enable a diffuse surface shadow. */
  raised?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  faceStyle?: StyleProp<ViewStyle>;
  accessibilityRole?: 'button' | 'link' | 'tab' | 'none';
  accessibilityLabel?: string;
  hitSlop?: React.ComponentProps<typeof Pressable>['hitSlop'];
  testID?: string;
};

export function Slab({
  children,
  onPress,
  onLongPress,
  disabled,
  color,
  borderColor,
  radius = radii.md,
  raised = true,
  haptic = true,
  style,
  faceStyle,
  accessibilityRole = 'button',
  accessibilityLabel,
  hitSlop,
  testID,
}: SlabProps) {
  const { colors } = useTheme();
  const press = useSharedValue(0);
  const interactive = Boolean(onPress || onLongPress) && !disabled;

  const faceFill = color ?? colors.surface;

  const faceAnimated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.025 }],
    opacity: 1 - press.value * 0.06,
  }));

  const faceStyles = [
    slabStyles.face,
    {
      backgroundColor: faceFill,
      borderColor: borderColor ?? colors.border,
      borderRadius: radius,
    },
    interactive ? faceAnimated : null,
    faceStyle,
  ];

  return (
    <View
      style={[
        slabStyles.wrap,
        raised && { borderRadius: radius, ...elevation.card, shadowColor: colors.shadow },
        disabled && slabStyles.disabled,
        style,
      ]}
    >
      {interactive ? (
        <AnimatedPressable
          onPress={() => {
            if (haptic) tick();
            onPress?.();
          }}
          onLongPress={onLongPress}
          onPressIn={() => {
            press.value = withSpring(1, motion.springSnappy);
          }}
          onPressOut={() => {
            press.value = withSpring(0, motion.springSnappy);
          }}
          disabled={disabled}
          accessibilityRole={accessibilityRole}
          accessibilityLabel={accessibilityLabel}
          hitSlop={hitSlop}
          testID={testID}
          style={faceStyles}
        >
          {children}
        </AnimatedPressable>
      ) : (
        <Animated.View style={faceStyles}>{children}</Animated.View>
      )}
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const slabStyles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  face: {
    borderWidth: BORDER_W,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.45,
  },
});

/** Non-interactive solid surface with default padding. */
export function Card({
  children,
  style,
  faceStyle,
  padded = true,
  raised = false,
  ...rest
}: Omit<SlabProps, 'onPress' | 'onLongPress'> & { padded?: boolean }) {
  return (
    <Slab
      {...rest}
      raised={raised}
      accessibilityRole="none"
      style={style}
      faceStyle={[padded && { padding: spacing.lg }, faceStyle]}
    >
      {children}
    </Slab>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  /** @deprecated Use secondary. */
  | 'ghost'
  /** @deprecated Destructive buttons keep the legacy danger fill. */
  | 'danger'
  /** @deprecated Use primary with tint only where a legacy accent is needed. */
  | 'accent';
export type ButtonSize = 'lg' | 'md' | 'sm';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  tint,
  style,
  testID,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  /** Custom fill for variant="accent" */
  tint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useTheme();
  const resolvedVariant =
    variant === 'ghost' ? 'secondary' : variant === 'accent' ? 'primary' : variant;
  const fill =
    resolvedVariant === 'primary'
      ? (variant === 'accent' ? (tint ?? colors.primary) : colors.primary)
      : resolvedVariant === 'danger'
        ? colors.danger
        : resolvedVariant === 'tertiary'
          ? colors.ink
          : colors.surface;
  // Secondary reads as a quiet neutral control (the mock's "Decline" /
  // "Details" buttons), not a red outline — scarlet is reserved for the
  // one primary action on screen.
  const labelColor =
    resolvedVariant === 'primary' || resolvedVariant === 'danger'
      ? colors.onPrimary
      : resolvedVariant === 'tertiary'
        ? colors.bg
        : colors.ink;
  const borderColor =
    resolvedVariant === 'danger' ? colors.danger : colors.border;
  const height = size === 'lg' ? 52 : size === 'md' ? 46 : 36;
  const fontSize = size === 'sm' ? 12 : 14;

  return (
    <Slab
      onPress={onPress}
      disabled={disabled || loading}
      color={fill}
      borderColor={borderColor}
      radius={radii.button}
      style={style}
      faceStyle={[buttonStyles.face, { height: height - SLAB_OFFSET }]}
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={buttonStyles.loadingFrame}>
        <View style={[buttonStyles.inner, loading && buttonStyles.loadingLabel]}>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={labelColor} /> : null}
          <Text style={[buttonStyles.label, { color: labelColor, fontSize }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={labelColor}
            style={buttonStyles.spinner}
          />
        ) : null}
      </View>
    </Slab>
  );
}

const buttonStyles = StyleSheet.create({
  face: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLabel: {
    opacity: 0,
  },
  spinner: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  label: {
    fontFamily: fonts.bold,
    fontWeight: '600',
    letterSpacing: 0,
  },
});

/** Small square icon button (back arrows, header actions). */
export function IconButton({
  icon,
  onPress,
  color,
  iconColor,
  size = 42,
  disabled,
  accessibilityLabel,
  style,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  iconColor?: string;
  size?: number;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useTheme();
  // Header glyphs sit bare on the page (back chevron, share, gear) unless a
  // caller explicitly asks for a filled well.
  const filled = Boolean(color);
  return (
    <Slab
      onPress={onPress}
      disabled={disabled}
      color={color ?? 'transparent'}
      borderColor={filled ? color : 'transparent'}
      raised={filled}
      radius={radii.sm}
      style={style}
      faceStyle={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Ionicons name={icon} size={Math.round(size * 0.46)} color={iconColor ?? colors.ink} />
    </Slab>
  );
}

// ── Chips & badges ───────────────────────────────────────────────────────────

export function Chip({
  label,
  selected,
  onPress,
  icon,
  tint,
  style,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Fill when selected; defaults to the scarlet primary. */
  tint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useTheme();
  // Selected filter chips are solid pills — scarlet by default, or the
  // caller's tint. The label flips to stay legible on either.
  const fill = selected ? (tint ?? colors.primary) : colors.surface;
  const labelColor = selected ? readableInkOn(colors, fill) : colors.sub;

  return (
    <Slab
      onPress={onPress}
      color={fill}
      borderColor={selected ? fill : colors.border}
      radius={radii.pill}
      raised={false}
      style={style}
      faceStyle={chipStyles.face}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={chipStyles.inner}>
        {icon ? <Ionicons name={icon} size={14} color={labelColor} /> : null}
        <Text style={[chipStyles.label, { color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Slab>
  );
}

const chipStyles = StyleSheet.create({
  face: {
    paddingHorizontal: 14,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 13,
  },
});

/**
 * Compact segmented control with one clear scarlet selection.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        segmentedStyles.track,
        { backgroundColor: colors.sunken, borderColor: colors.border },
        style,
      ]}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (!active) {
                tick();
                onChange(opt.value);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={[
              segmentedStyles.segment,
              active && { backgroundColor: colors.primary },
            ]}
          >
            <Text
              style={[
                segmentedStyles.label,
                { color: active ? colors.onPrimary : colors.sub },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const segmentedStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radii.button,
    borderWidth: BORDER_W,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 34,
    borderRadius: radii.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12,
  },
});

/**
 * Soft status pill — category tags, counts, and live flags.
 */
export function Sticker({
  label,
  tint,
  textColor,
  icon,
  small,
  style,
}: {
  label: string;
  tint?: string;
  textColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** @deprecated Campus Pulse pills sit flat; kept for call-site compatibility. */
  tilt?: number;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const fg = textColor ?? colors.sub;
  return (
    <View
      style={[
        stickerStyles.base,
        {
          backgroundColor: tint ?? colors.warningSoft,
          paddingHorizontal: small ? 9 : 11,
          paddingVertical: small ? 4 : 6,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={small ? 11 : 13} color={fg} /> : null}
      <Text
        style={[stickerStyles.label, { color: fg, fontSize: small ? 11 : 12 }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const stickerStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  label: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    letterSpacing: 0,
    flexShrink: 1,
  },
});

/** Quiet inline tag (no border drama). */
export function Tag({ label, tint, style }: { label: string; tint?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[tagStyles.base, { backgroundColor: tint ?? colors.surfaceAlt }, style]}>
      <Text style={[tagStyles.label, { color: colors.sub }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function StatusTag({
  status,
  style,
}: {
  status: 'FORMING' | 'LOCKED' | 'COMPLETED' | 'EXPIRED' | string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const normalized = status.toUpperCase();
  const config =
    normalized === 'FORMING'
      ? { label: 'Forming', bg: colors.primarySoft, fg: colors.accentText, icon: null }
      : normalized === 'LOCKED'
        ? { label: 'Locked', bg: colors.surfaceAlt, fg: colors.sub, icon: 'lock-closed' as const }
        : normalized === 'COMPLETED'
          ? { label: 'Completed', bg: colors.successSoft, fg: colors.success, icon: null }
          : { label: 'Expired', bg: colors.surfaceAlt, fg: colors.faint, icon: null };

  return (
    <View style={[tagStyles.status, { backgroundColor: config.bg }, style]}>
      {config.icon ? <Ionicons name={config.icon} size={12} color={config.fg} /> : null}
      <Text style={[tagStyles.label, { color: config.fg }]} numberOfLines={1}>
        {config.label}
      </Text>
    </View>
  );
}

const tagStyles = StyleSheet.create({
  base: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  label: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12,
  },
});

/** Notification count dot. */
export function CountBubble({ count, style }: { count: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  if (count <= 0) return null;
  return (
    <View
      style={[
        bubbleStyles.base,
        { backgroundColor: colors.primary },
        style,
      ]}
    >
      <Text style={[bubbleStyles.label, { color: colors.onPrimary }]}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
}

export function StatSlab({
  label,
  value,
  icon,
  tint,
  style,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Slab
      accessibilityRole="none"
      color={tint}
      style={[{ flex: 1 }, style]}
      faceStyle={statSlabStyles.face}
    >
      <Ionicons name={icon} size={16} color={colors.ink} />
      <Text style={[statSlabStyles.value, { color: colors.ink }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[statSlabStyles.label, { color: colors.sub }]} numberOfLines={1}>
        {label}
      </Text>
    </Slab>
  );
}

const statSlabStyles = StyleSheet.create({
  face: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
    gap: 3,
  },
  value: {
    fontFamily: fonts.displayMedium,
    fontSize: 17,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 8.5,
    letterSpacing: 1,
  },
});

const bubbleStyles = StyleSheet.create({
  base: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 10,
  },
});

// ── Avatars ──────────────────────────────────────────────────────────────────

export function Avatar({
  name,
  uri,
  size = 44,
  tilt = 0,
  style,
  backgroundColor,
  initialsColor,
  borderColor,
}: {
  name?: string | null;
  uri?: string | null;
  size?: number;
  tilt?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * Overrides for saturated surfaces (e.g. the scarlet hero slab), where the
   * seeded pastel fill and hairline border disappear into the background.
   */
  backgroundColor?: string;
  initialsColor?: string;
  borderColor?: string;
}) {
  const { colors } = useTheme();
  const resolved = resolveAvatarUrl(uri);
  const seed = name?.trim() || '?';
  const accent = accentForSeed(colors, seed);
  const initials = seed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <View
      style={[
        avatarStyles.base,
        {
          width: size,
          height: size,
          // People are circles; clubs and content keep the squircle.
          borderRadius: size / 2,
          backgroundColor: backgroundColor ?? accent.soft,
          borderColor: borderColor ?? colors.border,
        },
        style,
      ]}
    >
      {resolved ? (
        <Animated.Image
          source={{ uri: resolved }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={[
            avatarStyles.initials,
            { color: initialsColor ?? accent.tint, fontSize: Math.max(11, size * 0.34) },
          ]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  base: {
    borderWidth: BORDER_W,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontFamily: fonts.bold,
  },
});

/**
 * Club identity tile. Falls back gracefully: photo → emoji → initials on the
 * club's accent color, so a club without assets still looks intentional.
 */
export function ClubMark({
  name,
  emoji,
  uri,
  size = 44,
  tilt = 0,
  style,
}: {
  name?: string | null;
  emoji?: string | null;
  uri?: string | null;
  size?: number;
  tilt?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const resolved = resolveAvatarUrl(uri);
  const seed = name?.trim() || '?';
  const accent = accentForSeed(colors, seed);
  const cleanEmoji = emoji?.trim();
  const initials = seed
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <View
      style={[
        clubMarkStyles.base,
        {
          width: size,
          height: size,
          borderRadius: size * 0.26,
          backgroundColor: accent.soft,
          borderColor: colors.border,
          transform: tilt ? [{ rotate: `${tilt}deg` }] : undefined,
        },
        style,
      ]}
    >
      {resolved ? (
        <Animated.Image
          source={{ uri: resolved }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : cleanEmoji ? (
        <Text style={{ fontSize: size * 0.44, lineHeight: size * 0.58 }}>{cleanEmoji}</Text>
      ) : (
        <Text
          style={[
            clubMarkStyles.initials,
            { color: accent.tint, fontSize: Math.max(11, size * 0.3) },
          ]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const clubMarkStyles = StyleSheet.create({
  base: {
    borderWidth: BORDER_W,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
  },
});

export function AvatarStack({
  names,
  size = 30,
  max = 4,
  overflowCount,
  style,
  onColor = false,
}: {
  names: { name?: string | null; uri?: string | null }[];
  size?: number;
  max?: number;
  overflowCount?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * Render for a solid primary-colored surface: solid onPrimary chips with
   * primary initials, so the stack doesn't vanish red-on-red on the hero slab.
   */
  onColor?: boolean;
}) {
  const { colors } = useTheme();
  const shown = names.slice(0, max);
  const extra = overflowCount ?? names.length - shown.length;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      {shown.map((member, index) => (
        <Avatar
          key={`${member.name ?? 'member'}-${index}`}
          name={member.name}
          uri={member.uri}
          size={size}
          backgroundColor={onColor ? colors.onPrimary : undefined}
          initialsColor={onColor ? colors.primary : undefined}
          borderColor={onColor ? colors.onPrimary : undefined}
          style={{ marginLeft: index === 0 ? 0 : -size * 0.3 }}
        />
      ))}
      {extra > 0 ? (
        <View
          style={[
            avatarStyles.base,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -size * 0.3,
              backgroundColor: onColor ? colors.onPrimary : colors.surfaceAlt,
              borderColor: onColor ? colors.onPrimary : colors.border,
            },
          ]}
        >
          <Text
            style={[
              avatarStyles.initials,
              { color: onColor ? colors.primary : colors.sub, fontSize: size * 0.34 },
            ]}
          >
            +{extra}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Editorial and content imagery ───────────────────────────────────────────

/**
 * Transparent editorial vignette for onboarding, activation, invitations, and
 * state-specific guidance. Callers choose an approved `spot/**` asset; this
 * wrapper intentionally does not infer files from user-entered text.
 */
export function SpotIllustration({
  source,
  accessibilityLabel,
  height = 200,
  decorative = false,
  style,
}: {
  source: ImageSourcePropType;
  accessibilityLabel?: string;
  height?: number;
  decorative?: boolean;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={source}
      resizeMode="contain"
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      style={[imageStyles.spot, { height }, style]}
    />
  );
}

/**
 * Content-media frame. Until approved activity/category artwork exists, the
 * fallback is a deterministic theme tint plus code-native icon—not invented
 * photography or fictional social proof.
 */
export function ContentImage({
  source,
  seed,
  fallbackIcon = 'sparkles-outline',
  accessibilityLabel,
  aspectRatio = 16 / 9,
  children,
  style,
}: {
  source?: ImageSourcePropType | null;
  seed: string;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  aspectRatio?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const accent = accentForSeed(colors, seed);
  return (
    <View
      style={[
        imageStyles.content,
        {
          aspectRatio,
          backgroundColor: accent.soft,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {source ? (
        <Image
          source={source}
          resizeMode="cover"
          accessible={Boolean(accessibilityLabel)}
          accessibilityLabel={accessibilityLabel}
          style={[StyleSheet.absoluteFill, imageStyles.cover]}
        />
      ) : (
        <Ionicons
          name={fallbackIcon}
          size={Math.max(24, Math.min(38, 30 * aspectRatio))}
          color={accent.tint}
          accessibilityElementsHidden
        />
      )}
      {children}
    </View>
  );
}

/** Live copy block used beside a state-specific illustration. */
export function StateCopy({
  eyebrow,
  title,
  body,
  align = 'center',
  style,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
}) {
  const { typography } = useTheme();
  return (
    <View style={[stateStyles.copy, align === 'center' && stateStyles.center, style]}>
      {eyebrow ? <Text style={typography.kicker}>{eyebrow}</Text> : null}
      <Text style={[typography.display, { textAlign: align }]}>{title}</Text>
      {body ? (
        <Text style={[typography.body, stateStyles.body, { textAlign: align }]}>{body}</Text>
      ) : null}
    </View>
  );
}

/** One primary action and an optional quiet secondary action for state pages. */
export function StateActions({
  primaryLabel,
  onPrimary,
  primaryIcon,
  secondaryLabel,
  onSecondary,
  style,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryIcon?: keyof typeof Ionicons.glyphMap;
  secondaryLabel?: string;
  onSecondary?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[stateStyles.actions, style]}>
      <Button label={primaryLabel} icon={primaryIcon} onPress={onPrimary} />
      {secondaryLabel && onSecondary ? (
        <Button label={secondaryLabel} onPress={onSecondary} variant="secondary" />
      ) : null}
    </View>
  );
}

const imageStyles = StyleSheet.create({
  spot: {
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: BORDER_W,
    borderRadius: radii.md,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
});

const stateStyles = StyleSheet.create({
  copy: {
    gap: spacing.sm,
    maxWidth: 320,
  },
  center: {
    alignSelf: 'center',
    alignItems: 'center',
  },
  body: {
    maxWidth: 300,
  },
  actions: {
    gap: spacing.sm,
    width: '100%',
  },
});

// ── Layout primitives ────────────────────────────────────────────────────────

export function AppBackdrop({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, isDark } = useTheme();
  const atmosphere = isDark
    ? require('../../assets/illustrations/runtime/ambient/02-dark-charcoal-wash.jpg')
    : require('../../assets/illustrations/runtime/ambient/01-light-paper-wash.jpg');
  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      <Image
        source={atmosphere}
        resizeMode="cover"
        accessible={false}
        style={[StyleSheet.absoluteFill, { opacity: isDark ? 0.28 : 0.08 }]}
      />
      {children}
    </View>
  );
}

/** Hairline rule. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
        },
        style,
      ]}
    />
  );
}

/** Eyebrow kicker + display title, optional right action. */
export function SectionHeader({
  kicker,
  title,
  actionLabel,
  onAction,
  style,
}: {
  kicker?: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, typography } = useTheme();
  return (
    <View style={[sectionStyles.row, style]}>
      <View style={{ flex: 1 }}>
        {kicker ? <Text style={[typography.kicker, sectionStyles.kicker]}>{kicker}</Text> : null}
        <Text style={typography.title}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Text style={[sectionStyles.action, { color: colors.accentText }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  kicker: {
    marginBottom: 3,
  },
  action: {
    fontFamily: fonts.bold,
    fontWeight: '600',
    fontSize: 12,
    paddingBottom: 2,
  },
});

/** Stack-screen header: compact back action, title, and optional right action. */
export function ScreenHeader({
  title,
  kicker,
  onBack,
  right,
  centered = false,
  style,
}: {
  title: string;
  kicker?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { typography } = useTheme();
  return (
    <View style={[headerStyles.row, style]}>
      {onBack ? (
        <IconButton icon="arrow-back" onPress={onBack} accessibilityLabel="Go back" />
      ) : null}
      <View style={[{ flex: 1, minWidth: 0 }, centered && headerStyles.centerTitle]}>
        {kicker ? <Text style={[typography.kicker, { marginBottom: 2 }]}>{kicker}</Text> : null}
        <Text style={typography.display} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  centerTitle: {
    alignItems: 'center',
  },
});

// ── Inputs ───────────────────────────────────────────────────────────────────

export function Field({
  label,
  error,
  hint,
  style,
  inputStyle,
  multiline,
  secureToggle,
  ...inputProps
}: TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  secureToggle?: boolean;
}) {
  const { colors, typography } = useTheme();
  const [focused, setFocused] = React.useState(false);
  const [secureVisible, setSecureVisible] = React.useState(false);

  return (
    <View style={style}>
      {label ? <Text style={[typography.captionSmall, fieldStyles.label]}>{label}</Text> : null}
      <View
        style={[
          fieldStyles.well,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : focused ? colors.primary : colors.border,
          },
          multiline && { minHeight: 96, paddingVertical: 10 },
        ]}
      >
        <TextInput
          {...inputProps}
          multiline={multiline}
          secureTextEntry={
            secureToggle ? !secureVisible : inputProps.secureTextEntry
          }
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
          placeholderTextColor={colors.faint}
          style={[
            fieldStyles.input,
            { color: colors.ink },
            multiline && { textAlignVertical: 'top', flex: 1 },
            inputStyle,
          ]}
        />
        {secureToggle ? (
          <Pressable
            onPress={() => setSecureVisible((visible) => !visible)}
            accessibilityRole="button"
            accessibilityLabel={secureVisible ? 'Hide password' : 'Show password'}
            hitSlop={8}
          >
            <Ionicons
              name={secureVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.sub}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[fieldStyles.meta, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[fieldStyles.meta, { color: colors.sub }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  label: {
    fontWeight: '600',
    marginBottom: 6,
  },
  well: {
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    letterSpacing: 0,
    paddingVertical: 11,
  },
  meta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 6,
  },
});

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search…',
  onClear,
  autoFocus,
  onSubmitEditing,
  style,
  testID,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  autoFocus?: boolean;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<TextInput>(null);
  return (
    <View
      style={[
        fieldStyles.well,
        {
          backgroundColor: colors.surface,
          borderColor: focused ? colors.primary : colors.border,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <Ionicons name="search" size={18} color={colors.sub} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={(event) => {
          onSubmitEditing?.(event);
          inputRef.current?.blur();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[fieldStyles.input, { color: colors.ink }]}
        accessibilityLabel={placeholder}
        testID={testID}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => {
            onChangeText('');
            onClear?.();
          }}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color={colors.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function DateTimeField({
  value,
  onChange,
  minimumDate,
  maximumDate,
}: {
  value: Date;
  onChange: (value: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const { colors, typography } = useTheme();
  const [androidMode, setAndroidMode] = React.useState<'date' | 'time' | null>(null);

  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={value}
        mode="datetime"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onChange={(_, nextValue) => {
          if (nextValue) onChange(nextValue);
        }}
        display="default"
      />
    );
  }

  const updatePart = (mode: 'date' | 'time', nextValue?: Date) => {
    setAndroidMode(null);
    if (!nextValue) return;
    const next = new Date(value);
    if (mode === 'date') {
      next.setFullYear(nextValue.getFullYear(), nextValue.getMonth(), nextValue.getDate());
    } else {
      next.setHours(nextValue.getHours(), nextValue.getMinutes(), 0, 0);
    }
    onChange(next);
  };

  return (
    <View style={dateTimeStyles.androidRow}>
      <Pressable
        onPress={() => setAndroidMode('date')}
        accessibilityRole="button"
        accessibilityLabel="Choose date"
        style={[dateTimeStyles.androidButton, { borderColor: colors.border }]}
      >
        <Ionicons name="calendar-outline" size={17} color={colors.accentText} />
        <Text style={typography.caption}>
          {value.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setAndroidMode('time')}
        accessibilityRole="button"
        accessibilityLabel="Choose time"
        style={[dateTimeStyles.androidButton, { borderColor: colors.border }]}
      >
        <Ionicons name="time-outline" size={17} color={colors.accentText} />
        <Text style={typography.caption}>
          {value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </Pressable>
      {androidMode ? (
        <DateTimePicker
          value={value}
          mode={androidMode}
          minimumDate={androidMode === 'date' ? minimumDate : undefined}
          maximumDate={androidMode === 'date' ? maximumDate : undefined}
          onChange={(_, nextValue) => updatePart(androidMode, nextValue)}
          display="default"
        />
      ) : null}
    </View>
  );
}

const dateTimeStyles = StyleSheet.create({
  androidRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    flex: 1,
  },
  androidButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
  },
});

// ── Feedback ─────────────────────────────────────────────────────────────────

export function Banner({
  message,
  kind = 'error',
  style,
  onDismiss,
}: {
  message: string;
  kind?: 'error' | 'info' | 'success' | 'warning';
  style?: StyleProp<ViewStyle>;
  /** Optional ✕ affordance for transient hints. */
  onDismiss?: () => void;
}) {
  const { colors } = useTheme();
  const tint =
    kind === 'error'
      ? colors.dangerSoft
      : kind === 'success'
        ? colors.successSoft
        : kind === 'warning'
          ? colors.warningSoft
          : colors.blueSoft;
  const fg =
    kind === 'error'
      ? colors.danger
      : kind === 'success'
        ? colors.success
        : kind === 'warning'
          ? colors.warning
          : colors.blue;
  const icon =
    kind === 'error'
      ? 'alert-circle'
      : kind === 'success'
        ? 'checkmark-circle'
        : kind === 'warning'
          ? 'warning'
          : 'information-circle';
  return (
    <View
      style={[
        bannerStyles.base,
        { backgroundColor: tint, borderColor: colors.border },
        style,
      ]}
      accessibilityRole="alert"
    >
      <Ionicons name={icon} size={18} color={fg} />
      <Text style={[bannerStyles.text, { color: colors.ink }]}>{message}</Text>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={12}
        >
          <Ionicons name="close" size={16} color={colors.sub} />
        </Pressable>
      ) : null}
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  text: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13.5,
    lineHeight: 19,
  },
});

export function EmptyState({
  icon = 'sparkles',
  title,
  body,
  actionLabel,
  onAction,
  tint,
  style,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  tint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, typography } = useTheme();
  return (
    <View style={[emptyStyles.wrap, style]}>
      <View
        style={[
          emptyStyles.badge,
          {
            backgroundColor: tint ?? colors.primarySoft,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name={icon} size={30} color={colors.ink} />
      </View>
      <Text style={[typography.title, emptyStyles.title]}>{title}</Text>
      {body ? <Text style={[typography.caption, emptyStyles.body]}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} size="md" style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
  },
  badge: {
    width: 74,
    height: 74,
    borderRadius: radii.lg,
    borderWidth: BORDER_W,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
  },
});

// ── Skeletons ────────────────────────────────────────────────────────────────

function usePulse() {
  const pulse = useSharedValue(0.45);
  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 760, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);
  return useAnimatedStyle(() => ({ opacity: pulse.value }));
}

export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = radii.xs,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const animated = usePulse();
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.surfaceAlt },
        animated,
        style,
      ]}
    />
  );
}

export function SkeletonCard({ compact, style }: { compact?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Card padded style={style}>
      <View style={{ gap: spacing.md }}>
        <SkeletonBlock width="42%" height={12} />
        <SkeletonBlock width="78%" height={compact ? 16 : 22} />
        {!compact ? <SkeletonBlock width="60%" height={13} /> : null}
      </View>
    </Card>
  );
}

export function SkeletonRow({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[skeletonStyles.row, style]}>
      <SkeletonBlock width={48} height={48} radius={24} />
      <View style={skeletonStyles.rowCopy}>
        <SkeletonBlock width="48%" height={13} />
        <SkeletonBlock width="76%" height={11} />
      </View>
      <SkeletonBlock width={58} height={34} radius={radii.button} />
    </View>
  );
}

export function SkeletonHero({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <Card padded={false} style={style}>
      <SkeletonBlock width="100%" height={172} radius={radii.md} />
      <View style={skeletonStyles.heroCopy}>
        <SkeletonBlock width="34%" height={11} />
        <SkeletonBlock width="74%" height={24} />
        <SkeletonBlock width="92%" height={13} />
        <SkeletonBlock width="100%" height={46} radius={radii.button} />
      </View>
    </Card>
  );
}

const skeletonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
  },
  rowCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  heroCopy: {
    gap: spacing.md,
    padding: spacing.lg,
  },
});

// ── Sheet modal ──────────────────────────────────────────────────────────────

export function Sheet({
  visible,
  onClose,
  title,
  kicker,
  children,
  scrollable,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  kicker?: string;
  children: React.ReactNode;
  scrollable?: boolean;
}) {
  const { colors, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[sheetStyles.scrim, { backgroundColor: colors.overlay }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
          <View
            style={[
              sheetStyles.sheet,
              {
                backgroundColor: colors.tabBar,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, spacing.xl),
              },
            ]}
          >
            <BlurView
              tint={isDark ? 'dark' : 'light'}
              intensity={40}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]}
            />
            <View style={[sheetStyles.grabber, { backgroundColor: colors.borderSoft }]} />
            {(title || kicker) ? (
              <View style={sheetStyles.header}>
                <View style={{ flex: 1 }}>
                  {kicker ? <Text style={[typography.kicker, { marginBottom: 2 }]}>{kicker}</Text> : null}
                  {title ? <Text style={typography.display}>{title}</Text> : null}
                </View>
                <IconButton icon="close" onPress={onClose} accessibilityLabel="Close" size={38} />
              </View>
            ) : null}
            {scrollable ? (
              <Animated.ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 520 }}
                contentContainerStyle={{ paddingBottom: spacing.md }}
              >
                {children}
              </Animated.ScrollView>
            ) : (
              children
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: BORDER_W + 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 3,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
});

// ── Rows ─────────────────────────────────────────────────────────────────────

/** Settings-style list row inside a Card: icon well, title, sub, chevron. */
export function ListRow({
  icon,
  title,
  sub,
  onPress,
  tint,
  right,
  destructive,
  last,
  testID,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  sub?: string;
  onPress?: () => void;
  tint?: string;
  right?: React.ReactNode;
  destructive?: boolean;
  last?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const fg = destructive ? colors.danger : colors.ink;
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              tick();
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={title}
      testID={testID}
      style={({ pressed }) => [
        rowStyles.row,
        !last && { borderBottomWidth: 1, borderStyle: 'solid', borderColor: colors.borderSoft },
        pressed && { opacity: 0.6 },
      ]}
    >
      {icon ? (
        <View
          style={[
            rowStyles.iconWell,
            {
              backgroundColor: destructive ? colors.dangerSoft : (tint ?? colors.surfaceAlt),
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name={icon} size={17} color={fg} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[rowStyles.title, { color: fg }]} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={[rowStyles.sub, { color: colors.sub }]} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={colors.sub} /> : null)}
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
  },
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: radii.xs + 2,
    borderWidth: BORDER_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  sub: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    marginTop: 1,
  },
});

// ── Misc ─────────────────────────────────────────────────────────────────────

export function ProgressBar({
  value,
  tint,
  height = 12,
  style,
}: {
  /** 0..1 */
  value: number;
  tint?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      style={[
        {
          height,
          borderRadius: height / 2,
          borderWidth: BORDER_W,
          borderColor: colors.border,
          backgroundColor: colors.sunken,
          overflow: 'hidden',
        },
        style,
      ]}
      accessibilityRole="progressbar"
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          flex: 1,
          backgroundColor: tint ?? colors.primary,
        }}
      />
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md }}>
      <ActivityIndicator color={colors.accentText} />
      <Text style={typography.caption}>{label}</Text>
    </View>
  );
}

// ── Typing indicator ─────────────────────────────────────────────────────────

function TypingDot({ index, color }: { index: number; color: string }) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withDelay(
      index * 160,
      withRepeat(
        withTiming(1, { duration: 420, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + progress.value * 0.65,
    transform: [{ translateY: -2.5 * progress.value }],
  }));

  return (
    <Animated.View
      style={[typingStyles.dot, { backgroundColor: color }, animatedStyle]}
    />
  );
}

/**
 * iMessage-style typing bubble: three staggered bouncing dots inside a chat
 * bubble, with an optional label ("Sarah is typing…") alongside.
 */
export function TypingIndicator({
  label,
  style,
}: {
  label?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, typography } = useTheme();
  return (
    <View
      style={[typingStyles.row, style]}
      accessibilityRole="text"
      accessibilityLabel={label ?? 'Someone is typing'}
    >
      <View
        style={[
          typingStyles.bubble,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}
      >
        <TypingDot index={0} color={colors.sub} />
        <TypingDot index={1} color={colors.sub} />
        <TypingDot index={2} color={colors.sub} />
      </View>
      {label ? (
        <Text style={[typography.caption, { color: colors.sub }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const typingStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    borderBottomLeftRadius: radii.xs,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
