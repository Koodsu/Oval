import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiErrorMessage, getBlockedUsers, unblockUser } from '../api';
import { RootStackParamList } from '../../App';
import { EmptyState, Panel, PrimaryButton, Screen, ScreenHeader, UserAvatar } from '../components/ui';
import { Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';
import { useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'BlockedUsers'>;

type BlockedUser = Awaited<ReturnType<typeof getBlockedUsers>>[number];

export default function BlockedUsersScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await getBlockedUsers();
      setUsers(rows);
    } catch (error) {
      Alert.alert('Could not load blocked users', getApiErrorMessage(error));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
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
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Blocked users" onBack={() => navigation.goBack()} />
        <Text style={styles.body}>
          People you block cannot message you, appear in search for you, or stay in shared pods with you.
        </Text>
        {loaded && users.length === 0 ? (
          <EmptyState icon="shield-checkmark-outline" title="No blocked users" body="People you block will show up here." />
        ) : null}
        {users.map((blocked) => (
          <Panel key={blocked.id}>
            <View style={styles.row}>
              <UserAvatar name={blocked.name} avatarUrl={blocked.avatarUrl} />
              <View style={styles.copy}>
                <Text style={styles.title}>{blocked.name}</Text>
                <Text style={styles.body}>Blocked user</Text>
              </View>
              <PrimaryButton
                label="Unblock"
                kind="ghost"
                loading={busyId === blocked.id}
                onPress={() => confirmUnblock(blocked)}
              />
            </View>
          </Panel>
        ))}
      </ScrollView>
    </Screen>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...t.typography.title,
  },
  body: {
    ...t.typography.body,
    color: t.colors.sub,
  },
}));
