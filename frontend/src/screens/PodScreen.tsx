import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { getPod, getMessages, sendMessage } from '../api';
import { Pod, Message } from '../types';
import { useAuth } from '../context/AuthContext';
import Avatar, { AvatarStack } from '../components/Avatar';
import StatusBadge from '../components/StatusBadge';
import { colors, spacing, radii, shadows, typography } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<RootStackParamList, 'Pod'>;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function PodScreen({ route }: Props) {
  const { podId } = route.params;
  const { user } = useAuth();

  const [pod, setPod] = useState<Pod | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(true);

  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPod = useCallback(async () => {
    try {
      const data = await getPod(podId);
      setPod(data);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load pod');
    }
  }, [podId]);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await getMessages(podId);
      setMessages(data);
    } catch {
      // silently ignore poll errors
    }
  }, [podId]);

  useEffect(() => {
    const init = async () => {
      await fetchPod();
      await fetchMessages();
      setLoading(false);
    };
    init();

    pollRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchPod, fetchMessages]);

  const toggleHeader = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHeaderExpanded(!headerExpanded);
  };

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text) return;
    setMessageText('');
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const msg = await sendMessage(podId, text);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send message');
      setMessageText(text);
    } finally {
      setSending(false);
    }
  };

  if (loading || !pod) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 95 : 0}
    >
      {/* Collapsible Pod Info Header */}
      <TouchableOpacity
        style={[styles.infoSection, shadows.sm]}
        onPress={toggleHeader}
        activeOpacity={0.8}
      >
        <View style={styles.infoTopRow}>
          <View style={styles.infoTitleArea}>
            <Text style={styles.activityTitle} numberOfLines={1}>
              {pod.activity?.title ?? 'Pod'}
            </Text>
            <StatusBadge status={pod.status} size="md" />
          </View>
          <Ionicons
            name={headerExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textTertiary}
          />
        </View>

        {headerExpanded && (
          <View style={styles.infoExpanded}>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.metaText}>{formatTime(pod.meetupTime)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.metaText}>{pod.location}</Text>
            </View>
            <View style={styles.membersSection}>
              <Text style={styles.membersLabel}>
                Members {pod.members.length}/4
              </Text>
              <AvatarStack
                members={pod.members}
                currentUserId={user?.id}
                size={30}
              />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyChatContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
            <Text style={styles.emptyChatTitle}>No messages yet</Text>
            <Text style={styles.emptyChatSubtitle}>Say hi to your pod!</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isMe = item.user.id === user?.id;
          const showAvatar =
            !isMe &&
            (index === 0 || messages[index - 1].user.id !== item.user.id);
          const isLastInGroup =
            index === messages.length - 1 ||
            messages[index + 1].user.id !== item.user.id;

          return (
            <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
              {!isMe && (
                <View style={styles.avatarSlot}>
                  {showAvatar ? (
                    <Avatar name={item.user.name} size={28} />
                  ) : null}
                </View>
              )}
              <View style={styles.bubbleColumn}>
                {showAvatar && !isMe && (
                  <Text style={styles.senderName}>{item.user.name.split(' ')[0]}</Text>
                )}
                {isMe ? (
                  <LinearGradient
                    colors={[...colors.chatMe]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.bubble,
                      styles.bubbleMe,
                      !isLastInGroup && styles.bubbleMeGrouped,
                    ]}
                  >
                    <Text style={styles.bubbleTextMe}>{item.content}</Text>
                  </LinearGradient>
                ) : (
                  <View
                    style={[
                      styles.bubble,
                      styles.bubbleThem,
                      !isLastInGroup && styles.bubbleThemGrouped,
                    ]}
                  >
                    <Text style={styles.bubbleTextThem}>{item.content}</Text>
                  </View>
                )}
                {isLastInGroup && (
                  <Text style={[styles.timestamp, isMe && styles.timestampMe]}>
                    {timeAgo(item.createdAt)}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Input Bar */}
      <View style={[styles.inputBar, shadows.sm]}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder="Message..."
            placeholderTextColor={colors.textTertiary}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
          />
        </View>
        <TouchableOpacity
          onPress={handleSend}
          disabled={!messageText.trim() || sending}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={
              !messageText.trim() || sending
                ? ['#cbd5e1', '#cbd5e1']
                : [...colors.gradient]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sendButton}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },

  // Info Header
  infoSection: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoTitleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
    marginRight: spacing.sm,
  },
  activityTitle: {
    ...typography.h3,
    fontSize: 18,
    flex: 1,
  },
  infoExpanded: {
    marginTop: spacing.sm + 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    ...typography.caption,
    fontSize: 13,
  },
  membersSection: {
    marginTop: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  membersLabel: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Chat
  chatList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  emptyChatContainer: {
    alignItems: 'center',
    marginTop: 80,
    gap: spacing.sm,
  },
  emptyChatTitle: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  emptyChatSubtitle: {
    ...typography.caption,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 3,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  avatarSlot: {
    width: 32,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bubbleColumn: {
    maxWidth: '75%',
  },
  senderName: {
    ...typography.tiny,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 6,
  },
  bubbleMeGrouped: {
    borderBottomRightRadius: 18,
    borderTopRightRadius: 18,
  },
  bubbleThem: {
    backgroundColor: colors.chatThem,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
  },
  bubbleThemGrouped: {
    borderBottomLeftRadius: 18,
    borderTopLeftRadius: 18,
  },
  bubbleTextMe: {
    ...typography.body,
    color: '#ffffff',
  },
  bubbleTextThem: {
    ...typography.body,
    color: colors.text,
  },
  timestamp: {
    ...typography.tiny,
    fontSize: 10,
    marginTop: 2,
    marginBottom: 6,
    marginLeft: 4,
  },
  timestampMe: {
    textAlign: 'right',
    marginRight: 4,
    marginLeft: 0,
  },

  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  textInput: {
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10,
    maxHeight: 100,
    lineHeight: 20,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
