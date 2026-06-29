import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  ClubChannelRow,
  ClubDirectoryEntry,
  ClubMeetingWithMeta,
  ClubMemberWithUser,
  ClubRole,
} from '../../types';
import {
  AppBackdrop,
  Avatar,
  Chip,
  ClubMark,
  CountBubble,
  ScreenHeader,
  SkeletonCard,
} from '../ui';
import { BORDER_W, ThemeColors, density, fonts, radii, spacing, useTheme } from '../../theme';
import { formatShortDate, formatTime } from '../../utils/format';

/** Map a stored role color name to themed tint + ink colors. */
export function roleAccent(colors: ThemeColors, color?: string | null): { tint: string; ink: string } {
  if (color?.startsWith('#')) {
    return { tint: color, ink: readableInk(color) };
  }
  switch (color) {
    case 'scarlet':
      return { tint: colors.primarySoft, ink: colors.primary };
    case 'blue':
      return { tint: colors.blueSoft, ink: colors.blue };
    case 'green':
      return { tint: colors.greenSoft, ink: colors.green };
    case 'amber':
      return { tint: colors.amberSoft, ink: colors.amber };
    case 'pink':
      return { tint: colors.pinkSoft, ink: colors.pink };
    case 'violet':
      return { tint: colors.violetSoft, ink: colors.violet };
    case 'teal':
      return { tint: colors.tealSoft, ink: colors.teal };
    default:
      return { tint: colors.surfaceAlt, ink: colors.sub };
  }
}

function readableInk(hex: string): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return '#FFFFFF';
  const value = match[1];
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 165 ? '#111827' : '#FFFFFF';
}

export function channelIcon(kind: ClubChannelRow['kind']): keyof typeof Ionicons.glyphMap {
  if (kind === 'ANNOUNCEMENTS') return 'megaphone';
  if (kind === 'OFFICERS') return 'shield-checkmark';
  if (kind === 'CUSTOM') return 'pricetag';
  return 'chatbubble-ellipses';
}

export function channelTint(colors: ThemeColors, kind: ClubChannelRow['kind']): string {
  if (kind === 'ANNOUNCEMENTS') return colors.amberSoft;
  if (kind === 'OFFICERS') return colors.violetSoft;
  if (kind === 'CUSTOM') return colors.tealSoft;
  return colors.blueSoft;
}

/** A chat/announcement channel row with unread badge and last-message preview. */
export function ChannelRow({
  channel,
  onPress,
  fallbackSub,
}: {
  channel: ClubChannelRow;
  onPress: () => void;
  fallbackSub?: string;
}) {
  const { colors, typography } = useTheme();
  const locked =
    channel.kind === 'OFFICERS' ||
    channel.allowedRoleIds.length > 0 ||
    (channel.allowedUserIds?.length ?? 0) > 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${channel.name} channel`}
    >
      <View style={[styles.icon, { backgroundColor: channelTint(colors, channel.kind), borderColor: colors.border }]}>
        <Ionicons name={channelIcon(channel.kind)} size={19} color={colors.ink} />
      </View>
      <View style={styles.grow}>
        <View style={styles.titleLine}>
          <Text style={typography.subheading} numberOfLines={1}>{channel.name}</Text>
          {locked ? <Ionicons name="lock-closed" size={12} color={colors.faint} /> : null}
        </View>
        <Text style={typography.captionSmall} numberOfLines={1}>
          {channel.lastMessagePreview ?? channel.description ?? fallbackSub ?? 'No messages yet'}
        </Text>
      </View>
      {channel.unreadCount > 0 ? <CountBubble count={channel.unreadCount} /> : null}
      <Ionicons name="chevron-forward" size={17} color={colors.faint} />
    </Pressable>
  );
}

export function ClubScreenLoading({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <AppBackdrop>
      <View style={[styles.loading, { paddingTop: insets.top + spacing.md }]}>
        <ScreenHeader title={title} onBack={onBack} />
        <SkeletonCard />
        <SkeletonCard compact />
      </View>
    </AppBackdrop>
  );
}

export function RoleTargetPicker({
  roles,
  selectedRoleIds,
  onChange,
}: {
  roles: ClubRole[];
  selectedRoleIds: string[];
  onChange: (roleIds: string[]) => void;
}) {
  const { typography } = useTheme();
  if (!roles.length) return null;

  return (
    <View style={styles.roleTargets}>
      <Text style={typography.kicker}>TARGET MEMBER TAGS · OPTIONAL</Text>
      <Text style={typography.captionSmall}>
        Leave all tags off to reach everyone allowed by the visibility setting.
      </Text>
      <View style={styles.roleTargetChips}>
        {roles.map((role) => {
          const selected = selectedRoleIds.includes(role.id);
          return (
            <Chip
              key={role.id}
              label={role.name}
              selected={selected}
              onPress={() =>
                onChange(
                  selected
                    ? selectedRoleIds.filter((id) => id !== role.id)
                    : [...selectedRoleIds, role.id],
                )
              }
            />
          );
        })}
      </View>
    </View>
  );
}

export function ClubRow({
  club,
  signal,
  onPress,
  onJoin,
  joining,
}: {
  club: ClubDirectoryEntry;
  signal: string;
  onPress: () => void;
  onJoin?: () => void;
  joining?: boolean;
}) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${club.name}`}
    >
      <ClubMark name={club.name} emoji={club.emoji} uri={club.avatarUrl} size={44} />
      <View style={styles.grow}>
        <View style={styles.titleLine}>
          <Text style={typography.subheading} numberOfLines={1}>{club.name}</Text>
          {club.isVerified ? <Ionicons name="checkmark-circle" size={14} color={colors.success} /> : null}
        </View>
        <Text style={typography.captionSmall} numberOfLines={1}>
          {club.category} · {club.memberCount} member{club.memberCount === 1 ? '' : 's'} · {signal}
        </Text>
      </View>
      {!club.isMember && onJoin ? (
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onJoin();
          }}
          disabled={joining}
          style={[styles.join, { backgroundColor: colors.primary, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={`Join ${club.name}`}
        >
          <Text style={[styles.joinText, { color: colors.onPrimary }]}>
            {joining ? '…' : 'Join'}
          </Text>
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={17} color={colors.faint} />
      )}
    </Pressable>
  );
}

