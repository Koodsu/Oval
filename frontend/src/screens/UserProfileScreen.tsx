import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  createReport,
  declineFriendRequest,
  getFriendRelationship,
  getApiErrorMessage,
  getThreadByUser,
  getUserProfile,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  sendFriendRequest,
  unfriend,
  unblockUser,
} from '../api';
import { RootStackParamList } from '../../App';
import { PublicProfile } from '../types';
import {
  AppBackdrop,
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  ScreenHeader,
  SkeletonCard,
  Slab,
  Sticker,
  Tag,
  accentForSeed,
} from '../components/ui';
import { INTEREST_TAG_META } from '../constants/interestTags';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  fonts,
  radii,
  spacing,
  useTheme,
} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function UserProfileScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = route.params;
  const nav = useNavigation<Nav>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [relationship, setRelationship] = useState<Awaited<
    ReturnType<typeof getFriendRelationship>
  > | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('HARASSMENT');
  const [reportDetails, setReportDetails] = useState('');

  const load = useCallback(
    async (showAlert = true) => {
      try {
        const [profileResponse, relationshipResponse] = await Promise.all([
          getUserProfile(userId),
          getFriendRelationship(userId),
        ]);
        setProfile(profileResponse);
        setRelationship(relationshipResponse);
        setLoadError(null);
      } catch (error) {
        setLoadError(getApiErrorMessage(error));
        if (showAlert) Alert.alert('Could not load profile', getApiErrorMessage(error));
      }
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const clubTags = useMemo(() => (profile?.clubs ?? []).slice(0, 4), [profile?.clubs]);
  const interestTags = useMemo(() => profile?.interestTags ?? [], [profile?.interestTags]);

  const refreshRelationship = async () => {
    const next = await getFriendRelationship(userId);
    setRelationship(next);
  };

  const handleFriendAction = async (
    action: 'send' | 'accept' | 'decline' | 'cancel' | 'unfriend',
  ) => {
    if (!relationship) return;
    setBusyAction(action);
    try {
      if (action === 'send') await sendFriendRequest(userId);
      if (action === 'accept' && relationship.requestId)
        await acceptFriendRequest(relationship.requestId);
      if (action === 'decline' && relationship.requestId)
        await declineFriendRequest(relationship.requestId);
      if (action === 'cancel' && relationship.requestId)
        await cancelFriendRequest(relationship.requestId);
      if (action === 'unfriend') await unfriend(userId);
      await refreshRelationship();
    } catch (error) {
      Alert.alert('Could not update friendship', getApiErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleMessage = async () => {
    setBusyAction('message');
    try {
      const thread = await getThreadByUser(userId);
      nav.navigate('Thread', { threadId: thread.id, title: thread.otherUser.name });
    } catch (error) {
      Alert.alert('Could not open messages', getApiErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleBlockToggle = async () => {
    const isBlocked = relationship?.status === 'BLOCKED';
    setBusyAction(isBlocked ? 'unblock' : 'block');
    try {
      if (isBlocked) await unblockUser(userId);
      else await blockUser(userId);
      await refreshRelationship();
    } catch (error) {
      Alert.alert(
        isBlocked ? 'Could not unblock user' : 'Could not block user',
        getApiErrorMessage(error),
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleReport = async () => {
    setBusyAction('report');
    try {
      await createReport({
        targetUserId: userId,
        reason: selectedReason,
        details: reportDetails.trim() || undefined,
      });
      setReportDetails('');
      Alert.alert('Report sent', 'Thanks. We logged your report for review.');
    } catch (error) {
      Alert.alert('Could not send report', getApiErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const relationshipActions = () => {
    if (!relationship) return null;
    switch (relationship.status) {
      case 'NONE':
        return (
          <Button
            label="Send friend request"
            icon="person-add"
            onPress={() => void handleFriendAction('send')}
            loading={busyAction === 'send'}
          />
        );
      case 'PENDING_SENT':
        return (
          <Button
            label="Cancel request"
            variant="secondary"
            onPress={() => void handleFriendAction('cancel')}
            loading={busyAction === 'cancel'}
          />
        );
      case 'PENDING_RECEIVED':
        return (
          <View style={styles.buttonStack}>
            <Button
              label="Accept friend request"
              onPress={() => void handleFriendAction('accept')}
              loading={busyAction === 'accept'}
            />
            <Button
              label="Decline request"
              variant="secondary"
              onPress={() => void handleFriendAction('decline')}
              loading={busyAction === 'decline'}
            />
          </View>
        );
      case 'FRIENDS':
        return (
          <View style={styles.buttonStack}>
            <Button
              label="Message"
              icon="chatbox"
              onPress={() => void handleMessage()}
              loading={busyAction === 'message'}
            />
            <Button
              label="Unfriend"
              variant="secondary"
              onPress={() => void handleFriendAction('unfriend')}
              loading={busyAction === 'unfriend'}
            />
          </View>
        );
      case 'BLOCKED':
        return (
          <Card padded>
            <Text style={typography.body}>
              There is a block on this relationship. Unblock if you were the one who set it.
            </Text>
            <Button
              label="Unblock"
              variant="secondary"
              onPress={() => void handleBlockToggle()}
              loading={busyAction === 'unblock'}
              style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
            />
          </Card>
        );
      default:
        return null;
    }
  };

  if (!profile && loadError) {
    return (
      <AppBackdrop>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <ScreenHeader title="Profile" onBack={() => navigation.goBack()} />
          <EmptyState icon="alert-circle" title="Could not load profile" body={loadError} />
          <Button label="Try again" onPress={() => void load(false)} />
        </ScrollView>
      </AppBackdrop>
    );
  }

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <ScreenHeader title="Profile" kicker="STUDENT" onBack={() => navigation.goBack()} />
        {profile ? (
          <>
            {/* Identity */}
            <Card padded>
              <View style={styles.identityRow}>
                <Avatar name={profile.name} uri={profile.avatarUrl} size={78} tilt={-3} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={styles.profileName} numberOfLines={2}>
                    {profile.name}
                  </Text>
                  <Text style={typography.subheading}>
                    {profile.major ?? 'Ohio State student'}
                  </Text>
                  <Text style={typography.captionSmall}>
                    {profile.classYear ?? 'Class year not listed'}
                    {profile.instagramHandle ? ` • @${profile.instagramHandle}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', marginTop: 2 }}>
                    <Sticker
                      label={profile.verifiedUniversity ? 'Verified student' : 'Student'}
                      tint={profile.verifiedUniversity ? colors.successSoft : colors.surfaceAlt}
                      icon={profile.verifiedUniversity ? 'checkmark-circle' : 'school'}
                      small
                      tilt={-2}
                    />
                  </View>
                </View>
              </View>
              {profile.bio ? (
                <Text style={[typography.body, { color: colors.sub, marginTop: spacing.md }]}>
                  {profile.bio}
                </Text>
              ) : null}
            </Card>

            {relationshipActions()}

            {/* Stats */}
            <View style={styles.statRow}>
              <StatSlab
                label="PODS JOINED"
                value={String(profile.podsJoined)}
                icon="flash"
                tint={colors.amberSoft}
              />
              <StatSlab
                label="ATTENDED"
                value={String(profile.podsAttended)}
                icon="checkmark-circle"
                tint={colors.greenSoft}
              />
              <StatSlab
                label="RELIABILITY"
                value={
                  profile.reliabilityScore == null ? 'N/A' : `${profile.reliabilityScore}%`
                }
                icon="shield-checkmark"
                tint={colors.tealSoft}
              />
            </View>

            {interestTags.length ? (
              <Card padded>
                <Text style={typography.title}>Interests</Text>
                <View style={styles.tagWrap}>
                  {interestTags.map((tag) => (
                    <Tag
                      key={tag}
                      label={INTEREST_TAG_META[tag]?.label ?? tag}
                      tint={accentForSeed(colors, tag).soft}
                    />
                  ))}
                </View>
              </Card>
            ) : null}

            {clubTags.length ? (
              <Card padded>
                <Text style={typography.title}>Clubs</Text>
                <View style={styles.tagWrap}>
                  {clubTags.map((club) => (
                    <Tag key={club} label={club} />
                  ))}
                </View>
              </Card>
            ) : null}

            {/* Safety */}
            <Card padded>
              <Text style={typography.title}>Safety tools</Text>
              <Text style={[typography.caption, { marginTop: 4 }]}>
                Use this if something about this person or their behavior needs review.
              </Text>
              <View style={styles.tagWrap}>
                {REPORT_REASONS.map((reason) => (
                  <Chip
                    key={reason}
                    label={REPORT_REASON_LABELS[reason]}
                    selected={selectedReason === reason}
                    tint={colors.dangerSoft}
                    onPress={() => setSelectedReason(reason)}
                  />
                ))}
              </View>
              <TextInput
                value={reportDetails}
                onChangeText={setReportDetails}
                placeholder="Optional details that would help a review…"
                placeholderTextColor={colors.faint}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.border,
                    color: colors.ink,
                  },
                ]}
                multiline
              />
              <View style={[styles.buttonStack, { marginTop: spacing.md }]}>
                <Button
                  label="Submit report"
                  variant="secondary"
                  onPress={() => void handleReport()}
                  loading={busyAction === 'report'}
                />
                {relationship?.status !== 'BLOCKED' ? (
                  <Button
                    label="Block user"
                    variant="danger"
                    onPress={() => void handleBlockToggle()}
                    loading={busyAction === 'block'}
                  />
                ) : null}
              </View>
            </Card>
          </>
        ) : (
          <>
            <SkeletonCard />
            <SkeletonCard compact />
            <SkeletonCard compact />
          </>
        )}
      </ScrollView>
    </AppBackdrop>
  );
}

function StatSlab({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}) {
  const { colors } = useTheme();
  return (
    <Slab
      accessibilityRole="none"
      color={tint}
      style={{ flex: 1 }}
      faceStyle={statStyles.face}
    >
      <Ionicons name={icon} size={16} color={colors.ink} />
      <Text style={[statStyles.value, { color: colors.ink }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[statStyles.label, { color: colors.sub }]} numberOfLines={1}>
        {label}
      </Text>
    </Slab>
  );
}

import { StyleSheet } from 'react-native';

const statStyles = StyleSheet.create({
  face: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
    gap: 3,
  },
  value: {
    fontFamily: fonts.displayMedium,
    fontSize: 17,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 8.5,
    letterSpacing: 1,
  },
});

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  identityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.lg,
  },
  profileName: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: t.colors.ink,
  },
  statRow: {
    flexDirection: 'row' as const,
    gap: spacing.md,
  },
  tagWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  buttonStack: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 96,
    marginTop: spacing.md,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    padding: spacing.md,
    fontFamily: fonts.medium,
    fontSize: 14.5,
    textAlignVertical: 'top' as const,
  },
}));
