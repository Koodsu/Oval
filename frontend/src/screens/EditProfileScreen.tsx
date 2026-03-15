import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { updateProfile } from '../api';
import { useAuth } from '../context/AuthContext';
import GradientButton from '../components/GradientButton';
import { colors, spacing, radii, typography, shadows } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

const CLASS_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad'] as const;
const MAJOR_REGEX = /^[a-zA-Z\s&\/\-,\.]+$/;
const INSTAGRAM_REGEX = /^[a-zA-Z0-9._]{1,30}$/;
const CLUB_REGEX = /^[a-zA-Z\s&\-]+$/;

export default function EditProfileScreen({ navigation }: Props) {
  const { user, updateUser } = useAuth();

  const [classYear, setClassYear] = useState(user?.classYear ?? '');
  const [major, setMajor] = useState(user?.major ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [clubs, setClubs] = useState<string[]>(user?.clubs ?? []);
  const [clubInput, setClubInput] = useState('');
  const [instagramHandle, setInstagramHandle] = useState(user?.instagramHandle ?? '');

  const [majorError, setMajorError] = useState('');
  const [clubError, setClubError] = useState('');
  const [instagramError, setInstagramError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateMajor = (value: string) => {
    const t = value.trim();
    if (!t) return 'Major is required';
    if (t.length < 2) return 'Major must be at least 2 characters';
    if (t.length > 60) return 'Major must be 60 characters or fewer';
    if (!MAJOR_REGEX.test(t)) return 'Major can only contain letters and common punctuation';
    return '';
  };

  const validateClub = (value: string) => {
    const t = value.trim();
    if (!t) return '';
    if (t.length < 2) return 'Club name must be at least 2 characters';
    if (t.length > 50) return 'Club name must be 50 characters or fewer';
    if (!CLUB_REGEX.test(t)) return 'Club names can only contain letters, spaces, &, and hyphens';
    return '';
  };

  const handleAddClub = () => {
    const err = validateClub(clubInput);
    if (err) {
      setClubError(err);
      return;
    }
    const trimmed = clubInput.trim();
    if (!trimmed) return;
    if (clubs.length >= 5) {
      setClubError('You can add up to 5 clubs');
      return;
    }
    setClubs([...clubs, trimmed]);
    setClubInput('');
    setClubError('');
  };

  const handleRemoveClub = (index: number) => {
    setClubs(clubs.filter((_, i) => i !== index));
  };

  const handleInstagramChange = (value: string) => {
    const stripped = value.replace(/^@/, '');
    setInstagramHandle(stripped);
    if (instagramError && stripped) {
      setInstagramError(INSTAGRAM_REGEX.test(stripped) ? '' : 'Invalid handle — letters, numbers, periods, underscores only');
    }
  };

  const handleSave = async () => {
    const mError = validateMajor(major);
    if (mError) {
      setMajorError(mError);
      return;
    }
    if (!classYear) {
      Alert.alert('Missing field', 'Please select your class year.');
      return;
    }
    if (instagramHandle && !INSTAGRAM_REGEX.test(instagramHandle)) {
      setInstagramError('Invalid handle — letters, numbers, periods, underscores only');
      return;
    }

    setLoading(true);
    try {
      const updated = await updateProfile({
        classYear,
        major: major.trim(),
        bio: bio.trim() || null,
        clubs,
        instagramHandle: instagramHandle.trim() || null,
      });
      await updateUser(updated);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Class Year */}
        <View style={[styles.section, shadows.sm]}>
          <Text style={styles.sectionTitle}>Class Year</Text>
          <View style={styles.pillRow}>
            {CLASS_YEARS.map((year) => (
              <TouchableOpacity
                key={year}
                style={[styles.pill, classYear === year && styles.pillSelected]}
                onPress={() => setClassYear(year)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, classYear === year && styles.pillTextSelected]}>
                  {year}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Major */}
        <View style={[styles.section, shadows.sm]}>
          <Text style={styles.sectionTitle}>Major</Text>
          <View style={[styles.inputWrapper, majorError ? styles.inputWrapperError : null]}>
            <Ionicons name="school-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Computer Science"
              placeholderTextColor={colors.textTertiary}
              value={major}
              onChangeText={(v) => {
                setMajor(v);
                if (majorError) setMajorError(validateMajor(v));
              }}
              onBlur={() => setMajorError(validateMajor(major))}
              maxLength={60}
              autoCorrect={false}
            />
          </View>
          {majorError ? <Text style={styles.errorText}>{majorError}</Text> : null}
        </View>

        {/* Bio */}
        <View style={[styles.section, shadows.sm]}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Bio</Text>
            <Text style={styles.charCount}>{bio.length}/120</Text>
          </View>
          <TextInput
            style={[styles.inputWrapper, styles.bioInput]}
            placeholder="A short vibe line — e.g. I play intramural soccer and love finding good coffee"
            placeholderTextColor={colors.textTertiary}
            value={bio}
            onChangeText={(v) => setBio(v.slice(0, 120))}
            maxLength={120}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Clubs / Orgs */}
        <View style={[styles.section, shadows.sm]}>
          <Text style={styles.sectionTitle}>Clubs & Orgs <Text style={styles.optionalTag}>optional · up to 5</Text></Text>
          {clubs.length > 0 && (
            <View style={styles.tagRow}>
              {clubs.map((club, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{club}</Text>
                  <TouchableOpacity onPress={() => handleRemoveClub(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close" size={13} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {clubs.length < 5 && (
            <>
              <View style={[styles.inputWrapper, styles.clubInputRow, clubError ? styles.inputWrapperError : null]}>
                <Ionicons name="people-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="e.g. Intramural Soccer"
                  placeholderTextColor={colors.textTertiary}
                  value={clubInput}
                  onChangeText={(v) => {
                    setClubInput(v);
                    if (clubError) setClubError(validateClub(v));
                  }}
                  maxLength={50}
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleAddClub}
                />
                <TouchableOpacity onPress={handleAddClub} style={styles.addButton}>
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
              {clubError ? <Text style={styles.errorText}>{clubError}</Text> : null}
            </>
          )}
        </View>

        {/* Instagram */}
        <View style={[styles.section, shadows.sm]}>
          <Text style={styles.sectionTitle}>Instagram <Text style={styles.optionalTag}>optional</Text></Text>
          <View style={[styles.inputWrapper, instagramError ? styles.inputWrapperError : null]}>
            <Text style={styles.atSign}>@</Text>
            <TextInput
              style={styles.input}
              placeholder="yourhandle"
              placeholderTextColor={colors.textTertiary}
              value={instagramHandle}
              onChangeText={handleInstagramChange}
              onBlur={() => {
                if (instagramHandle && !INSTAGRAM_REGEX.test(instagramHandle)) {
                  setInstagramError('Invalid handle — letters, numbers, periods, underscores only');
                } else {
                  setInstagramError('');
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
            />
          </View>
          {instagramError ? <Text style={styles.errorText}>{instagramError}</Text> : null}
          {!instagramError && instagramHandle ? (
            <Text style={styles.instagramPreview}>@{instagramHandle}</Text>
          ) : null}
        </View>

        <View style={styles.saveSection}>
          <GradientButton
            title="Save Changes"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.text,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    ...typography.tiny,
    color: colors.textTertiary,
  },
  optionalTag: {
    ...typography.tiny,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  pillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pillTextSelected: {
    color: colors.primary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  inputWrapperError: {
    borderColor: colors.red,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
  },
  bioInput: {
    paddingVertical: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    alignItems: 'flex-start',
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary + '15',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  clubInputRow: {
    paddingRight: spacing.xs,
  },
  addButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
  },
  atSign: {
    fontSize: 16,
    color: colors.textTertiary,
    marginRight: 2,
  },
  instagramPreview: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginTop: -spacing.xs,
    paddingLeft: spacing.xs,
  },
  errorText: {
    fontSize: 12,
    color: colors.red,
    marginTop: -spacing.xs,
    paddingLeft: spacing.xs,
  },
  saveSection: {
    marginTop: spacing.sm,
  },
});
