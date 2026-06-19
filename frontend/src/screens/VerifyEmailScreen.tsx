import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiErrorMessage, resendVerification, verifyEmail } from '../api';
import { useAuth } from '../context/AuthContext';
import { AppBackdrop, Button, Card, Sticker } from '../components/ui';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  fonts,
  radii,
  spacing,
  useTheme,
} from '../theme';

export default function VerifyEmailScreen() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const submittedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const submit = useCallback(async () => {
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
  }, [code, updateUser]);

  useEffect(() => {
    if (code.length !== 6 || busy || submittedCodeRef.current === code) return;
    submittedCodeRef.current = code;
    void submit();
  }, [busy, code, submit]);

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
    <AppBackdrop>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <Sticker label="Almost in" tint={colors.greenSoft} tilt={-2} icon="mail-unread" />
        <Text style={styles.title}>Check your{'\n'}inbox.</Text>
        <Text style={[typography.body, styles.sub]}>
          We sent a 6-digit code to{' '}
          <Text style={{ fontFamily: fonts.bold }}>{user?.email ?? 'your university email'}</Text>{' '}
          — it keeps Bridge students-only.
        </Text>

        <Card padded>
          <Text style={[typography.kicker, { marginBottom: spacing.sm }]}>Verification code</Text>
          <TextInput
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            placeholderTextColor={colors.faint}
            style={styles.codeInput}
            accessibilityLabel="Verification code"
            onSubmitEditing={() => void submit()}
          />
          <View style={styles.actions}>
            <Button
              label="Verify account"
              onPress={submit}
              loading={busy}
              disabled={code.length !== 6}
              size="lg"
              icon="checkmark-circle"
            />
            <Button
              label={resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend email'}
              onPress={resend}
              loading={resending}
              disabled={resendCooldown > 0}
              variant="ghost"
            />
          </View>
        </Card>
      </View>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flex: 1,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 31,
    lineHeight: 37,
    letterSpacing: -0.7,
    color: t.colors.ink,
  },
  sub: {
    color: t.colors.sub,
    maxWidth: 320,
  },
  codeInput: {
    borderWidth: BORDER_W,
    borderColor: t.colors.border,
    borderRadius: radii.sm,
    backgroundColor: t.colors.surfaceAlt,
    paddingVertical: 16,
    textAlign: 'center' as const,
    fontFamily: fonts.displayMedium,
    fontSize: 26,
    letterSpacing: 10,
    color: t.colors.ink,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
}));
