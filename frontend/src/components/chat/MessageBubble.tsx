import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../Avatar';
import { colors, spacing, radii, typography } from '../../theme';

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

  const bubbleStyle = [
    styles.bubble,
    isMe ? styles.bubbleMe : styles.bubbleThem,
    !isLastInGroup && (isMe ? styles.bubbleMeGrouped : styles.bubbleThemGrouped),
  ];

  return (
    <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
      {!isMe && (
        <View style={styles.avatarSlot}>
          {showAvatar && sender ? (
            <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7}>
              <Avatar name={sender.name} size={28} uri={avatarUri} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      <View style={styles.bubbleColumn}>
        {showAvatar && !isMe && sender && (
          <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7}>
            <Text style={styles.senderName}>{sender.name.split(' ')[0]}</Text>
          </TouchableOpacity>
        )}
        {isMe ? (
          <TouchableOpacity
            onLongPress={onLongPress}
            activeOpacity={1}
            delayLongPress={400}
          >
            <LinearGradient
              colors={[...colors.chatMe]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={bubbleStyle}
            >
              {message.replyTo && (
                <View style={styles.replyPreview}>
                  <Text style={styles.replyPreviewName} numberOfLines={1}>
                    {(message.replyTo.user ?? message.replyTo.sender)?.name ?? 'Unknown'}
                  </Text>
                  <Text style={styles.replyPreviewContent} numberOfLines={2}>
                    {message.replyTo.content}
                  </Text>
                </View>
              )}
              <Text style={styles.bubbleTextMe}>{message.content}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={bubbleStyle}
            onLongPress={onLongPress}
            activeOpacity={1}
            delayLongPress={400}
          >
            {message.replyTo && (
              <View style={styles.replyPreviewThem}>
                <Text style={styles.replyPreviewName} numberOfLines={1}>
                  {(message.replyTo.user ?? message.replyTo.sender)?.name ?? 'Unknown'}
                </Text>
                <Text style={styles.replyPreviewContentThem} numberOfLines={2}>
                  {message.replyTo.content}
                </Text>
              </View>
            )}
            <Text style={styles.bubbleTextThem}>{message.content}</Text>
          </TouchableOpacity>
        )}
        {reactionGroups.length > 0 && (
          <View style={[styles.reactionsRow, isMe && styles.reactionsRowMe]}>
            {reactionGroups.map(({ emoji, count }) => (
              <Text key={emoji} style={styles.reactionChip}>
                {emoji}{count > 1 ? ` ${count}` : ''}
              </Text>
            ))}
          </View>
        )}
        {isLastInGroup && (
          <View style={[styles.timestampRow, isMe && styles.timestampRowMe]}>
            <Text style={[styles.timestamp, isMe && styles.timestampMe]}>
              {formatTime(message.createdAt)}
            </Text>
            {isMe && isReadByOther && (
              <Ionicons name="checkmark-done" size={14} color={colors.primary} style={styles.readReceipt} />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    marginBottom: 6,
    marginLeft: 4,
  },
  timestampRowMe: {
    alignSelf: 'flex-end',
    marginLeft: 0,
    marginRight: 4,
  },
  timestamp: {
    ...typography.tiny,
    fontSize: 10,
  },
  timestampMe: {
    textAlign: 'right',
  },
  readReceipt: {
    marginLeft: 2,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
    marginLeft: 4,
    alignSelf: 'flex-start',
  },
  reactionsRowMe: {
    alignSelf: 'flex-end',
    marginLeft: 0,
    marginRight: 4,
  },
  reactionChip: {
    ...typography.tiny,
    fontSize: 12,
  },
  replyPreview: {
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(255,255,255,0.6)',
    paddingLeft: 8,
    marginBottom: 6,
  },
  replyPreviewThem: {
    borderLeftWidth: 3,
    borderLeftColor: colors.textTertiary,
    paddingLeft: 8,
    marginBottom: 6,
  },
  replyPreviewName: {
    ...typography.tiny,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
  },
  replyPreviewContent: {
    ...typography.tiny,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  replyPreviewContentThem: {
    ...typography.tiny,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
