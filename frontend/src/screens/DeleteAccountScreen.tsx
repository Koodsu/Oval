import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../App';
import { AppBackdrop, Button, Card, Field, ScreenHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { deleteMyAccount, getApiErrorMessage } from '../api';
import { spacing, useTheme } from '../theme';

import { toast } from '../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'DeleteAccount'>;

export default function DeleteAccountScreen({ navigation }: Props) {
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
    Alert.alert(
      'Permanently delete account?',
      'This removes your profile, posts, messages, memberships, and sign-in access. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: () => void runDelete() },
      ],
    );
  };

  return (
    <AppBackdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader
          title="Delete account"
          kicker="YOUR CONTROL"
          onBack={() => navigation.goBack()}
        />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Card padded>
            <Text style={typography.title}>This is permanent</Text>
            <Text style={[typography.caption, { marginTop: 4, color: colors.sub }]}>
              Deleting your account removes your profile, posts, messages, memberships, and
              sign-in access. Limited safety records may be retained as described in the Privacy
              Policy. This cannot be undone.
            </Text>
            <Field
              label="Confirm your password"
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
            <Button
              label="Delete account"
              variant="danger"
              icon="trash"
              onPress={confirm}
              loading={busy}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </View>
      </SafeAreaView>
    </AppBackdrop>
  );
}
