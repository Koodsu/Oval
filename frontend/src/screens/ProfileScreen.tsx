import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getApiErrorMessage, getFriends, getMyClubs } from '../api';
import { RootStackParamList } from '../../App';
import { FriendUser, MyClubMembershipRow } from '../types';
import {
  Chip,
  EmptyState,
  Entrance,
  Panel,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SectionHeader,
  Tap,
  UserAvatar,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { INTEREST_TAG_META } from '../constants/interestTags';
import { Theme, createThemedStyles, radii, spacing, useTheme } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function ActionRow({
  icon,
  label,
  onPress,
  tone = 'default',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = tone === 'danger' ? colors.danger : colors.ink;
  return (
    <Tap onPress={onPress} style={styles.actionRow} accessibilityLabel={label}>
      <View style={[styles.actionIcon, tone === 'danger' && styles.actionIconDanger]}>
        <Ionicons name={icon} size={18} color={tone === 'danger' ? colors.danger : colors.primary} />
      </View>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.faint} />
    </Tap>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles();
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

        <Entrance index={0}>
          <Panel style={styles.identityPanel}>
            <UserAvatar name={user?.name ?? 'User'} avatarUrl={user?.avatarUrl} size={84} ring />
            <Text style={styles.identityName}>{user?.name ?? 'Your profile'}</Text>
            <Text style={styles.identityMeta}>
              {user?.major ?? 'Major not set'} • Class of {user?.classYear ?? 'TBD'}
            </Text>
            <Text style={styles.identityEmail}>{user?.email}</Text>
            {user?.bio ? <Text style={styles.identityBio}>{user.bio}</Text> : null}
            {user?.interestTags?.length ? (
              <View style={styles.tagRow}>
                {user.interestTags.slice(0, 3).map((tag) => (
                  <Chip key={tag} label={INTEREST_TAG_META[tag]?.label ?? tag} active />
                ))}
              </View>
            ) : null}
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{friends.length}</Text>
                <Text style={styles.statLabel}>Friends</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{myClubs.length}</Text>
                <Text style={styles.statLabel}>Clubs</Text>
              </View>
            </View>
            <View style={styles.editAction}>
              <PrimaryButton label="Edit profile" icon="create-outline" onPress={() => navigation.navigate('EditProfile')} />
            </View>
          </Panel>
        </Entrance>

        <Entrance index={1}>
          <Panel style={styles.actionPanel}>
            <ActionRow icon="search-outline" label="Find people" onPress={() => navigation.navigate('UserSearch')} />
            <View style={styles.actionDivider} />
            <ActionRow icon="settings-outline" label="Settings" onPress={() => navigation.navigate('Settings')} />
            <View style={styles.actionDivider} />
            <ActionRow icon="log-out-outline" label="Sign out" tone="danger" onPress={() => void signOut()} />
          </Panel>
        </Entrance>

        <Entrance index={2} style={styles.section}>
          <SectionHeader title="My clubs" />
          {myClubs.length ? myClubs.slice(0, showAllClubs ? myClubs.length : 6).map((membership) => (
            <Tap
              key={membership.club.id}
              onPress={() => navigation.navigate('ClubDetail', { clubId: membership.club.id })}
              style={styles.rowCard}
              accessibilityLabel={membership.club.name}
            >
              <View style={styles.clubIcon}>
                <Ionicons name="people-outline" size={20} color={colors.violet} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.title}>{membership.club.name}</Text>
                <Text style={styles.body} numberOfLines={1}>
                  {membership.club.memberCount} {membership.club.memberCount === 1 ? 'member' : 'members'}
                  {membership.nextMeeting ? ` • Next: ${membership.nextMeeting.title}` : ' • No upcoming meeting'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </Tap>
          )) : <Panel><Text style={styles.body}>You have not joined any clubs yet.</Text></Panel>}
          {myClubs.length > 6 ? (
            <PrimaryButton label={showAllClubs ? 'Show fewer clubs' : `See all ${myClubs.length} clubs`} onPress={() => setShowAllClubs((value) => !value)} kind="ghost" />
          ) : null}
        </Entrance>

        <Entrance index={3} style={styles.section}>
          <SectionHeader title="Friends" />
          {friends.length ? friends.slice(0, showAllFriends ? friends.length : 6).map((friend) => (
            <Tap
              key={friend.id}
              onPress={() => navigation.navigate('UserProfile', { userId: friend.id })}
              style={styles.rowCard}
              accessibilityLabel={friend.name}
            >
              <UserAvatar name={friend.name} avatarUrl={friend.avatarUrl} size={44} />
              <Text style={[styles.title, styles.rowCopy]}>{friend.name}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </Tap>
          )) : <EmptyState icon="people-outline" title="No friends yet" body="People you connect with after pods will show up here." />}
          {friends.length > 6 ? (
            <PrimaryButton label={showAllFriends ? 'Show fewer friends' : `See all ${friends.length} friends`} onPress={() => setShowAllFriends((value) => !value)} kind="ghost" />
          ) : null}
        </Entrance>

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
  identityPanel: {
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: spacing.lg,
  },
  identityName: {
    ...t.typography.h1,
    marginTop: spacing.xs,
    textAlign: 'center' as const,
  },
  identityMeta: {
    ...t.typography.bodyStrong,
    color: t.colors.sub,
    textAlign: 'center' as const,
  },
  identityEmail: {
    ...t.typography.caption,
    textAlign: 'center' as const,
  },
  identityBio: {
    ...t.typography.body,
    textAlign: 'center' as const,
    marginTop: 4,
    maxWidth: 300,
  },
  tagRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
    marginTop: spacing.sm,
    rowGap: spacing.xs,
  },
  statRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  stat: {
    alignItems: 'center' as const,
    minWidth: 70,
  },
  statValue: {
    ...t.typography.h2,
  },
  statLabel: {
    ...t.typography.caption,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: t.colors.border,
  },
  editAction: {
    alignSelf: 'stretch' as const,
    marginTop: spacing.md,
  },
  actionPanel: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingVertical: 13,
    paddingHorizontal: spacing.sm,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.primarySoft,
  },
  actionIconDanger: {
    backgroundColor: t.colors.dangerBg,
  },
  actionLabel: {
    ...t.typography.bodyStrong,
    flex: 1,
  },
  actionDivider: {
    height: 1,
    backgroundColor: t.colors.border,
    marginLeft: 56,
  },
  section: {
    gap: spacing.sm,
  },
  rowCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    ...t.shadows.subtle,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...t.typography.title,
  },
  body: {
    ...t.typography.body,
  },
  clubIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.violetSoft,
  },
}));
