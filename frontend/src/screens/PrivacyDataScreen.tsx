import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../App';
import {
  deleteMyAccount,
  downloadMyData,
  getApiErrorMessage,
  getNotificationPreferences,
  NotificationPreferences,
  updateNotificationPreferences,
  updateProfile,
} from '../api';
import {
  AppBackdrop,
  Banner,
  Button,
  Card,
  ScreenHeader,
  SectionHeader,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { exportTextFile } from '../utils/fileExport';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  fonts,
  radii,
  spacing,
  useTheme,
} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyData'>;

const PREFERENCE_ROWS: Array<{
  key: keyof NotificationPreferences;
  title: string;
  body: string;
}> = [
  { key: 'podJoin', title: 'Pod joins', body: 'When someone joins a pod you created.' },
  { key: 'newMessage', title: 'New messages', body: 'Pod, club, officer, and direct messages.' },
  {
    key: 'meetupReminder',
    title: 'Meetup reminders',
    body: 'Reminders before pods and club meetings.',
  },
  { key: 'recapPrompt', title: 'Recap prompts', body: 'Post-meetup feedback and connection prompts.' },
  { key: 'waitlistSpot', title: 'Waitlist openings', body: 'When a spot opens in a full pod.' },
  { key: 'clubMeetingCreated', title: 'New club meetings', body: 'When a club schedules a meeting.' },
  {
    key: 'clubAnnouncementCreated',
    title: 'Club announcements',
    body: 'Official updates from your clubs.',
  },
  { key: 'clubKick', title: 'Club membership changes', body: 'When you are removed from a club.' },
  { key: 'clubRoleChange', title: 'Club role changes', body: 'When your club permissions change.' },
  { key: 'clubAttendanceOpen', title: 'Attendance check-in', body: 'When meeting attendance opens.' },
];

