import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchFeed, getActivities, getApiErrorMessage } from '../api';
import { Activity, Pod } from '../types';
import { RootStackParamList } from '../../App';
import { Chip, EmptyState, Screen, SearchField, SectionHeader, SkeletonCard } from '../components/ui';
import { CATEGORY_META, CATEGORIES } from '../constants/categories';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { palette, radii, shadows, spacing, typography } from '../theme';

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
  const { granted, canAskAgain, userLocation, requestLocation } = useLocationPermission();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [feed, setFeed] = useState<Pod[]>([]);
  const [loaded, setLoaded] = useState(false);
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Explore</Text>
          {!granted && canAskAgain ? (
            <TouchableOpacity
              style={styles.locationButton}
              activeOpacity={0.86}
              onPress={explainAndRequestLocation}
              accessibilityRole="button"
              accessibilityLabel="Use campus location"
            >
              <Ionicons name="navigate-outline" size={15} color={palette.scarlet} />
              <Text style={styles.locationButtonText}>Nearby</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search activities or places"
        />

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

        <View style={styles.section}>
          <SectionHeader title="Browse activities" />
          {!loaded ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : cards.length ? cards.map((item) => {
            const meta = CATEGORY_META[item.activity.category];
            const status = statusMeta(item.liveCount);
            const podLocation = activePodLocation(item.activePods);
            const distanceLabel = trustworthyDistanceLabel(item.activePods, userLocation);
            const hasActivePods = item.liveCount > 0;
            return (
              <TouchableOpacity
                key={item.activity.id}
                activeOpacity={0.92}
                onPress={() => navigation.navigate('ActivityPods', { activity: item.activity })}
                style={styles.activityCard}
              >
                <LinearGradient
                  colors={[`${meta?.color ?? palette.scarlet}1F`, 'rgba(255,255,255,0.9)']}
                  style={styles.categoryVisual}
                >
                  <Ionicons
                    name={meta?.icon ?? 'sparkles-outline'}
                    size={24}
                    color={meta?.color ?? palette.scarlet}
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
                        color={status.style === 'live' ? palette.white : palette.slate}
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
                          <Ionicons name="location-outline" size={13} color={palette.slate} />
                          <Text style={styles.factText} numberOfLines={1}>{podLocation}</Text>
                        </View>
                      ) : null}
                      <View style={styles.factItem}>
                        <Ionicons name="people-outline" size={13} color={palette.slate} />
                        <Text style={styles.factText}>{formatParticipantCount(item.activePods)}</Text>
                      </View>
                      {distanceLabel ? (
                        <View style={styles.factItem}>
                          <Ionicons name="navigate-outline" size={13} color={palette.slate} />
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
                      <Ionicons name="chevron-forward" size={14} color={palette.scarlet} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }) : (
            <EmptyState
              icon="compass-outline"
              title="Nothing matches that view yet"
              body="Try another category or search for a different place."
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
    paddingTop: spacing.sm,
    paddingBottom: 112,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    ...typography.h1,
    fontSize: 34,
    lineHeight: 38,
  },
  locationButton: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(199,59,34,0.16)',
  },
  locationButtonText: {
    ...typography.bodyStrong,
    fontSize: 13,
    lineHeight: 18,
    color: palette.scarlet,
  },
  chipRow: {
    paddingLeft: 1,
    paddingTop: 2,
    paddingBottom: 4,
    paddingRight: spacing.xl,
  },
  section: {
    gap: spacing.sm,
    paddingTop: 2,
  },
  activityCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.07)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    ...shadows.card,
  },
  categoryVisual: {
    width: 54,
    minHeight: 108,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
  },
  cardBody: {
    flex: 1,
    gap: 7,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusPillLive: {
    backgroundColor: palette.scarlet,
  },
  statusPillQuiet: {
    backgroundColor: 'rgba(16, 33, 43, 0.06)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusTextLive: {
    color: palette.white,
  },
  statusTextQuiet: {
    color: palette.slate,
  },
  activityTitle: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 24,
    color: palette.ink,
  },
  activityDescription: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: palette.slate,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  factItem: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  factText: {
    color: palette.slate,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  emptySupport: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: palette.slate,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 33, 43, 0.06)',
    paddingTop: 8,
  },
  categoryLabel: {
    color: palette.slate,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  actionHint: {
    color: palette.slate,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginRight: 4,
  },
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    minWidth: 76,
    flexShrink: 0,
  },
  ctaText: {
    color: palette.scarlet,
    fontSize: 13,
    fontWeight: '800',
  },
});
