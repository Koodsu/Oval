import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  createReport,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  CreateReportPayload,
} from '../api';
import { colors, spacing, radii, typography } from '../theme';

export interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** For reporting a message */
  messageId?: string;
  podId?: string;
  /** For reporting a pod only */
  podOnly?: boolean;
  /** For reporting a user */
  targetUserId?: string;
}

export default function ReportModal({
  visible,
  onClose,
  onSuccess,
  messageId,
  podId,
  podOnly,
  targetUserId,
}: ReportModalProps) {
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTarget = !!(messageId || podId || targetUserId);
  const title = messageId ? 'Report message' : podOnly ? 'Report pod' : targetUserId ? 'Report user' : 'Report';

  const handleSubmit = async () => {
    if (!reason) {
      setError('Please select a reason');
      return;
    }
    if (!hasTarget) {
      setError('Missing report target');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: CreateReportPayload = {
        reason,
        details: details.trim() || undefined,
      };
      if (podId) payload.podId = podId;
      if (messageId) payload.messageId = messageId;
      if (targetUserId) payload.targetUserId = targetUserId;

      await createReport(payload);
      onSuccess?.();
      onClose();
      setReason('');
      setDetails('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReason('');
      setDetails('');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity
                onPress={handleClose}
                disabled={loading}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.label}>Reason</Text>
              <View style={styles.reasonGrid}>
                {REPORT_REASONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.reasonChip, reason === r && styles.reasonChipSelected]}
                    onPress={() => setReason(r)}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.reasonChipText,
                        reason === r && styles.reasonChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {REPORT_REASON_LABELS[r] ?? r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { marginTop: spacing.md }]}>
                Additional details (optional)
              </Text>
              <TextInput
                style={styles.detailsInput}
                placeholder="Provide more context if helpful..."
                placeholderTextColor={colors.textTertiary}
                value={details}
                onChangeText={(t) => setDetails(t.slice(0, 1000))}
                multiline
                maxLength={1000}
                editable={!loading}
              />
              <Text style={styles.charCount}>{details.length}/1000</Text>

              {error ? (
                <Text style={styles.error}>{error}</Text>
              ) : null}
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
  },
  scroll: {
    maxHeight: 360,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reasonChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonChipSelected: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  reasonChipText: {
    ...typography.body,
    fontSize: 13,
  },
  reasonChipTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  detailsInput: {
    ...typography.body,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.tiny,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
  },
  error: {
    ...typography.caption,
    color: colors.red,
    marginTop: spacing.sm,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
});
