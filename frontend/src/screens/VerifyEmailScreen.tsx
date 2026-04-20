import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { verifyEmail, resendVerification, API_USER_MESSAGE } from '../api';
import GradientButton from '../components/GradientButton';
import { colors, spacing, radii, typography, shadows } from '../theme';

const RESEND_COOLDOWN_S = 60;

export default function VerifyEmailScreen() {
  const { user, updateUser, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCooldown() {
    if (timerRef.current) clearInterval(timerRef.current);
    setCooldown(RESEND_COOLDOWN_S);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const handleSubmit = async () => {
    const trimmed = code.trim();
    if (trimmed.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { user: updated } = await verifyEmail(trimmed);
      await updateUser(updated);
      // Navigation updates automatically because App.tsx watches user.verifiedUniversity
    } catch {
      setError(API_USER_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    setError(null);
    try {
      await resendVerification();
      startCooldown();
      Alert.alert('Code sent', `A new verification code was sent to ${user?.email}.`);
    } catch {
      setError(API_USER_MESSAGE);
    } finally {
      setResending(false);
    }
  };

  const handleChangeCode = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (error) setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconWrapper}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-outline" size={40} color={colors.primary} />
          </View>
        </View>

        <Text style={styles.title}>Verify your OSU email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.email}>{user?.email}</Text>
        </Text>

        <View style={[styles.inputCard, shadows.sm]}>
          <TextInput
            ref={inputRef}
            style={styles.codeInput}
            value={code}
            onChangeText={handleChangeCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            autoFocus
            testID="code-input"
          />
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <GradientButton
          title={loading ? 'Verifying…' : 'Verify Email'}
          onPress={handleSubmit}
          disabled={loading || code.trim().length !== 6}
          icon="checkmark-outline"
        />

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={resending || cooldown > 0}
          activeOpacity={0.7}
        >
          {resending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.resendText, cooldown > 0 && styles.resendDisabled]}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get it? Resend code"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={signOut} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl + spacing.xl,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
  },
  iconWrapper: {
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl + spacing.sm,
    lineHeight: 22,
  },
  email: {
    ...typography.bodyBold,
    color: colors.text,
  },
  inputCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  codeInput: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 12,
    color: colors.text,
    textAlign: 'center',
    width: '80%',
    paddingVertical: spacing.sm,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  errorText: {
    ...typography.caption,
    color: colors.red,
  },
  resendButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendText: {
    ...typography.body,
    color: colors.primary,
  },
  resendDisabled: {
    color: colors.textTertiary,
  },
  signOutButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  signOutText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
