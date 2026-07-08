import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from '../components/CampusMap';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { MapPressEvent } from '../components/CampusMap';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  clearActivityDemand,
  createPod,
  getActivityLocations,
  getApiErrorMessage,
  getPodsByActivity,
  joinPod,
  joinWaitlist,
  signalActivityDemand,
} from '../api';
import { RootStackParamList } from '../../App';
import { Pod } from '../types';
import {
  AppBackdrop,
  Banner,
  Button,
  Card,
  Chip,
  DateTimeField,
  EmptyState,
  ScreenHeader,
  SectionHeader,
  SkeletonCard,
  Slab,
  Sticker,
} from '../components/ui';
import PodTemplatePicker from '../components/PodTemplatePicker';
import {
  OSU_CAMPUS_CENTER,
  OSU_CAMPUS_DELTA,
  OSU_CAMPUS_POLYGON,
  isCampusCoordinate,
} from '../constants/campusMap';
import {
  PodTemplate,
  customCreateDefaults,
  templateCreateOptions,
} from '../constants/podTemplates';
import { formatDateTime } from '../utils/format';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  fonts,
  radii,
  spacing,
  useTheme,
} from '../theme';

import { toast } from '../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'ActivityPods'>;

function dedupeLocations(locations: string[]) {
  const seen = new Set<string>();
  return locations.filter((location) => {
    const key = location
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function ActivityPodsScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { activity, startCreate } = route.params;
  const [pods, setPods] = useState<Pod[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [location, setLocation] = useState('');
  const [meetupTime, setMeetupTime] = useState(() => new Date(customCreateDefaults().meetupTime ?? Date.now()));
  const [maxMembers, setMaxMembers] = useState(4);
  const [selectedPin, setSelectedPin] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(!!startCreate);
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [demandCount, setDemandCount] = useState(activity.demandCount ?? 0);
  const [myDemanded, setMyDemanded] = useState(Boolean(activity.myDemanded));
  const [demandBusy, setDemandBusy] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const latestLocationRef = useRef(location);

  useEffect(() => {
    latestLocationRef.current = location;
  }, [location]);

  useEffect(() => {
    setDemandCount(activity.demandCount ?? 0);
    setMyDemanded(Boolean(activity.myDemanded));
  }, [activity.demandCount, activity.id, activity.myDemanded]);

  const load = useCallback(async () => {
    try {
      const response = await getPodsByActivity(activity.id);
      setPods(response);
      setLoadWarning(null);
    } catch {
      setLoadWarning("Couldn't refresh — return to this screen to retry.");
    } finally {
      setLoaded(true);
    }
  }, [activity.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    let active = true;
    getActivityLocations(activity.id)
      .then((locations) => {
        if (active) setLocationSuggestions(dedupeLocations(locations));
      })
      .catch(() => {
        if (active) setLocationSuggestions([]);
      });
    return () => {
      active = false;
    };
  }, [activity.id]);

  const mappablePods = useMemo(
    () => pods.filter((pod) => pod.latitude != null && pod.longitude != null),
    [pods],
  );

  const handleJoin = async (pod: Pod) => {
    if (pod.status !== 'FORMING') {
      toast.error('Pod is not open', 'This pod is already locked, completed, or expired.');
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
      toast.error('Could not join pod', getApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async () => {
    if (!location.trim()) {
      toast.error(
        'Add a meetup spot',
        'Choose a suggested spot or drop a pin for a custom campus location.',
      );
      return;
    }
    if (
      !selectedPin &&
      locationSuggestions.length > 0 &&
      !locationSuggestions.includes(location.trim())
    ) {
      toast.error(
        'Drop a pin for custom spots',
        'Custom meetup notes need a campus map pin. Choose a suggested spot, or tap the map to save coordinates.',
      );
      return;
    }
    if (
      meetupTime.getTime() < Date.now() ||
      meetupTime.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000
    ) {
      toast.error('Choose a valid time', 'Pods can be scheduled any time within the next week.');
      return;
    }
    setCreating(true);
    try {
      const response = await createPod(activity.id, {
        location: location.trim(),
        meetupTime: meetupTime.toISOString(),
        minMembers: 2,
        maxMembers,
        template: 'custom',
        latitude: selectedPin?.latitude,
        longitude: selectedPin?.longitude,
      });
      navigation.replace('PodDetail', { podId: response.id, justCreated: true });
    } catch (error) {
      toast.error('Could not start pod', getApiErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const handleTemplateCreate = async (template: PodTemplate) => {
    setBusyTemplateId(template.id);
    try {
      const response = await createPod(activity.id, templateCreateOptions(template));
      setTemplateOpen(false);
      navigation.replace('PodDetail', { podId: response.id, justCreated: true });
    } catch (error) {
      toast.error('Could not start pod', getApiErrorMessage(error));
    } finally {
      setBusyTemplateId(null);
    }
  };

  const openCustomComposer = () => {
    const defaults = customCreateDefaults();
    setTemplateOpen(false);
    if (defaults.meetupTime) setMeetupTime(new Date(defaults.meetupTime));
    setMaxMembers(defaults.maxMembers ?? 4);
    setComposerExpanded(true);
  };

  const toggleDemand = async () => {
    setDemandBusy(true);
    try {
      const response = myDemanded
        ? await clearActivityDemand(activity.id)
        : await signalActivityDemand(activity.id);
      setDemandCount(response.demandCount);
      setMyDemanded(response.myDemanded);
    } catch (error) {
      toast.error('Could not update demand', getApiErrorMessage(error));
    } finally {
      setDemandBusy(false);
    }
  };

  const handleMapPress = async (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    // Same fence the server enforces — reject off-campus pins at tap time
    // instead of letting the create call fail later.
    if (!isCampusCoordinate(latitude, longitude)) {
      setLocationMessage(null);
      toast.error(
        'Keep it on campus',
        'Pods meet on campus — drop your pin inside the highlighted area.',
      );
      return;
    }
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
            setLocationMessage(
              'Pin saved and location filled in. Edit it if you want a clearer meetup note.',
            );
          } else {
            setLocationMessage('Pin saved. Keeping the location you typed.');
          }
        } else {
          setLocationMessage(
            'Pin saved, but we could not find a readable address. Type the meetup spot and you can still create the pod.',
          );
        }
      } else {
        setLocationMessage(
          'Pin saved, but we could not find a readable address. Type the meetup spot and you can still create the pod.',
        );
      }
    } catch {
      setLocationMessage(
        'Pin saved, but we could not look up the address. Type the meetup spot and you can still create the pod.',
      );
    } finally {
      setResolvingAddress(false);
    }
  };

  const toggleComposer = () => {
    if (!composerExpanded) {
      setTemplateOpen(true);
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setComposerExpanded((current) => !current);
  };

  return (
    <AppBackdrop>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        <ScreenHeader title="Pods" kicker={activity.category} onBack={() => navigation.goBack()} />
        {loadWarning ? <Banner message={loadWarning} kind="info" /> : null}

        <View style={styles.heroBlock}>
          <Text style={styles.heroTitle}>{activity.title}</Text>
          {activity.description ? (
            <Text style={[typography.body, { color: colors.sub }]}>{activity.description}</Text>
          ) : null}
        </View>

        {/* Composer */}
        <Card padded={false}>
          <Pressable
            style={styles.composerToggle}
            onPress={toggleComposer}
            accessibilityRole="button"
            accessibilityLabel={composerExpanded ? 'Collapse create pod' : 'Expand create pod'}
          >
            <Text style={typography.title}>Start a pod</Text>
            <View
              style={[
                styles.toggleBadge,
                { backgroundColor: colors.primary, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name={composerExpanded ? 'remove' : 'add'}
                size={18}
                color={colors.onPrimary}
              />
            </View>
          </Pressable>
          {composerExpanded ? (
            <View style={[styles.composerBody, { borderTopColor: colors.borderSoft }]}>
              <Text style={typography.caption}>
                Choose a suggested campus spot, or tap the map to save coordinates for a custom
                meetup note.
              </Text>

              <View style={{ gap: 6 }}>
                <Text style={typography.kicker}>Location</Text>
                <View
                  style={[
                    styles.locationWell,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  ]}
                >
                  <TextInput
                    value={location}
                    onChangeText={(value) => {
                      latestLocationRef.current = value;
                      setLocation(value);
                      if (locationMessage) setLocationMessage(null);
                    }}
                    placeholder="Choose below, or drop a map pin first…"
                    placeholderTextColor={colors.faint}
                    style={[styles.locationInput, { color: colors.ink }]}
                    multiline
                  />
                </View>
                <Text style={typography.captionSmall}>
                  {resolvingAddress
                    ? 'Finding an address for the pin…'
                    : (locationMessage ??
                      (selectedPin
                        ? 'Pin coordinates will be saved with this location.'
                        : 'Custom spots require a map pin.'))}
                </Text>
              </View>

              {locationSuggestions.length ? (
                <View style={{ gap: spacing.sm }}>
                  <Text style={typography.kicker}>Suggested spots</Text>
                  <View style={styles.chipWrap}>
                    {locationSuggestions.slice(0, 8).map((suggestion) => (
                      <Chip
                        key={suggestion}
                        label={suggestion}
                        selected={location.trim() === suggestion && !selectedPin}
                        tint={colors.tealSoft}
                        onPress={() => {
                          latestLocationRef.current = suggestion;
                          setLocation(suggestion);
                          setSelectedPin(null);
                          setLocationMessage('Using a suggested campus spot.');
                        }}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={{ gap: 6 }}>
                <Text style={typography.kicker}>Meetup time</Text>
                <View
                  style={[
                    styles.dateWell,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  ]}
                >
                  <DateTimeField
                    value={meetupTime}
                    minimumDate={new Date()}
                    maximumDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
                    onChange={setMeetupTime}
                  />
                </View>
              </View>

              <View style={styles.memberRow}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.subheading}>Max members</Text>
                  <Text style={typography.captionSmall}>2 to 10 people.</Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable
                    style={[
                      styles.stepperButton,
                      {
                        backgroundColor: maxMembers === 2 ? colors.surfaceAlt : colors.ink,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setMaxMembers((current) => Math.max(2, current - 1))}
                    disabled={maxMembers === 2}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease maximum members"
                    accessibilityState={{ disabled: maxMembers === 2 }}
                  >
                    <Ionicons
                      name="remove"
                      size={18}
                      color={maxMembers === 2 ? colors.faint : colors.bg}
                    />
                  </Pressable>
                  <Text style={styles.stepperValue}>{maxMembers}</Text>
                  <Pressable
                    style={[
                      styles.stepperButton,
                      {
                        backgroundColor: maxMembers === 10 ? colors.surfaceAlt : colors.ink,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setMaxMembers((current) => Math.min(10, current + 1))}
                    disabled={maxMembers === 10}
                    accessibilityRole="button"
                    accessibilityLabel="Increase maximum members"
                    accessibilityState={{ disabled: maxMembers === 10 }}
                  >
                    <Ionicons
                      name="add"
                      size={18}
                      color={maxMembers === 10 ? colors.faint : colors.bg}
                    />
                  </Pressable>
                </View>
              </View>

              <Button label="Start pod" onPress={handleCreate} loading={creating} size="lg" icon="flash" />

              <View style={[styles.mapWrap, { borderColor: colors.border }]}>
                <MapView
                  provider={PROVIDER_DEFAULT}
                  style={styles.map}
                  initialRegion={{ ...OSU_CAMPUS_CENTER, ...OSU_CAMPUS_DELTA }}
                  onPress={(event) => {
                    void handleMapPress(event);
                  }}
                >
                  <Polygon
                    coordinates={OSU_CAMPUS_POLYGON}
                    fillColor="rgba(200,16,46,0.06)"
                    strokeColor="rgba(200,16,46,0.3)"
                  />
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
                      pinColor={colors.primary}
                    />
                  ) : null}
                </MapView>
              </View>
            </View>
          ) : null}
        </Card>

        {/* Available pods */}
        <View style={styles.section}>
          <SectionHeader kicker="Join one" title="Available pods" />
          {!loaded ? (
            <>
              <SkeletonCard compact />
              <SkeletonCard compact />
            </>
          ) : pods.length ? (
            pods.map((pod) => {
              const isOpen = pod.status === 'FORMING';
              const isFull = pod.members.length >= pod.maxMembers;
              return (
                <Slab
                  key={pod.id}
                  onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                  faceStyle={styles.podFace}
                  accessibilityLabel={`Open pod at ${pod.location}`}
                >
                  <View style={styles.podTop}>
                    <Text style={typography.heading} numberOfLines={1}>
                      {formatDateTime(pod.meetupTime)}
                    </Text>
                    {!isOpen ? (
                      <Sticker
                        label={pod.status === 'COMPLETED' ? 'Done' : pod.status.toLowerCase()}
                        tint={colors.blueSoft}
                        small
                        tilt={2}
                      />
                    ) : isFull ? (
                      <Sticker label="Full" tint={colors.warningSoft} small tilt={2} />
                    ) : (
                      <Sticker
                        label="Open"
                        tint={colors.successSoft}
                        small
                        tilt={-2}
                      />
                    )}
                  </View>
                  <Text style={typography.caption} numberOfLines={1}>
                    {pod.location}
                  </Text>
                  <Text style={typography.captionSmall}>
                    {pod.members.length}/{pod.maxMembers} joined
                  </Text>
                  <Button
                    label={isOpen ? (isFull ? 'Join waitlist' : 'Join pod') : 'View details'}
                    onPress={() =>
                      isOpen ? void handleJoin(pod) : navigation.navigate('PodDetail', { podId: pod.id })
                    }
                    loading={busyId === pod.id}
                    variant={isOpen ? 'primary' : 'secondary'}
                    size="sm"
                    style={{ alignSelf: 'flex-start', marginTop: 4 }}
                  />
                </Slab>
              );
            })
          ) : (
            <>
              <View
                style={[
                  styles.demandBox,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={typography.subheading}>
                    {demandCount > 0
                      ? `${demandCount} ${demandCount === 1 ? 'person is' : 'people are'} down this week`
                      : 'Be the first signal'}
                  </Text>
                  <Text style={typography.captionSmall}>
                    No commitment. It helps others know there is demand.
                  </Text>
                </View>
                <Chip
                  label={demandBusy ? 'Saving' : myDemanded ? 'You are down' : "I'm down"}
                  selected={myDemanded}
                  icon={myDemanded ? 'checkmark' : 'sparkles'}
                  onPress={demandBusy ? undefined : () => void toggleDemand()}
                  tint={colors.primarySoft}
                />
              </View>
              <EmptyState
                icon="flash"
                title="No pods yet"
                body="Start the first one and set the tone for this activity."
                actionLabel="Start pod"
                onAction={() => setTemplateOpen(true)}
              />
            </>
          )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <PodTemplatePicker
        visible={templateOpen}
        title={`Start ${activity.title}`}
        activities={[activity]}
        activity={activity}
        busyTemplateId={busyTemplateId}
        onClose={() => setTemplateOpen(false)}
        onTemplate={(choice) => void handleTemplateCreate(choice.template)}
        onCustom={openCustomComposer}
      />
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  heroBlock: {
    gap: spacing.sm,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.6,
    color: t.colors.ink,
  },
  composerToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  toggleBadge: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  composerBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  locationWell: {
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  locationInput: {
    fontFamily: fonts.medium,
    fontSize: 15,
    minHeight: 44,
    padding: 0,
    textAlignVertical: 'top' as const,
  },
  chipWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  dateWell: {
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    padding: spacing.sm,
    alignItems: 'flex-start' as const,
  },
  memberRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  stepper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  stepperButton: {
    width: 38,
    height: 38,
    borderRadius: radii.xs,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepperValue: {
    fontFamily: fonts.displayMedium,
    fontSize: 19,
    minWidth: 26,
    textAlign: 'center' as const,
    color: t.colors.ink,
  },
  mapWrap: {
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    overflow: 'hidden' as const,
  },
  map: {
    height: 240,
  },
  section: {
    gap: spacing.md,
  },
  podFace: {
    padding: spacing.lg,
    gap: 5,
  },
  podTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  demandBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
  },
}));
