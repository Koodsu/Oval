import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { getApiErrorMessage, resendVerification, verifyEmail } from '../api';
import { useAuth } from '../context/AuthContext';
import { Hero, Panel, PrimaryButton, Screen } from '../components/ui';
import { Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';

export default function VerifyEmailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user, updateUser } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const submit = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      Alert.alert('Verification code needed', 'Enter the 6-digit code from your school email.');
      return;
    }
    setBusy(true);
    try {
      const response = await verifyEmail(code.trim());
      await updateUser(response.user);
      Alert.alert('Verified', 'Your account is now cleared for the full Bridge experience.');
    } catch (error) {
      Alert.alert('Verification failed', getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    try {
      await resendVerification();
      setResendCooldown(30);
      Alert.alert('Email sent', `A fresh code was sent to ${user?.email ?? 'your inbox'}.`);
    } catch (error) {
      Alert.alert('Could not resend', getApiErrorMessage(error));
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen>
      <View style={styles.content}>
        <Hero
          eyebrow="Verify"
          title="One last step before the campus opens up."
          subtitle={`We sent a code to ${user?.email ?? 'your university email'} so pods, clubs, and chats stay tied to real students.`}
        />
        <Panel>
          <Text style={styles.label}>Verification code</Text>
          <TextInput
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            placeholderTextColor={colors.faint}
            style={styles.input}
            accessibilityLabel="Verification code"
            onSubmitEditing={() => void submit()}
          />
          <View style={styles.actions}>
            <PrimaryButton label="Verify account" onPress={submit} loading={busy} disabled={code.length !== 6} />
            <PrimaryButton
              label={resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend email'}
              onPress={resend}
              loading={resending}
              disabled={resendCooldown > 0}
              kind="ghost"
            />
          </View>
        </Panel>
      </View>
    </Screen>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  label: {
    ...t.typography.label,
    marginBottom: spacing.xs,
  },
  input: {
    borderRadius: radii.md,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...t.typography.bodyStrong,
    color: t.colors.ink,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
}));
