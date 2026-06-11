import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiErrorMessage, getFriends, getMyClubs } from '../api';
import { RootStackParamList } from '../../App';
import { FriendUser, MyClubMembershipRow } from '../types';
import {
  AppBackdrop,
  Avatar,
  Button,
  Card,
  EmptyState,
  ListRow,
  ScreenHeader,
  SectionHeader,
  Slab,
  Tag,
  accentForSeed,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { INTEREST_TAG_META } from '../constants/interestTags';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  fonts,
  radii,
  spacing,
  useTheme,
} from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user, signOut } = useAuth();
  const { colors, typography } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [myClubs, setMyClubs] = useState<MyClubMembershipRow[]>([]);
  const [showAllClubs, setShowAllClubs] = useState(false);
  const [showAllFriends, setShowAllFriends] = useState(false);

  const load = useCallback(async () => {
    try {
      const [friendList, clubRows] = await Promise.all([getFriends(), getMyClubs()]);
      setFriends(friendList);
      setMyClubs(clubRows);
    } catch (error) {
      Alert.alert('Could not load profile', getApiErrorMessage(error));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <ScreenHeader title="Profile" kicker="YOU" onBack={() => navigation.goBack()} />

        {/* Identity card */}
        <Card padded>
          <View style={styles.identity}>
            <Avatar name={user?.name ?? 'User'} uri={user?.avatarUrl} size={84} tilt={-3} />
            <Text style={styles.identityName}>{user?.name ?? 'Your profile'}</Text>
            <Text style={typography.subheading}>
              {user?.major ?? 'Major not set'} • Class of {user?.classYear ?? 'TBD'}
            </Text>
            <Text style={typography.captionSmall}>{user?.email}</Text>
            {user?.bio ? (
              <Text style={[typography.body, styles.identityBio]}>{user.bio}</Text>
            ) : null}
            {user?.interestTags?.length ? (
              <View style={styles.tagRow}>
                {user.interestTags.slice(0, 3).map((tag) => (
                  <Tag
                    key={tag}
                    label={INTEREST_TAG_META[tag]?.label ?? tag}
                    tint={accentForSeed(colors, tag).soft}
                  />
                ))}
              </View>
            ) : null}
            <View style={[styles.statStrip, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{friends.length}</Text>
                <Text style={styles.statLabel}>FRIENDS</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.borderSoft }]} />
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{myClubs.length}</Text>
                <Text style={styles.statLabel}>CLUBS</Text>
              </View>
            </View>
            <Button
              label="Edit profile"
              icon="create"
              onPress={() => navigation.navigate('EditProfile')}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </Card>

        {/* Actions */}
        <Card padded={false} faceStyle={{ paddingHorizontal: spacing.lg }}>
          <ListRow
            icon="search"
            title="Find people"
            tint={colors.tealSoft}
            onPress={() => navigation.navigate('UserSearch')}
          />
          <ListRow
            icon="settings"
            title="Settings"
            tint={colors.violetSoft}
            onPress={() => navigation.navigate('Settings')}
          />
          <ListRow
            icon="log-out"
            title="Sign out"
            destructive
            last
            onPress={() => void signOut()}
          />
        </Card>

        {/* Clubs */}
        <View style={styles.section}>
          <SectionHeader kicker="Your orgs" title="My clubs" />
          {myClubs.length ? (
            myClubs.slice(0, showAllClubs ? myClubs.length : 6).map((membership) => {
              const accent = accentForSeed(colors, membership.club.name);
              return (
                <Slab
                  key={membership.club.id}
                  onPress={() => navigation.navigate('ClubDetail', { clubId: membership.club.id })}
                  faceStyle={styles.rowFace}
                  accessibilityLabel={membership.club.name}
                >
                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: accent.soft, borderColor: colors.border },
                    ]}
                  >
                    <Ionicons name="megaphone" size={17} color={accent.tint} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={typography.heading} numberOfLines={1}>
                      {membership.club.name}
                    </Text>
                    <Text style={typography.captionSmall} numberOfLines={1}>
                      {membership.club.memberCount}{' '}
                      {membership.club.memberCount === 1 ? 'member' : 'members'}
                      {membership.nextMeeting
                        ? ` • Next: ${membership.nextMeeting.title}`
                        : ' • No upcoming meeting'}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={colors.faint} />
                </Slab>
              );
            })
          ) : (
            <Card padded>
              <Text style={typography.body}>You have not joined any clubs yet.</Text>
            </Card>
          )}
          {myClubs.length > 6 ? (
            <Button
              label={showAllClubs ? 'Show fewer clubs' : `See all ${myClubs.length} clubs`}
              variant="secondary"
              onPress={() => setShowAllClubs((value) => !value)}
            />
          ) : null}
        </View>

        {/* Friends */}
        <View style={styles.section}>
          <SectionHeader kicker="Your people" title="Friends" />
          {friends.length ? (
            friends.slice(0, showAllFriends ? friends.length : 6).map((friend, index) => (
              <Slab
                key={friend.id}
                onPress={() => navigation.navigate('UserProfile', { userId: friend.id })}
                faceStyle={styles.rowFace}
                accessibilityLabel={friend.name}
              >
                <Avatar
                  name={friend.name}
                  uri={friend.avatarUrl}
                  size={44}
                  tilt={index % 2 === 0 ? -2 : 2}
                />
                <Text style={[typography.heading, { flex: 1 }]} numberOfLines={1}>
                  {friend.name}
                </Text>
                <Ionicons name="arrow-forward" size={16} color={colors.faint} />
              </Slab>
            ))
          ) : (
            <EmptyState
              icon="people"
              title="No friends yet"
              body="People you connect with after pods will show up here."
            />
          )}
          {friends.length > 6 ? (
            <Button
              label={showAllFriends ? 'Show fewer friends' : `See all ${friends.length} friends`}
              variant="secondary"
              onPress={() => setShowAllFriends((value) => !value)}
            />
          ) : null}
        </View>
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  identity: {
    alignItems: 'center' as const,
    gap: 6,
  },
  identityName: {
    fontFamily: fonts.display,
    fontSize: 23,
    lineHeight: 29,
    letterSpacing: -0.5,
    color: t.colors.ink,
    marginTop: spacing.sm,
    textAlign: 'center' as const,
  },
  identityBio: {
    textAlign: 'center' as const,
    marginTop: 4,
    maxWidth: 300,
    color: t.colors.sub,
  },
  tagRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statStrip: {
    flexDirection: 'row' as const,
    alignSelf: 'stretch' as const,
    alignItems: 'center' as const,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  statCell: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.displayMedium,
    fontSize: 20,
    color: t.colors.ink,
  },
  statLabel: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: t.colors.sub,
  },
  statDivider: {
    width: 2,
    height: 30,
  },
  section: {
    gap: spacing.md,
  },
  rowFace: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    padding: spacing.md,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    transform: [{ rotate: '-2deg' }],
  },
}));
