import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  acceptFriendRequest,
  API_USER_MESSAGE,
  blockUser,
  cancelFriendRequest,
  createReport,
  declineFriendRequest,
  getFriendRelationship,
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
import { Chip, CompactHeader, EmptyState, Panel, PrimaryButton, Screen, ScreenHeader, StatTile, UserAvatar } from '../components/ui';
import { INTEREST_TAG_META } from '../constants/interestTags';
import { palette, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function UserProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const nav = useNavigation<Nav>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [relationship, setRelationship] = useState<Awaited<ReturnType<typeof getFriendRelationship>> | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('HARASSMENT');
  const [reportDetails, setReportDetails] = useState('');

  const load = useCallback(async (showAlert = true) => {
    try {
      const [profileResponse, relationshipResponse] = await Promise.all([
        getUserProfile(userId),
        getFriendRelationship(userId),
      ]);
      setProfile(profileResponse);
      setRelationship(relationshipResponse);
      setLoadError(null);
    } catch {
      setLoadError(API_USER_MESSAGE);
      if (showAlert) Alert.alert('Could not load profile', API_USER_MESSAGE);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const clubTags = useMemo(() => (profile?.clubs ?? []).slice(0, 4), [profile?.clubs]);
  const interestTags = useMemo(() => profile?.interestTags ?? [], [profile?.interestTags]);

  const refreshRelationship = async () => {
    const next = await getFriendRelationship(userId);
    setRelationship(next);
  };

  const handleFriendAction = async (action: 'send' | 'accept' | 'decline' | 'cancel' | 'unfriend') => {
    if (!relationship) return;
    setBusyAction(action);
    try {
      if (action === 'send') await sendFriendRequest(userId);
      if (action === 'accept' && relationship.requestId) await acceptFriendRequest(relationship.requestId);
      if (action === 'decline' && relationship.requestId) await declineFriendRequest(relationship.requestId);
      if (action === 'cancel' && relationship.requestId) await cancelFriendRequest(relationship.requestId);
      if (action === 'unfriend') await unfriend(userId);
      await refreshRelationship();
    } catch {
      Alert.alert('Could not update friendship', API_USER_MESSAGE);
    } finally {
      setBusyAction(null);
    }
  };

  const handleMessage = async () => {
    setBusyAction('message');
    try {
      const thread = await getThreadByUser(userId);
      nav.navigate('Thread', { threadId: thread.id, title: thread.otherUser.name });
    } catch {
      Alert.alert('Could not open messages', API_USER_MESSAGE);
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
    } catch {
      Alert.alert(isBlocked ? 'Could not unblock user' : 'Could not block user', API_USER_MESSAGE);
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
    } catch {
      Alert.alert('Could not send report', API_USER_MESSAGE);
    } finally {
      setBusyAction(null);
    }
  };

  const relationshipActions = () => {
    if (!relationship) return null;
    switch (relationship.status) {
      case 'NONE':
        return <PrimaryButton label="Send friend request" onPress={() => void handleFriendAction('send')} loading={busyAction === 'send'} />;
      case 'PENDING_SENT':
        return <PrimaryButton label="Cancel request" onPress={() => void handleFriendAction('cancel')} loading={busyAction === 'cancel'} kind="ghost" />;
      case 'PENDING_RECEIVED':
        return (
          <View style={styles.buttonStack}>
            <PrimaryButton label="Accept friend request" onPress={() => void handleFriendAction('accept')} loading={busyAction === 'accept'} />
            <PrimaryButton label="Decline request" onPress={() => void handleFriendAction('decline')} loading={busyAction === 'decline'} kind="ghost" />
          </View>
        );
      case 'FRIENDS':
        return (
          <View style={styles.buttonStack}>
            <PrimaryButton label="Message" onPress={() => void handleMessage()} loading={busyAction === 'message'} />
            <PrimaryButton label="Unfriend" onPress={() => void handleFriendAction('unfriend')} loading={busyAction === 'unfriend'} kind="ghost" />
          </View>
        );
      case 'BLOCKED':
        return (
          <Panel>
            <Text style={styles.body}>There is a block on this relationship. Unblock if you were the one who set it.</Text>
            <View style={styles.inlineAction}>
              <PrimaryButton label="Unblock" onPress={() => void handleBlockToggle()} loading={busyAction === 'unblock'} kind="ghost" />
            </View>
          </Panel>
        );
      default:
        return null;
    }
  };

  if (!profile && loadError) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Profile" onBack={() => navigation.goBack()} />
          <EmptyState icon="alert-circle-outline" title="Could not load profile" body={loadError} />
          <PrimaryButton label="Try again" onPress={() => void load(false)} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Profile" onBack={() => navigation.goBack()} />
        {profile ? (
          <>
            <CompactHeader
              eyebrow={profile.verifiedUniversity ? 'Verified student' : 'Student profile'}
              title={profile.name}
              subtitle={profile.bio ?? `${profile.major ?? 'Major not listed'}${profile.classYear ? ` • ${profile.classYear}` : ''}`}
            >
              <View style={styles.headerRow}>
                <UserAvatar name={profile.name} avatarUrl={profile.avatarUrl} size={78} />
                <View style={styles.headerMeta}>
                  <Text style={styles.title}>{profile.major ?? 'Ohio State student'}</Text>
                  <Text style={styles.body}>
                    {profile.classYear ?? 'Class year not listed'}
                    {profile.instagramHandle ? ` • @${profile.instagramHandle}` : ''}
                  </Text>
                </View>
              </View>
            </CompactHeader>

            {relationshipActions()}

            <View style={styles.statRow}>
              <StatTile label="Pods joined" value={String(profile.podsJoined)} icon="people-outline" />
              <StatTile label="Pods attended" value={String(profile.podsAttended)} icon="checkmark-circle-outline" />
              <StatTile label="Reliability" value={profile.reliabilityScore == null ? 'N/A' : `${profile.reliabilityScore}%`} icon="shield-checkmark-outline" />
            </View>

            {interestTags.length ? (
              <Panel>
                <Text style={styles.title}>Interests</Text>
                <View style={styles.chipWrap}>
                  {interestTags.map((tag) => (
                    <Chip key={tag} label={INTEREST_TAG_META[tag]?.label ?? tag} active />
                  ))}
                </View>
              </Panel>
            ) : null}

            {clubTags.length ? (
              <Panel>
                <Text style={styles.title}>Clubs</Text>
                <View style={styles.chipWrap}>
                  {clubTags.map((club) => (
                    <Chip key={club} label={club} />
                  ))}
                </View>
              </Panel>
            ) : null}

            <Panel>
              <Text style={styles.title}>Safety tools</Text>
              <Text style={styles.body}>Use this if something about this person or their behavior needs review.</Text>
              <View style={styles.chipWrap}>
                {REPORT_REASONS.map((reason) => (
                  <Chip
                    key={reason}
                    label={REPORT_REASON_LABELS[reason]}
                    active={selectedReason === reason}
                    onPress={() => setSelectedReason(reason)}
                  />
                ))}
              </View>
              <TextInput
                value={reportDetails}
                onChangeText={setReportDetails}
                placeholder="Optional details that would help a review..."
                placeholderTextColor={palette.slate}
                style={styles.input}
                multiline
              />
              <View style={styles.buttonStack}>
                <PrimaryButton label="Submit report" onPress={() => void handleReport()} loading={busyAction === 'report'} kind="ghost" />
                {relationship?.status !== 'BLOCKED' ? (
                  <PrimaryButton label="Block user" onPress={() => void handleBlockToggle()} loading={busyAction === 'block'} kind="ghost" />
                ) : null}
              </View>
            </Panel>
          </>
        ) : (
          <EmptyState icon="hourglass-outline" title="Loading profile" body="Pulling in profile, relationship, and trust info." />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  headerMeta: {
    flex: 1,
    gap: 4,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
    marginTop: spacing.sm,
  },
  buttonStack: {
    gap: spacing.sm,
  },
  inlineAction: {
    marginTop: spacing.sm,
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
  },
  input: {
    minHeight: 96,
    marginTop: spacing.sm,
    borderRadius: 18,
    backgroundColor: palette.cream,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    ...typography.body,
    color: palette.ink,
    textAlignVertical: 'top',
  },
});