export default function PrivacyDataScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const { user, updateUser, clearSession } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [instagram, setInstagram] = useState(user?.instagramHandle ?? '');
  const [socialBusy, setSocialBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getNotificationPreferences()
        .then((response) => {
          setPrefs(response.preferences);
          setLoadWarning(null);
        })
        .catch(() => setLoadWarning("Couldn't refresh preferences — reopen to retry."));
    }, []),
  );

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    try {
      const response = await updateNotificationPreferences({ [key]: value });
      setPrefs(response.preferences);
    } catch (error) {
      setPrefs(previous);
      Alert.alert('Could not update notifications', getApiErrorMessage(error));
    }
  };

  const saveInstagram = async () => {
    setSocialBusy(true);
    try {
      const normalizedInstagram = instagram.trim().replace(/^@+/, '');
      const updated = await updateProfile({ instagramHandle: normalizedInstagram || null });
      await updateUser(updated);
      setInstagram(updated.instagramHandle ?? '');
      Alert.alert(
        'Connected accounts updated',
        updated.instagramHandle
          ? `Instagram @${updated.instagramHandle} is linked to your profile.`
          : 'Instagram has been unlinked from your profile.',
      );
    } catch (error) {
      Alert.alert('Could not update Instagram', getApiErrorMessage(error));
    } finally {
      setSocialBusy(false);
    }
  };

  const unlinkInstagram = () => {
    Alert.alert('Unlink Instagram?', 'The handle will be removed from your Oval profile.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlink',
        style: 'destructive',
        onPress: async () => {
          setInstagram('');
          setSocialBusy(true);
          try {
            const updated = await updateProfile({ instagramHandle: null });
            await updateUser(updated);
          } catch (error) {
            setInstagram(user?.instagramHandle ?? '');
            Alert.alert('Could not unlink Instagram', getApiErrorMessage(error));
          } finally {
            setSocialBusy(false);
          }
        },
      },
    ]);
  };

  const exportData = async () => {
    setExportBusy(true);
    try {
      const data = await downloadMyData();
      const date = new Date().toISOString().slice(0, 10);
      await exportTextFile({
        filename: `oval-data-${date}.json`,
        contents: JSON.stringify(data, null, 2),
        mimeType: 'application/json',
        uti: 'public.json',
        title: 'Download my Oval data',
      });
    } catch (error) {
      Alert.alert('Could not download your data', getApiErrorMessage(error));
    } finally {
      setExportBusy(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Permanently delete account?',
      'This removes your profile, posts, messages, memberships, social links, and sign-in access. Limited safety records may be retained as described in the Privacy Policy. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleteBusy(true);
            try {
              await deleteMyAccount();
              await clearSession();
            } catch (error) {
              Alert.alert('Could not delete account', getApiErrorMessage(error));
              setDeleteBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <AppBackdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        <ScreenHeader title="Privacy & Data" kicker="YOUR CONTROL" onBack={() => navigation.goBack()} />
        {loadWarning ? <Banner message={loadWarning} kind="info" /> : null}

        <View style={styles.section}>
          <SectionHeader kicker="Export" title="Your data" />
          <Card padded>
            <Text style={typography.title}>Download my data</Text>
            <Text style={[typography.caption, { marginTop: 4 }]}>
              Export the account, profile, content, memberships, connections, reports, and activity
              data Oval stores about you.
            </Text>
            <Button
              label="Download JSON export"
              icon="download"
              onPress={() => void exportData()}
              loading={exportBusy}
              style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader kicker="Pings" title="Notification preferences" />
          {prefs ? (
            <Card padded>
              {PREFERENCE_ROWS.map((row, index) => (
                <View
                  key={row.key}
                  style={[
                    styles.preferenceRow,
                    index < PREFERENCE_ROWS.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={typography.subheading}>{row.title}</Text>
                    <Text style={typography.captionSmall}>{row.body}</Text>
                  </View>
                  <Switch
                    value={prefs[row.key]}
                    onValueChange={(value) => void updatePreference(row.key, value)}
                    trackColor={{ false: colors.sunken, true: colors.primarySoft }}
                    thumbColor={prefs[row.key] ? colors.primary : colors.surface}
                  />
                </View>
              ))}
            </Card>
          ) : (
            <Card padded>
              <Text style={typography.caption}>Loading notification preferences…</Text>
            </Card>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader kicker="Linked" title="Connected accounts" />
          <Card padded>
            <Text style={typography.title}>Instagram</Text>
            <Text style={[typography.caption, { marginTop: 4 }]}>
              Link the Instagram handle shown on your Oval profile, or remove it at any time.
            </Text>
            <TextInput
              value={instagram}
              onChangeText={setInstagram}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="@yourhandle"
              placeholderTextColor={colors.faint}
              style={[
                styles.input,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.ink },
              ]}
            />
            <View style={styles.actionStack}>
              <Button
                label={user?.instagramHandle ? 'Update Instagram' : 'Link Instagram'}
                onPress={() => void saveInstagram()}
                loading={socialBusy}
                disabled={!instagram.trim()}
              />
              {user?.instagramHandle ? (
                <Button
                  label="Unlink Instagram"
                  variant="secondary"
                  onPress={unlinkInstagram}
                  disabled={socialBusy}
                />
              ) : null}
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader kicker="Danger zone" title="Delete my account" />
          <Card padded borderColor={colors.danger}>
            <Text style={[typography.title, { color: colors.danger }]}>
              Permanent account deletion
            </Text>
            <Text style={[typography.caption, { marginTop: 4 }]}>
              Deletes your profile, posts, messages, memberships, preferences, and connected account
              data. Limited safety records may be retained under the Privacy Policy.
            </Text>
            <Button
              label="Delete my account"
              variant="danger"
              onPress={confirmDeleteAccount}
              loading={deleteBusy}
              style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
            />
          </Card>
        </View>
        </ScrollView>
      </SafeAreaView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((_t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  preferenceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  input: {
    marginTop: spacing.md,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  actionStack: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
}));
