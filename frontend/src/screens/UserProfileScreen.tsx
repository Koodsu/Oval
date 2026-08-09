import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSharedStateVersion } from '../context/SharedStateInvalidationContext';
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
  IconButton,
  ListRow,
  ScreenHeader,
  Sheet,
  SkeletonCard,
  Slab,
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

import { toast } from '../lib/toast';
import { formatDateTime } from '../utils/format';
type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function UserProfileScreen({
  route,
  navigation,
  previewData,
}: Props & {
  previewData?: {
    profile: PublicProfile;
    relationship: Awaited<ReturnType<typeof getFriendRelationship>>;
  };
}) {
  const sharedStateVersion = useSharedStateVersion('users', 'friends', 'pods', 'clubs');
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  const { userId } = route.params;
  const nav = useNavigation<Nav>();
  const [profile, setProfile] = useState<PublicProfile | null>(previewData?.profile ?? null);
  const [relationship, setRelationship] = useState<Awaited<
    ReturnType<typeof getFriendRelationship>
  > | null>(previewData?.relationship ?? null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('HARASSMENT');
  const [reportDetails, setReportDetails] = useState('');
  const [safetyOpen, setSafetyOpen] = useState(false);

  const load = useCallback(
    async (showAlert = false) => {
      if (previewData) return;
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
        if (showAlert) toast.error('Could not load profile', getApiErrorMessage(error));
      }
    },
    [previewData, userId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, sharedStateVersion]),
  );

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
      toast.error('Could not update friendship', getApiErrorMessage(error));
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
      toast.error('Could not open messages', getApiErrorMessage(error));
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
      toast.error(
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
      toast.success('Report sent', 'Thanks. We logged your report for review.');
    } catch (error) {
      toast.error('Could not send report', getApiErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const confirmUnfriend = () => {
    if (!profile) return;
    setSafetyOpen(false);
    Alert.alert(
      `Unfriend ${profile.name}?`,
      'You will need to send another friend request before messaging again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: () => void handleFriendAction('unfriend'),
        },
      ],
    );
  };

  const confirmBlock = () => {
    if (!profile) return;
    setSafetyOpen(false);
    Alert.alert(
      `Block ${profile.name}?`,
      'They will not be able to message, invite, or view you. You can unblock them later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => void handleBlockToggle(),
        },
      ],
    );
  };

  const relationshipActions = () => {
    if (!relationship) return null;
    switch (relationship.status) {
      case 'NONE':
        return (
          <View style={[styles.actionRow, accessibilityLayout && styles.actionRowLargeText]}>
            <Button
              label="Add friend"
              icon="person-add-outline"
              onPress={() => void handleFriendAction('send')}
              loading={busyAction === 'send'}
              style={[{ flex: 1 }, accessibilityLayout && styles.actionButtonLargeText]}
            />
            <Button
              label="Message"
              icon="chatbubble-outline"
              variant="secondary"
              disabled
              onPress={() => {}}
              style={[{ flex: 1 }, accessibilityLayout && styles.actionButtonLargeText]}
            />
          </View>
        );
      case 'PENDING_SENT':
        return (
          <View style={[styles.actionRow, accessibilityLayout && styles.actionRowLargeText]}>
            <Button
              label="Request sent"
              icon="checkmark"
              variant="secondary"
              disabled
              onPress={() => {}}
              style={[{ flex: 1 }, accessibilityLayout && styles.actionButtonLargeText]}
            />
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => void handleFriendAction('cancel')}
              loading={busyAction === 'cancel'}
              style={[{ flex: 1 }, accessibilityLayout && styles.actionButtonLargeText]}
            />
          </View>
        );
      case 'PENDING_RECEIVED':
        return (
          <View style={[styles.actionRow, accessibilityLayout && styles.actionRowLargeText]}>
            <Button
              label="Accept"
              onPress={() => void handleFriendAction('accept')}
              loading={busyAction === 'accept'}
              style={[{ flex: 1 }, accessibilityLayout && styles.actionButtonLargeText]}
            />
            <Button
              label="Decline"
              variant="secondary"
              onPress={() => void handleFriendAction('decline')}
              loading={busyAction === 'decline'}
              style={[{ flex: 1 }, accessibilityLayout && styles.actionButtonLargeText]}
            />
          </View>
        );
      case 'FRIENDS':
        return (
          <View style={[styles.actionRow, accessibilityLayout && styles.actionRowLargeText]}>
            <Button
              label="Message"
              icon="chatbubble-outline"
              onPress={() => void handleMessage()}
              loading={busyAction === 'message'}
              style={[{ flex: 1 }, accessibilityLayout && styles.actionButtonLargeText]}
            />
            <Button
              label="Friends"
              icon="people-outline"
              variant="secondary"
              onPress={() => setSafetyOpen(true)}
              style={[{ flex: 1 }, accessibilityLayout && styles.actionButtonLargeText]}
            />
          </View>
        );
      case 'BLOCKED':
        return (
          <Card padded>
            <Text style={typography.body} maxFontSizeMultiplier={2}>
              This profile is blocked. Unblock them to reconnect.
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
      case 'SELF':
        return null;
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
          <EmptyState
            icon="alert-circle"
            title="Could not load profile"
            body={loadError}
            actionLabel="Try again"
            onAction={() => void load(false)}
          />
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
        <ScreenHeader
          title=""
          onBack={() => navigation.goBack()}
          right={
            <IconButton
              icon="ellipsis-horizontal"
              onPress={() => setSafetyOpen(true)}
              accessibilityLabel="Profile actions"
            />
          }
        />
        {profile ? (
          <>
            <Card padded>
              <View style={[styles.identityRow, accessibilityLayout && styles.identityRowLargeText]}>
                <Avatar name={profile.name} uri={profile.avatarUrl} size={82} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <View style={styles.nameRow}>
                    <Text
                      style={styles.profileName}
                      numberOfLines={accessibilityLayout ? undefined : 2}
                      maxFontSizeMultiplier={2}
                    >
                      {profile.name}
                    </Text>
                    {profile.verifiedUniversity ? (
                      <Ionicons name="checkmark-circle" size={19} color={colors.blue} />
                    ) : null}
                  </View>
                  <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
                    {[profile.major, profile.classYear].filter(Boolean).join(' · ') ||
                      'Ohio State student'}
                  </Text>
                </View>
              </View>
              {profile.bio ? (
                <Text style={[typography.body, { marginTop: spacing.md }]} maxFontSizeMultiplier={2}>
                  {profile.bio}
                </Text>
              ) : null}
              {interestTags.length ? (
                <View style={styles.tagWrap}>
                  {interestTags.slice(0, 5).map((tag) => (
                    <Tag
                      key={tag}
                      label={INTEREST_TAG_META[tag]?.label ?? tag}
                      tint={accentForSeed(colors, tag).soft}
                    />
                  ))}
                </View>
              ) : null}
              {profile.purpose || profile.campusZones?.length ? (
                <Text
                  style={[typography.captionSmall, { marginTop: spacing.sm }]}
                  maxFontSizeMultiplier={2}
                >
                  {[
                    profile.purpose ? `Here for: ${profile.purpose}` : null,
                    profile.campusZones?.length
                      ? `Usually around ${profile.campusZones.join(', ')}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </Text>
              ) : null}
              {profile.instagramHandle ? (
                <Text
                  style={[typography.captionSmall, { marginTop: spacing.xs }]}
                  maxFontSizeMultiplier={2}
                >
                  @{profile.instagramHandle}
                </Text>
              ) : null}
            </Card>

            {relationshipActions()}

            <Card padded={false}>
              <View style={styles.statRow}>
                <ProfileStat value={profile.podsJoined} label="Pods" />
                <ProfileStat value={profile.clubCount ?? 0} label="Clubs" />
                <ProfileStat value={profile.mutualFriendCount ?? 0} label="Mutual" last />
              </View>
            </Card>

            {profile.mutualFriends?.length ? (
              <View style={styles.section}>
                <Text style={typography.kicker} maxFontSizeMultiplier={2}>
                  MUTUAL FRIENDS
                </Text>
                <Card padded>
                  <View style={[styles.mutualRow, accessibilityLayout && styles.mutualRowLargeText]}>
                    <View style={styles.avatarStack}>
                      {profile.mutualFriends.slice(0, 4).map((friend, index) => (
                        <Pressable
                          key={friend.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${friend.name}'s profile`}
                          onPress={() =>
                            navigation.push('UserProfile', { userId: friend.id })
                          }
                          style={[styles.stackedAvatar, index > 0 && { marginLeft: -10 }]}
                        >
                          <Avatar name={friend.name} uri={friend.avatarUrl} size={38} />
                        </Pressable>
                      ))}
                    </View>
                    <Text
                      style={[
                        typography.captionSmall,
                        { flex: 1, textAlign: accessibilityLayout ? 'left' : 'right' },
                      ]}
                      maxFontSizeMultiplier={2}
                    >
                      {profile.mutualFriendCount} mutual{' '}
                      {profile.mutualFriendCount === 1 ? 'friend' : 'friends'}
                    </Text>
                  </View>
                </Card>
              </View>
            ) : null}

            {profile.upcomingPods?.length ? (
              <View style={styles.section}>
                <Text style={typography.kicker} maxFontSizeMultiplier={2}>
                  UPCOMING PODS
                </Text>
                {profile.upcomingPods.map((pod) => (
                  <Slab
                    key={pod.id}
                    onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}
                    accessibilityLabel={`Open ${pod.title}`}
                    faceStyle={{ padding: spacing.lg }}
                  >
                    <View style={[styles.podRow, accessibilityLayout && styles.podRowLargeText]}>
                      <View
                        style={[styles.podIcon, { backgroundColor: colors.primarySoft }]}
                      >
                        <Ionicons name="calendar-outline" size={22} color={colors.accentText} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text
                          style={typography.heading}
                          numberOfLines={accessibilityLayout ? undefined : 1}
                          maxFontSizeMultiplier={2}
                        >
                          {pod.title}
                        </Text>
                        <Text
                          style={typography.captionSmall}
                          numberOfLines={accessibilityLayout ? undefined : 1}
                          maxFontSizeMultiplier={2}
                        >
                          {formatDateTime(pod.meetupTime)}
                        </Text>
                        <Text
                          style={typography.captionSmall}
                          numberOfLines={accessibilityLayout ? undefined : 1}
                          maxFontSizeMultiplier={2}
                        >
                          {pod.location}
                        </Text>
                      </View>
                      <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
                        {Math.max(0, pod.maxMembers - pod.memberCount)} spots
                      </Text>
                    </View>
                  </Slab>
                ))}
              </View>
            ) : null}

            {profile.clubMemberships?.length ? (
              <View style={styles.section}>
                <Text style={typography.kicker} maxFontSizeMultiplier={2}>
                  CLUBS
                </Text>
                <Card padded={false}>
                  {profile.clubMemberships.map((club, index) => (
                    <Pressable
                      key={club.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${club.name}`}
                      onPress={() => navigation.navigate('ClubDetail', { clubId: club.id })}
                      style={[
                        styles.clubRow,
                        accessibilityLayout && styles.clubRowLargeText,
                        { borderBottomColor: colors.borderSoft },
                        index === profile.clubMemberships!.length - 1 && {
                          borderBottomWidth: 0,
                        },
                      ]}
                    >
                      <View style={[styles.clubIcon, { backgroundColor: colors.surfaceAlt }]}>
                        <Text style={{ fontSize: 18 }}>{club.emoji}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={typography.subheading}
                          numberOfLines={accessibilityLayout ? undefined : 1}
                          maxFontSizeMultiplier={2}
                        >
                          {club.name}
                        </Text>
                        <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
                          {club.category}
                        </Text>
                      </View>
                      {!accessibilityLayout ? (
                        <Ionicons name="chevron-forward" size={17} color={colors.sub} />
                      ) : null}
                    </Pressable>
                  ))}
                </Card>
              </View>
            ) : null}

            {!profile.mutualFriends?.length &&
            !profile.upcomingPods?.length &&
            !profile.clubMemberships?.length ? (
              <Card padded>
                <View style={styles.sparseState}>
                  <View style={[styles.sparseIcon, { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name="git-network-outline" size={28} color={colors.ink} />
                  </View>
                  <Text style={typography.title} maxFontSizeMultiplier={2}>
                    Nothing shared yet
                  </Text>
                  <Text
                    style={[typography.caption, { textAlign: 'center' }]}
                    maxFontSizeMultiplier={2}
                  >
                    When you join the same pods or clubs, you’ll see that context here.
                  </Text>
                </View>
              </Card>
            ) : null}
          </>
        ) : (
          <>
            <SkeletonCard />
            <SkeletonCard compact />
            <SkeletonCard compact />
          </>
        )}
      </ScrollView>
      <Sheet
        visible={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        title="Profile actions"
        kicker="SAFETY & CONNECTION"
        scrollable
      >
        <View style={{ gap: spacing.lg }}>
          {relationship?.status === 'FRIENDS' ? (
            <ListRow icon="person-remove-outline" title="Unfriend" onPress={confirmUnfriend} />
          ) : null}
          <View>
              <Text style={typography.kicker} maxFontSizeMultiplier={2}>
                REPORT REASON
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
              accessibilityLabel="Report details"
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
              maxFontSizeMultiplier={2}
            />
            <Button
              label="Submit report"
              variant="secondary"
              onPress={() => void handleReport()}
              loading={busyAction === 'report'}
              style={{ marginTop: spacing.md }}
            />
          </View>
          {relationship?.status !== 'BLOCKED' && relationship?.status !== 'SELF' ? (
            <Button
              label="Block user"
              variant="danger"
              onPress={confirmBlock}
              loading={busyAction === 'block'}
            />
          ) : null}
        </View>
      </Sheet>
    </AppBackdrop>
  );
}

function ProfileStat({
  value,
  label,
  last = false,
}: {
  value: number;
  label: string;
  last?: boolean;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View
      style={[
        styles.statItem,
        !last && { borderRightWidth: BORDER_W, borderRightColor: colors.borderSoft },
      ]}
    >
      <Text style={typography.title} maxFontSizeMultiplier={2}>
        {value}
      </Text>
      <Text style={typography.captionSmall} maxFontSizeMultiplier={2}>
        {label}
      </Text>
    </View>
  );
}

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
  identityRowLargeText: {
    alignItems: 'flex-start' as const,
    flexDirection: 'column' as const,
  },
  profileName: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    color: t.colors.ink,
    flexShrink: 1,
  },
  nameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  actionRowLargeText: {
    flexDirection: 'column' as const,
  },
  actionButtonLargeText: {
    alignSelf: 'stretch' as const,
    flex: 0,
  },
  statRow: {
    flexDirection: 'row' as const,
  },
  statItem: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: spacing.md,
  },
  tagWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  mutualRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  mutualRowLargeText: {
    alignItems: 'flex-start' as const,
    flexDirection: 'column' as const,
  },
  avatarStack: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  stackedAvatar: {
    borderRadius: radii.pill,
  },
  podRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  podRowLargeText: {
    alignItems: 'flex-start' as const,
    flexDirection: 'column' as const,
  },
  podIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  clubRow: {
    minHeight: 62,
    paddingHorizontal: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    borderBottomWidth: BORDER_W,
  },
  clubRowLargeText: {
    alignItems: 'flex-start' as const,
    paddingVertical: spacing.md,
  },
  clubIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sparseState: {
    minHeight: 180,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
  },
  sparseIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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
