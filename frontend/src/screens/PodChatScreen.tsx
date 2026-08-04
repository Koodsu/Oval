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
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addPodMessageReaction,
  blockUser,
  confirmAttendance,
  createReport,
  deletePodMessage,
  getApiErrorMessage,
  getMessages,
  getPod,
  removePodMessageReaction,
  sendMessage,
  sendPodTyping,
} from '../api';
import * as Clipboard from 'expo-clipboard';
import { RootStackParamList } from '../../App';
import { Message, Pod } from '../types';
import { getPodTitle } from '../utils/experience';
import {
  AppBackdrop,
  Avatar,
  Banner,
  EmptyState,
  ListRow,
  ScreenHeader,
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
import { mergeLatestPage } from '../utils/chat';
import { REACTION_EMOJIS } from '../constants/reactions';
import { REPORT_REASON_OPTIONS } from '../constants/reportReasons';
import { REALTIME_CHAT_EVENTS, useRealtimeChannel } from '../hooks/useRealtimeChannel';

import { toast } from '../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'PodChat'>;

const HEART_EMOJI = '❤️';
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const MESSAGE_PAGE_SIZE = 50;
// Realtime connected → polling is just a safety net. Disconnected → poll fast.
const POLL_REALTIME_MS = 20000;
const POLL_FALLBACK_MS = 3500;

function dayLabel(iso: string) {
  const date = new Date(iso);
  if (date.toDateString() === new Date().toDateString()) return 'TODAY';
  return date
    .toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();
}

export default function PodChatScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { podId } = route.params;
  const { user } = useAuth();
  const [pod, setPod] = useState<Pod | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [messageText, setMessageText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeMessage, setActiveMessage] = useState<Message | null>(null);
  const [reportTarget, setReportTarget] = useState<Message | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [confirmCardDismissed, setConfirmCardDismissed] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;
  const isMemberRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  const refreshMessages = useCallback(async () => {
    if (!isMemberRef.current) return;
    try {
      const response = await getMessages(podId, { limit: MESSAGE_PAGE_SIZE });
      setMessages((current) => mergeLatestPage(current, response.messages));
      if (!initialLoadDoneRef.current) {
        setHasMore(!!response.hasMore);
        initialLoadDoneRef.current = true;
      }
      setTypingUserIds(response.typingUserIds);
      setLoadError(null);
    } catch {
      // Keep stale chat visible until the next successful refresh.
    }
  }, [podId]);

  const load = useCallback(async () => {
    try {
      const podResponse = await getPod(podId);
      isMemberRef.current = podResponse.members.some((member) => member.userId === user?.id);
      setPod(podResponse);
      setLoadError(null);
      await refreshMessages();
    } catch (error) {
      setLoadError(getApiErrorMessage(error));
    }
  }, [podId, refreshMessages, user?.id]);

  const realtimeConnected = useRealtimeChannel(`pod-${podId}`, REALTIME_CHAT_EVENTS, () => {
    void refreshMessages();
  });

  useFocusEffect(
    useCallback(() => {
      void load();
      const interval = setInterval(
        () => void refreshMessages(),
        realtimeConnected ? POLL_REALTIME_MS : POLL_FALLBACK_MS,
      );
      return () => {
        clearInterval(interval);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      };
    }, [load, realtimeConnected, refreshMessages]),
  );

  const loadEarlier = useCallback(async () => {
    const oldest = messagesRef.current[0];
    if (!oldest || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const response = await getMessages(podId, {
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
  }, [loadingEarlier, podId]);

  const pingTyping = useCallback(
    (draft: string) => {
      if (!draft.trim()) return;
      if (typingTimerRef.current) return;
      typingTimerRef.current = setTimeout(() => {
        typingTimerRef.current = null;
      }, 2500);
      void sendPodTyping(podId).catch(() => {});
    },
    [podId],
  );

  const handleSend = async () => {
    if (!messageText.trim()) return;
    setSending(true);
    try {
      const sent = await sendMessage(podId, messageText.trim(), replyTo?.id);
      setMessageText('');
      setReplyTo(null);
      setMessages((current) => [...current, sent]);
    } catch (error) {
      toast.error('Could not send message', getApiErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const handleReaction = async (message: Message, emoji: string) => {
    const hasReaction = !!message.reactions?.some(
      (reaction) => reaction.userId === user?.id && reaction.emoji === emoji,
    );
    try {
      const updated = hasReaction
        ? await removePodMessageReaction(podId, message.id, emoji)
        : await addPodMessageReaction(podId, message.id, emoji);
      setMessages((current) => current.map((item) => (item.id === message.id ? updated : item)));
    } catch (error) {
      toast.error('Could not update reaction', getApiErrorMessage(error));
    }
  };

  const submitReport = async (message: Message, reason: string) => {
    setReportTarget(null);
    try {
      await createReport({
        podId,
        messageId: message.id,
        targetUserId: message.user.id,
        reason,
      });
      toast.success('Report sent', 'Thanks. We logged this pod message for review.');
    } catch (error) {
      toast.error('Could not send report', getApiErrorMessage(error));
    }
  };

  const confirmBlockSender = (message: Message) => {
    setActiveMessage(null);
    Alert.alert(
      `Block ${message.user.name}?`,
      'They will no longer be able to message you, and shared pods are separated. You can unblock them later from Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await blockUser(message.user.id);
                toast.success(
                  'User blocked',
                  'They can no longer message you. Shared pods are separated for safety.',
                );
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

  const confirmDeleteMessage = (message: Message) => {
    setActiveMessage(null);
    Alert.alert('Delete this message?', 'It will be removed for everyone in the pod.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deletePodMessage(podId, message.id);
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

  const typingLabel = useMemo(() => {
    if (!typingUserIds.length || !pod) return null;
    const names = typingUserIds
      .map((id) => pod.members.find((member) => member.userId === id)?.user.name?.split(' ')[0])
      .filter((name): name is string => !!name);
    if (!names.length) return 'Someone is typing…';
    if (names.length === 1) return `${names[0]} is typing…`;
    return `${names.slice(0, 2).join(' and ')}${names.length > 2 ? ' and others' : ''} are typing…`;
  }, [pod, typingUserIds]);

  const isMember = pod?.members.some((member) => member.userId === user?.id) ?? false;

  // Contextual action cards (02 §5) — one at a time, dismissible for the session.
  const myMember = pod?.members.find((member) => member.userId === user?.id) ?? null;
  const msUntilMeetup = pod ? new Date(pod.meetupTime).getTime() - Date.now() : Infinity;
  const showConfirmCard =
    isMember &&
    pod != null &&
    (pod.status === 'FORMING' || pod.status === 'LOCKED') &&
    msUntilMeetup <= 2 * 60 * 60 * 1000 &&
    msUntilMeetup > -30 * 60 * 1000 &&
    !myMember?.confirmedAt &&
    !confirmCardDismissed;

  const handleConfirmAttendance = async () => {
    if (!pod || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await confirmAttendance(pod.id);
      await load();
    } catch (error) {
      toast.error('Could not confirm attendance', getApiErrorMessage(error));
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <AppBackdrop>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.header}>
            <ScreenHeader
              title={pod ? getPodTitle(pod) : 'Pod chat'}
              kicker={
                pod
                  ? `${pod.members.length} ${pod.members.length === 1 ? 'MEMBER' : 'MEMBERS'}${realtimeConnected ? ' • LIVE' : ''}`
                  : 'POD CHAT'
              }
              onBack={() => navigation.goBack()}
            />
            {loadError ? (
              <Banner message="Couldn't refresh — messages may be stale." kind="error" />
            ) : null}
            {pod && !isMember ? (
              <Banner message="Join this pod to read and send messages." kind="info" />
            ) : null}
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
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon="chatbubble-ellipses"
                  title="No messages yet"
                  body="Start with an ETA, meetup note, or quick check-in."
                  actionLabel="Back to pod"
                  onAction={() => navigation.navigate('PodDetail', { podId })}
                />
              </View>
            }
            ListHeaderComponent={
              typingLabel ? <TypingIndicator label={typingLabel} /> : null
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
              const mine = message.user.id === user?.id;
              const grouped =
                previous?.user.id === message.user.id &&
                new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() <
                  GROUP_WINDOW_MS;
              const startsDay =
                !previous ||
                new Date(previous.createdAt).toDateString() !==
                  new Date(message.createdAt).toDateString();
              const heartCount =
                message.reactions?.filter((reaction) => reaction.emoji === HEART_EMOJI).length ??
                0;
              const hasHeart = !!message.reactions?.some(
                (reaction) => reaction.userId === user?.id && reaction.emoji === HEART_EMOJI,
              );
              return (
                <View style={[styles.messageCell, grouped && styles.groupedCell]}>
                  {startsDay ? (
                    <View style={styles.daySeparator}>
                      <Sticker
                        label={dayLabel(message.createdAt)}
                        tint={colors.surfaceAlt}
                        small
                        tilt={0}
                      />
                    </View>
                  ) : null}
                  <View style={[styles.messageRow, mine && styles.messageRowMine]}>
                    {!mine ? (
                      grouped ? (
                        <View style={{ width: 32 }} />
                      ) : (
                        <Pressable
                          onPress={() =>
                            navigation.navigate('UserProfile', { userId: message.user.id })
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${message.user.name}'s profile`}
                        >
                          <Avatar
                            name={message.user.name}
                            uri={message.user.avatarUrl}
                            size={32}
                          />
                        </Pressable>
                      )
                    ) : null}
                    <View style={[styles.messageStack, mine && { alignItems: 'flex-end' }]}>
                      {!grouped ? (
                        <View style={styles.metaRow}>
                          <Text style={styles.metaName}>{mine ? 'You' : message.user.name}</Text>
                          <Text style={styles.metaTime}>{formatTime(message.createdAt)}</Text>
                        </View>
                      ) : null}
                      <Pressable
                        onLongPress={() => setActiveMessage(message)}
                        onPress={() => setActiveMessage(message)}
                        style={[
                          styles.bubble,
                          {
                            backgroundColor: mine ? colors.primary : colors.surfaceAlt,
                            borderColor: colors.border,
                          },
                          mine ? styles.bubbleMine : styles.bubbleTheirs,
                        ]}
                      >
                        {message.replyTo ? (
                          <View
                            style={[
                              styles.replyPreview,
                              { borderLeftColor: mine ? 'rgba(255,246,232,0.5)' : colors.faint },
                            ]}
                          >
                            <Text
                              style={[
                                styles.replyMeta,
                                { color: mine ? 'rgba(255,246,232,0.8)' : colors.sub },
                              ]}
                            >
                              Replying to {message.replyTo.user.name}
                            </Text>
                            <Text
                              style={[
                                styles.replyBody,
                                { color: mine ? 'rgba(255,246,232,0.7)' : colors.sub },
                              ]}
                              numberOfLines={1}
                            >
                              {message.replyTo.content}
                            </Text>
                          </View>
                        ) : null}
                        <Text
                          style={[
                            styles.messageBody,
                            { color: mine ? colors.onPrimary : colors.ink },
                          ]}
                        >
                          {message.content}
                        </Text>
                      </Pressable>
                      <View style={[styles.bubbleActions, mine && { justifyContent: 'flex-end' }]}>
                        <Pressable
                          onPress={() => void handleReaction(message, HEART_EMOJI)}
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
                            >
                              {heartCount}
                            </Text>
                          ) : null}
                        </Pressable>
                        {!mine ? (
                          <Pressable
                            onPress={() => setActiveMessage(message)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Actions for ${message.user.name}'s message`}
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

          {/* Contextual action card (02 §5) — one at a time, above the composer */}
          {showConfirmCard && pod ? (
            <View
              style={[
                styles.contextCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={typography.subheading}>See you soon</Text>
                <Text style={[typography.captionSmall, { color: colors.sub }]} numberOfLines={2}>
                  {getPodTitle(pod)} at {formatTime(pod.meetupTime)} — let the
                  others know you're coming.
                </Text>
              </View>
              <Pressable
                onPress={() => void handleConfirmAttendance()}
                disabled={confirmBusy}
                accessibilityRole="button"
                accessibilityLabel="Confirm attendance"
                style={({ pressed }) => [
                  styles.contextAction,
                  { backgroundColor: colors.primary, opacity: pressed || confirmBusy ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.contextActionText, { color: colors.onPrimary }]}>
                  {confirmBusy ? 'Confirming…' : "I'm coming"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setConfirmCardDismissed(true)}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                hitSlop={10}
              >
                <Ionicons name="close" size={18} color={colors.sub} />
              </Pressable>
            </View>
          ) : null}
          {isMember ? (
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
                      Replying to {replyTo.user.name}
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
              <View style={styles.composerRow}>
                <TextInput
                  value={messageText}
                  onChangeText={(value) => {
                    setMessageText(value);
                    pingTyping(value);
                  }}
                  placeholder="Message the pod"
                  placeholderTextColor={colors.faint}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                      color: colors.ink,
                    },
                  ]}
                  multiline
                />
                <Pressable
                  onPress={() => void handleSend()}
                  disabled={sending || !messageText.trim()}
                  style={[
                    styles.sendButton,
                    {
                      backgroundColor:
                        !messageText.trim() || sending ? colors.faint : colors.primary,
                      borderColor: colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Send pod message"
                  accessibilityState={{ disabled: sending || !messageText.trim() }}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Ionicons name="arrow-up" size={18} color={colors.onPrimary} />
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <Sheet
        visible={activeMessage != null}
        onClose={() => setActiveMessage(null)}
        title={activeMessage?.user.id === user?.id ? 'Your message' : activeMessage?.user.name}
        kicker="MESSAGE ACTIONS"
      >
        {activeMessage ? (
          <>
            <View style={styles.reactionRow}>
              {REACTION_EMOJIS.map((emoji) => {
                const selected = !!activeMessage.reactions?.some(
                  (reaction) => reaction.userId === user?.id && reaction.emoji === emoji,
                );
                return (
                  <Pressable
                    key={emoji}
                    onPress={() => {
                      const target = activeMessage;
                      setActiveMessage(null);
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
                setReplyTo(activeMessage);
                setActiveMessage(null);
              }}
            />
            <ListRow
              icon="copy-outline"
              title="Copy text"
              onPress={() => {
                void Clipboard.setStringAsync(activeMessage.content).catch(() => {});
                setActiveMessage(null);
              }}
            />
            {activeMessage.user.id === user?.id ? (
              <ListRow
                icon="trash-outline"
                title="Delete message"
                destructive
                last
                onPress={() => confirmDeleteMessage(activeMessage)}
              />
            ) : (
              <>
                <ListRow
                  icon="flag-outline"
                  title="Report message"
                  destructive
                  onPress={() => {
                    setReportTarget(activeMessage);
                    setActiveMessage(null);
                  }}
                />
                <ListRow
                  icon="ban-outline"
                  title={`Block ${activeMessage.user.name}`}
                  destructive
                  last
                  onPress={() => confirmBlockSender(activeMessage)}
                />
              </>
            )}
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
  messageList: {
    flexGrow: 1,
    justifyContent: 'flex-end' as const,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  emptyWrap: {
    // Inverted FlatList renders the empty state upside down without this.
    transform: [{ scaleY: -1 }],
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
  messageStack: {
    maxWidth: '78%' as const,
    gap: 3,
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
  composer: {
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    overflow: 'hidden' as const,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  contextCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  contextAction: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    minHeight: 34,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  contextActionText: {
    fontFamily: fonts.bold,
    fontWeight: '700' as const,
    fontSize: 13,
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
