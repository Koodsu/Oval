import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchFeed, getActivities, getApiErrorMessage } from '../api';
import { Activity, Pod } from '../types';
import { RootStackParamList } from '../../App';
import {
  AppBackdrop,
  Button,
  Chip,
  EmptyState,
  SearchBar,
  SectionHeader,
  SkeletonCard,
  Slab,
  Sticker,
  accentForSeed,
} from '../components/ui';
import { CATEGORY_META, CATEGORIES } from '../constants/categories';
import { useLocationPermission } from '../hooks/useLocationPermission';
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
  to: { latitude: number; longitude: number },
) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistanceLabel(miles: number) {
  if (miles < 0.1) return '<0.1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

function isUsableCoordinate(coords: { latitude: number; longitude: number } | null | undefined) {
  if (!coords) return false;
  return (
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    Math.abs(coords.latitude) <= 90 &&
    Math.abs(coords.longitude) <= 180 &&
    !(coords.latitude === 0 && coords.longitude === 0)
  );
}

function trustworthyDistanceLabel(
  activePods: Pod[],
  userLocation: { latitude: number; longitude: number } | null,
) {
  if (!isUsableCoordinate(userLocation)) return null;
  const podsWithCoordinates = activePods.filter(
    (pod) => pod.latitude != null && pod.longitude != null,
  );
  if (userLocation && podsWithCoordinates.length) {
    const nearestMiles = Math.min(
      ...podsWithCoordinates.map((pod) =>
        distanceMiles(userLocation, {
          latitude: pod.latitude ?? 0,
          longitude: pod.longitude ?? 0,
        }),
      ),
    );
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
  const cleanedWords = words.filter(
    (word, index) => index < 2 || word.toLowerCase() !== words[index - 1]?.toLowerCase(),
  );
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
  const { colors, typography } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
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
                Alert.alert(
                  'Location is off',
                  'No problem. You can still browse every activity and join pods normally.',
                );
              }
            });
          },
        },
      ],
    );
  }, [requestLocation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
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
        return [activity.title, activity.description, activity.category, activity.defaultLocation]
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
        if (b.totalParticipants !== a.totalParticipants)
          return b.totalParticipants - a.totalParticipants;
        return a.activity.title.localeCompare(b.activity.title);
      });
  }, [activities, category, deferredQuery, feed]);

  const liveCards = useMemo(() => cards.filter((item) => item.liveCount > 0).slice(0, 6), [cards]);
  const totalLivePods = useMemo(() => cards.reduce((sum, item) => sum + item.liveCount, 0), [cards]);
  const visibleCards = cards.slice(0, visibleCount);

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
              <Text style={[typography.kicker, { color: colors.primary }]}>FIND YOUR PEOPLE</Text>
              <Text style={styles.pageTitle}>EXPLORE.</Text>
              <View style={styles.liveSummary}>
                <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
                <Text style={typography.caption}>
                  {loaded
                    ? totalLivePods
                      ? `${totalLivePods} pod${totalLivePods === 1 ? '' : 's'} live across campus`
                      : 'Quiet right now — start something'
                    : 'Reading campus…'}
                </Text>
              </View>
            </View>
            {!granted && canAskAgain ? (
              <Chip
                label="Nearby"
                icon="navigate"
                onPress={explainAndRequestLocation}
                tint={colors.tealSoft}
                selected
              />
            ) : null}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(motion.stagger).duration(motion.durBase)}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search activities or places"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(motion.stagger * 2).duration(motion.durBase)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip label="All" selected={!category} onPress={() => setCategory(null)} />
            {CATEGORIES.map((item) => (
              <Chip
                key={item}
                label={categoryShortLabel(item)}
                selected={category === item}
                tint={category === item ? accentForSeed(colors, item).soft : undefined}
                onPress={() => setCategory(item)}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {/* Live right now rail */}
        {loaded && liveCards.length ? (
          <Animated.View
            entering={FadeInDown.delay(motion.stagger * 3).duration(motion.durBase)}
            style={styles.section}
          >
            <SectionHeader kicker="Happening" title="Live right now" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
            >
              {liveCards.map((item, index) => {
                const meta = CATEGORY_META[item.activity.category];
                const accent = accentForSeed(colors, item.activity.category ?? item.activity.title);
                const podLocation = activePodLocation(item.activePods);
                const distanceLabel = trustworthyDistanceLabel(item.activePods, userLocation);
                return (
                  <Slab
                    key={item.activity.id}
                    onPress={() => navigation.navigate('ActivityPods', { activity: item.activity })}
                    color={accent.soft}
                    tilt={index % 2 === 0 ? -0.8 : 0.8}
                    style={styles.liveCard}
                    faceStyle={styles.liveCardFace}
                    accessibilityLabel={`${displayTitle(item.activity)}, ${item.liveCount} active pod${item.liveCount === 1 ? '' : 's'}`}
                  >
                    <View style={styles.liveCardTop}>
                      <View
                        style={[
                          styles.liveCardIcon,
                          { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Ionicons
                          name={meta?.icon ?? 'sparkles-outline'}
                          size={20}
                          color={accent.tint}
                        />
                      </View>
                      <Sticker
                        label={`${item.liveCount} LIVE`}
                        tint={colors.primary}
                        textColor={colors.onPrimary}
                        tilt={3}
                        small
                      />
                    </View>
                    <Text style={typography.heading} numberOfLines={1}>
                      {displayTitle(item.activity)}
                    </Text>
                    <View style={styles.factList}>
                      <View style={styles.factItem}>
                        <Ionicons name="people" size={12} color={colors.sub} />
                        <Text style={styles.factText} numberOfLines={1}>
                          {formatParticipantCount(item.activePods)}
                        </Text>
                      </View>
                      {podLocation ? (
                        <View style={styles.factItem}>
                          <Ionicons name="location" size={12} color={colors.sub} />
                          <Text style={styles.factText} numberOfLines={1}>
                            {podLocation}
                          </Text>
                        </View>
                      ) : null}
                      {distanceLabel ? (
                        <View style={styles.factItem}>
                          <Ionicons name="navigate" size={12} color={colors.sub} />
                          <Text style={styles.factText}>{distanceLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                  </Slab>
                );
              })}
            </ScrollView>
          </Animated.View>
        ) : null}

        {/* Browse grid */}
        <View style={styles.section}>
          <SectionHeader kicker="The catalog" title="Browse activities" />
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
                const accent = accentForSeed(colors, item.activity.category ?? item.activity.title);
                const hasActivePods = item.liveCount > 0;
                return (
                  <Animated.View
                    key={item.activity.id}
                    entering={FadeInDown.delay(Math.min(cardIndex, 6) * motion.stagger).duration(
                      motion.durBase,
                    )}
                    style={styles.gridSlot}
                  >
                    <Slab
                      onPress={() =>
                        navigation.navigate('ActivityPods', { activity: item.activity })
                      }
                      style={{ flex: 1 }}
                      faceStyle={styles.tileFace}
                      accessibilityLabel={displayTitle(item.activity)}
                    >
                      <View style={styles.tileTop}>
                        <View
                          style={[
                            styles.tileIcon,
                            { backgroundColor: accent.soft, borderColor: colors.border },
                          ]}
                        >
                          <Ionicons
                            name={meta?.icon ?? 'sparkles-outline'}
                            size={20}
                            color={accent.tint}
                          />
                        </View>
                        {hasActivePods ? (
                          <Sticker
                            label={String(item.liveCount)}
                            tint={colors.primary}
                            textColor={colors.onPrimary}
                            tilt={4}
                            small
                          />
                        ) : null}
                      </View>
                      <Text style={styles.tileCategory} numberOfLines={1}>
                        {(meta?.label ?? item.activity.category ?? '').toUpperCase()}
                      </Text>
                      <Text style={[typography.heading, styles.tileTitle]} numberOfLines={2}>
                        {displayTitle(item.activity)}
                      </Text>
                      <Text style={styles.tileDescription} numberOfLines={2}>
                        {item.activity.description}
                      </Text>
                      <View style={[styles.tileFooter, { borderTopColor: colors.borderSoft }]}>
                        <Text
                          style={[
                            styles.tileCta,
                            { color: hasActivePods ? colors.primary : colors.sub },
                          ]}
                        >
                          {ctaLabel(item.liveCount).toUpperCase()}
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={13}
                          color={hasActivePods ? colors.primary : colors.sub}
                        />
                      </View>
                    </Slab>
                  </Animated.View>
                );
              })}
            </View>
          ) : (
            <EmptyState
              icon="telescope"
              title="Nothing matches that view"
              body="Try another category or search for a different place."
            />
          )}
          {visibleCount < cards.length ? (
            <Button
              label={`Show ${Math.min(12, cards.length - visibleCount)} more`}
              onPress={() => setVisibleCount((count) => count + 12)}
              variant="secondary"
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
  liveSummary: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    marginTop: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  liveCard: {
    width: 230,
  },
  liveCardFace: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  liveCardTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  liveCardIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  factList: {
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
    gap: spacing.md,
  },
  gridSlot: {
    flexBasis: '46%' as const,
    flexGrow: 1,
  },
  tileFace: {
    flex: 1,
    padding: spacing.md,
    gap: 7,
    minHeight: 172,
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
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tileCategory: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: t.colors.faint,
  },
  tileTitle: {
    // Reserve two lines so neighboring tiles in a row stay the same height.
    minHeight: 42,
  },
  tileDescription: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 17,
    minHeight: 34,
    color: t.colors.sub,
  },
  tileFooter: {
    marginTop: 'auto' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 2,
    borderStyle: 'dashed' as const,
  },
  tileCta: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    letterSpacing: 0.8,
  },
}));
