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
  SpotIllustration,
} from '../components/ui';
import { OnboardingTopBar, OvalWordmark } from '../components/OnboardingChrome';
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
const welcomeSpot = require('../../assets/illustrations/spot/onboarding/01-welcome.png');

const REGISTER_STEP_COPY: Record<1 | 2 | 3, { title: string; sub: string }> = {
  1: { title: 'Create your account', sub: "Let's get to know you." },
  2: { title: 'Tell us about campus', sub: 'This helps Oval show you the right people and plans.' },
  3: { title: 'Make it yours', sub: 'Choose a few interests to personalize your experience.' },
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
          {mode === 'register' ? (
            <OnboardingTopBar
              current={registerStep}
              total={3}
              onBack={() => {
                if (registerStep === 1) changeMode('login');
                else setRegisterStep((step) => (step === 3 ? 2 : 1));
              }}
            />
          ) : mode === 'reset' ? (
            <OnboardingTopBar label="Password reset" onBack={() => changeMode('login')} />
          ) : null}

          <Animated.View entering={FadeInDown.duration(motion.durBase)} style={styles.wordmarkRow}>
            <OvalWordmark compact={mode !== 'login'} />
            <View style={[styles.campusBadge, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="school-outline" size={14} color={colors.sub} />
              <Text style={[styles.campusBadgeText, { color: colors.sub }]}>Ohio State only</Text>
            </View>
          </Animated.View>

          {mode === 'login' ? (
            <Animated.View entering={FadeInDown.delay(motion.stagger).duration(motion.durBase)}>
              <View style={[styles.welcomeArt, { backgroundColor: colors.surfaceAlt }]}>
                <SpotIllustration
                  source={welcomeSpot}
                  accessibilityLabel="Ohio State students meeting through Oval"
                  height={182}
                  style={styles.welcomeImage}
                />
              </View>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(motion.stagger).duration(motion.durBase)}>
            <Text style={styles.heroTitle}>
              {mode === 'login'
                ? 'Your campus\nis waiting.'
                : mode === 'register'
                  ? REGISTER_STEP_COPY[registerStep].title
                  : 'Reset your password'}
            </Text>
            <Text style={[typography.body, styles.heroSub]}>
              {mode === 'login'
                ? 'Find your people, join small groups, and make real plans at Ohio State.'
                : mode === 'register'
                  ? REGISTER_STEP_COPY[registerStep].sub
                  : 'We will send a secure 6-digit code to your OSU email.'}
            </Text>
          </Animated.View>

          {mode === 'login' ? (
            <Animated.View
              entering={FadeInDown.delay(motion.stagger * 2).duration(motion.durBase)}
            >
              <AuthModeSwitch mode={mode} onChange={changeMode} />
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(motion.stagger * 3).duration(motion.durBase)}>
            <Card padded faceStyle={styles.formCard}>
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
                <Button label="Sign in with email" onPress={submit} loading={busy} size="lg" />
              ) : null}
              {mode === 'register' ? (
                <Button
                  label={registerStep === 3 ? 'Create my account' : 'Continue'}
                  onPress={registerStep === 3 ? submit : advanceRegistration}
                  loading={busy}
                  size="lg"
                />
              ) : null}
            </View>
            </Card>
          </Animated.View>

          {mode === 'login' ? (
            <View style={[styles.trustRow, { borderColor: colors.border }]}>
              <Ionicons name="shield-checkmark-outline" size={21} color={colors.accentText} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.subheading, styles.trustTitle]}>Built for OSU students</Text>
                <Text style={typography.captionSmall}>Private, campus-verified, and 18+.</Text>
              </View>
            </View>
          ) : (
            <Text style={[typography.captionSmall, styles.footnote]}>
              {mode === 'reset'
                ? 'Reset codes expire quickly and are only sent to your school email.'
                : 'For students 18+. Oval is independent and not affiliated with Ohio State.'}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackdrop>
  );
}

function AuthModeSwitch({
  mode,
  onChange,
}: {
  mode: Exclude<Mode, 'reset'>;
  onChange: (mode: Mode) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[modeStyles.track, { backgroundColor: colors.surfaceAlt }]}>
      {(
        [
          ['login', 'Sign in'],
          ['register', 'New here'],
        ] as const
      ).map(([value, label]) => {
        const selected = mode === value;
        return (
          <Pressable
            key={value}
            onPress={() => onChange(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              modeStyles.option,
              selected && {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              pressed && { opacity: 0.65 },
            ]}
          >
            <Text
              style={[
                modeStyles.label,
                { color: selected ? colors.accentText : colors.sub },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const modeStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radii.sm,
    padding: 4,
  },
  option: {
    flex: 1,
    height: 42,
    borderRadius: radii.xs,
    borderWidth: BORDER_W,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 14,
  },
});

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
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center' as const,
  },
  wordmarkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  campusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radii.pill,
  },
  campusBadgeText: {
    fontFamily: fonts.bold,
    fontWeight: '600',
    fontSize: 12,
  },
  welcomeArt: {
    borderRadius: radii.lg,
    overflow: 'hidden' as const,
    minHeight: 174,
    justifyContent: 'flex-end' as const,
  },
  welcomeImage: {
    width: '112%',
    marginLeft: '-6%',
    marginBottom: -6,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -0.8,
    color: t.colors.ink,
  },
  heroSub: {
    marginTop: spacing.sm,
    color: t.colors.sub,
    maxWidth: 360,
  },
  formCard: {
    padding: spacing.lg,
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
  trustRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    borderTopWidth: BORDER_W,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  trustTitle: {
    marginBottom: 2,
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
