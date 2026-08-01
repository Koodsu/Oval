import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
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
  SkeletonCard,
} from '../components/ui';
import { Theme, createThemedStyles, radii, spacing, useTheme } from '../theme';
import { toast } from '../lib/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'BlockedUsers'>;
type BlockedUser = Awaited<ReturnType<typeof getBlockedUsers>>[number];

export default function BlockedUsersScreen({
  navigation,
  previewUsers,
}: Props & { previewUsers?: BlockedUser[] }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<BlockedUser[]>(previewUsers ?? []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(Boolean(previewUsers));
  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (previewUsers) return;
    try {
      setUsers(await getBlockedUsers());
      setLoadWarning(null);
    } catch {
      setLoadWarning("Couldn’t refresh blocked users. Reopen this screen to try again.");
    } finally {
      setLoaded(true);
    }
  }, [previewUsers]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const confirmUnblock = (user: BlockedUser) => {
    Alert.alert(
      `Unblock ${user.name}?`,
      'They will be able to find your profile, message you if you become friends again, and join shared pods.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setBusyId(user.id);
            try {
              await unblockUser(user.id);
              setUsers((current) => current.filter((item) => item.id !== user.id));
              toast.success('User unblocked', 'They were not notified.');
            } catch (error) {
              toast.error('Could not unblock user', getApiErrorMessage(error));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
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
        <ScreenHeader title="Blocked users" onBack={() => navigation.goBack()} />
        {loadWarning ? <Banner message={loadWarning} kind="error" /> : null}

        <Card padded>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="shield-checkmark-outline" size={24} color={colors.ink} />
            </View>
            <Text style={[typography.caption, { flex: 1 }]}>
              Blocked people can’t message you, invite you, or see your profile.
            </Text>
          </View>
        </Card>

        {!loaded ? (
          <>
            <SkeletonCard compact />
            <SkeletonCard compact />
          </>
        ) : (
          <View style={{ gap: spacing.md }}>
            <Text style={typography.kicker}>BLOCKED ACCOUNTS</Text>
            {users.length === 0 ? (
              <EmptyState
                icon="shield-checkmark-outline"
                title="Nobody blocked"
                body="People you block will appear here, and you can unblock them anytime."
              />
            ) : (
              <>
                {users.map((blocked) => (
                  <Card key={blocked.id} padded>
                    <View style={styles.row}>
                      <Avatar name={blocked.name} uri={blocked.avatarUrl} size={48} />
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={typography.heading} numberOfLines={1}>
                          {blocked.name}
                        </Text>
                        <Text style={typography.captionSmall} numberOfLines={1}>
                          {[blocked.major, blocked.classYear].filter(Boolean).join(' · ') ||
                            'Ohio State student'}
                        </Text>
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
                <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.sub} />
                  <Text style={[typography.captionSmall, { flex: 1 }]}>
                    They won’t be notified if you unblock them.
                  </Text>
                </View>
              </>
            )}
          </View>
        )}
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
  infoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  note: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
}));
