import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../../App';
import {
  getMyPods,
  uploadAvatar,
  deleteAvatar,
  resolveAvatarUrl,
} from '../api';
import { Pod } from '../types';
import Avatar from '../components/Avatar';
import TagPills from '../components/TagPills';
import { colors, spacing, radii, typography, shadows } from '../theme';

const DEFAULT_PREFS: NotificationPreferences = {
  podJoin: true,
  newMessage: true,
  meetupReminder: true,
};

export default function ProfileScreen() {
  const { user, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [pods, setPods] = useState<Pod[]>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getMyPods();
      setPods(data);
    } catch {
      // Stats are non-critical, fail silently
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const pickAndUploadImage = async (source: 'camera' | 'library') => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Allow camera access in Settings to take a photo.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.9,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Allow photo library access in Settings.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.9,
        });
      }

      if (result.canceled || !result.assets?.[0]) return;

      setAvatarUploading(true);

      // Resize + compress to keep upload small (~400×400, JPEG 0.85)
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      const { avatarUrl } = await uploadAvatar(manipulated.uri);
      await updateUser({ avatarUrl });
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setAvatarUploading(true);
      await deleteAvatar();
      await updateUser({ avatarUrl: null });
    } catch {
      Alert.alert('Error', 'Failed to remove photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarPress = () => {
    const hasPhoto = !!user?.avatarUrl;

    if (Platform.OS === 'ios') {
      const options = [
        'Take Photo',
        'Choose from Library',
        ...(hasPhoto ? ['Remove Photo'] : []),
        'Cancel',
      ];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: hasPhoto ? options.length - 2 : undefined,
          title: 'Profile Photo',
        },
        (index) => {
          if (index === 0) pickAndUploadImage('camera');
          else if (index === 1) pickAndUploadImage('library');
          else if (hasPhoto && index === 2) {
            Alert.alert('Remove Photo', 'Are you sure you want to remove your profile photo?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: handleRemoveAvatar },
            ]);
          }
        }
      );
    } else {
      const buttons: { text: string; onPress?: () => void; style?: 'destructive' | 'cancel' }[] = [
        { text: 'Take Photo', onPress: () => pickAndUploadImage('camera') },
        { text: 'Choose from Library', onPress: () => pickAndUploadImage('library') },
      ];
      if (hasPhoto) {
        buttons.push({
          text: 'Remove Photo',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Remove Photo', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: handleRemoveAvatar },
            ]),
        });
      }
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Profile Photo', '', buttons);
    }
  };

  const activePods = pods.filter((p) => p.status === 'FORMING' || p.status === 'LOCKED');
  const completedPods = pods.filter((p) => p.status === 'COMPLETED');

  const avatarUri = resolveAvatarUrl(user?.avatarUrl);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.heading}>Profile</Text>
      </View>

      <View style={[styles.profileCard, shadows.md]}>
        {/* Tappable avatar with camera badge */}
        <TouchableOpacity
          onPress={handleAvatarPress}
          activeOpacity={0.8}
          disabled={avatarUploading}
          style={styles.avatarContainer}
        >
          {avatarUploading ? (
            <View style={[styles.avatarLoader, { width: 88, height: 88, borderRadius: 44 }]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <Avatar name={user?.name ?? 'U'} size={88} uri={avatarUri} />
          )}
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>

        <Text style={styles.name}>{user?.name}</Text>
        <View style={styles.emailRow}>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.verifiedUniversity && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={13} color={colors.green} />
              <Text style={styles.verifiedText}>OSU Verified</Text>
            </View>
          )}
        </View>

        {/* Class year + major */}
        {(user?.classYear || user?.major) && (
          <Text style={styles.classYearMajor}>
            {[user.classYear, user.major].filter(Boolean).join(' · ')}
          </Text>
        )}

        {/* Bio */}
        {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

        {/* Clubs */}
        {user?.clubs && user.clubs.length > 0 && (
          <View style={styles.clubsRow}>
            {user.clubs.map((club, i) => (
              <View key={i} style={styles.clubChip}>
                <Text style={styles.clubChipText}>{club}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Interest Tags */}
        {user?.interestTags && user.interestTags.length > 0 && (
          <TagPills tags={user.interestTags} style={styles.interestTagsRow} />
        )}

        {/* Instagram */}
        {user?.instagramHandle && (
          <TouchableOpacity
            onPress={() => Linking.openURL(`https://instagram.com/${user.instagramHandle}`)}
            style={styles.instagramRow}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-instagram" size={14} color={colors.primary} />
            <Text style={styles.instagramText}>@{user.instagramHandle}</Text>
          </TouchableOpacity>
        )}

        {user?.joinedAt && (
          <Text style={styles.joinedAt}>
            Joined {new Date(user.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
        )}
        <Text style={styles.editPhotoHint}>Tap photo to edit</Text>
      </View>

      <TouchableOpacity
        style={[styles.editProfileButton, shadows.sm]}
        onPress={() => navigation.navigate('EditProfile')}
        activeOpacity={0.8}
      >
        <Ionicons name="create-outline" size={18} color={colors.primary} />
        <Text style={styles.editProfileText}>Edit Profile</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Stats</Text>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, shadows.sm]}>
          <View style={[styles.statIcon, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="people" size={20} color={colors.primary} />
          </View>
          <Text style={styles.statNumber}>{activePods.length}</Text>
          <Text style={styles.statLabel}>Active Pods</Text>
        </View>
        <View style={[styles.statCard, shadows.sm]}>
          <View style={[styles.statIcon, { backgroundColor: colors.green + '15' }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.green} />
          </View>
          <Text style={styles.statNumber}>{completedPods.length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={[styles.statCard, shadows.sm]}>
          <View style={[styles.statIcon, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="star" size={20} color={colors.primary} />
          </View>
          <Text style={styles.statNumber}>{pods.length}</Text>
          <Text style={styles.statLabel}>Total Pods</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Friends</Text>
      <View style={[styles.linksCard, shadows.sm]}>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('Friends')}
        >
          <Ionicons name="people-outline" size={20} color={colors.primary} />
          <Text style={styles.linkText}>My Friends</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={styles.linkDivider} />
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('FriendRequests')}
        >
          <Ionicons name="person-add-outline" size={20} color={colors.primary} />
          <Text style={styles.linkText}>Friend Requests</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={styles.linkDivider} />
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('PodInvites')}
        >
          <Ionicons name="mail-outline" size={20} color={colors.primary} />
          <Text style={styles.linkText}>Pod Invites</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={styles.linkDivider} />
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('UserSearch')}
        >
          <Ionicons name="search-outline" size={20} color={colors.primary} />
          <Text style={styles.linkText}>Find People</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.settingsButton, shadows.sm]}
        onPress={() => navigation.navigate('Settings')}
        activeOpacity={0.8}
      >
        <Ionicons name="settings-outline" size={20} color={colors.primary} />
        <Text style={styles.settingsText}>Settings</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    </ScrollView>
  );
}

interface NotifRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  description: string;
  value: boolean;
  saving: boolean;
  onToggle: (value: boolean) => void;
}

function NotifRow({ icon, label, description, value, saving, onToggle }: NotifRowProps) {
  return (
    <View style={styles.prefRow}>
      <View style={[styles.prefIconWrap, { backgroundColor: colors.primary + '15' }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.prefText}>
        <Text style={styles.prefLabel}>{label}</Text>
        <Text style={styles.prefDescription}>{description}</Text>
      </View>
      {saving ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary + '80' }}
          thumbColor={value ? colors.primary : colors.surface}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  heading: {
    ...typography.h2,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.xs,
  },
  avatarLoader: {
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  name: {
    ...typography.h2,
    marginTop: spacing.sm,
  },
  emailRow: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  email: {
    ...typography.caption,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.greenLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  verifiedText: {
    ...typography.tiny,
    color: colors.green,
    fontWeight: '600',
  },
  joinedAt: {
    ...typography.tiny,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  editPhotoHint: {
    ...typography.tiny,
    color: colors.textTertiary,
    marginTop: 2,
  },
  classYearMajor: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  bio: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginHorizontal: spacing.sm,
  },
  clubsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: 2,
  },
  interestTagsRow: {
    justifyContent: 'center',
    marginTop: 2,
  },
  clubChip: {
    backgroundColor: colors.primary + '12',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.primary + '25',
  },
  clubChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  instagramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  instagramText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
  },
  editProfileText: {
    ...typography.bodyBold,
    flex: 1,
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.label,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm + 4,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm + 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    ...typography.h2,
    fontSize: 24,
  },
  statLabel: {
    ...typography.tiny,
    textAlign: 'center',
  },
  linksCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  linkText: {
    ...typography.bodyBold,
    flex: 1,
    color: colors.text,
  },
  linkDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.md,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
  },
  settingsText: {
    ...typography.bodyBold,
    flex: 1,
    color: colors.text,
  },
});
