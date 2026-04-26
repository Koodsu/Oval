import React, { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  addDMReaction,
  API_USER_MESSAGE,
  getThreadMessages,
  markDMThreadRead,
  removeDMReaction,
  sendDirectMessage,
  sendDMTyping,
} from '../api';
import { RootStackParamList } from '../../App';
import { DirectMessage } from '../types';
import { Chip, EmptyState, Panel, PrimaryButton, Screen, ScreenHeader } from '../components/ui';
import { palette, radii, spacing, typography } from '../theme';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Thread'>;

const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢'] as const;

export default function ThreadScreen({ route, navigation }: Props) {
  const { threadId, title } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [messageText, setMessageText] = useState('');
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (showAlert = true) => {
    try {
      const response = await getThreadMessages(threadId);
      setMessages(response.messages);
      setTypingUserIds(response.typingUserIds);
      setLoadError(null);
      await markDMThreadRead(threadId);
    } catch {
      setLoadError(API_USER_MESSAGE);
      if (showAlert) {
        Alert.alert('Could not load thread', API_USER_MESSAGE);
      }
    }
  }, [threadId]);

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
    }, [load])
  );

  const pingTyping = useCallback(() => {
    if (!messageText.trim()) return;
    if (typingTimerRef.current) return;
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 2500);
    void sendDMTyping(threadId).catch(() => {});
  }, [messageText, threadId]);

  const handleSend = async () => {
    if (!messageText.trim()) return;
    setSending(true);
    try {
      const sent = await sendDirectMessage(threadId, messageText.trim(), replyTo?.id);
      setMessageText('');
      setReplyTo(null);
      setMessages((current) => [...current, sent]);
    } catch {
      Alert.alert('Could not send message', API_USER_MESSAGE);
    } finally {
      setSending(false);
    }
  };

  const handleReaction = async (message: DirectMessage, emoji: string) => {
    const hasReaction = !!message.reactions?.some((reaction) => reaction.userId === user?.id && reaction.emoji === emoji);
    try {
      const updated = hasReaction
        ? await removeDMReaction(threadId, message.id, emoji)
        : await addDMReaction(threadId, message.id, emoji);
      setMessages((current) => current.map((item) => (item.id === message.id ? updated : item)));
    } catch {
      Alert.alert('Could not update reaction', API_USER_MESSAGE);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Message" onBack={() => navigation.goBack()} />
        <Text style={styles.header}>{title}</Text>
        {loadError ? (
          <Panel>
            <Text style={styles.errorText}>{loadError}</Text>
          </Panel>
        ) : null}
        {messages.length ? messages.map((message) => (
          <View key={message.id} style={styles.messageWrap}>
            <TouchableOpacity activeOpacity={0.85} onLongPress={() => setReplyTo(message)}>
              <Panel style={styles.message}>
                <Text style={styles.title}>{message.sender.name}</Text>
                {message.replyTo ? (
                  <View style={styles.replyPreview}>
                    <Text style={styles.replyMeta}>Replying to {message.replyTo.sender.name}</Text>
                    <Text style={styles.body} numberOfLines={1}>{message.replyTo.content}</Text>
                  </View>
                ) : null}
                <Text style={styles.body}>{message.content}</Text>
              </Panel>
            </TouchableOpacity>
            <View style={styles.reactionRow}>
              {REACTION_OPTIONS.map((emoji) => {
                const count = message.reactions?.filter((reaction) => reaction.emoji === emoji).length ?? 0;
                return (
                  <Chip
                    key={`${message.id}-${emoji}`}
                    label={count ? `${emoji} ${count}` : emoji}
                    active={!!message.reactions?.some((reaction) => reaction.userId === user?.id && reaction.emoji === emoji)}
                    onPress={() => void handleReaction(message, emoji)}
                  />
                );
              })}
            </View>
          </View>
        )) : <EmptyState icon="chatbubble-ellipses-outline" title="No messages yet" body="This conversation is ready whenever you are." />}
        {typingUserIds.length ? (
          <Text style={styles.typingText}>Someone is typing...</Text>
        ) : null}
        <Panel>
          {replyTo ? (
            <View style={styles.replyComposer}>
              <View style={styles.replyComposerCopy}>
                <Text style={styles.replyMeta}>Replying to {replyTo.sender.name}</Text>
                <Text style={styles.body} numberOfLines={1}>{replyTo.content}</Text>
              </View>
              <PrimaryButton label="Clear" onPress={() => setReplyTo(null)} kind="ghost" />
            </View>
          ) : null}
          <TextInput
            value={messageText}
            onChangeText={(value) => {
              setMessageText(value);
              if (value.trim()) pingTyping();
            }}
            placeholder="Write a message..."
            placeholderTextColor={palette.slate}
            style={styles.input}
            multiline
          />
          <View style={styles.action}>
            <PrimaryButton label="Send" onPress={() => void handleSend()} loading={sending} />
          </View>
        </Panel>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    ...typography.h1,
  },
  messageWrap: {
    gap: spacing.xs,
  },
  message: {
    gap: 4,
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
  },
  errorText: {
    ...typography.bodyStrong,
    color: palette.dangerText,
  },
  replyPreview: {
    borderLeftWidth: 2,
    borderLeftColor: palette.scarlet,
    paddingLeft: spacing.sm,
    marginVertical: 2,
  },
  replyMeta: {
    ...typography.label,
    color: palette.scarlet,
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.xs,
  },
  typingText: {
    ...typography.body,
    color: palette.scarlet,
  },
  replyComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  replyComposerCopy: {
    flex: 1,
    gap: 2,
  },
  input: {
    minHeight: 80,
    borderRadius: radii.md,
    backgroundColor: palette.cream,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    ...typography.body,
    color: palette.ink,
    textAlignVertical: 'top',
  },
  action: {
    marginTop: spacing.sm,
  },
});
