import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { Panel, PrimaryButton, Screen, ScreenHeader, SectionHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { exportTextFile } from '../utils/fileExport';
import { Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyData'>;

const PREFERENCE_ROWS: Array<{
  key: keyof NotificationPreferences;
  title: string;
  body: string;
}> = [
  { key: 'podJoin', title: 'Pod joins', body: 'When someone joins a pod you created.' },
  { key: 'newMessage', title: 'New messages', body: 'Pod, club, officer, and direct messages.' },
  { key: 'meetupReminder', title: 'Meetup reminders', body: 'Reminders before pods and club meetings.' },
  { key: 'recapPrompt', title: 'Recap prompts', body: 'Post-meetup feedback and connection prompts.' },
  { key: 'waitlistSpot', title: 'Waitlist openings', body: 'When a spot opens in a full pod.' },
  { key: 'clubMeetingCreated', title: 'New club meetings', body: 'When a club schedules a meeting.' },
  { key: 'clubAnnouncementCreated', title: 'Club announcements', body: 'Official updates from your clubs.' },
  { key: 'clubKick', title: 'Club membership changes', body: 'When you are removed from a club.' },
  { key: 'clubRoleChange', title: 'Club role changes', body: 'When your club permissions change.' },
  { key: 'clubAttendanceOpen', title: 'Attendance check-in', body: 'When meeting attendance opens.' },
];

export default function PrivacyDataScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user, updateUser, clearSession } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [instagram, setInstagram] = useState(user?.instagramHandle ?? '');
  const [socialBusy, setSocialBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getNotificationPreferences()
        .then((response) => setPrefs(response.preferences))
        .catch((error) => Alert.alert('Could not load preferences', getApiErrorMessage(error)));
    }, [])
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
      const updated = await updateProfile({ instagramHandle: instagram.trim() || null });
      await updateUser(updated);
      setInstagram(updated.instagramHandle ?? '');
      Alert.alert('Connected accounts updated', updated.instagramHandle
        ? `Instagram @${updated.instagramHandle} is linked to your profile.`
        : 'Instagram has been unlinked from your profile.');
    } catch (error) {
      Alert.alert('Could not update Instagram', getApiErrorMessage(error));
    } finally {
      setSocialBusy(false);
    }
  };

  const unlinkInstagram = () => {
    Alert.alert('Unlink Instagram?', 'The handle will be removed from your Bridge profile.', [
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
        filename: `bridge-data-${date}.json`,
        contents: JSON.stringify(data, null, 2),
        mimeType: 'application/json',
        uti: 'public.json',
        title: 'Download my Bridge data',
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
      ]
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <ScreenHeader title="Privacy & Data" onBack={() => navigation.goBack()} />

        <View style={styles.section}>
          <SectionHeader title="Your data" />
          <Panel>
            <Text style={styles.title}>Download my data</Text>
            <Text style={styles.body}>
              Export the account, profile, content, memberships, connections, reports, and activity data Bridge stores about you.
            </Text>
            <View style={styles.action}>
              <PrimaryButton label="Download JSON export" onPress={() => void exportData()} loading={exportBusy} />
            </View>
          </Panel>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Notification preferences" />
          {prefs ? PREFERENCE_ROWS.map((row) => (
            <Panel key={row.key}>
              <View style={styles.preferenceRow}>
                <View style={styles.copy}>
                  <Text style={styles.title}>{row.title}</Text>
                  <Text style={styles.body}>{row.body}</Text>
                </View>
                <Switch
                  value={prefs[row.key]}
                  onValueChange={(value) => void updatePreference(row.key, value)}
                  trackColor={{ false: '#D8D7D2', true: '#E29A7A' }}
                  thumbColor={prefs[row.key] ? colors.primary : '#F8F7F3'}
                />
              </View>
            </Panel>
          )) : (
            <Panel><Text style={styles.body}>Loading notification preferences...</Text></Panel>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Connected accounts" />
          <Panel>
            <Text style={styles.title}>Instagram</Text>
            <Text style={styles.body}>
              Link the Instagram handle shown on your Bridge profile, or remove it at any time.
            </Text>
            <TextInput
              value={instagram}
              onChangeText={setInstagram}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="@yourhandle"
              placeholderTextColor={colors.faint}
              style={styles.input}
            />
            <View style={styles.actionStack}>
              <PrimaryButton
                label={user?.instagramHandle ? 'Update Instagram' : 'Link Instagram'}
                onPress={() => void saveInstagram()}
                loading={socialBusy}
                disabled={!instagram.trim()}
              />
              {user?.instagramHandle ? (
                <PrimaryButton label="Unlink Instagram" onPress={unlinkInstagram} kind="ghost" disabled={socialBusy} />
              ) : null}
            </View>
          </Panel>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Delete my account" />
          <Panel style={styles.dangerPanel}>
            <Text style={styles.dangerTitle}>Permanent account deletion</Text>
            <Text style={styles.body}>
              Deletes your profile, posts, messages, memberships, preferences, and connected account data. Limited safety records may be retained under the Privacy Policy.
            </Text>
            <View style={styles.action}>
              <PrimaryButton label="Delete my account" onPress={confirmDeleteAccount} kind="ghost" loading={deleteBusy} />
            </View>
          </Panel>
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  title: {
    ...t.typography.title,
  },
  body: {
    ...t.typography.body,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  input: {
    marginTop: spacing.md,
    borderRadius: radii.md,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...t.typography.body,
    color: t.colors.ink,
  },
  action: {
    marginTop: spacing.md,
  },
  actionStack: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  dangerPanel: {
    borderColor: 'rgba(160, 53, 40, 0.22)',
  },
  dangerTitle: {
    ...t.typography.title,
    color: t.colors.dangerText,
  },
}));
