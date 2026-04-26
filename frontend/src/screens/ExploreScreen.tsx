import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { API_USER_MESSAGE, getActivities, getClubs, joinClub } from '../api';
import { Chip, CompactHeader, EmptyState, Panel, PrimaryButton, Screen, SearchField, SectionHeader, SegmentedControl } from '../components/ui';
import { Activity, ClubDirectoryEntry } from '../types';
import { RootStackParamList } from '../../App';
import { CATEGORY_META, CATEGORIES } from '../constants/categories';
import { palette, radii, spacing, typography } from '../theme';

type ExploreMode = 'activities' | 'clubs';
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ExploreScreen() {
  const navigation = useNavigation<Nav>();
  const [mode, setMode] = useState<ExploreMode>('activities');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [clubs, setClubs] = useState<ClubDirectoryEntry[]>([]);
  const [joiningClubId, setJoiningClubId] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(query);

  const load = useCallback(async () => {
    try {
      const [activityList, clubList] = await Promise.all([
        getActivities(category ?? undefined),
        getClubs({ category: category ?? undefined }),
      ]);
      setActivities(activityList);
      setClubs(clubList);
    } catch {
      Alert.alert('Could not load explore', API_USER_MESSAGE);
    }
  }, [category]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filteredActivities = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return activities.filter((activity) => {
      const matchesQuery =
        !q ||
        activity.title.toLowerCase().includes(q) ||
        activity.description.toLowerCase().includes(q) ||
        activity.category.toLowerCase().includes(q);
      const matchesCategory = !category || activity.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [activities, category, deferredQuery]);

  const filteredClubs = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return clubs.filter((club) => {
      const matchesQuery =
        !q ||
        club.name.toLowerCase().includes(q) ||
        club.description.toLowerCase().includes(q) ||
        club.category.toLowerCase().includes(q);
      const matchesCategory = !category || club.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [category, clubs, deferredQuery]);

  const handleJoinClub = async (clubId: string) => {
    setJoiningClubId(clubId);
    try {
      await joinClub(clubId);
      setClubs((current) => current.map((club) => (
        club.id === clubId
          ? { ...club, isMember: true, memberCount: club.memberCount + 1 }
          : club
      )));
    } catch {
      Alert.alert('Could not join club', API_USER_MESSAGE);
    } finally {
      setJoiningClubId(null);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CompactHeader
          eyebrow="Explore"
          title="What’s happening on campus?"
          subtitle="Browse activities and clubs, filter by category, and jump into whatever fits your day."
        />

        <SegmentedControl
          value={mode}
          options={[
            { value: 'activities', label: 'Activities' },
            { value: 'clubs', label: 'Clubs' },
          ]}
          onChange={setMode}
        />

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={mode === 'activities' ? 'Search activities, categories, vibes...' : 'Search clubs, groups, communities...'}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip label="All" active={!category} onPress={() => setCategory(null)} />
          {CATEGORIES.map((item) => (
            <Chip key={item} label={CATEGORY_META[item].label} active={category === item} onPress={() => setCategory(item)} />
          ))}
        </ScrollView>

        {mode === 'activities' ? (
          <View style={styles.section}>
            <SectionHeader title="Activity channels" />
            {filteredActivities.length ? filteredActivities.map((activity) => (
              <TouchableOpacity
                key={activity.id}
                style={styles.activityCard}
                onPress={() => navigation.navigate('ActivityPods', { activity })}
              >
                <Text style={styles.category}>{activity.category}</Text>
                <Text style={styles.title}>{activity.title}</Text>
                <Text style={styles.body} numberOfLines={2}>{activity.description}</Text>
              </TouchableOpacity>
            )) : <EmptyState icon="compass-outline" title="No activities match yet" body="Try another search or switch the category lens." />}
          </View>
        ) : (
          <View style={styles.section}>
            <SectionHeader title="Club directory" />
            {filteredClubs.length ? filteredClubs.map((club) => (
              <Panel key={club.id} style={styles.clubCard}>
                <TouchableOpacity onPress={() => navigation.navigate('ClubDetail', { clubId: club.id })}>
                  <View style={styles.activityTop}>
                    <Text style={styles.category}>{club.category}</Text>
                    <Text style={styles.live}>{club.memberCount} members</Text>
                  </View>
                  <Text style={styles.title}>{club.emoji} {club.name}</Text>
                  <Text style={styles.body} numberOfLines={3}>{club.description}</Text>
                </TouchableOpacity>
                <View style={styles.clubActions}>
                  <PrimaryButton
                    label={club.isMember ? 'Open club' : 'Join club'}
                    onPress={() => club.isMember ? navigation.navigate('ClubDetail', { clubId: club.id }) : void handleJoinClub(club.id)}
                    loading={joiningClubId === club.id}
                  />
                </View>
              </Panel>
            )) : <EmptyState icon="people-outline" title="No clubs match yet" body="Try a different search phrase or clear the category filter." />}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  activityCard: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.sm,
  },
  clubCard: {
    gap: spacing.md,
  },
  activityTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  category: {
    ...typography.label,
  },
  live: {
    ...typography.bodyStrong,
    color: palette.scarlet,
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
  },
  clubActions: {
    marginTop: spacing.xs,
  },
});
