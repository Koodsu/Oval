import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
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
      toast.success('Profile saved', 'Your changes are live.');
      navigation.goBack();
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
          <ScreenHeader
            title="Edit profile"
            onBack={() => navigation.goBack()}
            right={
              <Pressable
                onPress={() => void save()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Save profile"
                style={({ pressed }) => [styles.headerSave, pressed && { opacity: 0.6 }]}
              >
                <Text style={[typography.subheading, { color: colors.accentText }]}>
                  {busy ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            }
          />

          <View style={styles.avatarSection}>
            <Pressable
              onPress={() => void pickAvatar()}
              disabled={avatarBusy}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              style={({ pressed }) => [styles.avatarButton, pressed && { opacity: 0.75 }]}
            >
              <Avatar name={user?.name ?? 'User'} uri={user?.avatarUrl} size={92} />
              <View
                style={[
                  styles.cameraBadge,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons name="camera" size={17} color={colors.ink} />
              </View>
            </Pressable>
            <Pressable
              onPress={() => void pickAvatar()}
              disabled={avatarBusy}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              accessibilityState={{ disabled: avatarBusy, busy: avatarBusy }}
            >
              <Text style={[typography.subheading, { color: colors.accentText }]}>
                {avatarBusy ? 'Updating…' : 'Change photo'}
              </Text>
            </Pressable>
            {user?.avatarUrl ? (
              <Pressable
                onPress={() => void removeCurrentAvatar()}
                disabled={avatarBusy}
                accessibilityRole="button"
                accessibilityLabel="Remove profile photo"
                accessibilityState={{ disabled: avatarBusy, busy: avatarBusy }}
              >
                <Text style={[typography.captionSmall, { color: colors.sub }]}>Remove photo</Text>
              </Pressable>
            ) : null}
          </View>

          <Card padded>
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.sm }}>
                <Text style={typography.kicker}>CLASS YEAR</Text>
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
              <Field
                label="Major"
                value={major}
                onChangeText={setMajor}
                placeholder="Computer Science"
              />
              <Field
                label="Bio"
                value={bio}
                onChangeText={setBio}
                placeholder="What should people know before they make a plan with you?"
                multiline
                maxLength={120}
                hint={`${bio.length}/120`}
              />
              <Field
                label="Instagram"
                value={instagramHandle}
                onChangeText={setInstagramHandle}
                placeholder="@ovalperson"
                autoCapitalize="none"
              />
            </View>
          </Card>

          <Card padded>
            <View style={{ gap: spacing.sm }}>
              <Text style={typography.kicker}>INTERESTS · PICK UP TO 5</Text>
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
          </Card>

          <Card padded>
            <View style={{ gap: spacing.sm }}>
              <Text style={typography.kicker}>WHAT I’M HERE FOR</Text>
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
          </Card>

          <Card padded>
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.sm }}>
                <Text style={typography.kicker}>
                  CAMPUS AREAS · PICK UP TO {MAX_CAMPUS_ZONES}
                </Text>
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
            </View>
          </Card>

          <Button
            label="Save changes"
            onPress={() => void save()}
            loading={busy}
            size="lg"
          />
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
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  avatarButton: {
    position: 'relative' as const,
  },
  cameraBadge: {
    position: 'absolute' as const,
    right: -3,
    bottom: -3,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerSave: {
    minHeight: 44,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.sm,
  },
  tagWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
}));
