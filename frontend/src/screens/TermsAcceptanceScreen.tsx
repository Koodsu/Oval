import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_USER_MESSAGE, getApiErrorMessage } from '../api';
import { AppBackdrop, Button, Card } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { OvalMark } from '../components/OnboardingChrome';
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

const SITE_URL = 'https://www.theovalapp.com';

export default function TermsAcceptanceScreen() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { acceptGuidelines, signOut } = useAuth();
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!ageConfirmed || !termsAccepted) {
      toast.error(
        'Confirmation required',
        'Confirm your age and accept the current policies to continue.',
      );
      return;
    }
    setBusy(true);
    try {
      await acceptGuidelines();
    } catch (error) {
      toast.error('Could not save acceptance', getApiErrorMessage(error, API_USER_MESSAGE));
    } finally {
      setBusy(false);
    }
  };

  const canContinue = ageConfirmed && termsAccepted;

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <OvalMark size={48} />
          <Text style={typography.kicker} maxFontSizeMultiplier={2}>
            BEFORE YOU CONTINUE
          </Text>
          <Text accessibilityRole="header" style={styles.title} maxFontSizeMultiplier={2}>
            A few ground rules
          </Text>
          <Text style={[typography.body, styles.sub]} maxFontSizeMultiplier={2}>
            Oval works when everyone feels safe showing up.
          </Text>
        </View>

        <Card padded>
          <Text accessibilityRole="header" style={typography.title} maxFontSizeMultiplier={2}>
            House rules
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <RuleRow icon="person-outline" label="Be who you say you are" />
            <RuleRow icon="heart-outline" label="Treat people with respect" />
            <RuleRow icon="shield-checkmark-outline" label="Plans should feel safe and welcoming" />
          </View>
        </Card>

        <Card padded={false}>
          <PolicyLink label="Terms of Service" url={`${SITE_URL}/terms`} />
          <PolicyLink label="Privacy Policy" url={`${SITE_URL}/privacy`} />
          <PolicyLink label="Community Guidelines" url={`${SITE_URL}/community-guidelines`} last />
        </Card>

        <View style={{ gap: spacing.sm }}>
          <CheckRow
            checked={ageConfirmed}
            label="I confirm I am 18 or older"
            onPress={() => setAgeConfirmed((value) => !value)}
          />
          <CheckRow
            checked={termsAccepted}
            label="I agree to the policies above, including the arbitration agreement and class action waiver in the Terms of Use"
            onPress={() => setTermsAccepted((value) => !value)}
          />
          <Text style={[typography.caption, { color: colors.sub }]} maxFontSizeMultiplier={2}>
            The Terms of Use require most disputes to be resolved by individual arbitration and waive
            your right to a jury trial and to join a class action. You can opt out within 30 days by
            emailing contactus@theovalapp.com.
          </Text>
        </View>

        <Button
          label="Accept and continue"
          onPress={submit}
          loading={busy}
          disabled={!canContinue}
          size="lg"
        />
        <Pressable
          onPress={() => void signOut()}
          accessibilityRole="button"
          accessibilityLabel="Sign out instead"
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.5 }]}
        >
          <Text style={[typography.caption, { fontFamily: fonts.bold }]} maxFontSizeMultiplier={2}>
            Sign out instead
          </Text>
        </Pressable>
      </ScrollView>
    </AppBackdrop>
  );
}

function RuleRow({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View style={[styles.ruleRow, { borderBottomColor: colors.borderSoft }]}>
      <View style={[styles.ruleIcon, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={icon} size={19} color={colors.ink} />
      </View>
      <Text style={[typography.body, { flex: 1 }]} maxFontSizeMultiplier={2}>
        {label}
      </Text>
    </View>
  );
}

function PolicyLink({ label, url, last = false }: { label: string; url: string; last?: boolean }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={`Open ${label}`}
      style={({ pressed }) => [
        styles.policyRow,
        { borderBottomColor: colors.borderSoft },
        last && { borderBottomWidth: 0 },
        pressed && { opacity: 0.5 },
      ]}
    >
      <Text style={typography.subheading} maxFontSizeMultiplier={2}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.sub} />
    </Pressable>
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
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.checkRow,
        { backgroundColor: colors.surface, borderColor: checked ? colors.primary : colors.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: checked ? colors.primary : colors.sub,
            backgroundColor: checked ? colors.primary : colors.surface,
          },
        ]}
      >
        {checked ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
      </View>
      <Text style={[typography.body, { flex: 1, fontSize: 14 }]} maxFontSizeMultiplier={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  intro: {
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    color: t.colors.ink,
    textAlign: 'center' as const,
  },
  sub: {
    color: t.colors.sub,
    maxWidth: 300,
    textAlign: 'center' as const,
  },
  ruleRow: {
    minHeight: 50,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    borderBottomWidth: 1,
  },
  ruleIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  policyRow: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderBottomWidth: 1,
  },
  checkRow: {
    minHeight: 54,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  signOut: {
    alignSelf: 'center' as const,
    paddingVertical: spacing.sm,
  },
}));
