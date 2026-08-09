import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  API_USER_MESSAGE,
  addClubMessageReaction,
  createClubAnnouncement,
  createReport,
  deleteClubAnnouncement,
  deleteClubChannelMessage,
  getClubChannelMessages,
  markClubChannelRead,
  removeClubMessageReaction,
  sendClubChannelMessage,
  sendClubChannelTyping,
  uploadClubMessageImage,
  type ClubVisibility,
} from '../../api';
import type { RootStackParamList } from '../../../App';
import type { ClubChannelRow, ClubMessage } from '../../types';
import {
  AppBackdrop,
  Avatar,
  Button,
  Card,
  Chip,
  ContentImage,
  CountBubble,
  Field,
  ScreenHeader,
  Sheet,
  Tag,
  TypingIndicator,
} from '../../components/ui';
import {
  ClubEmptyState,
  ClubScreenLoading,
  RoleTargetPicker,
  channelIcon,
  roleAccent,
} from '../../components/clubs';
import { MessageComposer, MessageList } from '../../components/messages';
import { useClub } from '../../hooks/useClub';
import { useAuth } from '../../context/AuthContext';
import { REALTIME_CHAT_EVENTS, useRealtimeChannel } from '../../hooks/useRealtimeChannel';
import { realtimeUserId, useRealtimeTyping } from '../../hooks/useRealtimeTyping';
import {
  createThemedStyles,
  spacing,
  useTheme,
} from '../../theme';
import { formatDateTime } from '../../utils/format';
import { getUiPreviewMode } from '../../dev/previewMode';

import { toast } from '../../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'ClubChat'>;

const POLL_REALTIME_MS = 20000;
const POLL_FALLBACK_MS = 4000;

function previewChatMessages(currentUserId?: string): ClubMessage[] {
  const createdAt = (minutesAgo: number) =>
    new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
  return [
    {
      id: 'preview-chat-1',
      clubId: 'preview-photography',
      channelId: 'preview-channel-general',
      userId: 'preview-officer',
      content: 'The light was unreal this morning. Here’s one from the walk!',
      imageUrl: 'preview://photography-club-hero',
      createdAt: createdAt(34),
      user: { id: 'preview-officer', name: 'Alex Chen', avatarUrl: null },
      reactions: [
        { emoji: '❤️', userId: 'preview-member-1' },
        { emoji: '❤️', userId: currentUserId ?? 'preview-member-2' },
      ],
    },
    {
      id: 'preview-chat-2',
      clubId: 'preview-photography',
      channelId: 'preview-channel-general',
      userId: 'preview-member-1',
      content: 'That framing is so good. Are you bringing it to critique night?',
      createdAt: createdAt(28),
      user: { id: 'preview-member-1', name: 'Jordan Kim', avatarUrl: null },
      reactions: [],
      replyTo: {
        id: 'preview-chat-1',
        content: 'The light was unreal this morning. Here’s one from the walk!',
        userId: 'preview-officer',
        user: { id: 'preview-officer', name: 'Alex Chen' },
      },
    },
    {
      id: 'preview-chat-3',
      clubId: 'preview-photography',
      channelId: 'preview-channel-general',
      userId: currentUserId ?? 'preview-member-2',
      content: 'Absolutely — I’d love notes on the color grade.',
      createdAt: createdAt(22),
      user: { id: currentUserId ?? 'preview-member-2', name: 'You', avatarUrl: null },
      reactions: [],
    },
  ];
}

function channelSub(channel: ClubChannelRow): string {
  if (channel.kind === 'ANNOUNCEMENTS') return 'Official club updates';
  if (channel.kind === 'OFFICERS') return 'Leadership only';
  if (channel.kind === 'CUSTOM') {
    return channel.allowedRoleIds.length || channel.allowedUserIds.length ? 'Private channel' : 'Members only';
  }
  return 'Members only';
}

