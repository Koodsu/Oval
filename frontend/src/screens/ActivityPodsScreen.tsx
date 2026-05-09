import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { MapPressEvent } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { API_USER_MESSAGE, createPod, getPodsByActivity, joinPod, joinWaitlist } from '../api';
import { RootStackParamList } from '../../App';
import { Pod } from '../types';
import { EmptyState, Hero, PrimaryButton, Screen, ScreenHeader, SectionHeader } from '../components/ui';
import { OSU_CAMPUS_CENTER, OSU_CAMPUS_DELTA, OSU_CAMPUS_POLYGON } from '../constants/campusMap';
import { formatDateTime } from '../utils/format';
import { palette, radii, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivityPods'>;

export default function ActivityPodsScreen({ route, navigation }: Props) {
  const { activity } = route.params;
  const [pods, setPods] = useState<Pod[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [location, setLocation] = useState('');
  const [meetupTime, setMeetupTime] = useState(() => new Date(Date.now() + 45 * 60 * 1000));
  const [maxMembers, setMaxMembers] = useState(4);
  const [selectedPin, setSelectedPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const composerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(composerAnim, {
      toValue: composerExpanded ? 1 : 0,
      useNativeDriver: false,
      tension: 68,
      friction: 12,
    }).start();
  }, [composerAnim, composerExpanded]);

  const load = useCallback(async () => {
    try {
      const response = await getPodsByActivity(activity.id);
      setPods(response);
    } catch {
      Alert.alert('Could not load pods', API_USER_MESSAGE);
    }
  }, [activity.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const mappablePods = useMemo(
    () => pods.filter((pod) => pod.latitude != null && pod.longitude != null),
    [pods]
  );

  const handleJoin = async (pod: Pod) => {
    setBusyId(pod.id);
    try {
      if (pod.members.length >= pod.maxMembers) {
        await joinWaitlist(pod.id);
      } else {
        await joinPod(pod.id);
      }
      navigation.navigate('PodDetail', { podId: pod.id });
    } catch {
      Alert.alert('Could not join pod', API_USER_MESSAGE);
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async () => {
    if (!location.trim()) {
      Alert.alert('Location needed', 'Set a location for the pod.');
      return;
    }
    if (meetupTime.getTime() < Date.now() || meetupTime.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) {
      Alert.alert('Choose a valid time', 'Pods can be scheduled any time within the next week.');
      return;
    }
    setCreating(true);
    try {
      const response = await createPod(activity.id, {
        location: location.trim(),
        meetupTime: meetupTime.toISOString(),
        minMembers: 2,
        maxMembers,
        latitude: selectedPin?.latitude,
        longitude: selectedPin?.longitude,
      });
      navigation.replace('PodDetail', { podId: response.id });
    } catch {
      Alert.alert('Could not start pod', API_USER_MESSAGE);
    } finally {
      setCreating(false);
    }
  };

  const handleMapPress = async (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedPin({ latitude, longitude });
    setResolvingAddress(true);
    try {
      const result = await Location.reverseGeocodeAsync({ latitude, longitude });
      const first = result[0];
      if (first) {
        const street = [first.name, first.street].filter(Boolean).join(' ').trim();
        const locality = [first.city, first.region].filter(Boolean).join(', ').trim();
        const resolved = [street, locality].filter(Boolean).join(' • ');
        setLocation(resolved);
      } else {
        setLocation('');
      }
    } catch {
      setLocation('');
    } finally {
      setResolvingAddress(false);
    }
  };

  const composerHeight = composerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 760],
  });

  const composerOpacity = composerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const composerRotate = composerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <ScreenHeader title="Pods" onBack={() => navigation.goBack()} />
        <Hero eyebrow={activity.category} title={activity.title} subtitle={activity.description} />

        <View style={styles.panel}>
          <TouchableOpacity
            style={styles.composerToggle}
            onPress={() => setComposerExpanded((current) => !current)}
            activeOpacity={0.9}
          >
            <Text style={styles.sectionTitleStatic}>Create pod</Text>
            <Animated.View style={{ transform: [{ rotate: composerRotate }] }}>
              <Text style={styles.chevron}>+</Text>
            </Animated.View>
          </TouchableOpacity>
          <Animated.View style={[styles.composerWrap, { maxHeight: composerHeight, opacity: composerOpacity }]}>
            <View style={styles.creatorCard}>
              <View style={styles.creatorPanel}>
              <Text style={styles.panelBody}>Tap anywhere on the map to place the pod and pull the location from that pin.</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyLabel}>Location</Text>
                <Text style={[styles.readonlyValue, !selectedPin && styles.readonlyPlaceholder]}>
                  {resolvingAddress ? 'Finding address...' : selectedPin ? location : 'Drop a pin on the map below'}
                </Text>
              </View>
              <View style={styles.dateWrap}>
                <Text style={styles.body}>Meetup time</Text>
                <DateTimePicker
                  value={meetupTime}
                  mode="datetime"
                  minimumDate={new Date()}
                  maximumDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
                  onChange={(_, value) => {
                    if (value) setMeetupTime(value);
                  }}
                  display="default"
                />
              </View>
              <View style={styles.memberRow}>
                <View style={styles.memberCopy}>
                  <Text style={styles.panelTitle}>Max members</Text>
                  <Text style={styles.body}>Anywhere from 2 to 10 people.</Text>
                </View>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepperButton} onPress={() => setMaxMembers((current) => Math.max(2, current - 1))}>
                    <Text style={styles.stepperText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{maxMembers}</Text>
                  <TouchableOpacity style={styles.stepperButton} onPress={() => setMaxMembers((current) => Math.min(10, current + 1))}>
                    <Text style={styles.stepperText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <PrimaryButton label="Start pod" onPress={handleCreate} loading={creating} />
              <MapView
                provider={PROVIDER_DEFAULT}
                style={styles.map}
                initialRegion={{ ...OSU_CAMPUS_CENTER, ...OSU_CAMPUS_DELTA }}
                onPress={(event) => {
                  void handleMapPress(event);
                }}
              >
                <Polygon coordinates={OSU_CAMPUS_POLYGON} fillColor="rgba(199,59,34,0.06)" strokeColor="rgba(199,59,34,0.25)" />
                {mappablePods.map((pod) => (
                  <Marker
                    key={pod.id}
                    coordinate={{ latitude: pod.latitude ?? 0, longitude: pod.longitude ?? 0 }}
                    title={activity.title}
                    description={pod.location}
                  />
                ))}
                {selectedPin ? (
                  <Marker
                    coordinate={selectedPin}
                    title="New pod"
                    description={location.trim() || 'Pinned meetup spot'}
                    pinColor={palette.scarlet}
                  />
                ) : null}
              </MapView>
            </View>
            </View>
          </Animated.View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Available pods" />
          {pods.length ? pods.map((pod) => (
            <TouchableOpacity key={pod.id} style={styles.row} onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}>
              <View style={styles.rowText}>
                <Text style={styles.title}>{formatDateTime(pod.meetupTime)}</Text>
                <Text style={styles.body}>{pod.location}</Text>
                <Text style={styles.body}>{pod.members.length}/{pod.maxMembers} joined • {pod.status.toLowerCase()}</Text>
              </View>
              <View style={styles.rowAction}>
                <PrimaryButton
                  label={pod.members.length >= pod.maxMembers ? 'Waitlist' : 'Join'}
                  onPress={() => void handleJoin(pod)}
                  loading={busyId === pod.id}
                />
              </View>
            </TouchableOpacity>
          )) : <EmptyState icon="flash-outline" title="No pods yet" body="Start the first one and set the tone for this activity." />}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  panel: {
    gap: spacing.md,
  },
  panelTitle: {
    ...typography.title,
  },
  panelBody: {
    ...typography.body,
  },
  map: {
    height: 240,
    borderRadius: radii.lg,
  },
  creatorPanel: {
    gap: spacing.sm,
  },
  creatorCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
  },
  composerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  chevron: {
    ...typography.title,
    color: palette.scarlet,
  },
  sectionTitleStatic: {
    ...typography.h2,
    fontSize: 20,
    color: palette.ink,
  },
  composerWrap: {
    overflow: 'hidden',
  },
  section: {
    gap: spacing.sm,
  },
  row: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  rowText: {
    gap: 4,
  },
  rowAction: {
    alignSelf: 'flex-start',
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
  },
  readonlyField: {
    borderRadius: radii.md,
    backgroundColor: palette.cream,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: 6,
  },
  readonlyLabel: {
    ...typography.label,
  },
  readonlyValue: {
    ...typography.body,
    color: palette.ink,
  },
  readonlyPlaceholder: {
    color: palette.slate,
  },
  dateWrap: {
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  memberCopy: {
    flex: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    color: palette.white,
    fontSize: 22,
    lineHeight: 22,
  },
  stepperValue: {
    ...typography.title,
    minWidth: 24,
    textAlign: 'center',
  },
});
