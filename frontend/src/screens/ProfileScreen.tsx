import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { API_USER_MESSAGE, getFriends, getMyClubs, getNotificationPreferences, updateNotificationPreferences } from '../api';
import { RootStackParamList } from '../../App';
import { NotificationPreferences } from '../api';
import { FriendUser, MyClubMembershipRow } from '../types';
import { Chip, CompactHeader, EmptyState, Panel, PrimaryButton, Screen, SectionHeader, UserAvatar } from '../components/ui';
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
  const { user, signOut } = useAuth();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [myClubs, setMyClubs] = useState<MyClubMembershipRow[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

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
    } catch {
      Alert.alert('Could not load profile', API_USER_MESSAGE);
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
    } catch {
      setPrefs(prefs);
      Alert.alert('Could not update settings', API_USER_MESSAGE);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
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
          </View>
        </Panel>

        <View style={styles.section}>
          <SectionHeader title="My clubs" />
          {myClubs.length ? myClubs.slice(0, 6).map((membership) => (
            <TouchableOpacity key={membership.club.id} onPress={() => navigation.navigate('ClubDetail', { clubId: membership.club.id })}>
              <Panel>
                <View style={styles.friendRow}>
                  <Text style={styles.clubEmoji}>{membership.club.emoji}</Text>
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
        </View>

        <View style={styles.section}>
          <SectionHeader title="Friends" />
          {friends.length ? friends.slice(0, 6).map((friend) => (
            <TouchableOpacity key={friend.id} onPress={() => navigation.navigate('UserProfile', { userId: friend.id })}>
              <Panel>
                <View style={styles.friendRow}>
                  <UserAvatar name={friend.name} avatarUrl={friend.avatarUrl} />
                  <Text style={styles.title}>{friend.name}</Text>
                </View>
              </Panel>
            </TouchableOpacity>
          )) : <EmptyState icon="people-outline" title="No friends yet" body="People you connect with after pods will show up here." />}
        </View>

        {prefs ? (
          <View style={styles.section}>
            <SectionHeader title="Notifications" />
            {Object.entries(prefs).map(([key, value]) => (
              <Panel key={key}>
                <View style={styles.prefRow}>
                  <View style={styles.profileCopy}>
                    <Text style={styles.title}>{labelForPref(key as keyof NotificationPreferences)}</Text>
                    <Text style={styles.body}>Fine-tune the pace of the app instead of accepting generic defaults.</Text>
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

const styles = StyleSheet.create({
  content: {
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
  clubEmoji: {
    fontSize: 26,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
