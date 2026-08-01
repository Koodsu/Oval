import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../App';
import {
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
  ListRow,
  ScreenHeader,
  Sheet,
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
import { toast } from '../lib/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyData'> & {
  preview?: boolean;
};

const PREVIEW_PREFERENCES: NotificationPreferences = {
  podJoin: true,
  newMessage: true,
  meetupReminder: true,
  recapPrompt: true,
  waitlistSpot: true,
  clubMeetingCreated: true,
  clubAnnouncementCreated: true,
  clubKick: true,
  clubRoleChange: true,
  clubAttendanceOpen: true,
  weeklyRecap: true,
  demandAlerts: true,
};

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
  { key: 'waitlistSpot', title: 'Waitlist openings', body: 'When a spot opens in a full pod.' },
  {
    key: 'weeklyRecap',
    title: 'Weekly planning',
    body: 'Sunday recaps and planning nudges when there is something real to join.',
  },
  {
    key: 'demandAlerts',
    title: 'Demand alerts',
    body: 'When enough people are down for an activity, or a pod opens.',
  },
  { key: 'clubMeetingCreated', title: 'New club meetings', body: 'When a club schedules a meeting.' },
  {
    key: 'clubAnnouncementCreated',
    title: 'Club announcements',
    body: 'Official updates from your clubs.',
  },
  { key: 'clubKick', title: 'Club membership changes', body: 'When you are removed from a club.' },
  { key: 'clubRoleChange', title: 'Club role changes', body: 'When permissions change.' },
  {
    key: 'clubAttendanceOpen',
    title: 'Attendance check-in',
    body: 'When meeting attendance opens.',
  },
];

