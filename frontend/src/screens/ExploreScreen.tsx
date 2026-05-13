import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Alert, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_USER_MESSAGE, fetchFeed, getActivities } from '../api';
import { Activity, Pod } from '../types';
import { RootStackParamList } from '../../App';
import { Chip, EmptyState, IconButton, Screen, SearchField, SectionHeader, SkeletonCard } from '../components/ui';
import { CATEGORY_META, CATEGORIES } from '../constants/categories';
import { palette, radii, shadows, spacing, typography } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ACTIVITY_IMAGE_BY_KEYWORD: Array<{ match: RegExp; uri: string }> = [
  { match: /basketball|hoops/i, uri: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80' },
  { match: /study|exam|homework|book/i, uri: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80' },
  { match: /jog|walk|sunrise|sunset|lake|trail/i, uri: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80' },
  { match: /soccer|frisbee|tennis/i, uri: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80' },
  { match: /coffee|lunch|boba|cooking|market/i, uri: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80' },
  { match: /photo|sketch|craft|writing|open mic/i, uri: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=1200&q=80' },
  { match: /movie|trivia|game|smash|karaoke|concert|jam/i, uri: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80' },
  { match: /meditation|journaling|stretch|detox/i, uri: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80' },
];

function imageForActivity(activity: Activity) {
  const source = `${activity.title} ${activity.description} ${activity.category}`;
  const match = ACTIVITY_IMAGE_BY_KEYWORD.find((item) => item.match.test(source));
  return match?.uri ?? 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80';
}

function formatLiveLabel(pods: Pod[]) {
  const liveCount = pods.filter((pod) => pod.status === 'FORMING').length;
  if (liveCount > 0) return `${liveCount} active pod${liveCount === 1 ? '' : 's'}`;
  return 'No active pods yet';
}

function formatAttendance(pods: Pod[]) {
  const total = pods.reduce((sum, pod) => sum + pod.members.length, 0);
  if (total <= 0) return 'No one active yet';
  return `${total} student${total === 1 ? '' : 's'} active`;
}

function categoryShortLabel(category: string) {
  const meta = CATEGORY_META[category];
  if (meta) return meta.label.split(' & ')[0];
  return category;
}

function pseudoDistanceFromId(id: string) {
  const total = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const distance = 0.1 + (total % 8) * 0.1;
  return `${distance.toFixed(1)} mi`;
}

function displayTitle(activity: Activity) {
  const title = activity.title;
  if (/basketball pickup game/i.test(title)) return 'Late Night Hoops';
  if (/go for a jog/i.test(title)) return 'Sunset Jog Crew';
  if (/study group sprint/i.test(title)) return 'Library Lock-In';
  if (/morning coffee walk/i.test(title)) return 'Coffee Walk Crew';
  if (/frisbee on the lawn/i.test(title)) return 'Oval Frisbee';
  if (/soccer kickaround/i.test(title)) return 'Pickup on the Turf';
  if (/mirror lake hangout/i.test(title)) return 'Mirror Lake Linkup';
  if (/open mic night/i.test(title)) return 'Open Mic After Hours';
  return title;
}

export default function ExploreScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
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
    } catch {
      Alert.alert('Could not load explore', API_USER_MESSAGE);
    } finally {
      setLoaded(true);
    }
  }, [category]);

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
        const liveCount = pods.filter((pod) => pod.status === 'FORMING').length;
        const totalParticipants = pods.reduce((sum, pod) => sum + pod.members.length, 0);
        return { activity, pods, liveCount, totalParticipants };
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
          <IconButton
            icon={showSearch ? 'close' : 'search'}
            tooltip={showSearch ? 'Close search' : 'Search activities'}
            onPress={() => setShowSearch((current) => !current)}
          />
        </View>

        {showSearch ? (
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search activities, places, and vibes"
          />
        ) : null}

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
          <SectionHeader title="Happening now" />
          {!loaded ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : cards.length ? cards.map((item, index) => {
            const meta = CATEGORY_META[item.activity.category];
            const imageUri = imageForActivity(item.activity);
            return (
              <TouchableOpacity
                key={item.activity.id}
                activeOpacity={0.92}
                onPress={() => navigation.navigate('ActivityPods', { activity: item.activity })}
              >
                <ImageBackground
                  source={{ uri: imageUri }}
                  imageStyle={styles.heroImage}
                  style={styles.heroCard}
                >
                  <LinearGradient
                    colors={['rgba(10, 12, 16, 0.12)', 'rgba(10, 12, 16, 0.46)', 'rgba(10, 12, 16, 0.82)']}
                    style={styles.cardOverlay}
                  >
                    <View style={styles.heroTopRow}>
                      <View style={[
                        styles.livePill,
                        item.liveCount > 0 ? styles.livePillRed : styles.livePillAmber,
                      ]}>
                        <Ionicons
                          name={item.liveCount > 0 ? 'flame' : 'time-outline'}
                          size={11}
                          color={palette.white}
                        />
                        <Text style={styles.livePillText}>
                          {item.liveCount > 0 ? 'Live' : 'Starts soon'}
                        </Text>
                      </View>

                      <View style={styles.distancePill}>
                        <Ionicons name="location-outline" size={12} color={palette.white} />
                        <Text style={styles.distanceText}>{pseudoDistanceFromId(item.activity.id)}</Text>
                      </View>
                    </View>

                    <View style={styles.heroMiddle}>
                      <Text style={styles.heroTitle} numberOfLines={2}>{displayTitle(item.activity)}</Text>
                    </View>

                    <View style={styles.heroBottom}>
                      <Text style={styles.heroMeta} numberOfLines={1}>
                        {item.activity.defaultLocation} • {meta?.label ?? item.activity.category}
                      </Text>

                      <View style={styles.heroStatsRow}>
                        <View style={styles.statGroup}>
                          <Text style={styles.statPrimary}>{formatLiveLabel(item.pods)}</Text>
                          <Text style={styles.statSecondary}>{formatAttendance(item.pods)}</Text>
                        </View>

                        <View style={styles.socialGroup}>
                          <View style={styles.avatarRail}>
                            {[0, 1, 2, 3].map((avatarIndex) => (
                              <View
                                key={avatarIndex}
                                style={[
                                  styles.avatarDot,
                                  {
                                    marginLeft: avatarIndex === 0 ? 0 : -8,
                                    backgroundColor: ['#EEC9B7', '#D4E4F2', '#F6E2A6', '#B5D7C1'][avatarIndex],
                                  },
                                ]}
                              />
                            ))}
                          </View>
                          <Text style={styles.socialLabel}>
                            {item.totalParticipants > 0 ? `${item.totalParticipants} active now` : 'Join first'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>
            );
          }) : (
            <EmptyState
              icon="compass-outline"
              title="Nothing matches that view yet"
              body="Try another category or open search to widen the board."
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
  heroCard: {
    minHeight: 174,
    borderRadius: 24,
    overflow: 'hidden',
    ...shadows.card,
  },
  heroImage: {
    borderRadius: 24,
  },
  cardOverlay: {
    minHeight: 174,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  livePillRed: {
    backgroundColor: 'rgba(199, 59, 34, 0.95)',
  },
  livePillAmber: {
    backgroundColor: 'rgba(230, 166, 70, 0.95)',
  },
  livePillText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  distanceText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  heroMiddle: {
    paddingTop: 6,
  },
  heroTitle: {
    color: palette.white,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '800',
  },
  heroBottom: {
    gap: 10,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    fontWeight: '600',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  statGroup: {
    gap: 2,
    flex: 1,
  },
  statPrimary: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '800',
  },
  statSecondary: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '600',
  },
  socialGroup: {
    alignItems: 'flex-end',
    gap: 6,
  },
  avatarRail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.86)',
  },
  socialLabel: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
});
