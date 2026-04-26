import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { resendVerification, verifyEmail } from '../api';
import { useAuth } from '../context/AuthContext';
import { Hero, Panel, PrimaryButton, Screen } from '../components/ui';
import { palette, radii, spacing, typography } from '../theme';

export default function VerifyEmailScreen() {
  const { user, updateUser } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async () => {
    if (!code.trim()) {
      Alert.alert('Verification code needed', 'Enter the code from your school email.');
      return;
    }
    setBusy(true);
    try {
      const response = await verifyEmail(code.trim());
      await updateUser(response.user);
      Alert.alert('Verified', 'Your account is now cleared for the full Bridge experience.');
    } catch (error) {
      Alert.alert('Verification failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await resendVerification();
      Alert.alert('Email sent', `A fresh code was sent to ${user?.email ?? 'your inbox'}.`);
    } catch (error) {
      Alert.alert('Could not resend', error instanceof Error ? error.message : 'Please try again.');
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
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
            placeholderTextColor={palette.slate}
            style={styles.input}
          />
          <View style={styles.actions}>
            <PrimaryButton label="Verify account" onPress={submit} loading={busy} />
            <PrimaryButton label="Resend email" onPress={resend} loading={resending} kind="ghost" />
          </View>
        </Panel>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  input: {
    borderRadius: radii.md,
    backgroundColor: palette.cream,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...typography.bodyStrong,
    color: palette.ink,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});
