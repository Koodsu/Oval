import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from '../components/CampusMap';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addPodMessageReaction,
  blockUser,
  confirmAttendance,
  createReport,
  getApiErrorMessage,
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
  updatePodPrivacy,
} from '../api';
import { RootStackParamList } from '../../App';
import { FriendUser, Message, PeopleYouMetUser, Pod } from '../types';
import {
  AppBackdrop,
  Avatar,
  Banner,
  Button,
  Card,
  EmptyState,
  IconButton,
  ScreenHeader,
  SectionHeader,
  SkeletonCard,
  Sticker,
  Tag,
} from '../components/ui';
import {
  BORDER_W,
  Theme,
  ThemeColors,
  createThemedStyles,
  fonts,
  radii,
  spacing,
  useTheme,
} from '../theme';
import { formatDateTime, formatTime } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { INTEREST_TAG_META } from '../constants/interestTags';

type Props = NativeStackScreenProps<RootStackParamList, 'PodDetail'>;

const HEART_EMOJI = '❤️';

const POD_STATUS_LABELS: Record<Pod['status'], string> = {
  FORMING: 'Open',
  LOCKED: 'Locked',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
};

function statusTint(status: Pod['status'], colors: ThemeColors) {
  switch (status) {
    case 'FORMING':
      return colors.successSoft;
    case 'LOCKED':
      return colors.warningSoft;
    case 'COMPLETED':
      return colors.blueSoft;
    default:
      return colors.surfaceAlt;
  }
}

