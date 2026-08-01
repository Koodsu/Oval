import React, { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  getApiErrorMessage,
  getClubs,
  getClubsToday,
  getMyClubs,
  joinClub,
  PUBLIC_SITE_URL,
} from '../../api';
import type { ClubDirectoryEntry, ClubMeetingToday, MyClubMembershipRow } from '../../types';
import type { RootStackParamList } from '../../../App';
import {
  AppBackdrop,
  Banner,
  Button,
  Chip,
  IconButton,
  SearchBar,
  SkeletonCard,
  useDockClearance,
} from '../../components/ui';
import { ClubPhoto } from '../../components/clubs';
import { CLUB_CATEGORIES, clubCategoryMatches } from '../../constants/clubCategories';
import { clubCategoryImageForKey } from '../../constants/contentImages';
import { clubAccent } from '../../constants/clubVisuals';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  elevation,
  motion,
  radii,
  spacing,
  useTheme,
} from '../../theme';
import { formatTime } from '../../utils/format';
import { toast } from '../../lib/toast';

const EMPTY_CLUBS_ART = require('../../../assets/illustrations/spot/cold-start/04-clubs-bring-groups.png');
const EVENT_HERO = require('../../../assets/content/clubs/open-mic-hero.jpg');

type Nav = NativeStackNavigationProp<RootStackParamList>;
type InfoPanel = 'how' | 'verified' | null;

export type ClubsPreviewData = {
  clubs: ClubDirectoryEntry[];
  myClubs?: MyClubMembershipRow[];
  meetings?: ClubMeetingToday[];
};

export function getClubsSupplyState(
  clubs: ClubDirectoryEntry[],
  meetings: ClubMeetingToday[],
): 'empty' | 'sparse' | 'active' {
  if (clubs.length === 0) return 'empty';
  if (clubs.length <= 3 && meetings.length === 0) return 'sparse';
  return 'active';
}

function meetingSignal(club: ClubDirectoryEntry, meeting?: ClubMeetingToday): string {
  if (meeting) return `${formatTime(meeting.meetingTime)} · ${meeting.location}`;
  if (club.upcomingMeetingCount > 0) {
    return `${club.upcomingMeetingCount} upcoming event${club.upcomingMeetingCount === 1 ? '' : 's'}`;
  }
  return `${club.memberCount} member${club.memberCount === 1 ? '' : 's'} · ${club.category}`;
}

function myClubSignal(row: MyClubMembershipRow) {
  if (!row.nextMeeting) {
    return row.latestAnnouncement ? 'New announcement' : 'See what’s new';
  }
  const meetingDate = new Date(row.nextMeeting.meetingTime);
  const today = new Date();
  return meetingDate.toDateString() === today.toDateString()
    ? `Next: Today ${formatTime(row.nextMeeting.meetingTime)}`
    : `Next: ${meetingDate.toLocaleDateString([], { weekday: 'short' })} ${formatTime(row.nextMeeting.meetingTime)}`;
}

