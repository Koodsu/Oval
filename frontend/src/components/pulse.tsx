import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Activity, Pod } from '../types';
import { activityImageFor } from '../constants/contentImages';
import { CATEGORY_META } from '../constants/categories';
import { BORDER_W, fonts, radii, spacing, useTheme } from '../theme';
import { getPodTitle } from '../utils/experience';
import {
  AvatarStack,
  Button,
  Card,
  ContentImage,
  ProgressBar,
  Slab,
  accentForSeed,
} from './ui';

const CAMPUS_TIME_ZONE = 'America/New_York';

export function activityIcon(activity?: Pick<Activity, 'category'> | null) {
  return activity ? (CATEGORY_META[activity.category]?.icon ?? 'sparkles-outline') : 'sparkles-outline';
}

export function podDayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CAMPUS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateKey = formatter.format(date);
  const todayKey = formatter.format(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowKey = formatter.format(tomorrow);
  if (dateKey === todayKey) return 'Today';
  if (dateKey === tomorrowKey) return 'Tomorrow';
  return date.toLocaleDateString('en-US', {
    timeZone: CAMPUS_TIME_ZONE,
    weekday: 'short',
  });
}

export function podTimeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: CAMPUS_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  });
}

function friendMembers(pod: Pod, friendIds: Set<string>) {
  return pod.members.filter((member) => friendIds.has(member.userId));
}

export function PodDiscoveryRow({
  pod,
  friendIds,
  onOpen,
  onJoin,
  joining,
  style,
}: {
  pod: Pod;
  friendIds: Set<string>;
  onOpen: () => void;
  onJoin?: () => void;
  joining?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, typography } = useTheme();
  const friends = friendMembers(pod, friendIds);
  const spotsLeft = Math.max(0, pod.maxMembers - pod.members.length);
  const title = getPodTitle(pod);

  return (
    <Slab
      raised={false}
      faceStyle={pulseStyles.podRow}
      style={style}
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${podDayLabel(pod.meetupTime)} at ${podTimeLabel(pod.meetupTime)}`}
        style={({ pressed }) => [pulseStyles.podOpen, pressed && { opacity: 0.7 }]}
      >
        <ContentImage
          source={activityImageFor(pod.activity)}
          seed={pod.activity?.id ?? pod.activityId}
          aspectRatio={1}
          style={pulseStyles.podThumb}
        />
        <View style={pulseStyles.podCopy}>
          <Text style={[typography.heading, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
          <Text style={[typography.captionSmall, { color: colors.sub }]} numberOfLines={1}>
            {podDayLabel(pod.meetupTime)} · {podTimeLabel(pod.meetupTime)}
          </Text>
          <Text style={[typography.captionSmall, { color: colors.sub }]} numberOfLines={1}>
            {pod.location} · {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
          </Text>
          <Text style={[typography.captionSmall, { color: friends.length ? colors.success : colors.sub }]} numberOfLines={1}>
            {friends.length
              ? `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'} going`
              : `${pod.members.length} going`}
          </Text>
        </View>
      </Pressable>
      {onJoin ? (
        <Button
          label={joining ? 'Joining…' : 'Join'}
          onPress={onJoin}
          disabled={joining}
          size="sm"
        />
      ) : (
        <Ionicons name="chevron-forward" size={17} color={colors.sub} />
      )}
    </Slab>
  );
}

