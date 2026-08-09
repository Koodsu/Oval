import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from '../components/CampusMap';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSharedStateVersion } from '../context/SharedStateInvalidationContext';
import type { MapPressEvent } from '../components/CampusMap';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  clearActivityDemand,
  createPod,
  getActivities,
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
  Field,
  ScreenHeader,
  SectionHeader,
  Sheet,
  SkeletonCard,
  Slab,
  Sticker,
} from '../components/ui';
import {
  OSU_CAMPUS_CENTER,
  OSU_CAMPUS_DELTA,
  OSU_CAMPUS_POLYGON,
  isCampusCoordinate,
} from '../constants/campusMap';
import { customCreateDefaults } from '../constants/podTemplates';
import { formatDateTime } from '../utils/format';
import { getPodTitleValidationError } from '../utils/podTitleValidation';
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
import { useAuth } from '../context/AuthContext';
type Props = NativeStackScreenProps<RootStackParamList, 'ActivityPods'> & {
  preview?: boolean;
};

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

const POD_TITLE_EXAMPLES: Record<string, string> = {
  'study-group': 'CSE 2231 midterm review',
  'reading-book-club': 'Sci-fi book club kickoff',
  'pickup-basketball': '3v3 at the RPAC',
  'pickup-soccer': 'Beginner soccer at Lincoln Fields',
  'pickup-volleyball': 'Sunset grass volleyball',
  'tennis-pickleball': 'Beginner pickleball doubles',
  'running-jogging': 'Easy 5K around campus',
  swimming: 'Morning lap swim',
  golf: 'Driving range after class',
  bowling: 'Friday bowling night',
  frisbee: 'Casual frisbee on the Oval',
  'gym-partner': 'Push day at the RPAC',
  yoga: 'Beginner sunset yoga',
  meditation: '20-minute guided reset',
  'nature-walk': 'Olentangy Trail walk',
  'casual-hangout': 'Mirror Lake sunset hang',
  'movie-watch-party': 'Buckeyes watch party',
  'go-to-event': 'Gallery opening at the Wex',
  'video-games': 'Mario Kart tournament',
  'board-games': 'Catan at the Union',
  'card-games': 'Poker night',
  'tabletop-rpgs': 'Beginner D&D one-shot',
  'mobile-games': 'Pokémon GO campus walk',
  trivia: 'Thursday trivia team',
  chess: 'Beginner chess meetup',
  'food-bank-volunteering': 'Saturday food packing shift',
  'animal-shelter-volunteering': 'Shelter volunteer afternoon',
  'medical-center-volunteering': 'Care-kit assembly night',
  'other-volunteering': 'Oval cleanup crew',
  'cook-together': 'Homemade pasta night',
  'eat-at-restaurant': 'Sushi on High Street',
  'eat-at-dining-hall': 'Dinner at Scott',
  'grab-coffee-tea': 'Coffee before class',
  'bake-something': 'Brownie bake night',
  picnic: 'Sunday picnic on the Oval',
  'draw-paint': 'Watercolor at Mirror Lake',
  crafting: 'Crochet and conversation',
  'creative-writing': 'Poetry workshop',
  'play-practice-music': 'Acoustic jam session',
  photography: 'Golden-hour photo walk',
  dance: 'Beginner salsa practice',
};

