import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  acceptFriendRequest,
  acceptPodInvite,
  cancelFriendRequest,
  declineFriendRequest,
  declinePodInvite,
  getApiErrorMessage,
  getFriends,
  getFriendRequests,
  getInboxSummary,
  getMessageThreads,
  getMyPods,
  getPodInvites,
  getUserProfileShareUrl,
  PUBLIC_SITE_URL,
  trackEvent,
  type InboxSummary,
} from '../api';
import { MainTabParamList, RootStackParamList } from '../../App';
import {
  DirectMessageThread,
  FriendRequest,
  FriendUser,
  Pod,
  PodInvite,
} from '../types';
import {
  AppBackdrop,
  Avatar,
  AvatarStack,
  Banner,
  Button,
  SkeletonBlock,
  useDockClearance,
} from '../components/ui';
import { activityImageFor } from '../constants/contentImages';
import { useAuth } from '../context/AuthContext';
import { toast } from '../lib/toast';
import { formatDateTime, relativeTime } from '../utils/format';
import { getPodTitle } from '../utils/experience';
import {
  BORDER_W,
  Theme,
  createThemedStyles,
  elevation,
  motion,
  radii,
  spacing,
  useTheme,
} from '../theme';

type Mode = 'all' | 'messages' | 'pods' | 'invites';
type InboxPodThread = Pod & {
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageSenderName?: string;
};
type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Inbox'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type InboxPreviewData = {
  summary: InboxSummary;
  threads: DirectMessageThread[];
  invites: PodInvite[];
  requests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  friends: FriendUser[];
  pods: InboxPodThread[];
};

const connectionsIllustration = require('../../assets/illustrations/spot/cold-start/05-inbox-connections.png');
const noConversationsIllustration = require('../../assets/illustrations/spot/cold-start/09-no-conversations-personal.png');
const caughtUpIllustration = require('../../assets/illustrations/spot/cold-start/10-inbox-all-caught-up.png');

