import React, { useState } from 'react';
import { Alert, Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { Chip, Entrance, Hero, Panel, PrimaryButton, Screen, SegmentedControl } from '../components/ui';
import { Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';
import { CLASS_YEAR_OPTIONS } from '../constants/classYears';
import { INTEREST_TAGS } from '../constants/interestTags';

type Mode = 'login' | 'register' | 'reset';

const PURPOSE_OPTIONS = ['Find friends', 'Try activities', 'Join clubs', 'Study plans'];
const CAMPUS_ZONE_OPTIONS = ['North campus', 'South campus', 'Oval', 'Libraries', 'RPAC'];
const MIN_PASSWORD_LENGTH = 8;
const SITE_URL = 'https://www.joinbridgeapp.com';

export default function AuthScreen() {
  const { signIn, acceptGuidelines } = useAuth();
  const styles = useStyles();
  const { gradients } = useTheme();
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

  const toggleListValue = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>, max = 5) => {
    setter((current) => (
      current.includes(value)
        ? current.filter((item) => item !== value)
        : current.length >= max
          ? current
          : [...current, value]
    ));
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
      Alert.alert('Finish this step', 'Choose your class year, add your major, and tell us what brings you to Bridge.');
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
      Alert.alert('Finish setup', 'Choose what you are here for, at least one interest, and a preferred campus zone.');
      return;
    }

    if (mode === 'register' && !ageConfirmed) {
      Alert.alert('Age confirmation required', 'Bridge is for users who are 18 or older.');
      return;
    }

    if (mode === 'register' && !termsAccepted) {
      Alert.alert('Terms required', 'Accept the Bridge terms and community guidelines before creating an account.');
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
        major.trim()
      );
      setToken(response.token);
      const setupBio = [
        `Here for: ${purpose}`,
        campusZones.length ? `Preferred zones: ${campusZones.join(', ')}` : null,
        clubInterests.trim() ? `Club interests: ${clubInterests.trim()}` : null,
      ].filter(Boolean).join('\n');
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
      Alert.alert(mode === 'login' ? 'Sign-in issue' : 'Could not create account', getApiErrorMessage(error, API_USER_MESSAGE));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <Entrance index={0}>
          <View style={styles.brandRow}>
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.brandMark}
            >
              <Text style={styles.brandMarkText}>B</Text>
            </LinearGradient>
            <Text style={styles.brandName}>Bridge</Text>
          </View>
        </Entrance>

        <Entrance index={1}>
        <Hero
          eyebrow="Welcome"
          title={
            mode === 'login'
              ? 'Turn campus into plans.'
              : mode === 'register'
                ? 'Build a profile people can trust.'
                : 'Get back into Bridge.'
          }
          subtitle={
            mode === 'login'
              ? 'Find something to do, join a small group, and go from scrolling to showing up.'
              : mode === 'register'
                ? 'A few useful details make your first pods, clubs, and connections feel more human.'
                : 'Use your school email to reset your password securely.'
          }
        >
          {mode === 'login' ? (
            <View style={styles.heroChips}>
              <Chip label="Plans today" active />
              <Chip label="Small groups" />
              <Chip label="Campus clubs" />
            </View>
          ) : null}
        </Hero>
        </Entrance>

        <Entrance index={2}>
        <Panel>
          <SegmentedControl
            value={mode}
            options={[
              { value: 'login', label: 'Sign in' },
              { value: 'register', label: 'Create account' },
              { value: 'reset', label: 'Reset' },
            ]}
            onChange={changeMode}
          />

          {mode === 'register' ? (
            <View style={styles.progress}>
              <View style={styles.progressCopy}>
                <Text style={styles.progressLabel}>Profile setup</Text>
                <Text style={styles.progressStep}>Step {registerStep} of 3</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${(registerStep / 3) * 100}%` }]} />
              </View>
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
                    <PrimaryButton label="Update password" onPress={submitResetPassword} loading={busy} />
                    <PrimaryButton label="Send a new code" onPress={sendResetCode} loading={busy} kind="ghost" />
                  </>
                ) : (
                  <PrimaryButton label="Send reset code" onPress={sendResetCode} loading={busy} />
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
	              <TouchableOpacity
                  onPress={forgotPassword}
                  style={styles.forgotButton}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot password"
                >
	                <Text style={styles.forgotText}>Forgot password?</Text>
	              </TouchableOpacity>
	            ) : null}
	            {mode === 'register' && registerStep === 2 ? (
	              <>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Class year</Text>
                  <View style={styles.chipWrap}>
                    {CLASS_YEAR_OPTIONS.map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        active={classYear === option}
                        onPress={() => setClassYear(option)}
                      />
                    ))}
                  </View>
	                </View>
	                <Field label="Major" value={major} onChangeText={setMajor} placeholder="Computer Science" />
	                <View style={styles.field}>
	                  <Text style={styles.fieldLabel}>What are you here for?</Text>
	                  <View style={styles.chipWrap}>
	                    {PURPOSE_OPTIONS.map((option) => (
	                      <Chip key={option} label={option} active={purpose === option} onPress={() => setPurpose(option)} />
	                    ))}
	                  </View>
	                </View>
                  </>
                ) : null}
                {mode === 'register' && registerStep === 3 ? (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Interests</Text>
                      <Text style={styles.fieldHelp}>Choose up to five so Bridge can make the first feed useful.</Text>
                      <View style={styles.chipWrap}>
                        {INTEREST_TAGS.slice(0, 10).map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            active={interestTags.includes(tag)}
                            onPress={() => toggleListValue(tag, setInterestTags)}
                          />
                        ))}
                      </View>
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Preferred campus zones</Text>
                      <Text style={styles.fieldHelp}>Pick up to three places you are usually willing to meet.</Text>
                      <View style={styles.chipWrap}>
                        {CAMPUS_ZONE_OPTIONS.map((zone) => (
                          <Chip
                            key={zone}
                            label={zone}
                            active={campusZones.includes(zone)}
                            onPress={() => toggleListValue(zone, setCampusZones, 3)}
                          />
                        ))}
                      </View>
                    </View>
                    <Field label="Club interests (optional)" value={clubInterests} onChangeText={setClubInterests} placeholder="Design, robotics, service..." />
                    <View style={styles.policyLinks}>
                      <PolicyLink label="Terms" url={`${SITE_URL}/terms`} />
                      <PolicyLink label="Privacy" url={`${SITE_URL}/privacy`} />
                      <PolicyLink label="Guidelines" url={`${SITE_URL}/community-guidelines`} />
                    </View>
		                <TouchableOpacity
                      style={styles.checkRow}
                      onPress={() => setAgeConfirmed((value) => !value)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: ageConfirmed }}
                      accessibilityLabel="I confirm I am 18 or older"
		                >
		                  <View style={[styles.checkbox, ageConfirmed && styles.checkboxActive]}>
		                    {ageConfirmed ? <Text style={styles.checkboxMark}>18</Text> : null}
		                  </View>
		                  <Text style={styles.checkText}>I confirm I am 18 or older.</Text>
		                </TouchableOpacity>
		                <TouchableOpacity
                      style={styles.checkRow}
                      onPress={() => setTermsAccepted((value) => !value)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: termsAccepted }}
                      accessibilityLabel="I accept the Terms, Privacy Policy, and Community Guidelines"
                    >
		                  <View style={[styles.checkbox, termsAccepted && styles.checkboxActive]}>
		                    {termsAccepted ? <Text style={styles.checkboxMark}>✓</Text> : null}
		                  </View>
		                  <Text style={styles.checkText}>I accept the current Terms, Privacy Policy, and Community Guidelines.</Text>
		                </TouchableOpacity>
		              </>
		            ) : null}
              </>
            )}
            {mode === 'login' ? (
              <PrimaryButton
                label="Enter Bridge"
                onPress={submit}
                loading={busy}
              />
            ) : null}
            {mode === 'register' ? (
              <View style={styles.registerActions}>
                {registerStep > 1 ? (
                  <View style={styles.registerAction}>
                    <PrimaryButton
                      label="Back"
                      onPress={() => setRegisterStep((step) => (step === 3 ? 2 : 1))}
                      kind="ghost"
                      disabled={busy}
                    />
                  </View>
                ) : null}
                <View style={styles.registerAction}>
                  <PrimaryButton
                    label={registerStep === 3 ? 'Build my profile' : 'Continue'}
                    onPress={registerStep === 3 ? submit : advanceRegistration}
                    loading={busy}
                  />
                </View>
              </View>
            ) : null}
          </View>
          <Text style={styles.footnote}>
            {mode === 'login'
              ? 'Returning users land straight in the live campus feed.'
              : mode === 'reset'
                ? 'Reset codes are sent to your OSU email and expire quickly.'
                : 'For students 18+. Bridge is independent and not affiliated with Ohio State.'}
          </Text>
        </Panel>
        </Entrance>
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  textContentType?: 'emailAddress' | 'givenName' | 'familyName' | 'password' | 'newPassword' | 'oneTimeCode';
  autoComplete?: 'email' | 'given-name' | 'family-name' | 'current-password' | 'new-password' | 'one-time-code';
  maxLength?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, focused && styles.inputFocused]}
        placeholderTextColor={colors.faint}
        accessibilityLabel={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

function PolicyLink({ label, url }: { label: string; url: string }) {
  const styles = useStyles();
  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={`Open ${label}`}
      onPress={() => void Linking.openURL(url)}
      style={styles.policyLink}
    >
      <Text style={styles.linkText}>{label}</Text>
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  brandRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingHorizontal: 2,
    marginTop: spacing.sm,
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...t.shadows.glow,
  },
  brandMarkText: {
    fontFamily: fonts.displayHeavy,
    fontSize: 24,
    color: '#FFFFFF',
  },
  brandName: {
    fontFamily: fonts.displayHeavy,
    fontSize: 26,
    letterSpacing: -0.8,
    color: t.colors.ink,
  },
  heroChips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginTop: spacing.sm,
    rowGap: spacing.xs,
  },
  form: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  progress: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  progressCopy: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  progressLabel: {
    ...t.typography.label,
    color: t.colors.primary,
  },
  progressStep: {
    ...t.typography.bodyStrong,
    fontSize: 13,
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden' as const,
    borderRadius: radii.pill,
    backgroundColor: t.colors.inputBg,
  },
  progressFill: {
    height: '100%' as const,
    borderRadius: radii.pill,
    backgroundColor: t.colors.primary,
  },
  checkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.surface,
  },
  checkboxActive: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  checkboxMark: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#FFFFFF',
    lineHeight: 16,
  },
  checkText: {
    ...t.typography.body,
    flex: 1,
  },
  linkText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: t.colors.primarySoftText,
  },
  policyLinks: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  policyLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: t.colors.primarySoft,
  },
  chipWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    rowGap: spacing.sm,
  },
  forgotButton: {
    alignSelf: 'flex-start' as const,
    paddingVertical: 2,
  },
  forgotText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: t.colors.primary,
  },
  field: {
    gap: spacing.xs,
  },
  fieldHelp: {
    ...t.typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  fieldLabel: {
    ...t.typography.label,
  },
  input: {
    borderRadius: radii.md,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: t.colors.ink,
  },
  inputFocused: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.surface,
  },
  footnote: {
    marginTop: spacing.md,
    ...t.typography.caption,
  },
  registerActions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  registerAction: {
    flex: 1,
  },
}));
