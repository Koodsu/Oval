import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, LayoutAnimation, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { MapPressEvent } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { createPod, getApiErrorMessage, getPodsByActivity, joinPod, joinWaitlist } from '../api';
import { RootStackParamList } from '../../App';
import { Pod } from '../types';
import { EmptyState, Hero, PrimaryButton, Screen, ScreenHeader, SectionHeader, SkeletonCard } from '../components/ui';
import { OSU_CAMPUS_CENTER, OSU_CAMPUS_DELTA, OSU_CAMPUS_POLYGON } from '../constants/campusMap';
import { formatDateTime } from '../utils/format';
import { palette, radii, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivityPods'>;

export default function ActivityPodsScreen({ route, navigation }: Props) {
  const { activity, startCreate } = route.params;
  const [pods, setPods] = useState<Pod[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [location, setLocation] = useState('');
  const [meetupTime, setMeetupTime] = useState(() => new Date(Date.now() + 45 * 60 * 1000));
  const [maxMembers, setMaxMembers] = useState(4);
  const [selectedPin, setSelectedPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [composerExpanded, setComposerExpanded] = useState(!!startCreate);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const latestLocationRef = useRef(location);

  useEffect(() => {
    latestLocationRef.current = location;
  }, [location]);

  const load = useCallback(async () => {
    try {
      const response = await getPodsByActivity(activity.id);
      setPods(response);
    } catch (error) {
      Alert.alert('Could not load pods', getApiErrorMessage(error));
    } finally {
      setLoaded(true);
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
    if (pod.status !== 'FORMING') {
      Alert.alert('Pod is not open', 'This pod is already locked, completed, or expired.');
      return;
    }
    setBusyId(pod.id);
    try {
      if (pod.members.length >= pod.maxMembers) {
        await joinWaitlist(pod.id);
      } else {
        await joinPod(pod.id);
      }
      navigation.navigate('PodDetail', { podId: pod.id });
    } catch (error) {
      Alert.alert('Could not join pod', getApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async () => {
    if (!location.trim()) {
      Alert.alert('Add a meetup spot', 'Type where people should meet. You can also drop a pin, but it is optional.');
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
    } catch (error) {
      Alert.alert('Could not start pod', getApiErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const handleMapPress = async (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const locationBeforeLookup = latestLocationRef.current;
    setSelectedPin({ latitude, longitude });
    setResolvingAddress(true);
    setLocationMessage('Pin saved. Looking for an address you can edit.');
    try {
      const result = await Location.reverseGeocodeAsync({ latitude, longitude });
      const first = result[0];
      if (first) {
        const street = [first.name, first.street].filter(Boolean).join(' ').trim();
        const locality = [first.city, first.region].filter(Boolean).join(', ').trim();
        const resolved = [street, locality].filter(Boolean).join(' • ');
        if (resolved) {
          if (latestLocationRef.current === locationBeforeLookup) {
            latestLocationRef.current = resolved;
            setLocation(resolved);
            setLocationMessage('Pin saved and location filled in. Edit it if you want a clearer meetup note.');
          } else {
            setLocationMessage('Pin saved. Keeping the location you typed.');
          }
        } else {
          setLocationMessage('Pin saved, but we could not find a readable address. Type the meetup spot and you can still create the pod.');
        }
      } else {
        setLocationMessage('Pin saved, but we could not find a readable address. Type the meetup spot and you can still create the pod.');
      }
    } catch {
      setLocationMessage('Pin saved, but we could not look up the address. Type the meetup spot and you can still create the pod.');
    } finally {
      setResolvingAddress(false);
    }
  };

  const toggleComposer = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setComposerExpanded((current) => !current);
  };

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
            onPress={toggleComposer}
            activeOpacity={0.9}
          >
            <Text style={styles.sectionTitleStatic}>Create pod</Text>
            <Text style={styles.chevron}>{composerExpanded ? '-' : '+'}</Text>
          </TouchableOpacity>
          {composerExpanded ? (
          <View style={styles.composerWrap}>
            <View style={styles.creatorCard}>
              <View style={styles.creatorPanel}>
              <Text style={styles.panelBody}>Type a meetup spot, or tap the map to save coordinates and fill in an address when available.</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Location</Text>
                <TextInput
                  value={location}
                  onChangeText={(value) => {
                    latestLocationRef.current = value;
                    setLocation(value);
                    if (locationMessage) setLocationMessage(null);
                  }}
                  placeholder="Oval lawn, Thompson Library lobby..."
                  placeholderTextColor={palette.slate}
                  style={styles.locationInput}
                  multiline
                />
                <Text style={styles.locationHint}>
                  {resolvingAddress
                    ? 'Finding an address for the pin...'
                    : locationMessage ?? (selectedPin ? 'Pin coordinates will be saved with this location.' : 'A map pin is optional.')}
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
          </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Available pods" />
          {!loaded ? (
            <>
              <SkeletonCard compact />
              <SkeletonCard compact />
            </>
          ) : pods.length ? pods.map((pod) => {
            const isOpen = pod.status === 'FORMING';
            const isFull = pod.members.length >= pod.maxMembers;
            return (
              <TouchableOpacity key={pod.id} style={styles.row} onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}>
                <View style={styles.rowText}>
                  <Text style={styles.title}>{formatDateTime(pod.meetupTime)}</Text>
                  <Text style={styles.body}>{pod.location}</Text>
                  <Text style={styles.body}>{pod.members.length}/{pod.maxMembers} joined • {pod.status.toLowerCase()}</Text>
                </View>
                <View style={styles.rowAction}>
                  <PrimaryButton
                    label={isOpen ? (isFull ? 'Waitlist' : 'Join') : 'View details'}
                    onPress={() => isOpen ? void handleJoin(pod) : navigation.navigate('PodDetail', { podId: pod.id })}
                    loading={busyId === pod.id}
                    kind={isOpen ? 'solid' : 'ghost'}
                  />
                </View>
              </TouchableOpacity>
            );
          }) : <EmptyState icon="flash-outline" title="No pods yet" body="Start the first one and set the tone for this activity." />}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
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
  composerWrap: {},
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
  inputWrap: {
    borderRadius: radii.md,
    backgroundColor: palette.cream,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 6,
  },
  inputLabel: {
    ...typography.label,
  },
  locationInput: {
    ...typography.body,
    color: palette.ink,
    minHeight: 46,
    padding: 0,
    textAlignVertical: 'top',
  },
  locationHint: {
    ...typography.body,
    fontSize: 13,
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
