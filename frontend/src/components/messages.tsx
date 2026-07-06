import React, { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BORDER_W, radii, spacing, useTheme } from '../theme';
import { formatTime } from '../utils/format';
import { EmptyState } from './ui';

export type MessageListItem = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl?: string | null };
};

export function MessageList<T extends MessageListItem>({
  messages,
  currentUserId,
  onLongPress,
  emptyActionLabel,
  onEmptyAction,
}: {
  messages: T[];
  currentUserId?: string;
  onLongPress: (message: T) => void;
  emptyActionLabel: string;
  onEmptyAction: () => void;
}) {
  const { colors, typography } = useTheme();
  const newestFirst = useMemo(() => [...messages].reverse(), [messages]);

  return (
    <FlatList
      inverted
      data={newestFirst}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.messageList}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => {
        const mine = item.userId === currentUserId;
        return (
          <Pressable
            onLongPress={() => onLongPress(item)}
            style={[styles.messageWrap, mine && styles.messageMine]}
          >
            <View
              style={[
                styles.bubble,
                mine ? styles.bubbleMine : styles.bubbleTheirs,
                {
                  backgroundColor: mine ? colors.primary : colors.surface,
                  borderColor: mine ? 'transparent' : colors.border,
                },
              ]}
            >
              {!mine ? (
                <Text style={[typography.captionSmall, { color: colors.sub }]}>{item.user.name}</Text>
              ) : null}
              <Text style={[typography.body, { color: mine ? colors.onPrimary : colors.ink }]}>
                {item.content}
              </Text>
              <Text
                style={[
                  typography.captionSmall,
                  { alignSelf: 'flex-end', color: mine ? 'rgba(255,255,255,0.78)' : colors.sub },
                ]}
              >
                {formatTime(item.createdAt)}
              </Text>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <EmptyState
          icon="chatbubbles-outline"
          title="No messages yet"
          body="Start the conversation."
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      }
    />
  );
}

export function MessageComposer({
  value,
  onChangeText,
  onSend,
  sending,
  placeholder = 'Message members...',
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const canSend = Boolean(value.trim()) && !sending;

  return (
    <View
      style={[
        styles.composer,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, spacing.md),
        },
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        style={[
          styles.input,
          { backgroundColor: colors.bg, borderColor: colors.border, color: colors.ink },
        ]}
        multiline
      />
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        style={[
          styles.send,
          {
            backgroundColor: canSend ? colors.primary : colors.faint,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name="arrow-up" size={20} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  messageList: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  messageWrap: {
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  messageMine: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    borderWidth: BORDER_W,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  bubbleMine: {
    borderBottomRightRadius: radii.xs,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: radii.xs,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderWidth: BORDER_W,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
