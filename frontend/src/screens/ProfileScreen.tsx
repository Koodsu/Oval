import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getApiErrorMessage, getFriends, getMyClubs } from '../api';
import { RootStackParamList } from '../../App';
import { FriendUser, MyClubMembershipRow } from '../types';
import { Chip, CompactHeader, EmptyState, Panel, PrimaryButton, Screen, ScreenHeader, SectionHeader, UserAvatar } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { INTEREST_TAG_META } from '../constants/interestTags';
import { palette, spacing, typography } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user, signOut } = useAuth();
	  const [friends, setFriends] = useState<FriendUser[]>([]);
	  const [myClubs, setMyClubs] = useState<MyClubMembershipRow[]>([]);
	  const [showAllClubs, setShowAllClubs] = useState(false);
	  const [showAllFriends, setShowAllFriends] = useState(false);

  const load = useCallback(async () => {
    try {
      const [friendList, clubRows] = await Promise.all([
        getFriends(),
        getMyClubs(),
      ]);
      setFriends(friendList);
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
	            <PrimaryButton label="Settings" onPress={() => navigation.navigate('Settings')} kind="ghost" />
	            <PrimaryButton label="Sign out" onPress={() => void signOut()} kind="ghost" />
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
                      {membership.club.memberCount} {membership.club.memberCount === 1 ? 'member' : 'members'}
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

	      </ScrollView>
	    </Screen>
  );
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
});
