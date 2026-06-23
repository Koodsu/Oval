import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getApiErrorMessage,
  getClubs,
  getClubsToday,
  getMyClubs,
  joinClub,
} from '../../api';
import type { ClubDirectoryEntry, ClubMeetingToday, MyClubMembershipRow } from '../../types';
import type { RootStackParamList } from '../../../App';
import {
  AppBackdrop,
  Banner,
  Chip,
  ClubMark,
  CountBubble,
  EmptyState,
  IconButton,
  SearchBar,
  SectionHeader,
  SkeletonCard,
  Slab,
  Sticker,
} from '../../components/ui';
import { ClubRow, SegmentedControl } from '../../components/clubs';
import { CLUB_CATEGORIES, clubCategoryMatches } from '../../constants/clubCategories';
import { clubCategoryVisual } from '../../constants/clubVisuals';
import {
  DOCK_CLEARANCE,
  Theme,
  createThemedStyles,
  fonts,
  motion,
  spacing,
  useTheme,
} from '../../theme';
import { formatTime } from '../../utils/format';
import Animated, { FadeInDown } from 'react-native-reanimated';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Segment = 'mine' | 'discover';

function meetingSignal(club: ClubDirectoryEntry, meeting?: ClubMeetingToday) {
  if (meeting) return `tonight ${formatTime(meeting.meetingTime)}`;
  if (club.upcomingMeetingCount) {
    return `${club.upcomingMeetingCount} upcoming meeting${club.upcomingMeetingCount === 1 ? '' : 's'}`;
  }
  return 'schedule pending';
}

function myClubSignal(row: MyClubMembershipRow) {
  if (!row.nextMeeting) return 'No upcoming meeting';
  const meetingDate = new Date(row.nextMeeting.meetingTime);
  const today = new Date();
  return meetingDate.toDateString() === today.toDateString()
    ? `Meets tonight ${formatTime(row.nextMeeting.meetingTime)}`
    : `Next ${meetingDate.toLocaleDateString([], { weekday: 'short' })} · ${formatTime(row.nextMeeting.meetingTime)}`;
}

