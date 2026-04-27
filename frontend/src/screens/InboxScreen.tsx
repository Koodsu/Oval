import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  acceptFriendRequest,
  acceptPodInvite,
  API_USER_MESSAGE,
  declineFriendRequest,
  declinePodInvite,
  getFriendRequests,
  getMessageThreads,
  getPodInvites,
} from '../api';
import { RootStackParamList } from '../../App';
import { DirectMessageThread, FriendRequest, PodInvite } from '../types';
import { CompactHeader, EmptyState, Panel, PrimaryButton, Screen, SegmentedControl, UserAvatar } from '../components/ui';
import { formatDateTime } from '../utils/format';
import { radii, spacing, typography, palette } from '../theme';

type Mode = 'messages' | 'invites' | 'friends';
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function InboxScreen() {
  const navigation = useNavigation<Nav>();
  const [mode, setMode] = useState<Mode>('messages');
  const [threads, setThreads] = useState<DirectMessageThread[]>([]);
  const [invites, setInvites] = useState<PodInvite[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);

  const load = useCallback(async () => {
    const [threadResult, inviteResult, requestResult] = await Promise.allSettled([
      getMessageThreads(),
      getPodInvites(),
      getFriendRequests(),
    ]);

    if (threadResult.status === 'fulfilled') {
      setThreads(threadResult.value);
    }

    if (inviteResult.status === 'fulfilled') {
      setInvites(inviteResult.value);
    }

    if (requestResult.status === 'fulfilled') {
      setRequests(requestResult.value.incoming);
    }

    if (
      threadResult.status === 'rejected' &&
      inviteResult.status === 'rejected' &&
      requestResult.status === 'rejected'
    ) {
      Alert.alert('Could not load inbox', API_USER_MESSAGE);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleInvite = async (inviteId: string, accept: boolean) => {
    try {
      if (accept) {
        await acceptPodInvite(inviteId);
      } else {
        await declinePodInvite(inviteId);
      }
      await load();
    } catch {
      Alert.alert('Could not update invite', API_USER_MESSAGE);
    }
  };

  const handleRequest = async (requestId: string, accept: boolean) => {
    try {
      if (accept) {
        await acceptFriendRequest(requestId);
      } else {
        await declineFriendRequest(requestId);
      }
      await load();
    } catch {
      Alert.alert('Could not update request', API_USER_MESSAGE);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CompactHeader
          eyebrow="Inbox"
          title="Stay in the loop."
          subtitle="Your messages, pod invites, and friend requests — all in one place."
        >
          <View style={styles.headerAction}>
            <PrimaryButton label="Find people" onPress={() => navigation.navigate('UserSearch')} kind="ghost" />
          </View>
        </CompactHeader>

        <SegmentedControl
          value={mode}
          options={[
            { value: 'messages', label: 'Messages' },
            { value: 'invites', label: 'Pod invites' },
            { value: 'friends', label: 'Friend requests' },
          ]}
          onChange={setMode}
        />

        {mode === 'messages' ? (
          <View style={styles.section}>
            {threads.length ? threads.map((thread) => (
              <TouchableOpacity
                key={thread.id}
                style={styles.row}
                onPress={() => navigation.navigate('Thread', { threadId: thread.id, title: thread.otherUser.name })}
              >
                <UserAvatar name={thread.otherUser.name} avatarUrl={thread.otherUser.avatarUrl} />
                <View style={styles.copy}>
                  <Text style={styles.title}>{thread.otherUser.name}</Text>
                  <Text style={styles.body} numberOfLines={2}>{thread.lastMessage?.content ?? 'No messages yet'}</Text>
                </View>
              </TouchableOpacity>
            )) : <EmptyState icon="mail-open-outline" title="No messages yet" body="New DMs will land here once you start connecting through pods and profiles." />}
          </View>
        ) : null}

        {mode === 'invites' ? (
          <View style={styles.section}>
            {invites.length ? invites.map((invite) => (
              <Panel key={invite.id}>
                <Text style={styles.title}>{invite.pod?.activity.title ?? 'Pod invite'}</Text>
                <Text style={styles.body}>From {invite.sender?.name ?? 'Someone'} • {formatDateTime(invite.createdAt)}</Text>
                <View style={styles.buttonRow}>
                  <PrimaryButton label="Accept" onPress={() => void handleInvite(invite.id, true)} />
                  <PrimaryButton label="Decline" onPress={() => void handleInvite(invite.id, false)} kind="ghost" />
                </View>
              </Panel>
            )) : <EmptyState icon="paper-plane-outline" title="No invites waiting" body="When pod creators invite you into something, it’ll show up here." />}
          </View>
        ) : null}

        {mode === 'friends' ? (
          <View style={styles.section}>
            {requests.length ? requests.map((request) => (
              <Panel key={request.id}>
                <Text style={styles.title}>{request.sender?.name ?? 'Friend request'}</Text>
                <Text style={styles.body}>Sent {formatDateTime(request.createdAt)}</Text>
                <View style={styles.buttonRow}>
                  <PrimaryButton label="Accept" onPress={() => void handleRequest(request.id, true)} />
                  <PrimaryButton label="Decline" onPress={() => void handleRequest(request.id, false)} kind="ghost" />
                </View>
              </Panel>
            )) : <EmptyState icon="person-add-outline" title="No requests" body="Friend activity will show up here once people start connecting after meetups." />}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  headerAction: {
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