function EventHero({
  meeting,
  onPress,
}: {
  meeting: ClubMeetingToday;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const meetingHour = new Date(meeting.meetingTime).getHours();
  const eyebrow = meetingHour >= 17 ? 'Tonight near campus' : 'Happening near campus';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${meeting.title} from ${meeting.clubName}`}
      style={({ pressed }) => [styles.eventHero, pressed && styles.pressed]}
    >
      <Image source={EVENT_HERO} resizeMode="cover" style={styles.eventHeroPhoto} accessible={false} />
      <LinearGradient
        colors={[colors.primary, colors.primaryPress, 'transparent']}
        locations={[0, 0.38, 0.68]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.eventHeroShade}
      >
        <Text style={styles.heroEyebrow}>{eyebrow}</Text>
        <Text style={styles.heroTitle} numberOfLines={2}>{meeting.title}</Text>
        <Text style={styles.heroDescription} numberOfLines={1}>{meeting.clubName}</Text>
        <Text style={styles.heroMeta} numberOfLines={1}>
          {formatTime(meeting.meetingTime)} · {meeting.location}
        </Text>
        <View style={styles.heroButton}>
          <Text style={[styles.heroButtonText, { color: colors.primary }]}>View event</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function SparseSpotlight({
  club,
  meeting,
  joining,
  onOpen,
  onJoin,
}: {
  club: ClubDirectoryEntry;
  meeting?: ClubMeetingToday;
  joining: boolean;
  onOpen: () => void;
  onJoin: () => void;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const accent = clubAccent(colors, club.category);

  return (
    <View
      style={[
        styles.spotlight,
        { backgroundColor: accent.soft, borderColor: colors.border },
      ]}
    >
      <View style={styles.spotlightTop}>
        <View>
          <Text style={[typography.kicker, { color: accent.tint }]}>FOUNDING CLUB SPOTLIGHT</Text>
          <Text style={typography.caption}>One community can start a campus tradition.</Text>
        </View>
        <ClubPhoto
          name={club.name}
          category={club.category}
          uri={club.avatarUrl}
          size={68}
        />
      </View>
      <Text style={styles.spotlightTitle}>{club.name}</Text>
      <Text style={typography.body} numberOfLines={3}>{club.description}</Text>
      <View style={styles.spotlightMeta}>
        <View style={[styles.metaPill, { backgroundColor: colors.surface }]}>
          <Ionicons name="people-outline" size={14} color={colors.sub} />
          <Text style={typography.captionSmall}>
            {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={[styles.metaPill, { backgroundColor: colors.surface }]}>
          <Ionicons name="calendar-outline" size={14} color={colors.sub} />
          <Text style={typography.captionSmall}>
            {meeting ? formatTime(meeting.meetingTime) : 'Be part of what’s next'}
          </Text>
        </View>
      </View>
      <Button
        label={club.isMember ? 'Open club' : 'Join the founding community'}
        icon={club.isMember ? 'arrow-forward' : 'add'}
        loading={joining}
        onPress={club.isMember ? onOpen : onJoin}
      />
    </View>
  );
}

function MyClubCard({
  membership,
  onPress,
}: {
  membership: MyClubMembershipRow;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${membership.club.name}`}
      style={({ pressed }) => [
        styles.myClubCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <ClubPhoto
        name={membership.club.name}
        category={membership.club.category}
        uri={membership.club.avatarUrl}
        size={66}
      />
      <Text style={[typography.subheading, styles.myClubName]} numberOfLines={2}>
        {membership.club.name}
      </Text>
      <Text style={[typography.captionSmall, styles.myClubSignal]} numberOfLines={1}>
        {myClubSignal(membership)}
      </Text>
      {membership.unreadCount ? (
        <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
      ) : null}
    </Pressable>
  );
}

function FindYourCornerCard({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Browse clubs"
      style={({ pressed }) => [
        styles.findCornerCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.findCornerCopy}>
        <Text style={styles.findCornerTitle}>Find your corner of campus</Text>
        <Text style={typography.caption}>
          Join clubs, meet people, and do what you love.
        </Text>
        <View style={styles.findCornerAction}>
          <Text style={[styles.findCornerActionText, { color: colors.primary }]}>
            Browse clubs
          </Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </View>
      </View>
      <View style={styles.findCornerCollage} pointerEvents="none">
        <View style={styles.findCornerPhotoTall}>
          <Image
            source={clubCategoryImageForKey('Music & Entertainment')}
            resizeMode="cover"
            style={styles.findCornerPhotoFill}
            accessible={false}
          />
        </View>
        <View style={styles.findCornerPhotoStack}>
          <Image
            source={clubCategoryImageForKey('Academic')}
            resizeMode="cover"
            style={[styles.findCornerPhoto, styles.findCornerStackPhoto]}
            accessible={false}
          />
          <Image
            source={clubCategoryImageForKey('Sports')}
            resizeMode="cover"
            style={[styles.findCornerPhoto, styles.findCornerStackPhoto]}
            accessible={false}
          />
        </View>
      </View>
    </Pressable>
  );
}

function DirectoryRow({
  club,
  signal,
  joining,
  onOpen,
  onJoin,
}: {
  club: ClubDirectoryEntry;
  signal: string;
  joining: boolean;
  onOpen: () => void;
  onJoin: () => void;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open ${club.name}`}
      style={({ pressed }) => [styles.directoryRow, pressed && styles.pressed]}
    >
      <ClubPhoto name={club.name} category={club.category} uri={club.avatarUrl} size={46} />
      <View style={styles.rowCopy}>
        <View style={styles.nameLine}>
          <Text style={[typography.subheading, styles.rowName]} numberOfLines={1}>{club.name}</Text>
          {club.isVerified ? <Ionicons name="checkmark-circle" size={14} color={colors.success} /> : null}
        </View>
        <Text style={typography.captionSmall} numberOfLines={1}>{signal}</Text>
      </View>
      {club.isMember ? (
        <Ionicons name="chevron-forward" size={18} color={colors.sub} />
      ) : (
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onJoin();
          }}
          disabled={joining}
          accessibilityRole="button"
          accessibilityLabel={`Join ${club.name}`}
          style={({ pressed }) => [
            styles.joinButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.joinText, { color: colors.onPrimary }]}>
            {joining ? '…' : 'Join'}
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
}

function TonightMeetingRow({
  meeting,
  club,
  onPress,
}: {
  meeting: ClubMeetingToday;
  club?: ClubDirectoryEntry;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${meeting.title} from ${meeting.clubName}`}
      style={({ pressed }) => [styles.tonightRow, pressed && styles.pressed]}
    >
      <ClubPhoto
        name={meeting.clubName}
        category={club?.category}
        uri={club?.avatarUrl}
        size={48}
      />
      <View style={styles.rowCopy}>
        <Text style={typography.subheading} numberOfLines={1}>{meeting.title}</Text>
        <Text style={typography.captionSmall} numberOfLines={1}>
          {formatTime(meeting.meetingTime)} · {meeting.location}
        </Text>
        <Text style={[typography.captionSmall, { color: colors.ink }]} numberOfLines={1}>
          {meeting.clubName}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.sub} />
    </Pressable>
  );
}

