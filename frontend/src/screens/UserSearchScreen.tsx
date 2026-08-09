import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, Text, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSharedStateVersion } from '../context/SharedStateInvalidationContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  discoverUsers,
  getApiErrorMessage,
  getFriendRequests,
  getFriends,
  searchUsers,
  sendFriendRequest,
} from '../api';
import { RootStackParamList } from '../../App';
import { FriendRequest, FriendUser } from '../types';
import {
  AppBackdrop,
  Avatar,
  Banner,
  Button,
  Card,
  EmptyState,
  ScreenHeader,
  SearchBar,
  Segmented,
  SkeletonCard,
  Slab,
  Tag,
} from '../components/ui';
import { Theme, createThemedStyles, spacing, useTheme } from '../theme';
import { toast } from '../lib/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'UserSearch'>;
type PeopleTab = 'discover' | 'friends' | 'requests';
type RecentPerson = Pick<FriendUser, 'id' | 'name' | 'avatarUrl'>;
type PreviewData = {
  suggestions?: FriendUser[];
  friends?: FriendUser[];
  incoming?: FriendRequest[];
  outgoing?: FriendRequest[];
  recent?: RecentPerson[];
};

const RECENT_PEOPLE_KEY = 'oval.people.recent';

export default function UserSearchScreen({
  navigation,
  previewData,
}: Props & { previewData?: PreviewData }) {
  const sharedStateVersion = useSharedStateVersion('users', 'friends');
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  const [tab, setTab] = useState<PeopleTab>('discover');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendUser[]>([]);
  const [suggestions, setSuggestions] = useState<FriendUser[]>(previewData?.suggestions ?? []);
  const [friends, setFriends] = useState<FriendUser[]>(previewData?.friends ?? []);
  const [incoming, setIncoming] = useState<FriendRequest[]>(previewData?.incoming ?? []);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>(previewData?.outgoing ?? []);
  const [recent, setRecent] = useState<RecentPerson[]>(previewData?.recent ?? []);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [sentUserIds, setSentUserIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(!previewData);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (previewData) return;
    setLoading(true);
    try {
      const [nextSuggestions, nextFriends, nextRequests, storedRecent] = await Promise.all([
        // Suggestions are supplemental. Older production API versions route
        // /users/discover through /users/:id and respond "User not found";
        // that should not turn a usable people screen into an error state.
        discoverUsers().catch(() => []),
        getFriends(),
        getFriendRequests(),
        AsyncStorage.getItem(RECENT_PEOPLE_KEY),
      ]);
      setSuggestions(nextSuggestions);
      setFriends(nextFriends);
      setIncoming(nextRequests.incoming);
      setOutgoing(nextRequests.outgoing);
      setRecent(storedRecent ? (JSON.parse(storedRecent) as RecentPerson[]).slice(0, 5) : []);
      setWarning(null);
    } catch (error) {
      setWarning(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [previewData]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, sharedStateVersion]),
  );

  useEffect(() => {
    let cancelled = false;
    const trimmed = query.trim();
    if (previewData || !trimmed) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      searchUsers(trimmed)
        .then((users) => {
          if (!cancelled) setResults(users);
        })
        .catch((error) => {
          if (!cancelled) toast.error('Could not search students', getApiErrorMessage(error));
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [previewData, query]);

  const filteredFriends = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return friends;
    return friends.filter((friend) => friend.name.toLowerCase().includes(needle));
  }, [friends, query]);

  const openProfile = async (person: RecentPerson) => {
    const next = [person, ...recent.filter((item) => item.id !== person.id)].slice(0, 5);
    setRecent(next);
    await AsyncStorage.setItem(RECENT_PEOPLE_KEY, JSON.stringify(next)).catch(() => {});
    navigation.navigate('UserProfile', { userId: person.id });
  };

  const removeRecent = async (userId: string) => {
    const next = recent.filter((item) => item.id !== userId);
    setRecent(next);
    await AsyncStorage.setItem(RECENT_PEOPLE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const handleAdd = async (userId: string) => {
    setBusyUserId(userId);
    try {
      await sendFriendRequest(userId);
      setSentUserIds((current) => new Set(current).add(userId));
      setSuggestions((current) => current.filter((person) => person.id !== userId));
      toast.success('Request sent', 'They’ll see it in their inbox.');
    } catch (error) {
      toast.error('Could not send request', getApiErrorMessage(error));
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRequest = async (
    request: FriendRequest,
    action: 'accept' | 'decline' | 'cancel',
  ) => {
    setBusyUserId(request.id);
    try {
      if (action === 'accept') await acceptFriendRequest(request.id);
      if (action === 'decline') await declineFriendRequest(request.id);
      if (action === 'cancel') await cancelFriendRequest(request.id);
      await load();
    } catch (error) {
      toast.error('Could not update request', getApiErrorMessage(error));
    } finally {
      setBusyUserId(null);
    }
  };

  const shareOval = async () => {
    try {
      await Share.share({
        title: 'Join me on Oval',
        message: 'Find your people and make a plan on Oval.',
        url: 'https://www.theovalapp.com',
      });
    } catch (error) {
      toast.error('Could not open share sheet', getApiErrorMessage(error));
    }
  };

  const renderPerson = (person: FriendUser, action: 'add' | 'view' = 'add') => (
    <Card key={person.id} padded={false}>
      <View style={[styles.personRow, accessibilityLayout && styles.personRowLargeText]}>
        <Pressable
          style={styles.personIdentity}
          onPress={() => void openProfile(person)}
          accessibilityRole="button"
          accessibilityLabel={`View ${person.name}'s profile`}
        >
          <Avatar name={person.name} uri={person.avatarUrl} size={48} />
          <View style={styles.personCopy}>
            <Text
              style={typography.heading}
              numberOfLines={accessibilityLayout ? undefined : 1}
              maxFontSizeMultiplier={2}
            >
              {person.name}
            </Text>
            <Text
              style={typography.captionSmall}
              numberOfLines={accessibilityLayout ? undefined : 1}
              maxFontSizeMultiplier={2}
            >
              {[person.major, person.classYear].filter(Boolean).join(' · ') ||
                (person.verifiedUniversity ? 'Verified Ohio State student' : 'Student')}
            </Text>
            {person.mutualFriendCount ? (
              <Text
                style={[typography.captionSmall, { color: colors.sub }]}
                maxFontSizeMultiplier={2}
              >
                {person.mutualFriendCount} mutual{' '}
                {person.mutualFriendCount === 1 ? 'friend' : 'friends'}
              </Text>
            ) : person.sharedInterests?.length ? (
              <View style={styles.inlineTags}>
                {person.sharedInterests.slice(0, 2).map((interest) => (
                  <Tag key={interest} label={interest} />
                ))}
              </View>
            ) : null}
          </View>
        </Pressable>
        <Button
          label={action === 'view' ? 'View' : sentUserIds.has(person.id) ? 'Sent' : 'Add'}
          size="sm"
          variant="secondary"
          onPress={
            action === 'view'
              ? () => void openProfile(person)
              : () => void handleAdd(person.id)
          }
          loading={busyUserId === person.id}
          disabled={sentUserIds.has(person.id)}
          style={accessibilityLayout && styles.fullWidthAction}
        />
      </View>
    </Card>
  );

  const requestRows = [...incoming, ...outgoing];
  const hasQuery = query.trim().length > 0;

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
        <ScreenHeader title="Find people" onBack={() => navigation.goBack()} />
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder="Search students"
        />
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'discover', label: 'Discover' },
            { value: 'friends', label: 'Friends' },
            { value: 'requests', label: `Requests${incoming.length ? ` (${incoming.length})` : ''}` },
          ]}
        />

        {warning ? <Banner message={warning} kind="error" /> : null}
        {loading ? (
          <>
            <SkeletonCard compact />
            <SkeletonCard compact />
            <SkeletonCard compact />
          </>
        ) : hasQuery ? (
          results.length ? (
            <View style={styles.section}>
              <Text style={typography.kicker} maxFontSizeMultiplier={2}>
                SEARCH RESULTS
              </Text>
              {results.map((person) =>
                renderPerson(
                  person,
                  friends.some((friend) => friend.id === person.id) ? 'view' : 'add',
                ),
              )}
            </View>
          ) : (
            <>
              <EmptyState
                icon="person-outline"
                title="No students found"
                body="Check the spelling or try another name."
              />
              <InviteCard onPress={() => void shareOval()} />
            </>
          )
        ) : tab === 'discover' ? (
          <>
            {suggestions.length ? (
              <View style={styles.section}>
                <Text style={typography.kicker} maxFontSizeMultiplier={2}>
                  SUGGESTED FOR YOU
                </Text>
                {suggestions.map((person) => renderPerson(person))}
              </View>
            ) : (
              <EmptyState
                icon="people-outline"
                title="No suggestions right now"
                body="Try searching for someone you met in class, a pod, or a club."
              />
            )}
            {recent.length ? (
              <View style={styles.section}>
                <Text style={typography.kicker} maxFontSizeMultiplier={2}>
                  RECENT SEARCHES
                </Text>
                <Card padded={false}>
                  {recent.map((person) => (
                    <View key={person.id} style={styles.recentRow}>
                      <Pressable
                        style={styles.recentIdentity}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${person.name}'s profile`}
                        onPress={() => void openProfile(person)}
                      >
                        <Avatar name={person.name} uri={person.avatarUrl} size={34} />
                        <Text
                          style={[typography.subheading, { flex: 1 }]}
                          maxFontSizeMultiplier={2}
                        >
                          {person.name}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void removeRecent(person.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${person.name} from recent searches`}
                        hitSlop={10}
                      >
                        <Text
                          style={[typography.caption, { color: colors.sub }]}
                          maxFontSizeMultiplier={2}
                        >
                          ×
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </Card>
              </View>
            ) : null}
            <InviteCard onPress={() => void shareOval()} />
          </>
        ) : tab === 'friends' ? (
          filteredFriends.length ? (
            <View style={styles.section}>
              <Text style={typography.kicker} maxFontSizeMultiplier={2}>
                YOUR FRIENDS
              </Text>
              {filteredFriends.map((person) => renderPerson(person, 'view'))}
            </View>
          ) : (
            <EmptyState
              icon="people-outline"
              title="No friends here yet"
              body="Discover students or search for someone you already know."
              actionLabel="Discover people"
              onAction={() => setTab('discover')}
            />
          )
        ) : requestRows.length ? (
          <View style={styles.section}>
            {incoming.length ? (
              <Text style={typography.kicker} maxFontSizeMultiplier={2}>
                INCOMING
              </Text>
            ) : null}
            {incoming.map((request) => (
              <RequestRow
                key={request.id}
                person={request.sender}
                busy={busyUserId === request.id}
                primaryLabel="Accept"
                onPrimary={() => void handleRequest(request, 'accept')}
                secondaryLabel="Decline"
                onSecondary={() => void handleRequest(request, 'decline')}
                onOpen={(person) => void openProfile(person)}
              />
            ))}
            {outgoing.length ? (
              <Text style={typography.kicker} maxFontSizeMultiplier={2}>
                SENT
              </Text>
            ) : null}
            {outgoing.map((request) => (
              <RequestRow
                key={request.id}
                person={request.receiver}
                busy={busyUserId === request.id}
                primaryLabel="Cancel"
                onPrimary={() => void handleRequest(request, 'cancel')}
                onOpen={(person) => void openProfile(person)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="mail-open-outline"
            title="No friend requests"
            body="Incoming and sent requests will appear here."
          />
        )}
      </ScrollView>
    </AppBackdrop>
  );
}

function InviteCard({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  return (
    <Slab
      onPress={onPress}
      faceStyle={[styles.inviteCard, accessibilityLayout && styles.inviteCardLargeText]}
      accessibilityLabel="Invite someone to Oval"
    >
      <View style={[styles.inviteIcon, { backgroundColor: colors.primarySoft }]}>
        <Text style={{ color: colors.accentText, fontSize: 24 }}>↗</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={typography.subheading} maxFontSizeMultiplier={2}>
          Invite someone to Oval
        </Text>
        <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
          Share a link with a friend.
        </Text>
      </View>
      <Text style={[typography.heading, { color: colors.accentText }]} maxFontSizeMultiplier={2}>
        Share
      </Text>
    </Slab>
  );
}

function RequestRow({
  person,
  busy,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  onOpen,
}: {
  person?: FriendUser;
  busy: boolean;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  onOpen: (person: FriendUser) => void;
}) {
  const styles = useStyles();
  const { typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  if (!person) return null;
  return (
    <Card padded>
      <View style={styles.requestRow}>
        <Pressable
          style={styles.recentIdentity}
          onPress={() => onOpen(person)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${person.name}'s profile`}
        >
          <Avatar name={person.name} uri={person.avatarUrl} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={typography.heading} maxFontSizeMultiplier={2}>
              {person.name}
            </Text>
            <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
              {[person.major, person.classYear].filter(Boolean).join(' · ') || 'Ohio State student'}
            </Text>
          </View>
        </Pressable>
        <View style={[styles.requestActions, accessibilityLayout && styles.requestActionsLargeText]}>
          <Button
            label={primaryLabel}
            size="sm"
            onPress={onPrimary}
            loading={busy}
            style={accessibilityLayout && styles.fullWidthAction}
          />
          {secondaryLabel && onSecondary ? (
            <Button
              label={secondaryLabel}
              size="sm"
              variant="ghost"
              onPress={onSecondary}
              style={accessibilityLayout && styles.fullWidthAction}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const useStyles = createThemedStyles((_t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  personRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    padding: spacing.md,
  },
  personRowLargeText: {
    alignItems: 'stretch' as const,
    flexDirection: 'column' as const,
  },
  fullWidthAction: {
    alignSelf: 'stretch' as const,
  },
  personIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  personCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  inlineTags: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  inviteCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    padding: spacing.md,
  },
  inviteCardLargeText: {
    alignItems: 'flex-start' as const,
    flexDirection: 'column' as const,
  },
  inviteIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  recentRow: {
    minHeight: 54,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  recentIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  requestRow: {
    gap: spacing.md,
  },
  requestActions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  requestActionsLargeText: {
    flexDirection: 'column' as const,
  },
}));
