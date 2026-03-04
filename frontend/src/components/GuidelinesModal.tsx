import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, shadows } from '../theme';

const GUIDELINES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'heart-outline',
    title: 'Be respectful',
    body: 'Treat every pod member with kindness. No harassment, hate speech, or personal attacks.',
  },
  {
    icon: 'checkmark-circle-outline',
    title: 'Show up',
    body: 'When you commit to a pod meetup, follow through. Your pods count on you.',
  },
  {
    icon: 'lock-closed-outline',
    title: 'Keep it safe',
    body: 'Do not share personal information (phone numbers, addresses) in pod chats.',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Stay on topic',
    body: 'Keep conversation relevant to the activity and getting to know your pod.',
  },
  {
    icon: 'flag-outline',
    title: 'Report issues',
    body: 'If something feels wrong, use the Report button. We review every report.',
  },
];

export interface GuidelinesModalProps {
  visible: boolean;
  onAccept: () => void;
  onClose: () => void;
}

export default function GuidelinesModal({ visible, onAccept, onClose }: GuidelinesModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Community Guidelines</Text>
              <Text style={styles.subtitle}>Read before joining your first pod</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Dismiss"
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Guidelines list */}
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {GUIDELINES.map((g, i) => (
              <View key={i} style={styles.guidelineRow}>
                <View style={styles.guidelineIcon}>
                  <Ionicons name={g.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.guidelineContent}>
                  <Text style={styles.guidelineTitle}>{g.title}</Text>
                  <Text style={styles.guidelineBody}>{g.body}</Text>
                </View>
              </View>
            ))}

            <View style={styles.footer}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.footerText}>
                Violations may result in removal from pods or account suspension.
              </Text>
            </View>
          </ScrollView>

          {/* CTA */}
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={onAccept}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark" size={18} color={colors.textInverse} />
            <Text style={styles.acceptText}>I Agree & Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h3,
  },
  subtitle: {
    ...typography.tiny,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  scroll: {
    maxHeight: 340,
  },
  guidelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  guidelineIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  guidelineContent: {
    flex: 1,
    paddingTop: 1,
  },
  guidelineTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    marginBottom: 2,
  },
  guidelineBody: {
    ...typography.caption,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-start',
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  footerText: {
    ...typography.tiny,
    flex: 1,
    lineHeight: 16,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  acceptText: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
});