export function DateBadge({ iso }: { iso: string }) {
  const { colors } = useTheme();
  const date = new Date(iso);
  return (
    <View style={[styles.date, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.month, { color: colors.onPrimary, backgroundColor: colors.primary }]}>
        {date.toLocaleDateString([], { month: 'short' }).toUpperCase()}
      </Text>
      <Text style={[styles.day, { color: colors.ink }]}>{date.getDate()}</Text>
    </View>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T | null;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {options.map((option, index) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            style={[
              styles.segmentItem,
              index > 0 && { borderLeftWidth: BORDER_W, borderLeftColor: colors.border },
              selected && { backgroundColor: colors.successSoft },
            ]}
          >
            <Text style={[styles.segmentText, { color: colors.ink }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const RSVP_OPTIONS = [
  { value: 'GOING', label: 'Going' },
  { value: 'MAYBE', label: 'Maybe' },
  { value: 'NOT_GOING', label: "Can't" },
] as const;

export function MeetingCard({
  meeting,
  onPress,
  onRsvp,
  hero,
}: {
  meeting: ClubMeetingWithMeta;
  onPress: () => void;
  onRsvp?: (status: 'GOING' | 'MAYBE' | 'NOT_GOING') => void;
  hero?: boolean;
}) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.meeting,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: hero ? colors.shadow : 'transparent',
        },
        hero && styles.hero,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${meeting.title}`}
    >
      <View style={styles.meetingTop}>
        <DateBadge iso={meeting.meetingTime} />
        <View style={styles.grow}>
          <Text style={[typography.kicker, { color: colors.primary }]} numberOfLines={1}>
            {formatShortDate(meeting.meetingTime)} · {formatTime(meeting.meetingTime)}
          </Text>
          <Text style={typography.heading} numberOfLines={2}>{meeting.title}</Text>
          <Text style={typography.captionSmall} numberOfLines={1}>
            {meeting.location} · {meeting.rsvpCounts.going} going
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.faint} />
      </View>
      {onRsvp ? (
        <SegmentedControl
          value={meeting.myRsvp}
          options={[...RSVP_OPTIONS]}
          onChange={onRsvp}
        />
      ) : null}
    </Pressable>
  );
}

export function SpaceRow({
  icon,
  title,
  sub,
  tint,
  onPress,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  tint: string;
  onPress: () => void;
  badge?: number;
}) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: tint, borderColor: colors.border }]}>
        <Ionicons name={icon} size={19} color={colors.ink} />
      </View>
      <View style={styles.grow}>
        <Text style={typography.subheading}>{title}</Text>
        <Text style={typography.captionSmall} numberOfLines={1}>{sub}</Text>
      </View>
      {badge ? <CountBubble count={badge} /> : null}
      <Ionicons name="chevron-forward" size={17} color={colors.faint} />
    </Pressable>
  );
}

export function MemberRow({
  member,
  onPress,
  action,
}: {
  member: ClubMemberWithUser;
  onPress: () => void;
  action?: () => void;
}) {
  const { colors, typography } = useTheme();
  const tags = member.customRoles?.map((item) => item.role.name).join(', ');
  return (
    <Pressable onPress={onPress} style={styles.member}>
      <Avatar name={member.user.name} uri={member.user.avatarUrl} size={42} />
      <View style={styles.grow}>
        <Text style={typography.subheading} numberOfLines={1}>{member.user.name}</Text>
        <Text style={typography.captionSmall} numberOfLines={1}>
          {member.role !== 'MEMBER' ? member.role : 'Member'}
          {tags ? ` · ${tags}` : ''}
        </Text>
      </View>
      {action ? (
        <Pressable onPress={action} hitSlop={10} accessibilityLabel={`Actions for ${member.user.name}`}>
          <Ionicons name="ellipsis-horizontal" size={19} color={colors.sub} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.faint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: density.regularRow,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: { opacity: 0.65 },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  join: {
    borderWidth: BORDER_W,
    borderRadius: radii.xs,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  joinText: { fontFamily: fonts.bold, fontSize: 12 },
  date: {
    width: 48,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    overflow: 'hidden',
    alignItems: 'center',
  },
  month: {
    width: '100%',
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 9,
    paddingVertical: 2,
  },
  day: { fontFamily: fonts.display, fontSize: 18, paddingVertical: 3 },
  segment: { flexDirection: 'row', borderWidth: BORDER_W, borderRadius: radii.sm, overflow: 'hidden' },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  segmentText: { fontFamily: fonts.bold, fontSize: 11 },
  meeting: { borderWidth: BORDER_W, borderRadius: radii.md, padding: spacing.md, gap: spacing.md },
  hero: { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 3 },
  meetingTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  member: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8 },
  loading: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.lg,
  },
  roleTargets: {
    gap: spacing.sm,
  },
  roleTargetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
