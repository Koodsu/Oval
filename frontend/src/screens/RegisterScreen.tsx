import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { register, API_USER_MESSAGE } from '../api';
import { useAuth } from '../context/AuthContext';
import GradientButton from '../components/GradientButton';
import MajorPickerModal from '../components/MajorPickerModal';
import { colors, spacing, radii, shadows } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const CLASS_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad'] as const;
const CUSTOM_MAJOR_REGEX = /^[a-zA-Z\s&\/\-,\.\(\)]+$/;

export default function RegisterScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [classYear, setClassYear] = useState('');
  // pickedMajor = the value selected in the modal (could be 'Other' or a real major)
  const [pickedMajor, setPickedMajor] = useState('');
  // customMajor = free text typed when 'Other' is selected
  const [customMajor, setCustomMajor] = useState('');
  const [customMajorError, setCustomMajorError] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // The actual major value to send: custom text if "Other", else the picked preset
  const effectiveMajor = pickedMajor === 'Other' ? customMajor.trim() : pickedMajor;

  const handleMajorSelect = (value: string) => {
    setPickedMajor(value);
    setCustomMajorError('');
    setPickerVisible(false);
  };

  const validateCustomMajor = (value: string) => {
    const t = value.trim();
    if (!t) return 'Please specify your major';
    if (t.length < 2) return 'Major must be at least 2 characters';
    if (t.length > 60) return 'Major must be 60 characters or fewer';
    if (!CUSTOM_MAJOR_REGEX.test(t)) return 'Major can only contain letters and common punctuation';
    return '';
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }
    if (name.trim().length < 2) {
      Alert.alert('Error', 'Name must be at least 2 characters.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    if (!classYear) {
      Alert.alert('Error', 'Please select your class year.');
      return;
    }
    if (!pickedMajor) {
      Alert.alert('Error', 'Please select your major.');
      return;
    }
    if (pickedMajor === 'Other') {
      const err = validateCustomMajor(customMajor);
      if (err) {
        setCustomMajorError(err);
        return;
      }
    }
    setLoading(true);
    try {
      const { token, user } = await register(name.trim(), email.trim(), password, classYear, effectiveMajor);
      await signIn(token, user);
    } catch (err: unknown) {
      Alert.alert('Registration Failed', API_USER_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[...colors.gradientSubtle]}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.heroSection}>
            <View style={styles.logoCircle}>
              <Ionicons name="git-network-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.brand}>Bridge</Text>
            <Text style={styles.tagline}>Jump in and meet people</Text>
            <Text style={styles.osuHint}>Verify your OSU email to get started</Text>
          </View>

          <View style={[styles.card, shadows.lg]}>
            <Text style={styles.cardTitle}>Create account</Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
                autoCorrect={false}
              />
            </View>

            <Text style={styles.fieldLabel}>OSU Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="OSU Email (name.#@osu.edu)"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                autoCorrect={false}
              />
            </View>
            <Text style={styles.emailHelper}>
              Must be an @osu.edu or @buckeyemail.osu.edu address
            </Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Class Year</Text>
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

            <TouchableOpacity
              style={styles.inputWrapper}
              onPress={() => setPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="school-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
              <Text style={[styles.input, !pickedMajor && styles.inputPlaceholder]}>
                {pickedMajor || 'Major'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
            </TouchableOpacity>

            {pickedMajor === 'Other' && (
              <>
                <View style={[styles.inputWrapper, customMajorError ? styles.inputWrapperError : null]}>
                  <Ionicons name="create-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Specify your major"
                    placeholderTextColor={colors.textTertiary}
                    value={customMajor}
                    onChangeText={(v) => {
                      setCustomMajor(v);
                      if (customMajorError) setCustomMajorError(validateCustomMajor(v));
                    }}
                    maxLength={60}
                    autoCorrect={false}
                    autoFocus
                  />
                </View>
                {customMajorError ? <Text style={styles.errorText}>{customMajorError}</Text> : null}
              </>
            )}

            <MajorPickerModal
              visible={pickerVisible}
              selected={pickedMajor}
              onSelect={handleMajorSelect}
              onClose={() => setPickerVisible(false)}
            />

            <GradientButton
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
            />

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>
                Already have an account?{' '}
                <Text style={styles.linkBold}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  brand: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 4,
  },
  osuHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    letterSpacing: 0,
  },
  eyeButton: {
    padding: spacing.xs,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  linkText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  linkBold: {
    color: colors.primary,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  emailHelper: {
    fontSize: 12,
    color: '#999999',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
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
  inputWrapperError: {
    borderColor: colors.red,
  },
  inputPlaceholder: {
    color: colors.textTertiary,
  },
  errorText: {
    fontSize: 12,
    color: colors.red,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
});
