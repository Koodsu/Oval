import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import {
  AppBackdrop,
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

type Mode = 'login' | 'register' | 'reset';

const PURPOSE_OPTIONS = ['Find friends', 'Try activities', 'Join clubs', 'Study plans'];
const CAMPUS_ZONE_OPTIONS = ['North campus', 'South campus', 'Oval', 'Libraries', 'RPAC'];
const MIN_PASSWORD_LENGTH = 8;
const SITE_URL = 'https://www.joinbridgeapp.com';

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
  const [purpose, setPurpose] = useState('');
  const [campusZones, setCampusZones] = useState<string[]>([]);
  const [interestTags, setInterestTags] = useState<string[]>([]);
  const [clubInterests, setClubInterests] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

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
    if (nextMode === 'register') setRegisterStep(1);
  };

  const advanceRegistration = () => {
    if (registerStep === 1) {
      if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
        Alert.alert('Finish this step', 'Add your name, school email, and password to continue.');
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        Alert.alert('Password too short', `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      setRegisterStep(2);
      return;
    }

    if (!classYear || !major.trim() || !purpose) {
      Alert.alert(
        'Finish this step',
        'Choose your class year, add your major, and tell us what brings you to Bridge.',
      );
      return;
    }
    setRegisterStep(3);
  };

  const sendResetCode = async () => {
    if (!email.trim()) {
      Alert.alert('Email needed', 'Enter your OSU email and we will send a reset code.');
      return;
    }

    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setResetCodeSent(true);
      void trackEvent('auth.password_reset_requested');
      Alert.alert('Check your email', 'If that email is on Bridge, a reset code is on the way.');
    } catch (error) {
      Alert.alert('Reset issue', getApiErrorMessage(error, API_USER_MESSAGE));
    } finally {
      setBusy(false);
    }
  };

  const submitResetPassword = async () => {
    if (!email.trim() || !resetCode.trim() || !newPassword.trim()) {
      Alert.alert('Missing info', 'Enter your email, reset code, and new password.');
      return;
    }
    if (!/^\d{6}$/.test(resetCode.trim())) {
      Alert.alert('Check the code', 'Reset codes contain exactly 6 digits.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      Alert.alert('Password too short', `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    try {
      await resetPassword(email.trim(), resetCode.trim(), newPassword);
      void trackEvent('auth.password_reset_completed');
      setPassword(newPassword);
      setNewPassword('');
      setResetCode('');
      setMode('login');
      Alert.alert('Password updated', 'Sign in with your new password.');
    } catch (error) {
      Alert.alert('Reset issue', getApiErrorMessage(error, API_USER_MESSAGE));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (
      !email.trim() ||
      !password.trim() ||
      (mode === 'register' &&
        (!firstName.trim() || !lastName.trim() || !classYear.trim() || !major.trim()))
    ) {
      Alert.alert('Missing info', 'Fill out the required fields so we can get you into campus mode.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert('Password too short', `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (mode === 'register' && (!purpose || interestTags.length === 0 || campusZones.length === 0)) {
      Alert.alert(
        'Finish setup',
        'Choose what you are here for, at least one interest, and a preferred campus zone.',
      );
      return;
    }

    if (mode === 'register' && !ageConfirmed) {
      Alert.alert('Age confirmation required', 'Bridge is for users who are 18 or older.');
      return;
    }

    if (mode === 'register' && !termsAccepted) {
      Alert.alert(
        'Terms required',
        'Accept the Bridge terms and community guidelines before creating an account.',
      );
      return;
    }

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
      const setupBio = [
        `Here for: ${purpose}`,
        campusZones.length ? `Preferred zones: ${campusZones.join(', ')}` : null,
        clubInterests.trim() ? `Club interests: ${clubInterests.trim()}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      const updatedUser = await updateProfile({
        bio: setupBio,
        interestTags,
      });
      await signIn(response.token, updatedUser);
      await acceptGuidelines();
      void trackEvent('auth.register', {
        classYear: classYear.trim(),
        purpose,
        interestCount: interestTags.length,
      });
    } catch (error) {
      Alert.alert(
        mode === 'login' ? 'Sign-in issue' : 'Could not create account',
        getApiErrorMessage(error, API_USER_MESSAGE),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Wordmark — tilted scarlet slab, zine masthead energy */}
        <Animated.View entering={FadeInDown.duration(motion.durBase)}>
          <View style={styles.masthead}>
            <Slab
              color={colors.primary}
              tilt={-2}
              radius={radii.sm}
              faceStyle={styles.markFace}
              accessibilityRole="none"
            >
              <Text style={styles.markText}>BRIDGE</Text>
            </Slab>
            <Sticker label="Ohio State only" tint={colors.warningSoft} tilt={2} icon="school" />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(motion.stagger).duration(motion.durBase)}>
          <Text style={styles.heroTitle}>
            {mode === 'login'
              ? 'YOUR CAMPUS\nIS WAITING.'
              : mode === 'register'
                ? REGISTER_STEP_COPY[registerStep].title.toUpperCase()
                : 'LOCKED OUT?\nNO STRESS.'}
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
              {mode === 'reset' ? (
                <>
                  <Field
                    label="School email"
                    value={email}
                    onChangeText={setEmail}
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
                        onChangeText={(value) => setResetCode(value.replace(/\D/g, '').slice(0, 6))}
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
                        onChangeText={setNewPassword}
                        placeholder="At least 8 characters"
                        secureTextEntry
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
                            onChangeText={setFirstName}
                            placeholder="Avery"
                            autoCapitalize="words"
                            textContentType="givenName"
                            autoComplete="given-name"
                          />
                          <Field
                            label="Last name"
                            value={lastName}
                            onChangeText={setLastName}
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
                        onChangeText={setEmail}
                        placeholder="name@osu.edu"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        autoComplete="email"
                      />
                      <Field
                        label="Password"
                        value={password}
                        onChangeText={setPassword}
                        placeholder="At least 8 characters"
                        secureTextEntry
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
                      <Text style={[styles.forgotText, { color: colors.primary }]}>
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
                              onPress={() => setClassYear(option)}
                            />
                          ))}
                        </View>
                      </View>
                      <Field label="Major" value={major} onChangeText={setMajor} placeholder="Computer Science" />
                      <View style={styles.fieldBlock}>
                        <Text style={typography.kicker}>What are you here for?</Text>
                        <View style={styles.chipWrap}>
                          {PURPOSE_OPTIONS.map((option) => (
                            <Chip
                              key={option}
                              label={option}
                              selected={purpose === option}
                              tint={colors.amberSoft}
                              onPress={() => setPurpose(option)}
                            />
                          ))}
                        </View>
                      </View>
                    </>
                  ) : null}

                  {mode === 'register' && registerStep === 3 ? (
                    <>
                      <View style={styles.fieldBlock}>
                        <Text style={typography.kicker}>Interests — pick up to 5</Text>
                        <View style={styles.chipWrap}>
                          {INTEREST_TAGS.slice(0, 10).map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              selected={interestTags.includes(tag)}
                              tint={colors.pinkSoft}
                              onPress={() => toggleListValue(tag, setInterestTags)}
                            />
                          ))}
                        </View>
                      </View>
                      <View style={styles.fieldBlock}>
                        <Text style={typography.kicker}>Campus zones — pick up to 3</Text>
                        <View style={styles.chipWrap}>
                          {CAMPUS_ZONE_OPTIONS.map((zone) => (
                            <Chip
                              key={zone}
                              label={zone}
                              selected={campusZones.includes(zone)}
                              tint={colors.tealSoft}
                              onPress={() => toggleListValue(zone, setCampusZones, 3)}
                            />
                          ))}
                        </View>
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
                        onToggle={() => setAgeConfirmed((value) => !value)}
                        mark="18"
                        label="I confirm I am 18 or older."
                        accessibilityLabel="I confirm I am 18 or older"
                      />
                      <CheckRow
                        checked={termsAccepted}
                        onToggle={() => setTermsAccepted((value) => !value)}
                        mark="✓"
                        label="I accept the current Terms, Privacy Policy, and Community Guidelines."
                        accessibilityLabel="I accept the Terms, Privacy Policy, and Community Guidelines"
                      />
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
              : 'For students 18+. Bridge is independent and not affiliated with Ohio State.'}
        </Text>
      </ScrollView>
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
    transform: [{ rotate: '-3deg' }],
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
      <Text style={[policyStyles.text, { color: colors.primary }]}>{label}</Text>
      <Ionicons name="open-outline" size={12} color={colors.primary} />
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
    fontFamily: fonts.displayHeavy,
    fontSize: 18,
    letterSpacing: 1,
    color: t.colors.onPrimary,
  },
  heroTitle: {
    fontFamily: fonts.displayHeavy,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1,
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
}));
