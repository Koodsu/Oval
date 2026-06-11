import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_USER_MESSAGE, getApiErrorMessage } from '../api';
import { AppBackdrop, Button, Card, Divider, Sticker } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  fonts,
  radii,
  spacing,
  useTheme,
} from '../theme';

const SITE_URL = 'https://www.joinbridgeapp.com';

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
      Alert.alert(
        'Confirmation required',
        'Confirm your age and accept the current policies to continue.',
      );
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
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Sticker label="House rules" tint={colors.amberSoft} tilt={2} icon="document-text" />
        <Text style={styles.title}>THE FINE{'\n'}PRINT.</Text>
        <Text style={[typography.body, styles.sub]}>
          Bridge coordinates real-world meetups with real students. Skim the rules, confirm you're
          eligible, and you're in.
        </Text>

        <Card padded>
          <PolicyLink label="Terms of Service" url={`${SITE_URL}/terms`} />
          <Divider />
          <PolicyLink label="Privacy Policy" url={`${SITE_URL}/privacy`} />
          <Divider />
          <PolicyLink label="Community Guidelines" url={`${SITE_URL}/community-guidelines`} />
        </Card>

        <Card padded>
          <View style={{ gap: spacing.lg }}>
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
            <Button label="Accept and continue" onPress={submit} loading={busy} size="lg" />
            <Pressable
              onPress={() => void signOut()}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              style={({ pressed }) => [{ alignSelf: 'center' }, pressed && { opacity: 0.5 }]}
            >
              <Text style={[typography.caption, { fontFamily: fonts.bold }]}>Sign out instead</Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </AppBackdrop>
  );
}

function PolicyLink({ label, url }: { label: string; url: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={`Open ${label}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 14,
        },
        pressed && { opacity: 0.5 },
      ]}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>{label}</Text>
      <Ionicons name="open-outline" size={16} color={colors.primary} />
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
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radii.xs,
          borderWidth: BORDER_W,
          borderColor: colors.border,
          backgroundColor: checked ? colors.primary : colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '-3deg' }],
        }}
      >
        {checked ? (
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onPrimary }}>✓</Text>
        ) : null}
      </View>
      <Text style={[typography.body, { flex: 1, fontSize: 14, lineHeight: 19 }]}>{label}</Text>
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
  title: {
    fontFamily: fonts.displayHeavy,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1,
    color: t.colors.ink,
  },
  sub: {
    color: t.colors.sub,
    maxWidth: 320,
  },
}));
