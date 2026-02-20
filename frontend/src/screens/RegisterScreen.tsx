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
import { register } from '../api';
import { useAuth } from '../context/AuthContext';
import GradientButton from '../components/GradientButton';
import { colors, spacing, radii, shadows } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await register(name.trim(), email.trim(), password);
      await signIn(token, user);
    } catch (err: unknown) {
      Alert.alert('Registration Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#eef2ff', '#e0e7ff', '#f5f3ff']}
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

            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                autoCorrect={false}
              />
            </View>

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
});
