import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
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
  cancelPod,
  confirmAttendance,
  createReport,
  createPod,
  editPod,
  getApiErrorMessage,
  getFriends,
  getMessages,
  getPeopleYouMet,
  getPod,
  getPodShareUrl,
  joinPod,
  joinWaitlist,
  kickPodMember,
  leavePod,
  leaveWaitlist,
  lockPod,
  reportNoShow,
  sendFriendRequest,
  sendPodInvite,
  trackEvent,
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
  ContentImage,
  DateTimeField,
  EmptyState,
  Field,
  IconButton,
  ListRow,
  ScreenHeader,
  SectionHeader,
  Sheet,
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
import { activityImageFor } from '../constants/contentImages';
import { getPodTitle } from '../utils/experience';
import { REPORT_REASON_OPTIONS } from '../constants/reportReasons';
import { getPodTitleValidationError } from '../utils/podTitleValidation';

import { toast } from '../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'PodDetail'>;

const POD_STATUS_LABELS: Record<Pod['status'], string> = {
  FORMING: 'Open',
  LOCKED: 'Locked',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

const CHAT_PREVIEW_COUNT = 2;

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
  const { podId, justCreated } = route.params;
  const { user } = useAuth();
  const [pod, setPod] = useState<Pod | null>(null);
  // Post-create share prompt (04 §4b): shown once, right after creating.
  const [showCreatePrompt, setShowCreatePrompt] = useState(Boolean(justCreated));
  useEffect(() => {
    // navigate('PodDetail') from inside PodDetail (recap chain) updates params
    // without remounting — re-sync so the new pod gets its prompt.
    setShowCreatePrompt(Boolean(justCreated));
  }, [podId, justCreated]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [peopleYouMet, setPeopleYouMet] = useState<PeopleYouMetUser[]>([]);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editTitleServerError, setEditTitleServerError] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState('');
  const [editTime, setEditTime] = useState(new Date());
  const editTitleError = editTitleServerError ?? getPodTitleValidationError(editTitle);

  const load = useCallback(
    async (showAlert = false) => {
      try {
        const podResponse = await getPod(podId);
        const isMember = podResponse.members.some((member) => member.userId === user?.id);
        const myMember = podResponse.members.find((member) => member.userId === user?.id);

        // Lightweight chat preview only — the full conversation lives in
        // PodChatScreen, which handles realtime + pagination.
        const messageResponse = isMember
          ? await getMessages(podId, { limit: CHAT_PREVIEW_COUNT }).catch(() => ({
              messages: [],
              typingUserIds: [],
              hasMore: false,
            }))
          : { messages: [], typingUserIds: [], hasMore: false };

        const friendList = isMember ? await getFriends().catch(() => []) : [];
        const metUsers =
          podResponse.status === 'COMPLETED' && !!myMember?.confirmedAt
            ? await getPeopleYouMet(podId)
                .then((response) => response.users)
                .catch(() => [])
            : [];

        setPod(podResponse);
        setMessages(messageResponse.messages);
        setFriends(friendList);
        setPeopleYouMet(metUsers);
        setLoadError(null);
      } catch (error) {
        setLoadError(getApiErrorMessage(error));
        if (showAlert) {
          toast.error('Could not load pod', getApiErrorMessage(error));
        }
      }
    },
    [podId, user?.id],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
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
  const podIsFull = pod ? pod.members.length >= pod.maxMembers : false;
  const canStartTwin = Boolean(pod && !meInPod && pod.status === 'FORMING' && podIsFull);
  const eligibleInviteFriends = useMemo(() => {
    if (!pod) return [];
    const memberIds = new Set(pod.members.map((member) => member.userId));
    return friends.filter((friend) => !memberIds.has(friend.id)).slice(0, 6);
  }, [friends, pod]);

  const handlePrimaryAction = async () => {
    if (!pod) return;
    if (!meInPod && pod.status !== 'FORMING') {
      toast.error('Pod is not open', 'This pod is already locked, completed, or expired.');
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
      toast.error('Action failed', getApiErrorMessage(error));
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
      toast.error('Could not leave waitlist', getApiErrorMessage(error));
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
      toast.error('Could not update pod', getApiErrorMessage(error));
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
      toast.error('Could not update privacy', getApiErrorMessage(error));
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
      toast.error('Could not confirm attendance', getApiErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  };

  const handleStartTwin = async () => {
    if (!pod) return;
    setActionBusy('twin');
    try {
      const twinTime = new Date(pod.meetupTime);
      twinTime.setMinutes(twinTime.getMinutes() + 30);
      const response = await createPod(pod.activityId, {
        title: pod.title || undefined,
        note: pod.note || undefined,
        location: pod.location,
        locationAddress: pod.locationAddress || undefined,
        meetupTime: twinTime.toISOString(),
        minMembers: 2,
        maxMembers: pod.maxMembers,
        latitude: pod.latitude ?? undefined,
        longitude: pod.longitude ?? undefined,
        visibility: 'public',
        twinFromPodId: pod.id,
        template: 'twin',
      });
      navigation.replace('PodDetail', { podId: response.id, justCreated: true });
    } catch (error) {
      toast.error('Could not start twin', getApiErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  };

  const handleShare = async () => {
    if (!pod) return;
    const shareUrl = getPodShareUrl(pod.id, user?.id);
    const spotsLeft = Math.max(0, pod.maxMembers - pod.members.length);
    const dayLabel =
      new Date(pod.meetupTime).toDateString() === new Date().toDateString()
        ? 'tonight'
        : new Date(pod.meetupTime).toLocaleDateString([], { weekday: 'short' });
    try {
      const result = await Share.share({
        title: `Join my ${getPodTitle(pod)} pod`,
        // Link lives in `url` only — putting it in `message` too makes iOS
        // texts show it twice, and only the first renders as the rich tappable card.
        message: `${getPodTitle(pod)} ${dayLabel} ${formatTime(pod.meetupTime)} - ${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'}. I'm in.`,
        url: shareUrl,
      });
      // Only count real shares — iOS reports dismissedAction when the user
      // closes the sheet without sharing (Android always reports shared).
      if (result.action !== Share.dismissedAction) {
        void trackEvent('invite.shared', { surface: 'pod_detail', podId: pod.id });
      }
    } catch (error) {
      toast.error('Could not open share sheet', getApiErrorMessage(error));
    }
  };

  const handleInviteFriend = async (friend: FriendUser) => {
    if (!pod) return;
    setActionBusy(`invite-${friend.id}`);
    try {
      await sendPodInvite(pod.id, friend.id);
      toast.success('Invite sent', `${friend.name} will see it in their inbox.`);
    } catch (error) {
      toast.error('Could not send invite', getApiErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  };

  const handleConnect = async (person: PeopleYouMetUser) => {
    setActionBusy(`met-${person.id}`);
    try {
      await sendFriendRequest(person.id);
      setPeopleYouMet((current) => current.filter((entry) => entry.id !== person.id));
      toast.success('Request sent', `${person.name} now has your friend request.`);
    } catch (error) {
      toast.error('Could not send request', getApiErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  };

  const handleNoShow = (userId: string, name: string) => {
    if (!pod) return;
    Alert.alert(
      `Report ${name} as a no-show?`,
      'Only do this if they committed to the pod and did not turn up. No-show reports affect their reliability record and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report no-show',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setActionBusy(`noshow-${userId}`);
              try {
                await reportNoShow(pod.id, userId);
                await load(false);
              } catch (error) {
                toast.error('Could not report no-show', getApiErrorMessage(error));
              } finally {
                setActionBusy(null);
              }
            })();
          },
        },
      ],
    );
  };

  const openEditPod = () => {
    if (!pod) return;
    setEditTitle(getPodTitle(pod));
    setEditTitleServerError(null);
    setEditLocation(pod.location);
    setEditTime(new Date(pod.meetupTime));
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!pod) return;
    if (getPodTitleValidationError(editTitle)) return;
    if (!editLocation.trim()) {
      toast.error('Add a meetup spot', 'The location cannot be empty.');
      return;
    }
    setActionBusy('edit');
    try {
      const updated = await editPod(pod.id, {
        title: editTitle.trim(),
        location: editLocation.trim(),
        meetupTime: editTime.toISOString(),
      });
      setPod(updated);
      setEditOpen(false);
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (/pod title|descriptive pod title|safety rules/i.test(message)) {
        setEditTitleServerError(message);
      } else {
        toast.error('Could not update pod', message);
      }
    } finally {
      setActionBusy(null);
    }
  };

  const handleReportPod = async (reason: string) => {
    if (!pod) return;
    setActionBusy(`report-${reason}`);
    try {
      await createReport({
        podId: pod.id,
        reason,
        details: `Pod title: ${getPodTitle(pod)}`,
      });
      setReportOpen(false);
      toast.success('Report sent', 'Thanks. We logged this pod for review.');
    } catch (error) {
      toast.error('Could not send report', getApiErrorMessage(error));
    } finally {
      setActionBusy(null);
    }
  };

  const confirmCancelPod = () => {
    if (!pod) return;
    Alert.alert(
      'Cancel this pod?',
      'Everyone who joined will be notified that the plan is off. This cannot be undone.',
      [
        { text: 'Keep pod', style: 'cancel' },
        {
          text: 'Cancel pod',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setActionBusy('cancel');
              try {
                const updated = await cancelPod(pod.id);
                setPod(updated);
                setEditOpen(false);
              } catch (error) {
                toast.error('Could not cancel pod', getApiErrorMessage(error));
              } finally {
                setActionBusy(null);
              }
            })();
          },
        },
      ],
    );
  };

  const confirmKickMember = (memberUserId: string, name: string) => {
    if (!pod) return;
    Alert.alert(`Remove ${name} from this pod?`, 'They can rejoin only if a spot is still open.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setActionBusy(`kick-${memberUserId}`);
            try {
              const updated = await kickPodMember(pod.id, memberUserId);
              setPod(updated);
            } catch (error) {
              toast.error('Could not remove member', getApiErrorMessage(error));
            } finally {
              setActionBusy(null);
            }
          })();
        },
      },
    ]);
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
          <EmptyState
            icon="alert-circle"
            title="Could not load pod"
            body={loadError}
            actionLabel="Try again"
            onAction={() => void load(false)}
          />
        </ScrollView>
      </AppBackdrop>
    );
  }

  return (
    <AppBackdrop>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
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
              title={getPodTitle(pod)}
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
            <Card padded={false}>
              <ContentImage
                source={activityImageFor(pod.activity)}
                seed={pod.activity?.id ?? pod.activityId}
                accessibilityLabel={`${getPodTitle(pod)} activity image`}
                aspectRatio={16 / 9}
                style={styles.podHeroImage}
              />
              <View style={styles.headerCardBody}>
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
                {pod.note ? (
                  <Text style={[typography.body, { color: colors.sub }]}>{pod.note}</Text>
                ) : null}
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
                  {!isCreator ? (
                    <IconButton
                      icon="flag-outline"
                      onPress={() => setReportOpen(true)}
                      accessibilityLabel="Report pod"
                      size={48}
                    />
                  ) : null}
                  {isCreator && (pod.status === 'FORMING' || pod.status === 'LOCKED') ? (
                    <IconButton
                      icon="pencil"
                      onPress={openEditPod}
                      accessibilityLabel="Edit pod details"
                      size={48}
                    />
                  ) : null}
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
              </View>
            </Card>

            {loadError ? <Banner message={loadError} kind="error" /> : null}

            {/* Post-create prompt (04 §4b): "Pod's up. Now fill it." — once per pod */}
            {showCreatePrompt && meInPod ? (
              <Card padded>
                <View style={styles.createPromptHeader}>
                  <Text style={typography.title}>Pod's up. Now fill it.</Text>
                  <IconButton
                    icon="close"
                    onPress={() => setShowCreatePrompt(false)}
                    accessibilityLabel="Dismiss"
                    size={32}
                  />
                </View>
                <Text style={[typography.caption, { marginTop: 2 }]}>
                  A pod with people in it fills itself. Drop the link in a group chat or invite a
                  friend.
                </Text>
                <View style={styles.createPromptActions}>
                  <Button
                    label="Share link"
                    icon="share-outline"
                    size="sm"
                    onPress={() => {
                      setShowCreatePrompt(false);
                      void handleShare();
                    }}
                  />
                  <Button
                    label="Invite friends"
                    icon="person-add-outline"
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      setShowCreatePrompt(false);
                      setInviteOpen(true);
                    }}
                  />
                </View>
              </Card>
            ) : null}

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

            {canStartTwin ? (
              <Card padded>
                <Text style={typography.title}>This pod is full</Text>
                <Text style={[typography.caption, { marginTop: 4 }]}>
                  Start the same plan nearby and catch the overflow.
                </Text>
                <Button
                  label="Start a twin"
                  icon="copy-outline"
                  onPress={() => void handleStartTwin()}
                  loading={actionBusy === 'twin'}
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

            {/* Chat preview — full conversation lives in PodChatScreen */}
            <Card padded>
              <View style={styles.chatPreviewHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.title}>The chat</Text>
                  <Text style={typography.captionSmall}>
                    {meInPod
                      ? `${pod.members.length} ${pod.members.length === 1 ? 'member' : 'members'} • live`
                      : 'Join the pod to read and send messages.'}
                  </Text>
                </View>
                <Sticker label="Live" tint={colors.successSoft} icon="radio" small tilt={2} />
              </View>
              {meInPod && messages.length ? (
                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  {messages.slice(-CHAT_PREVIEW_COUNT).map((message) => (
                    <View key={message.id} style={styles.chatPreviewRow}>
                      <Avatar name={message.user.name} uri={message.user.avatarUrl} size={28} />
                      <Text style={[typography.caption, { flex: 1 }]} numberOfLines={2}>
                        <Text style={{ fontFamily: fonts.bold }}>
                          {message.user.id === user?.id ? 'You' : message.user.name.split(' ')[0]}:
                        </Text>{' '}
                        {message.content}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : meInPod ? (
                <Text style={[typography.caption, { marginTop: spacing.md }]}>
                  No messages yet — start with an ETA or a quick check-in.
                </Text>
              ) : null}
              {meInPod ? (
                <Button
                  label="Open chat"
                  icon="chatbubbles"
                  onPress={() => navigation.navigate('PodChat', { podId: pod.id })}
                  style={{ marginTop: spacing.md }}
                />
              ) : null}
            </Card>

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
                        <View
                          key={member.id}
                          style={styles.member}
                        >
                          <Pressable
                            onPress={() =>
                              navigation.navigate('UserProfile', { userId: member.userId })
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${member.user.name}'s profile`}
                            style={styles.memberIdentity}
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
                          {isCreator &&
                          member.userId !== user?.id &&
                          (pod.status === 'FORMING' || pod.status === 'LOCKED') ? (
                            <Pressable
                              onPress={() => confirmKickMember(member.userId, member.user.name)}
                              disabled={actionBusy === `kick-${member.userId}`}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${member.user.name} from pod`}
                            >
                              <Text style={[typography.captionSmall, { color: colors.danger }]}>
                                {actionBusy === `kick-${member.userId}` ? 'Removing…' : 'Remove'}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
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
                        <Ionicons name="link" size={18} color={colors.accentText} />
                        <Text style={[typography.captionSmall, { flex: 1 }]} numberOfLines={1}>
                          {getPodShareUrl(pod.id, user?.id)}
                        </Text>
                        <Button label="Share" size="sm" variant="secondary" onPress={() => void handleShare()} />
                      </View>
                      <View style={{ gap: spacing.sm }}>
                        {eligibleInviteFriends.length ? (
                          eligibleInviteFriends.map((friend) => (
                            <View key={friend.id} style={styles.inviteRow}>
                              <Pressable
                                style={styles.inviteIdentity}
                                accessibilityRole="button"
                                accessibilityLabel={`Open ${friend.name}'s profile`}
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
                          accessibilityLabel={`Meetup map for ${pod.location}`}
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
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${person.name}'s profile`}
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
                              accessibilityRole="button"
                              accessibilityLabel={`Open ${member.user.name}'s profile`}
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
                              onPress={() => handleNoShow(member.userId, member.user.name)}
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
      </KeyboardAvoidingView>
      <Sheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite friends"
        kicker="FILL THE POD"
        scrollable
      >
        <View style={{ gap: spacing.lg }}>
          <Text style={typography.caption}>
            Send the pod directly to a friend or share the link with your group chat.
          </Text>
          <Button
            label="Share pod link"
            icon="share-outline"
            size="lg"
            onPress={() => void handleShare()}
          />
          <View style={{ gap: spacing.sm }}>
            {eligibleInviteFriends.length ? (
              eligibleInviteFriends.map((friend) => (
                <View key={friend.id} style={styles.inviteRow}>
                  <Pressable
                    style={styles.inviteIdentity}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${friend.name}'s profile`}
                    onPress={() => {
                      setInviteOpen(false);
                      navigation.navigate('UserProfile', { userId: friend.id });
                    }}
                  >
                    <Avatar name={friend.name} uri={friend.avatarUrl} size={42} />
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
              <Card padded>
                <Text style={typography.subheading}>No friends to invite yet</Text>
                <Text style={[typography.caption, { marginTop: 4 }]}>
                  Add people from their profiles or after a completed pod. You can still share the
                  link now.
                </Text>
              </Card>
            )}
          </View>
        </View>
      </Sheet>
      <Sheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report this pod"
        kicker="SAFETY"
        scrollable
      >
        <View style={{ gap: spacing.md }}>
          <Text style={typography.caption}>
            Choose the reason that best describes the title or plan. Reports are sent to Oval for
            manual review.
          </Text>
          {REPORT_REASON_OPTIONS.map((option) => (
            <Button
              key={option.value}
              label={option.label}
              variant="secondary"
              onPress={() => void handleReportPod(option.value)}
              loading={actionBusy === `report-${option.value}`}
              disabled={actionBusy?.startsWith('report-')}
            />
          ))}
        </View>
      </Sheet>
      <Sheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit pod details"
        kicker="CREATOR TOOLS"
      >
        <View style={{ gap: spacing.lg }}>
          <Field
            label="Pod title"
            value={editTitle}
            onChangeText={(value) => {
              setEditTitle(value);
              setEditTitleServerError(null);
            }}
            placeholder="Euchre at Morrill Tower"
            maxLength={60}
            error={editTitleError}
            hint="This is what people will see in the feed."
          />
          <View style={{ gap: 6 }}>
            <Text style={typography.kicker}>Location</Text>
            <TextInput
              value={editLocation}
              accessibilityLabel="Location"
              onChangeText={setEditLocation}
              placeholder="Where are you meeting?"
              placeholderTextColor={colors.faint}
              multiline
              style={[
                styles.editLocationInput,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                  color: colors.ink,
                },
              ]}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={typography.kicker}>Meetup time</Text>
            <DateTimeField
              value={editTime}
              minimumDate={new Date()}
              maximumDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
              onChange={setEditTime}
            />
          </View>
          <Text style={typography.captionSmall}>
            Everyone in the pod is notified when the plan changes.
          </Text>
          <Button
            label="Save changes"
            onPress={() => void handleEditSave()}
            loading={actionBusy === 'edit'}
            disabled={Boolean(editTitleError)}
            size="lg"
          />
          <Button
            label="Cancel pod"
            variant="ghost"
            onPress={confirmCancelPod}
            loading={actionBusy === 'cancel'}
          />
        </View>
      </Sheet>
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
  createPromptHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  createPromptActions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chatHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  messageList: {
    minHeight: 280,
    maxHeight: 520,
  },
  messageListContent: {
    padding: spacing.lg,
  },
  messageGroup: {
    marginTop: spacing.md,
  },
  messageGroupTight: {
    marginTop: 2,
  },
  messageDay: {
    alignItems: 'center' as const,
    marginVertical: spacing.md,
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
    color: t.colors.sub,
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
    color: t.colors.sub,
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
    borderTopWidth: StyleSheet.hairlineWidth,
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
    borderTopWidth: StyleSheet.hairlineWidth,
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
  memberIdentity: {
    alignItems: 'center' as const,
    gap: 5,
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
  podHeroImage: {
    borderWidth: 0,
    borderRadius: 0,
  },
  headerCardBody: {
    padding: spacing.lg,
    gap: spacing.md,
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
  chatPreviewHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  chatPreviewRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  reactionRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  reactionOption: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingVertical: 10,
  },
  reactionEmoji: {
    fontSize: 22,
  },
  editLocationInput: {
    borderWidth: BORDER_W,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
    fontFamily: fonts.medium,
    fontSize: 15,
    textAlignVertical: 'top' as const,
  },
}));
