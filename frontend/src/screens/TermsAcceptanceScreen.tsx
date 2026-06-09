import React, { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_USER_MESSAGE, getApiErrorMessage } from '../api';
import { Panel, PrimaryButton, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { palette, radii, spacing, typography } from '../theme';
const SITE_URL = 'https://www.joinbridgeapp.com';

export default function TermsAcceptanceScreen() {
  const { acceptGuidelines, signOut } = useAuth();
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!ageConfirmed || !termsAccepted) {
      Alert.alert('Confirmation required', 'Confirm your age and accept the current policies to continue.');
      return;
    }
    setBusy(true);
    try {
      await acceptGuidelines();
    } catch (error) {
      Alert.alert('Could not save acceptance', getApiErrorMessage(error, API_USER_MESSAGE));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Panel>
          <Text style={styles.eyebrow}>Before continuing</Text>
          <Text style={styles.title}>Review Bridge's current policies</Text>
          <Text style={styles.body}>
            Bridge coordinates real-world meetups and includes user-created content. Please review
            the current rules and confirm that you are eligible to use the service.
          </Text>

          <PolicyLink label="Terms of Service" url={`${SITE_URL}/terms`} />
          <PolicyLink label="Privacy Policy" url={`${SITE_URL}/privacy`} />
          <PolicyLink
            label="Community Guidelines"
            url={`${SITE_URL}/community-guidelines`}
          />

          <CheckRow
            checked={ageConfirmed}
            label="I confirm that I am 18 or older."
            onPress={() => setAgeConfirmed((value) => !value)}
          />
          <CheckRow
            checked={termsAccepted}
            label="I accept the current Terms, Privacy Policy, and Community Guidelines."
            onPress={() => setTermsAccepted((value) => !value)}
          />

          <PrimaryButton label="Accept and continue" onPress={submit} loading={busy} />
          <TouchableOpacity
            onPress={() => void signOut()}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={styles.signOut}
          >
            <Text style={styles.signOutText}>Sign out instead</Text>
          </TouchableOpacity>
        </Panel>
      </ScrollView>
    </Screen>
  );
}

function PolicyLink({ label, url }: { label: string; url: string }) {
  return (
    <TouchableOpacity
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={`Open ${label}`}
      style={styles.link}
    >
      <Text style={styles.linkText}>{label}</Text>
    </TouchableOpacity>
  );
}

function CheckRow({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.checkRow}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <View style={[styles.checkbox, checked && styles.checkboxActive]}>
        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={styles.checkText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  eyebrow: {
    ...typography.label,
    color: palette.scarlet,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  link: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  linkText: {
    ...typography.bodyStrong,
    color: palette.scarlet,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: palette.slate,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: palette.scarlet,
    borderColor: palette.scarlet,
  },
  checkmark: {
    color: palette.white,
    fontWeight: '800',
  },
  checkText: {
    ...typography.body,
    color: palette.ink,
    flex: 1,
  },
  signOut: {
    alignSelf: 'center',
    padding: spacing.md,
  },
  signOutText: {
    ...typography.bodyStrong,
    color: palette.slate,
  },
});
