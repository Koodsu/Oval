import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { login, register, API_USER_MESSAGE, getApiErrorMessage, setToken, updateProfile } from '../api';
import { useAuth } from '../context/AuthContext';
import { Chip, Hero, Panel, PrimaryButton, Screen, SegmentedControl } from '../components/ui';
import { palette, radii, spacing, typography } from '../theme';
import { CLASS_YEAR_OPTIONS } from '../constants/classYears';
import { INTEREST_TAGS } from '../constants/interestTags';

type Mode = 'login' | 'register';

const PURPOSE_OPTIONS = ['Find friends', 'Try activities', 'Join clubs', 'Study plans'];
const CAMPUS_ZONE_OPTIONS = ['North campus', 'South campus', 'Oval', 'Libraries', 'RPAC'];

export default function AuthScreen() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [classYear, setClassYear] = useState('');
  const [major, setMajor] = useState('');
  const [purpose, setPurpose] = useState('');
  const [campusZones, setCampusZones] = useState<string[]>([]);
  const [interestTags, setInterestTags] = useState<string[]>([]);
  const [clubInterests, setClubInterests] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);

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
    Alert.alert(
      'Reset your password',
      'Email Bridge support from your school address and we will help you regain access.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email support',
          onPress: () => {
            void Linking.openURL(`mailto:support@joinbridgeapp.com?subject=${encodeURIComponent('Bridge password reset')}`);
          },
        },
      ]
    );
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

	    if (mode === 'register' && (!purpose || interestTags.length === 0 || campusZones.length === 0)) {
	      Alert.alert('Finish setup', 'Choose what you are here for, at least one interest, and a preferred campus zone.');
	      return;
	    }

	    if (mode === 'register' && !ageConfirmed) {
	      Alert.alert('Age confirmation required', 'Bridge is for users who are 18 or older.');
	      return;
	    }

	    setBusy(true);
	    try {
	      if (mode === 'login') {
	        const response = await login(email.trim(), password);
	        await signIn(response.token, response.user);
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
        <Hero
          eyebrow="Bridge"
          title="A campus social layer that feels alive."
          subtitle="Find open pods, discover clubs in motion, and move from browsing to actually showing up."
        >
          <View style={styles.heroChips}>
            <Chip label="Live pods" active />
            <Chip label="Campus clubs" />
            <Chip label="Direct plans" />
          </View>
        </Hero>

        <Panel>
          <SegmentedControl
            value={mode}
            options={[
              { value: 'login', label: 'Sign in' },
              { value: 'register', label: 'Create account' },
            ]}
            onChange={setMode}
          />

          <View style={styles.form}>
            {mode === 'register' ? (
              <>
                <Field
                  label="First name"
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Avery"
                  autoCapitalize="words"
                />
                <Field
                  label="Last name"
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Chen"
                  autoCapitalize="words"
                />
              </>
            ) : null}
	            <Field label="School email" value={email} onChangeText={setEmail} placeholder="name@osu.edu" autoCapitalize="none" />
	            <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
	            {mode === 'login' ? (
	              <TouchableOpacity onPress={forgotPassword} style={styles.forgotButton}>
	                <Text style={styles.forgotText}>Forgot password?</Text>
	              </TouchableOpacity>
	            ) : null}
	            {mode === 'register' ? (
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
	                <View style={styles.field}>
	                  <Text style={styles.fieldLabel}>Interests</Text>
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
	                <Field label="Club interests" value={clubInterests} onChangeText={setClubInterests} placeholder="Design, robotics, service..." />
	                <TouchableOpacity style={styles.checkRow} onPress={() => setAgeConfirmed((value) => !value)}>
	                  <View style={[styles.checkbox, ageConfirmed && styles.checkboxActive]}>
	                    {ageConfirmed ? <Text style={styles.checkboxMark}>18</Text> : null}
	                  </View>
	                  <Text style={styles.checkText}>I confirm I am 18 or older.</Text>
	                </TouchableOpacity>
	              </>
	            ) : null}
            <PrimaryButton
              label={mode === 'login' ? 'Enter Bridge' : 'Build my profile'}
              onPress={submit}
              loading={busy}
            />
          </View>
          <Text style={styles.footnote}>
            {mode === 'login'
              ? 'Returning users land straight in the live campus feed.'
              : 'For students 18+. Bridge is independent and not affiliated with Ohio State.'}
          </Text>
        </Panel>
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
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} style={styles.input} placeholderTextColor={palette.slate} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  form: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cream,
  },
  checkboxActive: {
    backgroundColor: palette.scarlet,
    borderColor: palette.scarlet,
  },
  checkboxMark: {
    ...typography.bodyStrong,
    color: palette.white,
    lineHeight: 18,
  },
  checkText: {
    ...typography.body,
    flex: 1,
  },
	  chipWrap: {
	    flexDirection: 'row',
	    flexWrap: 'wrap',
	    rowGap: spacing.sm,
	  },
	  forgotButton: {
	    alignSelf: 'flex-start',
	    paddingVertical: 2,
	  },
	  forgotText: {
	    ...typography.bodyStrong,
	    color: palette.scarlet,
	  },
	  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.label,
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
  footnote: {
    marginTop: spacing.md,
    ...typography.body,
  },
});