export default function ClubsHomeScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [clubs, setClubs] = useState<ClubDirectoryEntry[]>([]);
  const [myClubs, setMyClubs] = useState<MyClubMembershipRow[]>([]);
  const [meetings, setMeetings] = useState<ClubMeetingToday[]>([]);
  const [segment, setSegment] = useState<Segment>('mine');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const load = useCallback(async () => {
    try {
      const [directory, memberships, tonight] = await Promise.all([
        getClubs(),
        getMyClubs(),
        getClubsToday(),
      ]);
      setClubs(directory);
      setMyClubs(memberships);
      setMeetings(tonight);
      setWarning(null);
      // New users land on Discover; members land on their clubs.
      setSegment((current) => (memberships.length === 0 ? 'discover' : current));
    } catch {
      setWarning("Couldn't refresh clubs. Pull to try again.");
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const membershipIds = useMemo(() => new Set(myClubs.map((row) => row.club.id)), [myClubs]);
  const tonightByClub = useMemo(
    () => new Map(meetings.map((meeting) => [meeting.clubId, meeting])),
    [meetings],
  );

  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const discover = useMemo(() => {
    return clubs
      .filter((club) => !membershipIds.has(club.id))
      .filter((club) => clubCategoryMatches(club.category, filter))
      .filter((club) =>
        !normalizedQuery ||
        [club.name, club.description, club.category].join(' ').toLowerCase().includes(normalizedQuery),
      )
      .sort((a, b) => b.memberCount - a.memberCount);
  }, [clubs, normalizedQuery, filter, membershipIds]);

  const mine = useMemo(() => {
    return myClubs.filter(
      (row) =>
        !normalizedQuery ||
        [row.club.name, row.club.category].join(' ').toLowerCase().includes(normalizedQuery),
    );
  }, [myClubs, normalizedQuery]);

  const totalUnread = useMemo(
    () => myClubs.reduce((sum, row) => sum + (row.unreadCount ?? 0), 0),
    [myClubs],
  );

  const handleJoin = async (club: ClubDirectoryEntry) => {
    setJoiningId(club.id);
    try {
      await joinClub(club.id);
      await load();
    } catch (error) {
      Alert.alert('Could not join club', getApiErrorMessage(error));
    } finally {
      setJoiningId(null);
    }
  };

  const openClub = (clubId: string) => navigation.navigate('ClubDetail', { clubId });

  const listData: ClubDirectoryEntry[] = loaded && segment === 'discover' ? discover : [];

  return (
    <AppBackdrop>
      <FlatList
        data={listData}
        keyExtractor={(club) => club.id}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: DOCK_CLEARANCE },
        ]}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.masthead}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.kicker, { color: colors.primary }]}>CAMPUS ORGS</Text>
                <Text style={styles.title}>Clubs</Text>
                {loaded ? (
                  <Text style={typography.caption}>
                    {clubs.length} org{clubs.length === 1 ? '' : 's'}
                    {meetings.length ? ` · ${meetings.length} meeting${meetings.length === 1 ? '' : 's'} tonight` : ''}
                  </Text>
                ) : null}
              </View>
              <IconButton
                icon="add"
                size={48}
                color={colors.primary}
                iconColor={colors.onPrimary}
                onPress={() => void Linking.openURL('https://www.theovalapp.com/clubs')}
                accessibilityLabel="List your club"
              />
            </View>
            {warning ? <Banner message={warning} kind="info" /> : null}

            {!loaded ? (
              <>
                <SkeletonCard compact />
                <SkeletonCard />
              </>
            ) : (
              <>
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder={segment === 'mine' ? 'Search your clubs' : 'Search clubs and communities'}
                />
                <SegmentedControl<Segment>
                  value={segment}
                  options={[
                    { value: 'mine', label: `My clubs · ${myClubs.length}` },
                    { value: 'discover', label: 'Discover' },
                  ]}
                  onChange={setSegment}
                />

                {meetings.length ? (
                  <View style={styles.section}>
                    <SectionHeader
                      title="Tonight"
                      actionLabel="See all"
                      onAction={() => navigation.navigate('ClubMeetingsTonight')}
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.rail}>
                        {meetings.slice(0, 6).map((meeting, index) => (
                          <Slab
                            key={meeting.id}
                            onPress={() =>
                              navigation.navigate('ClubMeeting', {
                                clubId: meeting.clubId,
                                meetingId: meeting.id,
                              })
                            }
                            tilt={index % 2 ? 0.7 : -0.7}
                            style={styles.tonight}
                            faceStyle={styles.tonightFace}
                          >
                            <Sticker
                              label={formatTime(meeting.meetingTime)}
                              tint={colors.successSoft}
                              small
                              tilt={-2}
                            />
                            <Text style={typography.subheading} numberOfLines={1}>{meeting.clubName}</Text>
                            <Text style={typography.captionSmall} numberOfLines={1}>{meeting.location}</Text>
                          </Slab>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                ) : null}

                {segment === 'mine' ? (
                  <View style={styles.section}>
                    {totalUnread > 0 ? (
                      <Text style={typography.caption}>
                        {totalUnread} unread message{totalUnread === 1 ? '' : 's'} across your clubs
                      </Text>
                    ) : null}
                    {mine.map((row, index) => (
                      <Animated.View
                        key={row.club.id}
                        entering={FadeInDown.delay(Math.min(index, 6) * motion.stagger).duration(motion.durBase)}
                      >
                        <Slab
                          onPress={() => openClub(row.club.id)}
                          raised={false}
                          faceStyle={styles.myClub}
                          accessibilityLabel={`Open ${row.club.name}`}
                        >
                          <ClubMark
                            name={row.club.name}
                            emoji={row.club.emoji}
                            uri={row.club.avatarUrl}
                            size={42}
                          />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={typography.subheading} numberOfLines={1}>{row.club.name}</Text>
                            <Text style={typography.captionSmall} numberOfLines={1}>{myClubSignal(row)}</Text>
                          </View>
                          {row.unreadCount ? <CountBubble count={row.unreadCount} /> : null}
                          <Text style={[styles.chevron, { color: colors.faint }]}>›</Text>
                        </Slab>
                      </Animated.View>
                    ))}
                    {mine.length === 0 ? (
                      <EmptyState
                        icon="people-outline"
                        title={normalizedQuery ? 'No clubs match' : 'No clubs yet'}
                        body={
                          normalizedQuery
                            ? 'Try a different search.'
                            : 'Join a club from Discover and it will live here.'
                        }
                        actionLabel={normalizedQuery ? 'Clear search' : 'Browse clubs'}
                        onAction={() => {
                          if (normalizedQuery) {
                            setQuery('');
                          } else {
                            setSegment('discover');
                          }
                        }}
                      />
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.section}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.chips}>
                        <Chip label="All" icon="apps" selected={!filter} onPress={() => setFilter(null)} />
                        {CLUB_CATEGORIES.map((category) => (
                          <Chip
                            key={category}
                            label={category}
                            icon={clubCategoryVisual(category).icon}
                            selected={filter === category}
                            onPress={() => setFilter(filter === category ? null : category)}
                          />
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}
              </>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.delay(Math.min(index, 6) * motion.stagger).duration(motion.durBase)}
          >
            <ClubRow
              club={item}
              signal={meetingSignal(item, tonightByClub.get(item.id))}
              onPress={() => openClub(item.id)}
              onJoin={() => void handleJoin(item)}
              joining={joiningId === item.id}
            />
          </Animated.View>
        )}
        ListEmptyComponent={
          loaded && segment === 'discover' ? (
            <EmptyState
              icon="search"
              title={myClubs.length === clubs.length && clubs.length ? 'You joined every club' : 'No clubs found'}
              body="Try a different search or category."
              actionLabel={query || filter ? 'Clear filters' : undefined}
              onAction={() => {
                setQuery('');
                setFilter(null);
              }}
            />
          ) : null
        }
      />
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: { flexGrow: 1, paddingHorizontal: spacing.xl },
  header: { gap: spacing.lg, marginBottom: spacing.lg },
  masthead: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: spacing.md },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: t.colors.ink,
    marginTop: 3,
  },
  section: { gap: spacing.md },
  myClub: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md, padding: spacing.md },
  chevron: { fontFamily: fonts.bold, fontSize: 24 },
  rail: { flexDirection: 'row' as const, gap: spacing.md, paddingRight: spacing.xl, paddingBottom: 5 },
  tonight: { width: 154 },
  tonightFace: { padding: spacing.md, gap: 5 },
  chips: { flexDirection: 'row' as const, gap: spacing.sm, paddingRight: spacing.xl, paddingVertical: 3 },
}));
