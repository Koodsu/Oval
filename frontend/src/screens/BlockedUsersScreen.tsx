import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiErrorMessage, getBlockedUsers, unblockUser } from '../api';
import { RootStackParamList } from '../../App';
import {
  AppBackdrop,
  Avatar,
  Banner,
  Button,
  Card,
  EmptyState,
  ScreenHeader,
} from '../components/ui';
import { Theme, createThemedStyles, spacing, useTheme } from '../theme';
import { useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'BlockedUsers'>;

type BlockedUser = Awaited<ReturnType<typeof getBlockedUsers>>[number];

export default function BlockedUsersScreen({ navigation }: Props) {
  const styles = useStyles();
  const { typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await getBlockedUsers();
      setUsers(rows);
      setLoadWarning(null);
    } catch {
      setLoadWarning("Couldn't refresh — pull back and reopen to retry.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const confirmUnblock = (user: BlockedUser) => {
    Alert.alert('Unblock user?', `${user.name} will be able to interact with you again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          setBusyId(user.id);
          try {
            await unblockUser(user.id);
            setUsers((current) => current.filter((item) => item.id !== user.id));
          } catch (error) {
            Alert.alert('Could not unblock user', getApiErrorMessage(error));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Blocked users" kicker="SAFETY" onBack={() => navigation.goBack()} />
        {loadWarning ? <Banner message={loadWarning} kind="info" /> : null}
        <Text style={typography.caption}>
          People you block cannot message you, appear in search for you, or stay in shared pods with
          you.
        </Text>
        {loaded && users.length === 0 ? (
          <EmptyState
            icon="shield-checkmark"
            title="No blocked users"
            body="People you block will show up here."
          />
        ) : null}
        {users.map((blocked) => (
          <Card key={blocked.id} padded>
            <View style={styles.row}>
              <Avatar name={blocked.name} uri={blocked.avatarUrl} size={44} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={typography.heading} numberOfLines={1}>
                  {blocked.name}
                </Text>
                <Text style={typography.captionSmall}>Blocked user</Text>
              </View>
              <Button
                label="Unblock"
                size="sm"
                variant="secondary"
                loading={busyId === blocked.id}
                onPress={() => confirmUnblock(blocked)}
              />
            </View>
          </Card>
        ))}
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((_t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
}));