export function PodDiscoveryHero({
  pod,
  friendIds,
  eyebrow,
  onOpen,
  onPrimary,
  primaryLabel,
  primaryLoading,
}: {
  pod: Pod;
  friendIds: Set<string>;
  eyebrow: string;
  onOpen: () => void;
  onPrimary: () => void;
  primaryLabel: string;
  primaryLoading?: boolean;
}) {
  const { colors, typography } = useTheme();
  const friends = friendMembers(pod, friendIds);
  const spotsLeft = Math.max(0, pod.maxMembers - pod.members.length);
  const title = getPodTitle(pod);

  return (
    <Card padded={false} faceStyle={pulseStyles.hero}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
      >
        <ContentImage
          source={activityImageFor(pod.activity)}
          seed={pod.activity?.id ?? pod.activityId}
          aspectRatio={16 / 7}
          style={pulseStyles.heroMedia}
        />
      </Pressable>
      <View style={pulseStyles.heroCopy}>
        <Text style={[typography.kicker, { color: colors.accentText }]}>{eyebrow}</Text>
        <Text style={[typography.display, { color: colors.ink }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[typography.body, { color: colors.sub }]} numberOfLines={2}>
          {podDayLabel(pod.meetupTime)} · {podTimeLabel(pod.meetupTime)} · {pod.location}
        </Text>
        <View style={pulseStyles.heroMeta}>
          <View style={{ flex: 1, gap: spacing.sm }}>
            <View style={pulseStyles.socialLine}>
              <AvatarStack
                names={pod.members.slice(0, 4).map((member) => ({
                  name: member.user.name,
                  uri: member.user.avatarUrl,
                }))}
                overflowCount={Math.max(0, pod.members.length - 4)}
                size={24}
              />
              <Text style={[typography.captionSmall, { color: colors.sub }]} numberOfLines={1}>
                {friends.length
                  ? `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'} going`
                  : `${pod.members.length} going`}
              </Text>
            </View>
            <ProgressBar value={pod.members.length / Math.max(1, pod.maxMembers)} height={5} />
          </View>
          <Button
            label={primaryLoading ? 'Joining…' : primaryLabel}
            onPress={onPrimary}
            disabled={primaryLoading}
            size="sm"
          />
        </View>
        <Text style={[typography.captionSmall, { color: colors.accentText }]}>
          {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
        </Text>
      </View>
    </Card>
  );
}

export function MetricStrip({
  metrics,
}: {
  metrics: Array<{
    value: number | string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }>;
}) {
  const { colors, typography } = useTheme();
  return (
    <Card faceStyle={pulseStyles.metrics}>
      {metrics.map((metric, index) => (
        <React.Fragment key={metric.label}>
          {index ? <View style={[pulseStyles.metricDivider, { backgroundColor: colors.border }]} /> : null}
          <View style={pulseStyles.metric}>
            <Ionicons
              name={metric.icon}
              size={16}
              color={index === 0 ? colors.accentText : colors.ink}
            />
            <Text style={[pulseStyles.metricValue, { color: colors.ink }]}>{metric.value}</Text>
            <Text style={[typography.captionSmall, pulseStyles.metricLabel]}>{metric.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </Card>
  );
}

export function PulseActionRow({
  icon,
  title,
  body,
  onPress,
  tint,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress: () => void;
  tint?: string;
  right?: React.ReactNode;
}) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        pulseStyles.action,
        {
          backgroundColor: tint ?? colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[pulseStyles.actionIcon, { backgroundColor: colors.surface }]}>
        <Ionicons name={icon} size={20} color={colors.accentText} />
      </View>
      <View style={pulseStyles.actionCopy}>
        <Text style={[typography.subheading, { color: colors.ink }]}>{title}</Text>
        <Text style={[typography.captionSmall, { color: colors.sub }]} numberOfLines={2}>
          {body}
        </Text>
      </View>
      {right ?? <Ionicons name="chevron-forward" size={17} color={colors.sub} />}
    </Pressable>
  );
}

export function ActivityStartTile({
  activity,
  onPress,
  actionLabel = 'Start one',
  style,
}: {
  activity: Activity;
  onPress: () => void;
  actionLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, typography } = useTheme();
  const accent = accentForSeed(colors, activity.id);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${actionLabel}: ${activity.title}`}
      style={({ pressed }) => [
        pulseStyles.activityTile,
        {
          backgroundColor: accent.soft,
          borderColor: colors.border,
          opacity: pressed ? 0.72 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={activityIcon(activity)} size={30} color={accent.tint} />
      <Text style={[typography.subheading, pulseStyles.activityTitle]} numberOfLines={2}>
        {activity.title}
      </Text>
      <View style={[pulseStyles.activityAction, { backgroundColor: colors.surface }]}>
        <Text style={[typography.captionSmall, { color: colors.ink }]}>{actionLabel}</Text>
      </View>
    </Pressable>
  );
}

const pulseStyles = StyleSheet.create({
  podRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
  },
  podOpen: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  podThumb: {
    width: 58,
    height: 58,
    borderRadius: radii.sm,
  },
  podCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  socialLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  hero: {
    overflow: 'hidden',
  },
  heroMedia: {
    borderWidth: 0,
    borderBottomWidth: BORDER_W,
    borderRadius: 0,
    height: 150,
  },
  heroCopy: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  metrics: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
  },
  metricValue: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 18,
  },
  metricLabel: {
    textAlign: 'center',
  },
  action: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  activityTile: {
    flex: 1,
    minWidth: 138,
    minHeight: 142,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  activityTitle: {
    minHeight: 38,
  },
  activityAction: {
    marginTop: 'auto',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
});
