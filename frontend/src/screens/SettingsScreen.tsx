import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../../App';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationPreferences,
} from '../api';
import GradientButton from '../components/GradientButton';
import { colors, spacing, radii, typography, shadows } from '../theme';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    podJoin: true,
    newMessage: true,
    meetupReminder: true,
    recapPrompt: true,
    waitlistSpot: true,
  });

  const fetchNotifPrefs = useCallback(async () => {
    try {
      const { preferences } = await getNotificationPreferences();
      setNotifPrefs(preferences);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchNotifPrefs();
  }, [fetchNotifPrefs]);

  const handleToggleNotif = async (key: keyof NotificationPreferences, value: boolean) => {
    const optimistic = { ...notifPrefs, [key]: value };
    setNotifPrefs(optimistic);
    try {
      const { preferences } = await updateNotificationPreferences({ [key]: value });
      setNotifPrefs(preferences);
    } catch {
      setNotifPrefs(notifPrefs);
      Alert.alert('Error', 'Failed to update notification setting.');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const appVersion = Constants.expoConfig?.version ?? '—';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Account */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={[styles.card, shadows.sm]}>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.8}
        >
          <Ionicons name="person-outline" size={20} color={colors.primary} />
          <Text style={styles.linkText}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={styles.cardDivider} />
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('BlockedUsers')}
          activeOpacity={0.8}
        >
          <Ionicons name="ban-outline" size={20} color={colors.primary} />
          <Text style={styles.linkText}>Blocked Users</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={styles.cardDivider} />
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('PodInvites')}
          activeOpacity={0.8}
        >
          <Ionicons name="mail-outline" size={20} color={colors.primary} />
          <Text style={styles.linkText}>Pod Invites</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={styles.cardDivider} />
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('MyReports')}
          activeOpacity={0.8}
        >
          <Ionicons name="flag-outline" size={20} color={colors.primary} />
          <Text style={styles.linkText}>My Reports</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Notifications */}
      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={[styles.card, shadows.sm]}>
        <View style={styles.notifRow}>
          <View style={styles.notifLabelGroup}>
            <Ionicons name="people-outline" size={18} color={colors.primary} />
            <View>
              <Text style={styles.notifLabel}>Pod joins</Text>
              <Text style={styles.notifSubLabel}>When someone joins your pod</Text>
            </View>
          </View>
          <Switch
            value={notifPrefs.podJoin}
            onValueChange={(v) => handleToggleNotif('podJoin', v)}
            trackColor={{ false: colors.border, true: colors.primary + '55' }}
            thumbColor={notifPrefs.podJoin ? colors.primary : colors.textTertiary}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.notifRow}>
          <View style={styles.notifLabelGroup}>
            <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
            <View>
              <Text style={styles.notifLabel}>New messages</Text>
              <Text style={styles.notifSubLabel}>Chat activity in your pods</Text>
            </View>
          </View>
          <Switch
            value={notifPrefs.newMessage}
            onValueChange={(v) => handleToggleNotif('newMessage', v)}
            trackColor={{ false: colors.border, true: colors.primary + '55' }}
            thumbColor={notifPrefs.newMessage ? colors.primary : colors.textTertiary}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.notifRow}>
          <View style={styles.notifLabelGroup}>
            <Ionicons name="alarm-outline" size={18} color={colors.primary} />
            <View>
              <Text style={styles.notifLabel}>Meetup reminders</Text>
              <Text style={styles.notifSubLabel}>1 hour before your meetup</Text>
            </View>
          </View>
          <Switch
            value={notifPrefs.meetupReminder}
            onValueChange={(v) => handleToggleNotif('meetupReminder', v)}
            trackColor={{ false: colors.border, true: colors.primary + '55' }}
            thumbColor={notifPrefs.meetupReminder ? colors.primary : colors.textTertiary}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.notifRow}>
          <View style={styles.notifLabelGroup}>
            <Ionicons name="star-outline" size={18} color={colors.primary} />
            <View>
              <Text style={styles.notifLabel}>Recap prompts</Text>
              <Text style={styles.notifSubLabel}>Rate your meetup after it ends</Text>
            </View>
          </View>
          <Switch
            value={notifPrefs.recapPrompt}
            onValueChange={(v) => handleToggleNotif('recapPrompt', v)}
            trackColor={{ false: colors.border, true: colors.primary + '55' }}
            thumbColor={notifPrefs.recapPrompt ? colors.primary : colors.textTertiary}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.notifRow}>
          <View style={styles.notifLabelGroup}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <View>
              <Text style={styles.notifLabel}>Waitlist spots</Text>
              <Text style={styles.notifSubLabel}>When a spot opens up in a waitlisted pod</Text>
            </View>
          </View>
          <Switch
            value={notifPrefs.waitlistSpot}
            onValueChange={(v) => handleToggleNotif('waitlistSpot', v)}
            trackColor={{ false: colors.border, true: colors.primary + '55' }}
            thumbColor={notifPrefs.waitlistSpot ? colors.primary : colors.textTertiary}
          />
        </View>
      </View>

      {/* Help */}
      <Text style={styles.sectionTitle}>About</Text>
      <View style={[styles.card, shadows.sm]}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>{appVersion}</Text>
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Made for OSU Buckeyes</Text>
          <Text style={styles.infoValue}>Go Bucks!</Text>
        </View>
      </View>

      {/* Sign Out */}
      <View style={styles.signOutSection}>
        <GradientButton
          title="Sign Out"
          onPress={handleSignOut}
          icon="log-out-outline"
          variant="outline"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingTop: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm + 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.md + 20 + spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  linkText: {
    ...typography.bodyBold,
    flex: 1,
    color: colors.text,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  notifLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
  },
  notifLabel: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  notifSubLabel: {
    ...typography.tiny,
    color: colors.textTertiary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  infoLabel: {
    ...typography.body,
    color: colors.text,
  },
  infoValue: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  signOutSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xxl,
  },
});
