import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  login,
  register,
  requestPasswordReset,
  resetPassword,
  API_USER_MESSAGE,
  getApiErrorMessage,
  setToken,
  trackEvent,
  updateProfile,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { getStoredReferral } from '../lib/referrals';
import {
  AppBackdrop,
  Banner,
  Button,
  Card,
  Chip,
  Field,
  ProgressBar,
  Slab,
  Sticker,
} from '../components/ui';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  fonts,
  motion,
  radii,
  spacing,
  useTheme,
} from '../theme';
import { CLASS_YEAR_OPTIONS } from '../constants/classYears';
import { INTEREST_TAGS } from '../constants/interestTags';
import { PURPOSE_OPTIONS } from '../constants/profileOptions';

import { toast } from '../lib/toast';
type Mode = 'login' | 'register' | 'reset';

const MIN_PASSWORD_LENGTH = 8;
const SITE_URL = 'https://www.theovalapp.com';

const REGISTER_STEP_COPY: Record<1 | 2 | 3, { kicker: string; title: string }> = {
  1: { kicker: 'Step 1 — The basics', title: 'Who are you?' },
  2: { kicker: 'Step 2 — Your campus', title: 'Where are you at?' },
  3: { kicker: 'Step 3 — Your thing', title: 'What do you like?' },
};

