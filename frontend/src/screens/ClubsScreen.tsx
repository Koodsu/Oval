import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_USER_MESSAGE, getClubs, getClubsToday, joinClub } from '../api';
import { ClubDirectoryEntry, ClubMeetingToday } from '../types';
import { RootStackParamList } from '../../App';
import { Chip, EmptyState, IconButton, PrimaryButton, Screen, SearchField, SectionHeader, SkeletonCard } from '../components/ui';
import { palette, radii, shadows, spacing, typography } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CLUB_FILTERS = ['Academic', 'Sports', 'Arts', 'Service', 'Cultural', 'Social'];

function clubMatchesFilter(club: ClubDirectoryEntry, filter: string | null) {
  if (!filter) return true;
  return club.category.toLowerCase().includes(filter.toLowerCase());
}

function memberLabel(count: number) {
  return `${count} member${count === 1 ? '' : 's'}`;
}

function activeWeekLabel(club: ClubDirectoryEntry) {
  const activeCount = Math.max(1, Math.min(club.memberCount, club.upcomingMeetingCount * 6 || Math.round(club.memberCount * 0.3)));
  return `${activeCount} active`;
}

function meetingLabel(club: ClubDirectoryEntry, todayMeeting?: ClubMeetingToday) {
  if (todayMeeting) {
    const time = new Date(todayMeeting.meetingTime).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `Next meeting: today at ${time}`;
  }
  if (club.upcomingMeetingCount > 0) {
    return `${club.upcomingMeetingCount} meeting${club.upcomingMeetingCount === 1 ? '' : 's'} coming up`;
  }
  return 'Schedule coming soon';
}

function featuredGradient(index: number) {
  const options = [
    ['#2B120A', '#8D2018', '#D24A32'],
    ['#101D28', '#394F7A', '#6C8EC6'],
    ['#241A0F', '#855327', '#D89647'],
  ] as const;
  return options[index % options.length];
}

