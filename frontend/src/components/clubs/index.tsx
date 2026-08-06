import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  Button,
  Chip,
  ClubMark,
  ContentImage,
  CountBubble,
  IconButton,
  ScreenHeader,
  SkeletonCard,
} from '../ui';
import { resolveAvatarUrl } from '../../api';
import { clubIdentityImageFor } from '../../constants/contentImages';
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
      accessibilityLabel={
        channel.unreadCount > 0
          ? `Open ${channel.name} channel, ${channel.unreadCount} unread ${channel.unreadCount === 1 ? 'message' : 'messages'}`
          : `Open ${channel.name} channel`
      }
    >
      <View style={[styles.icon, { backgroundColor: channelTint(colors, channel.kind), borderColor: colors.border }]}>
        <Ionicons name={channelIcon(channel.kind)} size={19} color={colors.ink} />
      </View>
      <View style={styles.grow}>
        <View style={styles.titleLine}>
          <Text style={[typography.subheading, styles.titleText]} numberOfLines={1}>{channel.name}</Text>
          {locked ? <Ionicons name="lock-closed" size={12} color={colors.sub} /> : null}
        </View>
        <Text style={typography.captionSmall} numberOfLines={1}>
          {channel.lastMessagePreview ?? channel.description ?? fallbackSub ?? 'No messages yet'}
        </Text>
      </View>
      {channel.unreadCount > 0 ? <CountBubble count={channel.unreadCount} /> : null}
      <Ionicons name="chevron-forward" size={17} color={colors.sub} />
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
  /** Optional meeting hint ("tonight 7:00 PM"). Row omits it when null. */
  signal: string | null;
  onPress: () => void;
  onJoin?: () => void;
  joining?: boolean;
}) {
  const { colors, typography } = useTheme();
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${club.name}`}
        style={({ pressed }) => [styles.rowIdentity, pressed && styles.pressed]}
      >
        <ClubMark name={club.name} emoji={club.emoji} uri={club.avatarUrl} size={44} />
        <View style={styles.grow}>
          <View style={styles.titleLine}>
            <Text style={[typography.subheading, styles.titleText]} numberOfLines={1}>{club.name}</Text>
            {club.isVerified ? <Ionicons name="checkmark-circle" size={14} color={colors.success} /> : null}
          </View>
          <Text style={typography.captionSmall} numberOfLines={1}>
            {club.category} · {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
            {signal ? ` · ${signal}` : ''}
          </Text>
        </View>
      </Pressable>
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
        <Ionicons name="chevron-forward" size={17} color={colors.sub} />
      )}
    </View>
  );
}

/**
 * Photo-first club identity used on discovery and meeting surfaces.
 * Uploaded club art wins; otherwise the stable category editorial image keeps
 * sparse directories visual without inventing members or social proof.
 */
export function ClubPhoto({
  name,
  category,
  uri,
  size = 44,
}: {
  name: string;
  category?: string | null;
  uri?: string | null;
  size?: number;
}) {
  const resolved = resolveAvatarUrl(uri);
  return (
    <ContentImage
      source={resolved ? { uri: resolved } : clubIdentityImageFor({ name, category })}
      seed={name}
      aspectRatio={1}
      accessibilityLabel={`${name} club photo`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.24) }}
    />
  );
}

/**
 * Shared photo-first identity header for every in-club home surface. Uploaded
 * cover art wins; otherwise curated club-identity or category editorial art is
 * used behind the club mark rather than stretching a square avatar.
 */
export function ClubIdentityHero({
  club,
  role,
  onBack,
  onActions,
  onRolePress,
  topInset = 0,
  squareBottom = false,
}: {
  club: {
    name: string;
    category: string;
    emoji: string;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    isVerified: boolean;
    members: readonly unknown[];
  };
  role?: string | null;
  onBack: () => void;
  onActions: () => void;
  onRolePress?: () => void;
  topInset?: number;
  squareBottom?: boolean;
}) {
  const { colors, typography } = useTheme();
  const roleLabel =
    role === 'OWNER'
      ? 'Owner'
      : role === 'ADMIN'
        ? 'Admin'
        : role === 'OFFICER'
          ? 'Officer'
          : role === 'MEMBER'
            ? 'Member'
            : 'Community';

  return (
    <ContentImage
      source={
        club.coverUrl
          ? { uri: resolveAvatarUrl(club.coverUrl) ?? club.coverUrl }
          : clubIdentityImageFor(club)
      }
      seed={`${club.name}-hero`}
      aspectRatio={1.42}
      accessibilityLabel={
        club.coverUrl ? `${club.name} cover photo` : `${club.name} editorial artwork`
      }
      style={[
        styles.clubHero,
        topInset > 0 && styles.clubHeroFlush,
        squareBottom && styles.clubHeroSquareBottom,
      ]}
    >
      <LinearGradient
        colors={['rgba(8,10,15,0.10)', 'rgba(8,10,15,0.32)', 'rgba(8,10,15,0.92)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[styles.heroChrome, { top: topInset + spacing.md }]}>
        <IconButton
          icon="arrow-back"
          color="rgba(8,10,15,0.38)"
          iconColor="#FFFFFF"
          accessibilityLabel="Go back"
          onPress={onBack}
        />
        <IconButton
          icon="ellipsis-horizontal"
          color="rgba(8,10,15,0.38)"
          iconColor="#FFFFFF"
          accessibilityLabel="Club actions"
          onPress={onActions}
        />
      </View>
      <View style={styles.heroIdentity}>
        <ClubMark
          name={club.name}
          emoji={club.emoji}
          uri={club.avatarUrl}
          size={72}
          style={styles.heroMark}
        />
        <View style={styles.heroIdentityCopy}>
          <View style={styles.titleLine}>
            <Text style={[typography.display, styles.heroTitle]} numberOfLines={2}>
              {club.name}
            </Text>
            {club.isVerified ? (
              <Ionicons name="checkmark-circle" size={18} color="#77DCA4" />
            ) : null}
          </View>
          <Text style={[typography.caption, styles.heroMeta]}>
            {club.category} · {club.members.length} member
            {club.members.length === 1 ? '' : 's'}
          </Text>
          <Pressable
            onPress={onRolePress}
            disabled={!onRolePress}
            accessibilityRole={onRolePress ? 'button' : undefined}
            accessibilityLabel={onRolePress ? `Manage ${roleLabel} role` : undefined}
            style={({ pressed }) => [
              styles.rolePill,
              { backgroundColor: colors.surface },
              pressed && { opacity: 0.72 },
            ]}
          >
            <View style={[styles.roleDot, { backgroundColor: colors.success }]} />
            <Text style={[typography.captionSmall, { color: colors.ink }]}>{roleLabel}</Text>
            {onRolePress ? (
              <Ionicons name="chevron-down" size={13} color={colors.sub} />
            ) : null}
          </Pressable>
        </View>
      </View>
    </ContentImage>
  );
}

const CLUB_EMPTY_ART = {
  calendar: require('../../../assets/illustrations/clubs/events-empty.png'),
  chat: require('../../../assets/illustrations/clubs/chat-empty.png'),
  people: require('../../../assets/illustrations/clubs/member-search-empty.png'),
  applications: require('../../../assets/illustrations/clubs/applications-empty.png'),
  private: require('../../../assets/illustrations/clubs/private-space.png'),
  recovery: require('../../../assets/illustrations/clubs/recovery.png'),
} as const;

const CLUB_EMPTY_ICONS: Record<
  keyof typeof CLUB_EMPTY_ART,
  keyof typeof Ionicons.glyphMap
> = {
  calendar: 'calendar-outline',
  chat: 'chatbubbles-outline',
  people: 'people-outline',
  applications: 'document-text-outline',
  private: 'lock-closed-outline',
  recovery: 'refresh-outline',
};

/**
 * One empty/restricted/recovery language across all club screens. Full states
 * use approved editorial artwork; compact states use the same hierarchy
 * without consuming an entire feed.
 */
export function ClubEmptyState({
  variant,
  title,
  body,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact = false,
}: {
  variant: keyof typeof CLUB_EMPTY_ART;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  compact?: boolean;
}) {
  const { colors, typography } = useTheme();
  return (
    <View
      style={[
        styles.clubEmpty,
        compact && styles.clubEmptyCompact,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {compact ? (
        <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons
            name={CLUB_EMPTY_ICONS[variant]}
            size={25}
            color={colors.accentText}
          />
        </View>
      ) : (
        <ContentImage
          source={CLUB_EMPTY_ART[variant]}
          seed={`${variant}-${title}`}
          aspectRatio={16 / 9}
          accessibilityLabel={undefined}
          style={styles.emptyArtwork}
        />
      )}
      <Text style={[compact ? typography.title : typography.display, styles.emptyTitle]}>
        {title}
      </Text>
      <Text style={[typography.caption, styles.emptyBody]}>{body}</Text>
      <View style={styles.emptyActions}>
        <Button label={actionLabel} onPress={onAction} style={styles.emptyAction} />
        {secondaryLabel && onSecondary ? (
          <Button
            label={secondaryLabel}
            variant="secondary"
            onPress={onSecondary}
            style={styles.emptyAction}
          />
        ) : null}
      </View>
    </View>
  );
}

export function DateBadge({ iso }: { iso: string }) {
  const { colors } = useTheme();
  const date = new Date(iso);
  return (
    <View
      accessible
      accessibilityLabel={date.toLocaleDateString([], { month: 'long', day: 'numeric' })}
      style={[styles.date, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
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
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, disabled: Boolean(disabled) }}
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
    <View
      style={[
        styles.meeting,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: hero ? colors.shadow : 'transparent',
        },
        hero && styles.hero,
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${meeting.title}`}
        style={({ pressed }) => [styles.meetingTop, pressed && styles.pressed]}
      >
        <DateBadge iso={meeting.meetingTime} />
        <View style={styles.grow}>
          <Text style={[typography.kicker, { color: colors.accentText }]} numberOfLines={1}>
            {formatShortDate(meeting.meetingTime)} · {formatTime(meeting.meetingTime)}
          </Text>
          <Text style={typography.heading} numberOfLines={2}>{meeting.title}</Text>
          <Text style={typography.captionSmall} numberOfLines={1}>
            {meeting.location} · {meeting.rsvpCounts.going} going
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.sub} />
      </Pressable>
      {onRsvp ? (
        <SegmentedControl
          value={meeting.myRsvp}
          options={[...RSVP_OPTIONS]}
          onChange={onRsvp}
        />
      ) : null}
    </View>
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
      accessibilityRole="button"
      accessibilityLabel={badge ? `${title}, ${badge} new` : title}
      accessibilityHint={sub}
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
      <Ionicons name="chevron-forward" size={17} color={colors.sub} />
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
    <View style={styles.member}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${member.user.name}'s profile`}
        style={styles.memberIdentity}
      >
        <Avatar name={member.user.name} uri={member.user.avatarUrl} size={42} />
        <View style={styles.grow}>
          <Text style={typography.subheading} numberOfLines={1}>{member.user.name}</Text>
          <Text style={typography.captionSmall} numberOfLines={1}>
            {member.role !== 'MEMBER' ? member.role : 'Member'}
            {tags ? ` · ${tags}` : ''}
          </Text>
        </View>
      </Pressable>
      {action ? (
        <Pressable
          onPress={action}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${member.user.name}`}
        >
          <Ionicons name="ellipsis-horizontal" size={19} color={colors.sub} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.sub} />
      )}
    </View>
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
  rowIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: { opacity: 0.65 },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  // Lets long titles truncate instead of pushing trailing icons out of the row.
  titleText: { flexShrink: 1 },
  join: {
    borderWidth: BORDER_W,
    borderRadius: radii.xs,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 44,
    justifyContent: 'center',
    flexShrink: 0,
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
  segmentItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
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
  memberIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  clubHero: {
    borderRadius: radii.xl,
    borderWidth: 0,
  },
  clubHeroFlush: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  clubHeroSquareBottom: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  heroChrome: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroIdentity: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  heroMark: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  heroIdentityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  heroTitle: {
    color: '#FFFFFF',
    flexShrink: 1,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.84)',
  },
  rolePill: {
    minHeight: 30,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  roleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  clubEmpty: {
    borderWidth: BORDER_W,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  clubEmptyCompact: {
    paddingVertical: spacing.lg,
  },
  emptyArtwork: {
    width: '100%',
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyActions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  emptyAction: {
    width: '100%',
  },
});
