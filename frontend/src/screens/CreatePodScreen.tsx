import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import { RootStackParamList } from '../../App';
import { createPod } from '../api';
import GradientButton from '../components/GradientButton';
import { colors, spacing, radii, typography } from '../theme';
import {
  OSU_CAMPUS_CENTER,
  OSU_CAMPUS_DELTA,
  OSU_CAMPUS_POLYGON,
  SCARLET,
} from '../constants/campusMap';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatePod'>;

function getDefaultMeetupTime(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  return d;
}

function getMaxMeetupTime(): Date {
  const max = new Date();
  max.setDate(max.getDate() + 7);
  max.setHours(23, 59, 0, 0);
  return max;
}

// Ray-casting point-in-polygon check (mirrors backend)
function isInsideCampus(coord: { latitude: number; longitude: number }): boolean {
  let inside = false;
  const n = OSU_CAMPUS_POLYGON.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = OSU_CAMPUS_POLYGON[i].longitude;
    const yi = OSU_CAMPUS_POLYGON[i].latitude;
    const xj = OSU_CAMPUS_POLYGON[j].longitude;
    const yj = OSU_CAMPUS_POLYGON[j].latitude;
    const intersect =
      yi > coord.latitude !== yj > coord.latitude &&
      coord.longitude < ((xj - xi) * (coord.latitude - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const GROUP_SIZE_PRESETS = [
  { min: 2, max: 3, label: '2–3' },
  { min: 2, max: 4, label: '2–4' },
  { min: 3, max: 4, label: '3–4' },
  { min: 3, max: 6, label: '3–6' },
  { min: 4, max: 6, label: '4–6' },
  { min: 4, max: 8, label: '4–8' },
  { min: 5, max: 10, label: '5–10' },
  { min: 6, max: 10, label: '6–10' },
] as const;

export default function CreatePodScreen({ route, navigation }: Props) {
  const { activityId, activityTitle } = route.params;

  const [groupSizePreset, setGroupSizePreset] = useState<(typeof GROUP_SIZE_PRESETS)[number]>(
    GROUP_SIZE_PRESETS[1] // default 2–4
  );
  const minMembers = groupSizePreset.min;
  const maxMembers = groupSizePreset.max;
  const [meetupTime, setMeetupTime] = useState(getDefaultMeetupTime);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [pickedCoords, setPickedCoords] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [locationText, setLocationText] = useState('');
  const [mapLocationError, setMapLocationError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const handleMapPress = async (coord: { latitude: number; longitude: number }) => {
    if (!isInsideCampus(coord)) {
      setMapLocationError('Please select a location on OSU campus');
      return;
    }
    setMapLocationError('');
    setPickedCoords(coord);
    try {
      const results = await Location.reverseGeocodeAsync(coord);
      if (results[0]) {
        const r = results[0];
        const label = r.name || r.street || r.district || 'OSU Campus';
        setLocationText(label);
      }
    } catch {
      // user can type manually
    }
  };

  const handleSubmit = async () => {
    setFormError('');

    const selectedLocation = locationText.trim();
    if (!selectedLocation) {
      setMapLocationError('Please tap the map to select a location');
      return;
    }
    setMapLocationError('');

    const maxTime = getMaxMeetupTime();
    if (meetupTime > maxTime) {
      setFormError('Please select a date within the next week.');
      return;
    }

    const min = Math.max(2, Math.min(10, minMembers));
    const max = Math.max(min, Math.min(10, maxMembers));

    setSubmitting(true);
    try {
      const pod = await createPod(activityId, {
        minMembers: min,
        maxMembers: max,
        meetupTime: meetupTime.toISOString(),
        location: selectedLocation,
        latitude: pickedCoords?.latitude,
        longitude: pickedCoords?.longitude,
      });
      navigation.replace('Pod', { podId: pod.id });
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (d: Date) =>
    d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.sectionLabel}>Activity</Text>
      <Text style={styles.activityTitle}>{activityTitle}</Text>

      <Text style={styles.sectionLabel}>Group size</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sizePresetRow}
      >
        {GROUP_SIZE_PRESETS.map((preset) => {
          const isActive =
            groupSizePreset.min === preset.min && groupSizePreset.max === preset.max;
          return (
            <TouchableOpacity
              key={preset.label}
              style={[styles.sizePresetChip, isActive && styles.sizePresetChipActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setGroupSizePreset(preset);
              }}
            >
              <Text
                style={[styles.sizePresetText, isActive && styles.sizePresetTextActive]}
              >
                {preset.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionLabel}>Meetup time</Text>
      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => setShowDatePicker(true)}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.dateText}>{formatDateTime(meetupTime)}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={meetupTime}
          mode="datetime"
          minimumDate={new Date()}
          maximumDate={getMaxMeetupTime()}
          onChange={(_, d) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (d) setMeetupTime(d);
          }}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        />
      )}

      <Text style={styles.sectionLabel}>Location</Text>
      <Text style={styles.mapHint}>Tap the map to drop a pin on campus</Text>
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={{ ...OSU_CAMPUS_CENTER, ...OSU_CAMPUS_DELTA }}
          onPress={(e) => handleMapPress(e.nativeEvent.coordinate)}
        >
          <Polygon
            coordinates={OSU_CAMPUS_POLYGON}
            strokeColor={SCARLET}
            strokeWidth={2}
            fillColor="rgba(204,0,0,0.06)"
          />
          {pickedCoords && (
            <Marker coordinate={pickedCoords} pinColor={SCARLET} />
          )}
        </MapView>
      </View>
      {mapLocationError ? (
        <Text style={styles.mapError}>{mapLocationError}</Text>
      ) : null}
      <TextInput
        style={styles.locationInput}
        value={locationText}
        onChangeText={setLocationText}
        placeholder="e.g. RPAC Court B, Thompson Library Floor 2"
        placeholderTextColor={colors.textTertiary}
      />

      <View style={styles.submitRow}>
        {formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}
        <GradientButton
          title="Create Pod"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
          icon="checkmark-circle-outline"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm },
  activityTitle: { ...typography.h3, marginBottom: spacing.lg },
  sizePresetRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  sizePresetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sizePresetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sizePresetText: { ...typography.bodyBold, fontSize: 14, color: colors.textSecondary },
  sizePresetTextActive: { color: colors.textInverse },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  dateText: { ...typography.body, flex: 1 },
  mapHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  mapContainer: {
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  map: { flex: 1 },
  mapError: {
    fontSize: 12,
    color: SCARLET,
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  locationInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  submitRow: { marginTop: spacing.xl },
  formErrorText: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