function PreferenceSwitch({
  row,
  value,
  onChange,
  last,
}: {
  row: (typeof PREFERENCE_ROWS)[number];
  value: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View
      style={[
        styles.preferenceRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSoft },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={typography.bodyMedium}>{row.title}</Text>
        <Text style={typography.captionSmall}>{row.body}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.sunken, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

export default function PrivacyDataScreen({ navigation, preview = false }: Props) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const { user, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(
    preview ? PREVIEW_PREFERENCES : null,
  );
  const [instagram, setInstagram] = useState(user?.instagramHandle ?? '');
  const [notificationSheetVisible, setNotificationSheetVisible] = useState(false);
  const [instagramSheetVisible, setInstagramSheetVisible] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (preview) return;
      void getNotificationPreferences()
        .then((response) => {
          setPrefs(response.preferences);
          setLoadWarning(null);
        })
        .catch(() => setLoadWarning("Couldn't refresh preferences — reopen to retry."));
    }, [preview]),
  );

  const enabledPreferenceCount = useMemo(
    () => (prefs ? PREFERENCE_ROWS.filter((row) => prefs[row.key]).length : 0),
    [prefs],
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
      toast.error('Could not update notifications', getApiErrorMessage(error));
    }
  };

  const saveInstagram = async () => {
    setSocialBusy(true);
    try {
      const normalizedInstagram = instagram.trim().replace(/^@+/, '');
      const updated = await updateProfile({ instagramHandle: normalizedInstagram || null });
      await updateUser(updated);
      setInstagram(updated.instagramHandle ?? '');
      setInstagramSheetVisible(false);
      toast.success(
        'Connected accounts updated',
        updated.instagramHandle
          ? `Instagram @${updated.instagramHandle} is linked to your profile.`
          : 'Instagram has been unlinked from your profile.',
      );
    } catch (error) {
      toast.error('Could not update Instagram', getApiErrorMessage(error));
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
          setSocialBusy(true);
          try {
            const updated = await updateProfile({ instagramHandle: null });
            await updateUser(updated);
            setInstagram('');
            setInstagramSheetVisible(false);
          } catch (error) {
            toast.error('Could not unlink Instagram', getApiErrorMessage(error));
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
      toast.error('Could not download your data', getApiErrorMessage(error));
    } finally {
      setExportBusy(false);
    }
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
        <ScreenHeader title="Privacy & data" onBack={() => navigation.goBack()} centered />
        {loadWarning ? <Banner message={loadWarning} kind="info" /> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Who can see and connect</Text>
          <Card padded={false} faceStyle={styles.listCard}>
            <ListRow
              icon="people-outline"
              title="Profile visibility"
              sub="Who can see your profile"
              right={<Text style={typography.caption}>Campus</Text>}
            />
            <ListRow
              icon="compass-outline"
              title="Discoverability"
              sub="Your verified profile can appear in search and explore"
              right={<Ionicons name="checkmark-circle" size={22} color={colors.success} />}
            />
            <ListRow
              icon="chatbubble-outline"
              title="Messaging"
              sub="Who can message you"
              right={<Text style={typography.caption}>Friends</Text>}
              last
            />
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your data & activity</Text>
          <Card padded={false} faceStyle={styles.listCard}>
            {prefs ? (
              <>
                <PreferenceSwitch
                  row={PREFERENCE_ROWS[1]}
                  value={prefs.newMessage}
                  onChange={(value) => void updatePreference('newMessage', value)}
                />
                <PreferenceSwitch
                  row={PREFERENCE_ROWS[2]}
                  value={prefs.meetupReminder}
                  onChange={(value) => void updatePreference('meetupReminder', value)}
                  last
                />
              </>
            ) : (
              <Text style={[typography.caption, styles.loadingCopy]}>
                Loading notification controls…
              </Text>
            )}
            <ListRow
              icon="notifications-outline"
              title="Notification controls"
              sub={prefs ? `${enabledPreferenceCount} of ${PREFERENCE_ROWS.length} enabled` : 'Loading'}
              onPress={() => setNotificationSheetVisible(true)}
              last
            />
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected accounts</Text>
          <Card padded={false} faceStyle={styles.listCard}>
            <ListRow
              icon="logo-instagram"
              title="Instagram"
              sub={
                user?.instagramHandle
                  ? `Connected as @${user.instagramHandle}`
                  : 'Add your Instagram handle'
              }
              right={
                <Text style={[typography.captionSmall, { color: colors.primary }]}>
                  {user?.instagramHandle ? 'Manage' : 'Connect'}
                </Text>
              }
              onPress={() => setInstagramSheetVisible(true)}
              last
            />
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & downloads</Text>
          <Card padded={false} faceStyle={styles.listCard}>
            <ListRow
              icon="document-text-outline"
              title={exportBusy ? 'Preparing download…' : 'Download my data'}
              sub="Get a copy of your account and activity data"
              onPress={exportBusy ? undefined : () => void exportData()}
            />
            <ListRow
              icon="ban-outline"
              title="Blocked users"
              sub="Manage people you have blocked"
              onPress={() => navigation.navigate('BlockedUsers')}
              last
            />
          </Card>
        </View>

        <Pressable
          onPress={() => navigation.navigate('DeleteAccount')}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          style={({ pressed }) => [
            styles.deleteCard,
            {
              backgroundColor: colors.dangerSoft,
              borderColor: colors.danger,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <View style={[styles.deleteIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="trash-outline" size={21} color={colors.danger} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.bodyMedium, { color: colors.danger }]}>Delete account</Text>
            <Text style={typography.captionSmall}>
              Permanently delete your account and all your data
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.danger} />
        </Pressable>
      </ScrollView>

      <Sheet
        visible={notificationSheetVisible}
        onClose={() => setNotificationSheetVisible(false)}
        title="Notifications"
        kicker="Your controls"
        scrollable
      >
        <Card padded={false} faceStyle={styles.sheetCard}>
          {prefs
            ? PREFERENCE_ROWS.map((row, index) => (
                <PreferenceSwitch
                  key={row.key}
                  row={row}
                  value={prefs[row.key]}
                  onChange={(value) => void updatePreference(row.key, value)}
                  last={index === PREFERENCE_ROWS.length - 1}
                />
              ))
            : null}
        </Card>
      </Sheet>

      <Sheet
        visible={instagramSheetVisible}
        onClose={() => setInstagramSheetVisible(false)}
        title="Instagram"
        kicker="Connected account"
      >
        <View style={styles.instagramSheet}>
          <Text style={typography.caption}>
            Add the Instagram handle shown on your Oval profile. You can remove it at any time.
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
      </Sheet>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 23,
    color: t.colors.ink,
  },
  listCard: {
    paddingHorizontal: spacing.md,
  },
  preferenceRow: {
    minHeight: 68,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  loadingCopy: {
    paddingVertical: spacing.lg,
  },
  deleteCard: {
    minHeight: 86,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  deleteIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sheetCard: {
    paddingHorizontal: spacing.md,
  },
  instagramSheet: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  input: {
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
}));