export default function InboxScreen({ previewData }: { previewData?: InboxPreviewData }) {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const dockClearance = useDockClearance();
  const [mode, setMode] = useState<Mode>('all');
  const [threads, setThreads] = useState<DirectMessageThread[]>(previewData?.threads ?? []);
  const [invites, setInvites] = useState<PodInvite[]>(previewData?.invites ?? []);
  const [requests, setRequests] = useState<FriendRequest[]>(previewData?.requests ?? []);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>(
    previewData?.outgoingRequests ?? [],
  );
  const [friends, setFriends] = useState<FriendUser[]>(previewData?.friends ?? []);
  const [podThreads, setPodThreads] = useState<InboxPodThread[]>(previewData?.pods ?? []);
  const [summary, setSummary] = useState<InboxSummary | null>(previewData?.summary ?? null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(Boolean(previewData));
  const [refreshing, setRefreshing] = useState(false);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (previewData) {
      setSummary(previewData.summary);
      setThreads(previewData.threads);
      setInvites(previewData.invites);
      setRequests(previewData.requests);
      setOutgoingRequests(previewData.outgoingRequests);
      setFriends(previewData.friends);
      setPodThreads(previewData.pods);
      setLoadWarning(null);
      setLoaded(true);
      setRefreshing(false);
      return;
    }
    const results = await Promise.allSettled([
      getInboxSummary(),
      getMessageThreads(),
      getPodInvites(),
      getFriendRequests(),
      getFriends(),
      getMyPods(),
    ]);
    const [
      summaryResult,
      threadResult,
      inviteResult,
      requestResult,
      friendResult,
      myPodsResult,
    ] = results;

    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
    if (threadResult.status === 'fulfilled') {
      setThreads(
        [...threadResult.value].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
      );
    }
    if (inviteResult.status === 'fulfilled') setInvites(inviteResult.value);
    if (requestResult.status === 'fulfilled') {
      setRequests(requestResult.value.incoming);
      setOutgoingRequests(requestResult.value.outgoing);
    }
    if (friendResult.status === 'fulfilled') setFriends(friendResult.value);
    if (myPodsResult.status === 'fulfilled') {
      setPodThreads(
        [...myPodsResult.value].sort(
          (a, b) =>
            (b.unreadCount ?? 0) - (a.unreadCount ?? 0) ||
            new Date(a.meetupTime).getTime() - new Date(b.meetupTime).getTime(),
        ),
      );
    }

    const sectionNames = ['counts', 'messages', 'invites', 'friend requests', 'friends', 'pod chats'];
    const failedSections = results.flatMap((result, index) =>
      result.status === 'rejected' ? [sectionNames[index]] : [],
    );
    setLoadWarning(
      failedSections.length === results.length
        ? "Couldn't refresh — pull to retry."
        : failedSections.length
          ? `Some inbox sections could not refresh: ${failedSections.join(', ')}.`
          : null,
    );
    setLoaded(true);
    setRefreshing(false);
  }, [previewData]);

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
      toast.error('Could not update invite', getApiErrorMessage(error));
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
      toast.error('Could not update request', getApiErrorMessage(error));
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
      toast.error('Could not cancel request', getApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const profileShareUrl = user?.id ? getUserProfileShareUrl(user.id) : PUBLIC_SITE_URL;

  const shareOval = useCallback(async () => {
    try {
      const result = await Share.share({
        title: 'Find me on Oval',
        message: `Find me on Oval: ${profileShareUrl}`,
        url: profileShareUrl,
      });
      if (result.action !== Share.dismissedAction) {
        void trackEvent('invite.shared', { surface: 'inbox' });
      }
    } catch (error) {
      toast.error('Could not open sharing', getApiErrorMessage(error));
    }
  }, [profileShareUrl]);

  const copyProfileLink = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(profileShareUrl);
      toast.success('Profile link copied', 'Anyone with the link can open your Oval profile.');
    } catch (error) {
      toast.error('Could not copy link', getApiErrorMessage(error));
    }
  }, [profileShareUrl]);

  const hasActionableInbox =
    Boolean(summary?.total) ||
    threads.some((thread) => thread.hasUnread) ||
    podThreads.some((pod) => (pod.unreadCount ?? 0) > 0) ||
    invites.length > 0 ||
    requests.length > 0;
  const newCount =
    summary?.total ??
    threads.filter((thread) => thread.hasUnread).length +
      podThreads.filter((pod) => (pod.unreadCount ?? 0) > 0).length +
      invites.length +
      requests.length;
  const hasNetworkHistory =
    threads.length > 0 ||
    podThreads.length > 0 ||
    friends.length > 0 ||
    outgoingRequests.length > 0;
  const recentContacts = useMemo(() => {
    const contacts = [...threads.map((thread) => thread.otherUser), ...friends];
    return contacts.filter(
      (contact, index) => contacts.findIndex((candidate) => candidate.id === contact.id) === index,
    );
  }, [friends, threads]);

  const tabOptions = useMemo(
    () => [
      { value: 'all' as const, label: 'All' },
      { value: 'messages' as const, label: 'Messages' },
      { value: 'pods' as const, label: 'Pod chats' },
      { value: 'invites' as const, label: 'Invites' },
    ],
    [],
  );

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xs,
            paddingBottom: dockClearance + spacing.lg,
          },
        ]}
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
        <Animated.View entering={FadeInDown.duration(motion.durBase)} style={styles.masthead}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={2} style={styles.pageTitle}>Inbox</Text>
          <Pressable
            onPress={() => navigation.navigate('UserSearch')}
            accessibilityRole="button"
            accessibilityLabel="Start a conversation"
            style={({ pressed }) => [
              styles.composeButton,
              { borderColor: colors.border, opacity: pressed ? 0.55 : 1 },
            ]}
          >
            <Ionicons name="pencil-outline" size={23} color={colors.ink} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(motion.stagger).duration(motion.durBase)}>
          <InboxTabs value={mode} onChange={setMode} options={tabOptions} />
        </Animated.View>

        {loadWarning ? (
          <View style={styles.warning}>
            <Banner message={loadWarning} kind="info" />
            <Button label="Try again" size="sm" variant="secondary" onPress={() => void load()} />
          </View>
        ) : null}

        {!loaded ? (
          <InboxSkeleton />
        ) : (
          <>
            {mode === 'all' ? (
              <AllInbox
                threads={threads}
                pods={podThreads}
                invites={invites}
                requests={requests}
                friends={recentContacts}
                newCount={newCount}
                hasActionableInbox={hasActionableInbox}
                hasNetworkHistory={hasNetworkHistory}
                busyId={busyId}
                onMode={setMode}
                onThread={(thread) =>
                  navigation.navigate('Thread', {
                    threadId: thread.id,
                    title: thread.otherUser.name,
                  })
                }
                onPod={(pod) => navigation.navigate('PodChat', { podId: pod.id })}
                onInvite={handleInvite}
                onRequest={handleRequest}
                onFindPeople={() => navigation.navigate('UserSearch')}
                onShare={() => void shareOval()}
                onContact={(friend) =>
                  navigation.navigate('UserProfile', { userId: friend.id })
                }
              />
            ) : null}

            {mode === 'messages' ? (
              <MessagesInbox
                threads={threads}
                friends={recentContacts}
                onThread={(thread) =>
                  navigation.navigate('Thread', {
                    threadId: thread.id,
                    title: thread.otherUser.name,
                  })
                }
                onFindPeople={() => navigation.navigate('UserSearch')}
                onShare={() => void shareOval()}
                onContact={(friend) =>
                  navigation.navigate('UserProfile', { userId: friend.id })
                }
              />
            ) : null}

            {mode === 'pods' ? (
              <PodChatsInbox
                pods={podThreads}
                onPod={(pod) => navigation.navigate('PodChat', { podId: pod.id })}
                onExplore={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
              />
            ) : null}

            {mode === 'invites' ? (
              <InvitesInbox
                invites={invites}
                requests={requests}
                outgoingRequests={outgoingRequests}
                busyId={busyId}
                onInvite={handleInvite}
                onRequest={handleRequest}
                onCancelRequest={handleCancelRequest}
                onShare={() => void shareOval()}
                profileShareUrl={profileShareUrl}
                onCopyProfileLink={() => void copyProfileLink()}
                onExplore={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
                onProfile={(userId) => navigation.navigate('UserProfile', { userId })}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </AppBackdrop>
  );
}

function InboxTabs({
  options,
  value,
  onChange,
}: {
  options: { value: Mode; label: string }[];
  value: Mode;
  onChange: (value: Mode) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.tabs,
        accessibilityLayout && styles.tabsAccessible,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.tab,
              accessibilityLayout && styles.tabAccessible,
              active && { backgroundColor: colors.primary },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              maxFontSizeMultiplier={2}
              numberOfLines={1}
              style={[
                styles.tabLabel,
                { color: active ? colors.onPrimary : colors.ink },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function InboxSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <SkeletonBlock width={110} height={20} radius={8} />
      <View style={styles.skeletonGroup}>
        <SkeletonBlock width={48} height={48} radius={24} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <SkeletonBlock width="54%" height={16} radius={6} />
          <SkeletonBlock width="88%" height={13} radius={6} />
        </View>
      </View>
      <View style={styles.skeletonGroup}>
        <SkeletonBlock width={48} height={48} radius={24} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <SkeletonBlock width="42%" height={16} radius={6} />
          <SkeletonBlock width="72%" height={13} radius={6} />
        </View>
      </View>
    </View>
  );
}

function AllInbox({
  threads,
  pods,
  invites,
  requests,
  friends,
  newCount,
  hasActionableInbox,
  hasNetworkHistory,
  busyId,
  onMode,
  onThread,
  onPod,
  onInvite,
  onRequest,
  onFindPeople,
  onShare,
  onContact,
}: {
  threads: DirectMessageThread[];
  pods: InboxPodThread[];
  invites: PodInvite[];
  requests: FriendRequest[];
  friends: FriendUser[];
  newCount: number;
  hasActionableInbox: boolean;
  hasNetworkHistory: boolean;
  busyId: string | null;
  onMode: (mode: Mode) => void;
  onThread: (thread: DirectMessageThread) => void;
  onPod: (pod: Pod) => void;
  onInvite: (inviteId: string, accept: boolean) => void;
  onRequest: (requestId: string, accept: boolean) => void;
  onFindPeople: () => void;
  onShare: () => void;
  onContact: (friend: FriendUser) => void;
}) {
  const styles = useStyles();

  if (!hasActionableInbox) {
    return (
      <InboxLanding
        kind={hasNetworkHistory ? 'caught-up' : 'new'}
        friends={friends}
        onFindPeople={onFindPeople}
        onShare={onShare}
        onContact={onContact}
      />
    );
  }

  return (
    <View style={styles.sections}>
      {newCount > 0 ? <LoopBanner count={newCount} /> : null}

      {threads.length ? (
        <InboxSection title="Messages" onSeeAll={() => onMode('messages')}>
          {threads.slice(0, 2).map((thread, index) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              variant="detailed"
              onPress={() => onThread(thread)}
              showDivider={index < Math.min(threads.length, 2) - 1}
            />
          ))}
        </InboxSection>
      ) : null}

      {pods.length ? (
        <View style={styles.section}>
          <InboxSectionHeader title="Pod chats" onSeeAll={() => onMode('pods')} />
          {pods.slice(0, 1).map((pod) => (
            <PodChatCard key={pod.id} pod={pod} onPress={() => onPod(pod)} />
          ))}
        </View>
      ) : null}

      {invites.length || requests.length ? (
        <View style={styles.section}>
          <InboxSectionHeader title="Invites" onSeeAll={() => onMode('invites')} />
          {invites.slice(0, 1).map((invite) => (
            <InviteSpotlightCard
              key={invite.id}
              invite={invite}
              busy={busyId === `invite-${invite.id}`}
              onAccept={() => onInvite(invite.id, true)}
              onDecline={() => onInvite(invite.id, false)}
            />
          ))}
          {!invites.length && requests.length ? (
            <View style={styles.standaloneList}>
              {requests.slice(0, 2).map((request, index, visible) => (
                <FriendRequestRow
                  key={request.id}
                  request={request}
                  busy={busyId === `request-${request.id}`}
                  onAccept={() => onRequest(request.id, true)}
                  onDecline={() => onRequest(request.id, false)}
                  showDivider={index < visible.length - 1}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <KeepMoving onFindPeople={onFindPeople} onShare={onShare} />
    </View>
  );
}

function MessagesInbox({
  threads,
  friends,
  onThread,
  onFindPeople,
  onShare,
  onContact,
}: {
  threads: DirectMessageThread[];
  friends: FriendUser[];
  onThread: (thread: DirectMessageThread) => void;
  onFindPeople: () => void;
  onShare: () => void;
  onContact: (friend: FriendUser) => void;
}) {
  const styles = useStyles();
  if (!threads.length) {
    return (
      <FocusedEmpty
        image={noConversationsIllustration}
        title="Say hey to someone new"
        body="Message a classmate or reconnect with someone from a pod."
        primaryLabel="Find classmates"
        primaryIcon="person-add-outline"
        onPrimary={onFindPeople}
        secondaryLabel="Invite a friend"
        secondaryIcon="share-outline"
        onSecondary={onShare}
      >
        <PeopleStrip
          title="People you know"
          friends={friends}
          onContact={onContact}
          onFindPeople={onFindPeople}
        />
      </FocusedEmpty>
    );
  }
  return (
    <View style={styles.sections}>
      <PeopleStrip
        title="Recent people"
        friends={friends}
        onContact={onContact}
        onFindPeople={onFindPeople}
      />
      <FeaturedThread thread={threads[0]} onPress={() => onThread(threads[0])} />
      <InboxSection title="All conversations">
        {threads.map((thread, index) => (
          <ThreadRow
            key={thread.id}
            thread={thread}
            onPress={() => onThread(thread)}
            showDivider={index < threads.length - 1}
          />
        ))}
      </InboxSection>
    </View>
  );
}

function PodChatsInbox({
  pods,
  onPod,
  onExplore,
}: {
  pods: InboxPodThread[];
  onPod: (pod: Pod) => void;
  onExplore: () => void;
}) {
  const styles = useStyles();
  if (!pods.length) {
    return (
      <FocusedEmpty
        image={connectionsIllustration}
        title="Your next chat starts with a plan"
        body="Join a pod and the group conversation comes with it."
        primaryLabel="Explore pods"
        primaryIcon="search"
        onPrimary={onExplore}
      />
    );
  }
  return (
    <View style={styles.sections}>
      <InboxSection title="Your pod chats">
        {pods.map((pod, index) => (
          <PodChatRow
            key={pod.id}
            pod={pod}
            onPress={() => onPod(pod)}
            showDivider={index < pods.length - 1}
          />
        ))}
      </InboxSection>
      <ExplorePodsCallout onPress={onExplore} />
    </View>
  );
}

function InvitesInbox({
  invites,
  requests,
  outgoingRequests,
  busyId,
  onInvite,
  onRequest,
  onCancelRequest,
  onShare,
  profileShareUrl,
  onCopyProfileLink,
  onExplore,
  onProfile,
}: {
  invites: PodInvite[];
  requests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  busyId: string | null;
  onInvite: (inviteId: string, accept: boolean) => void;
  onRequest: (requestId: string, accept: boolean) => void;
  onCancelRequest: (requestId: string) => void;
  onShare: () => void;
  profileShareUrl: string;
  onCopyProfileLink: () => void;
  onExplore: () => void;
  onProfile: (userId: string) => void;
}) {
  const styles = useStyles();
  const { typography } = useTheme();
  const isEmpty = !invites.length && !requests.length && !outgoingRequests.length;

  if (isEmpty) {
    return (
      <FocusedEmpty
        image={caughtUpIllustration}
        title="You're all caught up"
        body="You're caught up. New pod and friend invitations will land here."
        primaryLabel="Browse activities"
        primaryIcon="search"
        onPrimary={onExplore}
        secondaryLabel="Invite a friend"
        secondaryIcon="share-outline"
        onSecondary={onShare}
      >
        <ProfileSharePanel
          url={profileShareUrl}
          onShare={onShare}
          onCopy={onCopyProfileLink}
        />
      </FocusedEmpty>
    );
  }

  return (
    <View style={styles.sections}>
      {invites.length ? (
        <View style={styles.section}>
          <Text maxFontSizeMultiplier={2} style={typography.title}>Pod invites</Text>
          {invites.map((invite) => (
            <InviteSpotlightCard
              key={invite.id}
              invite={invite}
              busy={busyId === `invite-${invite.id}`}
              onAccept={() => onInvite(invite.id, true)}
              onDecline={() => onInvite(invite.id, false)}
            />
          ))}
        </View>
      ) : null}

      {requests.length ? (
        <InboxSection title="Friend requests">
          {requests.map((request, index) => (
            <FriendRequestRow
              key={request.id}
              request={request}
              busy={busyId === `request-${request.id}`}
              onAccept={() => onRequest(request.id, true)}
              onDecline={() => onRequest(request.id, false)}
              onProfile={onProfile}
              showDivider={index < requests.length - 1}
            />
          ))}
        </InboxSection>
      ) : null}

      {outgoingRequests.length ? (
        <InboxSection title="Sent requests">
          {outgoingRequests.map((request, index) => (
            <SentRequestRow
              key={request.id}
              request={request}
              busy={busyId === `request-${request.id}`}
              onCancel={() => onCancelRequest(request.id)}
              onProfile={onProfile}
              showDivider={index < outgoingRequests.length - 1}
            />
          ))}
        </InboxSection>
      ) : null}
    </View>
  );
}

function InboxLanding({
  kind,
  friends,
  onFindPeople,
  onShare,
  onContact,
}: {
  kind: 'new' | 'caught-up';
  friends: FriendUser[];
  onFindPeople: () => void;
  onShare: () => void;
  onContact: (friend: FriendUser) => void;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  const isNew = kind === 'new';

  return (
    <Animated.View entering={FadeInDown.duration(motion.durSlow)} style={styles.landing}>
      <Image
        source={isNew ? connectionsIllustration : caughtUpIllustration}
        resizeMode="contain"
        accessibilityLabel={
          isNew ? 'Three students connecting on Oval' : 'Students relaxing together'
        }
        style={styles.heroImage}
      />
      <View style={styles.heroCopy}>
        <Text maxFontSizeMultiplier={2} style={styles.heroTitle}>
          {isNew ? 'Connections will\nshow up here' : "You're all caught up"}
        </Text>
        <Text maxFontSizeMultiplier={2} style={[typography.body, styles.heroBody]}>
          {isNew
            ? 'Message friends, chat in pods, and manage invitations—all in one place.'
            : 'Nice work staying in the loop. Find someone new or plan what comes next.'}
        </Text>
      </View>

      <View
        style={[
          styles.primaryActions,
          accessibilityLayout && styles.primaryActionsAccessible,
        ]}
      >
        <ActionButton
          label="Find classmates"
          icon="person-add-outline"
          primary
          onPress={onFindPeople}
        />
        <ActionButton label="Invite a friend" icon="share-outline" onPress={onShare} />
      </View>

      {isNew ? (
        <>
          <SharePanel onShare={onShare} />
          <View
            style={[
              styles.explainerGrid,
              accessibilityLayout && styles.explainerGridAccessible,
            ]}
          >
            <View
              style={[
                styles.explainerCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text maxFontSizeMultiplier={2} style={typography.heading}>What you'll see here</Text>
              <ExplainerLine icon="mail-outline" color={colors.blue} label="Direct messages" />
              <ExplainerLine icon="chatbubbles-outline" color={colors.violet} label="Pod chats" />
              <ExplainerLine icon="person-add-outline" color={colors.pink} label="Invitations" />
            </View>
            <View
              style={[
                styles.loopCard,
                { backgroundColor: colors.amberSoft, borderColor: colors.amber },
              ]}
            >
              <Ionicons name="notifications-outline" size={23} color={colors.amber} />
              <Text maxFontSizeMultiplier={2} style={typography.heading}>Stay in the loop</Text>
              <Text maxFontSizeMultiplier={2} style={typography.caption}>Get notified when people reply or invite you.</Text>
            </View>
          </View>
        </>
      ) : (
        <ContactStrip friends={friends} onContact={onContact} />
      )}
    </Animated.View>
  );
}

function FocusedEmpty({
  image,
  title,
  body,
  primaryLabel,
  primaryIcon,
  onPrimary,
  secondaryLabel,
  secondaryIcon,
  onSecondary,
  children,
}: {
  image: number;
  title: string;
  body: string;
  primaryLabel: string;
  primaryIcon: keyof typeof Ionicons.glyphMap;
  onPrimary: () => void;
  secondaryLabel?: string;
  secondaryIcon?: keyof typeof Ionicons.glyphMap;
  onSecondary?: () => void;
  children?: React.ReactNode;
}) {
  const styles = useStyles();
  const { typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  return (
    <Animated.View entering={FadeInDown.duration(motion.durSlow)} style={styles.focusedEmpty}>
      <Image
        source={image}
        resizeMode="contain"
        accessibilityLabel=""
        style={styles.focusedEmptyImage}
      />
      <View style={styles.heroCopy}>
        <Text maxFontSizeMultiplier={2} style={styles.heroTitle}>{title}</Text>
        <Text maxFontSizeMultiplier={2} style={[typography.body, styles.heroBody]}>{body}</Text>
      </View>
      <View
        style={[
          styles.primaryActions,
          accessibilityLayout && styles.primaryActionsAccessible,
        ]}
      >
        <ActionButton label={primaryLabel} icon={primaryIcon} primary onPress={onPrimary} />
        {secondaryLabel && secondaryIcon && onSecondary ? (
          <ActionButton label={secondaryLabel} icon={secondaryIcon} onPress={onSecondary} />
        ) : null}
      </View>
      {children}
    </Animated.View>
  );
}

function KeepMoving({
  onFindPeople,
  onShare,
}: {
  onFindPeople: () => void;
  onShare: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  return (
    <View
      style={[
        styles.movingPanel,
        { backgroundColor: colors.primarySoft, borderColor: colors.pinkSoft },
      ]}
    >
      <Text maxFontSizeMultiplier={2} style={styles.movingTitle}>Keep things moving</Text>
      <View
        style={[
          styles.movingActions,
          accessibilityLayout && styles.movingActionsAccessible,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <MovingAction
          icon="people-outline"
          color={colors.primary}
          title="Find classmates"
          body="Connect with people in your classes."
          onPress={onFindPeople}
        />
        <View
          style={[
            styles.movingDivider,
            accessibilityLayout && styles.movingDividerAccessible,
            { backgroundColor: colors.border },
          ]}
        />
        <MovingAction
          icon="person-add-outline"
          color={colors.violet}
          title="Invite a friend"
          body="Bring a friend to campus life."
          onPress={onShare}
        />
      </View>
    </View>
  );
}

function MovingAction({
  icon,
  color,
  title,
  body,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  body: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      onPress={onPress}
      style={({ pressed }) => [styles.movingAction, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={27} color={color} />
      <View style={styles.movingCopy}>
        <Text maxFontSizeMultiplier={2} style={styles.movingActionTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={2} style={styles.movingActionBody} numberOfLines={3}>
          {body}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.ink} />
    </Pressable>
  );
}

function LoopBanner({ count }: { count: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  return (
    <View
      accessible
      accessibilityLabel={`You're in the loop. ${count} new ${count === 1 ? 'item' : 'items'} from your community.`}
      style={[
        styles.loopBanner,
        accessibilityLayout && styles.loopBannerAccessible,
        { backgroundColor: colors.amberSoft, borderColor: colors.border },
      ]}
    >
      <View style={styles.loopBannerCopy}>
        <Text maxFontSizeMultiplier={2} style={styles.loopBannerTitle}>You&apos;re in the loop</Text>
        <Text maxFontSizeMultiplier={2} style={[styles.loopBannerBody, { color: colors.sub }]}>
          New activity from your community.
        </Text>
        <View
          style={[
            styles.loopBannerPill,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="notifications" size={15} color={colors.primary} />
          <Text maxFontSizeMultiplier={2} style={styles.loopBannerPillLabel}>{count} new</Text>
        </View>
      </View>
      {accessibilityLayout ? null : (
        <Image
          source={connectionsIllustration}
          resizeMode="cover"
          accessible={false}
          style={styles.loopBannerImage}
        />
      )}
    </View>
  );
}

function InboxSectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  return (
    <View
      style={[
        styles.sectionHeader,
        accessibilityLayout && styles.sectionHeaderAccessible,
      ]}
    >
      <Text maxFontSizeMultiplier={2} style={styles.sectionTitle}>{title}</Text>
      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`See all ${title.toLowerCase()}`}
        >
          <Text maxFontSizeMultiplier={2} style={[styles.seeAll, { color: colors.accentText }]}>See all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function InboxSection({
  title,
  onSeeAll,
  children,
}: {
  title: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <InboxSectionHeader title={title} onSeeAll={onSeeAll} />
      <View
        style={[
          styles.listGroup,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function ThreadRow({
  thread,
  onPress,
  showDivider,
  variant = 'compact',
}: {
  thread: DirectMessageThread;
  onPress: () => void;
  showDivider: boolean;
  /**
   * `detailed` is the Inbox "All" presentation: the timestamp stacks above an
   * unread dot + chevron on the right, and the preview wraps to two lines.
   */
  variant?: 'compact' | 'detailed';
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const detailed = variant === 'detailed';
  const timestamp = inboxTimestamp(thread.lastMessage?.createdAt ?? thread.updatedAt);
  const preview = thread.lastMessage?.content ?? 'Start the conversation';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${thread.otherUser.name}${
        thread.hasUnread ? ', unread' : ''
      }`}
      style={({ pressed }) => [
        styles.inboxRow,
        detailed && styles.inboxRowDetailed,
        showDivider && { borderBottomWidth: BORDER_W, borderBottomColor: colors.borderSoft },
        pressed && { backgroundColor: colors.surfaceAlt },
      ]}
    >
      <View>
        <Avatar name={thread.otherUser.name} uri={thread.otherUser.avatarUrl} size={58} />
      </View>
      <View style={styles.rowCopy}>
        {detailed ? (
          <Text maxFontSizeMultiplier={2} style={[styles.rowTitle, { fontWeight: '800' }]} numberOfLines={2}>
            {thread.otherUser.name}
          </Text>
        ) : (
          <View style={styles.rowTop}>
            <Text
              maxFontSizeMultiplier={2}
              style={[styles.rowTitle, thread.hasUnread && { fontWeight: '800' }, { flex: 1 }]}
              numberOfLines={2}
            >
              {thread.otherUser.name}
            </Text>
            <Text maxFontSizeMultiplier={2} style={[styles.rowTimestamp, { color: colors.sub }]}>{timestamp}</Text>
          </View>
        )}
        <Text
          maxFontSizeMultiplier={2}
          style={[
            styles.rowPreview,
            { color: colors.sub },
            thread.hasUnread && { color: colors.ink, fontWeight: '600' },
          ]}
          numberOfLines={detailed ? 2 : 1}
        >
          {preview}
        </Text>
      </View>
      {detailed ? (
        <View style={styles.threadRowEnd}>
          <Text maxFontSizeMultiplier={2} style={[styles.rowTimestamp, { color: colors.sub }]}>{timestamp}</Text>
          <View style={styles.threadRowIndicators}>
            {thread.hasUnread ? (
              <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
            ) : null}
            <Ionicons name="chevron-forward" size={23} color={colors.ink} />
          </View>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={23} color={colors.ink} />
      )}
    </Pressable>
  );
}

function inboxTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return relativeTime(iso);
}

function PodChatRow({
  pod,
  onPress,
  showDivider,
}: {
  pod: InboxPodThread;
  onPress: () => void;
  showDivider: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const unread = pod.unreadCount ?? 0;
  const title = getPodTitle(pod);
  const members = pod.members.map((member) => ({
    name: member.user.name,
    uri: member.user.avatarUrl,
  }));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0
          ? `Open ${title} chat, ${unread} unread ${unread === 1 ? 'message' : 'messages'}`
          : `Open ${title} chat`
      }
      style={({ pressed }) => [
        styles.inboxRow,
        showDivider && { borderBottomWidth: BORDER_W, borderBottomColor: colors.borderSoft },
        pressed && { backgroundColor: colors.surfaceAlt },
      ]}
    >
      <View
        style={[
          styles.podAvatar,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}
      >
        {members.length ? (
          <AvatarStack names={members} size={42} max={3} />
        ) : (
          <Ionicons name="people" size={27} color={colors.violet} />
        )}
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.rowTop}>
          <Text maxFontSizeMultiplier={2} style={[styles.rowTitle, styles.podRowTitle, { flex: 1 }]} numberOfLines={2}>
            {title}
          </Text>
          {pod.lastMessageAt ? (
            <Text maxFontSizeMultiplier={2} style={[styles.rowTimestamp, { color: colors.sub }]}>
              {inboxTimestamp(pod.lastMessageAt)}
            </Text>
          ) : null}
        </View>
        <Text
          maxFontSizeMultiplier={2}
          style={[
            styles.rowPreview,
            { color: colors.sub },
          ]}
          numberOfLines={1}
        >
          {pod.lastMessagePreview
            ? `${pod.lastMessageSenderName ? `${pod.lastMessageSenderName}: ` : ''}${pod.lastMessagePreview}`
            : unread > 0
              ? `${unread} new ${unread === 1 ? 'message' : 'messages'}`
              : `${formatDateTime(pod.meetupTime)} · ${pod.location}`}
        </Text>
      </View>
      <View style={styles.podRowEnd}>
        {unread ? (
          <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
            <Text maxFontSizeMultiplier={2} style={[styles.countBadgeLabel, { color: colors.onPrimary }]}>{unread}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={23} color={colors.ink} />
      </View>
    </Pressable>
  );
}

function PodChatCard({ pod, onPress }: { pod: InboxPodThread; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  const unread = pod.unreadCount ?? 0;
  const members = pod.members.map((member) => ({
    name: member.user.name,
    uri: member.user.avatarUrl,
  }));
  const title = getPodTitle(pod);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${title} chat${unread ? `, ${unread} unread` : ''}`}
      style={({ pressed }) => [
        styles.podCard,
        accessibilityLayout && styles.podCardAccessible,
        { backgroundColor: colors.violetSoft, borderColor: colors.violetSoft },
        pressed && { opacity: 0.72 },
      ]}
    >
      <Image
        source={activityImageFor(pod.activity)}
        resizeMode="cover"
        accessibilityLabel=""
        style={[
          styles.podCardImage,
          accessibilityLayout && styles.podCardImageAccessible,
        ]}
      />
      <View style={styles.podCardCopy}>
        <Text maxFontSizeMultiplier={2} style={styles.podCardTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={2} style={[styles.rowPreview, { color: colors.sub }]} numberOfLines={2}>
          {pod.lastMessagePreview
            ? `${pod.lastMessageSenderName ? `${pod.lastMessageSenderName}: ` : ''}${pod.lastMessagePreview}`
            : unread > 0
              ? `${unread} new ${unread === 1 ? 'message' : 'messages'}`
              : `${formatDateTime(pod.meetupTime)} · ${pod.location}`}
        </Text>
        {members.length ? (
          <AvatarStack names={members} size={34} max={5} style={styles.podCardStack} />
        ) : null}
      </View>
      <View style={styles.podCardEnd}>
        <Ionicons name="chevron-forward" size={23} color={colors.ink} />
      </View>
      {unread ? (
        <View style={[styles.podCardDot, { backgroundColor: colors.violet }]} />
      ) : null}
    </Pressable>
  );
}

function InviteSpotlightCard({
  invite,
  busy,
  onAccept,
  onDecline,
}: {
  invite: PodInvite;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const accessibilityLayout = fontScale >= 2;
  const title = invite.pod ? getPodTitle(invite.pod) : 'A pod';
  return (
    <View
      style={[
        styles.spotlightCard,
        accessibilityLayout && styles.spotlightCardAccessible,
        { backgroundColor: colors.amberSoft, borderColor: colors.amberSoft },
      ]}
    >
      <Image
        source={activityImageFor(invite.pod?.activity)}
        resizeMode="cover"
        accessibilityLabel=""
        style={[
          styles.spotlightImage,
          accessibilityLayout && styles.spotlightImageAccessible,
        ]}
      />
      <View style={styles.spotlightBody}>
        <View style={styles.spotlightTop}>
          <View style={styles.rowCopy}>
            <Text maxFontSizeMultiplier={2} style={styles.spotlightTitle} numberOfLines={2}>
              {title}
            </Text>
            <Text maxFontSizeMultiplier={2} style={[styles.rowPreview, { color: colors.sub }]} numberOfLines={2}>
              You&apos;ve been invited to join this community.
            </Text>
          </View>
          <View
            style={[
              styles.spotlightBadge,
              { backgroundColor: colors.violetSoft, borderColor: colors.violetSoft },
            ]}
          >
            <Ionicons name="people-outline" size={19} color={colors.violet} />
          </View>
        </View>
        <View style={styles.inviteButtons}>
          <MiniButton label="Decline" onPress={onDecline} disabled={busy} accent grow />
          <MiniButton label="Accept" onPress={onAccept} primary loading={busy} grow />
        </View>
      </View>
    </View>
  );
}

function InviteRow({
  invite,
  busy,
  onAccept,
  onDecline,
  showDivider,
}: {
  invite: PodInvite;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  showDivider: boolean;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View
      style={[
        styles.actionableRow,
        showDivider && { borderBottomWidth: BORDER_W, borderBottomColor: colors.borderSoft },
      ]}
    >
      <View style={[styles.inviteIcon, { backgroundColor: colors.violetSoft }]}>
        <Ionicons name="chatbubble-outline" size={24} color={colors.violet} />
      </View>
      <View style={styles.actionableCopy}>
        <Text maxFontSizeMultiplier={2} style={typography.captionSmall}>You're invited to join</Text>
        <Text maxFontSizeMultiplier={2} style={typography.heading} numberOfLines={2}>
          {invite.pod ? getPodTitle(invite.pod) : 'A pod'}
        </Text>
        <View style={styles.compactActions}>
          <MiniButton label="Decline" onPress={onDecline} disabled={busy} />
          <MiniButton label="Accept" onPress={onAccept} primary loading={busy} />
        </View>
      </View>
    </View>
  );
}

function FriendRequestRow({
  request,
  busy,
  onAccept,
  onDecline,
  onProfile,
  showDivider,
}: {
  request: FriendRequest;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onProfile?: (userId: string) => void;
  showDivider: boolean;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View
      style={[
        styles.actionableRow,
        showDivider && { borderBottomWidth: BORDER_W, borderBottomColor: colors.borderSoft },
      ]}
    >
      <Pressable
        disabled={!request.sender || !onProfile}
        onPress={() => request.sender && onProfile?.(request.senderId)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${request.sender?.name ?? 'friend request'} profile`}
        accessibilityState={{ disabled: !request.sender || !onProfile }}
      >
        <Avatar
          name={request.sender?.name ?? 'Friend request'}
          uri={request.sender?.avatarUrl}
          size={48}
        />
      </Pressable>
      <View style={styles.actionableCopy}>
        <Text maxFontSizeMultiplier={2} style={typography.heading} numberOfLines={2}>
          {request.sender?.name ?? 'Friend request'}
        </Text>
        <Text maxFontSizeMultiplier={2} style={typography.captionSmall}>Wants to connect with you</Text>
        <View style={styles.compactActions}>
          <MiniButton label="Decline" onPress={onDecline} disabled={busy} />
          <MiniButton label="Accept" onPress={onAccept} primary loading={busy} />
        </View>
      </View>
    </View>
  );
}

function SentRequestRow({
  request,
  busy,
  onCancel,
  onProfile,
  showDivider,
}: {
  request: FriendRequest;
  busy: boolean;
  onCancel: () => void;
  onProfile: (userId: string) => void;
  showDivider: boolean;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View
      style={[
        styles.inboxRow,
        showDivider && { borderBottomWidth: BORDER_W, borderBottomColor: colors.borderSoft },
      ]}
    >
      <Pressable
        disabled={!request.receiver}
        onPress={() => request.receiver && onProfile(request.receiverId)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${request.receiver?.name ?? 'pending request'} profile`}
        accessibilityState={{ disabled: !request.receiver }}
      >
        <Avatar
          name={request.receiver?.name ?? 'Pending request'}
          uri={request.receiver?.avatarUrl}
          size={48}
        />
      </Pressable>
      <View style={styles.rowCopy}>
        <Text maxFontSizeMultiplier={2} style={typography.heading} numberOfLines={2}>
          {request.receiver?.name ?? 'Pending request'}
        </Text>
        <Text maxFontSizeMultiplier={2} style={typography.captionSmall}>Request sent {relativeTime(request.createdAt)}</Text>
      </View>
      <MiniButton label="Cancel" onPress={onCancel} loading={busy} />
    </View>
  );
}

function PodInviteCard({
  invite,
  busy,
  onAccept,
  onDecline,
}: {
  invite: PodInvite;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onProfile?: (userId: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const memberCount = invite.pod?.members.length ?? 0;
  return (
    <View
      style={[
        styles.inviteCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.inviteCardTop}>
        <View style={[styles.inviteMark, { backgroundColor: colors.violet }]}>
          <Ionicons name="people-outline" size={32} color="#FFFFFF" />
        </View>
        <View style={styles.rowCopy}>
          <Text maxFontSizeMultiplier={2} style={[styles.inviteEyebrow, { color: colors.sub }]}>You're invited to join</Text>
          <Text maxFontSizeMultiplier={2} style={styles.inviteTitle} numberOfLines={2}>
            {invite.pod ? getPodTitle(invite.pod) : 'A pod'}
          </Text>
          <Text maxFontSizeMultiplier={2} style={[styles.inviteMeta, { color: colors.sub }]}>
            {memberCount
              ? `Pod  •  ${memberCount} ${memberCount === 1 ? 'member' : 'members'}`
              : `Pod invitation  •  ${relativeTime(invite.createdAt)}`}
          </Text>
        </View>
      </View>
      <View style={styles.inviteButtons}>
        <MiniButton label="Decline" onPress={onDecline} disabled={busy} grow />
        <MiniButton label="Accept" onPress={onAccept} primary loading={busy} grow />
      </View>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  primary,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  primary?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: primary ? colors.primary : colors.surface,
          borderColor: primary ? colors.primary : colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text maxFontSizeMultiplier={2} style={[typography.button, { color: primary ? colors.onPrimary : colors.ink }]}>
        {label}
      </Text>
      <Ionicons
        name={icon}
        size={20}
        color={primary ? colors.onPrimary : colors.ink}
      />
    </Pressable>
  );
}

function MiniButton({
  label,
  primary,
  accent,
  loading,
  disabled,
  grow,
  onPress,
}: {
  label: string;
  primary?: boolean;
  /** Outlined counterpart to `primary`: scarlet border and label on a plain surface. */
  accent?: boolean;
  loading?: boolean;
  disabled?: boolean;
  grow?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const label_ = primary
    ? colors.onPrimary
    : accent
      ? colors.accentText
      : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.miniButton,
        grow && styles.grow,
        grow && styles.inviteButton,
        {
          backgroundColor: primary ? colors.primary : colors.surface,
          borderColor: primary ? colors.primary : accent ? colors.accentText : colors.border,
          opacity: disabled || pressed ? 0.55 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={label_} />
      ) : (
        <Text maxFontSizeMultiplier={2} style={[typography.subheading, { color: label_ }]}>{label}</Text>
      )}
    </Pressable>
  );
}

function ActionRow({
  icon,
  tint,
  title,
  body,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: 'primary' | 'violet';
  title: string;
  body: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const color = tint === 'primary' ? colors.primary : colors.violet;
  const soft = tint === 'primary' ? colors.primarySoft : colors.violetSoft;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
      style={({ pressed }) => [
        styles.actionRow,
        { backgroundColor: soft, borderColor: color, opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <Ionicons name={icon} size={27} color={color} />
      <View style={styles.rowCopy}>
        <Text maxFontSizeMultiplier={2} style={typography.heading}>{title}</Text>
        <Text maxFontSizeMultiplier={2} style={typography.caption}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.ink} />
    </Pressable>
  );
}

function SharePanel({ onShare }: { onShare: () => void }) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  return (
    <View
      style={[
        styles.sharePanel,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.shareIcon, { backgroundColor: colors.violetSoft }]}>
        <Ionicons name="link-outline" size={22} color={colors.violet} />
      </View>
      <View style={styles.rowCopy}>
        <Text maxFontSizeMultiplier={2} style={typography.heading}>Share your link</Text>
        <Text maxFontSizeMultiplier={2} style={typography.caption}>Let friends jump straight to your Oval profile.</Text>
      </View>
      <MiniButton label="Share" onPress={onShare} />
    </View>
  );
}

function ProfileSharePanel({
  url,
  onShare,
  onCopy,
}: {
  url: string;
  onShare: () => void;
  onCopy: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const visibleUrl = url.replace(/^https?:\/\/(www\.)?/, '');
  return (
    <View
      style={[
        styles.profileSharePanel,
        { backgroundColor: colors.violetSoft, borderColor: colors.violet },
      ]}
    >
      <View style={styles.profileShareTop}>
        <View style={[styles.shareIcon, { backgroundColor: colors.surface }]}>
          <Ionicons name="link-outline" size={22} color={colors.violet} />
        </View>
        <View style={styles.rowCopy}>
          <Text maxFontSizeMultiplier={2} style={styles.profileShareTitle}>Bring someone into your circle</Text>
          <Text maxFontSizeMultiplier={2} style={[styles.profileShareBody, { color: colors.sub }]}>
            Share a link that opens your profile in Oval.
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onCopy}
        accessibilityRole="button"
        accessibilityLabel="Copy profile link"
        style={({ pressed }) => [
          styles.profileLinkField,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && { opacity: 0.65 },
        ]}
      >
        <Text maxFontSizeMultiplier={2} style={[styles.profileLinkText, { color: colors.ink }]} numberOfLines={2}>
          {visibleUrl}
        </Text>
        <Ionicons name="copy-outline" size={19} color={colors.violet} />
      </Pressable>
      <ActionButton label="Share my profile" icon="share-outline" primary onPress={onShare} />
    </View>
  );
}

function PeopleStrip({
  title,
  friends,
  onContact,
  onFindPeople,
}: {
  title: string;
  friends: FriendUser[];
  onContact: (friend: FriendUser) => void;
  onFindPeople: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <InboxSectionHeader title={title} />
      <View style={styles.peopleStrip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.peopleStripList}
        >
          {friends.slice(0, 7).map((friend) => (
            <Pressable
              key={friend.id}
              onPress={() => onContact(friend)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${friend.name}'s profile`}
              style={({ pressed }) => [styles.peopleStripPerson, pressed && { opacity: 0.6 }]}
            >
              <Avatar name={friend.name} uri={friend.avatarUrl} size={58} />
              <Text maxFontSizeMultiplier={2} style={styles.peopleStripName} numberOfLines={2}>
                {friend.firstName ?? friend.name.split(' ')[0]}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onFindPeople}
            accessibilityRole="button"
            accessibilityLabel="Find more people"
            style={({ pressed }) => [styles.peopleStripPerson, pressed && { opacity: 0.6 }]}
          >
            <View
              style={[
                styles.addPersonButton,
                { backgroundColor: colors.surface, borderColor: colors.primary },
              ]}
            >
              <Ionicons name="add" size={28} color={colors.primary} />
            </View>
            <Text maxFontSizeMultiplier={2} style={styles.peopleStripName} numberOfLines={2}>
              Find
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

function FeaturedThread({
  thread,
  onPress,
}: {
  thread: DirectMessageThread;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const preview = thread.lastMessage?.content ?? 'Start the conversation';
  return (
    <View style={styles.section}>
      <InboxSectionHeader title="Pick up where you left off" />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open conversation with ${thread.otherUser.name}`}
        style={({ pressed }) => [
          styles.featuredThread,
          { backgroundColor: colors.amberSoft, borderColor: colors.amber },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Avatar name={thread.otherUser.name} uri={thread.otherUser.avatarUrl} size={68} />
        <View style={styles.rowCopy}>
          <Text maxFontSizeMultiplier={2} style={styles.featuredThreadName} numberOfLines={2}>
            {thread.otherUser.name}
          </Text>
          <Text maxFontSizeMultiplier={2} style={[styles.featuredThreadPreview, { color: colors.sub }]} numberOfLines={2}>
            {preview}
          </Text>
          <Text maxFontSizeMultiplier={2} style={[styles.featuredThreadTime, { color: colors.accentText }]}>
            {inboxTimestamp(thread.lastMessage?.createdAt ?? thread.updatedAt)}
          </Text>
        </View>
        {thread.hasUnread ? (
          <View style={[styles.featuredUnread, { backgroundColor: colors.primary }]} />
        ) : null}
        <Ionicons name="chevron-forward" size={23} color={colors.ink} />
      </Pressable>
    </View>
  );
}

function ExplorePodsCallout({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Explore more pods"
      style={({ pressed }) => [
        styles.exploreCallout,
        { backgroundColor: colors.primarySoft, borderColor: colors.primary },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.exploreCalloutIcon, { backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={24} color={colors.primary} />
      </View>
      <View style={styles.rowCopy}>
        <Text maxFontSizeMultiplier={2} style={styles.exploreCalloutTitle}>Find another pod</Text>
        <Text maxFontSizeMultiplier={2} style={[styles.exploreCalloutBody, { color: colors.sub }]}>
          Browse plans forming now.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.ink} />
    </Pressable>
  );
}

function ExplainerLine({
  icon,
  color,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
}) {
  const styles = useStyles();
  const { typography } = useTheme();
  return (
    <View style={styles.explainerLine}>
      <Ionicons name={icon} size={17} color={color} />
      <Text maxFontSizeMultiplier={2} style={typography.caption}>{label}</Text>
    </View>
  );
}

function ContactStrip({
  friends,
  onContact,
}: {
  friends: FriendUser[];
  onContact: (friend: FriendUser) => void;
}) {
  const styles = useStyles();
  const { typography } = useTheme();
  if (!friends.length) return null;
  return (
    <View style={styles.contacts}>
      <Text maxFontSizeMultiplier={2} style={typography.title}>Recent contacts</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.contactList}
      >
        {friends.slice(0, 8).map((friend) => (
          <Pressable
            key={friend.id}
            onPress={() => onContact(friend)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${friend.name}'s profile`}
            style={({ pressed }) => [styles.contact, pressed && { opacity: 0.6 }]}
          >
            <Avatar name={friend.name} uri={friend.avatarUrl} size={52} />
            <Text maxFontSizeMultiplier={2} style={typography.captionSmall} numberOfLines={2}>
              {friend.firstName ?? friend.name.split(' ')[0]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    gap: spacing.xl,
  },
  masthead: {
    minHeight: 54,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  pageTitle: {
    color: t.colors.ink,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '800' as const,
    letterSpacing: -1.1,
  },
  composeButton: {
    width: 44,
    height: 44,
    borderRadius: 21,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tabs: {
    height: 44,
    padding: 2,
    borderWidth: BORDER_W,
    borderRadius: radii.pill,
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
  },
  tabsAccessible: {
    height: 'auto' as const,
    minHeight: 104,
    flexWrap: 'wrap' as const,
  },
  tab: {
    flex: 1,
    borderRadius: radii.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
  },
  tabAccessible: {
    flex: 0,
    width: '50%' as const,
    minHeight: 50,
  },
  tabLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
    letterSpacing: -0.15,
  },
  warning: {
    gap: spacing.sm,
  },
  sections: {
    gap: spacing.xxl,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 2,
  },
  sectionHeaderAccessible: {
    flexDirection: 'column' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: t.colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700' as const,
    letterSpacing: -0.25,
  },
  seeAll: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  listGroup: {
    borderWidth: BORDER_W,
    borderRadius: radii.lg,
    overflow: 'hidden' as const,
    ...elevation.card,
    shadowColor: t.colors.shadow,
  },
  standaloneList: {
    borderWidth: BORDER_W,
    borderColor: t.colors.border,
    borderRadius: radii.lg,
    backgroundColor: t.colors.surface,
    overflow: 'hidden' as const,
    ...elevation.card,
    shadowColor: t.colors.shadow,
  },
  inboxRow: {
    minHeight: 82,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
  },
  inboxRowDetailed: {
    minHeight: 92,
    paddingVertical: 14,
    alignItems: 'flex-start' as const,
  },
  threadRowEnd: {
    alignItems: 'flex-end' as const,
    gap: spacing.sm,
  },
  threadRowIndicators: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
  },
  actionableRow: {
    minHeight: 94,
    padding: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  actionableCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  rowTitle: {
    color: t.colors.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700' as const,
    letterSpacing: -0.25,
  },
  rowTimestamp: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  podRowTitle: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.4,
  },
  rowPreview: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    letterSpacing: -0.1,
  },
  unreadDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  loopBanner: {
    minHeight: 128,
    borderWidth: BORDER_W,
    borderRadius: radii.lg,
    overflow: 'hidden' as const,
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
  },
  loopBannerAccessible: {
    flexDirection: 'column' as const,
  },
  loopBannerCopy: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.lg,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    justifyContent: 'center' as const,
    gap: 6,
  },
  loopBannerTitle: {
    color: t.colors.ink,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  loopBannerBody: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '400' as const,
    letterSpacing: -0.1,
  },
  loopBannerPill: {
    marginTop: 6,
    alignSelf: 'flex-start' as const,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderWidth: BORDER_W,
    borderRadius: radii.pill,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  loopBannerPillLabel: {
    color: t.colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  loopBannerImage: {
    width: '46%' as const,
    height: '100%' as const,
  },
  podCard: {
    minHeight: 124,
    borderWidth: BORDER_W,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    overflow: 'hidden' as const,
  },
  podCardAccessible: {
    flexDirection: 'column' as const,
    alignItems: 'stretch' as const,
  },
  podCardImage: {
    width: 116,
    height: 100,
    borderRadius: radii.sm,
  },
  podCardImageAccessible: {
    width: '100%' as const,
    height: 160,
  },
  podCardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  podCardTitle: {
    color: t.colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.35,
  },
  podCardStack: {
    marginTop: 3,
  },
  podCardEnd: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  podCardDot: {
    position: 'absolute' as const,
    top: 14,
    right: 14,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  spotlightCard: {
    borderWidth: BORDER_W,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    gap: 14,
    overflow: 'hidden' as const,
  },
  spotlightCardAccessible: {
    flexDirection: 'column' as const,
  },
  spotlightImage: {
    width: 116,
    alignSelf: 'stretch' as const,
    minHeight: 124,
    borderRadius: radii.sm,
  },
  spotlightImageAccessible: {
    width: '100%' as const,
    height: 160,
    alignSelf: 'auto' as const,
  },
  spotlightBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between' as const,
    gap: spacing.md,
  },
  spotlightTop: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.sm,
  },
  spotlightTitle: {
    color: t.colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.35,
  },
  spotlightBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  podAvatar: {
    width: 78,
    height: 58,
    borderRadius: 29,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  podRowEnd: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
  },
  countBadge: {
    // Intrinsic height so the count can reach 200% Dynamic Type without
    // clipping; the pill radius holds the shape at any size.
    minWidth: 24,
    minHeight: 24,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  countBadgeLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800' as const,
  },
  inviteIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  compactActions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  miniButton: {
    minWidth: 82,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  grow: {
    flex: 1,
  },
  inviteButton: {
    minHeight: 44,
  },
  inviteCard: {
    borderWidth: BORDER_W,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: 14,
    ...elevation.card,
    shadowColor: t.colors.shadow,
  },
  inviteCardTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.lg,
  },
  inviteMark: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  inviteEyebrow: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  inviteTitle: {
    color: t.colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700' as const,
    letterSpacing: -0.25,
  },
  inviteMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  inviteDetails: {
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    padding: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  inviteButtons: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  movingPanel: {
    borderWidth: BORDER_W,
    borderRadius: radii.lg,
    padding: 14,
    gap: spacing.sm,
  },
  movingTitle: {
    color: t.colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700' as const,
    letterSpacing: -0.25,
  },
  movingActions: {
    minHeight: 76,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    overflow: 'hidden' as const,
  },
  movingActionsAccessible: {
    flexDirection: 'column' as const,
  },
  movingAction: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: spacing.sm,
  },
  movingCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  movingActionTitle: {
    color: t.colors.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  movingActionBody: {
    color: t.colors.sub,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '400' as const,
  },
  movingDivider: {
    width: BORDER_W,
    marginVertical: spacing.sm,
  },
  movingDividerAccessible: {
    width: '100%' as const,
    height: BORDER_W,
    marginVertical: 0,
  },
  landing: {
    gap: spacing.xl,
    paddingBottom: spacing.lg,
  },
  focusedEmpty: {
    gap: spacing.xl,
    paddingBottom: spacing.lg,
  },
  heroImage: {
    width: '100%' as const,
    height: 205,
    marginTop: -4,
  },
  focusedEmptyImage: {
    width: '100%' as const,
    height: 190,
    marginTop: -6,
  },
  heroCopy: {
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  heroTitle: {
    color: t.colors.ink,
    textAlign: 'center' as const,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.7,
  },
  heroBody: {
    maxWidth: 330,
    textAlign: 'center' as const,
    color: t.colors.sub,
  },
  primaryActions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  primaryActionsAccessible: {
    flexDirection: 'column' as const,
  },
  actionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.button,
    borderWidth: BORDER_W,
    paddingHorizontal: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
  },
  sharePanel: {
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  shareIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  profileSharePanel: {
    borderWidth: BORDER_W,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  profileShareTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  profileShareTitle: {
    color: t.colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  profileShareBody: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  profileLinkField: {
    minHeight: 48,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  profileLinkText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  peopleStrip: {
    paddingVertical: spacing.xs,
    overflow: 'hidden' as const,
  },
  peopleStripList: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  peopleStripPerson: {
    width: 62,
    alignItems: 'center' as const,
    gap: 7,
  },
  peopleStripName: {
    width: 62,
    color: t.colors.ink,
    textAlign: 'center' as const,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700' as const,
  },
  addPersonButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  featuredThread: {
    minHeight: 116,
    borderWidth: BORDER_W,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    overflow: 'hidden' as const,
  },
  featuredThreadName: {
    color: t.colors.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  featuredThreadPreview: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '400' as const,
  },
  featuredThreadTime: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700' as const,
  },
  featuredUnread: {
    position: 'absolute' as const,
    top: 14,
    right: 14,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  exploreCallout: {
    minHeight: 82,
    borderWidth: BORDER_W,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  exploreCalloutIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  exploreCalloutTitle: {
    color: t.colors.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800' as const,
    letterSpacing: -0.25,
  },
  exploreCalloutBody: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  explainerGrid: {
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    gap: spacing.md,
  },
  explainerGridAccessible: {
    flexDirection: 'column' as const,
  },
  explainerCard: {
    flex: 1.15,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  loopCard: {
    flex: 0.85,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  explainerLine: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  actionRow: {
    minHeight: 82,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  contacts: {
    gap: spacing.md,
  },
  contactList: {
    gap: spacing.lg,
    paddingHorizontal: 2,
  },
  contact: {
    width: 58,
    alignItems: 'center' as const,
    gap: 6,
  },
  skeletonGroup: {
    minHeight: 76,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: t.colors.surface,
    borderColor: t.colors.border,
    borderWidth: BORDER_W,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
}));
