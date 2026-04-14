import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import {
  API_USER_MESSAGE,
  getThreadMessages,
  sendDirectMessage,
  addDMReaction,
  removeDMReaction,
  sendDMTyping,
  markDMThreadRead,
  resolveAvatarUrl,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { DirectMessage } from '../types';
import { MessageBubble, ChatInput, DateSeparator, EmptyChatState, ReactionPicker, TypingIndicator } from '../components/chat';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'DirectMessageThread'>;

type DMChatListItem =
  | { type: 'date'; id: string; date: string }
  | { type: 'message'; message: DirectMessage; index: number };

function buildDMChatList(messages: DirectMessage[]): DMChatListItem[] {
  const items: DMChatListItem[] = [];
  let lastDate = '';
  messages.forEach((msg, index) => {
    const dateStr = msg.createdAt.slice(0, 10);
    if (dateStr !== lastDate) {
      lastDate = dateStr;
      items.push({ type: 'date', id: `date-${dateStr}`, date: msg.createdAt });
    }
    items.push({ type: 'message', message: msg, index });
  });
  return items;
}

export default function DirectMessageThreadScreen({ route, navigation }: Props) {
  const { threadId, otherUserId, otherUserName } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [reactionTargetMsgId, setReactionTargetMsgId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<{ messageId: string; name: string; content: string } | null>(null);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await getThreadMessages(threadId);
      setMessages(data.messages);
      setTypingUserIds(data.typingUserIds ?? []);
      setOtherLastReadAt(data.otherLastReadAt ?? null);
      markDMThreadRead(threadId).catch(() => {});
    } catch {
      // Silently ignore poll errors
    }
  }, [threadId]);

  useEffect(() => {
    const init = async () => {
      await fetchMessages();
      setLoading(false);
    };
    init();

    pollRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    const replyToId = replyTarget?.messageId;
    const savedReply = replyTarget;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');
    setReplyTarget(null);
    try {
      const msg = await sendDirectMessage(threadId, content, replyToId);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err) {
      setInput(content);
      if (savedReply) setReplyTarget(savedReply);
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setSending(false);
    }
  };

  const handleAvatarPress = () => {
    navigation.navigate('UserProfile', {
      userId: otherUserId,
      name: otherUserName ?? 'User',
    });
  };

  const handleInputChange = useCallback(
    (text: string) => {
      setInput(text);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendDMTyping(threadId).catch(() => {});
        typingTimeoutRef.current = null;
      }, 300);
    },
    [threadId]
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleReactionSelect = async (msgId: string, emoji: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    const myReaction = msg.reactions?.find((r) => r.userId === user?.id && r.emoji === emoji);
    try {
      const updated = myReaction
        ? await removeDMReaction(threadId, msgId, emoji)
        : await addDMReaction(threadId, msgId, emoji);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? updated : m)));
    } catch {
      // silently ignore
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.scarlet} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={buildDMChatList(messages)}
        keyExtractor={(item) => item.type === 'date' ? item.id : item.message.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <EmptyChatState
            title="No messages yet"
            subtitle="Say hi!"
          />
        }
        ListFooterComponent={
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
            <TypingIndicator
              userName={otherUserName?.split(' ')[0] ?? 'Someone'}
              visible={typingUserIds.length > 0}
            />
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === 'date') {
            return <DateSeparator date={item.date} />;
          }
          const { message, index } = item;
          const isMe = message.senderId === user?.id;
          const showAvatar =
            !isMe &&
            (index === 0 || messages[index - 1].senderId !== message.senderId);
          const isFirstInGroup =
            index === 0 || messages[index - 1].senderId !== message.senderId;
          const isLastInGroup =
            index === messages.length - 1 ||
            messages[index + 1].senderId !== message.senderId;

          const isReadByOther =
            isMe &&
            !!otherLastReadAt &&
            new Date(otherLastReadAt) >= new Date(message.createdAt);

          return (
            <MessageBubble
              message={message}
              isMe={isMe}
              showAvatar={showAvatar}
              isFirstInGroup={isFirstInGroup}
              isLastInGroup={isLastInGroup}
              listIndex={index}
              currentUserId={user?.id}
              isReadByOther={isReadByOther}
              showReadReceipt
              onLongPress={() => setReactionTargetMsgId(message.id)}
              onAvatarPress={handleAvatarPress}
              resolveAvatarUrl={resolveAvatarUrl}
            />
          );
        }}
      />

      <ReactionPicker
        visible={!!reactionTargetMsgId}
        onClose={() => setReactionTargetMsgId(null)}
        onSelect={(emoji) => {
          if (reactionTargetMsgId) {
            handleReactionSelect(reactionTargetMsgId, emoji);
            setReactionTargetMsgId(null);
          }
        }}
        onReply={() => {
          const msg = messages.find((m) => m.id === reactionTargetMsgId);
          if (msg) {
            setReplyTarget({
              messageId: msg.id,
              name: msg.sender.name,
              content: msg.content,
            });
          }
          setReactionTargetMsgId(null);
        }}
        myReaction={
          reactionTargetMsgId
            ? messages.find((m) => m.id === reactionTargetMsgId)?.reactions?.find(
                (r) => r.userId === user?.id
              )?.emoji
            : undefined
        }
      />

      <ChatInput
        value={input}
        onChangeText={handleInputChange}
        onSend={handleSend}
        sending={sending}
        placeholder="Message..."
        maxLength={2000}
        replyPreview={
          replyTarget
            ? { name: replyTarget.name, content: replyTarget.content }
            : null
        }
        onCancelReply={() => setReplyTarget(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  messageList: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
});
