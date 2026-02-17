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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { getPod, getMessages, sendMessage } from '../api';
import { Pod, Message } from '../types';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Pod'>;

const STATUS_COLORS: Record<string, string> = {
  FORMING: '#f59e0b',
  LOCKED: '#3b82f6',
  COMPLETED: '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  FORMING: 'Forming',
  LOCKED: 'Locked',
  COMPLETED: 'Completed',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PodScreen({ route }: Props) {
  const { podId } = route.params;
  const { user } = useAuth();

  const [pod, setPod] = useState<Pod | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

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

    // Poll messages every 3 seconds
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchPod, fetchMessages]);

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text) return;
    setMessageText('');
    setSending(true);
    try {
      const msg = await sendMessage(podId, text);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send message');
      setMessageText(text); // restore on failure
    } finally {
      setSending(false);
    }
  };

  if (loading || !pod) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a1a1a" />
      </View>
    );
  }

  const statusColor = STATUS_COLORS[pod.status] ?? '#888';
  const memberCount = pod.members.length;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Pod Info Header */}
      <View style={styles.infoSection}>
        <View style={styles.titleRow}>
          <Text style={styles.activityTitle}>{pod.activity?.title ?? 'Pod'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{STATUS_LABELS[pod.status]}</Text>
          </View>
        </View>

        <Text style={styles.meta}>🕐 {formatTime(pod.meetupTime)}</Text>
        <Text style={styles.meta}>📍 {pod.location}</Text>

        <View style={styles.membersRow}>
          <Text style={styles.membersLabel}>Members {memberCount}/4</Text>
          <View style={styles.membersList}>
            {pod.members.map((m) => (
              <View key={m.id} style={styles.memberChip}>
                <Text style={styles.memberChipText}>
                  {m.user.name.split(' ')[0]}
                  {m.user.id === user?.id ? ' (you)' : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Chat */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <Text style={styles.emptyChat}>No messages yet. Say hi!</Text>
        }
        renderItem={({ item }) => {
          const isMe = item.user.id === user?.id;
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
              {!isMe && <Text style={styles.senderName}>{item.user.name}</Text>}
              <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
            </View>
          );
        }}
      />

      {/* Message Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          placeholder="Message..."
          placeholderTextColor="#aaa"
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
  },
  membersRow: {
    marginTop: 10,
  },
  membersLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  memberChip: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  memberChipText: {
    fontSize: 13,
    color: '#333',
  },
  chatList: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyChat: {
    textAlign: 'center',
    color: '#aaa',
    marginTop: 40,
    fontSize: 14,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 8,
  },
  bubbleThem: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleMe: {
    backgroundColor: '#1a1a1a',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: 11,
    color: '#888',
    marginBottom: 3,
  },
  bubbleText: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 21,
  },
  bubbleTextMe: {
    color: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
