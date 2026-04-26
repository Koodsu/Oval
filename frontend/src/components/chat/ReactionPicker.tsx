import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Modal, Pressable, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radii, typography } from '../../theme';

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'] as const;

export interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  onReply?: () => void;
  onReport?: () => void;
  onDelete?: () => void;
  myReaction?: string;
}

export default function ReactionPicker({
  visible,
  onClose,
  onSelect,
  onReply,
  onReport,
  onDelete,
  myReaction,
}: ReactionPickerProps) {
  const handleSelect = (emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(emoji);
    onClose();
  };

  const handleReply = () => {
    onClose();
    onReply?.();
  };

  const handleReport = () => {
    onClose();
    onReport?.();
  };

  const handleDelete = () => {
    onClose();
    onDelete?.();
  };

  const scaleAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.6);
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 12,
      }).start();
    }
  }, [visible, scaleAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.picker, { transform: [{ scale: scaleAnim }] }]} onStartShouldSetResponder={() => true}>
          {REACTION_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={[
                styles.emojiButton,
                myReaction === emoji && styles.emojiButtonActive,
              ]}
              onPress={() => handleSelect(emoji)}
              activeOpacity={0.7}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          {onReply && (
            <TouchableOpacity
              style={[styles.emojiButton, styles.actionButton]}
              onPress={handleReply}
              activeOpacity={0.7}
            >
              <Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>
          )}
          {onReport && (
            <TouchableOpacity
              style={[styles.emojiButton, styles.reportButton]}
              onPress={handleReport}
              activeOpacity={0.7}
            >
              <Text style={styles.reportText}>Report</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              style={[styles.emojiButton, styles.deleteButton]}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  picker: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.sm,
    gap: spacing.xs,
    ...typography.body,
  },
  emojiButton: {
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  emojiButtonActive: {
    backgroundColor: colors.borderLight,
  },
  emoji: {
    fontSize: 24,
  },
  actionButton: {
    marginLeft: spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
  },
  actionText: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 13,
  },
  reportButton: {
    marginLeft: spacing.xs,
    paddingLeft: spacing.sm,
  },
  reportText: {
    ...typography.caption,
    color: colors.red,
    fontSize: 13,
  },
  deleteButton: {
    marginLeft: spacing.xs,
    paddingLeft: spacing.sm,
  },
  deleteText: {
    ...typography.caption,
    color: colors.red,
    fontSize: 13,
    fontWeight: '700',
  },
});
