import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList, RootStackParamList } from '../../App';
import { DirectMessageThread, FriendRequest, FriendUser, PodInvite } from '../types';
import {
  AppBackdrop,
  Avatar,
  Banner,
  Button,
  Card,
  Segmented,
  EmptyState,
  IconButton,
  SkeletonCard,
  Slab,
  Sticker,
} from '../components/ui';
import { formatDateTime, relativeTime } from '../utils/format';
import {
  BORDER_W,
  DOCK_CLEARANCE,
  Theme,
  createThemedStyles,
  fonts,
  motion,
  radii,
  spacing,
  useTheme,
} from '../theme';

type Mode = 'messages' | 'invites' | 'friends';
type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Inbox'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function InboxScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('messages');
  const [threads, setThreads] = useState<DirectMessageThread[]>([]);
  const [invites, setInvites] = useState<PodInvite[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [threadResult, inviteResult, requestResult, friendResult] = await Promise.allSettled([
      getMessageThreads(),
      getPodInvites(),
      getFriendRequests(),
      getFriends(),
    ]);

    if (threadResult.status === 'fulfilled') {
      setThreads(
        [...threadResult.value].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
      );
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
      setLoadWarning("Couldn't refresh — pull to retry.");
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
          : null,
      );
    }
    // Tab badge is owned by useInboxBadgeCount in App.tsx (app-wide polling),
    // so the Inbox screen no longer sets it here.
    setLoaded(true);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
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
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Masthead */}
        <Animated.View entering={FadeInDown.duration(motion.durBase)}>
          <View style={styles.masthead}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.kicker, { color: colors.primary }]}>THE LOOP</Text>
              <Text style={styles.pageTitle}>Inbox</Text>
            </View>
            <IconButton
              icon="search"
              onPress={() => navigation.navigate('UserSearch')}
              accessibilityLabel="Find people"
            />
            <IconButton
              icon="person-circle-outline"
              onPress={() => navigation.navigate('Profile')}
              accessibilityLabel="Open profile"
            />
          </View>
        </Animated.View>

        {/* Mode switch */}
        <Animated.View entering={FadeInDown.delay(motion.stagger).duration(motion.durBase)}>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'messages', label: threads.length ? `Messages · ${threads.length}` : 'Messages' },
              { value: 'invites', label: invites.length ? `Invites · ${invites.length}` : 'Invites' },
              { value: 'friends', label: requests.length ? `Friends · ${requests.length}` : 'Friends' },
            ]}
          />
        </Animated.View>

        {loadWarning ? (
          <View style={{ gap: spacing.sm }}>
            <Banner message={loadWarning} kind="info" />
            <Button label="Try again" size="sm" variant="secondary" onPress={() => void load()} />
          </View>
        ) : null}

        {mode === 'messages' ? (
          <View style={styles.section}>
            {!loaded ? (
              <>
                <SkeletonCard compact />
                <SkeletonCard compact />
              </>
            ) : threads.length ? (
              threads.map((thread, threadIndex) => (
                <Animated.View
                  key={thread.id}
                  entering={FadeInDown.delay(Math.min(threadIndex, 6) * motion.stagger).duration(
                    motion.durBase,
                  )}
                >
                  <Slab
                    onPress={() =>
                      navigation.navigate('Thread', {
                        threadId: thread.id,
                        title: thread.otherUser.name,
                      })
                    }
                    faceStyle={styles.rowFace}
                    accessibilityLabel={`Open conversation with ${thread.otherUser.name}`}
                  >
                    <View>
                      <Avatar
                        name={thread.otherUser.name}
                        uri={thread.otherUser.avatarUrl}
                        size={46}
                        tilt={threadIndex % 2 === 0 ? -2 : 2}
                      />
                      {thread.hasUnread ? (
                        <View
                          style={[
                            styles.unreadDot,
                            { backgroundColor: colors.primary, borderColor: colors.border },
                          ]}
                        />
                      ) : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <View style={styles.threadTop}>
                        <Text style={[typography.heading, { flex: 1 }]} numberOfLines={1}>
                          {thread.otherUser.name}
                        </Text>
                        <Text style={typography.captionSmall}>
                          {relativeTime(thread.lastMessage?.createdAt ?? thread.updatedAt)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          typography.caption,
                          thread.hasUnread && {
                            fontFamily: fonts.semibold,
                            color: colors.ink,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {thread.lastMessage?.content ?? 'No messages yet'}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={colors.faint} />
                  </Slab>
                </Animated.View>
              ))
            ) : (
              <EmptyState
                icon="mail-open"
                title="No messages yet"
                body="New DMs land here once you start connecting through pods and profiles."
              />
            )}
          </View>
        ) : null}

        {mode === 'invites' ? (
          <View style={styles.section}>
            {!loaded ? (
              <>
                <SkeletonCard />
                <SkeletonCard compact />
              </>
            ) : invites.length ? (
              invites.map((invite) => (
                <Card key={invite.id} padded>
                  <View style={styles.inviteTop}>
                    <Sticker label="Pod invite" tint={colors.amberSoft} icon="flash" tilt={-2} small />
                    {invite.sender ? (
                      <Pressable
                        onPress={() =>
                          navigation.navigate('UserProfile', { userId: invite.senderId })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${invite.sender.name}'s profile`}
                      >
                        <Avatar name={invite.sender.name} uri={invite.sender.avatarUrl} size={36} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={[typography.heading, { marginTop: spacing.sm }]}>
                    {invite.pod?.activity.title ?? 'Pod invite'}
                  </Text>
                  <Text style={typography.captionSmall}>
                    From {invite.sender?.name ?? 'Someone'} • {formatDateTime(invite.createdAt)}
                  </Text>
                  {invite.pod ? (
                    <Pressable
                      style={[
                        styles.podPreview,
                        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                      ]}
                      onPress={() => navigation.navigate('PodDetail', { podId: invite.podId })}
                      accessibilityRole="button"
                      accessibilityLabel="Open pod"
                    >
                      <Text style={typography.subheading}>
                        {formatDateTime(invite.pod.meetupTime)}
                      </Text>
                      <Text style={typography.captionSmall}>{invite.pod.location}</Text>
                    </Pressable>
                  ) : null}
                  <View style={styles.buttonRow}>
                    <Button
                      label="Accept"
                      size="sm"
                      onPress={() => void handleInvite(invite.id, true)}
                      loading={busyId === `invite-${invite.id}`}
                    />
                    <Button
                      label="Decline"
                      size="sm"
                      variant="secondary"
                      onPress={() => void handleInvite(invite.id, false)}
                      disabled={busyId != null}
                    />
                  </View>
                </Card>
              ))
            ) : (
              <EmptyState
                icon="paper-plane"
                title="No invites waiting"
                body="When pod creators invite you into something, it shows up here."
              />
            )}
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
                <Text style={typography.kicker}>REQUESTS</Text>
                {requests.map((request) => (
                  <Card key={request.id} padded>
                    {request.sender ? (
                      <Pressable
                        style={styles.identity}
                        onPress={() =>
                          navigation.navigate('UserProfile', { userId: request.senderId })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${request.sender.name}'s profile`}
                      >
                        <Avatar name={request.sender.name} uri={request.sender.avatarUrl} size={42} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={typography.heading} numberOfLines={1}>
                            {request.sender.name}
                          </Text>
                          <Text style={typography.captionSmall}>
                            Sent {formatDateTime(request.createdAt)}
                          </Text>
                        </View>
                      </Pressable>
                    ) : (
                      <View>
                        <Text style={typography.heading}>Friend request</Text>
                        <Text style={typography.captionSmall}>
                          Sent {formatDateTime(request.createdAt)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.buttonRow}>
                      <Button
                        label="Accept"
                        size="sm"
                        onPress={() => void handleRequest(request.id, true)}
                        loading={busyId === `request-${request.id}`}
                      />
                      <Button
                        label="Decline"
                        size="sm"
                        variant="secondary"
                        onPress={() => void handleRequest(request.id, false)}
                        disabled={busyId != null}
                      />
                    </View>
                  </Card>
                ))}
              </>
            ) : null}

            {loaded && outgoingRequests.length ? (
              <>
                <Text style={typography.kicker}>SENT</Text>
                {outgoingRequests.map((request) => (
                  <Card key={request.id} padded>
                    {request.receiver ? (
                      <Pressable
                        style={styles.identity}
                        onPress={() =>
                          navigation.navigate('UserProfile', { userId: request.receiverId })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${request.receiver.name}'s profile`}
                      >
                        <Avatar
                          name={request.receiver.name}
                          uri={request.receiver.avatarUrl}
                          size={42}
                        />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={typography.heading} numberOfLines={1}>
                            {request.receiver.name}
                          </Text>
                          <Text style={typography.captionSmall}>
                            Waiting since {formatDateTime(request.createdAt)}
                          </Text>
                        </View>
                      </Pressable>
                    ) : null}
                    <View style={styles.buttonRow}>
                      <Button
                        label="Cancel"
                        size="sm"
                        variant="secondary"
                        onPress={() => void handleCancelRequest(request.id)}
                        loading={busyId === `request-${request.id}`}
                      />
                    </View>
                  </Card>
                ))}
              </>
            ) : null}

            {loaded && friends.length ? (
              <>
                <Text style={typography.kicker}>FRIENDS</Text>
                {friends.map((friend, index) => (
                  <Slab
                    key={friend.id}
                    onPress={() => navigation.navigate('UserProfile', { userId: friend.id })}
                    faceStyle={styles.rowFace}
                    accessibilityLabel={`View ${friend.name}'s profile`}
                  >
                    <Avatar
                      name={friend.name}
                      uri={friend.avatarUrl}
                      size={46}
                      tilt={index % 2 === 0 ? -2 : 2}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={typography.heading} numberOfLines={1}>
                        {friend.name}
                      </Text>
                      <Text style={typography.captionSmall}>View profile</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={colors.faint} />
                  </Slab>
                ))}
              </>
            ) : null}

            {loaded && !requests.length && !outgoingRequests.length && !friends.length ? (
              <EmptyState
                icon="person-add"
                title="No friend activity"
                body="Find people from pods, profiles, or search to start building your circle."
                actionLabel="Find people"
                onAction={() => navigation.navigate('UserSearch')}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: DOCK_CLEARANCE,
    gap: spacing.lg,
  },
  masthead: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.sm,
  },
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: t.colors.ink,
    marginTop: 4,
  },
  modeRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  section: {
    gap: spacing.md,
  },
  rowFace: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    padding: spacing.md,
  },
  threadTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  unreadDot: {
    position: 'absolute' as const,
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  inviteTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  podPreview: {
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: 2,
    marginTop: spacing.md,
  },
  identity: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  buttonRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
}));
