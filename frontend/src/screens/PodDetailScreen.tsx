import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  addPodMessageReaction,
  API_USER_MESSAGE,
  confirmAttendance,
  getFriends,
  getMessages,
  getPeopleYouMet,
  getPod,
  getPodShareUrl,
  joinPod,
  joinWaitlist,
  leavePod,
  leaveWaitlist,
  lockPod,
  removePodMessageReaction,
  reportNoShow,
  sendFriendRequest,
  sendMessage,
  sendPodInvite,
  sendPodTyping,
  submitRecap,
  unlockPod,
} from '../api';
import { RootStackParamList } from '../../App';
import { FriendUser, Message, PeopleYouMetUser, Pod } from '../types';
import { Chip, EmptyState, Hero, Panel, PrimaryButton, Screen, ScreenHeader, SectionHeader, UserAvatar } from '../components/ui';
import { palette, radii, spacing, typography } from '../theme';
import { formatDateTime } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { INTEREST_TAG_META } from '../constants/interestTags';

type Props = NativeStackScreenProps<RootStackParamList, 'PodDetail'>;

const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢'] as const;

export default function PodDetailScreen({ route, navigation }: Props) {
  const { podId } = route.params;
  const { user } = useAuth();
  const [pod, setPod] = useState<Pod | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [peopleYouMet, setPeopleYouMet] = useState<PeopleYouMetUser[]>([]);
  const [messageText, setMessageText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (showAlert = true) => {
    try {
      const podResponse = await getPod(podId);
      const isMember = podResponse.members.some((member) => member.userId === user?.id);
      const myMember = podResponse.members.find((member) => member.userId === user?.id);

      const messageResponse = isMember
        ? await getMessages(podId).catch(() => ({ messages: [], typingUserIds: [] }))
        : { messages: [], typingUserIds: [] };

      const friendList = isMember ? await getFriends().catch(() => []) : [];
      const metUsers =
        podResponse.status === 'COMPLETED' && !!myMember?.confirmedAt
          ? await getPeopleYouMet(podId).then((response) => response.users).catch(() => [])
          : [];

      setPod(podResponse);
      setMessages(messageResponse.messages);
      setTypingUserIds(messageResponse.typingUserIds);
      setFriends(friendList);
      setPeopleYouMet(metUsers);
      setLoadError(null);
    } catch {
      setLoadError(API_USER_MESSAGE);
      if (showAlert) {
        Alert.alert('Could not load pod', API_USER_MESSAGE);
      }
    }
  }, [podId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const interval = setInterval(() => {
        void load(false);
      }, 3500);
      return () => {
        clearInterval(interval);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      };
    }, [load])
  );

  const pingTyping = useCallback(() => {
    if (!messageText.trim()) return;
    if (typingTimerRef.current) return;
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 2500);
    void sendPodTyping(podId).catch(() => {});
  }, [messageText, podId]);

  const meInPod = pod?.members.some((member) => member.userId === user?.id) ?? false;
  const myMember = pod?.members.find((member) => member.userId === user?.id) ?? null;
  const isCreator = pod?.creator?.id === user?.id || pod?.creatorId === user?.id;
  const eligibleInviteFriends = useMemo(() => {
    if (!pod) return [];
    const memberIds = new Set(pod.members.map((member) => member.userId));
    return friends.filter((friend) => !memberIds.has(friend.id)).slice(0, 6);
  }, [friends, pod]);

  const handlePrimaryAction = async () => {
    if (!pod) return;
    setActionBusy('primary');
    try {
      if (!meInPod) {
        if (pod.members.length >= pod.maxMembers) {
          await joinWaitlist(pod.id);
        } else {
          await joinPod(pod.id);
        }
      } else {
        await leavePod(pod.id);
      }
      await load(false);
    } catch {
      Alert.alert('Action failed', API_USER_MESSAGE);
    } finally {
      setActionBusy(null);
    }
  };

  const handleLeaveWaitlist = async () => {
    if (!pod) return;
    setActionBusy('waitlist');
    try {
      await leaveWaitlist(pod.id);
      await load(false);
    } catch {
      Alert.alert('Could not leave waitlist', API_USER_MESSAGE);
    } finally {
      setActionBusy(null);
    }
  };

  const handleLockToggle = async () => {
    if (!pod) return;
    setActionBusy('lock');
    try {
      const updated = await (pod.status === 'LOCKED' ? unlockPod(pod.id) : lockPod(pod.id));
      setPod(updated);
    } catch {
      Alert.alert('Could not update pod', API_USER_MESSAGE);
    } finally {
      setActionBusy(null);
    }
  };

  const handleConfirmAttendance = async () => {
    if (!pod) return;
    setActionBusy('confirm');
    try {
      await confirmAttendance(pod.id);
      await load(false);
    } catch {
      Alert.alert('Could not confirm attendance', API_USER_MESSAGE);
    } finally {
      setActionBusy(null);
    }
  };

  const handleSend = async () => {
    if (!messageText.trim()) return;
    setSending(true);
    try {
      const sent = await sendMessage(podId, messageText.trim(), replyTo?.id);
      setMessageText('');
      setReplyTo(null);
      setMessages((current) => [...current, sent]);
    } catch {
      Alert.alert('Could not send message', API_USER_MESSAGE);
    } finally {
      setSending(false);
    }
  };

  const handleReaction = async (message: Message, emoji: string) => {
    const hasReaction = !!message.reactions?.some(
      (reaction) => reaction.userId === user?.id && reaction.emoji === emoji
    );
    try {
      const updated = hasReaction
        ? await removePodMessageReaction(podId, message.id, emoji)
        : await addPodMessageReaction(podId, message.id, emoji);
      setMessages((current) => current.map((item) => (item.id === message.id ? updated : item)));
    } catch {
      Alert.alert('Could not update reaction', API_USER_MESSAGE);
    }
  };

  const handleRecap = async (rating: 1 | 2 | 3) => {
    if (!pod) return;
    setActionBusy('recap');
    try {
      await submitRecap(pod.id, { rating });
      await load(false);
    } catch {
      Alert.alert('Could not submit recap', API_USER_MESSAGE);
    } finally {
      setActionBusy(null);
    }
  };

  const handleShare = async () => {
    if (!pod) return;
    try {
      await Share.share({
        title: `Join my ${pod.activity?.title ?? 'Bridge'} pod`,
        message: `Join my ${pod.activity?.title ?? 'Bridge'} pod on Bridge: ${getPodShareUrl(pod.id)}`,
        url: getPodShareUrl(pod.id),
      });
    } catch {
      Alert.alert('Could not open share sheet', API_USER_MESSAGE);
    }
  };

  const handleInviteFriend = async (friend: FriendUser) => {
    if (!pod) return;
    setActionBusy(`invite-${friend.id}`);
    try {
      await sendPodInvite(pod.id, friend.id);
      Alert.alert('Invite sent', `${friend.name} will see it in their inbox.`);
    } catch {
      Alert.alert('Could not send invite', API_USER_MESSAGE);
    } finally {
      setActionBusy(null);
    }
  };

  const handleConnect = async (person: PeopleYouMetUser) => {
    setActionBusy(`met-${person.id}`);
    try {
      await sendFriendRequest(person.id);
      setPeopleYouMet((current) => current.filter((entry) => entry.id !== person.id));
      Alert.alert('Request sent', `${person.name} now has your friend request.`);
    } catch {
      Alert.alert('Could not send request', API_USER_MESSAGE);
    } finally {
      setActionBusy(null);
    }
  };

  const handleNoShow = async (userId: string) => {
    if (!pod) return;
    setActionBusy(`noshow-${userId}`);
    try {
      await reportNoShow(pod.id, userId);
      await load(false);
    } catch {
      Alert.alert('Could not report no-show', API_USER_MESSAGE);
    } finally {
      setActionBusy(null);
    }
  };

  if (!pod && loadError) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Pod" onBack={() => navigation.goBack()} />
          <EmptyState icon="alert-circle-outline" title="Could not load pod" body={loadError} />
          <PrimaryButton label="Try again" onPress={() => void load(false)} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {pod ? (
          <>
            <ScreenHeader
              title="Pod"
              onBack={() => navigation.goBack()}
              right={(
                <TouchableOpacity onPress={() => void handleShare()} style={styles.headerAction}>
                  <Ionicons name="share-outline" size={18} color={palette.ink} />
                </TouchableOpacity>
              )}
            />
            <Hero
              eyebrow={pod.status}
              title={pod.activity?.title ?? 'Pod detail'}
              subtitle={`${formatDateTime(pod.meetupTime)} • ${pod.location}`}
            >
              <View style={styles.heroActions}>
                <PrimaryButton
                  label={meInPod ? 'Leave pod' : pod.members.length >= pod.maxMembers ? 'Join waitlist' : 'Join pod'}
                  onPress={() => void handlePrimaryAction()}
                  loading={actionBusy === 'primary'}
                />
                <PrimaryButton label="Share invite link" onPress={() => void handleShare()} kind="ghost" />
                {isCreator ? (
                  <PrimaryButton
                    label={pod.status === 'LOCKED' ? 'Re-open pod' : 'Lock pod'}
                    onPress={() => void handleLockToggle()}
                    kind="ghost"
                    disabled={actionBusy != null}
                    loading={actionBusy === 'lock'}
                  />
                ) : null}
              </View>
            </Hero>

            {loadError ? (
              <Panel>
                <Text style={styles.errorText}>{loadError}</Text>
              </Panel>
            ) : null}

            {!meInPod && pod.myWaitlistPosition ? (
              <Panel>
                <Text style={styles.sectionTitle}>Waitlist status</Text>
                <Text style={styles.body}>
                  You are currently #{pod.myWaitlistPosition} in line for this pod.
                </Text>
                <View style={styles.inlineAction}>
                  <PrimaryButton label="Leave waitlist" onPress={() => void handleLeaveWaitlist()} loading={actionBusy === 'waitlist'} kind="ghost" />
                </View>
              </Panel>
            ) : null}

            {meInPod && pod.status === 'LOCKED' ? (
              <Panel>
                <Text style={styles.sectionTitle}>Attendance</Text>
                <Text style={styles.body}>
                  {myMember?.confirmedAt
                    ? 'You already confirmed you are showing up for this locked pod.'
                    : 'Locking means the group is committed. Confirm once you know you are going.'}
                </Text>
                {!myMember?.confirmedAt ? (
                  <View style={styles.inlineAction}>
                    <PrimaryButton label="Confirm attendance" onPress={() => void handleConfirmAttendance()} loading={actionBusy === 'confirm'} />
                  </View>
                ) : null}
              </Panel>
            ) : null}

            <Panel>
              <Text style={styles.sectionTitle}>People in the pod</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {pod.members.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.member}
                    onPress={() => navigation.navigate('UserProfile', { userId: member.userId })}
                  >
                    <UserAvatar name={member.user.name} avatarUrl={member.user.avatarUrl} />
                    <Text style={styles.memberName}>{member.user.name}</Text>
                    {member.confirmedAt ? <Text style={styles.memberMeta}>Confirmed</Text> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Panel>

            {meInPod && pod.status === 'FORMING' && eligibleInviteFriends.length ? (
              <Panel>
                <SectionHeader title="Invite friends" actionLabel="Open share" onActionPress={() => void handleShare()} />
                <Text style={styles.body}>Use direct pod invites for friends you already know, or share the public link more broadly.</Text>
                <View style={styles.inviteList}>
                  {eligibleInviteFriends.map((friend) => (
                    <View key={friend.id} style={styles.inviteRow}>
                      <TouchableOpacity
                        style={styles.inviteIdentity}
                        onPress={() => navigation.navigate('UserProfile', { userId: friend.id })}
                      >
                        <UserAvatar name={friend.name} avatarUrl={friend.avatarUrl} />
                        <Text style={styles.memberName}>{friend.name}</Text>
                      </TouchableOpacity>
                      <PrimaryButton
                        label="Invite"
                        onPress={() => void handleInviteFriend(friend)}
                        loading={actionBusy === `invite-${friend.id}`}
                        kind="ghost"
                      />
                    </View>
                  ))}
                </View>
              </Panel>
            ) : null}

            {pod.latitude != null && pod.longitude != null ? (
              <Panel style={styles.mapPanel}>
                <Text style={styles.sectionTitle}>Meetup point</Text>
                <MapView
                  provider={PROVIDER_DEFAULT}
                  style={styles.map}
                  initialRegion={{
                    latitude: pod.latitude,
                    longitude: pod.longitude,
                    latitudeDelta: 0.006,
                    longitudeDelta: 0.006,
                  }}
                >
                  <Marker coordinate={{ latitude: pod.latitude, longitude: pod.longitude }} />
                </MapView>
              </Panel>
            ) : null}

            {pod.status === 'COMPLETED' ? (
              <>
                <Panel>
                  <Text style={styles.sectionTitle}>Pod recap</Text>
                  <Text style={styles.body}>
                    {pod.averageRating != null
                      ? `Average member sentiment: ${pod.averageRating.toFixed(1)} / 3`
                      : 'No group rating yet.'}
                  </Text>
                  {pod.myRecap ? (
                    <Text style={styles.body}>Your recap is already in.</Text>
                  ) : (
                    <View style={styles.recapRow}>
                      <PrimaryButton label="Rough" onPress={() => void handleRecap(1)} kind="ghost" loading={actionBusy === 'recap'} />
                      <PrimaryButton label="Solid" onPress={() => void handleRecap(2)} kind="ghost" disabled={actionBusy === 'recap'} />
                      <PrimaryButton label="Great" onPress={() => void handleRecap(3)} disabled={actionBusy === 'recap'} />
                    </View>
                  )}
                </Panel>

                {peopleYouMet.length ? (
                  <Panel>
                    <Text style={styles.sectionTitle}>People you met</Text>
                    <Text style={styles.body}>Turn this pod into an actual relationship while the context is still fresh.</Text>
                    <View style={styles.metList}>
                      {peopleYouMet.map((person) => (
                        <View key={person.id} style={styles.metCard}>
                          <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: person.id })}>
                            <View style={styles.inviteIdentity}>
                              <UserAvatar name={person.name} avatarUrl={person.avatarUrl} />
                              <View style={styles.copy}>
                                <Text style={styles.memberName}>{person.name}</Text>
                                <Text style={styles.memberMeta}>
                                  {[person.major, person.classYear].filter(Boolean).join(' • ') || 'Student'}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                          {person.interestTags.length ? (
                            <View style={styles.chipWrap}>
                              {person.interestTags.slice(0, 3).map((tag) => (
                                <Chip key={tag} label={INTEREST_TAG_META[tag]?.label ?? tag} />
                              ))}
                            </View>
                          ) : null}
                          <View style={styles.inlineAction}>
                            <PrimaryButton
                              label="Add friend"
                              onPress={() => void handleConnect(person)}
                              loading={actionBusy === `met-${person.id}`}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  </Panel>
                ) : null}

                {meInPod ? (
                  <Panel>
                    <Text style={styles.sectionTitle}>No-show follow-up</Text>
                    <Text style={styles.body}>Only use this if someone committed to the pod and then did not show.</Text>
                    <View style={styles.metList}>
                      {pod.members
                        .filter((member) => member.userId !== user?.id && !pod.noShowUserIds?.includes(member.userId))
                        .map((member) => (
                          <View key={member.id} style={styles.inviteRow}>
                            <TouchableOpacity
                              style={styles.inviteIdentity}
                              onPress={() => navigation.navigate('UserProfile', { userId: member.userId })}
                            >
                              <UserAvatar name={member.user.name} avatarUrl={member.user.avatarUrl} />
                              <Text style={styles.memberName}>{member.user.name}</Text>
                            </TouchableOpacity>
                            <PrimaryButton
                              label="Report no-show"
                              onPress={() => void handleNoShow(member.userId)}
                              loading={actionBusy === `noshow-${member.userId}`}
                              kind="ghost"
                            />
                          </View>
                        ))}
                      {!pod.members.some((member) => member.userId !== user?.id && !pod.noShowUserIds?.includes(member.userId)) ? (
                        <Text style={styles.body}>No remaining members to report.</Text>
                      ) : null}
                    </View>
                  </Panel>
                ) : null}
              </>
            ) : null}

            {meInPod ? (
              <View style={styles.section}>
                <SectionHeader title="Conversation" />
                {messages.length ? messages.map((message) => (
                  <View key={message.id} style={[styles.messageRow, message.user.id === user?.id && styles.messageRowOwn]}>
                    {message.user.id !== user?.id ? (
                      <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: message.user.id })}>
                        <UserAvatar name={message.user.name} avatarUrl={message.user.avatarUrl} size={34} />
                      </TouchableOpacity>
                    ) : null}
                    <View style={styles.messageStack}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onLongPress={() => setReplyTo(message)}
                        onPress={() => navigation.navigate('UserProfile', { userId: message.user.id })}
                        style={[styles.messageBubble, message.user.id === user?.id ? styles.messageBubbleOwn : styles.messageBubbleOther]}
                      >
                        <Text style={[styles.messageName, message.user.id === user?.id && styles.messageNameOwn]}>
                          {message.user.id === user?.id ? 'You' : message.user.name}
                        </Text>
                        {message.replyTo ? (
                          <View style={styles.replyPreview}>
                            <Text style={styles.replyMeta}>Replying to {message.replyTo.user.name}</Text>
                            <Text style={styles.replyBody} numberOfLines={1}>{message.replyTo.content}</Text>
                          </View>
                        ) : null}
                        <Text style={[styles.messageBody, message.user.id === user?.id && styles.messageBodyOwn]}>{message.content}</Text>
                      </TouchableOpacity>
                      <View style={styles.reactionRow}>
                        {REACTION_OPTIONS.map((emoji) => {
                          const count = message.reactions?.filter((reaction) => reaction.emoji === emoji).length ?? 0;
                          const active = !!message.reactions?.some(
                            (reaction) => reaction.emoji === emoji && reaction.userId === user?.id
                          );
                          return (
                            <Chip
                              key={`${message.id}-${emoji}`}
                              label={count ? `${emoji} ${count}` : emoji}
                              active={active}
                              onPress={() => void handleReaction(message, emoji)}
                            />
                          );
                        })}
                      </View>
                    </View>
                    {message.user.id === user?.id ? <UserAvatar name={message.user.name} avatarUrl={message.user.avatarUrl} size={34} /> : null}
                  </View>
                )) : <EmptyState icon="chatbubble-outline" title="No messages yet" body="A quieter chat is fine, but this is where the pod should coordinate the actual meetup." />}
                {typingUserIds.length ? (
                  <Text style={styles.typingText}>Someone is typing...</Text>
                ) : null}
                <Panel>
                  {replyTo ? (
                    <View style={styles.replyComposer}>
                      <View style={styles.replyComposerCopy}>
                        <Text style={styles.replyMeta}>Replying to {replyTo.user.name}</Text>
                        <Text style={styles.replyBody} numberOfLines={1}>{replyTo.content}</Text>
                      </View>
                      <PrimaryButton label="Clear" onPress={() => setReplyTo(null)} kind="ghost" />
                    </View>
                  ) : null}
                  <TextInput
                    value={messageText}
                    onChangeText={(value) => {
                      setMessageText(value);
                      if (value.trim()) pingTyping();
                    }}
                    placeholder="Drop a location tweak, ETA, or quick note..."
                    placeholderTextColor={palette.slate}
                    style={styles.input}
                    multiline
                  />
                  <View style={styles.inputAction}>
                    <PrimaryButton label="Send" onPress={() => void handleSend()} loading={sending} />
                  </View>
                </Panel>
              </View>
            ) : (
              <EmptyState icon="lock-closed-outline" title="Join to open the chat" body="Pod conversation, recaps, and member coordination unlock once you join." />
            )}
          </>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={palette.scarlet} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  heroActions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.title,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
  },
  errorText: {
    ...typography.bodyStrong,
    color: palette.dangerText,
  },
  member: {
    marginRight: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    width: 82,
  },
  memberName: {
    ...typography.bodyStrong,
  },
  memberMeta: {
    ...typography.body,
    fontSize: 12,
    textAlign: 'center',
  },
  inviteList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  inviteIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  inlineAction: {
    marginTop: spacing.sm,
  },
  mapPanel: {
    gap: spacing.sm,
  },
  map: {
    height: 200,
    borderRadius: radii.lg,
  },
  recapRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  metList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  metCard: {
    borderRadius: radii.md,
    backgroundColor: palette.cream,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
    marginTop: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  messageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageStack: {
    maxWidth: '78%',
    gap: spacing.xs,
  },
  messageBubble: {
    borderRadius: 24,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 4,
    borderWidth: 1,
  },
  messageBubbleOwn: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
    borderBottomRightRadius: 8,
  },
  messageBubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: palette.border,
    borderBottomLeftRadius: 8,
  },
  messageName: {
    ...typography.bodyStrong,
    fontSize: 13,
  },
  messageNameOwn: {
    color: palette.white,
    textAlign: 'right',
  },
  messageBody: {
    ...typography.body,
    color: palette.ink,
  },
  messageBodyOwn: {
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'right',
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.xs,
  },
  replyPreview: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.45)',
    paddingLeft: spacing.sm,
    marginBottom: 2,
  },
  replyMeta: {
    ...typography.label,
    color: palette.scarlet,
  },
  replyBody: {
    ...typography.body,
    color: palette.slate,
  },
  typingText: {
    ...typography.body,
    color: palette.scarlet,
  },
  replyComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  replyComposerCopy: {
    flex: 1,
    gap: 2,
  },
  input: {
    minHeight: 80,
    borderRadius: radii.md,
    backgroundColor: palette.cream,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    ...typography.body,
    color: palette.ink,
    textAlignVertical: 'top',
  },
  inputAction: {
    marginTop: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
});
