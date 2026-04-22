import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import { RootStackParamList } from '../../App';
import { getPodsByActivity, joinPod, joinWaitlist, API_USER_MESSAGE } from '../api';
import { Pod } from '../types';
import { useAuth } from '../context/AuthContext';
import PodCard from '../components/PodCard';
import GradientButton from '../components/GradientButton';
import FadeIn from '../components/FadeIn';
import GuidelinesModal from '../components/GuidelinesModal';
import { colors, spacing, radii, typography } from '../theme';
import {
  OSU_CAMPUS_CENTER,
  OSU_CAMPUS_DELTA,
  OSU_CAMPUS_POLYGON,
  SCARLET,
} from '../constants/campusMap';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { getActivityEmoji } from '../utils/activityEmoji';
import { formatPodTime } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'PodList'>;

type SortOption = 'starting_soon' | 'date_posted' | 'most_members';

const SORT_OPTIONS: { key: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'starting_soon', label: 'Starting Soon', icon: 'time-outline' },
  { key: 'date_posted', label: 'Date Posted', icon: 'calendar-outline' },
  { key: 'most_members', label: 'Most Members', icon: 'people-outline' },
];

// Simple cluster: group pods within ~50m of each other
function clusterPods(pods: Pod[]): Array<{ pods: Pod[]; latitude: number; longitude: number }> {
  const clusters: Array<{ pods: Pod[]; latitude: number; longitude: number }> = [];
  const used = new Set<string>();

  for (const pod of pods) {
    if (used.has(pod.id) || pod.latitude == null || pod.longitude == null) continue;
    const cluster: Pod[] = [pod];
    used.add(pod.id);
    for (const other of pods) {
      if (used.has(other.id) || other.latitude == null || other.longitude == null) continue;
      const dLat = (other.latitude - pod.latitude!) * 111320;
      const dLng = (other.longitude - pod.longitude!) * 111320 * Math.cos((pod.latitude! * Math.PI) / 180);
      if (Math.sqrt(dLat * dLat + dLng * dLng) < 50) {
        cluster.push(other);
        used.add(other.id);
      }
    }
    const avgLat = cluster.reduce((s, p) => s + p.latitude!, 0) / cluster.length;
    const avgLng = cluster.reduce((s, p) => s + p.longitude!, 0) / cluster.length;
    clusters.push({ pods: cluster, latitude: avgLat, longitude: avgLng });
  }
  return clusters;
}

interface PodMarkerProps {
  pod: Pod;
  isMember: boolean;
}

function PodMarker({ pod, isMember }: PodMarkerProps) {
  const emoji = getActivityEmoji(pod.activity?.title ?? '', pod.activity?.category ?? '');
  return (
    <View
      style={[
        styles.markerOuter,
        isMember ? styles.markerOuterMember : styles.markerOuterDefault,
      ]}
    >
      <Text style={styles.markerEmoji}>{emoji}</Text>
    </View>
  );
}

interface ClusterMarkerProps {
  count: number;
}

function ClusterMarker({ count }: ClusterMarkerProps) {
  return (
    <View style={styles.clusterMarker}>
      <Text style={styles.clusterCount}>{count}</Text>
    </View>
  );
}

interface BottomSheetProps {
  pod: Pod;
  isMember: boolean;
  onClose: () => void;
  onJoin: (podId: string) => void;
  onView: (podId: string) => void;
  isJoining: boolean;
}

