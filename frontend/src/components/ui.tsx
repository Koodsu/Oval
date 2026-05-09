import React from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.flex}
          >
            <View style={[styles.screen, !padded && { paddingHorizontal: 0 }]}>{children}</View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
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
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color={palette.ink} />
          </TouchableOpacity>
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

export function SectionHeader({
  title,
  actionLabel,
  onActionPress,
}: {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
}) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onActionPress ? (
        <TouchableOpacity onPress={onActionPress}>
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
  return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
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
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  kind?: 'solid' | 'ghost';
}) {
  const isGhost = kind === 'ghost';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        isGhost ? styles.buttonGhost : styles.buttonSolid,
        (disabled || loading) && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? palette.ink : palette.white} />
      ) : (
        <Text style={[styles.buttonLabel, isGhost && styles.buttonGhostLabel]}>{label}</Text>
      )}
    </TouchableOpacity>
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
