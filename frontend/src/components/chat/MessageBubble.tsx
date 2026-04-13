import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../Avatar';
import { colors, spacing, typography } from '../../theme';

export interface MessageReactionItem {
  emoji: string;
  userId: string;
}

export interface MessageReplyTo {
  id: string;
  content: string;
  user?: { id: string; name: string };
  sender?: { id: string; name: string };
}

export interface MessageBubbleMessage {
  id: string;
  content: string;
  createdAt: string;
  user?: { id: string; name: string; avatarUrl?: string | null };
  sender?: { id: string; name: string; avatarUrl?: string | null };
  reactions?: MessageReactionItem[];
  replyTo?: MessageReplyTo | null;
}

const R = 18;
/** Tight chain corner where two same-side bubbles meet */
const CHAIN = 4;

/** Sent (right): first = BR 4; last = TR 4; middle = TR+BR 4; solo = both 4. Received: mirror on left (BL / TL). */
function groupedBubbleCorners(isMe: boolean, isFirst: boolean, isLast: boolean): ViewStyle {
  if (isMe) {
    if (isFirst && isLast) {
      return {
        borderTopLeftRadius: R,
        borderTopRightRadius: CHAIN,
        borderBottomLeftRadius: R,
        borderBottomRightRadius: CHAIN,
      };
    }
    if (isFirst) {
      return {
        borderTopLeftRadius: R,
        borderTopRightRadius: R,
        borderBottomLeftRadius: R,
        borderBottomRightRadius: CHAIN,
      };
    }
    if (isLast) {
      return {
        borderTopLeftRadius: R,
        borderTopRightRadius: CHAIN,
        borderBottomLeftRadius: R,
        borderBottomRightRadius: R,
      };
    }
    return {
      borderTopLeftRadius: R,
      borderTopRightRadius: CHAIN,
      borderBottomLeftRadius: R,
      borderBottomRightRadius: CHAIN,
    };
  }

  if (isFirst && isLast) {
    return {
      borderTopLeftRadius: R,
      borderTopRightRadius: R,
      borderBottomRightRadius: R,
      borderBottomLeftRadius: CHAIN,
    };
  }
  if (isFirst) {
    return {
      borderTopLeftRadius: R,
      borderTopRightRadius: R,
      borderBottomRightRadius: R,
      borderBottomLeftRadius: CHAIN,
    };
  }
  if (isLast) {
    return {
      borderTopLeftRadius: CHAIN,
      borderTopRightRadius: R,
      borderBottomRightRadius: R,
      borderBottomLeftRadius: R,
    };
  }
  return {
    borderTopLeftRadius: R,
    borderTopRightRadius: R,
    borderBottomRightRadius: R,
    borderBottomLeftRadius: R,
  };
}

export interface MessageBubbleProps {
  message: MessageBubbleMessage;
  isMe: boolean;
  showAvatar: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  /** Index in the messages array (for vertical spacing between sender groups). */
  listIndex?: number;
  currentUserId?: string;
  isReadByOther?: boolean;
  /** When true, show read receipt on last own bubble (DM threads). */
  showReadReceipt?: boolean;
  onLongPress?: () => void;
  onAvatarPress?: () => void;
  resolveAvatarUrl?: (url: string | null | undefined) => string | undefined;
}

