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

const ACCENT = colors.scarlet;

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
              <Ionicons name="close-circle" size={20} color={colors.textMutedLight} />
            </TouchableOpacity>
          )}
        </View>
      )}
      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.6} accessibilityLabel="Attach (coming soon)">
          <Ionicons name="image-outline" size={22} color="#AAAAAA" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.6} accessibilityLabel="Emoji (coming soon)">
          <Ionicons name="happy-outline" size={22} color="#AAAAAA" />
        </TouchableOpacity>
        <View style={styles.inputWrapper}>
          {value.length > 0 && (
            <Text style={[styles.charCounter, value.length >= maxLength - 50 && styles.charCounterWarn]}>
              {value.length}/{maxLength}
            </Text>
          )}
          <TextInput
            style={styles.textInput}
            placeholder={placeholder}
            placeholderTextColor={colors.textMutedLight}
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
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
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
    borderTopColor: colors.creamBorder,
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
    borderBottomColor: colors.creamBorder,
    marginBottom: spacing.xs,
  },
  replyPreviewContent: {
    flex: 1,
    borderLeftWidth: 2,
    borderLeftColor: ACCENT,
    paddingLeft: spacing.sm,
  },
  replyPreviewName: {
    ...typography.tiny,
    fontWeight: '700',
    color: ACCENT,
    fontSize: 11,
  },
  replyPreviewText: {
    ...typography.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  cancelReplyBtn: {
    padding: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  iconBtn: {
    paddingBottom: 8,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.cream,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
    minHeight: 40,
  },
  charCounter: {
    fontSize: 11,
    color: colors.textMutedLight,
    textAlign: 'right',
    paddingTop: 4,
  },
  charCounterWarn: {
    color: colors.scarlet,
  },
  textInput: {
    ...typography.body,
    fontSize: 15,
    color: colors.textOnLight,
    paddingVertical: 8,
    maxHeight: 100,
    lineHeight: 20,
    letterSpacing: 0,
  },
  sendButton: {
    width: 36,
    height: 36,
    minWidth: 36,
    minHeight: 36,
    maxWidth: 36,
    maxHeight: 36,
    borderRadius: 18,
    backgroundColor: '#BB0000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    backgroundColor: '#BB0000',
    opacity: 0.38,
  },
});