export default function ClubsScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [clubs, setClubs] = useState<ClubDirectoryEntry[]>([]);
  const [meetingsToday, setMeetingsToday] = useState<ClubMeetingToday[]>([]);
  const [joiningClubId, setJoiningClubId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const load = useCallback(async () => {
    try {
      const [clubRows, meetings] = await Promise.all([
        getClubs(),
        getClubsToday(),
      ]);
      setClubs(clubRows);
      setMeetingsToday(meetings);
    } catch {
      Alert.alert('Could not load clubs', API_USER_MESSAGE);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filteredClubs = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return clubs
      .filter((club) => clubMatchesFilter(club, filter))
      .filter((club) => {
        if (!q) return true;
        return [club.name, club.description, club.category]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.memberCount - a.memberCount);
  }, [clubs, deferredQuery, filter]);

  const featuredClubs = filteredClubs.slice(0, 1);
  const popularClubs = filteredClubs.slice(featuredClubs.length);
  const tonightMeetings = useMemo(
    () => [...meetingsToday].sort((a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime()),
    [meetingsToday]
  );

  const handleJoinClub = async (clubId: string) => {
    setJoiningClubId(clubId);
    const previousClubs = clubs;
    setClubs((current) => (
      current.map((club) => (
        club.id === clubId
          ? { ...club, isMember: true, memberCount: club.isMember ? club.memberCount : club.memberCount + 1 }
          : club
      ))
    ));
    try {
      await joinClub(clubId);
    } catch {
      setClubs(previousClubs);
      Alert.alert('Could not join club', API_USER_MESSAGE);
    } finally {
      setJoiningClubId(null);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Clubs</Text>
          <IconButton
            icon={showSearch ? 'close' : 'search'}
            tooltip={showSearch ? 'Close search' : 'Search clubs'}
            onPress={() => setShowSearch((current) => !current)}
          />
        </View>

        {showSearch ? (
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search clubs and communities"
          />
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip label="All" active={!filter} onPress={() => setFilter(null)} />
          {CLUB_FILTERS.map((item) => (
            <Chip
              key={item}
              label={item}
              active={filter === item}
              onPress={() => setFilter(item)}
            />
          ))}
        </ScrollView>

        <View style={styles.section}>
          <SectionHeader title="Featured clubs" actionLabel="See all" />
          {!loaded ? (
            <SkeletonCard />
          ) : featuredClubs.length ? featuredClubs.map((club, index) => {
            const meeting = meetingsToday.find((item) => item.clubId === club.id);
            return (
              <TouchableOpacity
                key={club.id}
                activeOpacity={0.92}
                onPress={() => navigation.navigate('ClubDetail', { clubId: club.id })}
              >
                <View style={styles.featuredCard}>
                  <LinearGradient colors={featuredGradient(index)} style={styles.featuredBanner}>
                    <View style={styles.featuredBadge}>
                      <Text style={styles.featuredBadgeText}>Featured</Text>
                    </View>
                    <Text style={styles.featuredEmoji}>{club.emoji}</Text>
                  </LinearGradient>

                  <View style={styles.featuredBody}>
                    <Text style={styles.featuredTitle}>{club.name}</Text>
                    <Text style={styles.featuredMeta}>
                      {memberLabel(club.memberCount)} • {club.category}
                    </Text>
                    <Text style={styles.featuredDescription}>{club.description}</Text>
                    <View style={styles.featuredMeetingRow}>
                      <Ionicons name="calendar-outline" size={16} color={palette.slate} />
                      <Text style={styles.featuredMeetingText}>
                        {meetingLabel(club, meeting)}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="people-outline" size={24} color={palette.scarlet} />
              </View>
              <Text style={styles.emptyTitle}>No clubs match that lens</Text>
              <Text style={styles.emptyBody}>
                Try another category, clear the filter, or search across the full directory.
              </Text>
              <TouchableOpacity
                style={styles.emptyActionSolid}
                activeOpacity={0.88}
                onPress={() => {
                  setFilter(null);
                  setQuery('');
                }}
              >
                <Text style={styles.emptyActionSolidText}>Clear filter</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {!loaded ? (
          <View style={styles.section}>
            <SectionHeader title="Popular on campus" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularRow}>
              {[0, 1, 2].map((item) => <SkeletonCard key={item} compact />)}
            </ScrollView>
          </View>
        ) : popularClubs.length ? (
          <View style={styles.section}>
            <SectionHeader title="Popular on campus" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularRow}>
              {popularClubs.map((club, index) => (
                <TouchableOpacity
                  key={club.id}
                  style={styles.popularCard}
                  activeOpacity={0.92}
                  onPress={() => navigation.navigate('ClubDetail', { clubId: club.id })}
                >
                  <LinearGradient colors={featuredGradient(index)} style={styles.popularMedia}>
                    <View style={styles.popularIconBadge}>
                      <Text style={styles.popularEmoji}>{club.emoji}</Text>
                    </View>
                  </LinearGradient>

                  <View style={styles.popularBody}>
                    <Text style={styles.popularTitle} numberOfLines={2}>{club.name}</Text>
                    <Text style={styles.popularMeta} numberOfLines={1}>{memberLabel(club.memberCount)}</Text>

                    <View style={styles.popularFooter}>
                      <View style={styles.popularSignal}>
                        <View style={styles.popularDot} />
                        <Text style={styles.popularSignalText}>{activeWeekLabel(club)}</Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.popularAction, club.isMember && styles.popularActionGhost]}
                        activeOpacity={0.88}
                        onPress={() => club.isMember
                          ? navigation.navigate('ClubDetail', { clubId: club.id })
                          : void handleJoinClub(club.id)}
                        disabled={joiningClubId === club.id}
                      >
                        <Text style={[styles.popularActionText, club.isMember && styles.popularActionTextGhost]}>
                          {joiningClubId === club.id ? 'Joining...' : club.isMember ? 'Open' : 'Join'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            title="Meeting tonight"
            actionLabel={tonightMeetings.length ? 'See all' : undefined}
            onActionPress={() => navigation.navigate('ClubMeetingsTonight')}
          />
          {!loaded ? (
            <>
              <SkeletonCard compact />
              <SkeletonCard compact />
            </>
          ) : tonightMeetings.length ? tonightMeetings.slice(0, 4).map((meeting) => (
            <TouchableOpacity
              key={meeting.id}
              style={styles.tonightCard}
              activeOpacity={0.92}
              onPress={() => navigation.navigate('ClubDetail', { clubId: meeting.clubId })}
            >
              <View style={styles.tonightIcon}>
                <Text style={styles.tonightEmoji}>{meeting.clubEmoji}</Text>
              </View>
              <View style={styles.tonightCopy}>
                <Text style={styles.tonightTitle} numberOfLines={1}>{meeting.clubName}</Text>
                <Text style={styles.tonightMeta}>
                  Today • {new Date(meeting.meetingTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
                <Text style={styles.tonightMeta} numberOfLines={1}>{meeting.location}</Text>
              </View>
              <Text style={styles.tonightGoing}>{meeting.attendeeCount} going</Text>
            </TouchableOpacity>
          )) : (
            <EmptyState
              icon="calendar-outline"
              title="No meetings tonight"
              body="Tonight's club schedule will show up here once clubs post events."
            />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    ...typography.h1,
    fontSize: 48,
    lineHeight: 52,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  chipRow: {
    paddingRight: spacing.md,
    gap: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  featuredCard: {
    overflow: 'hidden',
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    ...shadows.card,
  },
  featuredBanner: {
    minHeight: 168,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  featuredBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(128, 104, 221, 0.95)',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  featuredBadgeText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  featuredEmoji: {
    alignSelf: 'center',
    fontSize: 56,
  },
  featuredBody: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  featuredTitle: {
    ...typography.h1,
    fontSize: 22,
    lineHeight: 28,
  },
  featuredMeta: {
    ...typography.bodyStrong,
    color: palette.slate,
  },
  featuredDescription: {
    ...typography.body,
    color: palette.ink,
  },
  featuredMeetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.xs,
  },
  featuredMeetingText: {
    ...typography.bodyStrong,
    color: palette.ink,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(199, 59, 34, 0.10)',
  },
  emptyTitle: {
    ...typography.h2,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.body,
    textAlign: 'center',
    maxWidth: 320,
  },
  emptyActionSolid: {
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: palette.scarlet,
  },
  emptyActionSolidText: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: palette.white,
  },
  popularRow: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  popularCard: {
    width: 184,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    ...shadows.card,
  },
  popularMedia: {
    height: 104,
    justifyContent: 'flex-end',
    padding: 12,
  },
  popularIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  popularEmoji: {
    fontSize: 22,
  },
  popularBody: {
    padding: 12,
    gap: 6,
  },
  popularTitle: {
    ...typography.title,
    fontSize: 18,
    lineHeight: 22,
  },
  popularMeta: {
    ...typography.body,
    fontSize: 14,
  },
  popularFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  popularSignal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  popularDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#36C275',
  },
  popularSignalText: {
    ...typography.body,
    fontSize: 13,
  },
  popularAction: {
    borderRadius: radii.pill,
    backgroundColor: palette.scarlet,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  popularActionGhost: {
    backgroundColor: 'rgba(16, 33, 43, 0.06)',
  },
  popularActionText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '800',
  },
  popularActionTextGhost: {
    color: palette.ink,
  },
  tonightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.md,
    ...shadows.card,
  },
  tonightIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 33, 43, 0.05)',
  },
  tonightEmoji: {
    fontSize: 23,
  },
  tonightCopy: {
    flex: 1,
    gap: 2,
  },
  tonightTitle: {
    ...typography.title,
    fontSize: 19,
    lineHeight: 23,
  },
  tonightMeta: {
    ...typography.body,
    fontSize: 14,
  },
  tonightGoing: {
    ...typography.bodyStrong,
    color: palette.scarlet,
  },
});
