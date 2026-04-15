import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
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
import { formatThreadTime } from '../utils/format';

export default function MessagesInboxScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [threads, setThreads] = useState<DirectMessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.trim().toLowerCase();
    return threads.filter((t) => t.otherUser.name.toLowerCase().includes(q));
  }, [threads, searchQuery]);

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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.tabLoadingInner}>
          <ActivityIndicator size="large" color={colors.scarlet} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Messages</Text>
        {threads.length > 0 && (
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        )}
      </View>

      <FlatList
        data={filteredThreads}
        keyExtractor={(t) => t.id}
        contentContainerStyle={filteredThreads.length === 0 ? styles.emptyContainer : styles.list}
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
          const hasUnread = item.hasUnread ?? false;
          return (
            <TouchableOpacity
              style={[styles.row, shadows.sm, hasUnread && styles.rowUnread]}
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
                  <View style={styles.rowNameWrap}>
                    <Text style={[styles.rowName, hasUnread && styles.rowNameUnread]} numberOfLines={1}>
                      {item.otherUser.name}
                    </Text>
                    {hasUnread && <View style={styles.unreadDot} />}
                  </View>
                  {item.lastMessage && (
                    <Text style={styles.rowTime}>{formatThreadTime(item.lastMessage.createdAt)}</Text>
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
  container: { flex: 1, backgroundColor: colors.cream },
  tabLoadingInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  heading: { ...typography.h2, marginBottom: spacing.sm },
  searchInput: {
    ...typography.body,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
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
  rowUnread: {
    backgroundColor: colors.bg,
  },
  rowNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  rowNameUnread: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.xs,
  },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { ...typography.bodyBold, flex: 1, marginRight: spacing.xs, minWidth: 0 },
  rowTime: { ...typography.tiny, color: colors.textTertiary },
  rowPreview: { ...typography.caption, color: colors.textSecondary },
  rowNoMessage: { ...typography.caption, color: colors.textTertiary, fontStyle: 'italic' },
});