export default function PodDetailScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
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
  const [detailsOpen, setDetailsOpen] = useState(true);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (showAlert = true) => {
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
            ? await getPeopleYouMet(podId)
                .then((response) => response.users)
                .catch(() => [])
            : [];

        setPod(podResponse);
        setMessages(messageResponse.messages);
        setTypingUserIds(messageResponse.typingUserIds);
        setFriends(friendList);
        setPeopleYouMet(metUsers);
        setLoadError(null);
      } catch (error) {
        setLoadError(getApiErrorMessage(error));
        if (showAlert) {
          Alert.alert('Could not load pod', getApiErrorMessage(error));
        }
      }
    },
    [podId, user?.id],
  );

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
    }, [load]),
  );

  const pingTyping = useCallback(
    (draft: string) => {
      if (!draft.trim()) return;
      if (typingTimerRef.current) return;
      typingTimerRef.current = setTimeout(() => {
        typingTimerRef.current = null;
      }, 2500);
      void sendPodTyping(podId).catch(() => {});
    },
    [podId],
  );

  const meInPod = pod?.members.some((member) => member.userId === user?.id) ?? false;
  const myMember = pod?.members.find((member) => member.userId === user?.id) ?? null;
  const isCreator = pod?.creator?.id === user?.id || pod?.creatorId === user?.id;
  const canJoinOrWaitlist = pod?.status === 'FORMING';
  const primaryActionLabel = meInPod
    ? 'Leave pod'
    : canJoinOrWaitlist
      ? pod && pod.members.length >= pod.maxMembers
        ? 'Join waitlist'
        : 'Join pod'
      : 'Pod closed';
  const eligibleInviteFriends = useMemo(() => {
    if (!pod) return [];
    const memberIds = new Set(pod.members.map((member) => member.userId));
    return friends.filter((friend) => !memberIds.has(friend.id)).slice(0, 6);
  }, [friends, pod]);

  const handlePrimaryAction = async () => {
    if (!pod) return;
    if (!meInPod && pod.status !== 'FORMING') {
      Alert.alert('Pod is not open', 'This pod is already locked, completed, or expired.');
      return;
    }
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
    } catch (error) {
      Alert.alert('Action failed', getApiErrorMessage(error));
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
    } catch (error) {
      Alert.alert('Could not leave waitlist', getApiErrorMessage(error));
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
    } catch (error) {
      Alert.alert('Could not update pod', getApiErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  };

  const handlePrivacyChange = async (visibility: 'public' | 'private') => {
    if (!pod || pod.locationType === visibility) return;
    setActionBusy('privacy');
    try {
      const updated = await updatePodPrivacy(pod.id, visibility);
      setPod(updated);
    } catch (error) {
      Alert.alert('Could not update privacy', getApiErrorMessage(error));
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
    } catch (error) {
      Alert.alert('Could not confirm attendance', getApiErrorMessage(error));
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
    } catch (error) {
      Alert.alert('Could not send message', getApiErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const handleHeart = async (message: Message) => {
    const hasHeart = !!message.reactions?.some(
      (reaction) => reaction.userId === user?.id && reaction.emoji === HEART_EMOJI,
    );
    try {
      const updated = hasHeart
        ? await removePodMessageReaction(podId, message.id, HEART_EMOJI)
        : await addPodMessageReaction(podId, message.id, HEART_EMOJI);
      setMessages((current) => current.map((item) => (item.id === message.id ? updated : item)));
    } catch (error) {
      Alert.alert('Could not update heart', getApiErrorMessage(error));
    }
  };

  const handleMessageSafetyAction = (message: Message) => {
    if (message.user.id === user?.id) {
      setReplyTo(message);
      return;
    }

    Alert.alert('Message safety', undefined, [
      {
        text: 'Report message',
        onPress: async () => {
          try {
            await createReport({
              podId,
              messageId: message.id,
              targetUserId: message.user.id,
              reason: 'HARASSMENT',
            });
            Alert.alert('Report sent', 'Thanks. We logged this pod message for review.');
          } catch (error) {
            Alert.alert('Could not send report', getApiErrorMessage(error));
          }
        },
      },
      {
        text: `Block ${message.user.name}`,
        style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(message.user.id);
            Alert.alert(
              'User blocked',
              'They can no longer message you. Shared pods are separated for safety.',
            );
            navigation.goBack();
          } catch (error) {
            Alert.alert('Could not block user', getApiErrorMessage(error));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRecap = async (rating: 1 | 2 | 3) => {
    if (!pod) return;
    setActionBusy('recap');
    try {
      await submitRecap(pod.id, { rating });
      await load(false);
    } catch (error) {
      Alert.alert('Could not submit recap', getApiErrorMessage(error));
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
    } catch (error) {
      Alert.alert('Could not open share sheet', getApiErrorMessage(error));
    }
  };

  const handleInviteFriend = async (friend: FriendUser) => {
    if (!pod) return;
    setActionBusy(`invite-${friend.id}`);
    try {
      await sendPodInvite(pod.id, friend.id);
      Alert.alert('Invite sent', `${friend.name} will see it in their inbox.`);
    } catch (error) {
      Alert.alert('Could not send invite', getApiErrorMessage(error));
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
    } catch (error) {
      Alert.alert('Could not send request', getApiErrorMessage(error));
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
    } catch (error) {
      Alert.alert('Could not report no-show', getApiErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  };

  if (!pod && loadError) {
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
          <ScreenHeader title="Pod" onBack={() => navigation.goBack()} />
          <EmptyState icon="alert-circle" title="Could not load pod" body={loadError} />
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
        {pod ? (
          <>
            <ScreenHeader
              title="Pod"
              kicker={pod.activity?.category}
              onBack={() => navigation.goBack()}
              right={
                <IconButton
                  icon="share-outline"
                  onPress={() => void handleShare()}
                  accessibilityLabel="Share pod"
                />
              }
            />

            {/* Header card */}
            <Card padded>
              <View style={styles.headerTop}>
                <Sticker
                  label={POD_STATUS_LABELS[pod.status]}
                  tint={statusTint(pod.status, colors)}
                  tilt={-2}
                />
                <View style={styles.countPill}>
                  <Ionicons name="people" size={14} color={colors.ink} />
                  <Text style={styles.countText}>
                    {pod.members.length}/{pod.maxMembers}
                  </Text>
                </View>
              </View>
              <Text style={styles.podTitle}>
                {(pod.activity?.title ?? 'Pod detail').toUpperCase()}
              </Text>
              <View style={styles.metaList}>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar" size={15} color={colors.sub} />
                  <Text style={typography.bodyMedium} numberOfLines={1}>
                    {formatDateTime(pod.meetupTime)}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="location" size={15} color={colors.sub} />
                  <Text style={typography.bodyMedium} numberOfLines={1}>
                    {pod.location}
                  </Text>
                </View>
              </View>
              <View style={styles.actionRow}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={primaryActionLabel}
                    onPress={() => void handlePrimaryAction()}
                    loading={actionBusy === 'primary'}
                    variant={meInPod || !canJoinOrWaitlist ? 'secondary' : 'primary'}
                  />
                </View>
                <IconButton
                  icon="link"
                  onPress={() => void handleShare()}
                  accessibilityLabel="Share pod link"
                  size={48}
                />
                {isCreator ? (
                  <IconButton
                    icon={pod.status === 'LOCKED' ? 'lock-open' : 'lock-closed'}
                    onPress={() => void handleLockToggle()}
                    disabled={actionBusy != null}
                    accessibilityLabel={pod.status === 'LOCKED' ? 'Unlock pod' : 'Lock pod'}
                    size={48}
                  />
                ) : null}
              </View>
            </Card>

            {loadError ? <Banner message={loadError} kind="error" /> : null}

            {!meInPod && pod.myWaitlistPosition ? (
              <Card padded>
                <Text style={typography.title}>Waitlist status</Text>
                <Text style={[typography.body, { marginTop: 6 }]}>
                  You are currently #{pod.myWaitlistPosition} in line for this pod.
                </Text>
                <Button
                  label="Leave waitlist"
                  onPress={() => void handleLeaveWaitlist()}
                  loading={actionBusy === 'waitlist'}
                  variant="secondary"
                  style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
                />
              </Card>
            ) : null}

            {meInPod && pod.status === 'LOCKED' ? (
              <View
                style={[
                  styles.confirmNotice,
                  { backgroundColor: colors.warningSoft, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name={myMember?.confirmedAt ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={myMember?.confirmedAt ? colors.success : colors.warning}
                />
                <Text style={[typography.subheading, { flex: 1 }]}>
                  {myMember?.confirmedAt ? 'Attendance confirmed' : 'Confirm you are showing up'}
                </Text>
                {!myMember?.confirmedAt ? (
                  <Button
                    label="Confirm"
                    size="sm"
                    onPress={() => void handleConfirmAttendance()}
                    loading={actionBusy === 'confirm'}
                  />
                ) : null}
              </View>
            ) : null}

            {/* Chat */}
            {meInPod ? (
              <Card padded={false}>
                <View style={[styles.chatHeader, { borderBottomColor: colors.borderSoft }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.title}>The chat</Text>
                    <Text style={typography.captionSmall}>
                      {pod.members.length} {pod.members.length === 1 ? 'member' : 'members'} • tap a
                      message to reply
                    </Text>
                  </View>
                  <Sticker label="Live" tint={colors.successSoft} icon="radio" small tilt={2} />
                </View>

                <ScrollView
                  style={styles.messageList}
                  contentContainerStyle={styles.messageListContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                >
                  {messages.length ? (
                    messages.map((message) => {
                      const mine = message.user.id === user?.id;
                      const heartCount =
                        message.reactions?.filter((reaction) => reaction.emoji === HEART_EMOJI)
                          .length ?? 0;
                      const hasHeart = !!message.reactions?.some(
                        (reaction) =>
                          reaction.userId === user?.id && reaction.emoji === HEART_EMOJI,
                      );

                      return (
                        <View key={message.id} style={[styles.messageRow, mine && styles.messageRowMine]}>
                          {!mine ? (
                            <Pressable
                              onPress={() =>
                                navigation.navigate('UserProfile', { userId: message.user.id })
                              }
                              accessibilityRole="button"
                              accessibilityLabel={`Open ${message.user.name}'s profile`}
                            >
                              <Avatar name={message.user.name} uri={message.user.avatarUrl} size={32} />
                            </Pressable>
                          ) : null}
                          <View style={[styles.messageStack, mine && styles.messageStackMine]}>
                            <View style={[styles.messageMetaRow, mine && styles.messageMetaRowMine]}>
                              <Text style={styles.messageName}>
                                {mine ? 'You' : message.user.name}
                              </Text>
                              <Text style={styles.messageTime}>{formatTime(message.createdAt)}</Text>
                            </View>
                            <Pressable
                              onLongPress={() => setReplyTo(message)}
                              onPress={() => setReplyTo(message)}
                              style={[
                                styles.bubble,
                                {
                                  backgroundColor: mine ? colors.primary : colors.surfaceAlt,
                                  borderColor: colors.border,
                                },
                                mine ? styles.bubbleMine : styles.bubbleTheirs,
                              ]}
                            >
                              {message.replyTo ? (
                                <View
                                  style={[
                                    styles.replyPreview,
                                    {
                                      borderLeftColor: mine
                                        ? 'rgba(255,246,232,0.5)'
                                        : colors.faint,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.replyMeta,
                                      { color: mine ? 'rgba(255,246,232,0.8)' : colors.faint },
                                    ]}
                                  >
                                    Replying to {message.replyTo.user.name}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.replyBody,
                                      { color: mine ? 'rgba(255,246,232,0.7)' : colors.faint },
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {message.replyTo.content}
                                  </Text>
                                </View>
                              ) : null}
                              <Text
                                style={[
                                  styles.messageBody,
                                  { color: mine ? colors.onPrimary : colors.ink },
                                ]}
                              >
                                {message.content}
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => void handleHeart(message)}
                              style={[styles.heartButton, mine && styles.heartButtonMine]}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              accessibilityRole="button"
                              accessibilityLabel={
                                hasHeart ? 'Remove heart from message' : 'Heart message'
                              }
                              accessibilityState={{ selected: hasHeart }}
                            >
                              <Ionicons
                                name={hasHeart ? 'heart' : 'heart-outline'}
                                size={15}
                                color={hasHeart ? colors.pink : colors.faint}
                              />
                              {heartCount ? (
                                <Text style={styles.heartCount}>{heartCount}</Text>
                              ) : null}
                            </Pressable>
                          </View>
                          {!mine ? (
                            <Pressable
                              onPress={() => handleMessageSafetyAction(message)}
                              style={styles.safetyButton}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              accessibilityRole="button"
                              accessibilityLabel={`Safety actions for ${message.user.name}'s message`}
                            >
                              <Ionicons
                                name="ellipsis-horizontal-circle-outline"
                                size={20}
                                color={colors.faint}
                              />
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.emptyChat}>
                      <Sticker label="Crickets" tint={colors.amberSoft} tilt={-3} icon="chatbubble" />
                      <Text style={[typography.subheading, { marginTop: spacing.sm }]}>
                        No messages yet
                      </Text>
                      <Text style={[typography.caption, { textAlign: 'center' }]}>
                        Start with an ETA, meetup note, or quick check-in.
                      </Text>
                    </View>
                  )}
                  {typingUserIds.length ? (
                    <Text style={[typography.caption, { color: colors.primary }]}>
                      Someone is typing…
                    </Text>
                  ) : null}
                </ScrollView>

                {replyTo ? (
                  <View
                    style={[
                      styles.replyComposer,
                      { backgroundColor: colors.surfaceAlt, borderTopColor: colors.borderSoft },
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.replyMeta}>Replying to {replyTo.user.name}</Text>
                      <Text style={[styles.replyBody, { color: colors.sub }]} numberOfLines={1}>
                        {replyTo.content}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setReplyTo(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel reply"
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.sub} />
                    </Pressable>
                  </View>
                ) : null}
                <View style={[styles.composerRow, { borderTopColor: colors.border }]}>
                  <TextInput
                    value={messageText}
                    onChangeText={(value) => {
                      setMessageText(value);
                      pingTyping(value);
                    }}
                    placeholder="Message the pod"
                    placeholderTextColor={colors.faint}
                    style={[
                      styles.input,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.ink },
                    ]}
                    returnKeyType="send"
                    onSubmitEditing={() => void handleSend()}
                  />
                  <Pressable
                    onPress={() => void handleSend()}
                    disabled={sending || !messageText.trim()}
                    style={[
                      styles.sendButton,
                      {
                        backgroundColor: !messageText.trim() || sending ? colors.faint : colors.primary,
                        borderColor: colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Send pod message"
                    accessibilityState={{ disabled: sending || !messageText.trim() }}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Ionicons name="arrow-up" size={18} color={colors.onPrimary} />
                    )}
                  </Pressable>
                </View>
              </Card>
            ) : (
              <EmptyState
                icon="lock-closed"
                title="Join to open the chat"
                body="Pod conversation, recaps, and member coordination unlock once you join."
              />
            )}

            {/* Details */}
            <Card padded={false}>
              <Pressable
                onPress={() => setDetailsOpen((open) => !open)}
                style={styles.detailsHeader}
                accessibilityRole="button"
                accessibilityLabel={detailsOpen ? 'Collapse pod details' : 'Expand pod details'}
                accessibilityState={{ expanded: detailsOpen }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={typography.title}>Pod details</Text>
                  <Text style={typography.captionSmall}>
                    Members, privacy, invites, and meetup point
                  </Text>
                </View>
                <Ionicons
                  name={detailsOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.ink}
                />
              </Pressable>

              {detailsOpen ? (
                <View style={[styles.detailsBody, { borderTopColor: colors.borderSoft }]}>
                  <View style={styles.detailSection}>
                    <Text style={typography.kicker}>People</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {pod.members.map((member, index) => (
                        <Pressable
                          key={member.id}
                          style={styles.member}
                          onPress={() =>
                            navigation.navigate('UserProfile', { userId: member.userId })
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${member.user.name}'s profile`}
                        >
                          <Avatar
                            name={member.user.name}
                            uri={member.user.avatarUrl}
                            size={48}
                            tilt={index % 2 === 0 ? -2 : 2}
                          />
                          <Text style={styles.memberName} numberOfLines={1}>
                            {member.user.name}
                          </Text>
                          {member.confirmedAt ? (
                            <Text style={[typography.captionSmall, { color: colors.success }]}>
                              Confirmed
                            </Text>
                          ) : null}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  {meInPod && isCreator && pod.status !== 'COMPLETED' && pod.status !== 'EXPIRED' ? (
                    <View style={styles.detailSection}>
                      <Text style={typography.kicker}>Privacy</Text>
                      <View style={styles.privacyToggle}>
                        {(
                          [
                            { value: 'public' as const, label: 'Public', icon: 'earth' as const },
                            { value: 'private' as const, label: 'Private', icon: 'lock-closed' as const },
                          ]
                        ).map((item) => {
                          const active = pod.locationType === item.value;
                          return (
                            <Pressable
                              key={item.value}
                              disabled={actionBusy === 'privacy'}
                              onPress={() => void handlePrivacyChange(item.value)}
                              style={[
                                styles.privacyOption,
                                {
                                  borderColor: colors.border,
                                  backgroundColor: active ? colors.primarySoft : colors.surfaceAlt,
                                },
                              ]}
                              accessibilityRole="radio"
                              accessibilityLabel={`${item.label} pod`}
                              accessibilityState={{
                                selected: active,
                                disabled: actionBusy === 'privacy',
                              }}
                            >
                              <Ionicons
                                name={item.icon}
                                size={16}
                                color={active ? colors.primary : colors.sub}
                              />
                              <Text
                                style={[
                                  styles.privacyLabel,
                                  { color: active ? colors.ink : colors.sub },
                                ]}
                              >
                                {item.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  {meInPod && pod.status === 'FORMING' ? (
                    <View style={styles.detailSection}>
                      <SectionHeader
                        title="Invite friends"
                        actionLabel="Share link"
                        onAction={() => void handleShare()}
                      />
                      <View
                        style={[
                          styles.shareCard,
                          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                        ]}
                      >
                        <Ionicons name="link" size={18} color={colors.primary} />
                        <Text style={[typography.captionSmall, { flex: 1 }]} numberOfLines={1}>
                          {getPodShareUrl(pod.id)}
                        </Text>
                        <Button label="Share" size="sm" variant="secondary" onPress={() => void handleShare()} />
                      </View>
                      <View style={{ gap: spacing.sm }}>
                        {eligibleInviteFriends.length ? (
                          eligibleInviteFriends.map((friend) => (
                            <View key={friend.id} style={styles.inviteRow}>
                              <Pressable
                                style={styles.inviteIdentity}
                                onPress={() =>
                                  navigation.navigate('UserProfile', { userId: friend.id })
                                }
                              >
                                <Avatar name={friend.name} uri={friend.avatarUrl} size={38} />
                                <Text style={typography.subheading} numberOfLines={1}>
                                  {friend.name}
                                </Text>
                              </Pressable>
                              <Button
                                label="Invite"
                                size="sm"
                                variant="secondary"
                                onPress={() => void handleInviteFriend(friend)}
                                loading={actionBusy === `invite-${friend.id}`}
                              />
                            </View>
                          ))
                        ) : (
                          <Text style={typography.caption}>
                            Add friends from profiles or after completed pods, then invite them here.
                          </Text>
                        )}
                      </View>
                    </View>
                  ) : null}

                  {pod.latitude != null && pod.longitude != null ? (
                    <View style={styles.detailSection}>
                      <Text style={typography.kicker}>Meetup point</Text>
                      <View style={[styles.mapFrame, { borderColor: colors.border }]}>
                        <MapView
                          provider={PROVIDER_DEFAULT}
                          style={{ flex: 1 }}
                          initialRegion={{
                            latitude: pod.latitude,
                            longitude: pod.longitude,
                            latitudeDelta: 0.006,
                            longitudeDelta: 0.006,
                          }}
                        >
                          <Marker coordinate={{ latitude: pod.latitude, longitude: pod.longitude }} />
                        </MapView>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Card>

            {pod.status === 'COMPLETED' ? (
              <>
                <Card padded>
                  <Text style={typography.title}>Pod recap</Text>
                  <Text style={[typography.body, { marginTop: 6 }]}>
                    {pod.averageRating != null
                      ? `Average member sentiment: ${pod.averageRating.toFixed(1)} / 3`
                      : 'No group rating yet.'}
                  </Text>
                  {pod.myRecap ? (
                    <Text style={[typography.caption, { marginTop: 6 }]}>
                      Your recap is already in.
                    </Text>
                  ) : (
                    <View style={styles.recapRow}>
                      <Button
                        label="Rough"
                        variant="secondary"
                        size="sm"
                        onPress={() => void handleRecap(1)}
                        loading={actionBusy === 'recap'}
                      />
                      <Button
                        label="Solid"
                        variant="secondary"
                        size="sm"
                        onPress={() => void handleRecap(2)}
                        disabled={actionBusy === 'recap'}
                      />
                      <Button
                        label="Great"
                        size="sm"
                        onPress={() => void handleRecap(3)}
                        disabled={actionBusy === 'recap'}
                      />
                    </View>
                  )}
                </Card>

                {peopleYouMet.length ? (
                  <Card padded>
                    <Text style={typography.title}>People you met</Text>
                    <Text style={[typography.caption, { marginTop: 4 }]}>
                      Turn this pod into an actual relationship while the context is still fresh.
                    </Text>
                    <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                      {peopleYouMet.map((person) => (
                        <View
                          key={person.id}
                          style={[
                            styles.metCard,
                            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                          ]}
                        >
                          <Pressable
                            onPress={() => navigation.navigate('UserProfile', { userId: person.id })}
                            style={styles.inviteIdentity}
                          >
                            <Avatar name={person.name} uri={person.avatarUrl} size={42} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={typography.subheading} numberOfLines={1}>
                                {person.name}
                              </Text>
                              <Text style={typography.captionSmall} numberOfLines={1}>
                                {[person.major, person.classYear].filter(Boolean).join(' • ') ||
                                  'Student'}
                              </Text>
                            </View>
                          </Pressable>
                          {person.interestTags.length ? (
                            <View style={styles.tagWrap}>
                              {person.interestTags.slice(0, 3).map((tag) => (
                                <Tag key={tag} label={INTEREST_TAG_META[tag]?.label ?? tag} />
                              ))}
                            </View>
                          ) : null}
                          <Button
                            label="Add friend"
                            size="sm"
                            onPress={() => void handleConnect(person)}
                            loading={actionBusy === `met-${person.id}`}
                            style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}
                          />
                        </View>
                      ))}
                    </View>
                  </Card>
                ) : null}

                {meInPod ? (
                  <Card padded>
                    <Text style={typography.title}>No-show follow-up</Text>
                    <Text style={[typography.caption, { marginTop: 4 }]}>
                      Only use this if someone committed to the pod and then did not show.
                    </Text>
                    <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                      {pod.members
                        .filter(
                          (member) =>
                            member.userId !== user?.id &&
                            !pod.noShowUserIds?.includes(member.userId),
                        )
                        .map((member) => (
                          <View key={member.id} style={styles.inviteRow}>
                            <Pressable
                              style={styles.inviteIdentity}
                              onPress={() =>
                                navigation.navigate('UserProfile', { userId: member.userId })
                              }
                            >
                              <Avatar name={member.user.name} uri={member.user.avatarUrl} size={38} />
                              <Text style={typography.subheading} numberOfLines={1}>
                                {member.user.name}
                              </Text>
                            </Pressable>
                            <Button
                              label="Report no-show"
                              size="sm"
                              variant="secondary"
                              onPress={() => void handleNoShow(member.userId)}
                              loading={actionBusy === `noshow-${member.userId}`}
                            />
                          </View>
                        ))}
                      {!pod.members.some(
                        (member) =>
                          member.userId !== user?.id && !pod.noShowUserIds?.includes(member.userId),
                      ) ? (
                        <Text style={typography.caption}>No remaining members to report.</Text>
                      ) : null}
                    </View>
                  </Card>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <View style={styles.loadingContainer}>
            <SkeletonCard />
            <SkeletonCard compact />
            <SkeletonCard compact />
          </View>
        )}
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.md,
  },
  countPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderWidth: BORDER_W,
    borderColor: t.colors.border,
    borderRadius: radii.pill,
    backgroundColor: t.colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: t.colors.ink,
  },
  podTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.5,
    color: t.colors.ink,
    marginBottom: spacing.md,
  },
  metaList: {
    gap: 6,
    marginBottom: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
  },
  actionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  confirmNotice: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  chatHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderStyle: 'dashed' as const,
  },
  messageList: {
    minHeight: 236,
    maxHeight: 360,
  },
  messageListContent: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  messageRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    alignItems: 'flex-end' as const,
  },
  messageRowMine: {
    justifyContent: 'flex-end' as const,
  },
  messageStack: {
    maxWidth: '76%' as const,
    gap: 4,
  },
  messageStackMine: {
    alignItems: 'flex-end' as const,
  },
  messageMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
    paddingHorizontal: 2,
  },
  messageMetaRowMine: {
    justifyContent: 'flex-end' as const,
  },
  messageName: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: t.colors.sub,
  },
  messageTime: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: t.colors.faint,
  },
  bubble: {
    gap: 4,
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    borderBottomRightRadius: 4,
  },
  messageBody: {
    fontFamily: fonts.medium,
    fontSize: 14.5,
    lineHeight: 20,
  },
  replyPreview: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 2,
  },
  replyMeta: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: t.colors.sub,
  },
  replyBody: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
  },
  heartButton: {
    alignSelf: 'flex-start' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    minHeight: 22,
    paddingHorizontal: 4,
  },
  heartButtonMine: {
    alignSelf: 'flex-end' as const,
  },
  heartCount: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: t.colors.faint,
  },
  safetyButton: {
    width: 26,
    height: 26,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 24,
  },
  emptyChat: {
    minHeight: 170,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    padding: spacing.lg,
  },
  replyComposer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 2,
    borderStyle: 'dashed' as const,
  },
  composerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: BORDER_W,
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: radii.sm,
    borderWidth: BORDER_W,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  detailsHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  detailsBody: {
    gap: spacing.lg,
    borderTopWidth: 2,
    borderStyle: 'dashed' as const,
    padding: spacing.lg,
  },
  detailSection: {
    gap: spacing.sm,
  },
  member: {
    marginRight: spacing.md,
    alignItems: 'center' as const,
    gap: 5,
    width: 76,
  },
  memberName: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: t.colors.ink,
    textAlign: 'center' as const,
  },
  privacyToggle: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  privacyOption: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingVertical: 12,
  },
  privacyLabel: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },
  shareCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  inviteRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  inviteIdentity: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  mapFrame: {
    height: 158,
    borderRadius: radii.md,
    overflow: 'hidden' as const,
    borderWidth: BORDER_W,
  },
  recapRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    flexWrap: 'wrap' as const,
    marginTop: spacing.md,
  },
  metCard: {
    borderWidth: BORDER_W,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  tagWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    marginTop: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    gap: spacing.md,
  },
}));
