import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addDMReaction,
  blockUser,
  createReport,
  deleteDMMessage,
  getApiErrorMessage,
  getThreadMessages,
  markDMThreadRead,
  removeDMReaction,
  sendDirectMessage,
  sendDMTyping,
} from '../api';
import { REACTION_EMOJIS } from '../constants/reactions';
import { REPORT_REASON_OPTIONS } from '../constants/reportReasons';
import * as Clipboard from 'expo-clipboard';
import { mergeLatestPage } from '../utils/chat';
import { REALTIME_CHAT_EVENTS, useRealtimeChannel } from '../hooks/useRealtimeChannel';
import { RootStackParamList } from '../../App';
import { DirectMessage, FriendUser } from '../types';
import {
  AppBackdrop,
  Avatar,
  Banner,
  EmptyState,
  IconButton,
  ListRow,
  Sheet,
  Sticker,
  TypingIndicator,
} from '../components/ui';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  fonts,
  radii,
  spacing,
  useTheme,
} from '../theme';
import { useAuth } from '../context/AuthContext';
import { formatTime } from '../utils/format';

import { toast } from '../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'Thread'>;

const HEART_EMOJI = '❤️';
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const MESSAGE_PAGE_SIZE = 50;
// Realtime connected → polling is just a safety net. Disconnected → poll fast.
const POLL_REALTIME_MS = 20000;
const POLL_FALLBACK_MS = 3500;

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'TODAY';
  return date
    .toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();
}