export default function ActivityPodsScreen({ route, navigation, preview = false }: Props) {
  const sharedStateVersion = useSharedStateVersion('pods', 'activities');
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  const { user } = useAuth();
  const { activity, startCreate } = route.params;
  const [pods, setPods] = useState<Pod[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // The activity is the broad category (for example, "Card Games"); the pod
  // title should describe the specific plan people are joining.
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [titleServerError, setTitleServerError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [location, setLocation] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [meetupTime, setMeetupTime] = useState(() => new Date(customCreateDefaults().meetupTime ?? Date.now()));
  const [maxMembers, setMaxMembers] = useState(4);
  const [selectedPin, setSelectedPin] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [locationSheetVisible, setLocationSheetVisible] = useState(false);
  const [draftLocation, setDraftLocation] = useState('');
  const [draftAddress, setDraftAddress] = useState('');
  const [draftPin, setDraftPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [composerExpanded, setComposerExpanded] = useState(Boolean(startCreate));
  const [demandCount, setDemandCount] = useState(activity.demandCount ?? 0);
  const [myDemanded, setMyDemanded] = useState(Boolean(activity.myDemanded));
  const [demandBusy, setDemandBusy] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(preview);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const liveTitleError = getPodTitleValidationError(title);
  const titleFieldError =
    titleServerError ?? (title.trim() || titleTouched ? liveTitleError : null);

  useEffect(() => {
    setDemandCount(activity.demandCount ?? 0);
    setMyDemanded(Boolean(activity.myDemanded));
  }, [activity.demandCount, activity.id, activity.myDemanded]);

  const load = useCallback(async () => {
    if (preview) {
      setLoaded(true);
      return;
    }
    try {
      const [podResponse, activityResponse] = await Promise.all([
        getPodsByActivity(activity.id),
        getActivities(),
      ]);
      setPods(podResponse);
      const latestActivity = activityResponse.find((item) => item.id === activity.id);
      if (latestActivity) {
        setDemandCount(latestActivity.demandCount ?? 0);
        setMyDemanded(Boolean(latestActivity.myDemanded));
      }
      setLoadWarning(null);
    } catch {
      setLoadWarning("Couldn't refresh — return to this screen to retry.");
    } finally {
      setLoaded(true);
    }
  }, [activity.id, preview, sharedStateVersion]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, sharedStateVersion]),
  );

  useEffect(() => {
    if (preview) {
      setLocationSuggestions(['The Oval', 'Mirror Lake', 'Thompson Library']);
      return;
    }
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
  }, [activity.id, preview, sharedStateVersion]);

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
    setTitleTouched(true);
    const titleError = getPodTitleValidationError(title);
    if (titleError) {
      return;
    }
    if (!location.trim() || !locationAddress.trim()) {
      toast.error(
        'Add a meetup spot',
        'Choose an address and add the short display name people will see.',
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
        title: title.trim(),
        note: note.trim() || undefined,
        location: location.trim(),
        locationAddress: locationAddress.trim(),
        meetupTime: meetupTime.toISOString(),
        minMembers: 2,
        maxMembers,
        template: 'custom',
        latitude: selectedPin?.latitude,
        longitude: selectedPin?.longitude,
      });
      navigation.replace('PodDetail', { podId: response.id, justCreated: true });
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (/pod title|descriptive pod title|safety rules/i.test(message)) {
        setTitleServerError(message);
      } else {
        toast.error('Could not start pod', message);
      }
    } finally {
      setCreating(false);
    }
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
    setDraftPin({ latitude, longitude });
    setResolvingAddress(true);
    setLocationMessage('Pin saved. Looking up its address…');
    try {
      const result = await Location.reverseGeocodeAsync({ latitude, longitude });
      const first = result[0];
      if (first) {
        const street = [first.name, first.street].filter(Boolean).join(' ').trim();
        const locality = [first.city, first.region, first.postalCode].filter(Boolean).join(', ').trim();
        const resolved = [street, locality].filter(Boolean).join(', ');
        if (resolved) {
          setDraftAddress(resolved);
          if (!draftLocation.trim()) {
            setDraftLocation(first.name || first.street || 'Meetup spot');
          }
          setLocationMessage('Address found. Add a simple display name, then save.');
        } else {
          setLocationMessage('Pin saved. Type the street address before saving.');
        }
      } else {
        setLocationMessage('Pin saved. Type the street address before saving.');
      }
    } catch {
      setLocationMessage('Pin saved. Type the street address before saving.');
    } finally {
      setResolvingAddress(false);
    }
  };

  const openLocationSheet = () => {
    setDraftLocation(location);
    setDraftAddress(locationAddress);
    setDraftPin(selectedPin);
    setLocationMessage(null);
    setLocationSheetVisible(true);
  };

  const saveLocation = async () => {
    const displayName = draftLocation.trim();
    const address = draftAddress.trim();
    if (!displayName || !address) {
      setLocationMessage('Add both a display name and an address.');
      return;
    }

    let resolvedPin = draftPin;
    if (!resolvedPin) {
      setResolvingAddress(true);
      setLocationMessage('Finding that address on campus…');
      try {
        const results = await Location.geocodeAsync(address);
        resolvedPin =
          results.find((candidate) =>
            isCampusCoordinate(candidate.latitude, candidate.longitude),
          ) ?? null;
      } catch {
        resolvedPin = null;
      } finally {
        setResolvingAddress(false);
      }
    }

    const isKnownSpot = locationSuggestions.includes(displayName);
    if (!resolvedPin && !isKnownSpot) {
      setLocationMessage(
        'We could not place that address on OSU campus. Try a fuller address or drop a pin.',
      );
      return;
    }

    setLocation(displayName);
    setLocationAddress(address);
    setSelectedPin(resolvedPin);
    setLocationMessage(null);
    setLocationSheetVisible(false);
  };

  const toggleComposer = () => {
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
        <ScreenHeader
          title={composerExpanded ? 'Create a pod' : 'Pods'}
          kicker={activity.category}
          onBack={() => navigation.goBack()}
        />
        {loadWarning ? <Banner message={loadWarning} kind="info" /> : null}

        {composerExpanded ? (
          <View style={styles.heroBlock}>
            <View style={styles.progressRow}>
              <View style={[styles.progressDot, { backgroundColor: colors.primary }]} />
              <View style={[styles.progressLine, { backgroundColor: colors.border }]} />
              <View style={[styles.progressDot, { backgroundColor: colors.sunken }]} />
              <View style={[styles.progressLine, { backgroundColor: colors.border }]} />
              <View style={[styles.progressDot, { backgroundColor: colors.sunken }]} />
            </View>
            <Text style={styles.heroTitle} maxFontSizeMultiplier={2}>
              Make a plan
            </Text>
            <Text style={[typography.body, { color: colors.sub }]} maxFontSizeMultiplier={2}>
              Bring people together around something simple.
            </Text>
          </View>
        ) : (
          <View style={styles.heroBlock}>
            <Text style={styles.heroTitle} maxFontSizeMultiplier={2}>
              {activity.title}
            </Text>
            {activity.description ? (
              <Text style={[typography.body, { color: colors.sub }]} maxFontSizeMultiplier={2}>
                {activity.description}
              </Text>
            ) : null}
          </View>
        )}

        {/* Composer */}
        <Card padded={false} faceStyle={composerExpanded ? styles.composerCard : undefined}>
          <Pressable
            style={[styles.composerToggle, accessibilityLayout && styles.composerToggleLargeText]}
            onPress={toggleComposer}
            accessibilityRole="button"
            accessibilityLabel={composerExpanded ? 'Collapse create pod' : 'Expand create pod'}
          >
            <View>
              <Text style={typography.title} maxFontSizeMultiplier={2}>
                {composerExpanded ? 'Pod details' : 'Start a pod'}
              </Text>
              {!composerExpanded ? (
                <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
                  Turn {activity.title.toLowerCase()} into a plan.
                </Text>
              ) : null}
            </View>
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
              <Field
                label="What are you planning?"
                value={title}
                onChangeText={(value) => {
                  setTitle(value);
                  setTitleServerError(null);
                }}
                onBlur={() => setTitleTouched(true)}
                placeholder={
                  (activity.artworkKey && POD_TITLE_EXAMPLES[activity.artworkKey]) ||
                  `A specific ${activity.title.toLowerCase()} plan`
                }
                maxLength={60}
                error={titleFieldError}
                hint={title.trim() && !liveTitleError
                  ? 'Looks good — this is what people will see in the feed.'
                  : `${activity.title} is the activity. Add the specific plan here.`}
              />

              <View style={{ gap: 6 }}>
                <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
                  Date & time
                </Text>
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

              <View style={{ gap: 6 }}>
                <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
                  Where
                </Text>
                <Pressable
                  onPress={openLocationSheet}
                  accessibilityRole="button"
                  accessibilityLabel="Choose pod location"
                  style={({ pressed }) => [
                    styles.locationPicker,
                    accessibilityLayout && styles.locationPickerLargeText,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View style={[styles.locationIcon, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons name="location-outline" size={19} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[typography.bodyMedium, { color: location ? colors.ink : colors.faint }]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={2}
                    >
                      {location || 'Choose an address'}
                    </Text>
                    {locationAddress && locationAddress !== location ? (
                      <Text
                        style={typography.captionSmall}
                        numberOfLines={accessibilityLayout ? undefined : 1}
                        maxFontSizeMultiplier={2}
                      >
                        {locationAddress}
                      </Text>
                    ) : null}
                  </View>
                  {!accessibilityLayout ? (
                    <Ionicons name="chevron-forward" size={18} color={colors.sub} />
                  ) : null}
                </Pressable>
              </View>

              <View style={[styles.memberRow, accessibilityLayout && styles.memberRowLargeText]}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
                    Spots
                  </Text>
                  <Text style={typography.bodyMedium} maxFontSizeMultiplier={2}>
                    Keep the group small.
                  </Text>
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
                  <Text style={styles.stepperValue} maxFontSizeMultiplier={2}>
                    {maxMembers}
                  </Text>
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

              <Field
                label="Note (optional)"
                value={note}
                onChangeText={setNote}
                placeholder="Easy pace. Coffee after!"
                maxLength={120}
                multiline
                inputStyle={styles.noteInput}
              />

              <View style={[styles.preview, { borderColor: colors.border }]}>
                <View style={[styles.previewHeading, accessibilityLayout && styles.previewHeadingLargeText]}>
                  <Text style={typography.subheading} maxFontSizeMultiplier={2}>
                    Live preview
                  </Text>
                  <Sticker label={activity.category} tint={colors.greenSoft} small />
                </View>
                <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
                  {formatDateTime(meetupTime.toISOString())}
                </Text>
                <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
                  {location || 'Choose a meetup spot'} · {maxMembers} spots
                </Text>
                <Text style={[typography.title, { marginTop: spacing.sm }]} maxFontSizeMultiplier={2}>
                  {title.trim() || activity.title}
                </Text>
                {note.trim() ? (
                  <Text style={typography.caption} maxFontSizeMultiplier={2}>
                    {note.trim()}
                  </Text>
                ) : null}
              </View>

              <Button
                label="Create pod"
                onPress={handleCreate}
                loading={creating}
                disabled={Boolean(liveTitleError || titleServerError)}
                size="lg"
              />
              <View style={[styles.privateHint, accessibilityLayout && styles.privateHintLargeText]}>
                <Ionicons name="lock-closed-outline" size={14} color={colors.sub} />
                <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
                  Only invited members can see private pods.
                </Text>
              </View>
            </View>
          ) : null}
        </Card>

        {/* Available pods */}
        {!composerExpanded ? <View style={styles.section}>
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
              const isMember = pod.members.some((member) => member.userId === user?.id);
              const onWaitlist = pod.myWaitlistPosition != null;
              return (
                <Slab
                  key={pod.id}
                  faceStyle={styles.podFace}
                >
                  <View style={styles.podTop}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={typography.heading} numberOfLines={1}>
                        {pod.title?.trim() || activity.title}
                      </Text>
                      <Text style={typography.captionSmall} numberOfLines={1}>
                        {formatDateTime(pod.meetupTime)}
                      </Text>
                    </View>
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
                    label={
                      isMember
                        ? 'Open pod'
                        : onWaitlist
                          ? `On waitlist · #${pod.myWaitlistPosition}`
                          : isOpen
                            ? isFull
                              ? 'Join waitlist'
                              : 'Join pod'
                            : 'View details'
                    }
                    onPress={() =>
                      isOpen && !isMember && !onWaitlist
                        ? void handleJoin(pod)
                        : navigation.navigate('PodDetail', { podId: pod.id })
                    }
                    loading={busyId === pod.id}
                    variant={isOpen && !isMember && !onWaitlist ? 'primary' : 'secondary'}
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
                onAction={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setComposerExpanded(true);
                }}
              />
            </>
          )}
        </View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <Sheet
        visible={locationSheetVisible}
        onClose={() => setLocationSheetVisible(false)}
        title="Choose location"
        kicker="Meetup spot"
        scrollable
      >
        <View style={styles.locationSheet}>
          <Text style={typography.caption}>
            Pick the address, then add the short name people should see in the pod.
          </Text>
          <Field
            label="Display name"
            value={draftLocation}
            onChangeText={(value) => {
              setDraftLocation(value);
              setLocationMessage(null);
            }}
            placeholder="Hillside Nature Trail"
            maxLength={120}
          />
          <Field
            label="Address"
            value={draftAddress}
            onChangeText={(value) => {
              setDraftAddress(value);
              setDraftPin(null);
              setLocationMessage(null);
            }}
            placeholder="1739 N High St, Columbus, OH"
            autoCapitalize="words"
            maxLength={180}
          />
          {locationSuggestions.length ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={typography.captionSmall}>Campus favorites</Text>
              <View style={styles.chipWrap}>
                {locationSuggestions.slice(0, 6).map((suggestion) => (
                  <Chip
                    key={suggestion}
                    label={suggestion}
                    selected={draftLocation === suggestion}
                    tint={colors.tealSoft}
                    onPress={() => {
                      setDraftLocation(suggestion);
                      setDraftAddress(suggestion);
                      setDraftPin(null);
                      setLocationMessage('Campus spot selected. You can replace it with a street address.');
                    }}
                  />
                ))}
              </View>
            </View>
          ) : null}
          <View style={[styles.mapWrap, { borderColor: colors.border }]}>
            <MapView
              provider={PROVIDER_DEFAULT}
              accessibilityLabel="Campus map showing pod and meetup locations"
              accessibilityHint="Use the location field or campus spot suggestions to choose a location without the map"
              style={styles.map}
              initialRegion={{ ...OSU_CAMPUS_CENTER, ...OSU_CAMPUS_DELTA }}
              onPress={(event) => void handleMapPress(event)}
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
                  title={pod.title || activity.title}
                  description={pod.location}
                />
              ))}
              {draftPin ? (
                <Marker
                  coordinate={draftPin}
                  title={draftLocation || 'New pod'}
                  description={draftAddress || 'Pinned meetup spot'}
                  pinColor={colors.primary}
                />
              ) : null}
            </MapView>
          </View>
          <Text style={[typography.captionSmall, locationMessage ? { color: colors.sub } : null]}>
            {resolvingAddress
              ? 'Looking up the location…'
              : (locationMessage ?? 'Tap the map to choose a precise campus address.')}
          </Text>
          <Button
            label={resolvingAddress ? 'Finding address…' : 'Save location'}
            onPress={() => void saveLocation()}
            disabled={resolvingAddress}
          />
        </View>
      </Sheet>
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
  composerToggleLargeText: {
    alignItems: 'flex-start' as const,
  },
  composerCard: {
    borderRadius: radii.md,
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
  chipWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    width: 154,
    marginBottom: spacing.xs,
  },
  progressDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  progressLine: {
    height: 2,
    flex: 1,
  },
  locationPicker: {
    minHeight: 58,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  locationPickerLargeText: {
    alignItems: 'flex-start' as const,
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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
  memberRowLargeText: {
    alignItems: 'flex-start' as const,
    flexDirection: 'column' as const,
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
  noteInput: {
    minHeight: 52,
  },
  preview: {
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 3,
  },
  previewHeading: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  previewHeadingLargeText: {
    alignItems: 'flex-start' as const,
    flexDirection: 'column' as const,
  },
  privateHint: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.xs,
  },
  privateHintLargeText: {
    alignItems: 'flex-start' as const,
    justifyContent: 'flex-start' as const,
  },
  locationSheet: {
    gap: spacing.md,
    paddingBottom: spacing.md,
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
