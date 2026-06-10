import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Alert, Image, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getApiErrorMessage, getClubs, getClubsToday, joinClub } from '../api';
import { ClubDirectoryEntry, ClubMeetingToday } from '../types';
import { RootStackParamList } from '../../App';
import {
  Chip,
  Entrance,
  LiveDot,
  Screen,
  SearchField,
  SectionHeader,
  SkeletonBlock,
  SkeletonCard,
  Tap,
} from '../components/ui';
import { CLUB_CATEGORIES, clubCategoryMatches } from '../constants/clubCategories';
import { clubCategoryVisual } from '../constants/clubVisuals';
import { Theme, createThemedStyles, fonts, radii, spacing, useTheme, DOCK_CLEARANCE } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function clubMatchesFilter(club: ClubDirectoryEntry, filter: string | null) {
  return clubCategoryMatches(club.category, filter);
}

function memberLabel(count: number) {
  return `${count} member${count === 1 ? '' : 's'}`;
}

function clockLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function meetingLabel(club: ClubDirectoryEntry, todayMeeting?: ClubMeetingToday) {
  if (todayMeeting) return `Meets tonight at ${clockLabel(todayMeeting.meetingTime)}`;
  if (club.upcomingMeetingCount > 0) {
    return `${club.upcomingMeetingCount} meeting${club.upcomingMeetingCount === 1 ? '' : 's'} coming up`;
  }
  return 'Schedule coming soon';
}

