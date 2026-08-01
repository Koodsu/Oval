import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../App';
import { AppBackdrop, Button, Card, Field, ScreenHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { deleteMyAccount, getApiErrorMessage } from '../api';
import { Theme, createThemedStyles, radii, spacing, useTheme } from '../theme';

import { toast } from '../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'DeleteAccount'>;

export default function DeleteAccountScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const { clearSession } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const runDelete = async () => {
    setBusy(true);
    try {
      await deleteMyAccount(password);
      await clearSession();
    } catch (e) {
      setBusy(false);
      const message = getApiErrorMessage(e);
      setError(message);
      toast.error('Could not delete account', message);
    }
  };

  const confirm = () => {
    if (!password) {
      setError('Enter your password to confirm.');
      return;
    }
    setError(undefined);
    void runDelete();
  };

  return (
    <AppBackdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader
          title="Confirm deletion"
          kicker="ACCOUNT"
          onBack={() => navigation.goBack()}
          style={styles.header}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Card padded>
            <View style={styles.warning}>
              <View style={[styles.warningIcon, { backgroundColor: colors.dangerSoft }]}>
                <Ionicons name="warning-outline" size={28} color={colors.danger} />
              </View>
              <Text style={[typography.title, styles.warningTitle]}>Delete your Oval account?</Text>
              <Text style={[typography.caption, styles.warningCopy, { color: colors.sub }]}>
                This permanently removes your profile, posts, messages, memberships, and sign-in
                access. It cannot be undone.
              </Text>
            </View>

            <View style={[styles.removalList, { backgroundColor: colors.surfaceAlt }]}>
              <RemovalRow label="Your profile and campus connections" />
              <RemovalRow label="Your pods, messages, and club memberships" />
              <RemovalRow label="Your ability to sign back in" />
            </View>

            <Field
              label="Enter your password to confirm"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (error) setError(undefined);
              }}
              error={error}
              placeholder="Your password"
              secureTextEntry
              secureToggle
              autoCapitalize="none"
              textContentType="password"
              autoComplete="current-password"
              style={{ marginTop: spacing.md }}
            />
            <View style={styles.actions}>
              <Button
                label="Delete account permanently"
                variant="danger"
                icon="trash"
                onPress={confirm}
                loading={busy}
                size="lg"
              />
              <Button
                label="Keep my account"
                variant="secondary"
                onPress={() => navigation.goBack()}
                disabled={busy}
              />
            </View>
          </Card>
          <Text style={[typography.captionSmall, styles.retentionNote]}>
            Limited safety records may be retained as described in the Privacy Policy.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </AppBackdrop>
  );
}

function RemovalRow({ label }: { label: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={removalStyles.row}>
      <Ionicons name="close-circle" size={18} color={colors.danger} />
      <Text style={[typography.caption, { flex: 1, color: colors.ink }]}>{label}</Text>
    </View>
  );
}

const removalStyles = {
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
};

const useStyles = createThemedStyles((_t: Theme) => ({
  header: {
    paddingHorizontal: spacing.xl,
  },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center' as const,
  },
  warning: {
    alignItems: 'center' as const,
  },
  warningIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing.md,
  },
  warningTitle: {
    textAlign: 'center' as const,
  },
  warningCopy: {
    textAlign: 'center' as const,
    marginTop: spacing.sm,
  },
  removalList: {
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  retentionNote: {
    textAlign: 'center' as const,
    paddingHorizontal: spacing.lg,
  },
}));
