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
  PrimaryButton,
  Screen,
  SearchField,
  SectionHeader,
  SkeletonCard,
  Tap,
} from '../components/ui';
import { CATEGORY_META, CATEGORIES } from '../constants/categories';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';

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

function statusMeta(liveCount: number) {
  if (liveCount > 0) {
    return {
      label: liveCount === 1 ? '1 active pod' : `${liveCount} active pods`,
      icon: 'flame' as const,
      style: 'live' as const,
    };
  }
  return {
    label: 'No pods yet',
    icon: 'add-circle-outline' as const,
    style: 'quiet' as const,
  };
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

  const cards = useMemo(() => {
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
  const visibleCards = cards.slice(0, visibleCount);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <Entrance index={0}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.pageEyebrow}>Find your people</Text>
              <Text style={styles.pageTitle}>Explore</Text>
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

        <View style={styles.section}>
          <Entrance index={3}>
            <SectionHeader title="Browse activities" />
          </Entrance>
          {!loaded ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : cards.length ? visibleCards.map((item, cardIndex) => {
            const meta = CATEGORY_META[item.activity.category];
            const accent = meta?.color ?? colors.primary;
            const status = statusMeta(item.liveCount);
            const podLocation = activePodLocation(item.activePods);
            const distanceLabel = trustworthyDistanceLabel(item.activePods, userLocation);
            const hasActivePods = item.liveCount > 0;
            return (
              <Entrance key={item.activity.id} index={Math.min(cardIndex, 6) + 3}>
                <Tap
                  onPress={() => navigation.navigate('ActivityPods', { activity: item.activity })}
                  style={styles.activityCard}
                  accessibilityLabel={displayTitle(item.activity)}
                >
                  <LinearGradient
                    colors={[`${accent}2E`, isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)']}
                    style={styles.categoryVisual}
                  >
                    <Ionicons
                      name={meta?.icon ?? 'sparkles-outline'}
                      size={24}
                      color={accent}
                    />
                  </LinearGradient>

                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <View style={[
                        styles.statusPill,
                        status.style === 'live' ? styles.statusPillLive : styles.statusPillQuiet,
                      ]}>
                        <Ionicons
                          name={status.icon}
                          size={12}
                          color={status.style === 'live' ? '#FFFFFF' : colors.sub}
                        />
                        <Text style={[
                          styles.statusText,
                          status.style === 'live' ? styles.statusTextLive : styles.statusTextQuiet,
                        ]}>
                          {status.label}
                        </Text>
                      </View>

                      <Text style={styles.categoryLabel} numberOfLines={1}>{meta?.label ?? item.activity.category}</Text>
                    </View>

                    <Text style={styles.activityTitle} numberOfLines={1}>{displayTitle(item.activity)}</Text>
                    <Text style={styles.activityDescription} numberOfLines={2}>{item.activity.description}</Text>

                    {hasActivePods ? (
                      <View style={styles.factRow}>
                        {podLocation ? (
                          <View style={styles.factItem}>
                            <Ionicons name="location-outline" size={13} color={colors.faint} />
                            <Text style={styles.factText} numberOfLines={1}>{podLocation}</Text>
                          </View>
                        ) : null}
                        <View style={styles.factItem}>
                          <Ionicons name="people-outline" size={13} color={colors.faint} />
                          <Text style={styles.factText}>{formatParticipantCount(item.activePods)}</Text>
                        </View>
                        {distanceLabel ? (
                          <View style={styles.factItem}>
                            <Ionicons name="navigate-outline" size={13} color={colors.faint} />
                            <Text style={styles.factText}>{distanceLabel}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <Text style={styles.emptySupport}>Be the first to start one.</Text>
                    )}

                    <View style={styles.actionRow}>
                      <Text style={styles.actionHint} numberOfLines={1}>
                        {hasActivePods ? 'View meetup options' : 'Create the first pod'}
                      </Text>
                      <View style={styles.ctaPill}>
                        <Text style={styles.ctaText}>{ctaLabel(item.liveCount)}</Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                      </View>
                    </View>
                  </View>
                </Tap>
              </Entrance>
            );
          }) : (
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
    paddingBottom: 112,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
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
  loadMore: {
    marginTop: spacing.xs,
  },
  activityCard: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    backgroundColor: t.colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    ...t.shadows.card,
  },
  categoryVisual: {
    width: 54,
    minHeight: 108,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  cardBody: {
    flex: 1,
    gap: 7,
  },
  cardTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusPillLive: {
    backgroundColor: t.colors.primary,
  },
  statusPillQuiet: {
    backgroundColor: t.colors.inputBg,
  },
  statusText: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  statusTextLive: {
    color: '#FFFFFF',
  },
  statusTextQuiet: {
    color: t.colors.sub,
  },
  activityTitle: {
    ...t.typography.h2,
    fontSize: 19,
    lineHeight: 24,
  },
  activityDescription: {
    ...t.typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  factRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  factItem: {
    maxWidth: '100%' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  factText: {
    color: t.colors.sub,
    fontFamily: fonts.semibold,
    fontSize: 12,
    flexShrink: 1,
  },
  emptySupport: {
    ...t.typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
    paddingTop: 8,
  },
  categoryLabel: {
    color: t.colors.faint,
    fontFamily: fonts.semibold,
    fontSize: 12,
    flex: 1,
    textAlign: 'right' as const,
  },
  actionHint: {
    color: t.colors.faint,
    fontFamily: fonts.medium,
    fontSize: 12,
    flex: 1,
    marginRight: 4,
  },
  ctaPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    gap: 2,
    minWidth: 76,
    flexShrink: 0,
  },
  ctaText: {
    color: t.colors.primary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
}));
