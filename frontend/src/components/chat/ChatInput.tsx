import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, shadows } from '../../theme';

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
    <View style={[styles.inputBar, shadows.sm]}>
      {replyPreview && (
        <View style={styles.replyPreviewBar}>
          <View style={styles.replyPreviewContent}>
            <Text style={styles.replyPreviewName} numberOfLines={1}>
              {replyPreview.name}
            </Text>
            <Text style={styles.replyPreviewText} numberOfLines={1}>
              {replyPreview.content}
            </Text>
          </View>
          {onCancelReply && (
            <TouchableOpacity onPress={onCancelReply} style={styles.cancelReplyBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
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
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={disabled ? ['#cbd5e1', '#cbd5e1'] : [...colors.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sendButton}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </LinearGradient>
      </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputBar: {
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  replyPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  replyPreviewContent: {
    flex: 1,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.sm,
  },
  replyPreviewName: {
    ...typography.tiny,
    fontWeight: '600',
    color: colors.primary,
  },
  replyPreviewText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cancelReplyBtn: {
    padding: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  textInput: {
    ...typography.body,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10,
    maxHeight: 100,
    lineHeight: 20,
    letterSpacing: 0,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
