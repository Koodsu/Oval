import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../App';
import {
  getActivities,
  fetchFeed,
  getClubs,
  getClubsToday,
  joinClub,
  API_USER_MESSAGE,
} from '../api';
import { Activity, Pod, ClubDirectoryEntry, ClubMeetingToday } from '../types';
import ActivityCard from '../components/ActivityCard';
import FadeIn from '../components/FadeIn';
import ExplorePillRow from '../components/ExplorePillRow';
import { home, cardShadowHome, colors, spacing } from '../theme';
import { CATEGORIES, CATEGORY_META } from '../constants/categories';
import { getCategoryPillStyle } from '../utils/activityCategoryPill';
import { clubCircleBg } from '../utils/clubCircleBg';
import { filterActivitiesForExplore, ExploreTimeFilter } from '../utils/exploreActivityFilter';

type MainTab = 'activities' | 'clubs';

function formatScheduleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const CATEGORY_PILL_ITEMS = [
  { key: 'all', label: 'All' },
  ...CATEGORIES.map((c) => ({ key: c, label: CATEGORY_META[c].label })),
];

const TIME_PILL_ITEMS: { key: ExploreTimeFilter; label: string }[] = [
  { key: 'all', label: 'All Times' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
];

function ExploreSectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionHeaderDot} />
      <Text style={styles.sectionHeaderLabel}>{label}</Text>
    </View>
  );
}

