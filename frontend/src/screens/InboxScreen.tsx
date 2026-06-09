import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
	  acceptFriendRequest,
	  acceptPodInvite,
	  cancelFriendRequest,
	  declineFriendRequest,
	  declinePodInvite,
	  getFriends,
	  getFriendRequests,
	  getApiErrorMessage,
	  getMessageThreads,
	  getPodInvites,
} from '../api';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { DirectMessageThread, FriendRequest, FriendUser, PodInvite } from '../types';
import { CompactHeader, EmptyState, Entrance, Panel, PrimaryButton, Screen, SegmentedControl, SkeletonCard, Tap, UserAvatar } from '../components/ui';
import { formatDateTime } from '../utils/format';
import { Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';

type Mode = 'messages' | 'invites' | 'friends';
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function InboxScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useStyles();
  const { colors } = useTheme();
  const chevron = colors.faint;
  const [mode, setMode] = useState<Mode>('messages');
  const [threads, setThreads] = useState<DirectMessageThread[]>([]);
  const [invites, setInvites] = useState<PodInvite[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
	  const [friends, setFriends] = useState<FriendUser[]>([]);
	  const [busyId, setBusyId] = useState<string | null>(null);
	  const [loaded, setLoaded] = useState(false);
	  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [threadResult, inviteResult, requestResult, friendResult] = await Promise.allSettled([
      getMessageThreads(),
      getPodInvites(),
      getFriendRequests(),
      getFriends(),
    ]);

    if (threadResult.status === 'fulfilled') {
      setThreads(threadResult.value);
    }

    if (inviteResult.status === 'fulfilled') {
      setInvites(inviteResult.value);
    }

    if (requestResult.status === 'fulfilled') {
      setRequests(requestResult.value.incoming);
      setOutgoingRequests(requestResult.value.outgoing);
    }

    if (friendResult.status === 'fulfilled') {
      setFriends(friendResult.value);
    }

	    if (
	      threadResult.status === 'rejected' &&
	      inviteResult.status === 'rejected' &&
	      requestResult.status === 'rejected' &&
	      friendResult.status === 'rejected'
	    ) {
	      Alert.alert('Could not load inbox', getApiErrorMessage(threadResult.reason));
	      setLoadWarning(null);
	    } else {
	      const failedSections = [
	        threadResult.status === 'rejected' ? 'messages' : null,
	        inviteResult.status === 'rejected' ? 'invites' : null,
	        requestResult.status === 'rejected' ? 'friend requests' : null,
	        friendResult.status === 'rejected' ? 'friends' : null,
	      ].filter((section): section is string => section != null);
	      setLoadWarning(
	        failedSections.length
	          ? `Some inbox sections could not refresh: ${failedSections.join(', ')}.`
	          : null
	      );
	    }
	    setLoaded(true);
	  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleInvite = async (inviteId: string, accept: boolean) => {
    setBusyId(`invite-${inviteId}`);
    const previousInvites = invites;
    setInvites((current) => current.filter((invite) => invite.id !== inviteId));
    try {
      if (accept) {
        const pod = await acceptPodInvite(inviteId);
        navigation.navigate('PodDetail', { podId: pod.id });
      } else {
        await declinePodInvite(inviteId);
      }
      await load();
    } catch (error) {
      setInvites(previousInvites);
      Alert.alert('Could not update invite', getApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleRequest = async (requestId: string, accept: boolean) => {
    setBusyId(`request-${requestId}`);
    const previousRequests = requests;
    setRequests((current) => current.filter((request) => request.id !== requestId));
    try {
      if (accept) {
        await acceptFriendRequest(requestId);
      } else {
        await declineFriendRequest(requestId);
      }
      await load();
    } catch (error) {
      setRequests(previousRequests);
      Alert.alert('Could not update request', getApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    setBusyId(`request-${requestId}`);
    const previousOutgoing = outgoingRequests;
    setOutgoingRequests((current) => current.filter((request) => request.id !== requestId));
    try {
      await cancelFriendRequest(requestId);
      await load();
    } catch (error) {
      setOutgoingRequests(previousOutgoing);
      Alert.alert('Could not cancel request', getApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <Entrance index={0}>
          <CompactHeader
            eyebrow="Inbox"
            title="Stay in the loop."
            subtitle="Your messages, pod invites, and friend requests — all in one place."
          >
            <View style={styles.headerAction}>
              <PrimaryButton label="Find people" icon="search-outline" onPress={() => navigation.navigate('UserSearch')} kind="ghost" />
              <PrimaryButton label="Settings" icon="settings-outline" onPress={() => navigation.navigate('Profile')} kind="ghost" />
            </View>
          </CompactHeader>
        </Entrance>

	        <SegmentedControl
          value={mode}
          options={[
            { value: 'messages', label: threads.length ? `Messages (${threads.length})` : 'Messages' },
            { value: 'invites', label: invites.length ? `Invites (${invites.length})` : 'Invites' },
            {
              value: 'friends',
              label: requests.length ? `Friends (${requests.length})` : 'Friends',
            },
          ]}
          onChange={setMode}
	        />
	        {loadWarning ? (
	          <Panel style={styles.warningPanel}>
	            <Text style={styles.warningText}>{loadWarning}</Text>
	            <TouchableOpacity onPress={() => void load()} style={styles.retryLink}>
	              <Text style={styles.retryLinkText}>Try again</Text>
	            </TouchableOpacity>
	          </Panel>
	        ) : null}

        {mode === 'messages' ? (
          <View style={styles.section}>
            {!loaded ? (
              <>
                <SkeletonCard compact />
                <SkeletonCard compact />
              </>
            ) : threads.length ? threads.map((thread, threadIndex) => (
              <Entrance key={thread.id} index={Math.min(threadIndex, 6)}>
                <Tap
                  style={styles.row}
                  onPress={() => navigation.navigate('Thread', { threadId: thread.id, title: thread.otherUser.name })}
                  accessibilityLabel={`Open conversation with ${thread.otherUser.name}`}
                >
                  <UserAvatar name={thread.otherUser.name} avatarUrl={thread.otherUser.avatarUrl} size={46} />
                  <View style={styles.copy}>
                    <Text style={styles.title}>{thread.otherUser.name}</Text>
                    <Text style={styles.body} numberOfLines={2}>{thread.lastMessage?.content ?? 'No messages yet'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={chevron} />
                </Tap>
              </Entrance>
            )) : <EmptyState icon="mail-open-outline" title="No messages yet" body="New DMs will land here once you start connecting through pods and profiles." />}
          </View>
        ) : null}

        {mode === 'invites' ? (
          <View style={styles.section}>
            {!loaded ? (
              <>
                <SkeletonCard />
                <SkeletonCard compact />
              </>
            ) : invites.length ? invites.map((invite) => (
              <Panel key={invite.id} style={styles.inviteCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.copy}>
                    <Text style={styles.title}>{invite.pod?.activity.title ?? 'Pod invite'}</Text>
                    <Text style={styles.body}>
                      From {invite.sender?.name ?? 'Someone'} • {formatDateTime(invite.createdAt)}
                    </Text>
                  </View>
                  {invite.sender ? (
                    <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: invite.senderId })}>
                      <UserAvatar name={invite.sender.name} avatarUrl={invite.sender.avatarUrl} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {invite.pod ? (
                  <TouchableOpacity
                    activeOpacity={0.84}
                    style={styles.podPreview}
                    onPress={() => navigation.navigate('PodDetail', { podId: invite.podId })}
                  >
                    <Text style={styles.previewMeta}>{formatDateTime(invite.pod.meetupTime)}</Text>
                    <Text style={styles.previewBody}>{invite.pod.location}</Text>
                  </TouchableOpacity>
                ) : null}
                <View style={styles.buttonRow}>
                  <PrimaryButton
                    label="Accept"
                    onPress={() => void handleInvite(invite.id, true)}
                    loading={busyId === `invite-${invite.id}`}
                  />
                  <PrimaryButton
                    label="Decline"
                    onPress={() => void handleInvite(invite.id, false)}
                    disabled={busyId != null}
                    kind="ghost"
                  />
                </View>
              </Panel>
            )) : <EmptyState icon="paper-plane-outline" title="No invites waiting" body="When pod creators invite you into something, it’ll show up here." />}
          </View>
        ) : null}

        {mode === 'friends' ? (
          <View style={styles.section}>
            {!loaded ? (
              <>
                <SkeletonCard compact />
                <SkeletonCard compact />
              </>
            ) : null}
            {loaded && requests.length ? (
              <>
                <Text style={styles.sectionLabel}>Requests</Text>
                {requests.map((request) => (
                  <Panel key={request.id}>
                    <View style={styles.cardTopRow}>
                      {request.sender ? (
                        <TouchableOpacity
                          style={styles.identity}
                          onPress={() => navigation.navigate('UserProfile', { userId: request.senderId })}
                        >
                          <UserAvatar name={request.sender.name} avatarUrl={request.sender.avatarUrl} />
                          <View style={styles.copy}>
                            <Text style={styles.title}>{request.sender.name}</Text>
                            <Text style={styles.body}>Sent {formatDateTime(request.createdAt)}</Text>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.copy}>
                          <Text style={styles.title}>Friend request</Text>
                          <Text style={styles.body}>Sent {formatDateTime(request.createdAt)}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.buttonRow}>
                      <PrimaryButton
                        label="Accept"
                        onPress={() => void handleRequest(request.id, true)}
                        loading={busyId === `request-${request.id}`}
                      />
                      <PrimaryButton
                        label="Decline"
                        onPress={() => void handleRequest(request.id, false)}
                        disabled={busyId != null}
                        kind="ghost"
                      />
                    </View>
                  </Panel>
                ))}
              </>
            ) : null}

            {loaded && outgoingRequests.length ? (
              <>
                <Text style={styles.sectionLabel}>Sent</Text>
                {outgoingRequests.map((request) => (
                  <Panel key={request.id}>
                    <View style={styles.cardTopRow}>
                      {request.receiver ? (
                        <TouchableOpacity
                          style={styles.identity}
                          onPress={() => navigation.navigate('UserProfile', { userId: request.receiverId })}
                        >
                          <UserAvatar name={request.receiver.name} avatarUrl={request.receiver.avatarUrl} />
                          <View style={styles.copy}>
                            <Text style={styles.title}>{request.receiver.name}</Text>
                            <Text style={styles.body}>Waiting since {formatDateTime(request.createdAt)}</Text>
                          </View>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <View style={styles.buttonRow}>
                      <PrimaryButton
                        label="Cancel"
                        onPress={() => void handleCancelRequest(request.id)}
                        loading={busyId === `request-${request.id}`}
                        kind="ghost"
                      />
                    </View>
                  </Panel>
                ))}
              </>
            ) : null}

            {loaded && friends.length ? (
              <>
                <Text style={styles.sectionLabel}>Friends</Text>
                {friends.map((friend) => (
                  <Tap
                    key={friend.id}
                    style={styles.row}
                    onPress={() => navigation.navigate('UserProfile', { userId: friend.id })}
                    accessibilityLabel={`View ${friend.name}'s profile`}
                  >
                    <UserAvatar name={friend.name} avatarUrl={friend.avatarUrl} size={46} />
                    <View style={styles.copy}>
                      <Text style={styles.title}>{friend.name}</Text>
                      <Text style={styles.body}>View profile</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={chevron} />
                  </Tap>
                ))}
              </>
            ) : null}

            {loaded && !requests.length && !outgoingRequests.length && !friends.length ? (
              <EmptyState icon="person-add-outline" title="No friend activity" body="Find people from pods, profiles, or search to start building your Bridge circle." />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  headerAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    alignItems: 'center' as const,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    ...t.shadows.subtle,
  },
  inviteCard: {
    gap: spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  identity: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...t.typography.title,
  },
  body: {
    ...t.typography.body,
  },
  warningPanel: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
    borderColor: t.colors.warnText,
    backgroundColor: t.colors.warnBg,
  },
  warningText: {
    ...t.typography.body,
    color: t.colors.warnText,
    flex: 1,
  },
  retryLink: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  retryLinkText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: t.colors.primary,
  },
  sectionLabel: {
    ...t.typography.label,
    marginTop: spacing.sm,
  },
  podPreview: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.inputBg,
    padding: spacing.md,
    gap: 2,
  },
  previewMeta: {
    ...t.typography.bodyStrong,
    fontSize: 13,
    lineHeight: 18,
  },
  previewBody: {
    ...t.typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
}));
