import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiErrorMessage, resendVerification, verifyEmail } from '../api';
import { useAuth } from '../context/AuthContext';
import { AppBackdrop, Button, SpotIllustration } from '../components/ui';
import { OnboardingTopBar, OvalWordmark } from '../components/OnboardingChrome';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  fonts,
  radii,
  spacing,
  useTheme,
} from '../theme';

import { toast } from '../lib/toast';
const verificationSpot = require('../../assets/illustrations/spot/onboarding/03-verification.png');

export default function VerifyEmailScreen() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, updateUser, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const submittedCodeRef = useRef<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const submit = useCallback(async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      toast.error('Verification code needed', 'Enter the 6-digit code from your school email.');
      return;
    }
    setBusy(true);
    try {
      const response = await verifyEmail(code.trim());
      await updateUser(response.user);
      toast.success('Verified', 'Your account is now cleared for the full Oval experience.');
    } catch (error) {
      toast.error('Verification failed', getApiErrorMessage(error));
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
      toast.success('Email sent', `A fresh code was sent to ${user?.email ?? 'your inbox'}.`);
    } catch (error) {
      toast.error('Could not resend', getApiErrorMessage(error));
    } finally {
      setResending(false);
    }
  };

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingTopBar label="Email verification" onBack={() => void signOut()} />
        <OvalWordmark compact />

        <View style={[styles.heroArt, { backgroundColor: colors.surfaceAlt }]}>
          <SpotIllustration
            source={verificationSpot}
            accessibilityLabel="Two students celebrating a verified email"
            height={178}
            style={styles.heroImage}
          />
        </View>

        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>Verify your email</Text>
          <Text style={[typography.body, styles.sub]}>
            We sent a 6-digit code to{'\n'}
            <Text style={{ fontFamily: fonts.bold }}>{user?.email ?? 'your university email'}</Text>
          </Text>
        </View>

        <View style={styles.codeBlock}>
          <Text style={[typography.kicker, styles.codeLabel]}>Verification code</Text>
          <Pressable
            onPress={() => inputRef.current?.focus()}
            accessibilityRole="button"
            accessibilityLabel={`Verification code, ${code.length} of 6 digits entered`}
            style={styles.codeRow}
          >
            {Array.from({ length: 6 }, (_, index) => {
              const digit = code[index] ?? '';
              const active = code.length === index || (code.length === 6 && index === 5);
              return (
                <View
                  key={index}
                  style={[
                    styles.codeCell,
                    {
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.codeDigit, { color: colors.ink }]}>{digit}</Text>
                </View>
              );
            })}
          </Pressable>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(value) => {
              const nextCode = value.replace(/\D/g, '').slice(0, 6);
              if (nextCode !== code) submittedCodeRef.current = null;
              setCode(nextCode);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            style={styles.hiddenInput}
            accessibilityLabel="Verification code"
            onSubmitEditing={() => void submit()}
            autoFocus
          />
        </View>

        <View style={styles.actions}>
          <Button
            label="Verify account"
            onPress={submit}
            loading={busy}
            disabled={code.length !== 6}
            size="lg"
          />
          <Button
            label={
              resendCooldown > 0
                ? `Send a new code in ${resendCooldown}s`
                : 'Send a new code'
            }
            onPress={resend}
            loading={resending}
            disabled={resendCooldown > 0}
            variant="ghost"
          />
          <Button
            label="Use a different email"
            onPress={() => void signOut()}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center' as const,
  },
  heroArt: {
    borderRadius: radii.lg,
    overflow: 'hidden' as const,
    minHeight: 168,
    justifyContent: 'flex-end' as const,
  },
  heroImage: {
    width: '106%',
    marginLeft: '-3%',
    marginBottom: -8,
  },
  copy: {
    alignItems: 'center' as const,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.7,
    color: t.colors.ink,
    textAlign: 'center' as const,
  },
  sub: {
    color: t.colors.sub,
    textAlign: 'center' as const,
    marginTop: spacing.sm,
  },
  codeBlock: {
    gap: spacing.sm,
  },
  codeLabel: {
    textAlign: 'center' as const,
  },
  codeRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    justifyContent: 'center' as const,
  },
  codeCell: {
    flex: 1,
    maxWidth: 54,
    minWidth: 42,
    height: 60,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  codeDigit: {
    fontFamily: fonts.displayMedium,
    fontSize: 26,
  },
  hiddenInput: {
    position: 'absolute' as const,
    width: 1,
    height: 1,
    opacity: 0,
  },
  actions: {
    gap: spacing.sm,
  },
}));