export default function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const [mainTab, setMainTab] = useState<MainTab>('activities');

  const [activitiesQuery, setActivitiesQuery] = useState('');
  const [activityCategory, setActivityCategory] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<ExploreTimeFilter>('all');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [feedPods, setFeedPods] = useState<Pod[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesRefreshing, setActivitiesRefreshing] = useState(false);

  const [clubsQuery, setClubsQuery] = useState('');
  const [debouncedClubSearch, setDebouncedClubSearch] = useState('');
  const [clubCategory, setClubCategory] = useState<string | null>(null);
  const [clubs, setClubs] = useState<ClubDirectoryEntry[]>([]);
  const [meetingsToday, setMeetingsToday] = useState<ClubMeetingToday[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [clubsRefreshing, setClubsRefreshing] = useState(false);
  const [joiningClubId, setJoiningClubId] = useState<string | null>(null);

  useEffect(() => {
    const q = clubsQuery.trim();
    if (q === '') {
      setDebouncedClubSearch('');
      return;
    }
    const t = setTimeout(() => setDebouncedClubSearch(q), 400);
    return () => clearTimeout(t);
  }, [clubsQuery]);

  const loadActivitiesData = useCallback(async (opts?: { skipFullScreenLoading?: boolean }) => {
    if (!opts?.skipFullScreenLoading) setActivitiesLoading(true);
    try {
      const [acts, feed] = await Promise.all([
        getActivities(activityCategory ?? undefined),
        fetchFeed({ limit: 100 }),
      ]);
      setActivities(acts);
      setFeedPods(feed);
    } catch {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setActivitiesLoading(false);
      setActivitiesRefreshing(false);
    }
  }, [activityCategory]);

  const loadClubsData = useCallback(async (opts?: { skipFullScreenLoading?: boolean }) => {
    if (!opts?.skipFullScreenLoading) setClubsLoading(true);
    try {
      const [list, today] = await Promise.all([
        getClubs({
          category: clubCategory ?? undefined,
          search: debouncedClubSearch || undefined,
        }),
        getClubsToday(),
      ]);
      setClubs(list);
      setMeetingsToday(today);
    } catch {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setClubsLoading(false);
      setClubsRefreshing(false);
    }
  }, [clubCategory, debouncedClubSearch]);

  useFocusEffect(
    useCallback(() => {
      void loadActivitiesData();
    }, [loadActivitiesData])
  );

  useFocusEffect(
    useCallback(() => {
      void loadClubsData();
    }, [loadClubsData])
  );

  const filteredActivities = useMemo(
    () => filterActivitiesForExplore(activities, feedPods, timeFilter, activitiesQuery),
    [activities, feedPods, timeFilter, activitiesQuery]
  );

  const handleMainTab = (tab: MainTab) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMainTab(tab);
  };

  const handleJoinClub = async (clubId: string) => {
    setJoiningClubId(clubId);
    try {
      await joinClub(clubId);
      setClubs((prev) => prev.map((c) => (c.id === clubId ? { ...c, isMember: true, memberCount: c.memberCount + 1 } : c)));
    } catch {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setJoiningClubId(null);
    }
  };

  const activitiesSearchBar = (
    <View style={styles.searchBarOuter}>
      <View style={[styles.searchBar, cardShadowHome]}>
        <Ionicons name="search" size={18} color="#999999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search activities..."
          placeholderTextColor="#999999"
          value={activitiesQuery}
          onChangeText={setActivitiesQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        {activitiesQuery.length > 0 ? (
          <TouchableOpacity onPress={() => setActivitiesQuery('')} hitSlop={12}>
            <Ionicons name="close-circle" size={18} color="#999999" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const clubsSearchBar = (
    <View style={styles.searchBarOuter}>
      <View style={[styles.searchBar, cardShadowHome]}>
        <Ionicons name="search" size={18} color="#999999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clubs..."
          placeholderTextColor="#999999"
          value={clubsQuery}
          onChangeText={setClubsQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        {clubsQuery.length > 0 ? (
          <TouchableOpacity onPress={() => setClubsQuery('')} hitSlop={12}>
            <Ionicons name="close-circle" size={18} color="#999999" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const tabSwitcher = (
    <View style={styles.tabSwitcherWrap}>
      <TouchableOpacity
        style={[styles.tabSegment, mainTab === 'activities' && styles.tabSegmentActive]}
        onPress={() => handleMainTab('activities')}
        activeOpacity={0.85}
      >
        <Text style={[styles.tabSegmentText, mainTab === 'activities' && styles.tabSegmentTextActive]}>
          Activities
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabSegment, mainTab === 'clubs' && styles.tabSegmentActive]}
        onPress={() => handleMainTab('clubs')}
        activeOpacity={0.85}
      >
        <Text style={[styles.tabSegmentText, mainTab === 'clubs' && styles.tabSegmentTextActive]}>Clubs</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
        <Text style={styles.subtitle}>Find activities and clubs at OSU</Text>
      </View>

      {tabSwitcher}

      {mainTab === 'activities' ? (
        <>
          {activitiesSearchBar}
          <ExplorePillRow
            items={CATEGORY_PILL_ITEMS}
            selectedKey={activityCategory ?? 'all'}
            onSelect={(key) => setActivityCategory(key === 'all' ? null : key)}
          />
          <ExplorePillRow
            items={TIME_PILL_ITEMS.map((t) => ({ key: t.key, label: t.label }))}
            selectedKey={timeFilter}
            onSelect={(key) => setTimeFilter(key as ExploreTimeFilter)}
          />
          {activitiesLoading ? (
            <View style={styles.tabLoadingInner}>
              <ActivityIndicator size="large" color={colors.scarlet} />
            </View>
          ) : (
          <FlatList
            data={filteredActivities}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listPad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={activitiesRefreshing}
                onRefresh={() => {
                  setActivitiesRefreshing(true);
                  void loadActivitiesData({ skipFullScreenLoading: true });
                }}
                tintColor={home.scarlet}
              />
            }
            renderItem={({ item, index }) => (
              <FadeIn delay={index * 40}>
                <ActivityCard
                  variant="home"
                  activity={item}
                  onPress={() =>
                    navigation.navigate('PodList', {
                      activityId: item.id,
                      activityTitle: item.title,
                      activityCategory: item.category,
                    })
                  }
                />
              </FadeIn>
            )}
            ListEmptyComponent={
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyTitle}>No activities found</Text>
                <Text style={styles.emptySub}>
                  {activitiesQuery.trim() || timeFilter !== 'all' || activityCategory
                    ? 'Try another search, category, or time range.'
                    : 'Check back later for new activities.'}
                </Text>
              </View>
            }
          />
          )}
        </>
      ) : clubsLoading ? (
        <View style={styles.tabLoadingInner}>
          <ActivityIndicator size="large" color={colors.scarlet} />
        </View>
      ) : (
        <>
          {clubsSearchBar}
          <ExplorePillRow
            items={CATEGORY_PILL_ITEMS}
            selectedKey={clubCategory ?? 'all'}
            onSelect={(key) => setClubCategory(key === 'all' ? null : key)}
          />
          <FlatList
            data={clubs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listPad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={clubsRefreshing}
                onRefresh={() => {
                  setClubsRefreshing(true);
                  void loadClubsData({ skipFullScreenLoading: true });
                }}
                tintColor={home.scarlet}
              />
            }
            ListHeaderComponent={
              <View style={styles.clubsHeaderBlock}>
                <View style={styles.sectionHeaderPad}>
                  <ExploreSectionHeader label="MEETING TODAY" />
                </View>
                {meetingsToday.length === 0 ? (
                  <Text style={styles.meetingsEmpty}>No club meetings today</Text>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    nestedScrollEnabled={Platform.OS === 'android'}
                    contentContainerStyle={styles.meetingsRow}
                  >
                    {meetingsToday.map((m) => (
                      <View key={m.id} style={[styles.meetingCard, cardShadowHome]}>
                        <Text style={styles.meetingEmoji}>{m.clubEmoji}</Text>
                        <Text style={styles.meetingClubName} numberOfLines={1}>
                          {m.clubName}
                        </Text>
                        <Text style={styles.meetingTime}>{formatScheduleTime(m.meetingTime)}</Text>
                        <Text style={styles.meetingLocation} numberOfLines={1}>
                          {m.location}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
                <View style={[styles.sectionHeaderPad, { marginTop: spacing.md }]}>
                  <ExploreSectionHeader label="ALL CLUBS" />
                </View>
              </View>
            }
            renderItem={({ item }) => {
              const pill = getCategoryPillStyle(item.category);
              return (
                <View style={[styles.clubCard, cardShadowHome]}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('ClubDetail', { clubId: item.id })}
                  >
                    <View style={styles.clubCardInner}>
                      <View style={[styles.clubEmojiCircle, { backgroundColor: clubCircleBg(item.name) }]}>
                        <Text style={styles.clubEmojiText}>{item.emoji}</Text>
                      </View>
                      <View style={styles.clubCardMain}>
                        <View style={styles.clubTitleRow}>
                          <Text style={styles.clubName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <View style={[styles.categoryPillSmall, { backgroundColor: pill.pillBg }]}>
                            <Text style={[styles.categoryPillSmallText, { color: pill.pillText }]} numberOfLines={1}>
                              {pill.label}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.clubDesc} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.clubCardFooter}>
                      <Text style={styles.clubMemberCount}>
                        {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
                      </Text>
                      {item.isMember ? (
                        <View style={styles.joinedPill}>
                          <Text style={styles.joinedPillText}>Joined</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.joinOutlineBtn, joiningClubId === item.id && styles.joinOutlineBtnDisabled]}
                          onPress={(e) => { e.stopPropagation?.(); void handleJoinClub(item.id); }}
                          disabled={joiningClubId === item.id}
                          activeOpacity={0.8}
                        >
                          {joiningClubId === item.id ? (
                            <ActivityIndicator size="small" color={home.scarlet} />
                          ) : (
                            <Text style={styles.joinOutlineBtnText}>Join</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyTitle}>No clubs found</Text>
                <Text style={styles.emptySub}>Try another search or category.</Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: home.creamBg,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: spacing.sm,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: home.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: home.textSecondary,
  },
  tabSwitcherWrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#F0EBE3',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabSegmentActive: {
    backgroundColor: home.scarlet,
  },
  tabSegmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: home.textSecondary,
  },
  tabSegmentTextActive: {
    color: '#FFFFFF',
  },
  searchBarOuter: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E8E3DB',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: home.textPrimary,
    paddingVertical: 0,
  },
  listPad: {
    paddingHorizontal: 16,
    paddingBottom: spacing.xxl,
  },
  sectionHeaderPad: {
    paddingHorizontal: 0,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionHeaderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: home.scarlet,
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#999999',
    textTransform: 'uppercase',
  },
  emptyBlock: {
    alignItems: 'center',
    marginTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: home.textSecondary,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
  tabLoadingInner: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clubsHeaderBlock: {
    marginBottom: 4,
  },
  meetingsEmpty: {
    fontSize: 13,
    color: '#BBBBBB',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  meetingsRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    gap: 10,
  },
  meetingCard: {
    width: 160,
    height: 100,
    borderRadius: 12,
    backgroundColor: home.cardBg,
    padding: 10,
  },
  meetingEmoji: {
    fontSize: 26,
    marginBottom: 2,
  },
  meetingClubName: {
    fontSize: 13,
    fontWeight: '700',
    color: home.textPrimary,
  },
  meetingTime: {
    fontSize: 13,
    fontWeight: '700',
    color: home.scarlet,
    marginTop: 2,
  },
  meetingLocation: {
    fontSize: 11,
    color: home.textSecondary,
    marginTop: 2,
  },
  clubCard: {
    borderRadius: 16,
    backgroundColor: home.cardBg,
    marginBottom: 10,
    overflow: 'hidden',
  },
  clubCardInner: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 14,
    gap: 12,
  },
  clubCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
  },
  clubEmojiCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubEmojiText: {
    fontSize: 22,
  },
  clubCardMain: {
    flex: 1,
    minWidth: 0,
  },
  clubTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  clubName: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '700',
    color: home.textPrimary,
  },
  categoryPillSmall: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: 120,
  },
  categoryPillSmallText: {
    fontSize: 10,
    fontWeight: '700',
  },
  clubDesc: {
    fontSize: 14,
    color: home.textSecondary,
    lineHeight: 20,
  },
  clubMemberCount: {
    fontSize: 12,
    color: '#999999',
  },
  joinOutlineBtn: {
    borderWidth: 1.5,
    borderColor: home.scarlet,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinOutlineBtnDisabled: {
    opacity: 0.7,
  },
  joinOutlineBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: home.scarlet,
  },
  joinedPill: {
    backgroundColor: '#F0EBE3',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  joinedPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: home.textSecondary,
  },
});
