import React, { useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import {
  getPod, getMessages, sendMessage, addPodMessageReaction, removePodMessageReaction,
  sendPodTyping,
  lockPod, unlockPod, leavePod,
  confirmAttendance, reportNoShow, resolveAvatarUrl,
  getFriends, sendPodInvite,
  submitRecap,
  leaveWaitlist,
} from '../api';
import { Pod, Message, FriendUser } from '../types';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import ReportModal from '../components/ReportModal';
import RecapPromptModal from '../components/RecapPromptModal';
import { MessageBubble, ChatInput, DateSeparator, EmptyChatState, ReactionPicker, TypingIndicator } from '../components/chat';
import { colors, spacing, radii, shadows, typography, cardShadowCream } from '../theme';
import { formatPodTime } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Pod'>;

type ChatListItem =
  | { type: 'date'; id: string; date: string }
  | { type: 'message'; message: Message; index: number };

const MEMBER_AVATAR = 44;
const AVATAR_OVERLAP = 8;

function PodStatusPill({ status }: { status: string }) {
  let backgroundColor = '#64748b';
  let label = status;
  let textColor = colors.textInverse;
  if (status === 'FORMING') {
    backgroundColor = colors.podForming;
    label = 'Forming';
  } else if (status === 'LOCKED') {
    backgroundColor = colors.scarlet;
    label = 'Closed';
  } else if (status === 'COMPLETED') {
    backgroundColor = '#64748b';
    label = 'Completed';
  } else if (status === 'EXPIRED') {
    backgroundColor = '#94a3b8';
    label = 'Expired';
  }
  return (
    <View style={[pillStyles.outer, { backgroundColor }]}>
      <Text style={[pillStyles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  outer: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

function buildChatList(messages: Message[]): ChatListItem[] {
  const items: ChatListItem[] = [];
  let lastDate = '';
  messages.forEach((msg, index) => {
    const dateStr = msg.createdAt.slice(0, 10);
    if (dateStr !== lastDate) {
      lastDate = dateStr;
      items.push({ type: 'date', id: `date-${dateStr}`, date: msg.createdAt });
    }
    items.push({ type: 'message', message: msg, index });
  });
  return items;
}

function PodBackControl({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      android_ripple={null}
    >
      <Ionicons name="chevron-back" size={26} color="#111111" />
    </Pressable>
  );
}

export default function PodScreen({ route, navigation }: Props) {
  const { podId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [pod, setPod] = useState<Pod | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [locking, setLocking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reportedNoShows, setReportedNoShows] = useState<Set<string>>(new Set());
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: 'message' | 'pod';
    messageId?: string;
    podId?: string;
  } | null>(null);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [reactionTargetMsgId, setReactionTargetMsgId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<{ messageId: string; name: string; content: string } | null>(null);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [recapModalVisible, setRecapModalVisible] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recapPromptShownRef = useRef(false);
  const peopleYouMetShownRef = useRef(false);

  const maybeShowPeopleYouMet = useCallback(async (pod: Pod) => {
    if (peopleYouMetShownRef.current) return;
    if (pod.status !== 'COMPLETED') return;
    const myMember = pod.members.find((m) => m.userId === user?.id);
    if (!myMember?.confirmedAt) return;

    const key = `peopleYouMet_seen_${podId}`;
    const seen = await AsyncStorage.getItem(key);
    if (seen) return;

    peopleYouMetShownRef.current = true;
    await AsyncStorage.setItem(key, '1');
    navigation.navigate('PeopleYouMet', { podId });
  }, [podId, user?.id, navigation]);

  const fetchPod = useCallback(async () => {
    try {
      const data = await getPod(podId);
      setPod(data);
      // Auto-show recap prompt once if pod is COMPLETED and user hasn't submitted
      if (data.status === 'COMPLETED' && data.myRecap === null && !recapPromptShownRef.current) {
        const isMember = data.members.some((m: { userId: string }) => m.userId === user?.id);
        if (isMember) {
          recapPromptShownRef.current = true;
          setRecapModalVisible(true);
        }
      }
      // Auto-show "people you met" once per completed pod
      maybeShowPeopleYouMet(data);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load pod');
    }
  }, [podId, user?.id, maybeShowPeopleYouMet]);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await getMessages(podId);
      setMessages(data.messages);
      setTypingUserIds(data.typingUserIds ?? []);
    } catch {
      // silently ignore poll errors
    }
  }, [podId]);

  useEffect(() => {
    const init = async () => {
      await fetchPod();
      await fetchMessages();
      setLoading(false);
    };
    init();

    pollRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchPod, fetchMessages]);

  const handleMessageTextChange = useCallback(
    (text: string) => {
      setMessageText(text);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendPodTyping(podId).catch(() => {});
        typingTimeoutRef.current = null;
      }, 300);
    },
    [podId]
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
      title: pod?.activity?.title ?? 'Pod',
    });
  }, [navigation, pod?.activity?.title]);

  const typingUserName = useMemo(() => {
    if (typingUserIds.length === 0) return undefined;
    const id = typingUserIds[0];
    const members = pod?.members ?? [];
    const member = members.find((m) => m.userId === id);
    return member?.user?.name?.split(' ')[0] ?? 'Someone';
  }, [typingUserIds, pod?.members]);

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text) return;
    const replyToId = replyTarget?.messageId;
    const savedReply = replyTarget;
    setMessageText('');
    setReplyTarget(null);
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const msg = await sendMessage(podId, text, replyToId);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send message');
      setMessageText(text);
      if (savedReply) setReplyTarget(savedReply);
    } finally {
      setSending(false);
    }
  };

  if (loading || !pod) {
    return (
      <View style={styles.container}>
        <View style={[styles.podBackBar, { paddingTop: insets.top }]}>
          <PodBackControl onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.scarlet} />
        </View>
      </View>
    );
  }

  const creatorId = pod.creatorId ?? pod.members[0]?.user?.id;
  const isCreator = user?.id === creatorId;
  const memberCount = pod.members.length;
  const maxMembers = pod.maxMembers ?? 4;
  const minMembers = pod.minMembers ?? 2;
  const canLock = isCreator && pod.status === 'FORMING' && memberCount >= minMembers;
  const canUnlock = isCreator && pod.status === 'LOCKED' && memberCount < maxMembers;

  const myMember = pod.members.find((m) => m.userId === user?.id);
  const isMember = !!myMember;
  const alreadyConfirmed = !!myMember?.confirmedAt;
  const meetupInFuture = new Date(pod.meetupTime) > new Date();
  const canConfirm = pod.status === 'LOCKED' && meetupInFuture && !alreadyConfirmed;
  const confirmedCount = pod.members.filter((m) => m.confirmedAt).length;
  const otherMembers = pod.members.filter((m) => m.userId !== user?.id);
  const isOnWaitlist = pod.myWaitlistPosition !== null && pod.myWaitlistPosition !== undefined;
  const waitlistCount = pod.waitlistCount ?? 0;

  const handleLock = async () => {
    if (!canLock) return;
    setLocking(true);
    try {
      const updated = await lockPod(podId);
      setPod(updated);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to lock pod');
    } finally {
      setLocking(false);
    }
  };

  const handleUnlock = async () => {
    if (!canUnlock) return;
    setLocking(true);
    try {
      const updated = await unlockPod(podId);
      setPod(updated);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to unlock pod');
    } finally {
      setLocking(false);
    }
  };

  const openReportMessage = (msg: Message) => {
    setReportTarget({ type: 'message', messageId: msg.id, podId: msg.podId });
    setReportModalVisible(true);
  };

  const handleReactionSelect = async (msgId: string, emoji: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    const myReaction = msg.reactions?.find((r) => r.userId === user?.id && r.emoji === emoji);
    try {
      const updated = myReaction
        ? await removePodMessageReaction(podId, msgId, emoji)
        : await addPodMessageReaction(podId, msgId, emoji);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? updated : m)));
    } catch {
      // silently ignore
    }
  };

  const openReportPod = () => {
    setReportTarget({ type: 'pod', podId });
    setReportModalVisible(true);
  };

  const handleRecapSubmit = async (rating: 1 | 2 | 3, note: string | null) => {
    try {
      const recap = await submitRecap(podId, { rating, note });
      setPod((prev) => (prev ? { ...prev, myRecap: recap } : prev));
      setRecapModalVisible(false);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit recap');
    }
  };

  const handleReportSuccess = () => {
    Alert.alert('Report submitted', 'Thanks.');
  };

  const handleShare = async () => {
    const url = `https://joinbridgeapp.com/pod/${podId}`;
    const podName = pod.activity?.title ?? 'Pod';
    const message = `Join my pod on Bridge! ${podName}\n${url}`;
    try {
      await Share.share({ message });
    } catch {
      // User cancelled or share not available — no-op
    }
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave Pod',
      'Are you sure you want to leave this pod? If you\'re the last member, the pod will be disbanded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              const res = await leavePod(podId);
              navigation.goBack();
              if (res.podDeleted) {
                // Pod was disbanded - user is already navigated back
              }
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to leave pod');
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
  };

  const handleConfirmAttendance = async () => {
    setConfirming(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const { confirmedAt } = await confirmAttendance(podId);
      setPod((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.userId === user?.id ? { ...m, confirmedAt } : m
          ),
        };
      });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to confirm attendance');
    } finally {
      setConfirming(false);
    }
  };

  const handleReportNoShow = async (targetUserId: string) => {
    try {
      await reportNoShow(podId, targetUserId);
      setReportedNoShows((prev) => new Set([...prev, targetUserId]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit report');
    }
  };

  const handleOpenInvite = async () => {
    try {
      const myFriends = await getFriends();
      // Filter out friends already in the pod
      const memberIds = new Set(pod?.members.map((m) => m.userId) ?? []);
      setFriends(myFriends.filter((f) => !memberIds.has(f.id)));
      setInviteModalVisible(true);
    } catch {
      Alert.alert('Error', 'Failed to load friends');
    }
  };

  const handleSendInvite = async (friend: FriendUser) => {
    setInvitingId(friend.id);
    try {
      await sendPodInvite(podId, friend.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Remove from list so it can't be double-invited
      setFriends((prev) => prev.filter((f) => f.id !== friend.id));
      Alert.alert('Invite sent', `${friend.name} has been invited to this pod.`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInvitingId(null);
    }
  };

  const keyboardVerticalOffset =
    Platform.OS === 'ios' ? insets.top + 44 : 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <View style={[styles.podBackBar, { paddingTop: insets.top }]}>
        <PodBackControl onPress={() => navigation.goBack()} />
      </View>
      <View style={styles.podBody}>
      <View style={styles.infoSectionOuter}>
        <View style={styles.infoCard}>
          <View style={styles.infoTopRow}>
            <View style={styles.infoTitleBlock}>
              <Text style={styles.activityTitle} numberOfLines={2}>
                {pod.activity?.title ?? 'Pod'}
              </Text>
              <PodStatusPill status={pod.status} />
            </View>
            <TouchableOpacity
              onPress={() => setShowOverflowMenu(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.6}
              style={styles.overflowHit}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>{formatPodTime(pod.meetupTime)}</Text>
            <View style={styles.metaDot} />
            <Ionicons
              name={pod.locationType === 'private' ? 'location-outline' : 'business-outline'}
              size={14}
              color={colors.textMuted}
            />
            <Text style={styles.metaText} numberOfLines={1}>
              {pod.location}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.memberScroll}
            contentContainerStyle={styles.memberScrollContent}
          >
            {pod.members.map((m, i) => {
              const isYou = m.userId === user?.id;
              return (
                <TouchableOpacity
                  key={m.userId}
                  style={[styles.memberAvatarWrap, i > 0 && { marginLeft: -AVATAR_OVERLAP }]}
                  onPress={() => {
                    if (!isYou) {
                      navigation.navigate('UserProfile', { userId: m.user.id, name: m.user.name });
                    }
                  }}
                  activeOpacity={isYou ? 1 : 0.7}
                >
                  <View style={styles.memberAvatarRing}>
                    <Avatar
                      name={m.user.name}
                      size={MEMBER_AVATAR}
                      uri={resolveAvatarUrl(m.user.avatarUrl)}
                      isYou={false}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

        {/* Member count progress bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min((memberCount / maxMembers) * 100, 100)}%` as `${number}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {memberCount} of {maxMembers} spots filled
            {pod.status === 'LOCKED' && meetupInFuture && confirmedCount > 0 && (
              <Text style={styles.confirmedInline}> · {confirmedCount} confirmed</Text>
            )}
          </Text>
        </View>

        {/* Waitlist info */}
        {waitlistCount > 0 && isMember && (
          <View style={styles.waitlistInfoRow}>
            <Ionicons name="people-outline" size={14} color={colors.textMutedLight} />
            <Text style={styles.waitlistInfoText}>
              {waitlistCount} {waitlistCount === 1 ? 'person' : 'people'} waitlisted
            </Text>
          </View>
        )}
        {isOnWaitlist && (
          <View style={styles.waitlistStatusRow}>
            <View style={styles.waitlistPositionBadge}>
              <Ionicons name="time-outline" size={14} color={colors.scarlet} />
              <Text style={styles.waitlistPositionText}>
                You're #{pod.myWaitlistPosition} on the waitlist
              </Text>
            </View>
            <TouchableOpacity
              style={styles.waitlistLeaveBtn}
              onPress={async () => {
                try {
                  await leaveWaitlist(podId);
                  setPod((prev) => prev ? { ...prev, myWaitlistPosition: null, waitlistCount: Math.max(0, (prev.waitlistCount ?? 1) - 1) } : prev);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (err: unknown) {
                  Alert.alert('Error', err instanceof Error ? err.message : 'Failed to leave waitlist');
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.waitlistLeaveBtnText}>Leave Waitlist</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionBtnShare}
            onPress={handleShare}
            accessibilityLabel="Share pod invite link"
          >
            <Text style={styles.actionBtnShareText}>Share</Text>
          </TouchableOpacity>
          {pod.status === 'FORMING' && (
            <TouchableOpacity
              style={styles.actionBtnInvite}
              onPress={handleOpenInvite}
              accessibilityLabel="Invite a friend"
            >
              <Text style={styles.actionBtnInviteText}>Invite Friend</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Creator lock/unlock + confirm attendance row */}
        {(canLock || canUnlock || canConfirm || (alreadyConfirmed && pod.status === 'LOCKED' && meetupInFuture)) && (
          <View style={styles.lockRow}>
            {canLock && (
              <TouchableOpacity style={styles.lockButton} onPress={handleLock} disabled={locking}>
                {locking ? (
                  <ActivityIndicator size="small" color={colors.scarlet} />
                ) : (
                  <>
                    <Ionicons name="lock-closed-outline" size={16} color={colors.scarlet} />
                    <Text style={styles.lockButtonText}>Lock Pod</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {canUnlock && (
              <TouchableOpacity style={styles.lockButton} onPress={handleUnlock} disabled={locking}>
                {locking ? (
                  <ActivityIndicator size="small" color={colors.scarlet} />
                ) : (
                  <>
                    <Ionicons name="lock-open-outline" size={16} color={colors.scarlet} />
                    <Text style={styles.lockButtonText}>Unlock Pod</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {canConfirm && (
              <TouchableOpacity
                style={[styles.lockButton, styles.confirmButton]}
                onPress={handleConfirmAttendance}
                disabled={confirming}
              >
                {confirming ? (
                  <ActivityIndicator size="small" color={colors.green} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.green} />
                    <Text style={styles.confirmButtonText}>I'll be there</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {alreadyConfirmed && pod.status === 'LOCKED' && meetupInFuture && (
              <View style={[styles.lockButton, styles.confirmedButton]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.green} />
                <Text style={styles.confirmedButtonText}>You're confirmed</Text>
              </View>
            )}
          </View>
        )}

        {/* Recap section for completed pods */}
        {pod.status === 'COMPLETED' && (
          <View style={styles.recapSection}>
            {(() => {
              const avgRating = pod.averageRating;
              const myRecap = pod.myRecap;
              const ratingEmoji = (r: number) =>
                r >= 2.5 ? '👍' : r >= 1.5 ? '😐' : '👎';
              const ratingLabel = (r: number) =>
                r >= 2.5 ? 'Mostly positive' : r >= 1.5 ? 'Mixed' : 'Could be better';
              return (
                <>
                  {avgRating !== null && avgRating !== undefined && (
                    <View style={styles.recapAvgRow}>
                      <Text style={styles.recapAvgEmoji}>{ratingEmoji(avgRating)}</Text>
                      <Text style={styles.recapAvgLabel}>{ratingLabel(avgRating)}</Text>
                      <Text style={styles.recapAvgSub}>group recap</Text>
                    </View>
                  )}
                  {myRecap ? (
                    <TouchableOpacity
                      style={styles.recapEditBtn}
                      onPress={() => setRecapModalVisible(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="create-outline" size={14} color={colors.scarlet} />
                      <Text style={styles.recapEditBtnText}>Edit your recap</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.recapRateBtn}
                      onPress={() => setRecapModalVisible(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="star-outline" size={14} color={colors.scarlet} />
                      <Text style={styles.recapRateBtnText}>Rate this meetup</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </View>
        )}

        {/* No-show reporting section for completed pods */}
        {pod.status === 'COMPLETED' && otherMembers.length > 0 && (
          <View style={styles.noShowSection}>
            <Text style={styles.noShowTitle}>Did everyone show up?</Text>
            {otherMembers.map((m) => {
              const alreadyReported =
                reportedNoShows.has(m.userId) ||
                (pod.noShowUserIds ?? []).some((id) => id === m.userId);
              return (
                <View key={m.userId} style={styles.noShowRow}>
                  <Text style={styles.noShowName}>{m.user.name.split(' ')[0]}</Text>
                  {alreadyReported ? (
                    <View style={styles.noShowReportedBadge}>
                      <Ionicons name="alert-circle" size={14} color={colors.textMutedLight} />
                      <Text style={styles.noShowReportedText}>No-show reported</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.noShowButton}
                      onPress={() =>
                        Alert.alert(
                          'Report No-Show',
                          `Mark ${m.user.name.split(' ')[0]} as a no-show for this meetup?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Report',
                              style: 'destructive',
                              onPress: () => handleReportNoShow(m.userId),
                            },
                          ]
                        )
                      }
                    >
                      <Text style={styles.noShowButtonText}>Didn't show</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
        </View>
      </View>

      {/* Pod Chat divider */}
      <View style={styles.chatDivider}>
        <View style={styles.chatDividerLine} />
        <Text style={styles.chatDividerText}>Pod Chat</Text>
        <View style={styles.chatDividerLine} />
      </View>

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={buildChatList(messages)}
        keyExtractor={(item) => item.type === 'date' ? item.id : item.message.id}
        style={styles.chatFlatList}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyChatState
            title="No messages yet"
            subtitle="Say hi to your pod!"
          />
        }
        ListFooterComponent={
          typingUserIds.length > 0 ? (
            <View style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}>
              <TypingIndicator userName={typingUserName} />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (item.type === 'date') {
            return <DateSeparator date={item.date} />;
          }
          const { message, index } = item;
          const isMe = message.user.id === user?.id;
          const showAvatar =
            !isMe &&
            (index === 0 || messages[index - 1].user.id !== message.user.id);
          const isFirstInGroup =
            index === 0 || messages[index - 1].user.id !== message.user.id;
          const isLastInGroup =
            index === messages.length - 1 ||
            messages[index + 1].user.id !== message.user.id;

          return (
            <MessageBubble
              message={message}
              isMe={isMe}
              showAvatar={showAvatar}
              isFirstInGroup={isFirstInGroup}
              isLastInGroup={isLastInGroup}
              listIndex={index}
              currentUserId={user?.id}
              showReadReceipt={false}
              onLongPress={() => setReactionTargetMsgId(message.id)}
              onAvatarPress={() =>
                navigation.navigate('UserProfile', {
                  userId: message.user.id,
                  name: message.user.name,
                })
              }
              resolveAvatarUrl={resolveAvatarUrl}
            />
          );
        }}
      />

      <ReactionPicker
        visible={!!reactionTargetMsgId}
        onClose={() => setReactionTargetMsgId(null)}
        onSelect={(emoji) => {
          if (reactionTargetMsgId) {
            handleReactionSelect(reactionTargetMsgId, emoji);
            setReactionTargetMsgId(null);
          }
        }}
        onReply={() => {
          const msg = messages.find((m) => m.id === reactionTargetMsgId);
          if (msg) {
            setReplyTarget({
              messageId: msg.id,
              name: msg.user.name,
              content: msg.content,
            });
          }
          setReactionTargetMsgId(null);
        }}
        onReport={() => {
          const msg = messages.find((m) => m.id === reactionTargetMsgId);
          if (msg) openReportMessage(msg);
          setReactionTargetMsgId(null);
        }}
        myReaction={
          reactionTargetMsgId
            ? messages.find((m) => m.id === reactionTargetMsgId)?.reactions?.find(
                (r) => r.userId === user?.id
              )?.emoji
            : undefined
        }
      />

      <ChatInput
        value={messageText}
        onChangeText={handleMessageTextChange}
        onSend={handleSend}
        sending={sending}
        placeholder="Message..."
        maxLength={500}
        replyPreview={
          replyTarget
            ? { name: replyTarget.name, content: replyTarget.content }
            : null
        }
        onCancelReply={() => setReplyTarget(null)}
      />

      <ReportModal
        visible={reportModalVisible}
        onClose={() => {
          setReportModalVisible(false);
          setReportTarget(null);
        }}
        onSuccess={handleReportSuccess}
        messageId={reportTarget?.type === 'message' ? reportTarget.messageId : undefined}
        podId={reportTarget?.podId ?? podId}
        podOnly={reportTarget?.type === 'pod'}
      />

      <RecapPromptModal
        visible={recapModalVisible}
        podTitle={pod?.activity?.title}
        initialRating={(pod?.myRecap?.rating as 1 | 2 | 3 | undefined) ?? null}
        initialNote={pod?.myRecap?.note}
        onSubmit={handleRecapSubmit}
        onClose={() => setRecapModalVisible(false)}
      />

      {/* Three-dot overflow menu */}
      <Modal
        visible={showOverflowMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOverflowMenu(false)}
      >
        <TouchableOpacity
          style={styles.overflowBackdrop}
          activeOpacity={1}
          onPress={() => setShowOverflowMenu(false)}
        >
          <View style={styles.overflowMenu}>
            <TouchableOpacity
              style={styles.overflowItem}
              onPress={() => { setShowOverflowMenu(false); openReportPod(); }}
            >
              <Ionicons name="flag-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.overflowItemText}>Report Pod</Text>
            </TouchableOpacity>
            {isMember && (
              <>
                <View style={styles.overflowDivider} />
                <TouchableOpacity
                  style={styles.overflowItem}
                  onPress={() => { setShowOverflowMenu(false); handleLeave(); }}
                >
                  <Ionicons name="exit-outline" size={16} color={colors.red} />
                  <Text style={[styles.overflowItemText, { color: colors.red }]}>Leave Pod</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Friend invite modal */}
      <Modal
        visible={inviteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.inviteModal}>
          <View style={styles.inviteModalHeader}>
            <Text style={styles.inviteModalTitle}>Invite a Friend</Text>
            <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          {friends.length === 0 ? (
            <View style={styles.inviteEmpty}>
              <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
              <Text style={styles.inviteEmptyText}>
                No friends available to invite. All your friends are already in this pod, or you have no friends yet.
              </Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(f) => f.id}
              contentContainerStyle={styles.inviteList}
              renderItem={({ item }) => (
                <View style={styles.inviteRow}>
                  <Avatar name={item.name} size={40} uri={resolveAvatarUrl(item.avatarUrl)} />
                  <Text style={styles.inviteRowName}>{item.name}</Text>
                  <TouchableOpacity
                    style={[styles.inviteBtn, invitingId === item.id && styles.inviteBtnDisabled]}
                    onPress={() => handleSendInvite(item)}
                    disabled={invitingId !== null}
                  >
                    {invitingId === item.id ? (
                      <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                      <Text style={styles.inviteBtnText}>Invite</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  /** In-screen top bar: only safe-area + horizontal inset for the bare back control (no native UIBarButtonItem pill). */
  podBackBar: {
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    minHeight: 44,
  },
  podBody: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cream,
  },

  infoSectionOuter: {
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    ...cardShadowCream,
  },
  infoTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  infoTitleBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  overflowHit: {
    marginTop: 2,
  },
  activityTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textOnLight,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.sm,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
    flexShrink: 1,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textMutedLight,
    marginHorizontal: 2,
    flexShrink: 0,
  },

  memberScroll: {
    marginBottom: spacing.sm,
  },
  memberScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  memberAvatarWrap: {
    zIndex: 1,
  },
  memberAvatarRing: {
    width: MEMBER_AVATAR + 4,
    height: MEMBER_AVATAR + 4,
    borderRadius: (MEMBER_AVATAR + 4) / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  progressSection: {
    gap: 5,
    marginBottom: spacing.sm,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: colors.progressTrack,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.scarlet,
    borderRadius: radii.pill,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  confirmedInline: {
    color: colors.green,
    fontWeight: '600',
  },

  waitlistInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  waitlistInfoText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  waitlistStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  waitlistPositionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: `${colors.scarlet}14`,
    borderRadius: radii.pill,
  },
  waitlistPositionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.scarlet,
  },
  waitlistLeaveBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  waitlistLeaveBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.red,
  },

  actionButtons: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionBtnShare: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.scarlet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnShareText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionBtnInvite: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: colors.scarlet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnInviteText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.scarlet,
  },

  lockRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.creamBorder,
  },
  lockButtonText: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.scarlet,
  },

  confirmButton: {
    borderColor: colors.green,
    backgroundColor: colors.greenLight,
  },
  confirmButtonText: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.green,
  },
  confirmedButton: {
    borderColor: colors.green,
    backgroundColor: colors.greenLight,
  },
  confirmedButtonText: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.green,
  },

  // Overflow menu
  overflowBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overflowMenu: {
    position: 'absolute',
    top: 52,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    minWidth: 160,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  overflowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  overflowItemText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  overflowDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.sm,
  },

  chatDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cream,
  },
  chatDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.creamBorder,
  },
  chatDividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMutedLight,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginHorizontal: spacing.sm,
  },
  recapSection: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.creamBorder,
    paddingTop: spacing.md,
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  recapAvgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  recapAvgEmoji: {
    fontSize: 16,
  },
  recapAvgLabel: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textOnLight,
  },
  recapAvgSub: {
    ...typography.tiny,
    color: colors.textMutedLight,
  },
  recapRateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: `${colors.scarlet}14`,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: `${colors.scarlet}40`,
  },
  recapRateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.scarlet,
  },
  recapEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  recapEditBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.scarlet,
  },
  noShowSection: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.creamBorder,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  noShowTitle: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 2,
  },
  noShowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noShowName: {
    ...typography.body,
    fontSize: 14,
    color: colors.textOnLight,
  },
  noShowButton: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.red,
    backgroundColor: '#fef2f2',
  },
  noShowButtonText: {
    ...typography.tiny,
    color: colors.red,
    fontWeight: '600',
  },
  noShowReportedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noShowReportedText: {
    ...typography.tiny,
    color: colors.textMutedLight,
  },

  chatFlatList: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  chatList: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  // Friend invite modal
  inviteModal: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  inviteModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inviteModalTitle: { ...typography.h3 },
  inviteEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  inviteEmptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  inviteList: { padding: spacing.lg, gap: spacing.sm },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  inviteRowName: { ...typography.bodyBold, flex: 1 },
  inviteBtn: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.scarlet,
    borderRadius: radii.md,
    minWidth: 72,
    alignItems: 'center',
  },
  inviteBtnDisabled: { opacity: 0.5 },
  inviteBtnText: { ...typography.bodyBold, color: colors.textInverse, fontSize: 13 },
});
