import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { HeaderBackButton } from '@react-navigation/elements';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../App';
import {
  blockUser,
  getUserProfile,
  resolveAvatarUrl,
  getFriendRelationship,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  unfriend,
  getThreadByUser,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { PublicProfile, FriendRelationship } from '../types';
import Avatar from '../components/Avatar';
import ReportModal from '../components/ReportModal';
import TagPills from '../components/TagPills';
import { colors, spacing, radii, typography, shadows } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export default function UserProfileScreen({ route, navigation }: Props) {
  const { userId, name } = route.params;
  const { user } = useAuth();
  const [blocking, setBlocking] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [relationship, setRelationship] = useState<FriendRelationship | null>(null);
  const [friendLoading, setFriendLoading] = useState(false);
  const isOwnProfile = user?.id === userId;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: navigation.canGoBack()
        ? (props) => <HeaderBackButton {...props} onPress={() => navigation.goBack()} />
        : undefined,
    });
  }, [navigation]);

  const loadData = useCallback(() => {
    getUserProfile(userId).then(setProfile).catch(() => {});
    if (!isOwnProfile) {
      getFriendRelationship(userId).then(setRelationship).catch(() => {});
    }
  }, [userId, isOwnProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh relationship on focus (e.g. after navigating back from DM screen)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const handleFriendAction = async () => {
    if (!relationship) return;
    setFriendLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (relationship.status === 'NONE') {
        await sendFriendRequest(userId);
        setRelationship({ status: 'PENDING_SENT' });
      } else if (relationship.status === 'PENDING_SENT' && relationship.requestId) {
        await cancelFriendRequest(relationship.requestId);
        setRelationship({ status: 'NONE' });
      } else if (relationship.status === 'FRIENDS') {
        Alert.alert('Unfriend', `Remove ${name} as a friend?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unfriend',
            style: 'destructive',
            onPress: async () => {
              setFriendLoading(true);
              try {
                await unfriend(userId);
                setRelationship({ status: 'NONE' });
              } catch (err) {
                Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
              } finally {
                setFriendLoading(false);
              }
            },
          },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setFriendLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!relationship?.requestId) return;
    setFriendLoading(true);
    try {
      await acceptFriendRequest(relationship.requestId);
      setRelationship({ status: 'FRIENDS' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept');
    } finally {
      setFriendLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!relationship?.requestId) return;
    setFriendLoading(true);
    try {
      await declineFriendRequest(relationship.requestId);
      setRelationship({ status: 'NONE' });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to decline');
    } finally {
      setFriendLoading(false);
    }
  };

  const handleMessage = async () => {
    try {
      const thread = await getThreadByUser(userId);
      navigation.navigate('DirectMessageThread', {
        threadId: thread.id,
        otherUserId: userId,
        otherUserName: name,
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to open conversation');
    }
  };

  const handleBlock = () => {
    Alert.alert(
      'Block User',
      `Block ${name}? You won't see each other in pods or be able to message. You'll both be removed from any shared pods.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setBlocking(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await blockUser(userId);
              navigation.pop(2);
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to block user');
            } finally {
              setBlocking(false);
            }
          },
        },
      ]
    );
  };

  const renderFriendButton = () => {
    if (isOwnProfile || !relationship) return null;
    if (relationship.status === 'BLOCKED') return null;

    if (relationship.status === 'PENDING_RECEIVED') {
      return (
        <View style={styles.requestRow}>
          <Text style={styles.requestLabel}>{name} sent you a friend request</Text>
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={handleAccept}
              disabled={friendLoading}
            >
              {friendLoading ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={styles.acceptBtnText}>Accept</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.declineBtn]}
              onPress={handleDecline}
              disabled={friendLoading}
            >
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    let icon: React.ReactNode;
    let label: string;
    let btnStyle = styles.friendBtnOutline;
    let textStyle = styles.friendBtnOutlineText;

    if (relationship.status === 'NONE') {
      icon = <Ionicons name="person-add-outline" size={16} color={colors.primary} />;
      label = 'Add Friend';
    } else if (relationship.status === 'PENDING_SENT') {
      icon = <Ionicons name="time-outline" size={16} color={colors.textSecondary} />;
      label = 'Request Sent';
      btnStyle = styles.friendBtnMuted;
      textStyle = styles.friendBtnMutedText;
    } else {
      icon = <Ionicons name="people-outline" size={16} color={colors.green} />;
      label = 'Friends';
      btnStyle = styles.friendBtnGreen;
      textStyle = styles.friendBtnGreenText;
    }

    return (
      <TouchableOpacity
        style={[styles.actionBtn, btnStyle]}
        onPress={handleFriendAction}
        disabled={friendLoading}
        activeOpacity={0.8}
      >
        {friendLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            {icon}
            <Text style={textStyle}>{label}</Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.card, shadows.md]}>
        <Avatar name={name} size={80} uri={resolveAvatarUrl(profile?.avatarUrl)} />
        <Text style={styles.name}>{name}</Text>

        {profile?.verifiedUniversity && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={13} color={colors.green} />
            <Text style={styles.verifiedText}>OSU Verified</Text>
          </View>
        )}

        {/* Class year + major */}
        {(profile?.classYear || profile?.major) && (
          <Text style={styles.classYearMajor}>
            {[profile.classYear, profile.major].filter(Boolean).join(' · ')}
          </Text>
        )}

        {/* Bio */}
        {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        {/* Clubs */}
        {profile?.clubs && profile.clubs.length > 0 && (
          <View style={styles.clubsRow}>
            {profile.clubs.map((club, i) => (
              <View key={i} style={styles.clubChip}>
                <Text style={styles.clubChipText}>{club}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Interest Tags */}
        {profile?.interestTags && profile.interestTags.length > 0 && (
          <TagPills tags={profile.interestTags} style={styles.interestTagsRow} />
        )}

        {/* Instagram */}
        {profile?.instagramHandle && (
          <TouchableOpacity
            onPress={() => Linking.openURL(`https://instagram.com/${profile.instagramHandle}`)}
            style={styles.instagramRow}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-instagram" size={14} color={colors.primary} />
            <Text style={styles.instagramText}>@{profile.instagramHandle}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{profile ? profile.podsAttended : '—'}</Text>
            <Text style={styles.statLabel}>Pods attended</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>
              {profile
                ? profile.reliabilityScore !== null
                  ? `${profile.reliabilityScore}%`
                  : '—'
                : '—'}
            </Text>
            <Text style={styles.statLabel}>Reliability</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>
              {profile !== null ? (profile.friendCount ?? 0) : '—'}
            </Text>
            <Text style={styles.statLabel}>Friends</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>
              {profile
                ? new Date(profile.joinedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </Text>
            <Text style={styles.statLabel}>Joined</Text>
          </View>
        </View>
      </View>

      {!isOwnProfile && (
        <View style={styles.socialRow}>
          {renderFriendButton()}
          {relationship?.status === 'FRIENDS' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.messageBtnStyle]}
              onPress={handleMessage}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {!isOwnProfile && (
        <TouchableOpacity
          style={[styles.actionButton, styles.reportButton, shadows.sm]}
          onPress={() => setReportModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.reportButtonText}>Report User</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.actionButton, styles.blockButton, shadows.sm]}
        onPress={handleBlock}
        disabled={blocking}
        activeOpacity={0.8}
      >
        {blocking ? (
          <ActivityIndicator size="small" color={colors.red} />
        ) : (
          <>
            <Ionicons name="ban-outline" size={20} color={colors.red} />
            <Text style={styles.blockButtonText}>Block User</Text>
          </>
        )}
      </TouchableOpacity>

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        onSuccess={() => Alert.alert('Report submitted', 'Thanks.')}
        targetUserId={userId}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: { ...typography.h2 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.greenLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  verifiedText: { ...typography.tiny, color: colors.green, fontWeight: '600' },
  classYearMajor: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
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
  },
  instagramText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  stat: { alignItems: 'center', gap: 2 },
  statNumber: { ...typography.h3 },
  statLabel: { ...typography.tiny, color: colors.textTertiary },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  socialRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    minWidth: 120,
  },
  friendBtnOutline: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  friendBtnOutlineText: { ...typography.bodyBold, color: colors.primary },
  friendBtnMuted: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  friendBtnMutedText: { ...typography.bodyBold, color: colors.textSecondary },
  friendBtnGreen: {
    borderWidth: 1,
    borderColor: colors.green,
    backgroundColor: colors.greenLight,
  },
  friendBtnGreenText: { ...typography.bodyBold, color: colors.green },
  messageBtnStyle: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  messageBtnText: { ...typography.bodyBold, color: colors.primary },
  requestRow: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestLabel: { ...typography.caption },
  requestActions: { flexDirection: 'row', gap: spacing.sm },
  acceptBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
  },
  acceptBtnText: { ...typography.bodyBold, color: colors.textInverse },
  declineBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  declineBtnText: { ...typography.bodyBold, color: colors.textSecondary },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
  },
  reportButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportButtonText: { ...typography.bodyBold, color: colors.textSecondary },
  blockButton: {
    marginTop: spacing.sm,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: colors.red,
  },
  blockButtonText: { ...typography.bodyBold, color: colors.red },
});
