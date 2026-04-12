import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';

export interface ReplyPreview {
  name: string;
  content: string;
}

export interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder?: string;
  maxLength?: number;
  replyPreview?: ReplyPreview | null;
  onCancelReply?: () => void;
}

const SEND_BG = colors.chatMe; // #B30000 scarlet

export default function ChatInput({
  value,
  onChangeText,
  onSend,
  sending = false,
  placeholder = 'Message...',
  maxLength = 500,
  replyPreview,
  onCancelReply,
}: ChatInputProps) {
  const disabled = !value.trim() || sending;

  return (
    <View style={styles.inputBar}>
      {replyPreview && (
        <View style={styles.replyPreviewBar}>
          <View style={styles.replyPreviewContent}>
            <Text style={styles.replyPreviewName} numberOfLines={1}>
              Replying to {replyPreview.name}
            </Text>
            <Text style={styles.replyPreviewText} numberOfLines={1}>
              {replyPreview.content}
            </Text>
          </View>
          {onCancelReply && (
            <TouchableOpacity
              onPress={onCancelReply}
              style={styles.cancelReplyBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      )}
      <View style={styles.inputRow}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            value={value}
            onChangeText={onChangeText}
            multiline
            maxLength={maxLength}
          />
        </View>
        <TouchableOpacity
          onPress={onSend}
          disabled={disabled}
          activeOpacity={0.75}
          style={[styles.sendButton, disabled && styles.sendButtonDisabled]}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={17} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  replyPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: spacing.xs,
  },
  replyPreviewContent: {
    flex: 1,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.sm,
  },
  replyPreviewName: {
    ...typography.tiny,
    fontWeight: '700',
    color: colors.primary,
    fontSize: 11,
  },
  replyPreviewText: {
    ...typography.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  cancelReplyBtn: {
    padding: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  // Pill-shaped white text input
  inputWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  textInput: {
    ...typography.body,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 9,
    maxHeight: 100,
    lineHeight: 20,
    letterSpacing: 0,
  },
  // Solid scarlet circular send button
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: SEND_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  sendButtonDisabled: {
    backgroundColor: '#D0D0D0',
  },
});
