import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { login, register, API_USER_MESSAGE } from '../api';
import { useAuth } from '../context/AuthContext';
import { Chip, Hero, Panel, PrimaryButton, Screen, SegmentedControl } from '../components/ui';
import { palette, radii, spacing, typography } from '../theme';
import { CLASS_YEAR_OPTIONS } from '../constants/classYears';

type Mode = 'login' | 'register';

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

    setBusy(true);
    try {
      const response =
        mode === 'login'
          ? await login(email.trim(), password)
          : await register(
              firstName.trim(),
              lastName.trim(),
              email.trim(),
              password,
              classYear.trim(),
              major.trim()
            );
      await signIn(response.token, response.user);
    } catch (error) {
      Alert.alert('Sign-in issue', error instanceof Error ? error.message || API_USER_MESSAGE : API_USER_MESSAGE);
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
              : 'New accounts start with verification so pods and clubs stay trustworthy.'}
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
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
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
