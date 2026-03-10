import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { getMessageThreads, resolveAvatarUrl } from '../api';
import { DirectMessageThread } from '../types';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, spacing, radii, typography, shadows } from '../theme';

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function MessagesInboxScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [threads, setThreads] = useState<DirectMessageThread[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getMessageThreads()
        .then(setThreads)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Messages</Text>
      </View>

      <FlatList
        data={threads}
        keyExtractor={(t) => t.id}
        contentContainerStyle={threads.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyBody}>Add friends to start a conversation.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const preview = item.lastMessage?.content ?? '';
          const isMe = item.lastMessage?.senderId === user?.id;
          return (
            <TouchableOpacity
              style={[styles.row, shadows.sm]}
              onPress={() =>
                navigation.navigate('DirectMessageThread', {
                  threadId: item.id,
                  otherUserId: item.otherUser.id,
                  otherUserName: item.otherUser.name,
                })
              }
              activeOpacity={0.8}
            >
              <Avatar
                name={item.otherUser.name}
                size={48}
                uri={resolveAvatarUrl(item.otherUser.avatarUrl)}
              />
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.otherUser.name}
                  </Text>
                  {item.lastMessage && (
                    <Text style={styles.rowTime}>{formatTime(item.lastMessage.createdAt)}</Text>
                  )}
                </View>
                {preview ? (
                  <Text style={styles.rowPreview} numberOfLines={1}>
                    {isMe ? `You: ${preview}` : preview}
                  </Text>
                ) : (
                  <Text style={styles.rowNoMessage}>No messages yet</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  heading: { ...typography.h2 },
  list: { padding: spacing.lg, gap: spacing.sm },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyState: { alignItems: 'center', gap: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.textSecondary },
  emptyBody: { ...typography.body, color: colors.textTertiary, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { ...typography.bodyBold, flex: 1, marginRight: spacing.sm },
  rowTime: { ...typography.tiny, color: colors.textTertiary },
  rowPreview: { ...typography.caption, color: colors.textSecondary },
  rowNoMessage: { ...typography.caption, color: colors.textTertiary, fontStyle: 'italic' },
});
