import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radii, typography, shadows } from '../theme';

type Rating = 1 | 2 | 3;

interface RatingOption {
  value: Rating;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  bg: string;
}

const RATINGS: RatingOption[] = [
  {
    value: 1,
    icon: 'thumbs-down-outline',
    activeIcon: 'thumbs-down',
    label: 'Not great',
    color: colors.red,
    bg: '#fee2e2',
  },
  {
    value: 2,
    icon: 'remove-circle-outline',
    activeIcon: 'remove-circle',
    label: 'It was okay',
    color: colors.amber,
    bg: colors.amberLight,
  },
  {
    value: 3,
    icon: 'thumbs-up-outline',
    activeIcon: 'thumbs-up',
    label: 'Loved it!',
    color: colors.green,
    bg: colors.greenLight,
  },
];

interface Props {
  visible: boolean;
  podTitle?: string;
  initialRating?: Rating | null;
  initialNote?: string | null;
  onSubmit: (rating: Rating, note: string | null) => Promise<void>;
  onClose: () => void;
}

export default function RecapPromptModal({
  visible,
  podTitle,
  initialRating,
  initialNote,
  onSubmit,
  onClose,
}: Props) {
  const [rating, setRating] = useState<Rating | null>(initialRating ?? null);
  const [note, setNote] = useState(initialNote ?? '');
  const [submitting, setSubmitting] = useState(false);

  const handleRatingSelect = (value: Rating) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRating(value);
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      await onSubmit(rating, note.trim() || null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, shadows.lg]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>How was it?</Text>
              {podTitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>{podTitle}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Rating buttons */}
          <View style={styles.ratingRow}>
            {RATINGS.map((opt) => {
              const selected = rating === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.ratingBtn,
                    selected && { backgroundColor: opt.bg, borderColor: opt.color },
                  ]}
                  onPress={() => handleRatingSelect(opt.value)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={selected ? opt.activeIcon : opt.icon}
                    size={32}
                    color={selected ? opt.color : colors.textTertiary}
                  />
                  <Text style={[styles.ratingLabel, selected && { color: opt.color }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Optional note */}
          <View style={styles.noteSection}>
            <Text style={styles.noteLabel}>Add a note <Text style={styles.optionalText}>(optional)</Text></Text>
            <TextInput
              style={styles.noteInput}
              placeholder="What stood out? Any tips for next time…"
              placeholderTextColor={colors.textTertiary}
              value={note}
              onChangeText={(v) => setNote(v.slice(0, 200))}
              multiline
              maxLength={200}
              returnKeyType="done"
            />
            <Text style={styles.charCount}>{note.length}/200</Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, !rating && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!rating || submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Text style={styles.submitBtnText}>Submit Recap</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl ?? 24,
    borderTopRightRadius: radii.xl ?? 24,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  ratingBtn: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  ratingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    textAlign: 'center',
  },
  noteSection: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  noteLabel: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  optionalText: {
    ...typography.tiny,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  noteInput: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    minHeight: 72,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  charCount: {
    ...typography.tiny,
    color: colors.textTertiary,
    alignSelf: 'flex-end',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: colors.textTertiary,
  },
  submitBtnText: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
});