export default function AuthScreen() {
  const { signIn, acceptGuidelines } = useAuth();
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('login');
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [classYear, setClassYear] = useState('');
  const [major, setMajor] = useState('');
  const [purpose, setPurpose] = useState<string[]>([]);
  const [interestTags, setInterestTags] = useState<string[]>([]);
  const [clubInterests, setClubInterests] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (key: string) => {
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const toggleListValue = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    max = 5,
  ) => {
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : current.length >= max
          ? current
          : [...current, value],
    );
  };

  const forgotPassword = () => {
    setMode('reset');
    setResetCodeSent(false);
    setResetCode('');
    setNewPassword('');
  };

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setErrors({});
    if (nextMode === 'register') setRegisterStep(1);
  };

  const advanceRegistration = () => {
    if (registerStep === 1) {
      const nextErrors: Record<string, string> = {};
      if (!firstName.trim()) nextErrors.firstName = 'Enter your first name.';
      if (!lastName.trim()) nextErrors.lastName = 'Enter your last name.';
      if (!email.trim()) nextErrors.email = 'Enter your school email.';
      if (!password) nextErrors.password = 'Enter a password.';
      else if (password.length < MIN_PASSWORD_LENGTH) {
        nextErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
      }
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        return;
      }
      setErrors({});
      setRegisterStep(2);
      return;
    }

    const nextErrors: Record<string, string> = {};
    if (!classYear) nextErrors.classYear = 'Choose your class year.';
    if (!major.trim()) nextErrors.major = 'Enter your major.';
    if (!purpose.length) nextErrors.purpose = 'Choose what brings you to Oval.';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setRegisterStep(3);
  };

  const sendResetCode = async () => {
    if (!email.trim()) {
      setErrors({ email: 'Enter your OSU email to receive a reset code.' });
      return;
    }

    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setResetCodeSent(true);
      void trackEvent('auth.password_reset_requested');
      toast.success('Check your email', 'If that email is on Oval, a reset code is on the way.');
    } catch (error) {
      setErrors({ form: getApiErrorMessage(error, API_USER_MESSAGE) });
    } finally {
      setBusy(false);
    }
  };

  const submitResetPassword = async () => {
    const nextErrors: Record<string, string> = {};
    if (!email.trim()) nextErrors.email = 'Enter your school email.';
    if (!resetCode.trim()) nextErrors.resetCode = 'Enter the reset code.';
    if (!/^\d{6}$/.test(resetCode.trim())) {
      nextErrors.resetCode = 'Reset codes contain exactly 6 digits.';
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      nextErrors.newPassword = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    setBusy(true);
    try {
      await resetPassword(email.trim(), resetCode.trim(), newPassword);
      void trackEvent('auth.password_reset_completed');
      setPassword(newPassword);
      setNewPassword('');
      setResetCode('');
      setMode('login');
      toast.success('Password updated', 'Sign in with your new password.');
    } catch (error) {
      setErrors({ form: getApiErrorMessage(error, API_USER_MESSAGE) });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const nextErrors: Record<string, string> = {};
    if (!email.trim()) nextErrors.email = 'Enter your school email.';
    if (!password.trim()) nextErrors.password = 'Enter your password.';
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (mode === 'register') {
      if (!firstName.trim()) nextErrors.firstName = 'Enter your first name.';
      if (!lastName.trim()) nextErrors.lastName = 'Enter your last name.';
      if (!classYear.trim()) nextErrors.classYear = 'Choose your class year.';
      if (!major.trim()) nextErrors.major = 'Enter your major.';
      if (!purpose.length) nextErrors.purpose = 'Choose what brings you to Oval.';
      if (!interestTags.length) nextErrors.interestTags = 'Choose at least one interest.';
      if (!ageConfirmed) nextErrors.ageConfirmed = 'Confirm that you are 18 or older.';
      if (!termsAccepted) nextErrors.termsAccepted = 'Accept the terms to create an account.';
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    setBusy(true);
    try {
      if (mode === 'login') {
        const response = await login(email.trim(), password);
        await signIn(response.token, response.user);
        void trackEvent('auth.login');
        return;
      }

      const response = await register(
        firstName.trim(),
        lastName.trim(),
        email.trim(),
        password,
        classYear.trim(),
        major.trim(),
      );
      setToken(response.token);

      // The account now exists. Anything that fails past this point must NOT
      // surface as "could not create account" — sign the user in regardless
      // and let them finish profile setup later.
      let finalUser = response.user;
      let profileSaved = true;
      try {
        finalUser = await updateProfile({
          purpose: purpose.join(', '),
          clubInterests: clubInterests.trim() || null,
          interestTags,
        });
      } catch {
        profileSaved = false;
      }
      await signIn(response.token, finalUser);
      try {
        await acceptGuidelines();
      } catch {
        // Terms were already recorded server-side during /auth/register;
        // local flag sync can retry later without blocking onboarding.
      }
      if (!profileSaved) {
        toast.info(
          'Account created',
          'We could not save your interests right now — you can add them any time from Edit Profile.',
        );
      }
      const referredBy = await getStoredReferral();
      void trackEvent('auth.register', {
        classYear: classYear.trim(),
        purpose: purpose.join(', '),
        interestCount: interestTags.length,
        referredBy: referredBy ?? undefined,
      });
    } catch (error) {
      setErrors({ form: getApiErrorMessage(error, API_USER_MESSAGE) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppBackdrop>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        {/* Wordmark — scarlet glass tile */}
        <Animated.View entering={FadeInDown.duration(motion.durBase)}>
          <View style={styles.masthead}>
            <Slab
              color={colors.accentText}
              radius={radii.md}
              faceStyle={styles.markFace}
              accessibilityRole="none"
            >
              <Text style={styles.markText}>Oval</Text>
            </Slab>
            <Sticker label="Ohio State only" tint={colors.warningSoft} icon="school" />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(motion.stagger).duration(motion.durBase)}>
          <Text style={styles.heroTitle}>
            {mode === 'login'
              ? 'Your campus\nis waiting.'
              : mode === 'register'
                ? REGISTER_STEP_COPY[registerStep].title
                : 'Locked out?\nNo stress.'}
          </Text>
          <Text style={[typography.body, styles.heroSub]}>
            {mode === 'login'
              ? 'Small groups. Real plans. Less scrolling, more showing up.'
              : mode === 'register'
                ? 'A couple of details and your first pods will actually fit you.'
                : 'We will send a 6-digit code to your OSU email.'}
          </Text>
        </Animated.View>

        {/* Mode switch */}
        <Animated.View
          entering={FadeInDown.delay(motion.stagger * 2).duration(motion.durBase)}
          style={styles.modeRow}
        >
          <Chip label="Sign in" selected={mode === 'login'} onPress={() => changeMode('login')} />
          <Chip label="New here" selected={mode === 'register'} onPress={() => changeMode('register')} />
          <Chip label="Reset" selected={mode === 'reset'} onPress={() => changeMode('reset')} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(motion.stagger * 3).duration(motion.durBase)}>
          <Card padded>
            {mode === 'register' ? (
              <View style={styles.progressBlock}>
                <Text style={typography.kicker}>{REGISTER_STEP_COPY[registerStep].kicker}</Text>
                <ProgressBar value={registerStep / 3} style={{ marginTop: 8 }} />
              </View>
            ) : null}

            <View style={styles.form}>
              {errors.form ? <Banner message={errors.form} kind="error" /> : null}
              {mode === 'reset' ? (
                <>
                  <Field
                    label="School email"
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      clearError('email');
                    }}
                    error={errors.email}
                    placeholder="name@osu.edu"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
                  />
                  {resetCodeSent ? (
                    <>
                      <Field
                        label="Reset code"
                        value={resetCode}
                        onChangeText={(value) => {
                          setResetCode(value.replace(/\D/g, '').slice(0, 6));
                          clearError('resetCode');
                        }}
                        error={errors.resetCode}
                        placeholder="123456"
                        autoCapitalize="none"
                        keyboardType="number-pad"
                        textContentType="oneTimeCode"
                        autoComplete="one-time-code"
                        maxLength={6}
                      />
                      <Field
                        label="New password"
                        value={newPassword}
                        onChangeText={(value) => {
                          setNewPassword(value);
                          clearError('newPassword');
                        }}
                        error={errors.newPassword}
                        placeholder="At least 8 characters"
                        secureTextEntry
                        secureToggle
                        textContentType="newPassword"
                        autoComplete="new-password"
                      />
                      <Button label="Update password" onPress={submitResetPassword} loading={busy} size="lg" />
                      <Button label="Send a new code" onPress={sendResetCode} loading={busy} variant="ghost" />
                    </>
                  ) : (
                    <Button label="Send reset code" onPress={sendResetCode} loading={busy} size="lg" />
                  )}
                </>
              ) : (
                <>
                  {mode === 'login' || registerStep === 1 ? (
                    <>
                      {mode === 'register' ? (
                        <>
                          <Field
                            label="First name"
                            value={firstName}
                            onChangeText={(value) => {
                              setFirstName(value);
                              clearError('firstName');
                            }}
                            error={errors.firstName}
                            placeholder="Avery"
                            autoCapitalize="words"
                            textContentType="givenName"
                            autoComplete="given-name"
                          />
                          <Field
                            label="Last name"
                            value={lastName}
                            onChangeText={(value) => {
                              setLastName(value);
                              clearError('lastName');
                            }}
                            error={errors.lastName}
                            placeholder="Chen"
                            autoCapitalize="words"
                            textContentType="familyName"
                            autoComplete="family-name"
                          />
                        </>
                      ) : null}
                      <Field
                        label="School email"
                        value={email}
                        onChangeText={(value) => {
                          setEmail(value);
                          clearError('email');
                        }}
                        error={errors.email}
                        placeholder="name@osu.edu"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        autoComplete="email"
                      />
                      <Field
                        label="Password"
                        value={password}
                        onChangeText={(value) => {
                          setPassword(value);
                          clearError('password');
                        }}
                        error={errors.password}
                        placeholder="At least 8 characters"
                        secureTextEntry
                        secureToggle
                        textContentType={mode === 'register' ? 'newPassword' : 'password'}
                        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      />
                    </>
                  ) : null}

                  {mode === 'login' ? (
                    <Pressable
                      onPress={forgotPassword}
                      style={({ pressed }) => [styles.forgot, pressed && { opacity: 0.5 }]}
                      accessibilityRole="button"
                      accessibilityLabel="Forgot password"
                    >
                      <Text style={[styles.forgotText, { color: colors.accentText }]}>
                        Forgot password? →
                      </Text>
                    </Pressable>
                  ) : null}

                  {mode === 'register' && registerStep === 2 ? (
                    <>
                      <View style={styles.fieldBlock}>
                        <Text style={typography.kicker}>Class year</Text>
                        <View style={styles.chipWrap}>
                          {CLASS_YEAR_OPTIONS.map((option) => (
                            <Chip
                              key={option}
                              label={option}
                              selected={classYear === option}
                              onPress={() => {
                                setClassYear(option);
                                clearError('classYear');
                              }}
                            />
                          ))}
                        </View>
                        {errors.classYear ? (
                          <Text style={[styles.inlineError, { color: colors.danger }]}>
                            {errors.classYear}
                          </Text>
                        ) : null}
                      </View>
                      <Field
                        label="Major"
                        value={major}
                        onChangeText={(value) => {
                          setMajor(value);
                          clearError('major');
                        }}
                        error={errors.major}
                        placeholder="Computer Science"
                      />
                      <View style={styles.fieldBlock}>
                        <Text style={typography.kicker}>What are you here for? (pick any)</Text>
                        <View style={styles.chipWrap}>
                          {PURPOSE_OPTIONS.map((option) => (
                            <Chip
                              key={option}
                              label={option}
                              selected={purpose.includes(option)}
                              tint={colors.amberSoft}
                              onPress={() => {
                                toggleListValue(option, setPurpose);
                                clearError('purpose');
                              }}
                            />
                          ))}
                        </View>
                        {errors.purpose ? (
                          <Text style={[styles.inlineError, { color: colors.danger }]}>
                            {errors.purpose}
                          </Text>
                        ) : null}
                      </View>
                    </>
                  ) : null}

                  {mode === 'register' && registerStep === 3 ? (
                    <>
                      <View style={styles.fieldBlock}>
                        <Text style={typography.kicker}>Interests — pick up to 5</Text>
                        <View style={styles.chipWrap}>
                          {INTEREST_TAGS.map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              selected={interestTags.includes(tag)}
                              tint={colors.pinkSoft}
                              onPress={() => {
                                toggleListValue(tag, setInterestTags);
                                clearError('interestTags');
                              }}
                            />
                          ))}
                        </View>
                        {errors.interestTags ? (
                          <Text style={[styles.inlineError, { color: colors.danger }]}>
                            {errors.interestTags}
                          </Text>
                        ) : null}
                      </View>
                      <Field
                        label="Club interests (optional)"
                        value={clubInterests}
                        onChangeText={setClubInterests}
                        placeholder="Design, robotics, service…"
                      />
                      <View style={styles.policyRow}>
                        <PolicyLink label="Terms" url={`${SITE_URL}/terms`} />
                        <PolicyLink label="Privacy" url={`${SITE_URL}/privacy`} />
                        <PolicyLink label="Guidelines" url={`${SITE_URL}/community-guidelines`} />
                      </View>
                      <CheckRow
                        checked={ageConfirmed}
                        onToggle={() => {
                          setAgeConfirmed((value) => !value);
                          clearError('ageConfirmed');
                        }}
                        mark="18"
                        label="I confirm I am 18 or older."
                        accessibilityLabel="I confirm I am 18 or older"
                      />
                      <CheckRow
                        checked={termsAccepted}
                        onToggle={() => {
                          setTermsAccepted((value) => !value);
                          clearError('termsAccepted');
                        }}
                        mark="✓"
                        label="I accept the current Terms, Privacy Policy, and Community Guidelines."
                        accessibilityLabel="I accept the Terms, Privacy Policy, and Community Guidelines"
                      />
                      {errors.ageConfirmed || errors.termsAccepted ? (
                        <Text style={[styles.inlineError, { color: colors.danger }]}>
                          {errors.ageConfirmed ?? errors.termsAccepted}
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                </>
              )}

              {mode === 'login' ? (
                <Button label="Let's go" onPress={submit} loading={busy} size="lg" icon="flash" />
              ) : null}
              {mode === 'register' ? (
                <View style={styles.registerActions}>
                  {registerStep > 1 ? (
                    <Button
                      label="Back"
                      onPress={() => setRegisterStep((step) => (step === 3 ? 2 : 1))}
                      variant="ghost"
                      disabled={busy}
                    />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Button
                      label={registerStep === 3 ? 'Build my profile' : 'Continue'}
                      onPress={registerStep === 3 ? submit : advanceRegistration}
                      loading={busy}
                      size="lg"
                    />
                  </View>
                </View>
              ) : null}
            </View>
          </Card>
        </Animated.View>

        <Text style={[typography.captionSmall, styles.footnote]}>
          {mode === 'login'
            ? 'Returning users land straight in the live campus feed.'
            : mode === 'reset'
              ? 'Reset codes are sent to your OSU email and expire quickly.'
              : 'For students 18+. Oval is independent and not affiliated with Ohio State.'}
        </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackdrop>
  );
}

function CheckRow({
  checked,
  onToggle,
  mark,
  label,
  accessibilityLabel,
}: {
  checked: boolean;
  onToggle: () => void;
  mark: string;
  label: string;
  accessibilityLabel: string;
}) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [checkStyles.row, pressed && { opacity: 0.7 }]}
    >
      <View
        style={[
          checkStyles.box,
          {
            borderColor: colors.border,
            backgroundColor: checked ? colors.primary : colors.surface,
          },
        ]}
      >
        {checked ? <Text style={[checkStyles.mark, { color: colors.onPrimary }]}>{mark}</Text> : null}
      </View>
      <Text style={[typography.body, { flex: 1, fontSize: 13.5, lineHeight: 19 }]}>{label}</Text>
    </Pressable>
  );
}

const checkStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: radii.xs,
    borderWidth: BORDER_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
});

function PolicyLink({ label, url }: { label: string; url: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${label}`}
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => [policyStyles.link, pressed && { opacity: 0.5 }]}
    >
      <Text style={[policyStyles.text, { color: colors.accentText }]}>{label}</Text>
      <Ionicons name="open-outline" size={12} color={colors.accentText} />
    </Pressable>
  );
}

const policyStyles = StyleSheet.create({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  masthead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  markFace: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  markText: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: -0.2,
    color: t.colors.onPrimary,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 31,
    lineHeight: 37,
    letterSpacing: -0.7,
    color: t.colors.ink,
    marginTop: spacing.sm,
  },
  heroSub: {
    marginTop: spacing.sm,
    color: t.colors.sub,
    maxWidth: 300,
  },
  modeRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  progressBlock: {
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },
  fieldBlock: {
    gap: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  forgot: {
    alignSelf: 'flex-start' as const,
  },
  forgotText: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },
  policyRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.lg,
  },
  registerActions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    alignItems: 'center' as const,
  },
  footnote: {
    textAlign: 'center' as const,
    paddingHorizontal: spacing.xl,
  },
  inlineError: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
  },
}));
