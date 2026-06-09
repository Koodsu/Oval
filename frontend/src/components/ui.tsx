import React from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { resolveAvatarUrl } from '../api';
import { getInitials } from '../utils/format';
import { gradients, palette, radii, shadows, spacing, typography } from '../theme';

export function AppBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.flex}>
      <LinearGradient colors={gradients.app} style={StyleSheet.absoluteFill} />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
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
    <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
      <AppBackdrop>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <View style={[styles.screen, !padded && { paddingHorizontal: 0 }]}>{children}</View>
        </KeyboardAvoidingView>
      </AppBackdrop>
    </SafeAreaView>
  );
}

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
  return (
    <LinearGradient colors={gradients.heroSoft} style={styles.hero}>
      {eyebrow ? <Text style={styles.heroEyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.heroTitle}>{title}</Text>
      {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
      {children}
    </LinearGradient>
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
            <Ionicons name="chevron-back" size={20} color={palette.ink} />
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

export function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

type SectionHeaderProps = {
  title: string;
} & (
  | { actionLabel?: undefined; onActionPress?: undefined }
  | { actionLabel: string | undefined; onActionPress: () => void }
);

export function SectionHeader({
  title,
  actionLabel,
  onActionPress,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onActionPress ? (
        <TouchableOpacity
          onPress={onActionPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
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
  return (
    <Panel style={styles.statTile}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={palette.scarlet} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Panel>
  );
}

export function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {content}
    </TouchableOpacity>
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
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(option.value)}
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
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={18} color={palette.slate} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.slate}
        style={styles.searchInput}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        clearButtonMode="while-editing"
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
  tooltip,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  kind?: 'solid' | 'ghost';
  tooltip?: string;
}) {
  const isGhost = kind === 'ghost';
  const button = (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        isGhost ? styles.buttonGhost : styles.buttonSolid,
        (disabled || loading) && styles.buttonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={tooltip}
    >
      {loading ? (
        <SkeletonBlock
          width={Math.max(44, Math.min(120, label.length * 8))}
          height={16}
          radius={8}
          color={isGhost ? 'rgba(16,33,43,0.16)' : 'rgba(255,255,255,0.36)'}
        />
      ) : (
        <Text style={[styles.buttonLabel, isGhost && styles.buttonGhostLabel]}>{label}</Text>
      )}
    </TouchableOpacity>
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
  return (
    <Tooltip label={tooltip}>
      <TouchableOpacity
        style={[styles.iconButton, { width: size, height: size, borderRadius: size / 2 }, style]}
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={tooltip}
        accessibilityHint={tooltip}
      >
        <Ionicons name={icon} size={iconSize} color={palette.ink} />
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
  const [visible, setVisible] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), 1600);
  }, []);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

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

export function SkeletonBlock({
  width = '100%',
  height,
  radius = radii.md,
  color = 'rgba(16, 33, 43, 0.09)',
  style,
}: {
  width?: ViewStyle['width'];
  height: number;
  radius?: number;
  color?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        styles.skeletonBlock,
        { width, height, borderRadius: radius, backgroundColor: color },
        style,
      ]}
    />
  );
}

export function SkeletonLine({ width = '100%' }: { width?: ViewStyle['width'] }) {
  return <SkeletonBlock width={width} height={12} radius={6} />;
}

export function SkeletonCard({ compact = false }: { compact?: boolean }) {
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

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <Panel style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={20} color={palette.scarlet} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </Panel>
  );
}

export function UserAvatar({
  name,
  avatarUrl,
  size = 42,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const uri = resolveAvatarUrl(avatarUrl);
  return uri ? (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: palette.mist,
      }}
    >
      <Image source={{ uri }} style={{ width: size, height: size }} />
    </View>
  ) : (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  tooltipAnchor: {
    position: 'relative',
  },
  tooltipBubble: {
    position: 'absolute',
    right: 0,
    bottom: '100%',
    marginBottom: 8,
    maxWidth: 220,
    borderRadius: radii.sm,
    backgroundColor: palette.ink,
    paddingHorizontal: 10,
    paddingVertical: 7,
    zIndex: 50,
  },
  tooltipText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  skeletonBlock: {
    overflow: 'hidden',
  },
  skeletonCard: {
    gap: spacing.sm,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  skeletonTextStack: {
    flex: 1,
    gap: 8,
  },
  glowTop: {
    position: 'absolute',
    top: 60,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(242, 122, 84, 0.15)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: 80,
    left: -20,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(94, 143, 203, 0.14)',
  },
  hero: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    ...shadows.card,
  },
  heroEyebrow: {
    ...typography.label,
    color: palette.slate,
  },
  heroTitle: {
    ...typography.h1,
  },
  heroSubtitle: {
    ...typography.body,
    color: palette.slate,
  },
  compactHeader: {
    gap: spacing.xs,
    paddingHorizontal: 2,
  },
  compactEyebrow: {
    ...typography.label,
    color: palette.slate,
  },
  compactTitle: {
    ...typography.h1,
  },
  compactSubtitle: {
    ...typography.body,
    maxWidth: '92%',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    marginBottom: spacing.md,
  },
  screenHeaderSide: {
    width: 52,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  screenHeaderRight: {
    alignItems: 'flex-end',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  screenHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    ...typography.title,
  },
  panel: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    ...shadows.card,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h2,
    fontSize: 20,
  },
  sectionAction: {
    ...typography.bodyStrong,
    color: palette.scarlet,
  },
  statTile: {
    minWidth: 110,
    gap: spacing.xs,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.dangerBg,
  },
  statValue: {
    ...typography.h2,
    fontSize: 22,
  },
  statLabel: {
    ...typography.body,
    fontSize: 13,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: palette.border,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  chipLabel: {
    ...typography.bodyStrong,
    fontSize: 13,
  },
  chipLabelActive: {
    color: palette.white,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: radii.pill,
    padding: 4,
    gap: 6,
  },
  segment: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: palette.ink,
  },
  segmentLabel: {
    ...typography.bodyStrong,
    fontSize: 13,
  },
  segmentLabelActive: {
    color: palette.white,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    ...typography.bodyStrong,
    color: palette.ink,
  },
  button: {
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSolid: {
    backgroundColor: palette.scarlet,
  },
  buttonGhost: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    ...typography.bodyStrong,
    color: palette.white,
  },
  buttonGhostLabel: {
    color: palette.ink,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.dangerBg,
  },
  emptyTitle: {
    ...typography.title,
  },
  emptyBody: {
    ...typography.body,
    textAlign: 'center',
  },
  avatarFallback: {
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.white,
    fontWeight: '700',
  },
});
