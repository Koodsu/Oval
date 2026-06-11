import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Alert, Image, Linking, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiErrorMessage, getClubs, getClubsToday, joinClub } from '../api';
import { ClubDirectoryEntry, ClubMeetingToday } from '../types';
import { RootStackParamList } from '../../App';
import {
  AppBackdrop,
  Button,
  Chip,
  EmptyState,
  IconButton,
  SearchBar,
  SectionHeader,
  SkeletonCard,
  Slab,
  Sticker,
} from '../components/ui';
import { CLUB_CATEGORIES, clubCategoryMatches } from '../constants/clubCategories';
import { clubAccent, clubCategoryVisual } from '../constants/clubVisuals';
import {
  BORDER_W,
  DOCK_CLEARANCE,
  Theme,
  createThemedStyles,
  fonts,
  motion,
  radii,
  spacing,
  useTheme,
} from '../theme';

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
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [clubs, setClubs] = useState<ClubDirectoryEntry[]>([]);
  const [meetingsToday, setMeetingsToday] = useState<ClubMeetingToday[]>([]);
  const [joiningClubId, setJoiningClubId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const load = useCallback(async () => {
    try {
      const [clubRows, meetings] = await Promise.all([getClubs(), getClubsToday()]);
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
    }, [load]),
  );

  const filteredClubs = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return clubs
      .filter((club) => clubMatchesFilter(club, filter))
      .filter((club) => {
        if (!q) return true;
        return [club.name, club.description, club.category].join(' ').toLowerCase().includes(q);
      })
      .sort((a, b) => b.memberCount - a.memberCount);
  }, [clubs, deferredQuery, filter]);

  const featuredClub = filteredClubs[0] ?? null;
  const otherClubs = filteredClubs.slice(1);
  const hasDirectoryFilter = Boolean(filter || deferredQuery.trim());
  const tonightMeetings = useMemo(
    () =>
      [...meetingsToday].sort(
        (a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime(),
      ),
    [meetingsToday],
  );

  const handleJoinClub = async (clubId: string) => {
    setJoiningClubId(clubId);
    const previousClubs = clubs;
    setClubs((current) =>
      current.map((club) =>
        club.id === clubId
          ? {
              ...club,
              isMember: true,
              memberCount: club.isMember ? club.memberCount : club.memberCount + 1,
            }
          : club,
      ),
    );
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
      Alert.alert(
        'Could not open club onboarding',
        'Visit joinbridgeapp.com/clubs to list your organization.',
      );
    }
  };

  const openClub = useCallback(
    (clubId: string) => navigation.navigate('ClubDetail', { clubId }),
    [navigation],
  );

  const featuredAccent = featuredClub ? clubAccent(colors, featuredClub.category) : null;
  const featuredVisual = clubCategoryVisual(featuredClub?.category);
  const featuredMeeting = featuredClub
    ? tonightMeetings.find((item) => item.clubId === featuredClub.id)
    : undefined;

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Masthead */}
        <Animated.View entering={FadeInDown.duration(motion.durBase)}>
          <View style={styles.masthead}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.kicker, { color: colors.primary }]}>CAMPUS ORGS</Text>
              <Text style={styles.pageTitle}>CLUBS.</Text>
              {loaded && clubs.length ? (
                <Text style={[typography.caption, { marginTop: 6 }]}>
                  {clubs.length} organization{clubs.length === 1 ? '' : 's'}
                  {tonightMeetings.length
                    ? ` • ${tonightMeetings.length} meeting${tonightMeetings.length === 1 ? '' : 's'} tonight`
                    : ''}
                </Text>
              ) : null}
            </View>
            <IconButton
              icon="add"
              size={48}
              color={colors.primary}
              iconColor={colors.onPrimary}
              onPress={() => void handleListClub()}
              accessibilityLabel="List your club"
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(motion.stagger).duration(motion.durBase)}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search clubs and communities"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(motion.stagger * 2).duration(motion.durBase)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip label="All" icon="apps" selected={!filter} onPress={() => setFilter(null)} />
            {CLUB_CATEGORIES.map((item) => (
              <Chip
                key={item}
                label={item}
                icon={clubCategoryVisual(item).icon}
                selected={filter === item}
                tint={filter === item ? clubAccent(colors, item).soft : undefined}
                onPress={() => setFilter(filter === item ? null : item)}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {/* Tonight rail */}
        {loaded && tonightMeetings.length ? (
          <Animated.View
            entering={FadeInDown.delay(motion.stagger * 3).duration(motion.durBase)}
            style={styles.section}
          >
            <SectionHeader
              kicker="IRL"
              title="Happening tonight"
              actionLabel="See all"
              onAction={() => navigation.navigate('ClubMeetingsTonight')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
            >
              {tonightMeetings.slice(0, 8).map((meeting, index) => (
                <Slab
                  key={meeting.id}
                  onPress={() => openClub(meeting.clubId)}
                  tilt={index % 2 === 0 ? -0.8 : 0.8}
                  style={styles.tonightCard}
                  faceStyle={styles.tonightFace}
                  accessibilityLabel={`${meeting.clubName}, tonight at ${clockLabel(meeting.meetingTime)}`}
                >
                  <View style={styles.tonightTop}>
                    <Sticker
                      label={clockLabel(meeting.meetingTime)}
                      tint={colors.successSoft}
                      small
                      tilt={-2}
                    />
                    <Text style={styles.tonightEmoji}>{meeting.clubEmoji}</Text>
                  </View>
                  <Text style={typography.heading} numberOfLines={1}>
                    {meeting.clubName}
                  </Text>
                  <View style={styles.tonightMeta}>
                    <Ionicons name="location" size={12} color={colors.faint} />
                    <Text style={typography.captionSmall} numberOfLines={1}>
                      {meeting.location}
                    </Text>
                  </View>
                </Slab>
              ))}
            </ScrollView>
          </Animated.View>
        ) : null}

        {/* Spotlight */}
        <View style={styles.section}>
          <SectionHeader kicker="Big right now" title="Spotlight" />
          {!loaded ? (
            <SkeletonCard />
          ) : featuredClub && featuredAccent ? (
            <Animated.View entering={FadeInDown.delay(motion.stagger * 4).duration(motion.durBase)}>
              <Slab
                onPress={() => openClub(featuredClub.id)}
                color={featuredAccent.soft}
                radius={radii.lg}
                faceStyle={styles.spotlightFace}
                accessibilityLabel={`Open ${featuredClub.name}`}
              >
                <View style={styles.spotlightTop}>
                  <Sticker
                    label={featuredClub.category ?? 'Club'}
                    tint={colors.surface}
                    icon={featuredVisual.icon}
                    tilt={-2}
                    small
                  />
                  {featuredClub.isVerified ? (
                    <Sticker
                      label="Verified"
                      tint={colors.successSoft}
                      icon="checkmark-circle"
                      tilt={2}
                      small
                    />
                  ) : null}
                </View>

                <View style={styles.spotlightIdentity}>
                  <View
                    style={[
                      styles.spotlightAvatar,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    {featuredClub.avatarUrl ? (
                      <Image
                        source={{ uri: featuredClub.avatarUrl }}
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <Text style={styles.spotlightEmoji}>{featuredClub.emoji}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.spotlightTitle} numberOfLines={2}>
                      {featuredClub.name}
                    </Text>
                    <Text style={typography.caption}>{memberLabel(featuredClub.memberCount)}</Text>
                  </View>
                </View>

                <Text style={[typography.body, { color: colors.sub }]} numberOfLines={2}>
                  {featuredClub.description}
                </Text>

                <View style={styles.spotlightFooter}>
                  <View style={styles.spotlightSignal}>
                    <Ionicons
                      name={featuredMeeting ? 'radio' : 'calendar'}
                      size={14}
                      color={featuredMeeting ? colors.success : colors.sub}
                    />
                    <Text style={[typography.caption, { flex: 1 }]} numberOfLines={1}>
                      {meetingLabel(featuredClub, featuredMeeting)}
                    </Text>
                  </View>
                  <Button
                    label={
                      joiningClubId === featuredClub.id
                        ? 'Joining…'
                        : featuredClub.isMember
                          ? 'Open'
                          : 'Join'
                    }
                    size="sm"
                    onPress={() =>
                      featuredClub.isMember
                        ? openClub(featuredClub.id)
                        : void handleJoinClub(featuredClub.id)
                    }
                    disabled={joiningClubId === featuredClub.id}
                  />
                </View>
              </Slab>
            </Animated.View>
          ) : (
            <EmptyState
              icon="megaphone"
              title={hasDirectoryFilter ? 'No clubs match that search' : 'Clubs are getting set up'}
              body={
                hasDirectoryFilter
                  ? 'Try another category, clear the filter, or search across the full directory.'
                  : 'Student organizations will appear here as leaders finish their Bridge pages.'
              }
              actionLabel={hasDirectoryFilter ? 'Clear filter' : undefined}
              onAction={
                hasDirectoryFilter
                  ? () => {
                      setFilter(null);
                      setQuery('');
                    }
                  : undefined
              }
            />
          )}
        </View>

        {/* Directory grid */}
        {!loaded ? (
          <View style={styles.section}>
            <SectionHeader kicker="A to Z" title="Directory" />
            <View style={styles.grid}>
              {[0, 1, 2, 3].map((item) => (
                <SkeletonCard key={item} compact style={styles.gridItem} />
              ))}
            </View>
          </View>
        ) : otherClubs.length ? (
          <View style={styles.section}>
            <SectionHeader kicker="A to Z" title="Directory" />
            <View style={styles.grid}>
              {otherClubs.map((club, index) => {
                const visual = clubCategoryVisual(club.category);
                const accent = clubAccent(colors, club.category);
                const meeting = tonightMeetings.find((item) => item.clubId === club.id);
                return (
                  <Animated.View
                    key={club.id}
                    entering={FadeInDown.delay(Math.min(index, 6) * motion.stagger).duration(
                      motion.durBase,
                    )}
                    style={styles.gridItem}
                  >
                    <Slab
                      onPress={() => openClub(club.id)}
                      style={{ flex: 1 }}
                      faceStyle={styles.gridFace}
                      accessibilityLabel={`Open ${club.name}`}
                    >
                      <View style={styles.gridTop}>
                        <View
                          style={[
                            styles.gridAvatar,
                            { backgroundColor: accent.soft, borderColor: colors.border },
                          ]}
                        >
                          {club.avatarUrl ? (
                            <Image
                              source={{ uri: club.avatarUrl }}
                              style={{ width: '100%', height: '100%' }}
                            />
                          ) : (
                            <Text style={styles.gridEmoji}>{club.emoji}</Text>
                          )}
                        </View>
                        {club.isVerified ? (
                          <Ionicons name="checkmark-circle" size={18} color={accent.tint} />
                        ) : null}
                      </View>
                      <Text style={styles.gridTitle} numberOfLines={2}>
                        {club.name}
                      </Text>
                      <Text style={typography.captionSmall} numberOfLines={1}>
                        {memberLabel(club.memberCount)}
                      </Text>
                      <View style={[styles.gridFooter, { borderTopColor: colors.borderSoft }]}>
                        <View style={styles.gridSignal}>
                          <Ionicons
                            name={meeting ? 'radio' : visual.icon}
                            size={12}
                            color={meeting ? colors.success : colors.faint}
                          />
                          <Text style={typography.captionSmall} numberOfLines={1}>
                            {shortMeetingLabel(club, meeting)}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.gridAction,
                            {
                              backgroundColor: club.isMember ? colors.surfaceAlt : colors.primary,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <Ionicons
                            name={club.isMember ? 'arrow-forward' : 'add'}
                            size={15}
                            color={club.isMember ? colors.ink : colors.onPrimary}
                            onPress={() =>
                              club.isMember ? openClub(club.id) : void handleJoinClub(club.id)
                            }
                          />
                        </View>
                      </View>
                    </Slab>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: DOCK_CLEARANCE,
    gap: spacing.lg,
  },
  masthead: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
  },
  pageTitle: {
    fontFamily: fonts.displayHeavy,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -1,
    color: t.colors.ink,
    marginTop: 4,
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.xl,
    paddingVertical: 4,
  },
  section: {
    gap: spacing.md,
  },
  rail: {
    gap: spacing.md,
    paddingRight: spacing.xl,
    paddingVertical: 4,
  },
  tonightCard: {
    width: 170,
  },
  tonightFace: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  tonightTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  tonightEmoji: {
    fontSize: 24,
    lineHeight: 30,
  },
  tonightMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  spotlightFace: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  spotlightTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  spotlightIdentity: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  spotlightAvatar: {
    width: 62,
    height: 62,
    borderRadius: radii.md,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
    transform: [{ rotate: '-3deg' }],
  },
  spotlightEmoji: {
    fontSize: 30,
    lineHeight: 38,
  },
  spotlightTitle: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: t.colors.ink,
  },
  spotlightFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  spotlightSignal: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.md,
  },
  gridItem: {
    flexBasis: '46%' as const,
    flexGrow: 1,
  },
  gridFace: {
    flex: 1,
    padding: spacing.md,
    gap: 5,
  },
  gridTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 3,
  },
  gridAvatar: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
    transform: [{ rotate: '-2deg' }],
  },
  gridEmoji: {
    fontSize: 21,
    lineHeight: 27,
  },
  gridTitle: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    lineHeight: 18,
    minHeight: 36,
    color: t.colors.ink,
  },
  gridFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
    marginTop: 'auto' as const,
    paddingTop: 8,
    borderTopWidth: 2,
    borderStyle: 'dashed' as const,
  },
  gridSignal: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  gridAction: {
    width: 30,
    height: 30,
    borderRadius: radii.xs,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    transform: [{ rotate: '3deg' }],
  },
}));
