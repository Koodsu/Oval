import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { deleteMyAccount, getApiErrorMessage, getFriends, getMyClubs, getNotificationPreferences, updateNotificationPreferences } from '../api';
import { RootStackParamList } from '../../App';
import { NotificationPreferences } from '../api';
import { FriendUser, MyClubMembershipRow } from '../types';
import { Chip, CompactHeader, EmptyState, Panel, PrimaryButton, Screen, ScreenHeader, SectionHeader, UserAvatar } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { INTEREST_TAG_META } from '../constants/interestTags';
import { palette, spacing, typography } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DEFAULT_PREFS: NotificationPreferences = {
  podJoin: true,
  newMessage: true,
  meetupReminder: true,
  recapPrompt: true,
  waitlistSpot: true,
};

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user, signOut, clearSession } = useAuth();
	  const [friends, setFriends] = useState<FriendUser[]>([]);
	  const [myClubs, setMyClubs] = useState<MyClubMembershipRow[]>([]);
	  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
	  const [showAllClubs, setShowAllClubs] = useState(false);
	  const [showAllFriends, setShowAllFriends] = useState(false);

  const load = useCallback(async () => {
    try {
      const [friendList, prefResponse, clubRows] = await Promise.all([
        getFriends(),
        getNotificationPreferences(),
        getMyClubs(),
      ]);
      setFriends(friendList);
      setPrefs(prefResponse.preferences);
      setMyClubs(clubRows);
	    } catch (error) {
	      Alert.alert('Could not load profile', getApiErrorMessage(error));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const updatePref = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await updateNotificationPreferences({ [key]: value });
	    } catch (error) {
	      setPrefs(prefs);
	      Alert.alert('Could not update settings', getApiErrorMessage(error));
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently removes your profile details, photo, university verification, notification token, and sign-in access.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMyAccount();
              await clearSession();
            } catch (error) {
              Alert.alert('Could not delete account', getApiErrorMessage(error));
            }
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <ScreenHeader title="Profile" onBack={() => navigation.goBack()} />
        <CompactHeader
          eyebrow="Profile"
          title={user?.name ?? 'Your profile'}
          subtitle={user?.bio ?? 'Shape how people understand you before they decide to join a pod, accept a DM, or trust a meetup.'}
        >
          <View style={styles.heroMeta}>
            {user?.interestTags?.slice(0, 3).map((tag) => (
              <Chip key={tag} label={INTEREST_TAG_META[tag]?.label ?? tag} active />
            ))}
          </View>
        </CompactHeader>

        <Panel>
          <View style={styles.profileTop}>
            <UserAvatar name={user?.name ?? 'User'} avatarUrl={user?.avatarUrl} size={72} />
            <View style={styles.profileCopy}>
              <Text style={styles.title}>{user?.major ?? 'Major not set'}</Text>
              <Text style={styles.body}>Class of {user?.classYear ?? 'TBD'} • {user?.email}</Text>
            </View>
          </View>
          <View style={styles.buttonStack}>
            <PrimaryButton label="Edit profile" onPress={() => navigation.navigate('EditProfile')} />
            <PrimaryButton label="Find people" onPress={() => navigation.navigate('UserSearch')} kind="ghost" />
            <PrimaryButton label="Sign out" onPress={() => void signOut()} kind="ghost" />
            <PrimaryButton label="Delete account" onPress={confirmDeleteAccount} kind="ghost" />
          </View>
        </Panel>

        <View style={styles.section}>
          <SectionHeader title="My clubs" />
	          {myClubs.length ? myClubs.slice(0, showAllClubs ? myClubs.length : 6).map((membership) => (
            <TouchableOpacity key={membership.club.id} onPress={() => navigation.navigate('ClubDetail', { clubId: membership.club.id })}>
              <Panel>
                <View style={styles.friendRow}>
                  <View style={styles.clubIcon}>
                    <Ionicons name="people-outline" size={20} color={palette.scarlet} />
                  </View>
                  <View style={styles.profileCopy}>
                    <Text style={styles.title}>{membership.club.name}</Text>
                    <Text style={styles.body}>
                      {membership.club.memberCount} members
                      {membership.nextMeeting ? ` • Next: ${membership.nextMeeting.title}` : ' • No upcoming meeting'}
                    </Text>
                  </View>
                </View>
              </Panel>
            </TouchableOpacity>
	          )) : <Panel><Text style={styles.body}>You have not joined any clubs yet.</Text></Panel>}
	          {myClubs.length > 6 ? (
	            <PrimaryButton label={showAllClubs ? 'Show fewer clubs' : `See all ${myClubs.length} clubs`} onPress={() => setShowAllClubs((value) => !value)} kind="ghost" />
	          ) : null}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Friends" />
	          {friends.length ? friends.slice(0, showAllFriends ? friends.length : 6).map((friend) => (
            <TouchableOpacity key={friend.id} onPress={() => navigation.navigate('UserProfile', { userId: friend.id })}>
              <Panel>
                <View style={styles.friendRow}>
                  <UserAvatar name={friend.name} avatarUrl={friend.avatarUrl} />
                  <Text style={styles.title}>{friend.name}</Text>
                </View>
              </Panel>
            </TouchableOpacity>
	          )) : <EmptyState icon="people-outline" title="No friends yet" body="People you connect with after pods will show up here." />}
	          {friends.length > 6 ? (
	            <PrimaryButton label={showAllFriends ? 'Show fewer friends' : `See all ${friends.length} friends`} onPress={() => setShowAllFriends((value) => !value)} kind="ghost" />
	          ) : null}
        </View>

        {prefs ? (
          <View style={styles.section}>
            <SectionHeader title="Notifications" />
            {Object.entries(prefs).map(([key, value]) => (
              <Panel key={key}>
                <View style={styles.prefRow}>
                  <View style={styles.profileCopy}>
	                    <Text style={styles.title}>{labelForPref(key as keyof NotificationPreferences)}</Text>
	                    <Text style={styles.body}>{descriptionForPref(key as keyof NotificationPreferences)}</Text>
                  </View>
                  <Switch
                    value={value}
                    onValueChange={(next) => void updatePref(key as keyof NotificationPreferences, next)}
                    trackColor={{ false: '#D8D7D2', true: '#E29A7A' }}
                    thumbColor={value ? palette.scarlet : '#F8F7F3'}
                  />
                </View>
              </Panel>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function labelForPref(key: keyof NotificationPreferences): string {
  return {
    podJoin: 'Pod joins',
    newMessage: 'New messages',
    meetupReminder: 'Meetup reminders',
    recapPrompt: 'Recap prompts',
    waitlistSpot: 'Waitlist openings',
  }[key];
}

function descriptionForPref(key: keyof NotificationPreferences): string {
  return {
    podJoin: 'Alerts when someone joins a pod you created or are coordinating.',
    newMessage: 'Alerts for new pod, club, officer, and direct messages.',
    meetupReminder: 'Reminders before pods and club meetings you plan to attend.',
    recapPrompt: 'Post-meetup nudges to rate a pod and connect with people you met.',
    waitlistSpot: 'Alerts when a full pod opens a spot for you.',
  }[key];
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  profileTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
  },
  buttonStack: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clubIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(199, 59, 34, 0.10)',
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
