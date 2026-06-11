import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
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
  getApiErrorMessage,
  getThreadMessages,
  markDMThreadRead,
  removeDMReaction,
  sendDirectMessage,
  sendDMTyping,
} from '../api';
import { RootStackParamList } from '../../App';
import { DirectMessage } from '../types';
import { AppBackdrop, Avatar, Banner, EmptyState, ScreenHeader, Sticker } from '../components/ui';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Thread'>;

const HEART_EMOJI = '❤️';

export default function ThreadScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { threadId, title } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [messageText, setMessageText] = useState('');
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (showAlert = true) => {
      try {
        const response = await getThreadMessages(threadId);
        setMessages(response.messages);
        setTypingUserIds(response.typingUserIds);
        setLoadError(null);
        await markDMThreadRead(threadId);
      } catch (error) {
        setLoadError(getApiErrorMessage(error));
        if (showAlert) {
          Alert.alert('Could not load thread', getApiErrorMessage(error));
        }
      }
    },
    [threadId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      const interval = setInterval(() => {
        void load(false);
      }, 3500);
      return () => {
        clearInterval(interval);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      };
    }, [load]),
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
      Alert.alert('Could not send message', getApiErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const handleHeart = async (message: DirectMessage) => {
    const hasHeart = !!message.reactions?.some(
      (reaction) => reaction.userId === user?.id && reaction.emoji === HEART_EMOJI,
    );
    try {
      const updated = hasHeart
        ? await removeDMReaction(threadId, message.id, HEART_EMOJI)
        : await addDMReaction(threadId, message.id, HEART_EMOJI);
      setMessages((current) => current.map((item) => (item.id === message.id ? updated : item)));
    } catch (error) {
      Alert.alert('Could not update heart', getApiErrorMessage(error));
    }
  };

  const handleSafetyAction = (message: DirectMessage) => {
    if (message.sender.id === user?.id) {
      setReplyTo(message);
      return;
    }

    Alert.alert('Message safety', undefined, [
      {
        text: 'Report message',
        onPress: async () => {
          try {
            await createReport({
              directMessageId: message.id,
              targetUserId: message.sender.id,
              reason: 'HARASSMENT',
            });
            Alert.alert('Report sent', 'Thanks. We logged this message for review.');
          } catch (error) {
            Alert.alert('Could not send report', getApiErrorMessage(error));
          }
        },
      },
      {
        text: `Block ${message.sender.name}`,
        style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(message.sender.id);
            Alert.alert('User blocked', 'They can no longer message you.');
            navigation.goBack();
          } catch (error) {
            Alert.alert('Could not block user', getApiErrorMessage(error));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <ScreenHeader title={title} kicker="DIRECT MESSAGE" onBack={() => navigation.goBack()} />

        {loadError ? <Banner message={loadError} kind="error" /> : null}

        <View style={styles.messageList}>
          {messages.length ? (
            messages.map((message) => {
              const mine = message.sender.id === user?.id;
              const heartCount =
                message.reactions?.filter((reaction) => reaction.emoji === HEART_EMOJI).length ?? 0;
              const hasHeart = !!message.reactions?.some(
                (reaction) => reaction.userId === user?.id && reaction.emoji === HEART_EMOJI,
              );
              return (
                <View key={message.id} style={[styles.messageRow, mine && styles.messageRowMine]}>
                  {!mine ? (
                    <Avatar name={message.sender.name} uri={message.sender.avatarUrl} size={32} />
                  ) : null}
                  <View style={[styles.messageStack, mine && { alignItems: 'flex-end' }]}>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaName}>{mine ? 'You' : message.sender.name}</Text>
                      <Text style={styles.metaTime}>{formatTime(message.createdAt)}</Text>
                    </View>
                    <Pressable
                      onLongPress={() => setReplyTo(message)}
                      onPress={() => setReplyTo(message)}
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
                              { color: mine ? 'rgba(255,246,232,0.8)' : colors.faint },
                            ]}
                          >
                            Replying to {message.replyTo.sender.name}
                          </Text>
                          <Text
                            style={[
                              styles.replyBody,
                              { color: mine ? 'rgba(255,246,232,0.7)' : colors.faint },
                            ]}
                            numberOfLines={1}
                          >
                            {message.replyTo.content}
                          </Text>
                        </View>
                      ) : null}
                      <Text
                        style={[styles.messageBody, { color: mine ? colors.onPrimary : colors.ink }]}
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
                        {heartCount ? <Text style={styles.heartCount}>{heartCount}</Text> : null}
                      </Pressable>
                      {!mine ? (
                        <Pressable
                          onPress={() => handleSafetyAction(message)}
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
              );
            })
          ) : (
            <EmptyState
              icon="chatbubble-ellipses"
              title="No messages yet"
              body="This conversation is ready whenever you are."
            />
          )}
          {typingUserIds.length ? (
            <Sticker label="typing…" tint={colors.successSoft} icon="ellipsis-horizontal" tilt={-2} small />
          ) : null}
        </View>

        {/* Composer */}
        <View
          style={[
            styles.composer,
            { backgroundColor: colors.surface, borderColor: colors.border },
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
          <View style={styles.composerRow}>
            <TextInput
              value={messageText}
              onChangeText={(value) => {
                setMessageText(value);
                pingTyping(value);
              }}
              placeholder="Write a message… tap a message to reply"
              placeholderTextColor={colors.faint}
              style={[
                styles.input,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.ink },
              ]}
              multiline
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
                <Ionicons name="arrow-up" size={18} color={colors.onPrimary} />
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  messageList: {
    flexGrow: 1,
    gap: spacing.md,
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
    color: t.colors.faint,
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
    color: t.colors.faint,
  },
  composer: {
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    overflow: 'hidden' as const,
  },
  replyComposer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderStyle: 'dashed' as const,
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
}));
