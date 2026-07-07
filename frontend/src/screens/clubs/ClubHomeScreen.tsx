import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  API_USER_MESSAGE,
  createReport,
  getClubShareUrl,
  joinClub,
  leaveClub,
  rsvpClubMeeting,
  selfAssignClubRole,
  selfUnassignClubRole,
} from '../../api';
import type { RootStackParamList } from '../../../App';
import {
  AppBackdrop,
  Avatar,
  Button,
  Card,
  Chip,
  ClubMark,
  EmptyState,
  IconButton,
  ListRow,
  ScreenHeader,
  Segmented,
  Sheet,
  SkeletonCard,
  Slab,
} from '../../components/ui';
import { MeetingCard, MemberRow, roleAccent } from '../../components/clubs';
import ClubVerifyPrompt from './ClubVerifyPrompt';
import { useClub, roleRank } from '../../hooks/useClub';
import { useAuth } from '../../context/AuthContext';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  fonts,
  radii,
  spacing,
  useTheme,
} from '../../theme';
import { formatShortDate } from '../../utils/format';

import { toast } from '../../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'ClubDetail'>;

type ClubTab = 'pulse' | 'events' | 'people' | 'about';

export default function ClubHomeScreen({ route, navigation }: Props) {
  const { clubId, justCreated } = route.params;
  const {
    club,
    meetings,
    announcements,
    channels,
    loading,
    error,
    isLeader,
    can,
    refresh,
    setMeetings,
  } = useClub(clubId);
  const { user } = useAuth();
  const { colors, typography } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [tab, setTab] = useState<ClubTab>('pulse');
  const [verifyOpen, setVerifyOpen] = useState(Boolean(justCreated));
  const nextMeeting = meetings[0] ?? null;

  const myMember = useMemo(
    () => club?.members.find((member) => member.userId === user?.id) ?? null,
    [club?.members, user?.id],
  );
  const myRoleIds = useMemo(
    () => new Set((myMember?.customRoles ?? []).map((assignment) => assignment.roleId)),
    [myMember?.customRoles],
  );
  const selfAssignableRoles = useMemo(
    () => (club?.roles ?? []).filter((role) => role.isSelfAssignable),
    [club?.roles],
  );
  const totalUnread = useMemo(
    () => channels.reduce((sum, channel) => sum + channel.unreadCount, 0),
    [channels],
  );

  const handleMembership = async () => {
    if (!club) return;
    setMembershipBusy(true);
    try {
      if (club.isMember) {
        await leaveClub(club.id);
      } else {
        await joinClub(club.id);
      }
      await refresh();
    } catch {
      toast.error('Could not update membership', API_USER_MESSAGE);
    } finally {
      setMembershipBusy(false);
    }
  };

  const handleRsvp = async (status: 'GOING' | 'MAYBE' | 'NOT_GOING') => {
    if (!nextMeeting) return;
    const previous = nextMeeting.myRsvp;
    setMeetings((current) =>
      current.map((meeting) => meeting.id === nextMeeting.id ? { ...meeting, myRsvp: status } : meeting),
    );
    try {
      await rsvpClubMeeting(nextMeeting.id, status);
      await refresh();
    } catch {
      setMeetings((current) =>
        current.map((meeting) => meeting.id === nextMeeting.id ? { ...meeting, myRsvp: previous } : meeting),
      );
      toast.error('Could not RSVP', API_USER_MESSAGE);
    }
  };

  const toggleSelfRole = async (roleId: string, hasRole: boolean) => {
    setRoleBusyId(roleId);
    try {
      if (hasRole) {
        await selfUnassignClubRole(clubId, roleId);
      } else {
        await selfAssignClubRole(clubId, roleId);
      }
      await refresh();
    } catch {
      toast.error('Could not update role', API_USER_MESSAGE);
    } finally {
      setRoleBusyId(null);
    }
  };

  const openChannel = (channelId: string) =>
    navigation.navigate('ClubChat', { clubId, channelId });

  if (loading && !club) {
    return (
      <AppBackdrop>
        <View style={[styles.content, { paddingTop: insets.top + spacing.md }]}>
          <SkeletonCard />
          <SkeletonCard compact />
          <SkeletonCard compact />
        </View>
      </AppBackdrop>
    );
  }

  if (!club) {
    return (
      <AppBackdrop>
        <View style={[styles.content, { paddingTop: insets.top + spacing.md }]}>
          <ScreenHeader title="Club" onBack={() => navigation.goBack()} />
          <EmptyState
            icon="alert-circle"
            title="Could not load club"
            body={error ?? 'Try again.'}
            actionLabel="Try again"
            onAction={() => void refresh()}
          />
        </View>
      </AppBackdrop>
    );
  }

  const latestAnnouncement = announcements[0] ?? null;
  const generalChannel =
    channels.find((channel) => channel.kind === 'GENERAL') ??
    channels.find((channel) => club.isMember || channel.kind === 'ANNOUNCEMENTS') ??
    null;

  const primaryAction: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void } =
    !club.isMember
      ? club.joinPolicy === 'APPLICATION'
        ? {
            label: 'Apply to join',
            icon: 'document-text-outline',
            onPress: () => navigation.navigate('ClubApply', { clubId }),
          }
        : { label: 'Join club', icon: 'add', onPress: () => void handleMembership() }
      : nextMeeting && nextMeeting.myRsvp === 'GOING'
        ? {
            label: `RSVP'd · ${nextMeeting.title}`,
            icon: 'checkmark-circle',
            onPress: () => navigation.navigate('ClubMeeting', { clubId, meetingId: nextMeeting.id }),
          }
        : nextMeeting && nextMeeting.myRsvp
          ? {
              label: `RSVP'd ${nextMeeting.myRsvp === 'MAYBE' ? 'maybe' : "can't"} · ${nextMeeting.title}`,
              icon: 'calendar',
              onPress: () => navigation.navigate('ClubMeeting', { clubId, meetingId: nextMeeting.id }),
            }
          : nextMeeting
            ? {
                label: `RSVP · ${nextMeeting.title}`,
                icon: 'calendar',
                onPress: () => void handleRsvp('GOING'),
              }
            : {
                label: 'Share club',
                icon: 'share-outline',
                onPress: () =>
                  void Share.share({ message: `${club.name}\n${getClubShareUrl(club.id)}` }),
              };

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 96 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cover + identity ── */}
        <View style={[styles.coverWrap, { marginTop: -(insets.top + spacing.md) }]}>
          <View style={[styles.cover, { paddingTop: insets.top + spacing.xs }]}>
            <View style={styles.coverChrome}>
              <IconButton
                icon="arrow-back"
                accessibilityLabel="Go back"
                onPress={() => navigation.goBack()}
              />
              <IconButton
                icon="ellipsis-horizontal"
                accessibilityLabel="Club actions"
                onPress={() => setActionsOpen(true)}
              />
            </View>
          </View>
          <View style={styles.identity}>
            <ClubMark
              name={club.name}
              emoji={club.emoji}
              uri={club.avatarUrl}
              size={64}
              style={[styles.mark, { borderColor: colors.bg }]}
            />
            <View style={styles.identityText}>
              <View style={styles.nameLine}>
                <Text style={styles.clubName} numberOfLines={1}>
                  {club.name}
                </Text>
                {club.isVerified ? (
                  <Ionicons name="checkmark-circle" size={17} color={colors.accentText} />
                ) : null}
              </View>
              <Text style={typography.caption} numberOfLines={1}>
                {club.category} · {club.members.length} member{club.members.length === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── In-page tabs ── */}
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pulse', label: 'Pulse' },
            { value: 'events', label: 'Events' },
            { value: 'people', label: 'People' },
            { value: 'about', label: 'About' },
          ]}
        />

        {tab === 'pulse' ? (
          <>
        {/* ── Home feed: what's happening now ── */}
        {latestAnnouncement ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={typography.title}>Latest</Text>
              <Text
                style={[styles.link, { color: colors.accentText }]}
                onPress={() => {
                  const announcementsChannel = channels.find((channel) => channel.kind === 'ANNOUNCEMENTS');
                  if (announcementsChannel) openChannel(announcementsChannel.id);
                }}
              >
                All announcements
              </Text>
            </View>
            <Card padded style={{ borderColor: colors.primary }}>
              <View style={styles.pinnedHead}>
                <Ionicons name="megaphone" size={14} color={colors.accentText} />
                <Text style={[typography.kicker, { color: colors.accentText }]}>
                  {latestAnnouncement.user.name.toUpperCase()} · {formatShortDate(latestAnnouncement.createdAt).toUpperCase()}
                </Text>
              </View>
              <Text style={[typography.body, { marginTop: spacing.xs }]} numberOfLines={4}>
                {latestAnnouncement.content}
              </Text>
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={typography.title}>Next meeting</Text>
            <Text
              style={[styles.link, { color: colors.accentText }]}
              onPress={() => navigation.navigate('ClubEvents', { clubId })}
            >
              All events
            </Text>
          </View>
          {nextMeeting ? (
            <MeetingCard
              meeting={nextMeeting}
              hero
              onPress={() =>
                navigation.navigate('ClubMeeting', { clubId, meetingId: nextMeeting.id })
              }
              onRsvp={club.isMember ? (status) => void handleRsvp(status) : undefined}
            />
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="No upcoming meetings"
              body={can('CREATE_MEETINGS') ? 'Put the next club gathering on the calendar.' : 'New events will appear here.'}
              actionLabel={can('CREATE_MEETINGS') ? 'Create meeting' : 'View calendar'}
              onAction={() =>
                navigation.navigate('ClubEvents', {
                  clubId,
                  startCreate: can('CREATE_MEETINGS'),
                })
              }
            />
          )}
        </View>

        {/* Chat highlight */}
        {generalChannel ? (
          <Slab
            onPress={() => openChannel(generalChannel.id)}
            faceStyle={{ padding: spacing.lg }}
            accessibilityLabel={`Open ${generalChannel.name}`}
          >
            <View style={styles.pinnedHead}>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.sub} />
              <Text style={typography.kicker}>
                {generalChannel.name}
                {generalChannel.unreadCount ? ` · ${generalChannel.unreadCount} new` : ''}
              </Text>
            </View>
            <Text
              style={[typography.body, { color: colors.sub, marginTop: spacing.xs }]}
              numberOfLines={2}
            >
              {club.isMember
                ? 'Catch up on the latest from the club chat.'
                : 'Join the club to jump into the conversation.'}
            </Text>
            <View style={styles.jumpRow}>
              <Text style={[styles.link, { color: colors.accentText }]}>Jump in →</Text>
            </View>
          </Slab>
        ) : null}

        {/* Member activity */}
        <View style={styles.activityRow}>
          <View style={[styles.activityDot, { backgroundColor: colors.success }]} />
          <Text style={typography.caption}>
            {club.members.length} member{club.members.length === 1 ? '' : 's'} · {meetings.length}{' '}
            upcoming event{meetings.length === 1 ? '' : 's'}
          </Text>
        </View>
          </>
        ) : null}

        {tab === 'events' ? (
          <View style={styles.section}>
            {can('CREATE_MEETINGS') ? (
              <Button
                label="Create meeting"
                icon="add"
                onPress={() => navigation.navigate('ClubEvents', { clubId, startCreate: true })}
              />
            ) : null}
            {meetings.length ? (
              meetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onPress={() =>
                    navigation.navigate('ClubMeeting', { clubId, meetingId: meeting.id })
                  }
                  onRsvp={club.isMember ? (status) => void handleRsvp(status) : undefined}
                />
              ))
            ) : (
              <EmptyState
                icon="calendar-outline"
                title="No upcoming meetings"
                body="New events will appear here."
                actionLabel={can('CREATE_MEETINGS') ? 'Create meeting' : 'View calendar'}
                onAction={() =>
                  navigation.navigate('ClubEvents', {
                    clubId,
                    startCreate: can('CREATE_MEETINGS'),
                  })
                }
              />
            )}
          </View>
        ) : null}

        {tab === 'people' ? (
          <View style={styles.section}>
            {isLeader ? (
              <Text
                style={[styles.link, { color: colors.accentText, alignSelf: 'flex-end' }]}
                onPress={() => navigation.navigate('ClubMembers', { clubId })}
              >
                Manage members →
              </Text>
            ) : null}
            {[...club.members]
              .sort((a, b) => roleRank(b.role) - roleRank(a.role))
              .map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                onPress={() => navigation.navigate('UserProfile', { userId: member.userId })}
              />
            ))}
          </View>
        ) : null}

        {tab === 'about' ? (
          <View style={styles.section}>
            <Text style={[typography.body, { color: colors.sub }]}>{club.description}</Text>
            <Card padded>
              <ListRow icon="school-outline" title={club.university} sub="Campus" tint={colors.blueSoft} />
              <ListRow icon="pricetag-outline" title={club.category} sub="Category" tint={colors.violetSoft} />
              <ListRow
                icon="people-outline"
                title={`${club.members.length} member${club.members.length === 1 ? '' : 's'}`}
                sub={club.isVerified ? 'Verified club' : 'Community'}
                tint={colors.tealSoft}
                last
              />
            </Card>
            {club.isMember && selfAssignableRoles.length ? (
              <>
                <Text style={typography.title}>Join a role</Text>
                <View style={styles.roleChips}>
                  {selfAssignableRoles.map((role) => {
                    const has = myRoleIds.has(role.id);
                    const roleTint = roleAccent(colors, role.color);
                    return (
                      <Chip
                        key={role.id}
                        label={`${has ? '✓ ' : ''}${role.name}`}
                        selected={has}
                        tint={roleTint.tint}
                        onPress={roleBusyId === role.id ? undefined : () => void toggleSelfRole(role.id, has)}
                      />
                    );
                  })}
                </View>
              </>
            ) : null}
            {isLeader ? (
              <ListRow
                icon="speedometer-outline"
                title="Officer desk"
                sub="Stats, outreach, channels, roles, and settings"
                tint={colors.primarySoft}
                onPress={() => navigation.navigate('ClubManage', { clubId })}
                last
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* ── Sticky action bar ── */}
      <View
        style={[
          styles.stickyBar,
          {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Button
            label={primaryAction.label}
            icon={primaryAction.icon}
            loading={membershipBusy}
            onPress={primaryAction.onPress}
          />
        </View>
        {club.isMember && generalChannel ? (
          <IconButton
            icon="chatbubble-ellipses-outline"
            accessibilityLabel="Open chat"
            onPress={() => openChannel(generalChannel.id)}
          />
        ) : null}
        <IconButton
          icon="ellipsis-horizontal"
          accessibilityLabel="Club actions"
          onPress={() => setActionsOpen(true)}
        />
      </View>

      <Sheet
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={club.name}
        kicker="CLUB ACTIONS"
      >
        {isLeader && !club.isVerified ? (
          <ListRow
            icon="ribbon-outline"
            title="Verify club"
            onPress={() => {
              setActionsOpen(false);
              setVerifyOpen(true);
            }}
          />
        ) : null}
        {isLeader ? (
          <ListRow
            icon="settings-outline"
            title="Club settings"
            onPress={() => {
              setActionsOpen(false);
              navigation.navigate('ClubManage', { clubId });
            }}
          />
        ) : null}
        <ListRow
          icon="share-outline"
          title="Share club"
          onPress={() => {
            setActionsOpen(false);
            void Share.share({ message: `${club.name}\n${getClubShareUrl(club.id)}` });
          }}
        />
        <ListRow
          icon="flag-outline"
          title="Report club"
          onPress={() => {
            setActionsOpen(false);
            void createReport({ clubId, reason: 'OTHER', details: `Club profile: ${club.name}` })
              .then(() => toast.success('Report sent', 'Thanks. We logged this club for review.'))
              .catch(() => toast.error('Could not send report', API_USER_MESSAGE));
          }}
        />
        {club.isMember && club.myRole !== 'OWNER' ? (
          <ListRow
            icon="log-out-outline"
            title="Leave club"
            destructive
            last
            onPress={() => {
              setActionsOpen(false);
              void handleMembership();
            }}
          />
        ) : null}
      </Sheet>

      <ClubVerifyPrompt
        visible={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        clubId={club.id}
        clubName={club.name}
        memberCount={club.members.length}
      />
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, gap: spacing.lg },
  coverWrap: { marginHorizontal: -spacing.xl },
  cover: {
    height: 132,
    paddingHorizontal: spacing.xl,
  },
  coverChrome: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  identity: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: -32,
  },
  mark: { borderWidth: 3 },
  identityText: { flex: 1, minWidth: 0, paddingBottom: 4, gap: 2 },
  nameLine: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  clubName: {
    fontFamily: fonts.display,
    fontSize: 21,
    letterSpacing: -0.5,
    color: t.colors.ink,
    flexShrink: 1,
  },
  section: { gap: spacing.md },
  sectionHead: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
  link: { fontFamily: fonts.bold, fontSize: 12 },
  pinnedHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs },
  jumpRow: { marginTop: spacing.sm },
  activityRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  roleChips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  stickyBar: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
}));