function MissingOrganizationCard({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Bring your club"
      style={({ pressed }) => [
        styles.missingOrgCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.missingOrgTop}>
        <View style={styles.rowCopy}>
          <Text style={typography.heading}>Missing your organization?</Text>
          <Text style={typography.caption}>Bring your club to Oval and build your community.</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.ink} />
      </View>
      <View style={styles.missingOrgAction}>
        <Ionicons name="add" size={19} color={colors.primary} />
        <Text style={[styles.missingOrgActionText, { color: colors.primary }]}>Bring your club</Text>
      </View>
    </Pressable>
  );
}

function CampusEmptyState({
  onCreate,
  onInvite,
}: {
  onCreate: () => void;
  onInvite: () => void;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const [notified, setNotified] = useState(false);
  const [openPanel, setOpenPanel] = useState<InfoPanel>(null);
  const interestChips = [
    { label: 'Academic', tint: colors.blueSoft },
    { label: 'Sports', tint: colors.greenSoft },
    { label: 'Arts', tint: colors.pinkSoft },
    { label: 'Faith', tint: colors.amberSoft },
    { label: 'Culture', tint: colors.violetSoft },
    { label: 'Wellness', tint: colors.tealSoft },
  ];

  const togglePanel = (panel: Exclude<InfoPanel, null>) =>
    setOpenPanel((current) => (current === panel ? null : panel));

  return (
    <View style={styles.emptyState}>
      <Image
        source={EMPTY_CLUBS_ART}
        resizeMode="contain"
        accessible
        accessibilityLabel="Students talking together outside a campus building"
        style={styles.emptyIllustration}
      />
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>Bring campus groups to Oval</Text>
        <Text style={[typography.body, styles.emptyBody]}>
          Be the first to create the clubs that matter to your community.
        </Text>
      </View>
      <View style={styles.emptyActions}>
        <Button label="Create a club" icon="add" size="lg" onPress={onCreate} />
        <Button
          label="Invite your organization"
          icon="people-outline"
          size="lg"
          variant="secondary"
          onPress={onInvite}
        />
      </View>

      <View style={[styles.interestCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={typography.heading}>Popular interests on campus</Text>
        <View style={styles.interestChips}>
          {interestChips.map((chip) => (
            <View key={chip.label} style={[styles.interestChip, { backgroundColor: chip.tint }]}>
              <Text style={[typography.chip, { color: colors.ink }]}>{chip.label}</Text>
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => {
            setNotified((value) => !value);
            toast.success(
              notified ? 'Club interest reminder removed' : 'You’re on the list',
              notified ? undefined : 'We’ll surface new campus clubs here as they arrive.',
            );
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: notified }}
          style={[
            styles.notifyButton,
            { backgroundColor: notified ? colors.successSoft : colors.primarySoft },
          ]}
        >
          <Ionicons
            name={notified ? 'checkmark' : 'notifications-outline'}
            size={15}
            color={notified ? colors.success : colors.primary}
          />
          <Text style={[styles.notifyText, { color: notified ? colors.success : colors.primary }]}>
            {notified ? 'You’ll hear about new clubs' : 'Notify me'}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          onPress={() => togglePanel('how')}
          accessibilityRole="button"
          accessibilityState={{ expanded: openPanel === 'how' }}
          style={styles.infoRow}
        >
          <Ionicons name="information-circle-outline" size={25} color={colors.ink} />
          <View style={styles.rowCopy}>
            <Text style={typography.subheading}>How clubs work on Oval</Text>
          </View>
          <Text style={[typography.captionSmall, { color: colors.ink }]}>Learn more</Text>
          <Ionicons
            name={openPanel === 'how' ? 'chevron-up' : 'chevron-forward'}
            size={18}
            color={colors.sub}
          />
        </Pressable>
        {openPanel === 'how' ? (
          <Text style={[typography.caption, styles.infoDetail]}>
            Clubs bring members, announcements, chat, and campus events together in one verified home.
          </Text>
        ) : null}
        <View style={[styles.infoDivider, { backgroundColor: colors.borderSoft }]} />
        <Pressable
          onPress={() => togglePanel('verified')}
          accessibilityRole="button"
          accessibilityState={{ expanded: openPanel === 'verified' }}
          style={styles.infoRow}
        >
          <Ionicons name="shield-checkmark-outline" size={25} color={colors.ink} />
          <View style={styles.rowCopy}>
            <Text style={typography.subheading}>Verified organizers, real community</Text>
            <Text style={typography.captionSmall}>Clubs are run by verified students and campus organizations.</Text>
          </View>
          <Ionicons
            name={openPanel === 'verified' ? 'chevron-up' : 'chevron-forward'}
            size={18}
            color={colors.sub}
          />
        </Pressable>
        {openPanel === 'verified' ? (
          <Text style={[typography.caption, styles.infoDetail]}>
            Organizer verification protects campus identity while club controls keep membership and events manageable.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ClubsHomeScreen({
  embedded,
  previewData,
}: {
  embedded?: boolean;
  previewData?: ClubsPreviewData;
} = {}) {
  const navigation = useNavigation<Nav>();
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const dockClearance = useDockClearance();
  const [clubs, setClubs] = useState<ClubDirectoryEntry[]>(previewData?.clubs ?? []);
  const [myClubs, setMyClubs] = useState<MyClubMembershipRow[]>(previewData?.myClubs ?? []);
  const [meetings, setMeetings] = useState<ClubMeetingToday[]>(previewData?.meetings ?? []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(Boolean(previewData));
  const [refreshing, setRefreshing] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [showAllDiscover, setShowAllDiscover] = useState(false);
  const [showAllMine, setShowAllMine] = useState(false);
  const [pageSectionsY, setPageSectionsY] = useState(0);
  const [discoverY, setDiscoverY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const deferredQuery = useDeferredValue(query);

  const load = useCallback(async () => {
    if (previewData) {
      setClubs(previewData.clubs);
      setMyClubs(previewData.myClubs ?? []);
      setMeetings(previewData.meetings ?? []);
      setWarning(null);
      setLoaded(true);
      setRefreshing(false);
      return;
    }
    try {
      const [directory, memberships, today] = await Promise.all([
        getClubs(),
        getMyClubs(),
        getClubsToday(),
      ]);
      setClubs(directory);
      setMyClubs(memberships);
      setMeetings(today);
      setWarning(null);
    } catch {
      setWarning("Couldn’t refresh clubs. Pull to try again.");
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, [previewData]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const membershipIds = useMemo(() => new Set(myClubs.map((row) => row.club.id)), [myClubs]);
  const tonightByClub = useMemo(
    () => new Map(meetings.map((meeting) => [meeting.clubId, meeting])),
    [meetings],
  );
  const clubById = useMemo(() => new Map(clubs.map((club) => [club.id, club])), [clubs]);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const supplyState = getClubsSupplyState(clubs, meetings);

  const discover = useMemo(() => {
    return [...clubs]
      .filter((club) => !membershipIds.has(club.id))
      .filter((club) => clubCategoryMatches(club.category, filter))
      .filter((club) =>
        !normalizedQuery ||
        [club.name, club.description, club.category].join(' ').toLowerCase().includes(normalizedQuery),
      )
      .sort((a, b) => {
        const meetingDelta = Number(tonightByClub.has(b.id)) - Number(tonightByClub.has(a.id));
        if (meetingDelta) return meetingDelta;
        const upcomingDelta = b.upcomingMeetingCount - a.upcomingMeetingCount;
        if (upcomingDelta) return upcomingDelta;
        return b.memberCount - a.memberCount;
      });
  }, [clubs, filter, membershipIds, normalizedQuery, tonightByClub]);

  const sortedMeetings = useMemo(
    () => [...meetings].sort((a, b) => +new Date(a.meetingTime) - +new Date(b.meetingTime)),
    [meetings],
  );
  const featuredMeeting = sortedMeetings[0];
  const visibleDiscover = showAllDiscover || normalizedQuery || filter ? discover : discover.slice(0, 3);
  const visibleMine = showAllMine ? myClubs : myClubs.slice(0, 3);

  const handleJoin = async (club: ClubDirectoryEntry) => {
    setJoiningId(club.id);
    try {
      await joinClub(club.id);
      await load();
      toast.success(`Joined ${club.name}`);
    } catch (error) {
      toast.error('Could not join club', getApiErrorMessage(error));
    } finally {
      setJoiningId(null);
    }
  };

  const openClub = (clubId: string) => navigation.navigate('ClubDetail', { clubId });
  const inviteOrganization = async () => {
    try {
      await Share.share({
        title: 'Bring your organization to Oval',
        message: `Bring your campus organization to Oval: ${PUBLIC_SITE_URL}`,
        url: PUBLIC_SITE_URL,
      });
    } catch (error) {
      toast.error('Could not open sharing', getApiErrorMessage(error));
    }
  };

  return (
    <AppBackdrop>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: embedded ? spacing.md : insets.top + spacing.md,
            paddingBottom: dockClearance,
          },
        ]}
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
      >
        <View style={styles.masthead}>
          <Text style={styles.title}>Clubs</Text>
          <IconButton
            icon="add-circle-outline"
            size={46}
            onPress={() => navigation.navigate('CreateClub')}
            accessibilityLabel="Create a club"
          />
        </View>

        {warning ? <Banner message={warning} kind="info" /> : null}

        {!loaded ? (
          <View style={styles.loading}>
            <SkeletonCard />
            <SkeletonCard compact />
            <SkeletonCard />
          </View>
        ) : supplyState === 'empty' ? (
          <CampusEmptyState
            onCreate={() => navigation.navigate('CreateClub')}
            onInvite={() => void inviteOrganization()}
          />
        ) : (
          <View
            style={styles.pageSections}
            onLayout={(event) => setPageSectionsY(event.nativeEvent.layout.y)}
          >
            {myClubs.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>My clubs</Text>
                  {myClubs.length > 3 ? (
                    <Pressable
                      onPress={() => setShowAllMine((value) => !value)}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.sectionAction, { color: colors.primary }]}>
                        {showAllMine ? 'Show less' : 'See all'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.myClubsGrid}>
                  {visibleMine.map((membership, index) => (
                    <Animated.View
                      key={membership.club.id}
                      entering={FadeInDown.delay(index * motion.stagger).duration(motion.durBase)}
                      style={styles.myClubGridItem}
                    >
                      <MyClubCard
                        membership={membership}
                        onPress={() => openClub(membership.club.id)}
                      />
                    </Animated.View>
                  ))}
                </View>
              </View>
            ) : (
              <FindYourCornerCard
                onPress={() => {
                  setQuery('');
                  setFilter(null);
                  setShowAllDiscover(false);
                  scrollRef.current?.scrollTo({
                    y: Math.max(0, pageSectionsY + discoverY - spacing.md),
                    animated: true,
                  });
                }}
              />
            )}

            {!featuredMeeting &&
            supplyState === 'sparse' &&
            clubs[0] &&
            !membershipIds.has(clubs[0].id) ? (
              <SparseSpotlight
                club={clubs[0]}
                meeting={tonightByClub.get(clubs[0].id)}
                joining={joiningId === clubs[0].id}
                onOpen={() => openClub(clubs[0]!.id)}
                onJoin={() => void handleJoin(clubs[0]!)}
              />
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Tonight on campus</Text>
                  <Text style={typography.caption}>
                    {meetings.length
                      ? `${meetings.length} club${meetings.length === 1 ? '' : 's'} meeting tonight`
                      : 'See what campus clubs have planned'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => navigation.navigate('ClubMeetingsTonight')}
                  accessibilityRole="button"
                  accessibilityLabel="See all club meetings"
                >
                  <Text style={[styles.sectionAction, { color: colors.primary }]}>
                    {meetings.length ? 'See all' : 'This week'}
                  </Text>
                </Pressable>
              </View>
              {featuredMeeting ? (
                <>
                  <EventHero
                    meeting={featuredMeeting}
                    onPress={() =>
                      navigation.navigate('ClubMeeting', {
                        clubId: featuredMeeting.clubId,
                        meetingId: featuredMeeting.id,
                      })
                    }
                  />
                  {meetings.length > 1 ? (
                    <View
                      style={[
                        styles.tonightList,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      {sortedMeetings.slice(1, 4).map((meeting, index) => (
                        <React.Fragment key={meeting.id}>
                          {index > 0 ? (
                            <View style={[styles.tonightDivider, { backgroundColor: colors.borderSoft }]} />
                          ) : null}
                          <TonightMeetingRow
                            meeting={meeting}
                            club={clubById.get(meeting.clubId)}
                            onPress={() =>
                              navigation.navigate('ClubMeeting', {
                                clubId: meeting.clubId,
                                meetingId: meeting.id,
                              })
                            }
                          />
                        </React.Fragment>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <Pressable
                  onPress={() => navigation.navigate('ClubMeetingsTonight')}
                  accessibilityRole="button"
                  accessibilityLabel="View this week's club meetings"
                  style={[
                    styles.noMeetingsCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.noMeetingsIcon, { backgroundColor: colors.blueSoft }]}>
                    <Ionicons name="calendar-outline" size={23} color={colors.blue} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={typography.subheading}>No meetings posted for tonight</Text>
                    <Text style={typography.captionSmall}>Browse the week or check back as clubs add events.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.sub} />
                </Pressable>
              )}
            </View>

            <View
              style={styles.section}
              onLayout={(event) => setDiscoverY(event.nativeEvent.layout.y)}
            >
              <Text style={styles.sectionTitle}>Discover clubs</Text>
              <SearchBar
                value={query}
                onChangeText={(value) => {
                  setQuery(value);
                  setShowAllDiscover(true);
                }}
                placeholder="Search clubs"
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRail}
              >
                <Chip
                  label="All"
                  selected={!filter}
                  onPress={() => {
                    setFilter(null);
                    setShowAllDiscover(false);
                  }}
                />
                {CLUB_CATEGORIES.map((category) => (
                  <Chip
                    key={category}
                    label={category}
                    selected={filter === category}
                    tint={clubAccent(colors, category).tint}
                    onPress={() => {
                      setFilter(filter === category ? null : category);
                      setShowAllDiscover(true);
                    }}
                  />
                ))}
              </ScrollView>

              <View style={[styles.directoryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {visibleDiscover.map((club, index) => (
                  <React.Fragment key={club.id}>
                    {index > 0 ? (
                      <View style={[styles.rowDivider, { backgroundColor: colors.borderSoft }]} />
                    ) : null}
                    <Animated.View
                      entering={FadeInDown.delay(Math.min(index, 5) * motion.stagger).duration(motion.durBase)}
                    >
                      <DirectoryRow
                        club={club}
                        signal={meetingSignal(club, tonightByClub.get(club.id))}
                        joining={joiningId === club.id}
                        onOpen={() => openClub(club.id)}
                        onJoin={() => void handleJoin(club)}
                      />
                    </Animated.View>
                  </React.Fragment>
                ))}

                {visibleDiscover.length === 0 ? (
                  <View style={styles.noResults}>
                    <View style={[styles.noResultsIcon, { backgroundColor: colors.surfaceAlt }]}>
                      <Ionicons name="search" size={22} color={colors.sub} />
                    </View>
                    <Text style={typography.subheading}>
                      {membershipIds.size === clubs.length && clubs.length
                        ? 'You joined every club'
                        : 'No clubs match'}
                    </Text>
                    <Text style={[typography.caption, styles.noResultsCopy]}>
                      {membershipIds.size === clubs.length && clubs.length
                        ? 'Your whole campus directory is already in My clubs.'
                        : 'Try another search or clear the category filter.'}
                    </Text>
                    {(query || filter) ? (
                      <Button
                        label="Clear filters"
                        size="sm"
                        variant="secondary"
                        onPress={() => {
                          setQuery('');
                          setFilter(null);
                          setShowAllDiscover(false);
                        }}
                      />
                    ) : null}
                  </View>
                ) : null}

                {discover.length > 3 && !normalizedQuery && !filter ? (
                  <>
                    <View style={[styles.rowDivider, { backgroundColor: colors.borderSoft }]} />
                    <Pressable
                      onPress={() => setShowAllDiscover((value) => !value)}
                      accessibilityRole="button"
                      style={styles.seeAllRow}
                    >
                      <Text style={typography.subheading}>
                        {showAllDiscover ? 'Show fewer clubs' : `See all ${discover.length} clubs`}
                      </Text>
                      <Ionicons
                        name={showAllDiscover ? 'chevron-up' : 'chevron-forward'}
                        size={18}
                        color={colors.ink}
                      />
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>

            <MissingOrganizationCard onPress={() => navigation.navigate('CreateClub')} />
          </View>
        )}
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  masthead: {
    minHeight: 48,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800' as const,
    letterSpacing: -0.7,
    color: t.colors.ink,
  },
  loading: { gap: spacing.md },
  pageSections: { gap: spacing.xxl },
  pressed: { opacity: 0.82, transform: [{ scale: 0.992 }] },
  findCornerCard: {
    minHeight: 178,
    borderWidth: BORDER_W,
    borderRadius: radii.lg,
    overflow: 'hidden' as const,
    ...elevation.card,
  },
  findCornerCopy: {
    width: '57%',
    minHeight: 178,
    padding: spacing.lg,
    justifyContent: 'center' as const,
    gap: spacing.sm,
    zIndex: 1,
  },
  findCornerTitle: {
    color: t.colors.ink,
    fontSize: 23,
    lineHeight: 27,
    fontWeight: '800' as const,
    letterSpacing: -0.45,
  },
  findCornerAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  findCornerActionText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700' as const,
  },
  findCornerCollage: {
    position: 'absolute' as const,
    width: '43%',
    top: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row' as const,
    gap: 5,
  },
  findCornerPhoto: {
    flex: 1,
    borderRadius: radii.sm,
    backgroundColor: t.colors.surfaceAlt,
  },
  findCornerStackPhoto: {
    width: '100%',
  },
  findCornerPhotoTall: {
    flex: 0.9,
    height: '100%',
    alignSelf: 'stretch' as const,
    borderRadius: radii.sm,
    overflow: 'hidden' as const,
    backgroundColor: t.colors.surfaceAlt,
  },
  findCornerPhotoFill: {
    width: '100%',
    height: '100%',
  },
  findCornerPhotoStack: {
    flex: 1,
    gap: 5,
  },
  eventHero: {
    height: 222,
    borderRadius: radii.md,
    overflow: 'hidden' as const,
    backgroundColor: t.colors.primary,
    ...elevation.card,
  },
  eventHeroPhoto: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  eventHeroShade: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center' as const,
    alignItems: 'flex-start' as const,
  },
  heroEyebrow: {
    color: t.colors.onPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700' as const,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    color: t.colors.onPrimary,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '800' as const,
    maxWidth: '62%',
  },
  heroDescription: {
    color: t.colors.onPrimary,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600' as const,
    maxWidth: '60%',
    marginTop: spacing.xs,
  },
  heroMeta: {
    color: t.colors.onPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
    maxWidth: '64%',
    marginTop: spacing.md,
  },
  heroButton: {
    backgroundColor: t.colors.onPrimary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    marginTop: spacing.lg,
  },
  heroButtonText: { fontSize: 13, lineHeight: 17, fontWeight: '700' as const },
  spotlight: {
    borderWidth: BORDER_W,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden' as const,
    ...elevation.card,
  },
  spotlightTop: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
  },
  spotlightTitle: {
    color: t.colors.ink,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  spotlightMeta: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  metaPill: {
    minHeight: 30,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
  },
  section: { gap: spacing.md },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  sectionTitle: {
    color: t.colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800' as const,
    letterSpacing: -0.25,
  },
  sectionAction: { fontSize: 14, lineHeight: 19, fontWeight: '700' as const },
  myClubsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginHorizontal: -spacing.xs,
    rowGap: spacing.sm,
  },
  myClubGridItem: {
    width: '33.333%',
    paddingHorizontal: spacing.xs,
  },
  myClubCard: {
    minHeight: 174,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...elevation.card,
  },
  myClubName: { textAlign: 'center' as const, marginTop: spacing.sm, minHeight: 38 },
  myClubSignal: { textAlign: 'center' as const, marginTop: spacing.xs },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute' as const,
    top: spacing.sm,
    right: spacing.sm,
  },
  categoryRail: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
    paddingVertical: spacing.xs,
  },
  directoryCard: {
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    overflow: 'hidden' as const,
    ...elevation.card,
  },
  directoryRow: {
    minHeight: 78,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  nameLine: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs },
  rowName: { flexShrink: 1 },
  joinButton: {
    minWidth: 62,
    height: 36,
    borderRadius: radii.button,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.md,
  },
  joinText: { fontSize: 13, lineHeight: 17, fontWeight: '700' as const },
  rowDivider: { height: BORDER_W, marginLeft: 70 },
  seeAllRow: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  noResults: {
    minHeight: 188,
    padding: spacing.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
  },
  noResultsIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  noResultsCopy: { textAlign: 'center' as const, maxWidth: 260 },
  tonightList: {
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    overflow: 'hidden' as const,
    ...elevation.card,
  },
  tonightRow: {
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  tonightDivider: { height: BORDER_W, marginLeft: 72 },
  noMeetingsCard: {
    minHeight: 78,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  noMeetingsIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  missingOrgCard: {
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.md,
    ...elevation.card,
  },
  missingOrgTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  missingOrgAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  missingOrgActionText: { fontSize: 14, lineHeight: 19, fontWeight: '700' as const },
  emptyState: { gap: spacing.xl },
  emptyIllustration: {
    width: '100%',
    height: 196,
    marginTop: -spacing.sm,
    marginBottom: -spacing.lg,
  },
  emptyCopy: { alignItems: 'center' as const, gap: spacing.sm },
  emptyTitle: {
    color: t.colors.ink,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
    textAlign: 'center' as const,
  },
  emptyBody: { textAlign: 'center' as const, maxWidth: 300 },
  emptyActions: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  interestCard: {
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  interestChips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
  },
  interestChip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  notifyButton: {
    minHeight: 38,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.xs,
  },
  notifyText: { fontSize: 13, lineHeight: 17, fontWeight: '700' as const },
  infoCard: {
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    overflow: 'hidden' as const,
  },
  infoRow: {
    minHeight: 68,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  infoDivider: { height: BORDER_W, marginLeft: 60 },
  infoDetail: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingLeft: 60 },
}));
