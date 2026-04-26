import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { deleteAvatar, updateProfile, uploadAvatar } from '../api';
import { useAuth } from '../context/AuthContext';
import { Chip, Hero, Panel, PrimaryButton, Screen, ScreenHeader, UserAvatar } from '../components/ui';
import { INTEREST_TAGS } from '../constants/interestTags';
import { palette, radii, spacing, typography } from '../theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { CLASS_YEAR_OPTIONS } from '../constants/classYears';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: Props) {
  const { user, updateUser } = useAuth();
  const [classYear, setClassYear] = useState(user?.classYear ?? '');
  const [major, setMajor] = useState(user?.major ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [instagramHandle, setInstagramHandle] = useState(user?.instagramHandle ?? '');
  const [interestTags, setInterestTags] = useState<string[]>(user?.interestTags ?? []);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const toggleTag = (tag: string) => {
    setInterestTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  };

  const save = async () => {
    setBusy(true);
    try {
      const updated = await updateProfile({
        classYear,
        major,
        bio,
        instagramHandle,
        interestTags,
      });
      await updateUser(updated);
      Alert.alert('Saved', 'Your profile now matches the new experience.');
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const pickAvatar = async () => {
    setAvatarBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Photos permission needed', 'Allow photo access so you can upload a profile picture.');
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
      Alert.alert('Profile photo updated', 'Your avatar is now live.');
    } catch (error) {
      Alert.alert('Could not update photo', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeCurrentAvatar = async () => {
    setAvatarBusy(true);
    try {
      await deleteAvatar();
      await updateUser({ avatarUrl: null });
      Alert.alert('Profile photo removed', 'Your avatar has been removed.');
    } catch (error) {
      Alert.alert('Could not remove photo', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Edit profile" onBack={() => navigation.goBack()} />
        <Hero eyebrow="Edit profile" title="Make your identity legible at a glance." subtitle="The goal is better social signal, not more form fields." />
        <Panel>
          <View style={styles.avatarSection}>
            <UserAvatar name={user?.name ?? 'User'} avatarUrl={user?.avatarUrl} size={84} />
            <View style={styles.avatarActions}>
              <PrimaryButton label="Change photo" onPress={() => void pickAvatar()} loading={avatarBusy} />
              {user?.avatarUrl ? (
                <PrimaryButton label="Remove photo" onPress={() => void removeCurrentAvatar()} kind="ghost" disabled={avatarBusy} />
              ) : null}
            </View>
          </View>
          <Text style={styles.label}>Class year</Text>
          <View style={styles.tagWrap}>
            {CLASS_YEAR_OPTIONS.map((option) => (
              <Chip key={option} label={option} active={classYear === option} onPress={() => setClassYear(option)} />
            ))}
          </View>
          <Field label="Major" value={major} onChangeText={setMajor} placeholder="Computer Science" />
          <Field label="Instagram" value={instagramHandle} onChangeText={setInstagramHandle} placeholder="@bridgeperson" />
          <Field label="Bio" value={bio} onChangeText={setBio} placeholder="What should people know before they join your pod?" multiline />
          <Text style={styles.label}>Interests</Text>
          <View style={styles.tagWrap}>
            {INTEREST_TAGS.map((tag) => (
              <Chip key={tag} label={tag} active={interestTags.includes(tag)} onPress={() => toggleTag(tag)} />
            ))}
          </View>
          <View style={styles.save}>
            <PrimaryButton label="Save profile" onPress={save} loading={busy} />
          </View>
        </Panel>
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={palette.slate}
        style={[styles.input, props.multiline && styles.inputMultiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatarActions: {
    width: '100%',
    gap: spacing.sm,
  },
  field: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
  },
  input: {
    borderRadius: radii.md,
    backgroundColor: palette.cream,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...typography.body,
    color: palette.ink,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
  },
  save: {
    marginTop: spacing.md,
  },
});
