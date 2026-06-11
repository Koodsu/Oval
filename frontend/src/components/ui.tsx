import React from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BORDER_W,
  SLAB_OFFSET,
  ThemeColors,
  fonts,
  motion,
  radii,
  spacing,
  useTheme,
} from '../theme';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SCARLET PRESS COMPONENT KIT
 *
 * Everything tappable is a "slab": a hard-bordered surface sitting on a flat
 * offset shadow. Pressing physically pushes the face down into its shadow.
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

export function accentForSeed(colors: ThemeColors, seed: string) {
  const key = accentKeyForSeed(seed);
  return {
    key,
    tint: colors[key],
    soft: colors[`${key}Soft` as const],
  };
}

// ── Slab — the signature pressable surface ───────────────────────────────────

export type SlabProps = {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Face background. Defaults to surface. */
  color?: string;
  /** Border + shadow color. Defaults to theme border. */
  borderColor?: string;
  radius?: number;
  /** Sticker tilt, in degrees. Use sparingly. */
  tilt?: number;
  /** Set false to hide the offset shadow (quiet slabs). */
  raised?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  faceStyle?: StyleProp<ViewStyle>;
  accessibilityRole?: 'button' | 'link' | 'tab' | 'none';
  accessibilityLabel?: string;
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
  tilt = 0,
  raised = true,
  haptic = true,
  style,
  faceStyle,
  accessibilityRole = 'button',
  accessibilityLabel,
  testID,
}: SlabProps) {
  const { colors } = useTheme();
  const press = useSharedValue(0);
  const interactive = Boolean(onPress || onLongPress) && !disabled;
  const depth = raised ? SLAB_OFFSET : 0;

  const faceAnimated = useAnimatedStyle(() => ({
    transform: [
      { translateX: press.value * depth * 0.85 },
      { translateY: press.value * depth * 0.85 },
    ],
  }));

  // The face is the touchable itself, so the outer wrap stays a plain flex
  // child — consumer `style` (flex: 1, width, etc.) participates in layout
  // and grids/rows stretch correctly.
  const faceStyles = [
    slabStyles.face,
    {
      backgroundColor: color ?? colors.surface,
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
        { paddingRight: depth, paddingBottom: depth },
        tilt !== 0 && { transform: [{ rotate: `${tilt}deg` }] },
        disabled && slabStyles.disabled,
        style,
      ]}
    >
      {raised ? (
        <View
          pointerEvents="none"
          style={[
            slabStyles.shadow,
            {
              top: depth,
              left: depth,
              borderRadius: radius,
              backgroundColor: borderColor ?? colors.shadow,
            },
          ]}
        />
      ) : null}
      {interactive ? (
        <AnimatedPressable
          onPress={() => {
            if (haptic) tick();
            onPress?.();
          }}
          onLongPress={onLongPress}
          onPressIn={() => {
            press.value = withSpring(1, motion.springPress);
          }}
          onPressOut={() => {
            press.value = withSpring(0, motion.springPress);
          }}
          disabled={disabled}
          accessibilityRole={accessibilityRole}
          accessibilityLabel={accessibilityLabel}
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
  shadow: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  face: {
    borderWidth: BORDER_W,
    overflow: 'hidden',
    // Fill the wrap when the consumer constrains the slab (flex: 1, fixed
    // height); hugs content otherwise since flexBasis stays auto.
    flexGrow: 1,
  },
  disabled: {
    opacity: 0.45,
  },
});

/** Non-interactive slab with default padding — a plain card. */
export function Card({
  children,
  style,
  faceStyle,
  padded = true,
  ...rest
}: Omit<SlabProps, 'onPress' | 'onLongPress'> & { padded?: boolean }) {
  return (
    <Slab
      {...rest}
      accessibilityRole="none"
      style={style}
      faceStyle={[padded && { padding: spacing.lg }, faceStyle]}
    >
      {children}
    </Slab>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
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

  const fill =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : variant === 'accent'
          ? (tint ?? colors.amber)
          : variant === 'ghost'
            ? 'transparent'
            : colors.surface;
  const labelColor =
    variant === 'primary' || variant === 'danger' ? colors.onPrimary : colors.ink;
  const height = size === 'lg' ? 56 : size === 'md' ? 48 : 38;
  const fontSize = size === 'sm' ? 13.5 : 15.5;

  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={() => {
          tick();
          onPress?.();
        }}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
        style={({ pressed }) => [
          buttonStyles.ghost,
          { height, opacity: disabled ? 0.45 : pressed ? 0.6 : 1 },
          style,
        ]}
      >
        {icon ? <Ionicons name={icon} size={17} color={colors.ink} /> : null}
        <Text style={[buttonStyles.label, { color: colors.ink, fontSize }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Slab
      onPress={onPress}
      disabled={disabled || loading}
      color={fill}
      radius={radii.sm}
      style={style}
      faceStyle={[buttonStyles.face, { height: height - SLAB_OFFSET }]}
      accessibilityLabel={label}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        <View style={buttonStyles.inner}>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={labelColor} /> : null}
          <Text style={[buttonStyles.label, { color: labelColor, fontSize }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
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
  label: {
    fontFamily: fonts.bold,
    letterSpacing: 0.2,
  },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
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
  return (
    <Slab
      onPress={onPress}
      disabled={disabled}
      color={color ?? colors.surface}
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
  /** Fill when selected; defaults to ink. */
  tint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors, isDark } = useTheme();
  const fill = selected ? (tint ?? colors.ink) : colors.surface;
  const fg = selected ? (tint ? colors.ink : isDark ? colors.bg : colors.surface) : colors.ink;
  // When tinted fills are light pastels, keep ink text; ink fill gets paper text.
  const labelColor = selected && !tint ? (isDark ? '#181210' : '#FFFCF2') : fg;

  return (
    <Slab
      onPress={onPress}
      color={fill}
      radius={radii.pill}
      raised={Boolean(selected)}
      style={style}
      faceStyle={chipStyles.face}
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
    height: 36,
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
    fontSize: 13,
  },
});

/** Tilted sticker badge — category tags, counts, "NEW" flashes. */
export function Sticker({
  label,
  tint,
  textColor,
  icon,
  tilt = -2,
  small,
  style,
}: {
  label: string;
  tint?: string;
  textColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tilt?: number;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const fg = textColor ?? colors.ink;
  return (
    <View
      style={[
        stickerStyles.base,
        {
          backgroundColor: tint ?? colors.warningSoft,
          borderColor: colors.border,
          transform: [{ rotate: `${tilt}deg` }],
          paddingHorizontal: small ? 8 : 10,
          paddingVertical: small ? 3 : 5,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={small ? 11 : 13} color={fg} /> : null}
      <Text
        style={[stickerStyles.label, { color: fg, fontSize: small ? 10 : 11.5 }]}
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
    gap: 4,
    borderWidth: BORDER_W,
    borderRadius: radii.xs,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

/** Quiet inline tag (no border drama). */
export function Tag({ label, tint, style }: { label: string; tint?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[tagStyles.base, { backgroundColor: tint ?? colors.surfaceAlt }, style]}>
      <Text style={[tagStyles.label, { color: colors.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const tagStyles = StyleSheet.create({
  base: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.xs,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
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
        { backgroundColor: colors.primary, borderColor: colors.border },
        style,
      ]}
    >
      <Text style={[bubbleStyles.label, { color: colors.onPrimary }]}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  base: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
});

// ── Avatars ──────────────────────────────────────────────────────────────────

export function Avatar({
  name,
  uri,
  size = 44,
  tilt = 0,
  style,
}: {
  name?: string | null;
  uri?: string | null;
  size?: number;
  tilt?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
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
          borderRadius: size * 0.32,
          backgroundColor: accent.soft,
          borderColor: colors.border,
          transform: tilt ? [{ rotate: `${tilt}deg` }] : undefined,
        },
        style,
      ]}
    >
      {uri ? (
        <Animated.Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={[
            avatarStyles.initials,
            { color: accent.tint, fontSize: Math.max(11, size * 0.34) },
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
          borderRadius: size * 0.29,
          backgroundColor: accent.soft,
          borderColor: colors.border,
          transform: tilt ? [{ rotate: `${tilt}deg` }] : undefined,
        },
        style,
      ]}
    >
      {uri ? (
        <Animated.Image
          source={{ uri }}
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
  style,
}: {
  names: { name?: string | null; uri?: string | null }[];
  size?: number;
  max?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      {shown.map((member, index) => (
        <Avatar
          key={`${member.name ?? 'member'}-${index}`}
          name={member.name}
          uri={member.uri}
          size={size}
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
              borderRadius: size * 0.32,
              marginLeft: -size * 0.3,
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[avatarStyles.initials, { color: colors.sub, fontSize: size * 0.34 }]}>
            +{extra}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Layout primitives ────────────────────────────────────────────────────────

export function AppBackdrop({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</View>;
}

/** Dashed zine rule. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          borderBottomWidth: 2,
          borderStyle: 'dashed',
          borderColor: colors.borderSoft,
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
          <Text style={[sectionStyles.action, { color: colors.primary }]}>{actionLabel} →</Text>
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
    fontSize: 13.5,
    paddingBottom: 2,
  },
});

/** Stack-screen header: back slab + kicker/title. */
export function ScreenHeader({
  title,
  kicker,
  onBack,
  right,
  style,
}: {
  title: string;
  kicker?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { typography } = useTheme();
  return (
    <View style={[headerStyles.row, style]}>
      {onBack ? (
        <IconButton icon="arrow-back" onPress={onBack} accessibilityLabel="Go back" />
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
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
});

// ── Inputs ───────────────────────────────────────────────────────────────────

export function Field({
  label,
  error,
  hint,
  style,
  inputStyle,
  multiline,
  ...inputProps
}: TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}) {
  const { colors, typography } = useTheme();
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={style}>
      {label ? <Text style={[typography.kicker, { marginBottom: 6 }]}>{label}</Text> : null}
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
      </View>
      {error ? (
        <Text style={[fieldStyles.meta, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[fieldStyles.meta, { color: colors.faint }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  well: {
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    paddingVertical: 12,
  },
  meta: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    marginTop: 6,
  },
});

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search…',
  onClear,
  autoFocus,
  style,
  testID,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = React.useState(false);
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
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
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

// ── Feedback ─────────────────────────────────────────────────────────────────

export function Banner({
  message,
  kind = 'error',
  style,
}: {
  message: string;
  kind?: 'error' | 'info' | 'success';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const tint =
    kind === 'error' ? colors.dangerSoft : kind === 'success' ? colors.successSoft : colors.blueSoft;
  const fg = kind === 'error' ? colors.danger : kind === 'success' ? colors.success : colors.blue;
  const icon =
    kind === 'error' ? 'alert-circle' : kind === 'success' ? 'checkmark-circle' : 'information-circle';
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
    transform: [{ rotate: '-4deg' }],
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
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[sheetStyles.scrim, { backgroundColor: colors.overlay }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            sheetStyles.sheet,
            {
              backgroundColor: colors.bg,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.xl),
            },
          ]}
        >
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
        !last && { borderBottomWidth: 2, borderStyle: 'dashed', borderColor: colors.borderSoft },
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
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={colors.faint} /> : null)}
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
      <ActivityIndicator color={colors.primary} />
      <Text style={typography.caption}>{label}</Text>
    </View>
  );
}