export default function ThreadScreen({
  route,
  navigation,
  previewData,
}: Props & {
  previewData?: {
    currentUserId: string;
    otherUser: FriendUser;
    messages: DirectMessage[];
    typingUserIds?: string[];
  };
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  const { threadId, title: titleParam } = route.params;
  const { user } = useAuth();
  // Notification taps deep-link here without a title param — derive the other
  // person's name from the loaded messages instead of showing "Messages".
  const [messages, setMessages] = useState<DirectMessage[]>(previewData?.messages ?? []);
  const [otherUser, setOtherUser] = useState<FriendUser | null>(previewData?.otherUser ?? null);
  const [typingUserIds, setTypingUserIds] = useState<string[]>(previewData?.typingUserIds ?? []);
  const [messageText, setMessageText] = useState('');
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<DirectMessage | null>(null);
  const [reportTarget, setReportTarget] = useState<DirectMessage | null>(null);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReadMessageIdRef = useRef<string | null>(null);
  const messagesRef = useRef<DirectMessage[]>([]);
  messagesRef.current = messages;
  const currentUserId = previewData?.currentUserId ?? user?.id;
  const otherPartyName =
    otherUser?.name ??
    messages.find((message) => message.sender.id !== currentUserId)?.sender.name ??
    null;
  const title = otherPartyName ?? titleParam ?? 'Messages';

  const load = useCallback(
    async (showAlert = false) => {
      if (previewData) return;
      try {
        const response = await getThreadMessages(threadId, { limit: MESSAGE_PAGE_SIZE });
        setOtherUser(response.otherUser);
        setMessages((current) => mergeLatestPage(current, response.messages));
        if (!messagesRef.current.length) setHasMore(!!response.hasMore);
        setTypingUserIds(response.typingUserIds);
        setLoadError(null);
        // Only mark read when something new actually arrived — avoids a
        // write request on every poll tick.
        const lastId = response.messages[response.messages.length - 1]?.id ?? null;
        if (lastId && lastId !== lastReadMessageIdRef.current) {
          lastReadMessageIdRef.current = lastId;
          await markDMThreadRead(threadId);
        }
      } catch (error) {
        setLoadError(getApiErrorMessage(error));
        if (showAlert) {
          toast.error('Could not load thread', getApiErrorMessage(error));
        }
      }
    },
    [previewData, threadId],
  );

  const loadEarlier = useCallback(async () => {
    const oldest = messagesRef.current[0];
    if (!oldest || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const response = await getThreadMessages(threadId, {
        limit: MESSAGE_PAGE_SIZE,
        before: oldest.id,
      });
      setMessages((current) => {
        const existing = new Set(current.map((m) => m.id));
        const older = response.messages.filter((m) => !existing.has(m.id));
        return [...older, ...current];
      });
      setHasMore(!!response.hasMore);
    } catch (error) {
      toast.error('Could not load earlier messages', getApiErrorMessage(error));
    } finally {
      setLoadingEarlier(false);
    }
  }, [loadingEarlier, threadId]);

  const realtimeConnected = useRealtimeChannel(`dm-${threadId}`, REALTIME_CHAT_EVENTS, () => {
    void load(false);
  });

  useFocusEffect(
    useCallback(() => {
      if (previewData) return undefined;
      void load();
      const interval = setInterval(
        () => {
          void load(false);
        },
        realtimeConnected ? POLL_REALTIME_MS : POLL_FALLBACK_MS,
      );
      return () => {
        clearInterval(interval);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      };
    }, [load, previewData, realtimeConnected]),
  );

  const pingTyping = useCallback(
    (draft: string) => {
      if (!draft.trim()) return;
      if (typingTimerRef.current) return;
      typingTimerRef.current = setTimeout(() => {
        typingTimerRef.current = null;
      }, 2500);
      void sendDMTyping(threadId).catch(() => {});
    },
    [threadId],
  );

  const handleSend = async () => {
    if (!messageText.trim()) return;
    setSending(true);
    try {
      const sent = await sendDirectMessage(threadId, messageText.trim(), replyTo?.id);
      setMessageText('');
      setReplyTo(null);
      setMessages((current) => [...current, sent]);
    } catch (error) {
      toast.error('Could not send message', getApiErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const handleReaction = async (message: DirectMessage, emoji: string) => {
    const hasReaction = !!message.reactions?.some(
      (reaction) => reaction.userId === currentUserId && reaction.emoji === emoji,
    );
    try {
      const updated = hasReaction
        ? await removeDMReaction(threadId, message.id, emoji)
        : await addDMReaction(threadId, message.id, emoji);
      setMessages((current) => current.map((item) => (item.id === message.id ? updated : item)));
    } catch (error) {
      toast.error('Could not update reaction', getApiErrorMessage(error));
    }
  };

  const handleHeart = (message: DirectMessage) => handleReaction(message, HEART_EMOJI);

  const openMessageActions = (message: DirectMessage) => {
    setActiveSheet(message);
  };

  const submitReport = async (message: DirectMessage, reason: string) => {
    setReportTarget(null);
    try {
      await createReport({
        directMessageId: message.id,
        targetUserId: message.sender.id,
        reason,
      });
      toast.success('Report sent', 'Thanks. We logged this message for review.');
    } catch (error) {
      toast.error('Could not send report', getApiErrorMessage(error));
    }
  };

  const confirmBlockUser = (target: Pick<FriendUser, 'id' | 'name'>) => {
    setActiveSheet(null);
    Alert.alert(
      `Block ${target.name}?`,
      'They will no longer be able to message you. You can unblock them later from Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await blockUser(target.id);
                toast.success('User blocked', 'They can no longer message you.');
                navigation.goBack();
              } catch (error) {
                toast.error('Could not block user', getApiErrorMessage(error));
              }
            })();
          },
        },
      ],
    );
  };

  const confirmBlockSender = (message: DirectMessage) => confirmBlockUser(message.sender);

  const confirmDeleteMessage = (message: DirectMessage) => {
    setActiveSheet(null);
    Alert.alert('Delete this message?', 'It will be removed for both of you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteDMMessage(threadId, message.id);
              setMessages((current) => current.filter((item) => item.id !== message.id));
            } catch (error) {
              toast.error('Could not delete message', getApiErrorMessage(error));
            }
          })();
        },
      },
    ]);
  };

  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  return (
    <AppBackdrop>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.header}>
            <View style={[styles.threadHeader, accessibilityLayout && styles.threadHeaderLargeText]}>
              <IconButton
                icon="arrow-back"
                onPress={() => navigation.goBack()}
                accessibilityLabel="Go back"
              />
              <Pressable
                style={[styles.headerIdentity, accessibilityLayout && styles.headerIdentityLargeText]}
                onPress={() =>
                  otherUser
                    ? navigation.navigate('UserProfile', { userId: otherUser.id })
                    : undefined
                }
                disabled={!otherUser}
                accessibilityRole="button"
                accessibilityLabel={otherUser ? `View ${otherUser.name}'s profile` : title}
              >
                <Avatar
                  name={title}
                  uri={
                    otherUser?.avatarUrl ??
                    messages.find((message) => message.sender.id !== currentUserId)?.sender.avatarUrl
                  }
                  size={40}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={typography.heading}
                    numberOfLines={accessibilityLayout ? 2 : 1}
                    maxFontSizeMultiplier={2}
                  >
                    {title}
                  </Text>
                  <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
                    {typingUserIds.length ? 'Typing…' : 'Friend'}
                  </Text>
                </View>
              </Pressable>
              <IconButton
                icon="ellipsis-horizontal"
                onPress={() => setThreadMenuOpen(true)}
                accessibilityLabel="Conversation actions"
              />
            </View>
            {loadError ? <Banner message="Couldn't refresh — messages may be stale." kind="error" /> : null}
          </View>

          <FlatList
            inverted
            data={reversedMessages}
            keyExtractor={(message) => message.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title="Start the conversation"
                body="Say hi, share a plan, or send a pod when you’re ready."
              />
            }
            ListHeaderComponent={
              typingUserIds.length ? <TypingIndicator /> : null
            }
            ListFooterComponent={
              hasMore ? (
                <Pressable
                  onPress={() => void loadEarlier()}
                  disabled={loadingEarlier}
                  style={{ alignSelf: 'center', paddingVertical: spacing.md }}
                  accessibilityRole="button"
                  accessibilityLabel="Load earlier messages"
                >
                  <Text style={[typography.caption, { color: colors.accentText }]}>
                    {loadingEarlier ? 'Loading…' : 'Load earlier messages'}
                  </Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item: message, index }) => {
              const previous = reversedMessages[index + 1];
              const mine = message.sender.id === currentUserId;
              const grouped =
                previous?.sender.id === message.sender.id &&
                new Date(message.createdAt).getTime() -
                  new Date(previous.createdAt).getTime() <
                  GROUP_WINDOW_MS;
              const startsDay =
                !previous ||
                new Date(previous.createdAt).toDateString() !==
                  new Date(message.createdAt).toDateString();
              const heartCount =
                message.reactions?.filter((reaction) => reaction.emoji === HEART_EMOJI).length ?? 0;
              const hasHeart = !!message.reactions?.some(
                (reaction) => reaction.userId === currentUserId && reaction.emoji === HEART_EMOJI,
              );
              const otherReactions = Object.values(
                (message.reactions ?? [])
                  .filter((reaction) => reaction.emoji !== HEART_EMOJI)
                  .reduce<Record<string, { emoji: string; count: number; mine: boolean }>>(
                    (acc, reaction) => {
                      const group = acc[reaction.emoji] ?? {
                        emoji: reaction.emoji,
                        count: 0,
                        mine: false,
                      };
                      group.count += 1;
                      if (reaction.userId === currentUserId) group.mine = true;
                      acc[reaction.emoji] = group;
                      return acc;
                    },
                    {},
                  ),
              );
              return (
                <View style={[styles.messageCell, grouped && styles.groupedCell]}>
                  {startsDay ? (
                    <View style={styles.daySeparator}>
                      <Sticker label={dayLabel(message.createdAt)} tint={colors.surfaceAlt} small tilt={0} />
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.messageRow,
                      accessibilityLayout && styles.messageRowLargeText,
                      mine && styles.messageRowMine,
                    ]}
                  >
                    {!mine ? (
                      grouped ? (
                        <View style={{ width: 32 }} />
                      ) : (
                        <Avatar name={message.sender.name} uri={message.sender.avatarUrl} size={32} />
                      )
                    ) : null}
                    <View
                      style={[
                        styles.messageStack,
                        accessibilityLayout && styles.messageStackLargeText,
                        mine && { alignItems: 'flex-end' },
                      ]}
                    >
                      {!grouped ? (
                        <View style={styles.metaRow}>
                          <Text style={styles.metaName} maxFontSizeMultiplier={2}>
                            {mine ? 'You' : message.sender.name}
                          </Text>
                          <Text style={styles.metaTime} maxFontSizeMultiplier={2}>
                            {formatTime(message.createdAt)}
                          </Text>
                        </View>
                      ) : null}
                      <Pressable
                        onLongPress={() => openMessageActions(message)}
                        onPress={() => openMessageActions(message)}
                        accessibilityRole="button"
                        accessibilityLabel={`${mine ? 'You' : message.sender.name}: ${message.content}. ${formatTime(message.createdAt)}`}
                        accessibilityHint="Opens message actions"
                        style={[
                          styles.bubble,
                          {
                            backgroundColor: mine ? colors.primarySoft : colors.surfaceAlt,
                            borderColor: colors.border,
                          },
                          mine ? styles.bubbleMine : styles.bubbleTheirs,
                        ]}
                      >
                        {message.replyTo ? (
                          <View
                            style={[
                              styles.replyPreview,
                              { borderLeftColor: mine ? colors.primary : colors.faint },
                            ]}
                          >
                            <Text
                              style={[
                                styles.replyMeta,
                                { color: colors.sub },
                              ]}
                            >
                              Replying to {message.replyTo.sender.name}
                            </Text>
                            <Text
                              style={[
                                styles.replyBody,
                                { color: colors.sub },
                              ]}
                              numberOfLines={1}
                              maxFontSizeMultiplier={2}
                            >
                              {message.replyTo.content}
                            </Text>
                          </View>
                        ) : null}
                        <Text
                          style={[
                            styles.messageBody,
                            { color: colors.ink },
                          ]}
                          maxFontSizeMultiplier={2}
                        >
                          {message.content}
                        </Text>
                      </Pressable>
                      <View style={[styles.bubbleActions, mine && { justifyContent: 'flex-end' }]}>
                        <Pressable
                          onPress={() => void handleHeart(message)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={styles.heartButton}
                          accessibilityRole="button"
                          accessibilityLabel={hasHeart ? 'Remove heart' : 'Heart message'}
                          accessibilityState={{ selected: hasHeart }}
                        >
                          <Ionicons
                            name={hasHeart ? 'heart' : 'heart-outline'}
                            size={15}
                            color={hasHeart ? colors.pink : colors.faint}
                          />
                          {heartCount ? (
                            <Text
                              style={[
                                styles.heartCount,
                                hasHeart && { color: colors.pink },
                              ]}
                              maxFontSizeMultiplier={2}
                            >
                              {heartCount}
                            </Text>
                          ) : null}
                        </Pressable>
                        {otherReactions.map((group) => (
                          <Pressable
                            key={group.emoji}
                            onPress={() => void handleReaction(message, group.emoji)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={[styles.reactionPill, group.mine && styles.reactionPillActive]}
                            accessibilityRole="button"
                            accessibilityLabel={`${group.mine ? 'Remove' : 'Add'} ${group.emoji} reaction`}
                          >
                            <Text style={styles.reactionPillEmoji} maxFontSizeMultiplier={2}>
                              {group.emoji}
                            </Text>
                            <Text style={styles.reactionPillCount} maxFontSizeMultiplier={2}>
                              {group.count}
                            </Text>
                          </Pressable>
                        ))}
                        {!mine ? (
                          <Pressable
                            onPress={() => openMessageActions(message)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Safety actions for ${message.sender.name}'s message`}
                          >
                            <Ionicons
                              name="ellipsis-horizontal-circle-outline"
                              size={18}
                              color={colors.faint}
                            />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </View>
              );
            }}
          />

          <View
            style={[
              styles.composer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                marginBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            {replyTo ? (
              <View style={[styles.replyComposer, { borderBottomColor: colors.borderSoft }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.replyMeta, { color: colors.sub }]}>
                    Replying to {replyTo.sender.name}
                  </Text>
                  <Text style={[styles.replyBody, { color: colors.sub }]} numberOfLines={1}>
                    {replyTo.content}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setReplyTo(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel reply"
                >
                  <Ionicons name="close-circle" size={20} color={colors.sub} />
                </Pressable>
              </View>
            ) : null}
            <View style={[styles.composerRow, accessibilityLayout && styles.composerRowLargeText]}>
              <TextInput
                value={messageText}
                onChangeText={(value) => {
                  setMessageText(value);
                  pingTyping(value);
                }}
                placeholder={`Message ${title.split(' ')[0]}…`}
                accessibilityLabel={`Message ${title.split(' ')[0]}`}
                placeholderTextColor={colors.faint}
                style={[
                  styles.input,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.ink },
                ]}
                multiline
                maxFontSizeMultiplier={2}
              />
              <Pressable
                onPress={() => void handleSend()}
                disabled={sending || !messageText.trim()}
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: !messageText.trim() || sending ? colors.faint : colors.primary,
                    borderColor: colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: sending || !messageText.trim() }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Ionicons name="paper-plane" size={18} color={colors.onPrimary} />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Sheet
        visible={activeSheet != null}
        onClose={() => setActiveSheet(null)}
        title={activeSheet?.sender.id === currentUserId ? 'Your message' : activeSheet?.sender.name}
        kicker="MESSAGE ACTIONS"
      >
        {activeSheet ? (
          <>
            <View style={styles.reactionRow}>
              {REACTION_EMOJIS.map((emoji) => {
                const selected = !!activeSheet.reactions?.some(
                  (reaction) => reaction.userId === currentUserId && reaction.emoji === emoji,
                );
                return (
                  <Pressable
                    key={emoji}
                    onPress={() => {
                      const target = activeSheet;
                      setActiveSheet(null);
                      void handleReaction(target, emoji);
                    }}
                    style={[
                      styles.reactionOption,
                      {
                        borderColor: colors.border,
                        backgroundColor: selected ? colors.primarySoft : colors.surfaceAlt,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`React with ${emoji}`}
                    accessibilityState={{ selected }}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </Pressable>
                );
              })}
            </View>
            <ListRow
              icon="return-up-back"
              title="Reply"
              onPress={() => {
                setReplyTo(activeSheet);
                setActiveSheet(null);
              }}
            />
            <ListRow
              icon="copy-outline"
              title="Copy text"
              onPress={() => {
                void Clipboard.setStringAsync(activeSheet.content).catch(() => {});
                setActiveSheet(null);
              }}
            />
            {activeSheet.sender.id === currentUserId ? (
              <ListRow
                icon="trash-outline"
                title="Delete message"
                destructive
                last
                onPress={() => confirmDeleteMessage(activeSheet)}
              />
            ) : (
              <>
                <ListRow
                  icon="flag-outline"
                  title="Report message"
                  destructive
                  onPress={() => {
                    setReportTarget(activeSheet);
                    setActiveSheet(null);
                  }}
                />
                <ListRow
                  icon="ban-outline"
                  title={`Block ${activeSheet.sender.name}`}
                  destructive
                  last
                  onPress={() => confirmBlockSender(activeSheet)}
                />
              </>
            )}
          </>
        ) : null}
      </Sheet>
      <Sheet
        visible={threadMenuOpen}
        onClose={() => setThreadMenuOpen(false)}
        title={title}
        kicker="CONVERSATION"
      >
        {otherUser ? (
          <>
            <ListRow
              icon="person-outline"
              title="View profile"
              onPress={() => {
                setThreadMenuOpen(false);
                navigation.navigate('UserProfile', { userId: otherUser.id });
              }}
            />
            <ListRow
              icon="ban-outline"
              title={`Block ${otherUser.name}`}
              destructive
              last
              onPress={() => {
                setThreadMenuOpen(false);
                confirmBlockUser(otherUser);
              }}
            />
          </>
        ) : null}
      </Sheet>
      <Sheet
        visible={reportTarget != null}
        onClose={() => setReportTarget(null)}
        title="What's wrong with this message?"
        kicker="REPORT"
      >
        {reportTarget
          ? REPORT_REASON_OPTIONS.map((option, index) => (
              <ListRow
                key={option.value}
                icon="flag-outline"
                title={option.label}
                last={index === REPORT_REASON_OPTIONS.length - 1}
                onPress={() => void submitReport(reportTarget, option.value)}
              />
            ))
          : null}
      </Sheet>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  threadHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  threadHeaderLargeText: {
    alignItems: 'flex-start' as const,
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  headerIdentityLargeText: {
    alignItems: 'flex-start' as const,
  },
  messageList: {
    flexGrow: 1,
    justifyContent: 'flex-end' as const,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  messageCell: {
    marginTop: spacing.md,
  },
  groupedCell: {
    marginTop: 2,
  },
  daySeparator: {
    alignItems: 'center' as const,
    marginVertical: spacing.md,
  },
  messageRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: spacing.sm,
  },
  messageRowMine: {
    justifyContent: 'flex-end' as const,
  },
  messageRowLargeText: {
    alignItems: 'flex-start' as const,
  },
  messageStack: {
    maxWidth: '78%' as const,
    gap: 3,
  },
  messageStackLargeText: {
    flex: 1,
    maxWidth: '100%' as const,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 2,
  },
  metaName: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: t.colors.sub,
  },
  metaTime: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: t.colors.sub,
  },
  bubble: {
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 4,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    borderBottomRightRadius: 4,
  },
  messageBody: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 21,
  },
  replyPreview: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 2,
  },
  replyMeta: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
  },
  replyBody: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
  },
  bubbleActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingHorizontal: 2,
  },
  heartButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  heartCount: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: t.colors.sub,
  },
  reactionPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: t.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: t.colors.borderSoft,
  },
  reactionPillActive: {
    backgroundColor: t.colors.primarySoft,
    borderColor: t.colors.primary,
  },
  reactionPillEmoji: {
    fontSize: 12,
  },
  reactionPillCount: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: t.colors.sub,
  },
  composer: {
    borderTopWidth: BORDER_W,
    overflow: 'hidden' as const,
    marginTop: spacing.sm,
  },
  replyComposer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  composerRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: spacing.sm,
    padding: spacing.md,
  },
  composerRowLargeText: {
    alignItems: 'stretch' as const,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontFamily: fonts.medium,
    fontSize: 15,
    textAlignVertical: 'top' as const,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  reactionRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  reactionOption: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingVertical: 10,
  },
  reactionEmoji: {
    fontSize: 22,
  },
}));
