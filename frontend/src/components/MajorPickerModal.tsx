import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  SectionList,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '../theme';

export const MAJOR_SECTIONS = [
  {
    title: '',
    data: ['Undecided'],
  },
  {
    title: 'Engineering & Technology',
    data: [
      'Computer Science',
      'Software Engineering',
      'Computer Engineering',
      'Electrical Engineering',
      'Mechanical Engineering',
      'Civil Engineering',
      'Chemical Engineering',
      'Aerospace Engineering',
      'Biomedical Engineering',
      'Data Science',
      'Information Systems',
    ],
  },
  {
    title: 'Business',
    data: [
      'Business',
      'Finance',
      'Accounting',
      'Marketing',
      'Management',
      'Entrepreneurship',
      'Supply Chain & Logistics',
      'Economics',
    ],
  },
  {
    title: 'Pre-Professional',
    data: ['Pre-Med', 'Pre-Law', 'Pre-Pharmacy', 'Pre-Dental', 'Pre-Vet'],
  },
  {
    title: 'Health & Sciences',
    data: [
      'Nursing',
      'Public Health',
      'Biology',
      'Biochemistry',
      'Chemistry',
      'Physics',
      'Mathematics',
      'Statistics',
      'Neuroscience',
      'Environmental Science',
    ],
  },
  {
    title: 'Social Sciences & Humanities',
    data: [
      'Psychology',
      'Sociology',
      'Political Science',
      'History',
      'English',
      'Philosophy',
      'Communications',
      'Journalism',
      'Education',
      'Social Work',
      'Criminal Justice',
    ],
  },
  {
    title: 'Arts & Design',
    data: ['Art & Design', 'Architecture', 'Music', 'Film & Media', 'Theatre'],
  },
  {
    title: 'Agriculture & Environment',
    data: ['Agriculture', 'Food Science', 'Natural Resources'],
  },
  {
    title: '',
    data: ['Other'],
  },
];

// Flat list of all preset options for lookups
export const PRESET_MAJORS = MAJOR_SECTIONS.flatMap((s) => s.data);

interface Props {
  visible: boolean;
  selected: string;
  onSelect: (major: string) => void;
  onClose: () => void;
}

export default function MajorPickerModal({ visible, selected, onSelect, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <SafeAreaView style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Major</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <SectionList
          sections={MAJOR_SECTIONS}
          keyExtractor={(item) => item}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isSelected = selected === item;
            const isSpecial = item === 'Undecided' || item === 'Other';
            return (
              <TouchableOpacity
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected,
                    isSpecial && styles.optionTextSpecial,
                  ]}
                >
                  {item}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </Modal>
  );
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: SCREEN_HEIGHT * 0.75,
    paddingBottom: spacing.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    ...typography.h3,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  sectionHeader: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  sectionHeaderText: {
    ...typography.label,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    backgroundColor: colors.primary + '08',
  },
  optionText: {
    ...typography.body,
    color: colors.text,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  optionTextSpecial: {
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.lg,
  },
});
