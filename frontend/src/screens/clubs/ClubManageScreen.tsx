import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  API_USER_MESSAGE,
  createClubChannel,
  createClubRole,
  deleteClub,
  deleteClubChannel,
  deleteClubRole,
  getClubShareUrl,
  previewClubOutreach,
  sendClubOutreach,
  updateClubChannel,
  updateClubProfile,
  updateClubRole,
  updateOfficerPermissions,
  uploadClubAvatar,
  type ClubOutreachAudience,
  type ClubOutreachPreview,
} from '../../api';
import type { RootStackParamList } from '../../../App';
import type { ClubChannelRow, ClubRole, ClubRoleColor } from '../../types';
import {
  AppBackdrop,
  Banner,
  Button,
  Card,
  Chip,
  Field,
  ListRow,
  ScreenHeader,
  Sheet,
  StatSlab,
} from '../../components/ui';
import {
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

type Props = NativeStackScreenProps<RootStackParamList, 'ClubManage'>;
type Panel = 'profile' | 'roles' | 'channels' | 'permissions' | 'outreach' | null;

const ROLE_COLOR_OPTIONS: Array<ClubRoleColor> = [
  'scarlet',
  'blue',
  'green',
  'amber',
  'pink',
  'violet',
  'teal',
];

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
  const insets = useSafeAreaInsets();
  const [panel, setPanel] = useState<Panel>(null);
  const [profileName, setProfileName] = useState('');
  const [profileDescription, setProfileDescription] = useState('');
  const [profilePublic, setProfilePublic] = useState(true);

  // Role editor state
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState<ClubRoleColor | null>(null);
  const [roleSelfAssign, setRoleSelfAssign] = useState(false);
  const [editingRole, setEditingRole] = useState<ClubRole | null>(null);

  // Channel editor state
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [channelRoleIds, setChannelRoleIds] = useState<string[]>([]);
  const [editingChannel, setEditingChannel] = useState<ClubChannelRow | null>(null);

  const [outreachText, setOutreachText] = useState('');
  const [audienceType, setAudienceType] = useState<'ALL' | 'NON_RSVP' | 'OFFICER' | 'CUSTOM_ROLE'>('ALL');
  const [outreachRoleId, setOutreachRoleId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ClubOutreachPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const analytics = useMemo(() => {
    const responses = meetings.reduce(
      (sum, meeting) => sum + meeting.rsvpCounts.going + meeting.rsvpCounts.maybe + meeting.rsvpCounts.notGoing,
      0,
    );
    const possible = (club?.members.length ?? 0) * meetings.length;
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
      responseRate: possible ? Math.round((responses / possible) * 100) : 0,
      nextMeeting,
      nonRsvpCount,
    };
  }, [announcements.length, club?.members.length, meetings]);

  const customChannels = useMemo(
    () => channels.filter((channel) => channel.kind === 'CUSTOM'),
    [channels],
  );

  if (loading && !club) {
    return <ClubScreenLoading title="Officer desk" onBack={() => navigation.goBack()} />;
  }

  if (!club || !isLeader) {
    return (
      <AppBackdrop>
        <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: insets.top + spacing.md }}>
          <ScreenHeader title="Officer desk" onBack={() => navigation.goBack()} />
          <Banner kind="error" message="Leader access is required to manage this club." />
        </View>
      </AppBackdrop>
    );
  }

  const uploadPhoto = async () => {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo permission needed', 'Allow photo access to update the club image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const uploaded = await uploadClubAvatar(clubId, result.assets[0].uri);
      setClub((current) => current ? { ...current, avatarUrl: uploaded.avatarUrl } : current);
    } catch {
      Alert.alert('Could not update club photo', API_USER_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  const openProfile = () => {
    setProfileName(club.name);
    setProfileDescription(club.description);
    setProfilePublic(club.isPublic);
    setPanel('profile');
  };

  const saveProfile = async () => {
    if (!profileName.trim() || !profileDescription.trim()) {
      Alert.alert('Missing profile details', 'Add a club name and description.');
      return;
    }
    setBusy(true);
    try {
      const updated = await updateClubProfile(clubId, {
        name: profileName.trim(),
        description: profileDescription.trim(),
        isPublic: profilePublic,
      });
      setClub((current) => current ? { ...current, ...updated } : current);
      setPanel(null);
    } catch {
      Alert.alert('Could not update club profile', API_USER_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  // ── Roles ──
  const resetRoleEditor = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleColor(null);
    setRoleSelfAssign(false);
  };

  const startEditRole = (role: ClubRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleColor(role.color ?? null);
    setRoleSelfAssign(Boolean(role.isSelfAssignable));
  };

  const saveRole = async () => {
    if (!roleName.trim()) return;
    setBusy(true);
    try {
      if (editingRole) {
        await updateClubRole(clubId, editingRole.id, {
          name: roleName.trim(),
          color: roleColor,
          isSelfAssignable: roleSelfAssign,
        });
      } else {
        await createClubRole(clubId, {
          name: roleName.trim(),
          color: roleColor,
          isSelfAssignable: roleSelfAssign,
        });
      }
      resetRoleEditor();
      await refresh();
    } catch {
      Alert.alert(editingRole ? 'Could not update role' : 'Could not create role', API_USER_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  // ── Channels ──
  const resetChannelEditor = () => {
    setEditingChannel(null);
    setChannelName('');
    setChannelDescription('');
    setChannelRoleIds([]);
  };

  const startEditChannel = (channel: ClubChannelRow) => {
    setEditingChannel(channel);
    setChannelName(channel.name);
    setChannelDescription(channel.description ?? '');
    setChannelRoleIds(channel.allowedRoleIds);
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
        });
        setChannels((current) =>
          current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
        );
      } else {
        const created = await createClubChannel(clubId, {
          name: channelName.trim(),
          description: channelDescription.trim() || undefined,
          allowedRoleIds: channelRoleIds,
        });
        setChannels((current) => [
          ...current,
          { ...created, unreadCount: 0, lastMessageAt: null, lastMessagePreview: null, canPost: true },
        ]);
      }
      resetChannelEditor();
    } catch {
      Alert.alert(
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
            .catch(() => Alert.alert('Could not delete channel', API_USER_MESSAGE)),
        },
      ],
    );
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
    return { type: 'ALL' };
  };

  const previewOutreach = async () => {
    const selectedAudience = audience();
    if (!selectedAudience) {
      Alert.alert('Choose an audience', 'Select a meeting or member tag first.');
      return;
    }
    setBusy(true);
    try {
      setPreview(await previewClubOutreach(clubId, selectedAudience));
    } catch {
      Alert.alert('Could not preview audience', API_USER_MESSAGE);
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
      Alert.alert('Outreach sent', `${result.sent} notification${result.sent === 1 ? '' : 's'} queued.`);
    } catch {
      Alert.alert('Could not send outreach', API_USER_MESSAGE);
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
            <StatSlab label="RSVP RATE" value={`${analytics.responseRate}%`} icon="checkbox" tint={colors.successSoft} />
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
                last
              />
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
                icon="chatbubbles-outline"
                title="Channels"
                sub={`${customChannels.length} custom channel${customChannels.length === 1 ? '' : 's'} · role-gated chat spaces`}
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
                onPress={() => setPanel('permissions')}
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
                onPress={() => Alert.alert(
                  'Delete club?',
                  `This permanently deletes ${club.name} and all club data.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => void deleteClub(clubId)
                        .then(() => navigation.popToTop())
                        .catch(() => Alert.alert('Could not delete club', API_USER_MESSAGE)),
                    },
                  ],
                )}
              />
            </Card>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Profile sheet ── */}
      <Sheet visible={panel === 'profile'} onClose={() => setPanel(null)} title="Photo and identity" scrollable>
        <View style={{ gap: spacing.md }}>
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
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip label="Public" selected={profilePublic} onPress={() => setProfilePublic(true)} />
            <Chip label="Private" selected={!profilePublic} onPress={() => setProfilePublic(false)} />
          </View>
          <Button label="Update club photo" icon="camera-outline" loading={busy} onPress={() => void uploadPhoto()} />
          <Button label="Save profile" loading={busy} onPress={() => void saveProfile()} />
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
                    label={color}
                    selected={roleColor === color}
                    tint={accent.tint}
                    onPress={() => setRoleColor(roleColor === color ? null : color)}
                  />
                );
              })}
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

          {(club.roles ?? []).map((role) => {
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
                                .catch(() => Alert.alert('Could not delete role', API_USER_MESSAGE)),
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
            Custom channels are members-only chat spaces. Gate one to specific roles to make it
            private — officers can always see every channel.
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
            const gatedNames = channel.allowedRoleIds
              .map((roleId) => (club.roles ?? []).find((role) => role.id === roleId)?.name)
              .filter(Boolean)
              .join(', ');
            return (
              <Card key={channel.id}>
                <ListRow
                  icon={channelIcon(channel.kind)}
                  title={channel.name}
                  sub={
                    isCustom
                      ? gatedNames
                        ? `Only: ${gatedNames}`
                        : 'All members'
                      : 'Built-in channel'
                  }
                  right={
                    isCustom ? (
                      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
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
        <View style={{ gap: spacing.sm }}>
          {CLUB_PERMISSION_OPTIONS.map((permission) => {
            const required = DEFAULT_OFFICER_PERMISSIONS.includes(permission.value);
            const enabled = required || club.officerPermissions.includes(permission.value);
            return (
              <Card key={permission.value}>
                <ListRow
                  icon={enabled ? 'checkmark-circle' : 'ellipse-outline'}
                  title={permission.title}
                  sub={required ? 'Always enabled for officers' : permission.body}
                  tint={enabled ? colors.successSoft : colors.surfaceAlt}
                  onPress={required ? undefined : () => {
                    const next = enabled
                      ? club.officerPermissions.filter((item) => item !== permission.value)
                      : [...club.officerPermissions, permission.value];
                    void updateOfficerPermissions(clubId, next)
                      .then((updated) => setClub((current) => current ? { ...current, officerPermissions: updated.officerPermissions } : current))
                      .catch(() => Alert.alert('Could not update permissions', API_USER_MESSAGE));
                  }}
                  last
                />
              </Card>
            );
          })}
        </View>
      </Sheet>

      {/* ── Outreach sheet ── */}
      <Sheet visible={panel === 'outreach'} onClose={() => setPanel(null)} title="Bulk outreach" scrollable>
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Chip
              label="All members"
              selected={audienceType === 'ALL'}
              onPress={() => {
                setAudienceType('ALL');
                setPreview(null);
              }}
            />
            {meetings[0] ? (
              <Chip
                label="Next meeting non-RSVPs"
                selected={audienceType === 'NON_RSVP'}
                onPress={() => {
                  setAudienceType('NON_RSVP');
                  setPreview(null);
                }}
              />
            ) : null}
            <Chip
              label="Officers"
              selected={audienceType === 'OFFICER'}
              onPress={() => {
                setAudienceType('OFFICER');
                setPreview(null);
              }}
            />
            {(club.roles ?? []).length ? (
              <Chip
                label="Role"
                selected={audienceType === 'CUSTOM_ROLE'}
                onPress={() => {
                  setAudienceType('CUSTOM_ROLE');
                  setPreview(null);
                }}
              />
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
          <Field value={outreachText} onChangeText={setOutreachText} placeholder="Write a clear message" multiline />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button label="Preview" variant="secondary" loading={busy} onPress={() => void previewOutreach()} />
            <Button label="Send" disabled={!preview || !outreachText.trim()} loading={busy} onPress={() => void sendOutreachNow()} />
          </View>
          {preview ? (
            <>
              <Banner kind="info" message={`${preview.count} recipient${preview.count === 1 ? '' : 's'} · ${preview.audience}`} />
              {preview.recipients.slice(0, 6).map((recipient) => (
                <ListRow
                  key={recipient.id}
                  icon="person-outline"
                  title={recipient.name}
                  sub={recipient.role}
                  last
                />
              ))}
              {preview.count > 6 ? (
                <Text style={typography.captionSmall}>+{preview.count - 6} more recipients</Text>
              ) : null}
            </>
          ) : null}
        </View>
      </Sheet>
    </AppBackdrop>
  );
}
