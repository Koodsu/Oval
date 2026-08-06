import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../../App';
import {
  AppBackdrop,
  Button,
  Card,
  Chip,
  Field,
  ScreenHeader,
  Sticker,
} from '../../components/ui';
import {
  createClub,
  getApiErrorMessage,
  uploadClubAvatar,
  uploadClubCover,
} from '../../api';
import { CLUB_CATEGORIES } from '../../constants/clubCategories';
import { clubCategoryVisual } from '../../constants/clubVisuals';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  radii,
  spacing,
  useTheme,
} from '../../theme';
import { toast } from '../../lib/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateClub'>;
type Step = 1 | 2 | 3;
type DiscoveryPreference = 'CAMPUS' | 'INVITE_ONLY';

const GUIDELINES = [
  'Only create a club you actually run. Impersonating a real organization is not allowed.',
  'Keep names, images, and descriptions appropriate for the campus community.',
  'New clubs are reviewed before they can appear in discovery.',
  'The verified checkmark is separate and confirms control of an official club account.',
];

function StepProgress({ step }: { step: Step }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View style={styles.stepHeader}>
      <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
        Step {step} of 3
      </Text>
      <View style={styles.progressTrack}>
        {[1, 2, 3].map((segment) => (
          <View
            key={segment}
            style={[
              styles.progressSegment,
              { backgroundColor: segment <= step ? colors.primary : colors.sunken },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export default function CreateClubScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [emoji, setEmoji] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [discoveryPreference, setDiscoveryPreference] =
    useState<DiscoveryPreference>('CAMPUS');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (key: string) => setErrors((previous) => ({ ...previous, [key]: '' }));

  const validateIdentity = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Enter a club name.';
    if (!description.trim()) next.description = 'Add a short description.';
    if (!category) next.category = 'Pick a category.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const chooseImage = async (kind: 'avatar' | 'cover') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Photo access is off', 'Allow photo access to choose a club image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: kind === 'cover' ? [16, 9] : [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    if (kind === 'cover') setCoverUri(result.assets[0].uri);
    else setAvatarUri(result.assets[0].uri);
  };

  const continueFromIdentity = () => {
    if (validateIdentity()) setStep(2);
  };

  const submit = async () => {
    if (!validateIdentity()) {
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      const club = await createClub({
        name: name.trim(),
        description: description.trim(),
        category,
        emoji: emoji.trim(),
        discoveryPreference,
      });

      const uploads: Promise<unknown>[] = [];
      if (avatarUri) uploads.push(uploadClubAvatar(club.id, avatarUri));
      if (coverUri) uploads.push(uploadClubCover(club.id, coverUri));
      if (uploads.length) {
        const outcomes = await Promise.allSettled(uploads);
        if (outcomes.some((outcome) => outcome.status === 'rejected')) {
          toast.error(
            'Club created, but an image did not upload',
            'You can add it again from club management.',
          );
        }
      }

      navigation.replace('ClubDetail', { clubId: club.id, justCreated: true });
    } catch (error) {
      setBusy(false);
      toast.error('Could not create club', getApiErrorMessage(error));
    }
  };

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Create a club"
          onBack={() => (step === 1 ? navigation.goBack() : setStep((step - 1) as Step))}
        />
        <StepProgress step={step} />

        {step === 1 ? (
          <>
            <View style={styles.intro}>
              <Text style={typography.title} maxFontSizeMultiplier={2}>
                Add your club identity
              </Text>
              <Text style={typography.caption} maxFontSizeMultiplier={2}>
                Help students recognize and connect with your club.
              </Text>
            </View>

            <View style={[styles.imageRow, accessibilityLayout && styles.imageRowLargeText]}>
              <Pressable
                onPress={() => void chooseImage('avatar')}
                accessibilityRole="button"
                accessibilityLabel="Edit club mark"
                style={({ pressed }) => [
                  styles.avatarPicker,
                  accessibilityLayout && styles.imagePickerLargeText,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} accessible={false} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={styles.avatarEmoji} maxFontSizeMultiplier={1}>
                      {emoji.trim() || '🎓'}
                    </Text>
                  </View>
                )}
                <Text style={typography.bodyMedium} maxFontSizeMultiplier={2}>
                  Edit mark
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void chooseImage('cover')}
                accessibilityRole="button"
                accessibilityLabel="Edit club cover"
                style={({ pressed }) => [
                  styles.coverPicker,
                  accessibilityLayout && styles.imagePickerLargeText,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceAlt,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                {coverUri ? (
                  <Image source={{ uri: coverUri }} accessible={false} style={styles.coverImage} />
                ) : null}
                {!coverUri ? (
                  <Ionicons name="image-outline" size={30} color={colors.sub} />
                ) : null}
                <View style={styles.coverLabel}>
                  <Ionicons name="camera-outline" size={15} color={colors.onPrimary} />
                  <Text
                    style={[typography.bodyMedium, { color: colors.onPrimary }]}
                    maxFontSizeMultiplier={2}
                  >
                    Edit cover
                  </Text>
                </View>
              </Pressable>
            </View>

            <Field
              label="Club name"
              value={name}
              onChangeText={(value) => {
                setName(value);
                clearError('name');
              }}
              error={errors.name}
              placeholder="Outdoor Adventure Club"
              maxLength={40}
            />

            <View style={{ gap: spacing.sm }}>
              <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
                Category
              </Text>
              <View style={styles.chipWrap}>
                {CLUB_CATEGORIES.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    icon={clubCategoryVisual(item).icon}
                    selected={category === item}
                    onPress={() => {
                      setCategory(item);
                      clearError('category');
                    }}
                  />
                ))}
              </View>
              {errors.category ? (
                <Text
                  style={[typography.captionSmall, { color: colors.danger }]}
                  maxFontSizeMultiplier={2}
                >
                  {errors.category}
                </Text>
              ) : null}
            </View>

            <Field
              label="Short description"
              value={description}
              onChangeText={(value) => {
                setDescription(value);
                clearError('description');
              }}
              error={errors.description}
              placeholder="From local trails to big trips—explore, learn, and make memories together."
              maxLength={160}
              multiline
            />

            <Field
              label="Mark emoji (optional)"
              value={emoji}
              onChangeText={setEmoji}
              placeholder="🎓"
              maxLength={8}
              hint="Used when you do not upload a club mark."
            />

            <View style={{ gap: spacing.sm }}>
              <Text style={typography.subheading} maxFontSizeMultiplier={2}>
                Who can discover this club?
              </Text>
              {([
                {
                  value: 'CAMPUS' as const,
                  title: 'Anyone at my campus',
                  body: 'Eligible after Oval review and the club reaches the discovery threshold.',
                  icon: 'earth-outline' as const,
                },
                {
                  value: 'INVITE_ONLY' as const,
                  title: 'Invite only',
                  body: 'Keep the club out of search and grow through direct invites.',
                  icon: 'lock-closed-outline' as const,
                },
              ]).map((option) => {
                const active = discoveryPreference === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setDiscoveryPreference(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={option.title}
                    style={[
                      styles.discoveryRow,
                      accessibilityLayout && styles.discoveryRowLargeText,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primarySoft : colors.surface,
                      },
                    ]}
                  >
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={active ? colors.primary : colors.faint}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={typography.bodyMedium} maxFontSizeMultiplier={2}>
                        {option.title}
                      </Text>
                      <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
                        {option.body}
                      </Text>
                    </View>
                    {!accessibilityLayout ? (
                      <Ionicons name={option.icon} size={20} color={colors.sub} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Button label="Continue" onPress={continueFromIdentity} size="lg" />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <View style={styles.intro}>
              <Text style={typography.title} maxFontSizeMultiplier={2}>
                Keep it authentic
              </Text>
              <Text style={typography.caption} maxFontSizeMultiplier={2}>
                Oval reviews new clubs to protect students and real campus organizations.
              </Text>
            </View>
            <Card padded faceStyle={styles.guidelineCard}>
              {GUIDELINES.map((guideline, index) => (
                <View key={guideline} style={styles.guidelineRow}>
                  <View style={[styles.ruleNumber, { backgroundColor: colors.primarySoft }]}>
                    <Text
                      style={[typography.captionSmall, { color: colors.primary }]}
                      maxFontSizeMultiplier={2}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={[typography.body, { flex: 1 }]} maxFontSizeMultiplier={2}>
                    {guideline}
                  </Text>
                </View>
              ))}
            </Card>
            <View
              style={[
                styles.reviewNotice,
                accessibilityLayout && styles.reviewNoticeLargeText,
                { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={24} color={colors.sub} />
              <Text style={[typography.caption, { flex: 1 }]} maxFontSizeMultiplier={2}>
                You will usually hear back within 24–48 hours. Your club remains available to you
                while it is reviewed.
              </Text>
            </View>
            <Button label="I agree — review club" onPress={() => setStep(3)} size="lg" />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <View style={styles.intro}>
              <Text style={typography.title} maxFontSizeMultiplier={2}>
                Review your club
              </Text>
              <Text style={typography.caption} maxFontSizeMultiplier={2}>
                Make sure this is how students should see it.
              </Text>
            </View>
            <Card padded>
              <View style={[styles.reviewHero, accessibilityLayout && styles.reviewHeroLargeText]}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    accessibilityLabel={`${name.trim()} club mark`}
                    style={styles.reviewAvatar}
                  />
                ) : (
                  <View style={[styles.reviewAvatar, styles.reviewAvatarFallback, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={styles.avatarEmoji} maxFontSizeMultiplier={1}>
                      {emoji.trim() || '🎓'}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={typography.title} maxFontSizeMultiplier={2}>
                    {name.trim()}
                  </Text>
                  <View style={styles.reviewMeta}>
                    <Sticker label={category} tint={colors.greenSoft} small />
                    <Sticker
                      label={discoveryPreference === 'CAMPUS' ? 'Campus' : 'Invite only'}
                      tint={colors.blueSoft}
                      small
                    />
                  </View>
                </View>
              </View>
              <Text
                style={[typography.body, { marginTop: spacing.md }]}
                maxFontSizeMultiplier={2}
              >
                {description.trim()}
              </Text>
            </Card>
            <Button
              label="Create club"
              icon="checkmark"
              onPress={() => void submit()}
              loading={busy}
              size="lg"
            />
          </>
        ) : null}
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((_t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  stepHeader: {
    gap: spacing.sm,
    alignItems: 'flex-end' as const,
  },
  progressTrack: {
    width: '100%',
    flexDirection: 'row' as const,
    gap: spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
  },
  intro: {
    gap: spacing.xs,
  },
  imageRow: {
    flexDirection: 'row' as const,
    gap: spacing.md,
  },
  imageRowLargeText: {
    flexDirection: 'column' as const,
  },
  imagePickerLargeText: {
    minHeight: 188,
    width: '100%' as const,
  },
  avatarPicker: {
    width: 148,
    minHeight: 166,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
    overflow: 'hidden' as const,
  },
  avatarPlaceholder: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  avatarEmoji: {
    fontSize: 38,
  },
  coverPicker: {
    flex: 1,
    minHeight: 166,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  coverImage: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  coverLabel: {
    position: 'absolute' as const,
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    minHeight: 34,
    borderRadius: radii.sm,
    backgroundColor: _t.colors.overlay,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.xs,
  },
  chipWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  discoveryRow: {
    minHeight: 72,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  discoveryRowLargeText: {
    alignItems: 'flex-start' as const,
  },
  guidelineCard: {
    gap: spacing.lg,
  },
  guidelineRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
  },
  ruleNumber: {
    // Intrinsic size so the numeral scales to 200% without clipping.
    minWidth: 26,
    minHeight: 26,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  reviewNotice: {
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  reviewNoticeLargeText: {
    alignItems: 'flex-start' as const,
  },
  reviewHero: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  reviewHeroLargeText: {
    alignItems: 'flex-start' as const,
    flexDirection: 'column' as const,
  },
  reviewAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  reviewAvatarFallback: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  reviewMeta: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
}));
