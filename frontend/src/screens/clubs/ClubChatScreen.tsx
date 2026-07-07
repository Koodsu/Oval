import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  API_USER_MESSAGE,
  createClubAnnouncement,
  createReport,
  deleteClubAnnouncement,
  deleteClubChannelMessage,
  getClubChannelMessages,
  markClubChannelRead,
  sendClubChannelMessage,
  sendClubChannelTyping,
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
  CountBubble,
  EmptyState,
  Field,
  ScreenHeader,
  Sheet,
  Tag,
  TypingIndicator,
} from '../../components/ui';
import {
  ClubScreenLoading,
  RoleTargetPicker,
  channelIcon,
  roleAccent,
} from '../../components/clubs';
import { MessageComposer, MessageList } from '../../components/messages';
import { useClub } from '../../hooks/useClub';
import { useAuth } from '../../context/AuthContext';
import {
  createThemedStyles,
  spacing,
  useTheme,
} from '../../theme';
import { formatDateTime } from '../../utils/format';

import { toast } from '../../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'ClubChat'>;

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
  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [typingIds, setTypingIds] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [pingPickerOpen, setPingPickerOpen] = useState(false);
  const [pingRoleIds, setPingRoleIds] = useState<string[]>([]);
  const [announcementText, setAnnouncementText] = useState('');
  const [visibility, setVisibility] = useState<ClubVisibility>('PUBLIC');
  const [targetRoleIds, setTargetRoleIds] = useState<string[]>([]);
  const [denied, setDenied] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const channel = useMemo(
    () => channels.find((row) => row.id === channelId) ?? null,
    [channels, channelId],
  );
  const isAnnouncements = channel?.kind === 'ANNOUNCEMENTS';
  const canPostAnnouncements = can('POST_ANNOUNCEMENTS');
  const canDelete = club?.myRole === 'OWNER' || club?.myRole === 'ADMIN' || can('DELETE_MESSAGES');
  const canPing = canPostAnnouncements || club?.myRole === 'OFFICER';
  const rolesById = useMemo(
    () => new Map((club?.roles ?? []).map((role) => [role.id, role])),
    [club?.roles],
  );

  const clearChannelUnread = useCallback(
    (id: string) => {
      setChannels((current) =>
        current.map((row) => (row.id === id ? { ...row, unreadCount: 0 } : row)),
      );
    },
    [setChannels],
  );

  const loadMessages = useCallback(async () => {
    if (!channel || isAnnouncements) return;
    try {
      const response = await getClubChannelMessages(clubId, channel.id);
      setMessages(response.messages);
      setTypingIds(response.typingUserIds);
      setDenied(false);
      clearChannelUnread(channel.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.toLowerCase().includes('access')) setDenied(true);
      // Otherwise keep the current room visible until the next poll succeeds.
    }
  }, [channel, clubId, clearChannelUnread, isAnnouncements]);

  useEffect(() => {
    setMessages([]);
    setTypingIds([]);
    setDraft('');
    setPingRoleIds([]);
    setDenied(false);
  }, [channelId]);

  useEffect(() => {
    if (!channel) return;
    if (isAnnouncements) {
      void markClubChannelRead(clubId, channel.id)
        .then(() => clearChannelUnread(channel.id))
        .catch(() => {});
      return;
    }
    void loadMessages();
    const interval = setInterval(() => void loadMessages(), 4000);
    return () => clearInterval(interval);
  }, [channel, clubId, clearChannelUnread, isAnnouncements, loadMessages]);

  const send = async () => {
    if (!draft.trim() || !channel) return;
    setSending(true);
    try {
      const sent = await sendClubChannelMessage(
        clubId,
        channel.id,
        draft.trim(),
        pingRoleIds.length ? pingRoleIds : undefined,
      );
      setMessages((current) => [...current, sent]);
      setDraft('');
      setPingRoleIds([]);
    } catch {
      toast.error('Could not send message', API_USER_MESSAGE);
    } finally {
      setSending(false);
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

  const postAnnouncement = async () => {
    if (!announcementText.trim()) return;
    setSending(true);
    try {
      const created = await createClubAnnouncement(clubId, {
        content: announcementText.trim(),
        visibility,
        targetRoleIds,
      });
      setAnnouncements((current) => [created, ...current]);
      setAnnouncementText('');
      setTargetRoleIds([]);
      setComposerOpen(false);
    } catch {
      toast.error('Could not post announcement', API_USER_MESSAGE);
    } finally {
      setSending(false);
    }
  };

  // ── Channel switcher rail ──
  const switcher = channels.length > 1 ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll}>
      <View style={styles.switcher}>
        {channels.map((row) => (
          <View key={row.id} style={styles.switcherItem}>
            <Chip
              label={row.name}
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
            <EmptyState
              icon="lock-closed"
              title="This space is private"
              body="Join the club — or pick up the right role — to get access."
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
            <Pressable
              onLongPress={() => {
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
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
            >
              <Card padded>
                <View style={styles.author}>
                  <Avatar name={item.user.name} uri={item.user.avatarUrl} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.subheading}>{item.user.name}</Text>
                    <Text style={typography.captionSmall}>{formatDateTime(item.createdAt)}</Text>
                  </View>
                  <Tag label={item.visibility} />
                </View>
                <Text style={[typography.body, { marginTop: spacing.md }]}>{item.content}</Text>
              </Card>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="megaphone-outline"
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
            />
            <Button label="Post announcement" loading={sending} onPress={() => void postAnnouncement()} />
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
          currentUserId={user?.id}
          onLongPress={messageActions}
          emptyActionLabel="Back to club"
          onEmptyAction={() => navigation.navigate('ClubDetail', { clubId })}
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
                <Pressable key={roleId} onPress={() => togglePingRole(roleId)}>
                  <Tag label={`@${role.name} ×`} tint={accent.tint} />
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <MessageComposer
          value={draft}
          onChangeText={pingTyping}
          onSend={() => void send()}
          sending={sending}
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
}));
