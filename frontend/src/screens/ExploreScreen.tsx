import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchFeed, getActivities, getApiErrorMessage } from '../api';
import { Activity, Pod } from '../types';
import { RootStackParamList } from '../../App';
import {
  Chip,
  EmptyState,
  Entrance,
  LiveDot,
  PrimaryButton,
  Screen,
  SearchField,
  SectionHeader,
  SkeletonCard,
  Tap,
} from '../components/ui';
import { CATEGORY_META, CATEGORIES } from '../constants/categories';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { DOCK_CLEARANCE, Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MAX_TRUSTWORTHY_DISTANCE_MILES = 25;

function formatParticipantCount(pods: Pod[]) {
  const total = pods.reduce((sum, pod) => sum + pod.members.length, 0);
  return `${total} student${total === 1 ? '' : 's'} joined`;
}

function categoryShortLabel(category: string) {
  const meta = CATEGORY_META[category];
  if (meta) return meta.label.split(' & ')[0];
  return category;
}

function distanceMiles(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistanceLabel(miles: number) {
  if (miles < 0.1) return '<0.1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

function isUsableCoordinate(coords: { latitude: number; longitude: number } | null | undefined) {
  if (!coords) return false;
  return Number.isFinite(coords.latitude)
    && Number.isFinite(coords.longitude)
    && Math.abs(coords.latitude) <= 90
    && Math.abs(coords.longitude) <= 180
    && !(coords.latitude === 0 && coords.longitude === 0);
}

function trustworthyDistanceLabel(activePods: Pod[], userLocation: { latitude: number; longitude: number } | null) {
  if (!isUsableCoordinate(userLocation)) return null;
  const podsWithCoordinates = activePods.filter((pod) => pod.latitude != null && pod.longitude != null);
  if (userLocation && podsWithCoordinates.length) {
    const nearestMiles = Math.min(...podsWithCoordinates.map((pod) => distanceMiles(userLocation, {
      latitude: pod.latitude ?? 0,
      longitude: pod.longitude ?? 0,
    })));
    if (nearestMiles > MAX_TRUSTWORTHY_DISTANCE_MILES) return null;
    return formatDistanceLabel(nearestMiles);
  }
  return null;
}

function ctaLabel(liveCount: number) {
  if (liveCount === 1) return 'Join pod';
  if (liveCount > 1) return 'View pods';
  return 'Start pod';
}

function activePodLocation(activePods: Pod[]) {
  const rawLocation = activePods.find((pod) => pod.location.trim())?.location.trim();
  if (!rawLocation) return null;
  const firstPart = rawLocation.split('•')[0]?.trim() ?? rawLocation;
  const words = firstPart.split(/\s+/);
  const cleanedWords = words.filter((word, index) => (
    index < 2 || word.toLowerCase() !== words[index - 1]?.toLowerCase()
  ));
  const cleaned = cleanedWords.join(' ').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > 36) return 'Near campus';
  return cleaned;
}

function displayTitle(activity: Activity) {
  return activity.title;
}

type ExploreCard = {
  activity: Activity;
  activePods: Pod[];
  liveCount: number;
  totalParticipants: number;
};

export default function ExploreScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const { granted, canAskAgain, userLocation, requestLocation } = useLocationPermission();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [feed, setFeed] = useState<Pod[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const deferredQuery = useDeferredValue(query);

  const load = useCallback(async () => {
    try {
      const [activityList, podFeed] = await Promise.all([
        getActivities(category ?? undefined),
        fetchFeed(category ? { category } : {}),
      ]);
      setActivities(activityList);
      setFeed(podFeed);
    } catch (error) {
      Alert.alert('Could not load explore', getApiErrorMessage(error));
    } finally {
      setLoaded(true);
    }
  }, [category]);

  const explainAndRequestLocation = useCallback(() => {
    Alert.alert(
      'Use campus location?',
      'Bridge uses your location to sort nearby pods and show distance hints. Your exact location is not posted to pods.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            void requestLocation().then((allowed) => {
              if (!allowed) {
                Alert.alert('Location is off', 'No problem. You can still browse every activity and join pods normally.');
              }
            });
          },
        },
      ]
    );
  }, [requestLocation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    setVisibleCount(12);
  }, [category, deferredQuery]);

  const cards = useMemo<ExploreCard[]>(() => {
    const q = deferredQuery.trim().toLowerCase();
    return activities
      .filter((activity) => {
        if (category && activity.category !== category) return false;
        if (!q) return true;
        return [
          activity.title,
          activity.description,
          activity.category,
          activity.defaultLocation,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .map((activity) => {
        const pods = feed.filter((pod) => pod.activityId === activity.id);
        const activePods = pods.filter((pod) => pod.status === 'FORMING');
        const liveCount = activePods.length;
        const totalParticipants = activePods.reduce((sum, pod) => sum + pod.members.length, 0);
        return { activity, activePods, liveCount, totalParticipants };
      })
      .sort((a, b) => {
        if (b.liveCount !== a.liveCount) return b.liveCount - a.liveCount;
        if (b.totalParticipants !== a.totalParticipants) return b.totalParticipants - a.totalParticipants;
        return a.activity.title.localeCompare(b.activity.title);
      });
  }, [activities, category, deferredQuery, feed]);

  const liveCards = useMemo(() => cards.filter((item) => item.liveCount > 0).slice(0, 6), [cards]);
  const totalLivePods = useMemo(() => cards.reduce((sum, item) => sum + item.liveCount, 0), [cards]);
  const visibleCards = cards.slice(0, visibleCount);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {/* Masthead */}
        <Entrance index={0}>
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <Text style={styles.pageEyebrow}>Find your people</Text>
              <Text style={styles.pageTitle}>Explore</Text>
              <View style={styles.liveSummary}>
                <LiveDot size={7} />
                <Text style={styles.liveSummaryText}>
                  {loaded
                    ? totalLivePods
                      ? `${totalLivePods} pod${totalLivePods === 1 ? '' : 's'} live across campus`
                      : 'Quiet right now — start something'
                    : 'Reading campus…'}
                </Text>
              </View>
            </View>
            {!granted && canAskAgain ? (
              <TouchableOpacity
                style={styles.locationButton}
                activeOpacity={0.86}
                onPress={explainAndRequestLocation}
                accessibilityRole="button"
                accessibilityLabel="Use campus location"
              >
                <Ionicons name="navigate-outline" size={15} color={colors.primary} />
                <Text style={styles.locationButtonText}>Nearby</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Entrance>

        <Entrance index={1}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search activities or places"
          />
        </Entrance>

        <Entrance index={2}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip label="All" active={!category} onPress={() => setCategory(null)} />
            {CATEGORIES.map((item) => (
              <Chip
                key={item}
                label={categoryShortLabel(item)}
                active={category === item}
                onPress={() => setCategory(item)}
              />
            ))}
          </ScrollView>
        </Entrance>

        {/* Live right now rail */}
        {loaded && liveCards.length ? (
          <Entrance index={3} style={styles.section}>
            <View style={styles.liveHeader}>
              <LiveDot size={8} color={colors.primary} />
              <Text style={styles.liveHeaderText}>Live right now</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveRail}>
              {liveCards.map((item) => {
                const meta = CATEGORY_META[item.activity.category];
                const accent = meta?.color ?? colors.primary;
                const podLocation = activePodLocation(item.activePods);
                const distanceLabel = trustworthyDistanceLabel(item.activePods, userLocation);
                return (
                  <Tap
                    key={item.activity.id}
                    onPress={() => navigation.navigate('ActivityPods', { activity: item.activity })}
                    style={styles.liveCard}
                    accessibilityLabel={`${displayTitle(item.activity)}, ${item.liveCount} active pod${item.liveCount === 1 ? '' : 's'}`}
                  >
                    <LinearGradient
                      colors={[`${accent}30`, isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.7)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0.9, y: 1 }}
                      style={styles.liveCardWash}
                    />
                    <View style={styles.liveCardTop}>
                      <View style={[styles.liveCardIcon, { backgroundColor: `${accent}24` }]}>
                        <Ionicons name={meta?.icon ?? 'sparkles-outline'} size={20} color={accent} />
                      </View>
                      <View style={styles.liveBadge}>
                        <LiveDot size={6} color="#FFFFFF" />
                        <Text style={styles.liveBadgeText}>
                          {item.liveCount} pod{item.liveCount === 1 ? '' : 's'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.liveCardTitle} numberOfLines={1}>{displayTitle(item.activity)}</Text>
                    <View style={styles.liveCardFacts}>
                      <View style={styles.factItem}>
                        <Ionicons name="people-outline" size={12} color={colors.sub} />
                        <Text style={styles.factText} numberOfLines={1}>{formatParticipantCount(item.activePods)}</Text>
                      </View>
                      {podLocation ? (
                        <View style={styles.factItem}>
                          <Ionicons name="location-outline" size={12} color={colors.sub} />
                          <Text style={styles.factText} numberOfLines={1}>{podLocation}</Text>
                        </View>
                      ) : null}
                      {distanceLabel ? (
                        <View style={styles.factItem}>
                          <Ionicons name="navigate-outline" size={12} color={colors.sub} />
                          <Text style={styles.factText}>{distanceLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                  </Tap>
                );
              })}
            </ScrollView>
          </Entrance>
        ) : null}

        {/* Browse grid */}
        <View style={styles.section}>
          <Entrance index={4}>
            <SectionHeader title="Browse activities" />
          </Entrance>
          {!loaded ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : cards.length ? (
            <View style={styles.grid}>
              {visibleCards.map((item, cardIndex) => {
                const meta = CATEGORY_META[item.activity.category];
                const accent = meta?.color ?? colors.primary;
                const hasActivePods = item.liveCount > 0;
                return (
                  <Entrance
                    key={item.activity.id}
                    index={Math.min(cardIndex, 6)}
                    style={styles.gridSlot}
                  >
                    <Tap
                      onPress={() => navigation.navigate('ActivityPods', { activity: item.activity })}
                      style={styles.tile}
                      accessibilityLabel={displayTitle(item.activity)}
                    >
                      <View style={styles.tileTop}>
                        <View style={[styles.tileIcon, { backgroundColor: `${accent}1F` }]}>
                          <Ionicons name={meta?.icon ?? 'sparkles-outline'} size={20} color={accent} />
                        </View>
                        {hasActivePods ? (
                          <View style={styles.tileLivePill}>
                            <LiveDot size={5} color="#FFFFFF" />
                            <Text style={styles.tileLiveText}>{item.liveCount}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.tileCategory} numberOfLines={1}>
                        {meta?.label ?? item.activity.category}
                      </Text>
                      <Text style={styles.tileTitle} numberOfLines={2}>{displayTitle(item.activity)}</Text>
                      <Text style={styles.tileDescription} numberOfLines={2}>{item.activity.description}</Text>
                      <View style={styles.tileFooter}>
                        <Text style={[styles.tileCta, !hasActivePods && { color: colors.sub }]}>
                          {ctaLabel(item.liveCount)}
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={13}
                          color={hasActivePods ? colors.primary : colors.sub}
                        />
                      </View>
                    </Tap>
                  </Entrance>
                );
              })}
            </View>
          ) : (
            <EmptyState
              icon="compass-outline"
              title="Nothing matches that view yet"
              body="Try another category or search for a different place."
            />
          )}
          {visibleCount < cards.length ? (
            <View style={styles.loadMore}>
              <PrimaryButton
                label={`Show ${Math.min(12, cards.length - visibleCount)} more activities`}
                onPress={() => setVisibleCount((count) => count + 12)}
                kind="ghost"
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingTop: spacing.sm,
    paddingBottom: DOCK_CLEARANCE,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.md,
  },
  titleCopy: {
    flex: 1,
    gap: 3,
  },
  pageEyebrow: {
    ...t.typography.label,
    color: t.colors.primary,
  },
  pageTitle: {
    ...t.typography.display,
  },
  liveSummary: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    marginTop: 2,
  },
  liveSummaryText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: t.colors.sub,
  },
  locationButton: {
    height: 38,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: t.colors.primarySoft,
  },
  locationButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: t.colors.primarySoftText,
  },
  chipRow: {
    paddingLeft: 1,
    paddingTop: 2,
    paddingBottom: 6,
    paddingRight: spacing.xl,
  },
  section: {
    gap: spacing.sm,
    paddingTop: 2,
  },
  liveHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 9,
    marginBottom: 2,
  },
  liveHeaderText: {
    ...t.typography.h2,
  },
  liveRail: {
    paddingRight: spacing.md,
    paddingBottom: 4,
  },
  liveCard: {
    width: 218,
    marginRight: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    overflow: 'hidden' as const,
    ...t.shadows.card,
  },
  liveCardWash: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  liveCardTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  liveCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  liveBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: t.colors.primary,
  },
  liveBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  liveCardTitle: {
    ...t.typography.h2,
    fontSize: 18,
    lineHeight: 23,
  },
  liveCardFacts: {
    gap: 5,
  },
  factItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  factText: {
    color: t.colors.sub,
    fontFamily: fonts.semibold,
    fontSize: 12,
    flexShrink: 1,
  },
  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  gridSlot: {
    flexBasis: '47%' as const,
    flexGrow: 1,
  },
  tile: {
    flex: 1,
    backgroundColor: t.colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.md,
    gap: 7,
    minHeight: 168,
    ...t.shadows.subtle,
  },
  tileTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 2,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tileLivePill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: t.colors.primary,
  },
  tileLiveText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  tileCategory: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: t.colors.faint,
  },
  tileTitle: {
    ...t.typography.title,
    fontSize: 16,
    lineHeight: 21,
    minHeight: 42,
  },
  tileDescription: {
    ...t.typography.body,
    fontSize: 12.5,
    lineHeight: 17,
    minHeight: 34,
  },
  tileFooter: {
    marginTop: 'auto' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  tileCta: {
    color: t.colors.primary,
    fontFamily: fonts.bold,
    fontSize: 12.5,
  },
  loadMore: {
    marginTop: spacing.xs,
  },
}));
