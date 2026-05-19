import React, { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { fetchFeed, getActivities, getApiErrorMessage, getClubsToday, getMyPods } from '../api';
import { useAuth } from '../context/AuthContext';
import { Activity, ClubMeetingToday, Pod } from '../types';
import { RootStackParamList } from '../../App';
import { Hero, Panel, Screen, SectionHeader, PrimaryButton, EmptyState, SkeletonCard, UserAvatar } from '../components/ui';
import { OSU_CAMPUS_CENTER, OSU_CAMPUS_DELTA, OSU_CAMPUS_POLYGON } from '../constants/campusMap';
import { spacing, typography, palette, radii } from '../theme';
import { formatDateTime, formatTime } from '../utils/format';
import { getFeaturedActivities, sortUpcomingPods } from '../utils/experience';
import { useLocationPermission } from '../hooks/useLocationPermission';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user, token } = useAuth();
  const { granted, canAskAgain, userLocation, requestLocation } = useLocationPermission();
  const [pods, setPods] = useState<Pod[]>([]);
  const [myPods, setMyPods] = useState<Pod[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [clubsToday, setClubsToday] = useState<ClubMeetingToday[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [agendaExpanded, setAgendaExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoaded(true);
      setRefreshing(false);
      return;
    }

    try {
      const [feed, mine, activityList, clubList] = await Promise.all([
        fetchFeed(
          userLocation
            ? { limit: 20, lat: userLocation.latitude, lng: userLocation.longitude }
            : { limit: 20 }
        ),
        getMyPods(),
        getActivities(),
        getClubsToday(),
      ]);
      setPods(feed);
      setMyPods(mine);
      setActivities(activityList);
      setClubsToday(clubList);
    } catch (error) {
      Alert.alert('Could not load home', getApiErrorMessage(error));
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, [token, userLocation]);

  const explainAndRequestLocation = useCallback(() => {
    Alert.alert(
      'Use campus location?',
      'Bridge uses your location only to sort nearby pods and show useful distances on campus.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            void requestLocation().then((allowed) => {
              if (!allowed) {
                Alert.alert('Location is off', 'You can still use Bridge. Turn on location later if you want nearby pod sorting.');
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

  const featuredActivities = useMemo(() => getFeaturedActivities(activities, pods), [activities, pods]);
  const activePods = useMemo(() => sortUpcomingPods(pods).filter((pod) => pod.status === 'FORMING').slice(0, 4), [pods]);
  const yourNextPod = useMemo(() => sortUpcomingPods(myPods).find((pod) => pod.status === 'FORMING' || pod.status === 'LOCKED') ?? null, [myPods]);
  const agendaItems = useMemo(() => {
    const podItems = sortUpcomingPods(myPods)
      .filter((pod) => pod.status === 'FORMING' || pod.status === 'LOCKED')
      .slice(0, 3)
      .map((pod) => ({
        id: `pod-${pod.id}`,
        time: pod.meetupTime,
        title: pod.activity?.title ?? 'Pod',
        detail: pod.location,
        kind: 'pod' as const,
        onPress: () => navigation.navigate('PodDetail', { podId: pod.id }),
      }));

    const clubItems = clubsToday.slice(0, 3).map((meeting) => ({
      id: `club-${meeting.id}`,
      time: meeting.meetingTime,
      title: meeting.title,
      detail: `${meeting.clubName} • ${meeting.location}`,
      kind: 'club' as const,
      onPress: () => navigation.navigate('ClubDetail', { clubId: meeting.clubId }),
    }));

    return [...podItems, ...clubItems]
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .slice(0, 4);
  }, [clubsToday, myPods, navigation]);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          void load();
        }} />}
      >
        <View style={styles.utilityRow}>
          <TouchableOpacity
            style={styles.profileChip}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            accessibilityHint="Opens your profile and settings"
          >
            <Text style={styles.profileChipLabel}>Profile</Text>
            <UserAvatar name={user?.name ?? 'User'} avatarUrl={user?.avatarUrl} size={27} />
          </TouchableOpacity>
          {!granted && canAskAgain ? (
            <TouchableOpacity
              style={styles.locationChip}
              activeOpacity={0.86}
              onPress={explainAndRequestLocation}
              accessibilityRole="button"
              accessibilityLabel="Use campus location"
              accessibilityHint="Explains why Bridge wants location before asking for permission"
            >
              <Ionicons name="navigate-outline" size={15} color={palette.scarlet} />
              <Text style={styles.locationChipLabel}>Nearby</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Hero
          eyebrow="Today on campus"
          title={`Your day, ${user?.firstName ?? user?.name?.split(' ')[0] ?? 'friend'}.`}
          subtitle="A quick read on what you already have lined up and what campus is doing around you."
        >
          <View style={styles.heroAgenda}>
            <TouchableOpacity
              style={styles.agendaToggle}
              activeOpacity={0.9}
              onPress={() => setAgendaExpanded((current) => !current)}
            >
              <View style={styles.agendaHeading}>
                <View style={styles.agendaIcon}>
                  <Ionicons name="calendar-outline" size={16} color={palette.scarlet} />
                </View>
                <View style={styles.agendaCopy}>
                  <Text style={styles.agendaTitle}>Today&apos;s plan</Text>
                  <Text style={styles.agendaBody}>
                    {agendaItems.length
                      ? `${agendaItems[0].kind === 'pod' ? 'Next pod' : 'Next meeting'} at ${formatTime(agendaItems[0].time)}`
                      : 'Nothing scheduled yet'}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={agendaExpanded ? 'remove-outline' : 'add-outline'}
                size={20}
                color={palette.ink}
              />
            </TouchableOpacity>

            {agendaExpanded ? (
              agendaItems.length ? (
                <View style={styles.agendaList}>
                  {agendaItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.agendaItem}
                      onPress={item.onPress}
                      activeOpacity={0.85}
                    >
                      <View style={styles.agendaTimePill}>
                        <Text style={styles.agendaTime}>{formatTime(item.time)}</Text>
                      </View>
                      <View style={styles.feedText}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.cardBody} numberOfLines={1}>{item.detail}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.agendaEmpty}>
                  <Text style={styles.cardBody}>No plans on the board yet. Explore to find something worth showing up for.</Text>
                </View>
              )
            ) : null}
          </View>
        </Hero>

        <Panel style={styles.mapPanel}>
          <View style={styles.mapHeader}>
            <View>
              <Text style={styles.mapTitle}>Campus activity map</Text>
              <Text style={styles.mapBody}>Tap a pod marker to navigate to its detail.</Text>
            </View>
            <Ionicons name="navigate-outline" size={20} color={palette.scarlet} />
          </View>
          <MapView
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            initialRegion={{ ...OSU_CAMPUS_CENTER, ...OSU_CAMPUS_DELTA }}
            scrollEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            <Polygon coordinates={OSU_CAMPUS_POLYGON} fillColor="rgba(199,59,34,0.06)" strokeColor="rgba(199,59,34,0.25)" />
            {pods
              .filter((pod) => pod.latitude != null && pod.longitude != null)
              .slice(0, 10)
              .map((pod) => (
                <Marker
                  key={pod.id}
                  coordinate={{ latitude: pod.latitude ?? 0, longitude: pod.longitude ?? 0 }}
                  title={pod.activity?.title ?? 'Pod'}
                  description={pod.location}
                  onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                />
              ))}
          </MapView>
        </Panel>

        <View style={styles.section}>
          <SectionHeader
            title="Your next move"
            actionLabel="All pods"
            onActionPress={() => navigation.navigate('MainTabs', { screen: 'Pods' })}
          />
          {!loaded ? (
            <SkeletonCard />
          ) : yourNextPod ? (
            <Panel>
              <Text style={styles.cardEyebrow}>{formatDateTime(yourNextPod.meetupTime)}</Text>
              <Text style={styles.cardTitle}>{yourNextPod.activity?.title ?? 'Upcoming pod'}</Text>
              <Text style={styles.cardBody}>{yourNextPod.location}</Text>
              <View style={styles.inlineAction}>
                <PrimaryButton label="Open pod" onPress={() => navigation.navigate('PodDetail', { podId: yourNextPod.id })} />
              </View>
            </Panel>
          ) : (
            <EmptyState icon="sparkles-outline" title="No pod lined up yet" body="Use Explore to jump into the live campus flow or start one from an activity page." />
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Open pods" actionLabel="Explore" onActionPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })} />
          {!loaded ? (
            <>
              <SkeletonCard compact />
              <SkeletonCard compact />
            </>
          ) : activePods.length ? activePods.map((pod) => (
            <TouchableOpacity key={pod.id} style={styles.feedCard} onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}>
              <View style={styles.feedRow}>
                <View style={styles.feedText}>
                  <Text style={styles.cardTitle}>{pod.activity?.title ?? 'Pod'}</Text>
                  <Text style={styles.cardBody}>{pod.location}</Text>
                </View>
                <Text style={styles.feedMeta}>{formatTime(pod.meetupTime)}</Text>
              </View>
            </TouchableOpacity>
          )) : <EmptyState icon="moon-outline" title="The feed is quiet" body="When new pods spin up, they’ll land here first." />}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Activities with open pods" />
          {!loaded ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[0, 1, 2].map((item) => (
                <View key={item} style={styles.activityCard}>
                  <SkeletonCard compact />
                </View>
              ))}
            </ScrollView>
          ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {featuredActivities.map((activity) => (
              <TouchableOpacity
                key={activity.id}
                style={styles.activityCard}
                onPress={() => navigation.navigate('ActivityPods', { activity })}
              >
                <Text style={styles.cardEyebrow}>{activity.category}</Text>
                <Text style={styles.cardTitle}>{activity.title}</Text>
                <Text style={styles.cardBody} numberOfLines={2}>{activity.description}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Club meetings today" />
          {!loaded ? (
            <>
              <SkeletonCard compact />
              <SkeletonCard compact />
            </>
          ) : clubsToday.length ? clubsToday.slice(0, 4).map((meeting) => (
            <TouchableOpacity
              key={meeting.id}
              style={styles.clubRow}
              onPress={() => navigation.navigate('ClubDetail', { clubId: meeting.clubId })}
            >
              <View style={styles.clubMeta}>
                <View style={styles.clubIcon}>
                  <Ionicons name="calendar-outline" size={20} color={palette.scarlet} />
                </View>
                <View style={styles.feedText}>
                  <Text style={styles.cardTitle}>{meeting.title}</Text>
                  <Text style={styles.cardBody}>{meeting.clubName} • {meeting.location}</Text>
                </View>
              </View>
              <Text style={styles.feedMeta}>{formatTime(meeting.meetingTime)}</Text>
            </TouchableOpacity>
          )) : <EmptyState icon="people-circle-outline" title="No club meetings today" body="Club meetings for today will appear here once leaders schedule them." />}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  utilityRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  profileChip: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.07)',
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 1,
  },
  profileChipLabel: {
    ...typography.bodyStrong,
    fontSize: 13,
    lineHeight: 18,
    color: palette.slate,
  },
  locationChip: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(199,59,34,0.16)',
  },
  locationChipLabel: {
    ...typography.bodyStrong,
    fontSize: 13,
    lineHeight: 18,
    color: palette.scarlet,
  },
  heroAgenda: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  agendaToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.06)',
    padding: spacing.sm,
  },
  agendaHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  agendaIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1DE',
  },
  agendaCopy: {
    flex: 1,
    gap: 2,
  },
  agendaTitle: {
    ...typography.bodyStrong,
    color: palette.ink,
  },
  agendaBody: {
    ...typography.body,
  },
  agendaList: {
    gap: spacing.xs,
  },
  agendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(16, 33, 43, 0.05)',
  },
  agendaTimePill: {
    minWidth: 62,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(199,59,34,0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  agendaTime: {
    ...typography.label,
    color: palette.scarlet,
    letterSpacing: 0.6,
    textTransform: 'none',
  },
  agendaEmpty: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  mapPanel: {
    gap: spacing.md,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  mapTitle: {
    ...typography.title,
  },
  mapBody: {
    ...typography.body,
    maxWidth: '88%',
  },
  map: {
    height: 220,
    borderRadius: radii.lg,
  },
  section: {
    gap: spacing.sm,
  },
  cardEyebrow: {
    ...typography.label,
  },
  cardTitle: {
    ...typography.title,
  },
  cardBody: {
    ...typography.body,
  },
  inlineAction: {
    marginTop: spacing.md,
  },
  feedCard: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  feedText: {
    flex: 1,
    gap: 4,
  },
  feedMeta: {
    ...typography.bodyStrong,
    color: palette.scarlet,
  },
  activityCard: {
    width: 260,
    marginRight: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  clubIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1DE',
  },
});