function PodBottomSheet({ pod, isMember, onClose, onJoin, onView, isJoining }: BottomSheetProps) {
  const slideAnim = useRef(new Animated.Value(200)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [slideAnim]);

  const spotsLeft = pod.maxMembers - pod.members.length;
  const emoji = getActivityEmoji(pod.activity?.title ?? '', pod.activity?.category ?? '');
  const canJoin = pod.status === 'FORMING' && spotsLeft > 0 && !isMember;

  return (
    <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={styles.bottomSheetClose} onPress={onClose} hitSlop={12}>
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
      <View style={styles.bottomSheetHeader}>
        <Text style={styles.bottomSheetEmoji}>{emoji}</Text>
        <Text style={styles.bottomSheetTitle} numberOfLines={1}>
          {pod.activity?.title ?? 'Pod'}
        </Text>
      </View>
      <Text style={styles.bottomSheetMeta}>
        {formatPodTime(pod.meetupTime)} · {pod.location}
      </Text>
      <Text style={styles.bottomSheetMembers}>
        {pod.members.length}/{pod.maxMembers} members
        {spotsLeft > 0 ? ` · ${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left` : ' · Full'}
      </Text>
      <View style={styles.bottomSheetActions}>
        {isMember ? (
          <GradientButton
            title="View Pod"
            onPress={() => onView(pod.id)}
            icon="arrow-forward-outline"
          />
        ) : canJoin ? (
          <GradientButton
            title="Join Pod"
            onPress={() => onJoin(pod.id)}
            loading={isJoining}
            disabled={isJoining}
            icon="add-circle-outline"
          />
        ) : (
          <GradientButton
            title="View Pod"
            onPress={() => onView(pod.id)}
            icon="arrow-forward-outline"
          />
        )}
      </View>
    </Animated.View>
  );
}