export default function ClubChatScreen({ route, navigation }: Props) {
  const { clubId, channelId } = route.params;
  const {
    club,
    announcements,
    channels,
    meetings,
    setChannels,
    can,
    loading,
    refresh,
    setAnnouncements,
  } = useClub(clubId);
  const { user } = useAuth();
  const { colors, typography } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [previewMode] = useState(getUiPreviewMode);
  const isClubPreview = __DEV__ && Boolean(previewMode?.startsWith('club-'));
  const [messages, setMessages] = useState<ClubMessage[]>(
    () => isClubPreview && previewMode !== 'club-chat-empty'
      ? previewChatMessages(user?.id)
      : [],
  );
  const [previewTypingIds] = useState<string[]>(
    () => isClubPreview && previewMode !== 'club-chat-empty'
      ? ['preview-member-2']
      : [],
  );
  const [draft, setDraft] = useState('');
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ClubMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [pingPickerOpen, setPingPickerOpen] = useState(false);
  const [pingRoleIds, setPingRoleIds] = useState<string[]>([]);
  const [announcementText, setAnnouncementText] = useState('');
  const [visibility, setVisibility] = useState<ClubVisibility>('PUBLIC');
  const [targetRoleIds, setTargetRoleIds] = useState<string[]>([]);
  const [announcementMeetingId, setAnnouncementMeetingId] = useState<string | null>(null);
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [denied, setDenied] = useState(previewMode === 'club-chat-private');
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (previewMode !== 'club-announcements-new') return;
    const timer = setTimeout(() => setComposerOpen(true), 250);
    return () => clearTimeout(timer);
  }, [previewMode]);

  const channel = useMemo(
    () => channels.find((row) => row.id === channelId) ?? null,
    [channels, channelId],
  );
  const isAnnouncements = channel?.kind === 'ANNOUNCEMENTS';
  const { typingUserIds: realtimeTypingIds, markTyping, removeTypingUser } = useRealtimeTyping(
    `${clubId}:${channelId}`,
    user?.id,
  );
  const typingIds = isClubPreview ? previewTypingIds : realtimeTypingIds;
  const canPostAnnouncements = can('POST_ANNOUNCEMENTS');
  const canDelete = club?.myRole === 'OWNER' || club?.myRole === 'ADMIN' || can('DELETE_MESSAGES');
  const canPing = canPostAnnouncements || club?.myRole === 'OFFICER';
  const rolesById = useMemo(
    () => new Map((club?.roles ?? []).map((role) => [role.id, role])),
    [club?.roles],
  );
  const selectedAnnouncementMeeting = useMemo(
    () => meetings.find((meeting) => meeting.id === announcementMeetingId) ?? null,
    [announcementMeetingId, meetings],
  );

  const clearChannelUnread = useCallback(
    (id: string) => {
      setChannels((current) =>
        current.some((row) => row.id === id && row.unreadCount > 0)
          ? current.map((row) => (row.id === id ? { ...row, unreadCount: 0 } : row))
          : current,
      );
    },
    [setChannels],
  );

  const loadMessages = useCallback(async () => {
    if (!channel || isAnnouncements) return;
    try {
      const response = await getClubChannelMessages(clubId, channel.id);
      setMessages(response.messages);
      setDenied(false);
      clearChannelUnread(channel.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.toLowerCase().includes('access')) setDenied(true);
      // Otherwise keep the current room visible until the next poll succeeds.
    }
  }, [channel, clubId, clearChannelUnread, isAnnouncements]);

  const realtimeConnected = useRealtimeChannel(
    !isClubPreview && channel && !isAnnouncements
      ? `club-${clubId}-channel-${channel.id}`
      : null,
    REALTIME_CHAT_EVENTS,
    ({ event, payload }) => {
      if (event === 'typing') {
        markTyping(payload);
        return;
      }
      if (event === 'new_message') removeTypingUser(realtimeUserId(payload));
      void loadMessages();
    },
  );

  useEffect(() => {
    if (isClubPreview) return;
    setMessages([]);
    setDraft('');
    setPendingImageUri(null);
    setReplyTo(null);
    setPingRoleIds([]);
    setDenied(false);
  }, [channelId, isClubPreview]);

  useEffect(() => {
    if (!channel) return;
    if (isClubPreview) return;
    if (isAnnouncements) {
      void markClubChannelRead(clubId, channel.id)
        .then(() => clearChannelUnread(channel.id))
        .catch(() => {});
      return;
    }
    void loadMessages();
    const interval = setInterval(
      () => void loadMessages(),
      realtimeConnected ? POLL_REALTIME_MS : POLL_FALLBACK_MS,
    );
    return () => clearInterval(interval);
  }, [channel, clubId, clearChannelUnread, isAnnouncements, isClubPreview, loadMessages, realtimeConnected]);

  const send = async () => {
    if ((!draft.trim() && !pendingImageUri) || !channel) return;
    setSending(true);
    try {
      const uploaded = pendingImageUri
        ? await uploadClubMessageImage(clubId, channel.id, pendingImageUri)
        : null;
      const sent = await sendClubChannelMessage(
        clubId,
        channel.id,
        draft.trim(),
        pingRoleIds.length ? pingRoleIds : undefined,
        replyTo?.id,
        uploaded?.imageUrl,
      );
      setMessages((current) => [...current, sent]);
      setDraft('');
      setPendingImageUri(null);
      setReplyTo(null);
      setPingRoleIds([]);
    } catch {
      toast.error('Could not send message', API_USER_MESSAGE);
    } finally {
      setSending(false);
    }
  };

  const choosePhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.info('Photo permission needed', 'Allow photo access to share an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.82,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setPendingImageUri(result.assets[0].uri);
      }
    } catch {
      toast.error('Could not choose photo', 'Try selecting the image again.');
    }
  };

  const pingTyping = (value: string) => {
    setDraft(value);
    if (!value.trim() || typingTimer.current || !channel) return;
    typingTimer.current = setTimeout(() => { typingTimer.current = null; }, 2500);
    void sendClubChannelTyping(clubId, channel.id).catch(() => {});
  };

  const togglePingRole = (roleId: string) => {
    setPingRoleIds((current) => {
      const has = current.includes(roleId);
      const next = has ? current.filter((id) => id !== roleId) : [...current, roleId];
      const role = rolesById.get(roleId);
      if (role && !has && !draft.includes(`@${role.name}`)) {
        setDraft((text) => (text ? `${text} @${role.name} ` : `@${role.name} `));
      }
      return next;
    });
  };

  const messageActions = (message: ClubMessage) => {
    const mine = message.userId === user?.id;
    const actions: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Copy text',
        onPress: () => void Clipboard.setStringAsync(message.content).catch(() => {}),
      },
    ];
    if (channel?.kind !== 'OFFICERS') {
      actions.unshift(
        {
          text: 'Reply',
          onPress: () => setReplyTo(message),
        },
        {
          text: 'React ❤️',
          onPress: () => void toggleHeartReaction(message),
        },
      );
    }
    if (!mine) {
      actions.unshift({
        text: 'Report',
        onPress: () => void createReport({
          clubId,
          targetUserId: message.userId,
          ...(channel?.kind === 'OFFICERS'
            ? { clubOfficerMessageId: message.id }
            : { clubMessageId: message.id }),
          reason: 'HARASSMENT',
        }).then(() => toast.success('Report sent', 'Thanks. We logged this message for review.')),
      });
    }
    if ((mine || canDelete) && channel) {
      actions.unshift({
        text: 'Delete',
        style: 'destructive',
        onPress: () => void deleteClubChannelMessage(clubId, channel.id, message.id)
          .then(() => setMessages((current) => current.filter((item) => item.id !== message.id)))
          .catch(() => toast.error('Could not delete message', API_USER_MESSAGE)),
      });
    }
    Alert.alert(message.user.name, message.content, actions);
  };

  const toggleHeartReaction = async (message: ClubMessage) => {
    if (!channel || channel.kind === 'OFFICERS') return;
    const hearted = message.reactions?.some(
      (reaction) => reaction.emoji === '❤️' && reaction.userId === user?.id,
    );
    try {
      const updated = hearted
        ? await removeClubMessageReaction(clubId, channel.id, message.id, '❤️')
        : await addClubMessageReaction(clubId, channel.id, message.id, '❤️');
      setMessages((current) =>
        current.map((item) => item.id === updated.id ? updated : item));
    } catch {
      toast.error('Could not update reaction', API_USER_MESSAGE);
    }
  };

  const postAnnouncement = async () => {
    if (!announcementText.trim()) return;
    setSending(true);
    try {
      const created = await createClubAnnouncement(clubId, {
        content: announcementText.trim(),
        visibility,
        targetRoleIds,
        meetingId: announcementMeetingId,
        notifyMembers,
      });
      setAnnouncements((current) => [created, ...current]);
      setAnnouncementText('');
      setTargetRoleIds([]);
      setAnnouncementMeetingId(null);
      setNotifyMembers(true);
      setComposerOpen(false);
    } catch {
      toast.error('Could not post announcement', API_USER_MESSAGE);
    } finally {
      setSending(false);
    }
  };

  const openAnnouncementActions = (item: (typeof announcements)[number]) => {
    const mine = item.userId === user?.id;
    Alert.alert(item.user.name, item.content, [
      {
        text: 'Copy text',
        onPress: () => void Clipboard.setStringAsync(item.content).catch(() => {}),
      },
      ...(mine || canDelete ? [{
        text: 'Delete',
        style: 'destructive' as const,
        onPress: () => void deleteClubAnnouncement(clubId, item.id)
          .then(() => setAnnouncements((current) => current.filter((row) => row.id !== item.id))),
      }] : []),
      ...(!mine ? [{
        text: 'Report',
        onPress: () => void createReport({
          clubId,
          clubAnnouncementId: item.id,
          targetUserId: item.userId,
          reason: 'OTHER',
        }),
      }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  // ── Channel switcher rail ──
  const switcher = channels.length > 1 ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll}>
      <View style={styles.switcher}>
        {channels.map((row) => (
          <View key={row.id} style={styles.switcherItem}>
            <Chip
              label={row.name}
              accessibilityLabel={
                row.unreadCount > 0 && row.id !== channelId
                  ? `${row.name}, ${row.unreadCount} unread ${row.unreadCount === 1 ? 'message' : 'messages'}`
                  : row.name
              }
              icon={channelIcon(row.kind)}
              selected={row.id === channelId}
              onPress={
                row.id === channelId
                  ? undefined
                  : () => navigation.setParams({ channelId: row.id })
              }
            />
            {row.unreadCount > 0 && row.id !== channelId ? (
              <CountBubble count={row.unreadCount} style={styles.switcherBadge} />
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  ) : null;

  if (loading && !club) {
    return <ClubScreenLoading title="Club chat" onBack={() => navigation.goBack()} />;
  }

  if (!channel || denied) {
    return (
      <AppBackdrop>
        <View style={[styles.denied, { paddingTop: insets.top + spacing.md }]}>
          <ScreenHeader title="Club chat" kicker={club?.name} onBack={() => navigation.goBack()} />
          {loading ? null : (
            <ClubEmptyState
              variant="private"
              title="This space is private"
              body="Officer and role channels are only visible to the people who manage them."
              actionLabel="Back to club"
              onAction={() => navigation.navigate('ClubDetail', { clubId })}
            />
          )}
        </View>
      </AppBackdrop>
    );
  }

  if (isAnnouncements) {
    return (
      <AppBackdrop>
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.announcementList,
            { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
          ]}
          ListHeaderComponent={
            <View style={{ gap: spacing.md }}>
              <ScreenHeader
                title="Announcements"
                kicker={club?.name}
                onBack={() => navigation.goBack()}
                right={canPostAnnouncements ? <Button label="+ New" size="sm" onPress={() => setComposerOpen(true)} /> : undefined}
              />
              {switcher}
            </View>
          }
          ListHeaderComponentStyle={{ marginBottom: spacing.lg }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Card padded>
              <Pressable
                onPress={() => openAnnouncementActions(item)}
                onLongPress={() => openAnnouncementActions(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.user.name}: ${item.content}. ${formatDateTime(item.createdAt)}`}
                accessibilityHint="Opens announcement actions"
              >
                <View style={styles.author}>
                  <Avatar name={item.user.name} uri={item.user.avatarUrl} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.subheading}>{item.user.name}</Text>
                    <Text style={typography.captionSmall}>{formatDateTime(item.createdAt)}</Text>
                  </View>
                  <Tag label={item.visibility} />
                </View>
                <Text style={[typography.body, { marginTop: spacing.md }]}>{item.content}</Text>
              </Pressable>
              {item.meeting ? (
                  <Pressable
                    onPress={() => navigation.navigate('ClubMeeting', {
                      clubId,
                      meetingId: item.meeting!.id,
                    })}
                    accessibilityRole="button"
                    accessibilityLabel={`Open meeting ${item.meeting.title}`}
                    style={({ pressed }) => ({
                      marginTop: spacing.md,
                      padding: spacing.md,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceAlt,
                      opacity: pressed ? 0.72 : 1,
                    })}
                  >
                    <Text style={typography.subheading}>{item.meeting.title}</Text>
                    <Text style={typography.captionSmall}>
                      {formatDateTime(item.meeting.meetingTime)} · {item.meeting.location}
                    </Text>
                  </Pressable>
              ) : null}
            </Card>
          )}
          ListEmptyComponent={
            <ClubEmptyState
              variant="chat"
              title="No announcements yet"
              body="Official updates will appear here."
              actionLabel={canPostAnnouncements ? 'Post announcement' : 'Back to club'}
              onAction={() => {
                if (canPostAnnouncements) {
                  setComposerOpen(true);
                } else {
                  navigation.navigate('ClubDetail', { clubId });
                }
              }}
            />
          }
        />
        <Sheet visible={composerOpen} onClose={() => setComposerOpen(false)} title="New announcement" scrollable>
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {([
                ['PUBLIC', 'Everyone'],
                ['MEMBERS', 'Members'],
                ['OFFICERS', 'Officers'],
              ] as Array<[ClubVisibility, string]>).map(([value, label]) => (
                <Chip
                  key={value}
                  label={label}
                  selected={visibility === value}
                  onPress={() => setVisibility(value)}
                />
              ))}
            </View>
            <RoleTargetPicker
              roles={club?.roles ?? []}
              selectedRoleIds={targetRoleIds}
              onChange={setTargetRoleIds}
            />
            <Field
              value={announcementText}
              onChangeText={setAnnouncementText}
              placeholder="Share an update with the club"
              multiline
              maxLength={500}
            />
            {meetings.length ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={typography.kicker}>ATTACH A MEETING</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {meetings.slice(0, 8).map((meeting) => (
                      <Chip
                        key={meeting.id}
                        label={meeting.title}
                        icon="calendar-outline"
                        selected={announcementMeetingId === meeting.id}
                        onPress={() => setAnnouncementMeetingId((current) =>
                          current === meeting.id ? null : meeting.id)}
                      />
                    ))}
                  </View>
                </ScrollView>
                {selectedAnnouncementMeeting ? (
                  <Card padded>
                    <Text style={typography.subheading}>{selectedAnnouncementMeeting.title}</Text>
                    <Text style={typography.captionSmall}>
                      {formatDateTime(selectedAnnouncementMeeting.meetingTime)} · {selectedAnnouncementMeeting.location}
                    </Text>
                  </Card>
                ) : null}
              </View>
            ) : null}
            <View
              style={{
                minHeight: 56,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                backgroundColor: colors.surface,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={typography.subheading}>Notify members</Text>
                <Text style={typography.captionSmall}>Send an in-app and push notification.</Text>
              </View>
              <Switch
                value={notifyMembers}
                onValueChange={setNotifyMembers}
                accessibilityLabel="Notify members"
                accessibilityHint="Send an in-app and push notification"
                trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
              />
            </View>
            <Button label="Publish announcement" loading={sending} onPress={() => void postAnnouncement()} />
            <Text style={[typography.captionSmall, { textAlign: 'center' }]}>
              Only club officers with announcement permission can post.
            </Text>
          </View>
        </Sheet>
      </AppBackdrop>
    );
  }

  return (
    <AppBackdrop>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.chatHeader, { paddingTop: insets.top + spacing.md }]}>
          <ScreenHeader
            title={channel.name}
            kicker={`${club?.name ?? 'CLUB'} · ${channelSub(channel)}`}
            onBack={() => navigation.goBack()}
            right={
              canPing && (club?.roles ?? []).length ? (
                <Button label="@" variant="secondary" size="sm" onPress={() => setPingPickerOpen(true)} />
              ) : undefined
            }
          />
          {switcher}
        </View>
        <MessageList
          messages={messages}
          currentUserId={user?.id ?? (isClubPreview ? 'preview-member-2' : undefined)}
          onLongPress={messageActions}
          emptyActionLabel="Back to club"
          onEmptyAction={() => navigation.navigate('ClubDetail', { clubId })}
          onReact={channel.kind === 'OFFICERS' ? undefined : (message) => void toggleHeartReaction(message)}
        />
        {typingIds.length ? (
          <TypingIndicator
            label="Someone is typing…"
            style={{ paddingHorizontal: spacing.xl }}
          />
        ) : null}
        {pingRoleIds.length ? (
          <View style={styles.pingBar}>
            <Text style={typography.captionSmall}>Pinging:</Text>
            {pingRoleIds.map((roleId) => {
              const role = rolesById.get(roleId);
              if (!role) return null;
              const accent = roleAccent(colors, role.color);
              return (
                <Pressable
                  key={roleId}
                  onPress={() => togglePingRole(roleId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${role.name} mention`}
                >
                  <Tag label={`@${role.name} ×`} tint={accent.tint} />
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {replyTo ? (
          <View
            style={{
              marginHorizontal: spacing.xl,
              marginBottom: spacing.xs,
              padding: spacing.sm,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceAlt,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={typography.captionSmall}>Replying to {replyTo.user.name}</Text>
              <Text style={typography.captionSmall} numberOfLines={1}>{replyTo.content}</Text>
            </View>
            <Button label="×" size="sm" variant="ghost" onPress={() => setReplyTo(null)} />
          </View>
        ) : null}
        {pendingImageUri ? (
          <View style={styles.attachmentPreview}>
            <ContentImage
              source={{ uri: pendingImageUri }}
              seed="pending-club-chat-photo"
              aspectRatio={16 / 9}
              accessibilityLabel="Photo ready to send"
              style={styles.attachmentImage}
            />
            <Button
              label="Remove"
              size="sm"
              variant="secondary"
              onPress={() => setPendingImageUri(null)}
            />
          </View>
        ) : null}
        <MessageComposer
          value={draft}
          onChangeText={pingTyping}
          onSend={() => void send()}
          sending={sending}
          onAttach={channel.kind === 'OFFICERS' ? undefined : () => void choosePhoto()}
          hasAttachment={Boolean(pendingImageUri)}
          placeholder={channel.kind === 'OFFICERS' ? 'Message officers...' : `Message ${channel.name}...`}
        />
      </KeyboardAvoidingView>

      <Sheet
        visible={pingPickerOpen}
        onClose={() => setPingPickerOpen(false)}
        title="Ping a role"
        kicker="MEMBERS WITH THESE ROLES GET NOTIFIED"
      >
        <View style={styles.pingPicker}>
          {(club?.roles ?? []).map((role) => {
            const selected = pingRoleIds.includes(role.id);
            const accent = roleAccent(colors, role.color);
            return (
              <Chip
                key={role.id}
                label={`@${role.name}${role.memberCount != null ? ` · ${role.memberCount}` : ''}`}
                selected={selected}
                tint={accent.tint}
                onPress={() => togglePingRole(role.id)}
              />
            );
          })}
          <Button label="Done" onPress={() => setPingPickerOpen(false)} />
        </View>
      </Sheet>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles(() => ({
  denied: { flex: 1, paddingHorizontal: spacing.xl, gap: spacing.lg },
  announcementList: { flexGrow: 1, paddingHorizontal: spacing.xl },
  author: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
  chatHeader: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, gap: spacing.sm },
  switcherScroll: { flexGrow: 0 },
  switcher: { flexDirection: 'row' as const, gap: spacing.sm, paddingVertical: 3, paddingRight: spacing.xl },
  switcherItem: { position: 'relative' as const },
  switcherBadge: { position: 'absolute' as const, top: -6, right: -6 },
  pingBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  pingPicker: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  attachmentPreview: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xs,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  attachmentImage: { width: 112, height: 63, borderRadius: 12 },
}));
