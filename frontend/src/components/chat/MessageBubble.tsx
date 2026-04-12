import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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

export interface MessageBubbleProps {
  message: MessageBubbleMessage;
  isMe: boolean;
  showAvatar: boolean;
  isLastInGroup: boolean;
  currentUserId?: string;
  isReadByOther?: boolean;
  onLongPress?: () => void;
  onAvatarPress?: () => void;
  resolveAvatarUrl?: (url: string | null | undefined) => string | undefined;
  formatTime?: (iso: string) => string;
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

export default function MessageBubble({
  message,
  isMe,
  showAvatar,
  isLastInGroup,
  currentUserId,
  isReadByOther,
  onLongPress,
  onAvatarPress,
  resolveAvatarUrl = () => undefined,
  formatTime = timeAgo,
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
    return Array.from(byEmoji.entries()).map(([emoji, { count, userIds }]) => ({
      emoji,
      count,
      hasMe: currentUserId ? userIds.has(currentUserId) : false,
    }));
  }, [message.reactions, currentUserId]);

  // Tail: last message in a group gets a smaller bottom corner (iMessage style)
  // Non-last messages in a group get fully rounded corners on the "inner" side
  const bubbleStyle = isMe
    ? [
        styles.bubble,
        styles.bubbleMe,
        !isLastInGroup && styles.bubbleMeGrouped,
      ]
    : [
        styles.bubble,
        styles.bubbleThem,
        !isLastInGroup && styles.bubbleThemGrouped,
      ];

  return (
    <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
      {/* Avatar slot always present for "them" to maintain alignment */}
      {!isMe && (
        <View style={styles.avatarSlot}>
          {showAvatar && sender ? (
            <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7}>
              <Avatar name={sender.name} size={30} uri={avatarUri} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <View style={[styles.bubbleColumn, isMe && styles.bubbleColumnMe]}>
        {/* Sender name above first message in a sequence (others only) */}
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
          {/* Reply preview */}
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

        {/* Reactions */}
        {reactionGroups.length > 0 && (
          <View style={[styles.reactionsRow, isMe && styles.reactionsRowMe]}>
            {reactionGroups.map(({ emoji, count }) => (
              <View key={emoji} style={styles.reactionChip}>
                <Text style={styles.reactionChipText}>
                  {emoji}{count > 1 ? ` ${count}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Timestamp + read receipt on last message in group */}
        {isLastInGroup && (
          <View style={[styles.timestampRow, isMe && styles.timestampRowMe]}>
            <Text style={[styles.timestamp, isMe && styles.timestampMe]}>
              {formatTime(message.createdAt)}
            </Text>
            {isMe && isReadByOther && (
              <Ionicons name="checkmark-done" size={13} color={colors.primary} style={styles.readReceipt} />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const BUBBLE_RADIUS = 18;
const TAIL_RADIUS = 4;
const CHAT_BG = '#F5F5F5';
const THEM_BORDER = '#E5E5EA';

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 2,
    paddingHorizontal: spacing.sm,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  avatarSlot: {
    width: 34,
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
    ...typography.tiny,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 3,
    marginLeft: 2,
    fontSize: 11,
  },

  // Base bubble
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: BUBBLE_RADIUS,
  },

  // My messages — scarlet, tail bottom-right
  bubbleMe: {
    backgroundColor: colors.chatMe,
    alignSelf: 'flex-end',
    borderBottomRightRadius: TAIL_RADIUS,
  },
  // Non-last "me" messages in a sequence — fully rounded right side
  bubbleMeGrouped: {
    borderBottomRightRadius: BUBBLE_RADIUS,
    borderTopRightRadius: BUBBLE_RADIUS,
  },

  // Their messages — white with gray border, tail bottom-left
  bubbleThem: {
    backgroundColor: colors.chatThem,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: TAIL_RADIUS,
    borderWidth: 1,
    borderColor: THEM_BORDER,
  },
  // Non-last "them" messages in a sequence — fully rounded left side
  bubbleThemGrouped: {
    borderBottomLeftRadius: BUBBLE_RADIUS,
    borderTopLeftRadius: BUBBLE_RADIUS,
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
    color: colors.text,
  },

  // Timestamps
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
    marginBottom: 4,
    marginLeft: 2,
  },
  timestampRowMe: {
    alignSelf: 'flex-end',
    marginLeft: 0,
    marginRight: 2,
  },
  timestamp: {
    ...typography.tiny,
    fontSize: 10,
    color: colors.textTertiary,
  },
  timestampMe: {
    textAlign: 'right',
  },
  readReceipt: {
    marginLeft: 1,
  },

  // Reactions
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
    backgroundColor: CHAT_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEM_BORDER,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reactionChipText: {
    fontSize: 12,
  },

  // Reply previews
  replyPreviewMe: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.5)',
    paddingLeft: 8,
    marginBottom: 6,
  },
  replyPreviewThem: {
    borderLeftWidth: 2,
    borderLeftColor: colors.primary + '60',
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
    color: colors.primary,
  },
  replyPreviewContentMe: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 1,
    lineHeight: 16,
  },
  replyPreviewContentThem: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
    lineHeight: 16,
  },
});
