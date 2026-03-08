import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { getPod, getMessages, sendMessage, lockPod, unlockPod, leavePod, confirmAttendance, reportNoShow, resolveAvatarUrl } from '../api';
import { Pod, Message } from '../types';
import { useAuth } from '../context/AuthContext';
import Avatar, { AvatarStack } from '../components/Avatar';
import StatusBadge from '../components/StatusBadge';
import ReportModal from '../components/ReportModal';
import { colors, spacing, radii, shadows, typography } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<RootStackParamList, 'Pod'>;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setMessages(data);
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

  const toggleHeader = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHeaderExpanded(!headerExpanded);
  };

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text) return;
    setMessageText('');
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const msg = await sendMessage(podId, text);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send message');
      setMessageText(text);
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
              <Text style={styles.metaText}>{formatTime(pod.meetupTime)}</Text>
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
                <Text style={styles.lockButtonText}>Invite</Text>
              </TouchableOpacity>
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
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyChatContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.border} />
            <Text style={styles.emptyChatTitle}>No messages yet</Text>
            <Text style={styles.emptyChatSubtitle}>Say hi to your pod!</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isMe = item.user.id === user?.id;
          const showAvatar =
            !isMe &&
            (index === 0 || messages[index - 1].user.id !== item.user.id);
          const isLastInGroup =
            index === messages.length - 1 ||
            messages[index + 1].user.id !== item.user.id;

          return (
            <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
              {!isMe && (
                <View style={styles.avatarSlot}>
                  {showAvatar ? (
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('UserProfile', {
                          userId: item.user.id,
                          name: item.user.name,
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <Avatar name={item.user.name} size={28} uri={resolveAvatarUrl(item.user.avatarUrl)} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
              <View style={styles.bubbleColumn}>
                {showAvatar && !isMe && (
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('UserProfile', {
                        userId: item.user.id,
                        name: item.user.name,
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Text style={styles.senderName}>{item.user.name.split(' ')[0]}</Text>
                  </TouchableOpacity>
                )}
                {isMe ? (
                  <LinearGradient
                    colors={[...colors.chatMe]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.bubble,
                      styles.bubbleMe,
                      !isLastInGroup && styles.bubbleMeGrouped,
                    ]}
                  >
                    <Text style={styles.bubbleTextMe}>{item.content}</Text>
                  </LinearGradient>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.bubble,
                      styles.bubbleThem,
                      !isLastInGroup && styles.bubbleThemGrouped,
                    ]}
                    onLongPress={() => openReportMessage(item)}
                    activeOpacity={1}
                    delayLongPress={400}
                  >
                    <Text style={styles.bubbleTextThem}>{item.content}</Text>
                  </TouchableOpacity>
                )}
                {isLastInGroup && (
                  <Text style={[styles.timestamp, isMe && styles.timestampMe]}>
                    {timeAgo(item.createdAt)}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Input Bar */}
      <View style={[styles.inputBar, shadows.sm]}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder="Message..."
            placeholderTextColor={colors.textTertiary}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
          />
        </View>
        <TouchableOpacity
          onPress={handleSend}
          disabled={!messageText.trim() || sending}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={
              !messageText.trim() || sending
                ? ['#cbd5e1', '#cbd5e1']
                : [...colors.gradient]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sendButton}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

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
  emptyChatContainer: {
    alignItems: 'center',
    marginTop: 80,
    gap: spacing.sm,
  },
  emptyChatTitle: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  emptyChatSubtitle: {
    ...typography.caption,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 3,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  avatarSlot: {
    width: 32,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bubbleColumn: {
    maxWidth: '75%',
  },
  senderName: {
    ...typography.tiny,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 6,
  },
  bubbleMeGrouped: {
    borderBottomRightRadius: 18,
    borderTopRightRadius: 18,
  },
  bubbleThem: {
    backgroundColor: colors.chatThem,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
  },
  bubbleThemGrouped: {
    borderBottomLeftRadius: 18,
    borderTopLeftRadius: 18,
  },
  bubbleTextMe: {
    ...typography.body,
    color: '#ffffff',
  },
  bubbleTextThem: {
    ...typography.body,
    color: colors.text,
  },
  timestamp: {
    ...typography.tiny,
    fontSize: 10,
    marginTop: 2,
    marginBottom: 6,
    marginLeft: 4,
  },
  timestampMe: {
    textAlign: 'right',
    marginRight: 4,
    marginLeft: 0,
  },

  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  textInput: {
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10,
    maxHeight: 100,
    lineHeight: 20,
    letterSpacing: 0,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
