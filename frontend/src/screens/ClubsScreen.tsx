import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Alert, Image, Linking, type GestureResponderEvent, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getApiErrorMessage, getClubs, getClubsToday, joinClub } from '../api';
import { ClubDirectoryEntry, ClubMeetingToday } from '../types';
import { RootStackParamList } from '../../App';
import { Chip, EmptyState, Entrance, Screen, SearchField, SectionHeader, SkeletonCard, Tap } from '../components/ui';
import { CLUB_CATEGORIES, clubCategoryMatches } from '../constants/clubCategories';
import { Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function clubMatchesFilter(club: ClubDirectoryEntry, filter: string | null) {
  return clubCategoryMatches(club.category, filter);
}

function memberLabel(count: number) {
  return `${count} member${count === 1 ? '' : 's'}`;
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
    ['#1C0E0A', '#7C1F15', '#E04A2C'],
    ['#0F1524', '#36456E', '#6C8EC6'],
    ['#1A1026', '#5B3A8C', '#9D6BDE'],
    ['#0E1F1A', '#1F6A50', '#3DC98A'],
  ] as const;
  return options[index % options.length];
}

export default function ClubsScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useStyles();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
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
    } catch (error) {
      Alert.alert('Could not load clubs', getApiErrorMessage(error));
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
  const otherClubs = filteredClubs.slice(featuredClubs.length);
  const hasDirectoryFilter = Boolean(filter || deferredQuery.trim());
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
    } catch (error) {
      setClubs(previousClubs);
      Alert.alert('Could not join club', getApiErrorMessage(error));
    } finally {
      setJoiningClubId(null);
    }
  };

  const handleListClub = async () => {
    try {
      await Linking.openURL('https://www.joinbridgeapp.com/clubs');
    } catch {
      Alert.alert('Could not open club onboarding', 'Visit joinbridgeapp.com/clubs to list your organization.');
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.pageEyebrow}>Campus orgs</Text>
            <Text style={styles.pageTitle}>Clubs</Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => void handleListClub()}
            accessibilityRole="link"
            accessibilityLabel="List your club"
            accessibilityHint="Opens the Bridge club onboarding form"
          >
            <Ionicons name="add" size={24} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search clubs and communities"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip label="All" active={!filter} onPress={() => setFilter(null)} />
          {CLUB_CATEGORIES.map((item) => (
            <Chip
              key={item}
              label={item}
              active={filter === item}
              onPress={() => setFilter(item)}
            />
          ))}
        </ScrollView>

        <View style={styles.section}>
          <SectionHeader title="Club directory" />
          {!loaded ? (
            <SkeletonCard />
          ) : featuredClubs.length ? featuredClubs.map((club, index) => {
            const meeting = meetingsToday.find((item) => item.clubId === club.id);
            return (
              <TouchableOpacity
                key={club.id}
                activeOpacity={0.92}
                onPress={() => navigation.navigate('ClubDetail', { clubId: club.id })}
                accessibilityRole="button"
                accessibilityLabel={`Open ${club.name}`}
              >
                <View style={styles.featuredCard}>
                  <LinearGradient colors={featuredGradient(index)} style={styles.featuredBanner}>
                    <View style={styles.featuredBannerTop}>
                      <Text style={styles.featuredSignal}>{memberLabel(club.memberCount)}</Text>
                      {club.isVerified ? (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                          <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.featuredIdentity}>
                      {club.avatarUrl ? (
                        <Image source={{ uri: club.avatarUrl }} style={styles.featuredAvatar} />
                      ) : (
                        <Text style={styles.featuredEmoji}>{club.emoji}</Text>
                      )}
                    </View>
                  </LinearGradient>

                  <View style={styles.featuredBody}>
                    <Text style={styles.featuredTitle}>{club.name}</Text>
                    <Text style={styles.featuredMeta}>
                      {memberLabel(club.memberCount)} • {club.category}
                    </Text>
                    <Text style={styles.featuredDescription}>{club.description}</Text>
                    <View style={styles.featuredMeetingRow}>
                      <Ionicons name="calendar-outline" size={16} color={colors.faint} />
                      <Text style={styles.featuredMeetingText}>
                        {meetingLabel(club, meeting)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.featuredAction, club.isMember && styles.featuredActionGhost]}
                      activeOpacity={0.88}
                      onPress={(event: GestureResponderEvent) => {
                        event.stopPropagation();
                        if (club.isMember) {
                          navigation.navigate('ClubDetail', { clubId: club.id });
                        } else {
                          void handleJoinClub(club.id);
                        }
                      }}
                      disabled={joiningClubId === club.id}
                    >
                      <Text style={[styles.featuredActionText, club.isMember && styles.featuredActionTextGhost]}>
                        {joiningClubId === club.id ? 'Joining...' : club.isMember ? 'Open' : 'Join'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="people-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {hasDirectoryFilter ? 'No clubs match that search' : 'Clubs are getting set up'}
              </Text>
              <Text style={styles.emptyBody}>
                {hasDirectoryFilter
                  ? 'Try another category, clear the filter, or search across the full directory.'
                  : 'Student organizations will appear here as leaders finish their Bridge pages.'}
              </Text>
              {hasDirectoryFilter ? (
                <TouchableOpacity
                  style={styles.emptyActionSolid}
                  activeOpacity={0.88}
                  onPress={() => {
                    setFilter(null);
                    setQuery('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear club filters"
                >
                  <Text style={styles.emptyActionSolidText}>Clear filter</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>

        {!loaded ? (
          <View style={styles.section}>
            <SectionHeader title="More clubs" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularRow}>
              {[0, 1, 2].map((item) => <SkeletonCard key={item} compact />)}
            </ScrollView>
          </View>
        ) : otherClubs.length ? (
          <View style={styles.section}>
            <SectionHeader title="More clubs" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularRow}>
              {otherClubs.map((club, index) => (
                <TouchableOpacity
                  key={club.id}
                  style={styles.popularCard}
                  activeOpacity={0.92}
                  onPress={() => navigation.navigate('ClubDetail', { clubId: club.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${club.name}`}
                >
                  <LinearGradient colors={featuredGradient(index)} style={styles.popularMedia}>
                    <View style={styles.popularIconBadge}>
                      {club.avatarUrl ? (
                        <Image source={{ uri: club.avatarUrl }} style={styles.popularAvatar} />
                      ) : (
                        <Text style={styles.popularEmoji}>{club.emoji}</Text>
                      )}
                    </View>
                  </LinearGradient>

                  <View style={styles.popularBody}>
                    <Text style={styles.popularTitle} numberOfLines={2}>{club.name}</Text>
                    <Text style={styles.popularMeta} numberOfLines={1}>{memberLabel(club.memberCount)}</Text>

                    <View style={styles.popularFooter}>
                      <View style={styles.popularSignal}>
                        <View style={styles.popularDot} />
                        <Text style={styles.popularSignalText}>{meetingLabel(club)}</Text>
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

        {!loaded || tonightMeetings.length || clubs.length ? (
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
            <Tap
              key={meeting.id}
              style={styles.tonightCard}
              onPress={() => navigation.navigate('ClubDetail', { clubId: meeting.clubId })}
              accessibilityLabel={meeting.clubName}
            >
              <View style={styles.tonightIcon}>
                <Ionicons name="calendar-outline" size={21} color={colors.violet} />
              </View>
              <View style={styles.tonightCopy}>
                <Text style={styles.tonightTitle} numberOfLines={1}>{meeting.clubName}</Text>
                <Text style={styles.tonightMeta}>
                  Today • {new Date(meeting.meetingTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
                <Text style={styles.tonightMeta} numberOfLines={1}>{meeting.location}</Text>
              </View>
              <Text style={styles.tonightGoing}>{meeting.attendeeCount} going</Text>
            </Tap>
          )) : (
            <EmptyState
              icon="calendar-outline"
              title="No meetings tonight"
              body="Tonight's club schedule will show up here once clubs post events."
            />
          )}
        </View>
        ) : null}
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
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  pageEyebrow: {
    ...t.typography.label,
    color: t.colors.primary,
    marginBottom: 2,
  },
  pageTitle: {
    ...t.typography.display,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.glass,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  chipRow: {
    paddingRight: spacing.md,
    gap: spacing.xs,
    paddingBottom: 4,
  },
  section: {
    gap: spacing.sm,
  },
  featuredCard: {
    overflow: 'hidden' as const,
    borderRadius: 26,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    ...t.shadows.raised,
  },
  featuredBanner: {
    minHeight: 168,
    padding: spacing.md,
    justifyContent: 'space-between' as const,
  },
  featuredBannerTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  featuredSignal: {
    alignSelf: 'flex-start' as const,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden' as const,
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  verifiedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  verifiedText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  featuredIdentity: {
    alignSelf: 'center' as const,
    width: 82,
    height: 82,
    borderRadius: 26,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  featuredAvatar: {
    width: 82,
    height: 82,
    borderRadius: 26,
  },
  featuredEmoji: {
    color: '#FFFFFF',
    fontSize: 44,
    lineHeight: 52,
  },
  featuredBody: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  featuredTitle: {
    ...t.typography.h1,
    fontSize: 22,
    lineHeight: 28,
  },
  featuredMeta: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: t.colors.sub,
  },
  featuredDescription: {
    ...t.typography.body,
    color: t.colors.ink,
  },
  featuredMeetingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: spacing.xs,
  },
  featuredMeetingText: {
    ...t.typography.bodyStrong,
    fontSize: 14,
  },
  featuredAction: {
    alignSelf: 'flex-start' as const,
    borderRadius: radii.pill,
    backgroundColor: t.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: spacing.xs,
    ...t.shadows.glow,
  },
  featuredActionGhost: {
    backgroundColor: t.colors.inputBg,
    shadowOpacity: 0,
    elevation: 0,
  },
  featuredActionText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  featuredActionTextGhost: {
    color: t.colors.ink,
  },
  emptyCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center' as const,
    gap: spacing.sm,
    ...t.shadows.card,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.primarySoft,
  },
  emptyTitle: {
    ...t.typography.h2,
    textAlign: 'center' as const,
  },
  emptyBody: {
    ...t.typography.body,
    textAlign: 'center' as const,
    maxWidth: 320,
  },
  emptyActionSolid: {
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: t.colors.primary,
  },
  emptyActionSolidText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  popularRow: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  popularCard: {
    width: 184,
    backgroundColor: t.colors.surface,
    borderRadius: 22,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: t.colors.border,
    ...t.shadows.card,
  },
  popularMedia: {
    height: 104,
    justifyContent: 'flex-end' as const,
    padding: 12,
  },
  popularIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden' as const,
  },
  popularAvatar: {
    width: 44,
    height: 44,
  },
  popularEmoji: {
    color: '#13151C',
    fontSize: 24,
    lineHeight: 30,
  },
  popularBody: {
    padding: 12,
    gap: 6,
  },
  popularTitle: {
    ...t.typography.title,
    fontSize: 17,
    lineHeight: 22,
  },
  popularMeta: {
    ...t.typography.body,
    fontSize: 14,
  },
  popularFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
    marginTop: 2,
  },
  popularSignal: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    flex: 1,
  },
  popularDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: t.colors.green,
  },
  popularSignalText: {
    ...t.typography.body,
    fontSize: 13,
  },
  popularAction: {
    borderRadius: radii.pill,
    backgroundColor: t.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  popularActionGhost: {
    backgroundColor: t.colors.inputBg,
  },
  popularActionText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  popularActionTextGhost: {
    color: t.colors.ink,
  },
  tonightCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    backgroundColor: t.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    ...t.shadows.subtle,
  },
  tonightIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.violetSoft,
  },
  tonightCopy: {
    flex: 1,
    gap: 2,
  },
  tonightTitle: {
    ...t.typography.title,
    fontSize: 17,
    lineHeight: 22,
  },
  tonightMeta: {
    ...t.typography.body,
    fontSize: 14,
  },
  tonightGoing: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: t.colors.primary,
  },
}));
