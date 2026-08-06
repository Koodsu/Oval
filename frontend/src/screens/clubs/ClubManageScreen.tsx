import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  API_USER_MESSAGE,
  createClubChannel,
  createClubRole,
  deleteClub,
  deleteClubChannel,
  deleteClubRole,
  getClubOwnershipHistory,
  getClubShareUrl,
  previewClubOutreach,
  reorderClubChannels,
  reorderClubRoles,
  resolveAvatarUrl,
  sendClubOutreach,
  transferClubOwnership,
  updateClubChannel,
  updateClubMemberPermissions,
  updateClubProfile,
  updateClubRole,
  uploadClubAvatar,
  uploadClubCover,
  type ClubOutreachAudience,
  type ClubOutreachPreview,
} from '../../api';
import type { RootStackParamList } from '../../../App';
import type {
  ClubChannelRow,
  ClubMemberWithUser,
  ClubOwnershipTransfer,
  ClubRole,
  ClubRoleColor,
  NamedClubRoleColor,
} from '../../types';
import {
  AppBackdrop,
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  ContentImage,
  Field,
  ListRow,
  ScreenHeader,
  Sheet,
  StatSlab,
} from '../../components/ui';
import {
  ClubEmptyState,
  ClubPhoto,
  ClubScreenLoading,
  RoleTargetPicker,
  channelIcon,
  roleAccent,
} from '../../components/clubs';
import {
  CLUB_PERMISSION_OPTIONS,
  DEFAULT_OFFICER_PERMISSIONS,
  useClub,
} from '../../hooks/useClub';
import { spacing, useTheme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { CLUB_CATEGORIES } from '../../constants/clubCategories';
import { clubIdentityImageFor } from '../../constants/contentImages';
import { getUiPreviewMode } from '../../dev/previewMode';

import { toast } from '../../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'ClubManage'>;
type Panel =
  | 'profile'
  | 'ownership'
  | 'delete'
  | 'roles'
  | 'channels'
  | 'permissions'
  | 'outreach'
  | null;

const PREVIEW_PANEL_NAMES = new Set<Exclude<Panel, null>>([
  'profile',
  'ownership',
  'delete',
  'roles',
  'channels',
  'permissions',
  'outreach',
]);

function initialPreviewPanel(mode?: string): Panel {
  if (!__DEV__) return null;
  const requested = mode?.replace('club-manage-', '');
  return requested && PREVIEW_PANEL_NAMES.has(requested as Exclude<Panel, null>)
    ? requested as Exclude<Panel, null>
    : null;
}

const ROLE_COLOR_OPTIONS: Array<NamedClubRoleColor> = [
  'scarlet',
  'blue',
  'green',
  'amber',
  'pink',
  'violet',
  'teal',
];
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DELETE_CLUB_ART = require('../../../assets/illustrations/clubs/delete-club.png');

function MemberPicker({
  members,
  selectedUserIds,
  onChange,
}: {
  members: ClubMemberWithUser[];
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
}) {
  const { colors, typography } = useTheme();
  if (!members.length) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={typography.kicker}>SPECIFIC MEMBERS · OPTIONAL</Text>
      <View style={{ gap: spacing.xs }}>
        {members.map((member) => {
          const selected = selectedUserIds.includes(member.userId);
          return (
            <Pressable
              key={member.userId}
              onPress={() =>
                onChange(
                  selected
                    ? selectedUserIds.filter((id) => id !== member.userId)
                    : [...selectedUserIds, member.userId],
                )
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={member.user.name}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.sm,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons
                name={selected ? 'checkbox' : 'square-outline'}
                size={21}
                color={selected ? colors.accentText : colors.sub}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={typography.subheading} numberOfLines={1}>{member.user.name}</Text>
                <Text style={typography.captionSmall} numberOfLines={1}>{member.role}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function OwnershipTargetPicker({
  members,
  selectedUserId,
  onSelect,
}: {
  members: ClubMemberWithUser[];
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
}) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {members.map((member) => {
        const selected = selectedUserId === member.userId;
        return (
          <Pressable
            key={member.userId}
            onPress={() => onSelect(member.userId)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Transfer ownership to ${member.user.name}`}
            style={({ pressed }) => [
              {
                minHeight: 64,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primarySoft : colors.surface,
                borderRadius: 16,
                paddingHorizontal: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Avatar name={member.user.name} uri={member.user.avatarUrl} size={42} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={typography.subheading} numberOfLines={1}>
                {member.user.name}
              </Text>
              <Text style={typography.captionSmall}>{member.role}</Text>
            </View>
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={selected ? colors.accentText : colors.sub}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ClubManageScreen({ route, navigation }: Props) {
  const { clubId } = route.params;
  const {
    club,
    meetings,
    announcements,
    channels,
    setChannels,
    isLeader,
    can,
    loading,
    refresh,
    setClub,
  } = useClub(clubId);
  const { colors, typography } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [previewMode] = useState(getUiPreviewMode);
  const [panel, setPanel] = useState<Panel>(null);
  const [profileName, setProfileName] = useState('');
  const [profileDescription, setProfileDescription] = useState('');
  const [profileCategory, setProfileCategory] = useState('Other');
  const [profilePublic, setProfilePublic] = useState(true);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const [transferQuery, setTransferQuery] = useState('');
  const [transferConfirmation, setTransferConfirmation] = useState('');
  const [ownershipHistory, setOwnershipHistory] = useState<ClubOwnershipTransfer[]>([]);
  const [ownershipHistoryLoading, setOwnershipHistoryLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [selectedOfficerId, setSelectedOfficerId] = useState<string | null>(null);

  // Role editor state
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState<ClubRoleColor | null>(null);
  const [roleHex, setRoleHex] = useState('');
  const [roleSelfAssign, setRoleSelfAssign] = useState(false);
  const [editingRole, setEditingRole] = useState<ClubRole | null>(null);

  // Channel editor state
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [channelRoleIds, setChannelRoleIds] = useState<string[]>([]);
  const [channelUserIds, setChannelUserIds] = useState<string[]>([]);
  const [editingChannel, setEditingChannel] = useState<ClubChannelRow | null>(null);

  const [outreachText, setOutreachText] = useState('');
  const [audienceType, setAudienceType] = useState<
    'ALL' | 'NON_RSVP' | 'OFFICER' | 'CUSTOM_ROLE' | 'MANUAL'
  >('ALL');
  const [outreachRoleId, setOutreachRoleId] = useState<string | null>(null);
  const [outreachMemberIds, setOutreachMemberIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<ClubOutreachPreview | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const previewPanel = initialPreviewPanel(previewMode);
    if (!previewPanel || !club) return;
    const timer = setTimeout(() => {
      if (previewPanel === 'profile') {
        setProfileName(club.name);
        setProfileDescription(club.description);
        setProfileCategory(club.category);
        setProfilePublic(club.isPublic);
      }
      if (previewPanel === 'permissions') {
        setSelectedOfficerId(
          club.members.find((member) => member.role === 'OFFICER')?.userId ?? null,
        );
      }
      if (previewPanel === 'outreach') {
        setOutreachText('Reminder: Sunrise Photo Walk starts tomorrow. RSVP so we can plan!');
        const recipients = club.members.slice(0, 4).map((member) => ({
          id: member.userId,
          name: member.user.name,
          avatarUrl: member.user.avatarUrl,
          role: member.role,
        }));
        setPreview({
          audience: 'All members',
          count: recipients.length,
          recipients,
        });
      }
      setPanel(previewPanel);
    }, 350);
    return () => clearTimeout(timer);
  }, [club, previewMode]);

  const analytics = useMemo(() => {
    const responses = meetings.reduce(
      (sum, meeting) => sum + meeting.rsvpCounts.going + meeting.rsvpCounts.maybe + meeting.rsvpCounts.notGoing,
      0,
    );
    const goingResponses = meetings.reduce(
      (sum, meeting) => sum + meeting.rsvpCounts.going,
      0,
    );
    const nextMeeting = meetings[0] ?? null;
    const nonRsvpCount = nextMeeting
      ? Math.max(
          0,
          (club?.members.length ?? 0) -
            (nextMeeting.rsvpCounts.going + nextMeeting.rsvpCounts.maybe + nextMeeting.rsvpCounts.notGoing),
        )
      : 0;
    return {
      members: club?.members.length ?? 0,
      meetings: meetings.length,
      attendance: meetings.reduce((sum, meeting) => sum + meeting.attendeeCount, 0),
      announcements: announcements.length,
      goingShare: responses
        ? Math.min(100, Math.round((goingResponses / responses) * 100))
        : 0,
      nextMeeting,
      nonRsvpCount,
    };
  }, [announcements.length, club?.members.length, meetings]);

  const customChannels = useMemo(
    () => channels.filter((channel) => channel.kind === 'CUSTOM'),
    [channels],
  );
  const ownershipCandidates = useMemo(
    () =>
      (club?.members ?? []).filter(
        (member) => member.userId !== user?.id && member.role !== 'OWNER',
      ),
    [club?.members, user?.id],
  );
  const visibleOwnershipCandidates = useMemo(() => {
    const query = transferQuery.trim().toLowerCase();
    if (!query) return ownershipCandidates;
    return ownershipCandidates.filter((member) =>
      [member.user.name, member.user.major, member.user.classYear, member.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [ownershipCandidates, transferQuery]);
  const ownershipTarget =
    ownershipCandidates.find((member) => member.userId === transferTargetId) ?? null;
  const officers = useMemo(
    () => (club?.members ?? []).filter((member) => member.role === 'OFFICER'),
    [club?.members],
  );
  const selectedOfficer =
    officers.find((member) => member.userId === selectedOfficerId) ?? officers[0] ?? null;

  if (loading && !club) {
    return <ClubScreenLoading title="Officer desk" onBack={() => navigation.goBack()} />;
  }

  if (!club || !isLeader) {
    return (
      <AppBackdrop>
        <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: insets.top + spacing.md }}>
          <ScreenHeader title="Officer desk" onBack={() => navigation.goBack()} />
          <ClubEmptyState
            variant="private"
            title="Leader access required"
            body="Only club officers can manage this space."
            actionLabel="Back to club"
            onAction={() => navigation.navigate('ClubDetail', { clubId })}
          />
        </View>
      </AppBackdrop>
    );
  }

  const pickClubImage = async (kind: 'avatar' | 'cover') => {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.info('Photo permission needed', 'Allow photo access to update the club image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: kind === 'cover' ? [16, 9] : [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const uploaded =
        kind === 'cover'
          ? await uploadClubCover(clubId, result.assets[0].uri)
          : await uploadClubAvatar(clubId, result.assets[0].uri);
      setClub((current) => current ? { ...current, ...uploaded } : current);
      toast.success(
        kind === 'cover' ? 'Cover updated' : 'Club photo updated',
        'The new image is live on the club page.',
      );
    } catch {
      toast.error('Could not update club photo', API_USER_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  const openProfile = () => {
    setProfileName(club.name);
    setProfileDescription(club.description);
    setProfileCategory(club.category);
    setProfilePublic(club.isPublic);
    setPanel('profile');
  };

  const saveProfile = async () => {
    if (!profileName.trim() || !profileDescription.trim()) {
      toast.error('Missing profile details', 'Add a club name and description.');
      return;
    }
    setBusy(true);
    try {
      const updated = await updateClubProfile(clubId, {
        name: profileName.trim(),
        description: profileDescription.trim(),
        category: profileCategory,
        isPublic: profilePublic,
      });
      setClub((current) => current ? { ...current, ...updated } : current);
      setPanel(null);
    } catch {
      toast.error('Could not update club profile', API_USER_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  // ── Roles ──
  const resetRoleEditor = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleColor(null);
    setRoleHex('');
    setRoleSelfAssign(false);
  };

  const startEditRole = (role: ClubRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleColor(role.color ?? null);
    setRoleHex(role.color?.startsWith('#') ? role.color : '');
    setRoleSelfAssign(Boolean(role.isSelfAssignable));
  };

  const saveRole = async () => {
    if (!roleName.trim()) return;
    const trimmedHex = roleHex.trim();
    if (trimmedHex && !HEX_COLOR_RE.test(trimmedHex)) {
      toast.error('Check the hex color', 'Use # plus 6 digits.');
      return;
    }
    const color = trimmedHex ? (trimmedHex as ClubRoleColor) : roleColor;
    setBusy(true);
    try {
      if (editingRole) {
        await updateClubRole(clubId, editingRole.id, {
          name: roleName.trim(),
          color,
          isSelfAssignable: roleSelfAssign,
        });
      } else {
        await createClubRole(clubId, {
          name: roleName.trim(),
          color,
          isSelfAssignable: roleSelfAssign,
        });
      }
      resetRoleEditor();
      await refresh();
    } catch {
      toast.error(editingRole ? 'Could not update role' : 'Could not create role', API_USER_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  const moveRole = async (roleId: string, direction: -1 | 1) => {
    const roles = [...(club.roles ?? [])];
    const from = roles.findIndex((role) => role.id === roleId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= roles.length) return;
    [roles[from], roles[to]] = [roles[to], roles[from]];
    setClub((current) => current
      ? { ...current, roles: roles.map((role, position) => ({ ...role, position })) }
      : current);
    try {
      await reorderClubRoles(clubId, roles.map((role) => role.id));
    } catch {
      toast.error('Could not reorder roles', API_USER_MESSAGE);
      await refresh();
    }
  };

  // ── Channels ──
  const resetChannelEditor = () => {
    setEditingChannel(null);
    setChannelName('');
    setChannelDescription('');
    setChannelRoleIds([]);
    setChannelUserIds([]);
  };

  const startEditChannel = (channel: ClubChannelRow) => {
    setEditingChannel(channel);
    setChannelName(channel.name);
    setChannelDescription(channel.description ?? '');
    setChannelRoleIds(channel.allowedRoleIds);
    setChannelUserIds(channel.allowedUserIds ?? []);
  };

  const saveChannel = async () => {
    if (!channelName.trim()) return;
    setBusy(true);
    try {
      if (editingChannel) {
        const updated = await updateClubChannel(clubId, editingChannel.id, {
          name: channelName.trim(),
          description: channelDescription.trim(),
          allowedRoleIds: channelRoleIds,
          allowedUserIds: channelUserIds,
        });
        setChannels((current) =>
          current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
        );
      } else {
        const created = await createClubChannel(clubId, {
          name: channelName.trim(),
          description: channelDescription.trim() || undefined,
          allowedRoleIds: channelRoleIds,
          allowedUserIds: channelUserIds,
        });
        setChannels((current) => [
          ...current,
          { ...created, unreadCount: 0, lastMessageAt: null, lastMessagePreview: null, canPost: true },
        ]);
      }
      resetChannelEditor();
    } catch {
      toast.error(
        editingChannel ? 'Could not update channel' : 'Could not create channel',
        API_USER_MESSAGE,
      );
    } finally {
      setBusy(false);
    }
  };

  const removeChannel = (channel: ClubChannelRow) => {
    Alert.alert(
      'Delete channel?',
      `#${channel.name} and all of its messages will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteClubChannel(clubId, channel.id)
            .then(() => setChannels((current) => current.filter((row) => row.id !== channel.id)))
            .catch(() => toast.error('Could not delete channel', API_USER_MESSAGE)),
        },
      ],
    );
  };

  const moveChannel = async (channelId: string, direction: -1 | 1) => {
    const custom = channels.filter((channel) => channel.kind === 'CUSTOM');
    const from = custom.findIndex((channel) => channel.id === channelId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= custom.length) return;
    [custom[from], custom[to]] = [custom[to], custom[from]];
    const positions = new Map(custom.map((channel, index) => [channel.id, 10 + index]));
    setChannels((current) => [...current]
      .map((channel) => ({
        ...channel,
        position: positions.get(channel.id) ?? channel.position,
      }))
      .sort((left, right) => left.position - right.position));
    try {
      await reorderClubChannels(clubId, custom.map((channel) => channel.id));
    } catch {
      toast.error('Could not reorder channels', API_USER_MESSAGE);
      await refresh();
    }
  };

  // ── Outreach ──
  const audience = (): ClubOutreachAudience | null => {
    if (audienceType === 'NON_RSVP') {
      return meetings[0] ? { type: 'NON_RSVP', meetingId: meetings[0].id } : null;
    }
    if (audienceType === 'OFFICER') return { type: 'PRIMARY_ROLE', role: 'OFFICER' };
    if (audienceType === 'CUSTOM_ROLE') {
      return outreachRoleId ? { type: 'CUSTOM_ROLE', roleId: outreachRoleId } : null;
    }
    if (audienceType === 'MANUAL') {
      return outreachMemberIds.length ? { type: 'MANUAL', userIds: outreachMemberIds } : null;
    }
    return { type: 'ALL' };
  };

  const previewOutreach = async () => {
    const selectedAudience = audience();
    if (!selectedAudience) {
      toast.error('Choose an audience', 'Select a meeting or member tag first.');
      return;
    }
    setBusy(true);
    try {
      setPreview(await previewClubOutreach(clubId, selectedAudience));
    } catch {
      toast.error('Could not preview audience', API_USER_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  const sendOutreachNow = async () => {
    const selectedAudience = audience();
    if (!outreachText.trim() || !preview || !selectedAudience) return;
    setBusy(true);
    try {
      const result = await sendClubOutreach(clubId, selectedAudience, outreachText.trim());
      setOutreachText('');
      setPreview(result);
      toast.success('Outreach sent', `${result.sent} notification${result.sent === 1 ? '' : 's'} queued.`);
    } catch {
      toast.error('Could not send outreach', API_USER_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  const openNonRsvpNudge = () => {
    setAudienceType('NON_RSVP');
    setPreview(null);
    setOutreachText(
      analytics.nextMeeting
        ? `Reminder: ${analytics.nextMeeting.title} — RSVP so we can plan! 📅`
        : '',
    );
    setPanel('outreach');
  };

  const confirmOwnershipTransfer = () => {
    if (!ownershipTarget) return;
    if (transferConfirmation.trim() !== club.name) {
      toast.error('Confirmation does not match', `Type ${club.name} exactly to continue.`);
      return;
    }
    Alert.alert(
      `Transfer ownership to ${ownershipTarget.user.name}?`,
      'They will receive full control of the club. You will remain an admin.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: () => {
            setBusy(true);
            void transferClubOwnership(clubId, ownershipTarget.userId)
              .then(async () => {
                setClub((current) =>
                  current
                    ? {
                        ...current,
                        myRole: 'ADMIN',
                        members: current.members.map((member) => ({
                          ...member,
                          role:
                            member.userId === ownershipTarget.userId
                              ? 'OWNER'
                              : member.role === 'OWNER'
                                ? 'ADMIN'
                                : member.role,
                        })),
                      }
                    : current,
                );
                setPanel(null);
                setTransferTargetId(null);
                setTransferQuery('');
                setTransferConfirmation('');
                await refresh();
                toast.success(
                  'Ownership transferred',
                  `${ownershipTarget.user.name} is now the club owner.`,
                );
              })
              .catch(() => toast.error('Could not transfer ownership', API_USER_MESSAGE))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  const openOwnershipTransfer = () => {
    setTransferTargetId(null);
    setTransferQuery('');
    setTransferConfirmation('');
    setOwnershipHistoryLoading(true);
    setPanel('ownership');
    void getClubOwnershipHistory(clubId)
      .then((response) => setOwnershipHistory(response.items))
      .catch(() => setOwnershipHistory([]))
      .finally(() => setOwnershipHistoryLoading(false));
  };

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <ScreenHeader title="Officer desk" kicker={`${club.name} · ${club.myRole}`} onBack={() => navigation.goBack()} />

        {/* ── Stats: visible, not buried in a sheet ── */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <StatSlab label="MEMBERS" value={String(analytics.members)} icon="people" tint={colors.blueSoft} />
            <StatSlab label="GOING SHARE" value={`${analytics.goingShare}%`} icon="checkbox" tint={colors.successSoft} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <StatSlab label="UPCOMING" value={String(analytics.meetings)} icon="calendar" tint={colors.violetSoft} />
            <StatSlab label="CHECKED IN" value={String(analytics.attendance)} icon="finger-print" tint={colors.tealSoft} />
          </View>
        </View>

        {/* ── Needs attention ── */}
        {analytics.nextMeeting && analytics.nonRsvpCount > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.kicker}>NEEDS ATTENTION</Text>
            <Card style={{ borderColor: colors.primary }}>
              <ListRow
                icon="alert-circle-outline"
                title={`${analytics.nonRsvpCount} member${analytics.nonRsvpCount === 1 ? "" : "s"} ${analytics.nonRsvpCount === 1 ? "hasn't" : "haven't"} RSVP'd`}
                sub={`${analytics.nextMeeting.title} · tap to nudge them`}
                tint={colors.primarySoft}
                onPress={openNonRsvpNudge}
                last
              />
            </Card>
          </View>
        ) : null}

        {can('MANAGE_CLUB') ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.kicker}>PROFILE</Text>
            <Card>
              <ListRow
                icon="image-outline"
                title="Photo and identity"
                sub="Update the club image, name, and description"
                onPress={openProfile}
              />
              <ListRow
                icon="share-social-outline"
                title="Share club"
                sub={club.isPublic ? 'Public club' : 'Private club'}
                onPress={() => void Share.share({ message: `${club.name}\n${getClubShareUrl(clubId)}` })}
                last={club.myRole !== 'OWNER'}
              />
              {club.myRole === 'OWNER' ? (
                <ListRow
                  icon="swap-horizontal-outline"
                  title="Transfer ownership"
                  sub="Choose a new owner; you will become an admin"
                  tint={colors.warningSoft}
                  onPress={openOwnershipTransfer}
                  last
                />
              ) : null}
            </Card>
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Text style={typography.kicker}>COMMUNITY</Text>
          <Card>
            {can('MANAGE_ROLES') ? (
              <ListRow
                icon="pricetags-outline"
                title="Roles"
                sub={`${club.roles?.length ?? 0} role${(club.roles?.length ?? 0) === 1 ? '' : 's'} · colors, self-assign, channel access`}
                onPress={() => {
                  resetRoleEditor();
                  setPanel('roles');
                }}
              />
            ) : null}
            {can('MANAGE_CLUB') ? (
              <ListRow
                icon="document-text-outline"
                title="Applications"
                sub="Open an application cycle and review applicants"
                onPress={() => navigation.navigate('ClubApplications', { clubId })}
              />
            ) : null}
            {can('MANAGE_CLUB') ? (
              <ListRow
                icon="chatbubbles-outline"
                title="Channels"
                sub={`${customChannels.length} custom channel${customChannels.length === 1 ? '' : 's'} · private chat spaces`}
                onPress={() => {
                  resetChannelEditor();
                  setPanel('channels');
                }}
              />
            ) : null}
            {club.myRole === 'OWNER' || club.myRole === 'ADMIN' ? (
              <ListRow
                icon="shield-checkmark-outline"
                title="Officer permissions"
                onPress={() => {
                  setSelectedOfficerId(officers[0]?.userId ?? null);
                  setPanel('permissions');
                }}
                last
              />
            ) : (
              <ListRow
                icon="paper-plane-outline"
                title="Bulk outreach"
                sub="Message members by audience"
                onPress={() => setPanel('outreach')}
                last
              />
            )}
          </Card>
        </View>

        {club.myRole === 'OWNER' || club.myRole === 'ADMIN' ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.kicker}>ENGAGE</Text>
            <Card>
              <ListRow
                icon="paper-plane-outline"
                title="Bulk outreach"
                sub="Message members by audience"
                onPress={() => setPanel('outreach')}
                last
              />
            </Card>
          </View>
        ) : null}

        {can('MANAGE_CLUB') ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.kicker}>DANGER ZONE</Text>
            <Card style={{ borderColor: colors.danger }}>
              <ListRow
                icon="trash-outline"
                title="Delete club"
                destructive
                last
                onPress={() => {
                  setDeleteConfirmation('');
                  setPanel('delete');
                }}
              />
            </Card>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Profile sheet ── */}
      <Sheet visible={panel === 'profile'} onClose={() => setPanel(null)} title="Photo and identity" scrollable>
        <View style={{ gap: spacing.md }}>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <ClubPhoto
              name={club.name}
              category={club.category}
              uri={club.avatarUrl}
              size={92}
            />
            <Button
              label="Update club photo"
              icon="camera-outline"
              size="sm"
              variant="secondary"
              loading={busy}
              onPress={() => void pickClubImage('avatar')}
            />
          </View>
          <Field
            label="Club name"
            value={profileName}
            onChangeText={setProfileName}
            placeholder="Club name"
          />
          <Field
            label="Description"
            value={profileDescription}
            onChangeText={setProfileDescription}
            placeholder="What does this club do?"
            multiline
          />
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.kicker}>CATEGORY</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {CLUB_CATEGORIES.map((category) => (
                <Chip
                  key={category}
                  label={category}
                  selected={profileCategory === category}
                  onPress={() => setProfileCategory(category)}
                />
              ))}
            </View>
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.kicker}>COVER PHOTO</Text>
            <ContentImage
              source={
                club.coverUrl
                  ? { uri: resolveAvatarUrl(club.coverUrl) ?? club.coverUrl }
                  : clubIdentityImageFor({ name: club.name, category: profileCategory })
              }
              seed={`${club.name}-cover-editor`}
              aspectRatio={16 / 9}
              accessibilityLabel={`${club.name} cover photo`}
              style={{ borderRadius: 16 }}
            />
            <Button
              label="Update cover photo"
              icon="image-outline"
              variant="secondary"
              loading={busy}
              onPress={() => void pickClubImage('cover')}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip label="Public" selected={profilePublic} onPress={() => setProfilePublic(true)} />
            <Chip label="Private" selected={!profilePublic} onPress={() => setProfilePublic(false)} />
          </View>
          <Button label="Save profile" loading={busy} onPress={() => void saveProfile()} />
        </View>
      </Sheet>

      {/* ── Ownership transfer sheet ── */}
      <Sheet
        visible={panel === 'ownership'}
        onClose={() => setPanel(null)}
        title="Transfer ownership"
        kicker="OWNER ONLY"
        scrollable
      >
        <View style={{ gap: spacing.md }}>
          <Banner
            kind="warning"
            message="This changes the club’s legal owner and full-control role. You will remain an admin, but only the new owner can transfer ownership again."
          />
          {ownershipCandidates.length ? (
            <>
              <Text style={typography.kicker}>CHOOSE THE NEW OWNER</Text>
              <Field
                value={transferQuery}
                onChangeText={setTransferQuery}
                placeholder="Search club members"
              />
              <OwnershipTargetPicker
                members={visibleOwnershipCandidates}
                selectedUserId={transferTargetId}
                onSelect={(userId) => {
                  setTransferTargetId(userId);
                  setTransferConfirmation('');
                }}
              />
              {!visibleOwnershipCandidates.length ? (
                <Text style={typography.caption}>No eligible members match that search.</Text>
              ) : null}
              {ownershipTarget ? (
                <Field
                  label={`Type “${club.name}” to confirm`}
                  value={transferConfirmation}
                  onChangeText={setTransferConfirmation}
                  autoCapitalize="words"
                  placeholder={club.name}
                />
              ) : null}
              <Button
                label={
                  ownershipTarget
                    ? `Transfer to ${ownershipTarget.user.name}`
                    : 'Choose a club member'
                }
                icon="swap-horizontal-outline"
                disabled={!ownershipTarget || transferConfirmation.trim() !== club.name}
                loading={busy}
                onPress={confirmOwnershipTransfer}
              />
            </>
          ) : (
            <ClubEmptyState
              variant="people"
              compact
              title="No eligible members yet"
              body="Add another member before transferring club ownership."
              actionLabel="Back to officer desk"
              onAction={() => setPanel(null)}
            />
          )}
          <View style={{ gap: spacing.sm }}>
            <Text style={typography.kicker}>RECENT OWNERSHIP HISTORY</Text>
            {ownershipHistoryLoading ? (
              <Text style={typography.caption}>Loading transfer history…</Text>
            ) : ownershipHistory.length ? (
              ownershipHistory.map((item, index) => (
                <ListRow
                  key={item.id}
                  icon="time-outline"
                  title={`${item.fromUser?.name ?? 'Former owner'} → ${item.toUser?.name ?? 'Deleted account'}`}
                  sub={new Date(item.createdAt).toLocaleDateString()}
                  last={index === ownershipHistory.length - 1}
                />
              ))
            ) : (
              <Text style={typography.caption}>No previous ownership transfers.</Text>
            )}
          </View>
        </View>
      </Sheet>

      {/* ── Permanent deletion sheet ── */}
      <Sheet
        visible={panel === 'delete'}
        onClose={() => setPanel(null)}
        title={`Delete ${club.name}?`}
        kicker="PERMANENT ACTION"
        scrollable
      >
        <View style={{ gap: spacing.md }}>
          <ContentImage
            source={DELETE_CLUB_ART}
            seed={`${club.name}-delete`}
            aspectRatio={16 / 9}
            accessibilityLabel="An archival box containing club materials"
            style={{ borderRadius: 16 }}
          />
          <Text style={typography.body}>
            This permanently removes the club, channels, meetings, applications, and membership
            history for everyone. This cannot be undone.
          </Text>
          <Field
            label={`Type “${club.name}” to confirm`}
            value={deleteConfirmation}
            onChangeText={setDeleteConfirmation}
            autoCapitalize="words"
            placeholder={club.name}
          />
          <Button label="Keep club" variant="secondary" onPress={() => setPanel(null)} />
          <Button
            label="Delete club permanently"
            disabled={deleteConfirmation.trim() !== club.name}
            loading={busy}
            onPress={() => {
              setBusy(true);
              void deleteClub(clubId)
                .then(() => navigation.popToTop())
                .catch(() => toast.error('Could not delete club', API_USER_MESSAGE))
                .finally(() => setBusy(false));
            }}
          />
        </View>
      </Sheet>

      {/* ── Roles sheet ── */}
      <Sheet visible={panel === 'roles'} onClose={() => setPanel(null)} title="Roles" scrollable>
        <View style={{ gap: spacing.md }}>
          <Text style={typography.caption}>
            Roles work like Discord: color them, let members self-assign, target meetings and
            announcements, ping them in chat, and gate custom channels to them.
          </Text>
          <Field
            label={editingRole ? `Editing ${editingRole.name}` : 'New role'}
            value={roleName}
            onChangeText={setRoleName}
            placeholder="Role name (e.g. Competitive Team)"
          />
          <View style={{ gap: spacing.xs }}>
            <Text style={typography.kicker}>COLOR</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {ROLE_COLOR_OPTIONS.map((color) => {
                const accent = roleAccent(colors, color);
                return (
                  <Chip
                    key={color}
                    label={color.charAt(0).toUpperCase() + color.slice(1)}
                    selected={roleColor === color}
                    tint={accent.tint}
                    onPress={() => {
                      setRoleHex('');
                      setRoleColor(roleColor === color ? null : color);
                    }}
                  />
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
              <Field
                label="HEX"
                value={roleHex}
                onChangeText={(value) => {
                  const trimmed = value.trim();
                  setRoleHex(value);
                  if (!trimmed) {
                    if (roleColor?.startsWith('#')) setRoleColor(null);
                    return;
                  }
                  if (HEX_COLOR_RE.test(trimmed)) setRoleColor(trimmed as ClubRoleColor);
                }}
                placeholder="Hex color"
                autoCapitalize="characters"
                error={roleHex.trim() && !HEX_COLOR_RE.test(roleHex.trim()) ? 'Use # plus 6 digits' : null}
                style={{ flex: 1 }}
              />
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: roleColor?.startsWith('#') ? roleColor : roleAccent(colors, roleColor).tint,
                }}
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip
              label={roleSelfAssign ? '✓ Self-assignable' : 'Self-assignable'}
              selected={roleSelfAssign}
              onPress={() => setRoleSelfAssign((value) => !value)}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {editingRole ? (
              <Button label="Cancel" variant="secondary" onPress={resetRoleEditor} />
            ) : null}
            <Button
              label={editingRole ? 'Save role' : 'Create role'}
              loading={busy}
              onPress={() => void saveRole()}
            />
          </View>

          {(club.roles ?? []).map((role, roleIndex) => {
            const accent = roleAccent(colors, role.color);
            return (
              <Card key={role.id}>
                <ListRow
                  icon="at-outline"
                  title={role.name}
                  sub={`${role.memberCount ?? 0} assigned${role.isSelfAssignable ? ' · self-assignable' : ''}${role.color ? ` · ${role.color}` : ''}`}
                  tint={accent.tint}
                  right={
                    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                      <Button
                        label="↑"
                        size="sm"
                        variant="ghost"
                        disabled={roleIndex === 0}
                        onPress={() => void moveRole(role.id, -1)}
                      />
                      <Button
                        label="↓"
                        size="sm"
                        variant="ghost"
                        disabled={roleIndex === (club.roles?.length ?? 0) - 1}
                        onPress={() => void moveRole(role.id, 1)}
                      />
                      <Button label="Edit" size="sm" variant="ghost" onPress={() => startEditRole(role)} />
                      <Button
                        label="Delete"
                        size="sm"
                        variant="ghost"
                        onPress={() => Alert.alert(
                          'Delete role?',
                          `${role.name} will be removed from every assigned member and any channels it gates.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => void deleteClubRole(clubId, role.id)
                                .then(refresh)
                                .catch(() => toast.error('Could not delete role', API_USER_MESSAGE)),
                            },
                          ],
                        )}
                      />
                    </View>
                  }
                  last
                />
              </Card>
            );
          })}
        </View>
      </Sheet>

      {/* ── Channels sheet ── */}
      <Sheet visible={panel === 'channels'} onClose={() => setPanel(null)} title="Channels" scrollable>
        <View style={{ gap: spacing.md }}>
          <Text style={typography.caption}>
            Custom channels are members-only chat spaces. Gate one to roles or specific members.
          </Text>
          <Field
            label={editingChannel ? `Editing #${editingChannel.name}` : 'New channel'}
            value={channelName}
            onChangeText={setChannelName}
            placeholder="Channel name (e.g. team-chat)"
          />
          <Field
            value={channelDescription}
            onChangeText={setChannelDescription}
            placeholder="Optional description"
          />
          <RoleTargetPicker
            roles={club.roles ?? []}
            selectedRoleIds={channelRoleIds}
            onChange={setChannelRoleIds}
          />
          <MemberPicker
            members={club.members}
            selectedUserIds={channelUserIds}
            onChange={setChannelUserIds}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {editingChannel ? (
              <Button label="Cancel" variant="secondary" onPress={resetChannelEditor} />
            ) : null}
            <Button
              label={editingChannel ? 'Save channel' : 'Create channel'}
              loading={busy}
              onPress={() => void saveChannel()}
            />
          </View>

          {channels.map((channel) => {
            const isCustom = channel.kind === 'CUSTOM';
            const customIndex = customChannels.findIndex((row) => row.id === channel.id);
            const gatedNames = channel.allowedRoleIds
              .map((roleId) => (club.roles ?? []).find((role) => role.id === roleId)?.name)
              .filter(Boolean)
              .join(', ');
            const memberCount = channel.allowedUserIds?.length ?? 0;
            const gateSummary = [
              gatedNames ? `Roles: ${gatedNames}` : null,
              memberCount ? `${memberCount} member${memberCount === 1 ? '' : 's'}` : null,
            ].filter(Boolean).join(' · ');
            return (
              <Card key={channel.id}>
                <ListRow
                  icon={channelIcon(channel.kind)}
                  title={channel.name}
                  sub={
                    isCustom
                      ? gateSummary
                        ? `Only: ${gateSummary}`
                        : 'All members'
                      : 'Built-in channel'
                  }
                  right={
                    isCustom ? (
                      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                        <Button
                          label="↑"
                          size="sm"
                          variant="ghost"
                          disabled={customIndex === 0}
                          onPress={() => void moveChannel(channel.id, -1)}
                        />
                        <Button
                          label="↓"
                          size="sm"
                          variant="ghost"
                          disabled={customIndex === customChannels.length - 1}
                          onPress={() => void moveChannel(channel.id, 1)}
                        />
                        <Button label="Edit" size="sm" variant="ghost" onPress={() => startEditChannel(channel)} />
                        <Button label="Delete" size="sm" variant="ghost" onPress={() => removeChannel(channel)} />
                      </View>
                    ) : undefined
                  }
                  last
                />
              </Card>
            );
          })}
        </View>
      </Sheet>

      {/* ── Permissions sheet ── */}
      <Sheet visible={panel === 'permissions'} onClose={() => setPanel(null)} title="Officer permissions" scrollable>
        <View style={{ gap: spacing.md }}>
          {officers.length ? (
            <>
              <Text style={typography.kicker}>CHOOSE AN OFFICER</Text>
              <View style={{ gap: spacing.xs }}>
                {officers.map((officer) => (
                  <Pressable
                    key={officer.userId}
                    onPress={() => setSelectedOfficerId(officer.userId)}
                    accessibilityRole="radio"
                    accessibilityLabel={officer.user.name}
                    accessibilityState={{ checked: selectedOfficer?.userId === officer.userId }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: spacing.md,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor:
                        selectedOfficer?.userId === officer.userId
                          ? colors.primary
                          : colors.border,
                      backgroundColor:
                        selectedOfficer?.userId === officer.userId
                          ? colors.primarySoft
                          : colors.surface,
                    }}
                  >
                    <Avatar name={officer.user.name} uri={officer.user.avatarUrl} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={typography.subheading}>{officer.user.name}</Text>
                      <Text style={typography.captionSmall}>Officer</Text>
                    </View>
                    <Ionicons
                      name={
                        selectedOfficer?.userId === officer.userId
                          ? 'radio-button-on'
                          : 'radio-button-off'
                      }
                      size={22}
                      color={
                        selectedOfficer?.userId === officer.userId
                          ? colors.accentText
                          : colors.sub
                      }
                    />
                  </Pressable>
                ))}
              </View>
              {selectedOfficer
                ? CLUB_PERMISSION_OPTIONS.map((permission) => {
                    const inherited = [
                      ...DEFAULT_OFFICER_PERMISSIONS,
                      ...club.officerPermissions,
                    ];
                    const current = selectedOfficer.permissions ?? inherited;
                    const enabled = current.includes(permission.value);
                    return (
                      <Card key={permission.value}>
                        <ListRow
                          icon={enabled ? 'checkmark-circle' : 'ellipse-outline'}
                          title={permission.title}
                          sub={permission.body}
                          tint={enabled ? colors.successSoft : colors.surfaceAlt}
                          onPress={() => {
                            const next = enabled
                              ? current.filter((item) => item !== permission.value)
                              : [...current, permission.value];
                            void updateClubMemberPermissions(
                              clubId,
                              selectedOfficer.userId,
                              next,
                            )
                              .then((updated) =>
                                setClub((currentClub) =>
                                  currentClub
                                    ? {
                                        ...currentClub,
                                        members: currentClub.members.map((member) =>
                                          member.userId === updated.userId
                                            ? { ...member, permissions: updated.permissions }
                                            : member,
                                        ),
                                      }
                                    : currentClub,
                                ),
                              )
                              .catch(() =>
                                toast.error('Could not update permissions', API_USER_MESSAGE),
                              );
                          }}
                          last
                        />
                      </Card>
                    );
                  })
                : null}
            </>
          ) : (
            <ClubEmptyState
              variant="people"
              compact
              title="No officers yet"
              body="Promote a member to officer before configuring individual permissions."
              actionLabel="Close"
              onAction={() => setPanel(null)}
            />
          )}
        </View>
      </Sheet>

      {/* ── Outreach sheet ── */}
      <Sheet visible={panel === 'outreach'} onClose={() => setPanel(null)} title="Bulk outreach" scrollable>
        <View style={{ gap: spacing.md }}>
          <Text style={typography.kicker}>AUDIENCE</Text>
          <View style={{ gap: spacing.sm }}>
            {([
              ['ALL', 'All members', `${club.members.length} members`, 'people-outline'],
              ['OFFICER', 'Officers', 'Club leadership', 'shield-checkmark-outline'],
              ['MANUAL', 'Specific members', 'Choose individuals', 'person-add-outline'],
            ] as const).map(([value, title, sub, icon]) => (
              <Pressable
                key={value}
                onPress={() => {
                  setAudienceType(value);
                  setPreview(null);
                }}
                accessibilityRole="radio"
                accessibilityLabel={`${title}. ${sub}`}
                accessibilityState={{ selected: audienceType === value }}
                style={({ pressed }) => ({
                  minHeight: 64,
                  borderWidth: 1,
                  borderColor: audienceType === value ? colors.primary : colors.border,
                  backgroundColor: audienceType === value ? colors.primarySoft : colors.surface,
                  borderRadius: 16,
                  paddingHorizontal: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <Ionicons name={icon} size={22} color={audienceType === value ? colors.accentText : colors.sub} />
                <View style={{ flex: 1 }}>
                  <Text style={typography.subheading}>{title}</Text>
                  <Text style={typography.captionSmall}>{sub}</Text>
                </View>
                <Ionicons
                  name={audienceType === value ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={audienceType === value ? colors.primary : colors.sub}
                />
              </Pressable>
            ))}
            {meetings[0] ? (
              <Pressable
                onPress={() => {
                  setAudienceType('NON_RSVP');
                  setPreview(null);
                }}
                accessibilityRole="radio"
                accessibilityLabel={`No RSVP. ${analytics.nonRsvpCount} recipients for ${meetings[0].title}`}
                accessibilityState={{ selected: audienceType === 'NON_RSVP' }}
                style={({ pressed }) => ({
                  minHeight: 64,
                  borderWidth: 1,
                  borderColor: audienceType === 'NON_RSVP' ? colors.primary : colors.border,
                  backgroundColor: audienceType === 'NON_RSVP' ? colors.primarySoft : colors.surface,
                  borderRadius: 16,
                  paddingHorizontal: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <Ionicons name="calendar-outline" size={22} color={audienceType === 'NON_RSVP' ? colors.accentText : colors.sub} />
                <View style={{ flex: 1 }}>
                  <Text style={typography.subheading}>No RSVP</Text>
                  <Text style={typography.captionSmall}>{analytics.nonRsvpCount} recipients for {meetings[0].title}</Text>
                </View>
                <Ionicons
                  name={audienceType === 'NON_RSVP' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={audienceType === 'NON_RSVP' ? colors.primary : colors.sub}
                />
              </Pressable>
            ) : null}
            {(club.roles ?? []).length ? (
              <Pressable
                onPress={() => {
                  setAudienceType('CUSTOM_ROLE');
                  setPreview(null);
                }}
                accessibilityRole="radio"
                accessibilityLabel="Roles. Select a member role"
                accessibilityState={{ selected: audienceType === 'CUSTOM_ROLE' }}
                style={({ pressed }) => ({
                  minHeight: 64,
                  borderWidth: 1,
                  borderColor: audienceType === 'CUSTOM_ROLE' ? colors.primary : colors.border,
                  backgroundColor: audienceType === 'CUSTOM_ROLE' ? colors.primarySoft : colors.surface,
                  borderRadius: 16,
                  paddingHorizontal: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <Ionicons name="pricetags-outline" size={22} color={audienceType === 'CUSTOM_ROLE' ? colors.accentText : colors.sub} />
                <View style={{ flex: 1 }}>
                  <Text style={typography.subheading}>Roles</Text>
                  <Text style={typography.captionSmall}>Select a member role</Text>
                </View>
                <Ionicons
                  name={audienceType === 'CUSTOM_ROLE' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={audienceType === 'CUSTOM_ROLE' ? colors.primary : colors.sub}
                />
              </Pressable>
            ) : null}
          </View>
          {audienceType === 'CUSTOM_ROLE' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {(club.roles ?? []).map((role) => {
                const accent = roleAccent(colors, role.color);
                return (
                  <Chip
                    key={role.id}
                    label={role.name}
                    tint={accent.tint}
                    selected={outreachRoleId === role.id}
                    onPress={() => {
                      setOutreachRoleId(role.id);
                      setPreview(null);
                    }}
                  />
                );
              })}
            </View>
          ) : null}
          {audienceType === 'MANUAL' ? (
            <MemberPicker
              members={club.members.filter((member) => member.userId !== user?.id)}
              selectedUserIds={outreachMemberIds}
              onChange={(ids) => {
                setOutreachMemberIds(ids);
                setPreview(null);
              }}
            />
          ) : null}
          <Text style={typography.kicker}>MESSAGE</Text>
          <Field
            value={outreachText}
            onChangeText={setOutreachText}
            placeholder="Write a clear message"
            multiline
            maxLength={500}
          />
          <Button
            label={preview ? 'Refresh recipients' : 'Preview recipients'}
            variant="secondary"
            loading={busy}
            onPress={() => void previewOutreach()}
          />
          {preview ? (
            <>
              <Text style={typography.kicker}>RECIPIENTS ({preview.count})</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {preview.recipients.slice(0, 7).map((recipient, index) => (
                  <Avatar
                    key={recipient.id}
                    name={recipient.name}
                    uri={recipient.avatarUrl}
                    size={38}
                    style={{ marginLeft: index ? -7 : 0 }}
                  />
                ))}
                {preview.count > 7 ? (
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      marginLeft: -7,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={typography.captionSmall}>+{preview.count - 7}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={typography.kicker}>DELIVERY</Text>
              <Card padded>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="paper-plane-outline" size={21} color={colors.ink} />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.subheading}>In-app + push</Text>
                    <Text style={typography.captionSmall}>Members receive this through their enabled notifications.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.sub} />
                </View>
              </Card>
              <Button
                label={`Send to ${preview.count} member${preview.count === 1 ? '' : 's'}`}
                disabled={!outreachText.trim()}
                loading={busy}
                onPress={() => void sendOutreachNow()}
              />
              <Text style={[typography.captionSmall, { textAlign: 'center' }]}>
                Only club officers with communication permission can message members.
              </Text>
            </>
          ) : null}
        </View>
      </Sheet>
    </AppBackdrop>
  );
}