export default function PodListScreen({ route, navigation }: Props) {
  const { activityId, activityTitle, activityCategory } = route.params;
  const { user, hasAcceptedGuidelines, acceptGuidelines } = useAuth();
  const { granted } = useLocationPermission();

  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [waitlistingId, setWaitlistingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('starting_soon');
  const [pendingJoinPodId, setPendingJoinPodId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);

  const fetchPods = useCallback(async () => {
    try {
      const data = await getPodsByActivity(activityId, sortBy);
      setPods(data);
    } catch (err: unknown) {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activityId, sortBy]);

  useEffect(() => {
    fetchPods();
  }, [fetchPods]);

  const executeJoin = async (podId: string) => {
    setActionId(podId);
    try {
      const pod = await joinPod(podId);
      navigation.replace('Pod', { podId: pod.id });
    } catch (err: unknown) {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setActionId(null);
    }
  };

  const handleJoin = (podId: string) => {
    if (!hasAcceptedGuidelines) {
      setPendingJoinPodId(podId);
    } else {
      executeJoin(podId);
    }
  };

  const handleJoinWaitlist = async (podId: string) => {
    setWaitlistingId(podId);
    try {
      const { position } = await joinWaitlist(podId);
      Alert.alert('Waitlisted!', `You're #${position} on the waitlist. We'll notify you when a spot opens.`);
    } catch (err: unknown) {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setWaitlistingId(null);
    }
  };

  const executeCreate = () => {
    navigation.navigate('CreatePod', {
      activityId,
      activityTitle,
      activityCategory: activityCategory ?? 'Social',
    });
  };

  const handleGuidelinesAccept = async () => {
    await acceptGuidelines();
    const podId = pendingJoinPodId;
    setPendingJoinPodId(null);
    if (podId) executeJoin(podId);
  };

  const handleGuidelinesClose = () => {
    setPendingJoinPodId(null);
  };

  const isAlreadyMember = (pod: Pod) => pod.members.some((m) => m.user.id === user?.id);

  // Map-specific derived data
  const podsOnMap = pods.filter(
    (p) => p.latitude != null && p.longitude != null && p.locationType !== 'private'
  );
  const podsWithoutCoords = pods.filter(
    (p) => p.latitude == null || p.longitude == null
  );
  const clusters = clusterPods(podsOnMap);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const toggleRow = (
    <View style={styles.toggleRow}>
      <TouchableOpacity
        style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setViewMode('list');
          setSelectedPod(null);
        }}
      >
        <Ionicons name="list" size={18} color={viewMode === 'list' ? '#FFFFFF' : colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setViewMode('map');
        }}
      >
        <Ionicons name="map" size={18} color={viewMode === 'map' ? '#FFFFFF' : colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  if (viewMode === 'map') {
    return (
      <View style={styles.container}>
        {/* Toggle in top-right overlay */}
        <View style={styles.mapToggleOverlay}>{toggleRow}</View>

        {podsWithoutCoords.length > 0 && podsOnMap.length < pods.length && (
          <View style={styles.noCoordsBar}>
            <Ionicons name="information-circle-outline" size={14} color="#666666" />
            <Text style={styles.noCoordsText}>Some pods don't have map locations yet</Text>
          </View>
        )}

        <MapView
          provider={PROVIDER_DEFAULT}
          style={{ flex: 1 }}
          initialRegion={{ ...OSU_CAMPUS_CENTER, ...OSU_CAMPUS_DELTA }}
          showsUserLocation={granted}
          onPress={() => setSelectedPod(null)}
        >
          <Polygon
            coordinates={OSU_CAMPUS_POLYGON}
            strokeColor={SCARLET}
            strokeWidth={2}
            fillColor="rgba(204,0,0,0.06)"
          />
          {clusters.map((cluster, idx) => {
            if (cluster.pods.length === 1) {
              const pod = cluster.pods[0];
              return (
                <Marker
                  key={pod.id}
                  coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedPod(pod);
                  }}
                >
                  <PodMarker pod={pod} isMember={isAlreadyMember(pod)} />
                </Marker>
              );
            }
            return (
              <Marker
                key={`cluster-${idx}`}
                coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedPod(cluster.pods[0]);
                }}
              >
                <ClusterMarker count={cluster.pods.length} />
              </Marker>
            );
          })}
        </MapView>

        {selectedPod && (
          <PodBottomSheet
            pod={selectedPod}
            isMember={isAlreadyMember(selectedPod)}
            onClose={() => setSelectedPod(null)}
            onJoin={handleJoin}
            onView={(podId) => navigation.navigate('Pod', { podId })}
            isJoining={actionId === selectedPod.id}
          />
        )}

        <GuidelinesModal
          visible={pendingJoinPodId !== null}
          onAccept={handleGuidelinesAccept}
          onClose={handleGuidelinesClose}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={pods}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPods();
            }}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <View style={styles.headerCreateBtn}>
                <FadeIn delay={0}>
                  <GradientButton
                    title="Start a Pod"
                    onPress={executeCreate}
                    disabled={actionId !== null}
                    icon="add-circle-outline"
                  />
                </FadeIn>
              </View>
              {toggleRow}
            </View>

            {/* Sort options */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sortRow}
            >
              {SORT_OPTIONS.map((opt) => {
                const isActive = sortBy === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.sortChip, isActive && styles.sortChipActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSortBy(opt.key);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={14}
                      color={isActive ? colors.textInverse : colors.textSecondary}
                    />
                    <Text style={[styles.sortText, isActive && styles.sortTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {pods.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color={colors.border} />
                <Text style={styles.emptyTitle}>No pods yet</Text>
                <Text style={styles.emptySubtitle}>Be the first to start one!</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <FadeIn delay={(index + 1) * 70}>
            <PodCard
              pod={item}
              currentUserId={user?.id}
              onJoin={() => handleJoin(item.id)}
              onView={() => navigation.navigate('Pod', { podId: item.id })}
              onJoinWaitlist={() => handleJoinWaitlist(item.id)}
              isJoining={actionId === item.id}
              isJoiningWaitlist={waitlistingId === item.id}
              isMember={isAlreadyMember(item)}
            />
          </FadeIn>
        )}
      />

      <GuidelinesModal
        visible={pendingJoinPodId !== null}
        onAccept={handleGuidelinesAccept}
        onClose={handleGuidelinesClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerCreateBtn: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: {
    padding: 10,
    backgroundColor: colors.surface,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  mapToggleOverlay: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  noCoordsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: '#FFF8E7',
    zIndex: 5,
  },
  noCoordsText: {
    fontSize: 12,
    color: '#666666',
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm - 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sortTextActive: {
    color: colors.textInverse,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  emptySubtitle: {
    ...typography.caption,
  },
  // Map markers
  markerOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  markerOuterDefault: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: SCARLET,
  },
  markerOuterMember: {
    backgroundColor: SCARLET,
    borderWidth: 2,
    borderColor: SCARLET,
  },
  markerEmoji: {
    fontSize: 20,
  },
  clusterMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SCARLET,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  clusterCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Bottom sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  bottomSheetClose: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
    paddingRight: 32,
  },
  bottomSheetEmoji: {
    fontSize: 22,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  bottomSheetMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  bottomSheetMembers: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  bottomSheetActions: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});
