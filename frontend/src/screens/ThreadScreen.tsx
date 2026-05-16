import React, { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
import { EmptyState, Panel, PrimaryButton, Screen, ScreenHeader, UserAvatar } from '../components/ui';
import { palette, radii, spacing, typography } from '../theme';
import { useAuth } from '../context/AuthContext';
import { formatTime } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Thread'>;

const HEART_EMOJI = '❤️';

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
	    } catch (error) {
	      setLoadError(getApiErrorMessage(error));
	      if (showAlert) {
	        Alert.alert('Could not load thread', getApiErrorMessage(error));
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

  const pingTyping = useCallback((draft: string) => {
    if (!draft.trim()) return;
    if (typingTimerRef.current) return;
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 2500);
    void sendDMTyping(threadId).catch(() => {});
  }, [threadId]);

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
    const hasHeart = !!message.reactions?.some((reaction) => reaction.userId === user?.id && reaction.emoji === HEART_EMOJI);
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
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <ScreenHeader title="Message" onBack={() => navigation.goBack()} />
        <Text style={styles.header}>{title}</Text>
        {loadError ? (
          <Panel>
            <Text style={styles.errorText}>{loadError}</Text>
          </Panel>
        ) : null}
        {messages.length ? messages.map((message) => (
          <View key={message.id} style={styles.messageRow}>
            <UserAvatar name={message.sender.name} avatarUrl={message.sender.avatarUrl} size={42} />

            <View style={styles.messageStack}>
              <View style={styles.messageMetaRow}>
                <Text style={styles.messageMetaName}>
                  {message.sender.id === user?.id ? 'You' : message.sender.name}
                </Text>
                <Text style={styles.messageMetaTime}>{formatTime(message.createdAt)}</Text>
              </View>

	              <TouchableOpacity
	                activeOpacity={0.8}
                onLongPress={() => setReplyTo(message)}
                onPress={() => setReplyTo(message)}
                style={styles.messageContentWrap}
              >
                {message.replyTo ? (
                  <View style={styles.replyPreview}>
                    <Text style={styles.replyMeta}>Replying to {message.replyTo.sender.name}</Text>
                    <Text style={styles.replyBody} numberOfLines={1}>{message.replyTo.content}</Text>
                  </View>
                ) : null}
                <Text style={styles.messageBody}>{message.content}</Text>
              </TouchableOpacity>
            </View>

            {message.sender.id !== user?.id ? (
              <TouchableOpacity
                onPress={() => handleSafetyAction(message)}
                style={styles.safetyButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="ellipsis-horizontal-circle-outline" size={22} color="rgba(16, 33, 43, 0.28)" />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={() => void handleHeart(message)}
              style={styles.heartButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={message.reactions?.some((reaction) => reaction.userId === user?.id && reaction.emoji === HEART_EMOJI) ? 'heart' : 'heart-outline'}
                size={22}
                color={message.reactions?.some((reaction) => reaction.userId === user?.id && reaction.emoji === HEART_EMOJI) ? palette.coral : 'rgba(16, 33, 43, 0.16)'}
              />
              {message.reactions?.filter((reaction) => reaction.emoji === HEART_EMOJI).length ? (
                <Text style={styles.heartCount}>
                  {message.reactions.filter((reaction) => reaction.emoji === HEART_EMOJI).length}
                </Text>
              ) : null}
            </TouchableOpacity>
          </View>
        )) : <EmptyState icon="chatbubble-ellipses-outline" title="No messages yet" body="This conversation is ready whenever you are." />}
        {typingUserIds.length ? (
          <View style={styles.typingPill}>
            <Ionicons name="ellipsis-horizontal" size={16} color={palette.scarlet} />
            <Text style={styles.typingText}>Someone is typing...</Text>
          </View>
        ) : null}
        <Panel style={styles.composerPanel}>
          {replyTo ? (
            <View style={styles.replyComposer}>
              <View style={styles.replyComposerCopy}>
                <Text style={styles.replyMeta}>Replying to {replyTo.sender.name}</Text>
                <Text style={styles.replyBody} numberOfLines={1}>{replyTo.content}</Text>
              </View>
              <PrimaryButton label="Clear" onPress={() => setReplyTo(null)} kind="ghost" />
            </View>
          ) : null}
          <TextInput
            value={messageText}
            onChangeText={(value) => {
              setMessageText(value);
              pingTyping(value);
            }}
	            placeholder="Write a message... tap a message to reply"
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
    flexGrow: 1,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  header: {
    ...typography.h1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  messageStack: {
    flex: 1,
    gap: 2,
    paddingTop: 2,
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageMetaName: {
    ...typography.bodyStrong,
    fontSize: 15,
    lineHeight: 18,
    color: 'rgba(16, 33, 43, 0.5)',
  },
  messageMetaTime: {
    ...typography.body,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(16, 33, 43, 0.32)',
  },
  errorText: {
    ...typography.bodyStrong,
    color: palette.dangerText,
  },
  messageContentWrap: {
    gap: 4,
    paddingRight: spacing.sm,
  },
  replyPreview: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(16, 33, 43, 0.12)',
    paddingLeft: 10,
    marginBottom: 2,
  },
  replyMeta: {
    ...typography.bodyStrong,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(16, 33, 43, 0.46)',
  },
  replyBody: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(16, 33, 43, 0.42)',
  },
  messageBody: {
    ...typography.body,
    color: palette.ink,
    fontSize: 17,
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  heartButton: {
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    paddingTop: 4,
  },
  safetyButton: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  heartCount: {
    ...typography.bodyStrong,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(16, 33, 43, 0.42)',
  },
  typingPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typingText: {
    ...typography.bodyStrong,
    fontSize: 13,
    lineHeight: 18,
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
  composerPanel: {
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.9)',
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
