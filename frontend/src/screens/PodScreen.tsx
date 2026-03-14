import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
  Share,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import {
  getPod, getMessages, sendMessage, addPodMessageReaction, removePodMessageReaction,
  sendPodTyping,
  lockPod, unlockPod, leavePod,
  confirmAttendance, reportNoShow, resolveAvatarUrl,
  getFriends, sendPodInvite,
} from '../api';
import { Pod, Message, FriendUser } from '../types';
import { useAuth } from '../context/AuthContext';
import Avatar, { AvatarStack } from '../components/Avatar';
import StatusBadge from '../components/StatusBadge';
import ReportModal from '../components/ReportModal';
import { MessageBubble, ChatInput, DateSeparator, EmptyChatState, ReactionPicker, TypingIndicator } from '../components/chat';
import { colors, spacing, radii, shadows, typography } from '../theme';
import { formatPodTime } from '../utils/format';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<RootStackParamList, 'Pod'>;

type ChatListItem =
  | { type: 'date'; id: string; date: string }
  | { type: 'message'; message: Message; index: number };

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

export default function PodScreen({ route, navigation }: Props) {
  const { podId } = route.params;
  const { user } = useAuth();

  const [pod, setPod] = useState<Pod | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [locking, setLocking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(true);
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

  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPod = useCallback(async () => {
    try {
      const data = await getPod(podId);
      setPod(data);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load pod');
    }
  }, [podId]);

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

  const typingUserName = useMemo(() => {
    if (typingUserIds.length === 0) return undefined;
    const id = typingUserIds[0];
    const members = pod?.members ?? [];
    const member = members.find((m) => m.userId === id);
    return member?.user?.name?.split(' ')[0] ?? 'Someone';
  }, [typingUserIds, pod?.members]);

  const toggleHeader = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHeaderExpanded(!headerExpanded);
  };

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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
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
  const alreadyConfirmed = !!myMember?.confirmedAt;
  const meetupInFuture = new Date(pod.meetupTime) > new Date();
  const canConfirm = pod.status === 'LOCKED' && meetupInFuture && !alreadyConfirmed;
  const confirmedCount = pod.members.filter((m) => m.confirmedAt).length;
  const otherMembers = pod.members.filter((m) => m.userId !== user?.id);

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

  const handleReportSuccess = () => {
    Alert.alert('Report submitted', 'Thanks.');
  };

  const handleShare = async () => {
    const url = `https://bridge.app/pod/${podId}`;
    try {
      await Share.share({
        message: `Join my pod on Bridge: ${url}`,
        url, // iOS only — shows URL separately in share sheet
      });
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 95 : 0}
    >
      {/* Collapsible Pod Info Header */}
      <TouchableOpacity
        style={[styles.infoSection, shadows.sm]}
        onPress={toggleHeader}
        activeOpacity={0.8}
      >
        <View style={styles.infoTopRow}>
          <View style={styles.infoTitleArea}>
            <Text style={styles.activityTitle} numberOfLines={1}>
              {pod.activity?.title ?? 'Pod'}
            </Text>
            <StatusBadge status={pod.status} size="md" />
          </View>
          <Ionicons
            name={headerExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textTertiary}
          />
        </View>

        {headerExpanded && (
          <View style={styles.infoExpanded}>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.metaText}>{formatPodTime(pod.meetupTime)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons
                name={pod.locationType === 'private' ? 'location-outline' : 'business-outline'}
                size={14}
                color={colors.textTertiary}
              />
              <Text style={styles.metaText}>{pod.location}</Text>
            </View>
            <View style={styles.membersSection}>
              <View style={styles.membersLabelRow}>
                <Text style={styles.membersLabel}>
                  Members {memberCount}/{maxMembers}
                </Text>
                {pod.status === 'LOCKED' && meetupInFuture && confirmedCount > 0 && (
                  <View style={styles.confirmedBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.green} />
                    <Text style={styles.confirmedBadgeText}>{confirmedCount} confirmed</Text>
                  </View>
                )}
              </View>
              <AvatarStack
                members={pod.members}
                currentUserId={user?.id}
                size={30}
                onMemberPress={(m) =>
                  navigation.navigate('UserProfile', {
                    userId: m.user.id,
                    name: m.user.name,
                  })
                }
              />
            </View>
            <View style={styles.lockRow}>
              {(canLock || canUnlock) && (
                <>
                  {canLock && (
                    <TouchableOpacity
                      style={styles.lockButton}
                      onPress={handleLock}
                      disabled={locking}
                    >
                      {locking ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Ionicons name="lock-closed-outline" size={16} color={colors.primary} />
                          <Text style={styles.lockButtonText}>Lock Pod</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  {canUnlock && (
                    <TouchableOpacity
                      style={styles.lockButton}
                      onPress={handleUnlock}
                      disabled={locking}
                    >
                      {locking ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Ionicons name="lock-open-outline" size={16} color={colors.primary} />
                          <Text style={styles.lockButtonText}>Unlock Pod</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
              <TouchableOpacity
                style={[styles.lockButton, styles.shareButton]}
                onPress={handleShare}
                accessibilityLabel="Share pod invite link"
              >
                <Ionicons name="share-outline" size={16} color={colors.primary} />
                <Text style={styles.lockButtonText}>Share</Text>
              </TouchableOpacity>
              {pod.status === 'FORMING' && (
                <TouchableOpacity
                  style={[styles.lockButton, styles.shareButton]}
                  onPress={handleOpenInvite}
                  accessibilityLabel="Invite a friend"
                >
                  <Ionicons name="person-add-outline" size={16} color={colors.primary} />
                  <Text style={styles.lockButtonText}>Invite Friend</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.lockButton, styles.leaveButton]}
                onPress={handleLeave}
                disabled={leaving}
              >
                {leaving ? (
                  <ActivityIndicator size="small" color={colors.red} />
                ) : (
                  <>
                    <Ionicons name="exit-outline" size={16} color={colors.red} />
                    <Text style={styles.leaveButtonText}>Leave Pod</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.lockButton, styles.reportButton]}
                onPress={openReportPod}
              >
                <Ionicons name="flag-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.reportButtonText}>Report Pod</Text>
              </TouchableOpacity>
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

            {/* No-show reporting section for completed pods */}
            {pod.status === 'COMPLETED' && otherMembers.length > 0 && (
              <View style={styles.noShowSection}>
                <Text style={styles.noShowTitle}>Did everyone show up?</Text>
                {otherMembers.map((m) => {
                  const alreadyReported =
                    reportedNoShows.has(m.userId) ||
                    (pod.noShowUserIds ?? []).some(
                      (id) => id === m.userId
                    );
                  return (
                    <View key={m.userId} style={styles.noShowRow}>
                      <Text style={styles.noShowName}>{m.user.name.split(' ')[0]}</Text>
                      {alreadyReported ? (
                        <View style={styles.noShowReportedBadge}>
                          <Ionicons name="alert-circle" size={14} color={colors.textTertiary} />
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
        )}
      </TouchableOpacity>

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={buildChatList(messages)}
        keyExtractor={(item) => item.type === 'date' ? item.id : item.message.id}
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
            <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
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
          const isLastInGroup =
            index === messages.length - 1 ||
            messages[index + 1].user.id !== message.user.id;

          return (
            <MessageBubble
              message={message}
              isMe={isMe}
              showAvatar={showAvatar}
              isLastInGroup={isLastInGroup}
              currentUserId={user?.id}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },

  // Info Header
  infoSection: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoTitleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
    marginRight: spacing.sm,
  },
  activityTitle: {
    ...typography.h3,
    fontSize: 18,
    flex: 1,
  },
  infoExpanded: {
    marginTop: spacing.sm + 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    ...typography.caption,
    fontSize: 13,
  },
  membersSection: {
    marginTop: spacing.sm + 2,
    gap: spacing.sm,
  },
  membersLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  membersLabel: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.greenLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  confirmedBadgeText: {
    ...typography.tiny,
    color: colors.green,
    fontWeight: '600',
  },
  lockRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lockButtonText: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.primary,
  },
  shareButton: {
    borderColor: colors.primary,
    backgroundColor: '#eef2ff',
  },
  leaveButton: {
    borderColor: colors.red,
    backgroundColor: '#fef2f2',
  },
  leaveButtonText: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.red,
  },
  reportButton: {
    borderColor: colors.border,
  },
  reportButtonText: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textSecondary,
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
  noShowSection: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  noShowTitle: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.textSecondary,
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
    color: colors.textTertiary,
  },

  // Chat
  chatList: {
    paddingHorizontal: spacing.md,
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
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minWidth: 72,
    alignItems: 'center',
  },
  inviteBtnDisabled: { opacity: 0.5 },
  inviteBtnText: { ...typography.bodyBold, color: colors.textInverse, fontSize: 13 },
});