function shortMeetingLabel(club: ClubDirectoryEntry, todayMeeting?: ClubMeetingToday) {
  if (todayMeeting) return `Tonight ${clockLabel(todayMeeting.meetingTime)}`;
  if (club.upcomingMeetingCount > 0) {
    return `${club.upcomingMeetingCount} upcoming`;
  }
  return 'No events yet';
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

  const featuredClub = filteredClubs[0] ?? null;
  const otherClubs = filteredClubs.slice(1);
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

  const openClub = useCallback(
    (clubId: string) => navigation.navigate('ClubDetail', { clubId }),
    [navigation]
  );

  const featuredVisual = clubCategoryVisual(featuredClub?.category);
  const featuredMeeting = featuredClub
    ? tonightMeetings.find((item) => item.clubId === featuredClub.id)
    : undefined;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.pageEyebrow}>Campus orgs</Text>
            <Text style={styles.pageTitle}>Clubs</Text>
            {loaded && clubs.length ? (
              <Text style={styles.pageSubtitle}>
                {clubs.length} organization{clubs.length === 1 ? '' : 's'}
                {tonightMeetings.length
                  ? ` · ${tonightMeetings.length} meeting${tonightMeetings.length === 1 ? '' : 's'} tonight`
                  : ''}
              </Text>
            ) : null}
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
          <Chip label="All" icon="apps-outline" active={!filter} onPress={() => setFilter(null)} />
          {CLUB_CATEGORIES.map((item) => (
            <Chip
              key={item}
              label={item}
              icon={clubCategoryVisual(item).icon}
              active={filter === item}
              onPress={() => setFilter(filter === item ? null : item)}
            />
          ))}
        </ScrollView>

        {loaded && tonightMeetings.length ? (
          <Entrance index={0} style={styles.section}>
            <SectionHeader
              title="Happening tonight"
              actionLabel="See all"
              onActionPress={() => navigation.navigate('ClubMeetingsTonight')}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tonightRail}>
              {tonightMeetings.slice(0, 8).map((meeting) => (
                <Tap
                  key={meeting.id}
                  haptic
                  style={styles.tonightCard}
                  onPress={() => openClub(meeting.clubId)}
                  accessibilityLabel={`${meeting.clubName}, tonight at ${clockLabel(meeting.meetingTime)}`}
                >
                  <View style={styles.tonightTopRow}>
                    <Text style={styles.tonightTime}>{clockLabel(meeting.meetingTime)}</Text>
                    <LiveDot size={7} />
                  </View>
                  <Text style={styles.tonightEmoji}>{meeting.clubEmoji}</Text>
                  <Text style={styles.tonightName} numberOfLines={1}>{meeting.clubName}</Text>
                  <View style={styles.tonightMetaRow}>
                    <Ionicons name="location-outline" size={12} color={colors.faint} />
                    <Text style={styles.tonightLocation} numberOfLines={1}>{meeting.location}</Text>
                  </View>
                </Tap>
              ))}
            </ScrollView>
          </Entrance>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Spotlight" />
          {!loaded ? (
            <SkeletonCard />
          ) : featuredClub ? (
            <Entrance index={1}>
              <Tap
                haptic
                scaleTo={0.98}
                onPress={() => openClub(featuredClub.id)}
                accessibilityLabel={`Open ${featuredClub.name}`}
              >
                <LinearGradient
                  colors={featuredVisual.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1.1 }}
                  style={styles.spotlight}
                >
                  <Text pointerEvents="none" style={styles.spotlightWatermark}>
                    {featuredClub.emoji}
                  </Text>

                  <View style={styles.spotlightTopRow}>
                    <View style={styles.spotlightPill}>
                      <Ionicons name={featuredVisual.icon} size={13} color="#FFFFFF" />
                      <Text style={styles.spotlightPillText}>{featuredClub.category}</Text>
                    </View>
                    {featuredClub.isVerified ? (
                      <View style={styles.spotlightPill}>
                        <Ionicons name="checkmark-circle" size={13} color="#FFFFFF" />
                        <Text style={styles.spotlightPillText}>Verified</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.spotlightIdentityRow}>
                    <View style={styles.spotlightAvatarTile}>
                      {featuredClub.avatarUrl ? (
                        <Image source={{ uri: featuredClub.avatarUrl }} style={styles.spotlightAvatar} />
                      ) : (
                        <Text style={styles.spotlightAvatarEmoji}>{featuredClub.emoji}</Text>
                      )}
                    </View>
                    <View style={styles.spotlightTitleBlock}>
                      <Text style={styles.spotlightTitle} numberOfLines={2}>{featuredClub.name}</Text>
                      <Text style={styles.spotlightMembers}>{memberLabel(featuredClub.memberCount)}</Text>
                    </View>
                  </View>

                  <Text style={styles.spotlightDescription} numberOfLines={2}>
                    {featuredClub.description}
                  </Text>

                  <View style={styles.spotlightFooter}>
                    <View style={styles.spotlightSignal}>
                      {featuredMeeting ? <LiveDot size={7} color="#7BF0B8" /> : (
                        <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.75)" />
                      )}
                      <Text style={styles.spotlightSignalText} numberOfLines={1}>
                        {meetingLabel(featuredClub, featuredMeeting)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.spotlightAction}
                      activeOpacity={0.88}
                      onPress={() => featuredClub.isMember
                        ? openClub(featuredClub.id)
                        : void handleJoinClub(featuredClub.id)}
                      disabled={joiningClubId === featuredClub.id}
                      accessibilityRole="button"
                      accessibilityLabel={featuredClub.isMember ? `Open ${featuredClub.name}` : `Join ${featuredClub.name}`}
                    >
                      <Text style={styles.spotlightActionText}>
                        {joiningClubId === featuredClub.id ? 'Joining...' : featuredClub.isMember ? 'Open' : 'Join'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </Tap>
            </Entrance>
          ) : (
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
            <SectionHeader title="Directory" />
            <View style={styles.grid}>
              {[0, 1, 2, 3].map((item) => (
                <View key={item} style={styles.gridItem}>
                  <SkeletonBlock height={188} radius={22} />
                </View>
              ))}
            </View>
          </View>
        ) : otherClubs.length ? (
          <View style={styles.section}>
            <SectionHeader title="Directory" />
            <View style={styles.grid}>
              {otherClubs.map((club, index) => {
                const visual = clubCategoryVisual(club.category);
                const meeting = tonightMeetings.find((item) => item.clubId === club.id);
                return (
                  <Entrance key={club.id} index={Math.min(index, 6)} style={styles.gridItem}>
                    <Tap
                      haptic
                      style={styles.gridCard}
                      onPress={() => openClub(club.id)}
                      accessibilityLabel={`Open ${club.name}`}
                    >
                      <LinearGradient
                        colors={visual.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1.2 }}
                        style={styles.gridMedia}
                      >
                        <Text pointerEvents="none" style={styles.gridWatermark}>{club.emoji}</Text>
                        <View style={styles.gridEmojiTile}>
                          {club.avatarUrl ? (
                            <Image source={{ uri: club.avatarUrl }} style={styles.gridAvatar} />
                          ) : (
                            <Text style={styles.gridEmoji}>{club.emoji}</Text>
                          )}
                        </View>
                        {club.isVerified ? (
                          <View style={styles.gridVerified}>
                            <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                          </View>
                        ) : null}
                      </LinearGradient>

                      <View style={styles.gridBody}>
                        <Text style={styles.gridTitle} numberOfLines={2}>{club.name}</Text>
                        <Text style={styles.gridMeta} numberOfLines={1}>{memberLabel(club.memberCount)}</Text>
                        <View style={styles.gridFooter}>
                          <View style={styles.gridSignal}>
                            {meeting ? (
                              <LiveDot size={6} />
                            ) : (
                              <View style={styles.gridSignalDot} />
                            )}
                            <Text style={styles.gridSignalText} numberOfLines={1}>
                              {shortMeetingLabel(club, meeting)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.gridAction, club.isMember && styles.gridActionMember]}
                            activeOpacity={0.85}
                            onPress={() => club.isMember
                              ? openClub(club.id)
                              : void handleJoinClub(club.id)}
                            disabled={joiningClubId === club.id}
                            accessibilityRole="button"
                            accessibilityLabel={club.isMember ? `Open ${club.name}` : `Join ${club.name}`}
                          >
                            <Ionicons
                              name={club.isMember ? 'arrow-forward' : 'add'}
                              size={16}
                              color={club.isMember ? colors.ink : '#FFFFFF'}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Tap>
                  </Entrance>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingTop: spacing.lg,
    paddingBottom: DOCK_CLEARANCE,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  titleCopy: {
    flex: 1,
    gap: 2,
  },
  pageEyebrow: {
    ...t.typography.label,
    color: t.colors.primary,
  },
  pageTitle: {
    ...t.typography.display,
  },
  pageSubtitle: {
    ...t.typography.caption,
    fontSize: 13,
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

  // ── Tonight rail ───────────────────────────────────────────────────────────
  tonightRail: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  tonightCard: {
    width: 156,
    borderRadius: 20,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.sm + 2,
    gap: 6,
    ...t.shadows.subtle,
  },
  tonightTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  tonightTime: {
    fontFamily: fonts.displayMedium,
    fontSize: 15,
    letterSpacing: -0.2,
    color: t.colors.green,
  },
  tonightEmoji: {
    fontSize: 28,
    lineHeight: 34,
  },
  tonightName: {
    ...t.typography.title,
    fontSize: 15,
    lineHeight: 19,
  },
  tonightMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  tonightLocation: {
    ...t.typography.caption,
    flex: 1,
  },

  // ── Spotlight ──────────────────────────────────────────────────────────────
  spotlight: {
    borderRadius: 28,
    padding: spacing.md + 2,
    gap: spacing.sm,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    ...t.shadows.raised,
  },
  spotlightWatermark: {
    position: 'absolute' as const,
    right: -26,
    top: -18,
    fontSize: 150,
    lineHeight: 170,
    opacity: 0.14,
    transform: [{ rotate: '-12deg' }],
  },
  spotlightTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
  },
  spotlightPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  spotlightPillText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  spotlightIdentityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginTop: 2,
  },
  spotlightAvatarTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    overflow: 'hidden' as const,
  },
  spotlightAvatar: {
    width: 64,
    height: 64,
  },
  spotlightAvatarEmoji: {
    fontSize: 32,
    lineHeight: 40,
    color: '#FFFFFF',
  },
  spotlightTitleBlock: {
    flex: 1,
    gap: 2,
  },
  spotlightTitle: {
    fontFamily: fonts.display,
    fontSize: 23,
    lineHeight: 28,
    letterSpacing: -0.6,
    color: '#FFFFFF',
  },
  spotlightMembers: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
  },
  spotlightDescription: {
    ...t.typography.body,
    color: 'rgba(255,255,255,0.84)',
  },
  spotlightFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
    marginTop: 2,
  },
  spotlightSignal: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  spotlightSignalText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.86)',
  },
  spotlightAction: {
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  spotlightActionText: {
    color: '#13151C',
    fontFamily: fonts.bold,
    fontSize: 14,
  },

  // ── Empty state ────────────────────────────────────────────────────────────
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

  // ── Directory grid ─────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between' as const,
    rowGap: spacing.sm,
  },
  gridItem: {
    width: '48.4%' as const,
  },
  gridCard: {
    width: '100%' as const,
    backgroundColor: t.colors.surface,
    borderRadius: 22,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: t.colors.border,
    ...t.shadows.card,
  },
  gridMedia: {
    height: 86,
    padding: spacing.sm,
    justifyContent: 'flex-end' as const,
    overflow: 'hidden' as const,
  },
  gridWatermark: {
    position: 'absolute' as const,
    right: -14,
    top: -16,
    fontSize: 76,
    lineHeight: 88,
    opacity: 0.16,
    transform: [{ rotate: '-10deg' }],
  },
  gridEmojiTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden' as const,
  },
  gridAvatar: {
    width: 42,
    height: 42,
  },
  gridEmoji: {
    fontSize: 22,
    lineHeight: 28,
    color: '#13151C',
  },
  gridVerified: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  gridBody: {
    padding: spacing.sm + 2,
    gap: 4,
  },
  gridTitle: {
    ...t.typography.title,
    fontSize: 15.5,
    lineHeight: 20,
    minHeight: 40,
  },
  gridMeta: {
    ...t.typography.caption,
  },
  gridFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
    marginTop: 4,
  },
  gridSignal: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  gridSignalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.colors.faint,
  },
  gridSignalText: {
    ...t.typography.caption,
    flex: 1,
    fontSize: 11.5,
  },
  gridAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: t.colors.primary,
    ...t.shadows.glow,
  },
  gridActionMember: {
    backgroundColor: t.colors.inputBg,
    shadowOpacity: 0,
    elevation: 0,
  },
}));
