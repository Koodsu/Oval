import React, { useMemo } from 'react';
import {
  FlatList,
  Image,
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
import { resolveAvatarUrl } from '../api';

const PREVIEW_PHOTOGRAPHY_HERO = require('../../assets/content/clubs/photography-club-hero.png');

export type MessageListItem = {
  id: string;
  userId: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  user: { id: string; name: string; avatarUrl?: string | null };
  reactions?: Array<{ emoji: string; userId: string }>;
  replyTo?: {
    id: string;
    content: string;
    userId: string;
    user: { id: string; name: string };
  } | null;
};

export function MessageList<T extends MessageListItem>({
  messages,
  currentUserId,
  onLongPress,
  emptyActionLabel,
  onEmptyAction,
  onReact,
}: {
  messages: T[];
  currentUserId?: string;
  onLongPress: (message: T) => void;
  emptyActionLabel: string;
  onEmptyAction: () => void;
  onReact?: (message: T, emoji: string) => void;
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
        const heartCount = item.reactions?.filter((reaction) => reaction.emoji === '❤️').length ?? 0;
        const hearted = item.reactions?.some(
          (reaction) => reaction.emoji === '❤️' && reaction.userId === currentUserId,
        ) ?? false;
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
              {item.replyTo ? (
                <View
                  style={[
                    styles.reply,
                    {
                      backgroundColor: mine ? 'rgba(255,255,255,0.13)' : colors.surfaceAlt,
                      borderLeftColor: mine ? colors.onPrimary : colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.captionSmall,
                      { color: mine ? colors.onPrimary : colors.accentText },
                    ]}
                  >
                    Replying to {item.replyTo.user.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      typography.captionSmall,
                      { color: mine ? 'rgba(255,255,255,0.78)' : colors.sub },
                    ]}
                  >
                    {item.replyTo.content}
                  </Text>
                </View>
              ) : null}
              {item.imageUrl ? (
                <Image
                  source={
                    item.imageUrl === 'preview://photography-club-hero'
                      ? PREVIEW_PHOTOGRAPHY_HERO
                      : { uri: resolveAvatarUrl(item.imageUrl) ?? item.imageUrl }
                  }
                  resizeMode="cover"
                  accessibilityLabel={`${item.user.name} shared a photo`}
                  style={styles.messageImage}
                />
              ) : null}
              {item.content ? (
                <Text style={[typography.body, { color: mine ? colors.onPrimary : colors.ink }]}>
                  {item.content}
                </Text>
              ) : null}
              <Text
                style={[
                  typography.captionSmall,
                  { alignSelf: 'flex-end', color: mine ? 'rgba(255,255,255,0.78)' : colors.sub },
                ]}
              >
                {formatTime(item.createdAt)}
              </Text>
              {heartCount ? (
                <Pressable
                  onPress={() => onReact?.(item, '❤️')}
                  accessibilityRole="button"
                  accessibilityLabel={`${hearted ? 'Remove' : 'Add'} heart reaction`}
                  style={[
                    styles.reaction,
                    {
                      backgroundColor: mine ? 'rgba(255,255,255,0.16)' : colors.primarySoft,
                    },
                  ]}
                >
                  <Text style={typography.captionSmall}>❤️ {heartCount}</Text>
                </Pressable>
              ) : null}
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
  onAttach,
  hasAttachment = false,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder?: string;
  onAttach?: () => void;
  hasAttachment?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const canSend = (Boolean(value.trim()) || hasAttachment) && !sending;

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
      {onAttach ? (
        <Pressable
          onPress={onAttach}
          disabled={sending}
          accessibilityRole="button"
          accessibilityLabel="Attach a photo"
          style={[
            styles.attach,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
              opacity: sending ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons name="image-outline" size={21} color={colors.accentText} />
        </Pressable>
      ) : null}
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
  reply: {
    borderLeftWidth: 3,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  messageImage: {
    width: 220,
    height: 165,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  reaction: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: spacing.xs,
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
  attach: {
    width: 44,
    height: 44,
    borderWidth: BORDER_W,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
