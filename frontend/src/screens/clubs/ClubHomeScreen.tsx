import React, { useEffect, useMemo, useState } from 'react';
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
  IconButton,
  ListRow,
  ScreenHeader,
  Segmented,
  Sheet,
  SkeletonCard,
  Slab,
} from '../../components/ui';
import {
  ClubEmptyState,
  ClubIdentityHero,
  MeetingCard,
  roleAccent,
} from '../../components/clubs';
import ClubVerifyPrompt from './ClubVerifyPrompt';
import { useClub, roleRank } from '../../hooks/useClub';
import { useAuth } from '../../context/AuthContext';
import {
  Theme,
  createThemedStyles,
  fonts,
  radii,
  spacing,
  useTheme,
} from '../../theme';
import { formatShortDate } from '../../utils/format';

import { toast } from '../../lib/toast';
import { getUiPreviewMode } from '../../dev/previewMode';
type Props = NativeStackScreenProps<RootStackParamList, 'ClubDetail'>;

type ClubTab = 'home' | 'chat' | 'about';

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
  const [previewMode] = useState(getUiPreviewMode);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [tab, setTab] = useState<ClubTab>(
    previewMode === 'club-home-about' ? 'about' : 'home',
  );
  const [verifyOpen, setVerifyOpen] = useState(Boolean(justCreated));
  const nextMeeting = meetings[0] ?? null;

  useEffect(() => {
    if (previewMode !== 'club-home-actions' && previewMode !== 'club-verify') return;
    const timer = setTimeout(() => {
      if (previewMode === 'club-home-actions') setActionsOpen(true);
      if (previewMode === 'club-verify') setVerifyOpen(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [previewMode]);

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
          <ClubEmptyState
            variant="recovery"
            title="Could not load club"
            body={error ?? 'The connection dropped before this club finished loading.'}
            actionLabel="Try again"
            onAction={() => void refresh()}
            secondaryLabel="Go back"
            onSecondary={() => navigation.goBack()}
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
        {/* ── Photo-first identity, shared across light and dark mode ── */}
        <View style={[styles.heroWrap, { marginTop: -(insets.top + spacing.md) }]}>
          <ClubIdentityHero
            club={club}
            role={club.myRole}
            topInset={insets.top}
            squareBottom
            onBack={() => navigation.goBack()}
            onActions={() => setActionsOpen(true)}
            onRolePress={
              club.isMember && selfAssignableRoles.length
                ? () => setRolesOpen(true)
                : undefined
              }
          />
          <View
            pointerEvents="none"
            style={[styles.heroCutover, { backgroundColor: colors.bg }]}
          />
        </View>

        {/* ── In-page tabs ── */}
        <Segmented
          value={tab}
          onChange={(next) => {
            if (next === 'chat' && generalChannel) {
              openChannel(generalChannel.id);
              return;
            }
            setTab(next);
          }}
          options={[
            { value: 'home', label: 'Home' },
            { value: 'chat', label: 'Chat' },
            { value: 'about', label: 'About' },
          ]}
        />

        {tab === 'home' ? (
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
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={typography.title}>Latest</Text>
            </View>
            <ClubEmptyState
              variant="chat"
              compact
              title="No announcements yet"
              body="Official club updates will appear here."
              actionLabel={generalChannel ? 'Open club chat' : 'See club details'}
              onAction={() => {
                if (generalChannel) {
                  openChannel(generalChannel.id);
                } else {
                  setTab('about');
                }
              }}
            />
          </View>
        )}

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
            <ClubEmptyState
              variant="calendar"
              title="No upcoming meetings"
              body={
                can('CREATE_MEETINGS')
                  ? 'Put the next club gathering on the calendar.'
                  : 'When leaders post the next gathering, it will show up here.'
              }
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
                onPress={() => navigation.navigate('ClubMembers', { clubId })}
                last
              />
            </Card>
            <View style={styles.sectionHead}>
              <Text style={typography.title}>Leadership</Text>
              <Text
                style={[styles.link, { color: colors.accentText }]}
                onPress={() => navigation.navigate('ClubMembers', { clubId })}
              >
                All members
              </Text>
            </View>
            <View style={styles.leadershipRow}>
              {[...club.members]
                .filter((member) => roleRank(member.role) >= roleRank('OFFICER'))
                .sort((a, b) => roleRank(b.role) - roleRank(a.role))
                .slice(0, 4)
                .map((member) => (
                  <View key={member.userId} style={styles.leader}>
                    <Avatar
                      name={member.user.name}
                      uri={member.user.avatarUrl}
                      size={54}
                    />
                    <Text style={typography.captionSmall} numberOfLines={1}>
                      {member.user.name.split(' ')[0]}
                    </Text>
                    <Text
                      style={[typography.captionSmall, { color: colors.sub }]}
                      numberOfLines={1}
                    >
                      {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                    </Text>
                  </View>
                ))}
            </View>
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
        <ListRow
          icon="share-outline"
          title="Share club"
          onPress={() => {
            setActionsOpen(false);
            void Share.share({ message: `${club.name}\n${getClubShareUrl(club.id)}` });
          }}
        />
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

      <Sheet
        visible={rolesOpen}
        onClose={() => setRolesOpen(false)}
        title="Join a role"
        kicker="FIND YOUR PLACE"
        scrollable
      >
        <View style={{ gap: spacing.md }}>
          <Text style={typography.caption}>
            Roles connect you with the teams and conversations you care about.
          </Text>
          {selfAssignableRoles.map((role) => {
            const has = myRoleIds.has(role.id);
            const accent = roleAccent(colors, role.color);
            return (
              <ListRow
                key={role.id}
                icon={has ? 'checkmark-circle' : 'ellipse-outline'}
                title={role.name}
                sub={has ? 'Joined' : 'Tap to join this role'}
                tint={accent.tint}
                onPress={
                  roleBusyId === role.id
                    ? undefined
                    : () => void toggleSelfRole(role.id, has)
                }
                last
              />
            );
          })}
          <Button label="Done" onPress={() => setRolesOpen(false)} />
        </View>
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
  heroWrap: {
    marginHorizontal: -spacing.xl,
    position: 'relative' as const,
  },
  heroCutover: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: -1,
    height: 18,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  section: { gap: spacing.md },
  sectionHead: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
  link: { fontFamily: fonts.bold, fontSize: 12 },
  pinnedHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs },
  jumpRow: { marginTop: spacing.sm },
  activityRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  roleChips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  leadershipRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    justifyContent: 'space-between' as const,
  },
  leader: {
    width: 72,
    alignItems: 'center' as const,
    gap: 3,
  },
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