export default function MessageBubble({
  message,
  isMe,
  showAvatar,
  isFirstInGroup,
  isLastInGroup,
  listIndex = 0,
  isReadByOther,
  showReadReceipt = false,
  onLongPress,
  onAvatarPress,
  resolveAvatarUrl = () => undefined,
}: MessageBubbleProps) {
  const sender = message.user ?? message.sender;
  const avatarUri = sender ? resolveAvatarUrl(sender.avatarUrl) : undefined;

  const reactionGroups = React.useMemo(() => {
    const byEmoji = new Map<string, { count: number; userIds: Set<string> }>();
    for (const r of message.reactions ?? []) {
      const cur = byEmoji.get(r.emoji) ?? { count: 0, userIds: new Set<string>() };
      cur.count += 1;
      cur.userIds.add(r.userId);
      byEmoji.set(r.emoji, cur);
    }
    return Array.from(byEmoji.entries()).map(([emoji, { count }]) => ({
      emoji,
      count,
    }));
  }, [message.reactions]);

  const cornerStyle = groupedBubbleCorners(isMe, isFirstInGroup, isLastInGroup);
  const bubbleStyle = [
    styles.bubbleBase,
    isMe ? styles.bubbleMeFill : styles.bubbleThemFill,
    cornerStyle,
    !isMe && THEM_SHADOW,
  ];

  const rowMarginTop = isFirstInGroup ? (listIndex > 0 ? 12 : 4) : 0;
  const rowMarginBottom = isMe
    ? isLastInGroup
      ? 10
      : 2
    : isLastInGroup
      ? 0
      : 2;

  const showReceipt = Boolean(showReadReceipt && isMe && isLastInGroup && isReadByOther);

  return (
    <View
      style={[
        styles.messageRow,
        isMe && styles.messageRowMe,
        { marginTop: rowMarginTop, marginBottom: rowMarginBottom },
      ]}
    >
      {!isMe && (
        <View style={styles.avatarSlot}>
          {showAvatar && sender ? (
            <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7}>
              <Avatar name={sender.name} size={32} uri={avatarUri} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <View style={[styles.bubbleColumn, isMe && styles.bubbleColumnMe]}>
        {showAvatar && !isMe && sender && (
          <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7}>
            <Text style={styles.senderName}>{sender.name.split(' ')[0]}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={bubbleStyle}
          onLongPress={onLongPress}
          activeOpacity={0.95}
          delayLongPress={400}
        >
          {message.replyTo && (
            <View style={isMe ? styles.replyPreviewMe : styles.replyPreviewThem}>
              <Text style={isMe ? styles.replyPreviewNameMe : styles.replyPreviewNameThem} numberOfLines={1}>
                {(message.replyTo.user ?? message.replyTo.sender)?.name ?? 'Unknown'}
              </Text>
              <Text style={isMe ? styles.replyPreviewContentMe : styles.replyPreviewContentThem} numberOfLines={2}>
                {message.replyTo.content}
              </Text>
            </View>
          )}
          <Text style={isMe ? styles.bubbleTextMe : styles.bubbleTextThem}>
            {message.content}
          </Text>
        </TouchableOpacity>

        {reactionGroups.length > 0 && (
          <View style={[styles.reactionsRow, isMe && styles.reactionsRowMe]}>
            {reactionGroups.map(({ emoji, count }) => (
              <View key={emoji} style={styles.reactionChip}>
                <Text style={styles.reactionChipText}>
                  {emoji}
                  {count > 1 ? ` ${count}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {showReceipt && (
          <View style={styles.readRow}>
            <Ionicons name="checkmark-done" size={13} color={colors.scarlet} />
          </View>
        )}
      </View>
    </View>
  );
}

const SCARLET = colors.scarlet;
const THEM_SHADOW =
  Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 1 },
    },
    android: { elevation: 2 },
  }) ?? {};

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  avatarSlot: {
    width: 36,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bubbleColumn: {
    maxWidth: '72%',
  },
  bubbleColumnMe: {
    alignItems: 'flex-end',
  },
  senderName: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: 3,
    marginLeft: 2,
  },

  bubbleBase: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    overflow: 'hidden',
  },
  bubbleMeFill: {
    backgroundColor: SCARLET,
    alignSelf: 'flex-end',
  },
  bubbleThemFill: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },

  bubbleTextMe: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  bubbleTextThem: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textOnLight,
  },

  readRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 2,
    marginRight: 2,
  },

  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
    marginLeft: 2,
    alignSelf: 'flex-start',
  },
  reactionsRowMe: {
    alignSelf: 'flex-end',
    marginLeft: 0,
    marginRight: 2,
  },
  reactionChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.creamBorder,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reactionChipText: {
    fontSize: 12,
    color: colors.textMuted,
  },

  replyPreviewMe: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.5)',
    paddingLeft: 8,
    marginBottom: 6,
  },
  replyPreviewThem: {
    borderLeftWidth: 2,
    borderLeftColor: `${SCARLET}99`,
    paddingLeft: 8,
    marginBottom: 6,
  },
  replyPreviewNameMe: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  replyPreviewNameThem: {
    fontSize: 11,
    fontWeight: '600',
    color: SCARLET,
  },
  replyPreviewContentMe: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 1,
    lineHeight: 16,
  },
  replyPreviewContentThem: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
    lineHeight: 16,
  },
});
