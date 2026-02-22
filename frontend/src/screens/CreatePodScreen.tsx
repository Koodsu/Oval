import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RootStackParamList } from '../../App';
import { createPod, getActivityLocations } from '../api';
import GradientButton from '../components/GradientButton';
import { colors, spacing, radii, typography } from '../theme';

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
  const { activityId, activityTitle, activityCategory } = route.params;

  const [groupSizePreset, setGroupSizePreset] = useState<(typeof GROUP_SIZE_PRESETS)[number]>(
    GROUP_SIZE_PRESETS[1] // default 2–4
  );
  const minMembers = groupSizePreset.min;
  const maxMembers = groupSizePreset.max;
  const [meetupTime, setMeetupTime] = useState(getDefaultMeetupTime);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [locationType, setLocationType] = useState<'public' | 'private'>('public');
  const [publicLocation, setPublicLocation] = useState('');
  const [privateAddress, setPrivateAddress] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getActivityLocations(activityId)
      .then(setLocations)
      .catch(() => setLocations([]))
      .finally(() => setLoadingLocations(false));
  }, [activityId]);

  useEffect(() => {
    if (locations.length > 0 && !publicLocation) {
      setPublicLocation(locations[0]);
    }
  }, [locations]);

  const handleSubmit = async () => {
    const min = Math.max(2, Math.min(10, minMembers));
    const max = Math.max(min, Math.min(10, maxMembers));
    if (max < min) {
      Alert.alert('Error', 'Max members must be at least min members');
      return;
    }

    let location: string;
    if (locationType === 'public') {
      location = publicLocation || locations[0] || '';
      if (!location && locations.length > 0) {
        Alert.alert('Error', 'Please select a location');
        return;
      }
    } else {
      location = privateAddress.trim();
      if (!location) {
        Alert.alert('Error', 'Please enter an address');
        return;
      }
    }

    const maxTime = getMaxMeetupTime();
    if (meetupTime > maxTime) {
      Alert.alert('Error', 'Meetup time cannot be more than 1 week from now');
      return;
    }

    setSubmitting(true);
    try {
      const pod = await createPod(activityId, {
        minMembers: min,
        maxMembers: max,
        meetupTime: meetupTime.toISOString(),
        locationType,
        location,
      });
      navigation.replace('Pod', { podId: pod.id });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create pod');
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
      <View style={styles.locationTypeRow}>
        <TouchableOpacity
          style={[styles.locationTypeBtn, locationType === 'public' && styles.locationTypeActive]}
          onPress={() => setLocationType('public')}
        >
          <Ionicons
            name="business-outline"
            size={18}
            color={locationType === 'public' ? colors.textInverse : colors.textSecondary}
          />
          <Text style={[styles.locationTypeText, locationType === 'public' && styles.locationTypeTextActive]}>
            Public
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.locationTypeBtn, locationType === 'private' && styles.locationTypeActive]}
          onPress={() => setLocationType('private')}
        >
          <Ionicons
            name="location-outline"
            size={18}
            color={locationType === 'private' ? colors.textInverse : colors.textSecondary}
          />
          <Text style={[styles.locationTypeText, locationType === 'private' && styles.locationTypeTextActive]}>
            Private
          </Text>
        </TouchableOpacity>
      </View>

      {locationType === 'public' ? (
        loadingLocations ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        ) : locations.length === 0 ? (
          <Text style={styles.hint}>No public locations for this activity.</Text>
        ) : (
          <View style={styles.pickerWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {locations.map((loc) => (
                <TouchableOpacity
                  key={loc}
                  style={[styles.locationChip, publicLocation === loc && styles.locationChipActive]}
                  onPress={() => setPublicLocation(loc)}
                >
                  <Text
                    style={[styles.locationChipText, publicLocation === loc && styles.locationChipTextActive]}
                    numberOfLines={1}
                  >
                    {loc}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )
      ) : (
        <TextInput
          style={[styles.input, styles.addressInput]}
          value={privateAddress}
          onChangeText={setPrivateAddress}
          placeholder="Enter address"
          placeholderTextColor={colors.textTertiary}
        />
      )}

      <View style={styles.submitRow}>
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
  fieldLabel: { ...typography.caption },
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
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
  },
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
  locationTypeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  locationTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  locationTypeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  locationTypeText: { ...typography.bodyBold, color: colors.textSecondary },
  locationTypeTextActive: { color: colors.textInverse },
  pickerWrapper: { marginBottom: spacing.lg },
  locationChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  locationChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  locationChipText: { ...typography.body, fontSize: 14, color: colors.text },
  locationChipTextActive: { color: colors.textInverse },
  addressInput: { marginBottom: spacing.lg },
  hint: { ...typography.caption, marginBottom: spacing.lg },
  loader: { marginBottom: spacing.lg },
  submitRow: { marginTop: spacing.xl },
});
