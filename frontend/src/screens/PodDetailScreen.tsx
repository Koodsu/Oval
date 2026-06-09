import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from '../components/CampusMap';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
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
import { Chip, EmptyState, Panel, PrimaryButton, Screen, ScreenHeader, SectionHeader, SkeletonCard, UserAvatar } from '../components/ui';
import { Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';
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

export default function PodDetailScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
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
	    } catch (error) {
	      setLoadError(getApiErrorMessage(error));
	      if (showAlert) {
	        Alert.alert('Could not load pod', getApiErrorMessage(error));
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

  const pingTyping = useCallback((draft: string) => {
    if (!draft.trim()) return;
    if (typingTimerRef.current) return;
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 2500);
    void sendPodTyping(podId).catch(() => {});
  }, [podId]);

	  const meInPod = pod?.members.some((member) => member.userId === user?.id) ?? false;
	  const myMember = pod?.members.find((member) => member.userId === user?.id) ?? null;
	  const isCreator = pod?.creator?.id === user?.id || pod?.creatorId === user?.id;
	  const canJoinOrWaitlist = pod?.status === 'FORMING';
	  const primaryActionLabel = meInPod
	    ? 'Leave pod'
	    : canJoinOrWaitlist
	      ? pod && pod.members.length >= pod.maxMembers ? 'Join waitlist' : 'Join pod'
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
      (reaction) => reaction.userId === user?.id && reaction.emoji === HEART_EMOJI
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
            Alert.alert('User blocked', 'They can no longer message you. Shared pods are separated for safety.');
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
      <Screen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
          <ScreenHeader title="Pod" onBack={() => navigation.goBack()} />
          <EmptyState icon="alert-circle-outline" title="Could not load pod" body={loadError} />
          <PrimaryButton label="Try again" onPress={() => void load(false)} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {pod ? (
          <>
            <ScreenHeader
              title="Pod"
              onBack={() => navigation.goBack()}
              right={(
                <TouchableOpacity
                  onPress={() => void handleShare()}
                  style={styles.headerAction}
                  accessibilityRole="button"
                  accessibilityLabel="Share pod"
                >
                  <Ionicons name="share-outline" size={18} color={colors.ink} />
                </TouchableOpacity>
              )}
            />
            <Panel style={styles.podHeaderPanel}>
              <View style={styles.podHeaderTop}>
                <View style={styles.podTitleBlock}>
                  <Text style={styles.statusLabel}>{POD_STATUS_LABELS[pod.status]}</Text>
                  <Text style={styles.podTitle}>{pod.activity?.title ?? 'Pod detail'}</Text>
                </View>
                <View style={styles.memberCountPill}>
                  <Ionicons name="people-outline" size={15} color={colors.ink} />
                  <Text style={styles.memberCountText}>{pod.members.length}/{pod.maxMembers}</Text>
                </View>
              </View>
              <View style={styles.quickMetaGrid}>
                <View style={styles.quickMetaItem}>
                  <Ionicons name="calendar-outline" size={16} color={colors.sub} />
                  <Text style={styles.quickMetaText} numberOfLines={1}>{formatDateTime(pod.meetupTime)}</Text>
                </View>
                <View style={styles.quickMetaItem}>
                  <Ionicons name="location-outline" size={16} color={colors.sub} />
                  <Text style={styles.quickMetaText} numberOfLines={1}>{pod.location}</Text>
                </View>
              </View>
              <View style={styles.primaryActionRow}>
                <View style={styles.primaryActionFill}>
	                  <PrimaryButton
	                    label={primaryActionLabel}
	                    onPress={() => void handlePrimaryAction()}
	                    loading={actionBusy === 'primary'}
	                    kind={meInPod || !canJoinOrWaitlist ? 'ghost' : 'solid'}
	                  />
                </View>
                <TouchableOpacity
                  onPress={() => void handleShare()}
                  style={styles.squareAction}
                  accessibilityRole="button"
                  accessibilityLabel="Share pod link"
                >
                  <Ionicons name="link-outline" size={18} color={colors.ink} />
                </TouchableOpacity>
                {isCreator ? (
                  <TouchableOpacity
                    onPress={() => void handleLockToggle()}
                    disabled={actionBusy != null}
                    style={[styles.squareAction, actionBusy != null && styles.squareActionDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel={pod.status === 'LOCKED' ? 'Unlock pod' : 'Lock pod'}
                  >
                    {actionBusy === 'lock' ? (
                      <ActivityIndicator size="small" color={colors.ink} />
                    ) : (
                      <Ionicons name={pod.status === 'LOCKED' ? 'lock-open-outline' : 'lock-closed-outline'} size={18} color={colors.ink} />
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            </Panel>

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
              <View style={styles.actionNotice}>
                <View style={styles.actionNoticeCopy}>
                  <Ionicons name={myMember?.confirmedAt ? 'checkmark-circle' : 'alert-circle-outline'} size={18} color={myMember?.confirmedAt ? colors.successText : colors.warnText} />
                  <Text style={styles.actionNoticeText}>
                    {myMember?.confirmedAt ? 'Attendance confirmed' : 'Confirm you are showing up'}
                  </Text>
                </View>
                {!myMember?.confirmedAt ? (
                  <TouchableOpacity onPress={() => void handleConfirmAttendance()} style={styles.noticeButton} disabled={actionBusy === 'confirm'}>
                    {actionBusy === 'confirm' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.noticeButtonText}>Confirm</Text>}
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {meInPod ? (
              <Panel style={styles.conversationPanel}>
                <View style={styles.conversationHeader}>
                  <View>
                    <Text style={styles.conversationTitle}>Conversation</Text>
                    <Text style={styles.conversationMeta}>
                      {pod.members.length} {pod.members.length === 1 ? 'member' : 'members'} coordinating here • tap a message to reply
                    </Text>
                  </View>
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>Pod chat</Text>
                  </View>
                </View>

                <ScrollView
                  style={styles.messageList}
                  contentContainerStyle={styles.messageListContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                >
                  {messages.length ? messages.map((message) => {
                    const mine = message.user.id === user?.id;
                    const heartCount = message.reactions?.filter((reaction) => reaction.emoji === HEART_EMOJI).length ?? 0;
                    const hasHeart = !!message.reactions?.some((reaction) => reaction.userId === user?.id && reaction.emoji === HEART_EMOJI);

                    return (
                      <View key={message.id} style={[styles.messageRow, mine && styles.messageRowMine]}>
                        {!mine ? (
                          <TouchableOpacity
                            onPress={() => navigation.navigate('UserProfile', { userId: message.user.id })}
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${message.user.name}'s profile`}
                          >
                            <UserAvatar name={message.user.name} avatarUrl={message.user.avatarUrl} size={34} />
                          </TouchableOpacity>
                        ) : null}
                        <View style={[styles.messageStack, mine && styles.messageStackMine]}>
                          <View style={[styles.messageMetaRow, mine && styles.messageMetaRowMine]}>
                            <Text style={styles.messageName}>{mine ? 'You' : message.user.name}</Text>
                            <Text style={styles.messageTime}>{formatTime(message.createdAt)}</Text>
                          </View>
                          <TouchableOpacity
                            activeOpacity={0.82}
                            onLongPress={() => setReplyTo(message)}
                            onPress={() => setReplyTo(message)}
                            style={[styles.messageContent, mine && styles.messageContentMine]}
                          >
                            {message.replyTo ? (
                              <View style={[styles.replyPreview, mine && styles.replyPreviewMine]}>
                                <Text style={[styles.replyMeta, mine && styles.replyMetaMine]}>Replying to {message.replyTo.user.name}</Text>
                                <Text style={[styles.replyBody, mine && styles.replyBodyMine]} numberOfLines={1}>{message.replyTo.content}</Text>
                              </View>
                            ) : null}
                            <Text style={[styles.messageBody, mine && styles.messageBodyMine]}>{message.content}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => void handleHeart(message)}
                            style={[styles.heartButton, mine && styles.heartButtonMine]}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel={hasHeart ? 'Remove heart from message' : 'Heart message'}
                            accessibilityState={{ selected: hasHeart }}
                          >
                            <Ionicons
                              name={hasHeart ? 'heart' : 'heart-outline'}
                              size={16}
                              color={hasHeart ? colors.pink : colors.faint}
                            />
                            {heartCount ? <Text style={styles.heartCount}>{heartCount}</Text> : null}
                          </TouchableOpacity>
                        </View>
                        {!mine ? (
                          <TouchableOpacity
                            onPress={() => handleMessageSafetyAction(message)}
                            style={styles.messageSafetyButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Safety actions for ${message.user.name}'s message`}
                          >
                            <Ionicons name="ellipsis-horizontal-circle-outline" size={21} color={colors.faint} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  }) : (
                    <View style={styles.emptyChat}>
                      <View style={styles.emptyChatIcon}>
                        <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
                      </View>
                      <Text style={styles.emptyChatTitle}>No messages yet</Text>
                      <Text style={styles.emptyChatBody}>Start with an ETA, meetup note, or quick check-in.</Text>
                    </View>
                  )}
                  {typingUserIds.length ? (
                    <Text style={styles.typingText}>Someone is typing...</Text>
                  ) : null}
                </ScrollView>

                {replyTo ? (
                  <View style={styles.replyComposer}>
                    <View style={styles.replyComposerCopy}>
                      <Text style={styles.replyMeta}>Replying to {replyTo.user.name}</Text>
                      <Text style={styles.replyBody} numberOfLines={1}>{replyTo.content}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setReplyTo(null)}
                      style={styles.clearReplyButton}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel reply"
                    >
                      <Ionicons name="close" size={16} color={colors.ink} />
                    </TouchableOpacity>
                  </View>
                ) : null}
                <View style={styles.composerRow}>
                  <TextInput
                    value={messageText}
                    onChangeText={(value) => {
                      setMessageText(value);
                      pingTyping(value);
                    }}
                    placeholder="Message the pod"
                    placeholderTextColor={colors.faint}
                    style={styles.input}
                    returnKeyType="send"
                    onSubmitEditing={() => void handleSend()}
                  />
                  <TouchableOpacity
                    onPress={() => void handleSend()}
                    disabled={sending || !messageText.trim()}
                    style={[styles.sendButtonInline, (!messageText.trim() || sending) && styles.sendButtonInlineDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel="Send pod message"
                    accessibilityState={{ disabled: sending || !messageText.trim() }}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </Panel>
            ) : (
              <EmptyState icon="lock-closed-outline" title="Join to open the chat" body="Pod conversation, recaps, and member coordination unlock once you join." />
            )}

            <Panel style={styles.detailsPanel}>
              <TouchableOpacity
                activeOpacity={0.84}
                onPress={() => setDetailsOpen((open) => !open)}
                style={styles.detailsHeader}
                accessibilityRole="button"
                accessibilityLabel={detailsOpen ? 'Collapse pod details' : 'Expand pod details'}
                accessibilityState={{ expanded: detailsOpen }}
              >
                <View style={styles.detailsHeaderCopy}>
                  <Text style={styles.detailsTitle}>Pod details</Text>
                  <Text style={styles.detailsSubtitle}>Members, privacy, invites, and meetup point</Text>
                </View>
                <Ionicons name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.ink} />
              </TouchableOpacity>

              {detailsOpen ? (
                <View style={styles.detailsBody}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>People</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {pod.members.map((member) => (
                        <TouchableOpacity
                          key={member.id}
                          style={styles.member}
                          onPress={() => navigation.navigate('UserProfile', { userId: member.userId })}
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${member.user.name}'s profile`}
                        >
                          <UserAvatar name={member.user.name} avatarUrl={member.user.avatarUrl} />
                          <Text style={styles.memberName}>{member.user.name}</Text>
                          {member.confirmedAt ? <Text style={styles.memberMeta}>Confirmed</Text> : null}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {meInPod && isCreator && pod.status !== 'COMPLETED' && pod.status !== 'EXPIRED' ? (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Privacy</Text>
                      <View style={styles.privacyToggle}>
                        {([
                          { value: 'public' as const, label: 'Public', icon: 'earth-outline' as const },
                          { value: 'private' as const, label: 'Private', icon: 'lock-closed-outline' as const },
                        ]).map((item) => {
                          const active = pod.locationType === item.value;
                          return (
                            <TouchableOpacity
                              key={item.value}
                              activeOpacity={0.86}
                              disabled={actionBusy === 'privacy'}
                              onPress={() => void handlePrivacyChange(item.value)}
                              style={[styles.privacyOption, active && styles.privacyOptionActive]}
                              accessibilityRole="radio"
                              accessibilityLabel={`${item.label} pod`}
                              accessibilityState={{ selected: active, disabled: actionBusy === 'privacy' }}
                            >
                              <Ionicons name={item.icon} size={17} color={active ? colors.primary : colors.sub} />
                              <Text style={[styles.privacyLabel, active && styles.privacyLabelActive]}>{item.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  {meInPod && pod.status === 'FORMING' ? (
                    <View style={styles.detailSection}>
                      <SectionHeader title="Invite friends" actionLabel="Share link" onActionPress={() => void handleShare()} />
                      <View style={styles.shareCard}>
                        <View style={styles.shareIcon}>
                          <Ionicons name="link-outline" size={18} color={colors.primary} />
                        </View>
                        <View style={styles.copy}>
                          <Text style={styles.memberName}>Invite link</Text>
                          <Text style={styles.memberMeta} numberOfLines={1}>{getPodShareUrl(pod.id)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => void handleShare()} style={styles.smallTextButton}>
                          <Text style={styles.smallTextButtonLabel}>Share</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.inviteList}>
                        {eligibleInviteFriends.length ? (
                          eligibleInviteFriends.map((friend) => (
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
                          ))
                        ) : (
                          <View style={styles.emptyInline}>
                            <Ionicons name="people-outline" size={18} color={colors.sub} />
                            <Text style={styles.body}>
                              Add friends from profiles or after completed pods, then invite them here.
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ) : null}

                  {pod.latitude != null && pod.longitude != null ? (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Meetup point</Text>
                      <View style={styles.mapFrame}>
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
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Panel>

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
          </>
        ) : (
          <View style={styles.loadingContainer}>
            <SkeletonCard />
            <SkeletonCard compact />
            <SkeletonCard compact />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.glass,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  podHeaderPanel: {
    gap: spacing.md,
    padding: spacing.md,
  },
  podHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  podTitleBlock: {
    flex: 1,
    gap: 3,
  },
  statusLabel: {
    ...t.typography.label,
    color: t.colors.primary,
  },
  podTitle: {
    ...t.typography.h2,
    letterSpacing: 0,
  },
  memberCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: t.colors.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  memberCountText: {
    ...t.typography.bodyStrong,
    fontSize: 13,
    lineHeight: 16,
  },
  quickMetaGrid: {
    gap: spacing.xs,
  },
  quickMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickMetaText: {
    ...t.typography.body,
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  primaryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  primaryActionFill: {
    flex: 1,
  },
  squareAction: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  squareActionDisabled: {
    opacity: 0.6,
  },
  actionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: radii.md,
    padding: spacing.sm,
    backgroundColor: t.colors.warnBg,
    borderWidth: 1,
    borderColor: 'rgba(154, 94, 23, 0.16)',
  },
  actionNoticeCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionNoticeText: {
    ...t.typography.bodyStrong,
    flex: 1,
    color: t.colors.ink,
  },
  noticeButton: {
    minWidth: 78,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.ink,
    paddingHorizontal: spacing.sm,
  },
  noticeButtonText: {
    ...t.typography.bodyStrong,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
  },
  sectionTitle: {
    ...t.typography.title,
    marginBottom: spacing.sm,
  },
  body: {
    ...t.typography.body,
  },
  privacyToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  privacyOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.inputBg,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  privacyOptionActive: {
    borderColor: t.colors.primary,
    backgroundColor: 'rgba(252, 232, 228, 0.56)',
  },
  privacyOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  privacyLabel: {
    ...t.typography.bodyStrong,
    color: t.colors.sub,
    fontSize: 14,
    lineHeight: 18,
  },
  privacyLabelActive: {
    color: t.colors.ink,
  },
  privacyBody: {
    ...t.typography.body,
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    ...t.typography.bodyStrong,
    color: t.colors.dangerText,
  },
  member: {
    marginRight: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    width: 76,
  },
  memberName: {
    ...t.typography.bodyStrong,
  },
  memberMeta: {
    ...t.typography.body,
    fontSize: 12,
    textAlign: 'center',
  },
  inviteList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.inputBg,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  shareIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.dangerBg,
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
  emptyInline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.glass,
    padding: spacing.md,
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
  mapFrame: {
    height: 158,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  map: {
    flex: 1,
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
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
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
  conversationPanel: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  conversationTitle: {
    ...t.typography.title,
  },
  conversationMeta: {
    ...t.typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: t.colors.successBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: t.colors.successText,
  },
  liveText: {
    ...t.typography.bodyStrong,
    color: t.colors.successText,
    fontSize: 12,
    lineHeight: 15,
  },
  messageList: {
    minHeight: 236,
    maxHeight: 360,
  },
  messageListContent: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  messageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
	  messageStack: {
	    maxWidth: '76%',
	    gap: 4,
	  },
  messageStackMine: {
    alignItems: 'flex-end',
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 2,
  },
  messageMetaRowMine: {
    justifyContent: 'flex-end',
  },
  messageName: {
    ...t.typography.bodyStrong,
    fontSize: 12,
    lineHeight: 15,
    color: t.colors.sub,
  },
  messageTime: {
    ...t.typography.body,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.faint,
  },
  messageContent: {
    gap: 4,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  messageContentMine: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
    backgroundColor: t.colors.ink,
    borderColor: t.colors.ink,
  },
  messageBody: {
    ...t.typography.body,
    color: t.colors.ink,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: 0,
  },
  messageBodyMine: {
    color: '#FFFFFF',
  },
  replyPreview: {
    borderLeftWidth: 2,
    borderLeftColor: t.colors.borderStrong,
    paddingLeft: 10,
    marginBottom: 2,
  },
  replyPreviewMine: {
    borderLeftColor: 'rgba(255, 255, 255, 0.36)',
  },
  replyMeta: {
    ...t.typography.bodyStrong,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.faint,
  },
  replyBody: {
    ...t.typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: t.colors.faint,
  },
  replyMetaMine: {
    color: 'rgba(255, 255, 255, 0.68)',
  },
  replyBodyMine: {
    color: 'rgba(255, 255, 255, 0.72)',
  },
  heartButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 24,
    paddingHorizontal: 6,
  },
  heartButtonMine: {
    alignSelf: 'flex-end',
  },
	  heartCount: {
	    ...t.typography.bodyStrong,
	    fontSize: 12,
	    lineHeight: 16,
	    color: t.colors.faint,
	  },
	  messageSafetyButton: {
	    width: 26,
	    height: 26,
	    alignItems: 'center',
	    justifyContent: 'center',
	    marginBottom: 24,
	  },
	  typingText: {
    ...t.typography.body,
    color: t.colors.primary,
    marginTop: 2,
  },
  replyComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: t.colors.inputBg,
    padding: spacing.sm,
  },
  replyComposerCopy: {
    flex: 1,
    gap: 2,
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    ...t.typography.body,
    color: t.colors.ink,
    fontSize: 16,
    lineHeight: 20,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sendButtonInline: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primary,
  },
  sendButtonInlineDisabled: {
    backgroundColor: t.colors.borderStrong,
  },
  clearReplyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.glass,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  emptyChat: {
    minHeight: 174,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: spacing.lg,
  },
  emptyChatIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.dangerBg,
  },
  emptyChatTitle: {
    ...t.typography.title,
    marginTop: spacing.xs,
  },
  emptyChatBody: {
    ...t.typography.body,
    textAlign: 'center',
  },
  detailsPanel: {
    padding: 0,
    overflow: 'hidden',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.md,
  },
  detailsHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  detailsTitle: {
    ...t.typography.title,
  },
  detailsSubtitle: {
    ...t.typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  detailsBody: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
    padding: spacing.md,
  },
  detailSection: {
    gap: spacing.sm,
  },
  detailLabel: {
    ...t.typography.label,
    color: t.colors.sub,
  },
  smallTextButton: {
    minHeight: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  smallTextButtonLabel: {
    ...t.typography.bodyStrong,
    fontSize: 13,
    lineHeight: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
}));
