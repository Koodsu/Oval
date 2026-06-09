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
import { Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';
const SITE_URL = 'https://www.joinbridgeapp.com';

export default function TermsAcceptanceScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
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
  const styles = useStyles();
  const { colors } = useTheme();
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
  const styles = useStyles();
  const { colors } = useTheme();
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

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  eyebrow: {
    ...t.typography.label,
    color: t.colors.primary,
    marginBottom: spacing.sm,
  },
  title: {
    ...t.typography.h1,
    marginBottom: spacing.md,
  },
  body: {
    ...t.typography.body,
    marginBottom: spacing.md,
  },
  link: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  linkText: {
    ...t.typography.bodyStrong,
    color: t.colors.primary,
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
    borderColor: t.colors.sub,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
  },
  checkText: {
    ...t.typography.body,
    color: t.colors.ink,
    flex: 1,
  },
  signOut: {
    alignSelf: 'center',
    padding: spacing.md,
  },
  signOutText: {
    ...t.typography.bodyStrong,
    color: t.colors.sub,
  },
}));
