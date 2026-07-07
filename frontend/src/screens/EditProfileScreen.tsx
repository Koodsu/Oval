import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteAvatar, updateProfile, uploadAvatar } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  AppBackdrop,
  Avatar,
  Button,
  Card,
  Chip,
  Field,
  ScreenHeader,
  accentForSeed,
} from '../components/ui';
import { INTEREST_TAGS } from '../constants/interestTags';
import {
  CAMPUS_ZONE_OPTIONS,
  MAX_CAMPUS_ZONES,
  PURPOSE_OPTIONS,
} from '../constants/profileOptions';
import { Theme, createThemedStyles, spacing, useTheme } from '../theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { CLASS_YEAR_OPTIONS } from '../constants/classYears';

import { toast } from '../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [classYear, setClassYear] = useState(user?.classYear ?? '');
  const [major, setMajor] = useState(user?.major ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [instagramHandle, setInstagramHandle] = useState(user?.instagramHandle ?? '');
  const [interestTags, setInterestTags] = useState<string[]>(user?.interestTags ?? []);
  const [purpose, setPurpose] = useState(user?.purpose ?? '');
  const [campusZones, setCampusZones] = useState<string[]>(user?.campusZones ?? []);
  const [clubInterests, setClubInterests] = useState(user?.clubInterests ?? '');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const toggleZone = (zone: string) => {
    setCampusZones((current) => {
      if (current.includes(zone)) return current.filter((item) => item !== zone);
      if (current.length >= MAX_CAMPUS_ZONES) {
        toast.error('Zone limit', `You can pick up to ${MAX_CAMPUS_ZONES} campus zones.`);
        return current;
      }
      return [...current, zone];
    });
  };

  const toggleTag = (tag: string) => {
    setInterestTags((current) => {
      if (current.includes(tag)) return current.filter((item) => item !== tag);
      if (current.length >= 5) {
        toast.error('Interest limit', 'You can select up to 5 interest tags.');
        return current;
      }
      return [...current, tag];
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      const updated = await updateProfile({
        classYear,
        major,
        bio,
        instagramHandle: instagramHandle.trim().replace(/^@+/, ''),
        interestTags,
        purpose: purpose || null,
        campusZones,
        clubInterests: clubInterests.trim() || null,
      });
      await updateUser(updated);
      toast.success('Saved', 'Your profile now matches the new experience.');
    } catch (error) {
      toast.error('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const pickAvatar = async () => {
    setAvatarBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        toast.info(
          'Photos permission needed',
          'Allow photo access so you can upload a profile picture.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      const response = await uploadAvatar(result.assets[0].uri);
      await updateUser({ avatarUrl: response.avatarUrl });
      toast.success('Profile photo updated', 'Your avatar is now live.');
    } catch (error) {
      toast.error(
        'Could not update photo',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeCurrentAvatar = async () => {
    setAvatarBusy(true);
    try {
      await deleteAvatar();
      await updateUser({ avatarUrl: null });
      toast.success('Profile photo removed', 'Your avatar has been removed.');
    } catch (error) {
      toast.error(
        'Could not remove photo',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setAvatarBusy(false);
    }
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
        <ScreenHeader title="Edit profile" kicker="YOUR LOOK" onBack={() => navigation.goBack()} />

        <Card padded>
          <View style={styles.avatarSection}>
            <Avatar name={user?.name ?? 'User'} uri={user?.avatarUrl} size={84} tilt={-3} />
            <View style={styles.avatarActions}>
              <Button label="Change photo" icon="image" onPress={() => void pickAvatar()} loading={avatarBusy} />
              {user?.avatarUrl ? (
                <Button
                  label="Remove photo"
                  variant="secondary"
                  onPress={() => void removeCurrentAvatar()}
                  disabled={avatarBusy}
                />
              ) : null}
            </View>
          </View>

          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.sm }}>
              <Text style={typography.kicker}>Class year</Text>
              <View style={styles.tagWrap}>
                {CLASS_YEAR_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    label={option}
                    selected={classYear === option}
                    onPress={() => setClassYear(option)}
                  />
                ))}
              </View>
            </View>
            <Field label="Major" value={major} onChangeText={setMajor} placeholder="Computer Science" />
            <Field
              label="Instagram"
              value={instagramHandle}
              onChangeText={setInstagramHandle}
              placeholder="@ovalperson"
              autoCapitalize="none"
            />
            <Field
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="What should people know before they join your pod?"
              multiline
            />
            <View style={{ gap: spacing.sm }}>
              <Text style={typography.kicker}>Interests — pick up to 5</Text>
              <View style={styles.tagWrap}>
                {INTEREST_TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    selected={interestTags.includes(tag)}
                    tint={accentForSeed(colors, tag).soft}
                    onPress={() => toggleTag(tag)}
                  />
                ))}
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <Text style={typography.kicker}>What are you here for?</Text>
              <View style={styles.tagWrap}>
                {PURPOSE_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    label={option}
                    selected={purpose === option}
                    onPress={() => setPurpose((current) => (current === option ? '' : option))}
                  />
                ))}
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <Text style={typography.kicker}>Campus zones — pick up to {MAX_CAMPUS_ZONES}</Text>
              <View style={styles.tagWrap}>
                {CAMPUS_ZONE_OPTIONS.map((zone) => (
                  <Chip
                    key={zone}
                    label={zone}
                    selected={campusZones.includes(zone)}
                    onPress={() => toggleZone(zone)}
                  />
                ))}
              </View>
            </View>
            <Field
              label="Club interests (optional)"
              value={clubInterests}
              onChangeText={setClubInterests}
              placeholder="Design, robotics, service…"
            />
            <Button label="Save profile" onPress={save} loading={busy} size="lg" icon="checkmark" />
          </View>
        </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((_t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  avatarSection: {
    alignItems: 'center' as const,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatarActions: {
    alignSelf: 'stretch' as const,
    gap: spacing.sm,
  },
  tagWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
}));
