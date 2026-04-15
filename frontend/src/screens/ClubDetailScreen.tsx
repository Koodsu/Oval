import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Alert,
  Modal,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import {
  getClub,
  getClubMeetings,
  joinClub,
  leaveClub,
  getClubMessages,
  sendClubMessage,
  sendClubTyping,
  promoteClubMember,
  rsvpClubMeeting,
  createClubMeeting,
  API_USER_MESSAGE,
  resolveAvatarUrl,
} from '../api';
import type { ClubDetail, ClubMeetingWithMeta, ClubMemberWithUser, ClubMessage } from '../types';
import ExplorePillRow from '../components/ExplorePillRow';
import Avatar from '../components/Avatar';
import { MessageBubble, ChatInput, DateSeparator, EmptyChatState, TypingIndicator } from '../components/chat';
import { getSupabase } from '../lib/supabase';
import { buildClubChatList } from '../utils/clubChatList';
import { clubCircleBg } from '../utils/clubCircleBg';
import { getCategoryPillStyle } from '../utils/activityCategoryPill';
import { parseTypingUsersFromPresenceState, type PresenceStateRow } from '../utils/podPresenceTyping';
import { colors, spacing, home, cardShadowHome } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ClubDetail'>;

type DetailTab = 'meetings' | 'chat' | 'members';

const MEETING_TIME_MAX = new Date('2027-06-01T00:00:00.000Z');

const TAB_ITEMS = [
  { key: 'meetings' as const, label: 'Meetings' },
  { key: 'chat' as const, label: 'Chat' },
  { key: 'members' as const, label: 'Members' },
];

function roleSortOrder(role: string): number {
  if (role === 'ADMIN') return 0;
  if (role === 'OFFICER') return 1;
  return 2;
}

function sortClubMembers(members: ClubMemberWithUser[]): ClubMemberWithUser[] {
  return [...members].sort((a, b) => {
    const ra = roleSortOrder(a.role);
    const rb = roleSortOrder(b.role);
    if (ra !== rb) return ra - rb;
    return a.user.name.localeCompare(b.user.name);
  });
}

function clubMessageFromRealtimeInsert(
  row: Record<string, unknown>,
  members: ClubMemberWithUser[]
): ClubMessage | null {
  const id = row.id;
  const clubId = row.clubId;
  const userId = row.userId;
  const content = row.content;
  const createdAtRaw = row.createdAt;
  if (
    typeof id !== 'string' ||
    typeof clubId !== 'string' ||
    typeof userId !== 'string' ||
    typeof content !== 'string'
  ) {
    return null;
  }
  const member = members.find((m) => m.userId === userId);
  if (!member) return null;

  let createdAt: string;
  if (typeof createdAtRaw === 'string') {
    createdAt = createdAtRaw;
  } else if (createdAtRaw instanceof Date) {
    createdAt = createdAtRaw.toISOString();
  } else {
    createdAt = new Date().toISOString();
  }

  return {
    id,
    clubId,
    userId,
    content,
    createdAt,
    user: {
      id: member.user.id,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
    },
  };
}

function ClubBackControl({ onPress }: { onPress: () => void }) {
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

export default function ClubDetailScreen({ route, navigation }: Props) {
  const { clubId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [club, setClub] = useState<ClubDetail | null>(null);
  const [meetings, setMeetings] = useState<ClubMeetingWithMeta[]>([]);
  const [tab, setTab] = useState<DetailTab>('meetings');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [mtTitle, setMtTitle] = useState('');
  const [mtDesc, setMtDesc] = useState('');
  const [mtLocation, setMtLocation] = useState('');
  const [mtWhen, setMtWhen] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [mtPublic, setMtPublic] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ userId: string }[]>([]);

  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clubRef = useRef<ClubDetail | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentUserIdRef = useRef<string | undefined>(undefined);
  const apiTypingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceIdleUntrackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadClub = useCallback(async () => {
    const data = await getClub(clubId);
    setClub(data);
  }, [clubId]);

  const loadMeetings = useCallback(async () => {
    try {
      const list = await getClubMeetings(clubId);
      setMeetings(list);
    } catch {
      setMeetings([]);
    }
  }, [clubId]);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await getClubMessages(clubId);
      setMessages(data.messages);
      if (!getSupabase()) {
        setTypingUsers((data.typingUserIds ?? []).map((id) => ({ userId: id })));
      }
    } catch {
      // poll errors ignored
    }
  }, [clubId]);

  useEffect(() => {
    clubRef.current = club;
  }, [club]);

  currentUserIdRef.current = user?.id;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        await loadClub();
        await loadMeetings();
      } catch {
        if (!cancelled) {
          setLoadError(true);
          Alert.alert('Error', API_USER_MESSAGE);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadClub, loadMeetings]);

  useEffect(() => {
    if (tab !== 'chat' || !club?.isMember) return;

    const supabase = getSupabase();

    void fetchMessages();

    if (!supabase) {
      pollRef.current = setInterval(() => void fetchMessages(), 3000);
    }

    let channel: RealtimeChannel | null = null;
    if (supabase) {
      channel = supabase.channel(`club:${clubId}:messages`, {
        config: {
          presence: { key: user?.id ?? '' },
        },
      });
      channelRef.current = channel;

      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ClubMessage',
            filter: `clubId=eq.${clubId}`,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            const newId = row.id;
            if (typeof newId !== 'string') return;

            setMessages((prev) => {
              if (prev.some((m) => m.id === newId)) return prev;
              const members = clubRef.current?.members ?? [];
              const mapped = clubMessageFromRealtimeInsert(row, members);
              if (!mapped) return prev;
              return [...prev, mapped];
            });
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          }
        )
        .on('presence', { event: 'sync' }, () => {
          const ch = channelRef.current;
          if (!ch) return;
          const state = ch.presenceState() as Record<string, PresenceStateRow[]>;
          setTypingUsers(parseTypingUsersFromPresenceState(state, currentUserIdRef.current));
        })
        .subscribe();
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (presenceIdleUntrackRef.current) {
        clearTimeout(presenceIdleUntrackRef.current);
        presenceIdleUntrackRef.current = null;
      }
      if (apiTypingDebounceRef.current) {
        clearTimeout(apiTypingDebounceRef.current);
        apiTypingDebounceRef.current = null;
      }
      channelRef.current = null;
      if (supabase && channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [tab, club?.isMember, clubId, user?.id, fetchMessages]);

  const handleMessageTextChange = useCallback(
    (text: string) => {
      setMessageText(text);
      const supabase = getSupabase();
      if (supabase && user?.id) {
        if (presenceIdleUntrackRef.current) {
          clearTimeout(presenceIdleUntrackRef.current);
          presenceIdleUntrackRef.current = null;
        }
        const ch = channelRef.current;
        if (ch) {
          if (text.length > 0) {
            void ch.track({ userId: user.id, typing: true }).catch(() => {});
            presenceIdleUntrackRef.current = setTimeout(() => {
              void channelRef.current?.untrack().catch(() => {});
              presenceIdleUntrackRef.current = null;
            }, 500);
          } else {
            void ch.untrack().catch(() => {});
          }
        }
        return;
      }

      if (apiTypingDebounceRef.current) clearTimeout(apiTypingDebounceRef.current);
      apiTypingDebounceRef.current = setTimeout(() => {
        sendClubTyping(clubId).catch(() => {});
        apiTypingDebounceRef.current = null;
      }, 300);
    },
    [clubId, user?.id]
  );

  const typingCaption = useMemo(() => {
    if (typingUsers.length === 0) return '';
    if (typingUsers.length > 1) return 'Several people are typing...';
    const id = typingUsers[0].userId;
    const members = club?.members ?? [];
    const member = members.find((m) => m.userId === id);
    const first = member?.user?.name?.split(' ')[0] ?? 'Someone';
    return `${first} is typing...`;
  }, [typingUsers, club?.members]);

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text) return;
    if (presenceIdleUntrackRef.current) {
      clearTimeout(presenceIdleUntrackRef.current);
      presenceIdleUntrackRef.current = null;
    }
    void channelRef.current?.untrack().catch(() => {});
    setMessageText('');
    setSending(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const msg = await sendClubMessage(clubId, text);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Alert.alert('Error', API_USER_MESSAGE);
      setMessageText(text);
    } finally {
      setSending(false);
    }
  };

  const handleJoin = async () => {
    setJoinBusy(true);
    try {
      await joinClub(clubId);
      await loadClub();
      await loadMeetings();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : API_USER_MESSAGE);
    } finally {
      setJoinBusy(false);
    }
  };

  const handleLeave = () => {
    Alert.alert('Leave club', 'Are you sure you want to leave this club?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setLeaveBusy(true);
          try {
            await leaveClub(clubId);
            navigation.goBack();
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : API_USER_MESSAGE);
          } finally {
            setLeaveBusy(false);
          }
        },
      },
    ]);
  };

  const handleRsvp = async (meetingId: string, status: 'GOING' | 'MAYBE' | 'NOT_GOING') => {
    try {
      await rsvpClubMeeting(meetingId, status);
      await loadMeetings();
    } catch {
      Alert.alert('Error', API_USER_MESSAGE);
    }
  };

  const handlePromote = (targetUserId: string, name: string) => {
    Alert.alert('Promote to officer', `Promote ${name} to officer?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Promote',
        onPress: async () => {
          try {
            await promoteClubMember(clubId, targetUserId);
            await loadClub();
          } catch {
            Alert.alert('Error', API_USER_MESSAGE);
          }
        },
      },
    ]);
  };

  const openCreateMeeting = () => {
    setMtTitle('');
    setMtDesc('');
    setMtLocation('');
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    setMtWhen(d);
    setMtPublic(true);
    setCreateOpen(true);
  };

  const submitCreateMeeting = async () => {
    const title = mtTitle.trim();
    const location = mtLocation.trim();
    if (!title || !location) {
      Alert.alert('Missing fields', 'Please enter title and location.');
      return;
    }
    if (mtWhen >= MEETING_TIME_MAX) {
      Alert.alert('Invalid date', 'Meeting must be before June 1, 2027.');
      return;
    }
    if (mtWhen <= new Date()) {
      Alert.alert('Invalid date', 'Meeting time must be in the future.');
      return;
    }
    setCreateBusy(true);
    try {
      await createClubMeeting(clubId, {
        title,
        location,
        meetingTime: mtWhen.toISOString(),
        description: mtDesc.trim() || undefined,
        isPublic: mtPublic,
      });
      setCreateOpen(false);
      await loadMeetings();
    } catch {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setCreateBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.outer}>
        <View style={[styles.backBar, { paddingTop: insets.top }]}>
          <ClubBackControl onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={home.scarlet} />
        </View>
      </View>
    );
  }

  if (loadError || !club) {
    return (
      <View style={styles.outer}>
        <View style={[styles.backBar, { paddingTop: insets.top }]}>
          <ClubBackControl onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.center}>
          <Text style={styles.chatGateText}>Club unavailable.</Text>
        </View>
      </View>
    );
  }

  const pill = getCategoryPillStyle(club.category);
  const canCreateMeeting = club.myRole === 'ADMIN' || club.myRole === 'OFFICER';
  const sortedMembers = sortClubMembers(club.members);
  const emojiSize = 64;

  const meetingsBody = (
    <View style={styles.tabFlex}>
      <ScrollView
        style={styles.scrollMeetings}
        contentContainerStyle={styles.scrollMeetingsContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.upcomingHeader}>
          <View style={styles.upcomingDot} />
          <Text style={styles.upcomingLabel}>UPCOMING</Text>
        </View>
        {meetings.length === 0 ? (
          <Text style={styles.emptyMeetings}>No upcoming meetings</Text>
        ) : (
          meetings.map((m) => (
            <View key={m.id} style={[styles.meetingCard, cardShadowHome]}>
              <Text style={styles.meetingTitle}>{m.title}</Text>
              <Text style={styles.meetingWhen}>
                {new Date(m.meetingTime).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
              <Text style={styles.meetingLoc}>{m.location}</Text>
              <View style={styles.rsvpRow}>
                {(['GOING', 'MAYBE', 'NOT_GOING'] as const).map((st) => {
                  const active = m.myRsvp === st;
                  const label = st === 'GOING' ? 'Going' : st === 'MAYBE' ? 'Maybe' : 'Not Going';
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[styles.rsvpPill, active && styles.rsvpPillActive]}
                      onPress={() => void handleRsvp(m.id, st)}
                    >
                      <Text style={[styles.rsvpPillText, active && styles.rsvpPillTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.attendeeLine}>
                {m.attendeeCount} {m.attendeeCount === 1 ? 'person' : 'people'} going
              </Text>
            </View>
          ))
        )}
      </ScrollView>
      {canCreateMeeting && (
        <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 16 }]} onPress={openCreateMeeting}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );

  const chatBody =
    !club.isMember ? (
      <View style={styles.chatGate}>
        <Text style={styles.chatGateText}>Join the club to participate in chat.</Text>
      </View>
    ) : (
      <KeyboardAvoidingView
        style={styles.chatWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom + 8 : 0}
      >
        <View style={styles.chatListWrap}>
          <FlatList
            ref={flatListRef}
            data={buildClubChatList(messages)}
            keyExtractor={(item) => (item.type === 'time' ? item.id : item.message.id)}
            style={styles.chatFlatList}
            contentContainerStyle={styles.chatList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyChatState title="No messages yet" subtitle="Say hi to your club!" />
            }
            ListFooterComponent={
              <View style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}>
                <TypingIndicator visible={typingUsers.length > 0} caption={typingCaption} />
              </View>
            }
            renderItem={({ item }) => {
              if (item.type === 'time') {
                return <DateSeparator date={item.date} />;
              }
              const { message, index } = item;
              const isMe = message.user.id === user?.id;
              const showAvatar =
                !isMe && (index === 0 || messages[index - 1].user.id !== message.user.id);
              const isFirstInGroup =
                index === 0 || messages[index - 1].user.id !== message.user.id;
              const isLastInGroup =
                index === messages.length - 1 || messages[index + 1].user.id !== message.user.id;

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
        </View>
        <ChatInput
          value={messageText}
          onChangeText={handleMessageTextChange}
          onSend={handleSend}
          sending={sending}
          placeholder="Message..."
          maxLength={500}
        />
      </KeyboardAvoidingView>
    );

  const membersBody = (
    <FlatList
      data={sortedMembers}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.membersList}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const isAdmin = item.role === 'ADMIN';
        const isOfficer = item.role === 'OFFICER';
        const showRoleBadge = isAdmin || isOfficer;
        const canPromote =
          club.myRole === 'ADMIN' && item.role === 'MEMBER' && item.userId !== user?.id;
        return (
          <View style={[styles.memberRow, cardShadowHome]}>
            <Avatar name={item.user.name} size={44} uri={resolveAvatarUrl(item.user.avatarUrl)} />
            <View style={styles.memberMain}>
              <Text style={styles.memberName} numberOfLines={1}>
                {item.user.name}
              </Text>
              {item.user.classYear ? (
                <Text style={styles.memberMeta}>Class of {item.user.classYear}</Text>
              ) : null}
            </View>
            {showRoleBadge && (
              <View style={isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeOfficer}>
                <Text style={isAdmin ? styles.roleBadgeAdminText : styles.roleBadgeOfficerText}>
                  {isAdmin ? 'Admin' : 'Officer'}
                </Text>
              </View>
            )}
            {canPromote && (
              <TouchableOpacity onPress={() => handlePromote(item.userId, item.user.name)}>
                <Text style={styles.promoteLink}>Promote</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={[styles.backBar, { paddingTop: insets.top }]}>
        <ClubBackControl onPress={() => navigation.goBack()} />
      </View>

      <View style={styles.headerBlock}>
        <View style={[styles.emojiCircle, { width: emojiSize + 24, height: emojiSize + 24, backgroundColor: clubCircleBg(club.name) }]}>
          <Text style={{ fontSize: emojiSize * 0.55 }}>{club.emoji}</Text>
        </View>
        <Text style={styles.clubName}>{club.name}</Text>
        <View style={[styles.catPill, { backgroundColor: pill.pillBg }]}>
          <Text style={[styles.catPillText, { color: pill.pillText }]}>{pill.label}</Text>
        </View>
        <Text style={styles.memberCount}>
          {club.members.length} {club.members.length === 1 ? 'member' : 'members'}
        </Text>
        {!club.isMember ? (
          <TouchableOpacity
            style={[styles.joinFull, joinBusy && styles.btnDisabled]}
            onPress={() => void handleJoin()}
            disabled={joinBusy}
          >
            {joinBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.joinFullText}>Join</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.leaveBtn, leaveBusy && styles.btnDisabled]}
            onPress={handleLeave}
            disabled={leaveBusy}
          >
            {leaveBusy ? (
              <ActivityIndicator color={home.textSecondary} />
            ) : (
              <Text style={styles.leaveBtnText}>Leave</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <ExplorePillRow items={TAB_ITEMS} selectedKey={tab} onSelect={(k) => setTab(k as DetailTab)} />

      <View style={styles.tabBody}>
        {tab === 'meetings' && meetingsBody}
        {tab === 'chat' && chatBody}
        {tab === 'members' && membersBody}
      </View>

      <Modal visible={createOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalInner}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New meeting</Text>
            <TouchableOpacity onPress={() => setCreateOpen(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput style={styles.input} value={mtTitle} onChangeText={setMtTitle} placeholder="Title" />
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={mtDesc}
              onChangeText={setMtDesc}
              placeholder="Optional"
              multiline
            />
            <Text style={styles.inputLabel}>Location</Text>
            <TextInput style={styles.input} value={mtLocation} onChangeText={setMtLocation} placeholder="Location" />
            <Text style={styles.inputLabel}>When</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={18} color={home.textSecondary} />
              <Text style={styles.dateBtnText}>
                {mtWhen.toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={mtWhen}
                mode="datetime"
                minimumDate={new Date()}
                maximumDate={new Date(MEETING_TIME_MAX.getTime() - 60_000)}
                onChange={(_, d) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (d) setMtWhen(d);
                }}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              />
            )}
            <View style={styles.switchRow}>
              <Text style={styles.inputLabel}>Public meeting</Text>
              <Switch value={mtPublic} onValueChange={setMtPublic} trackColor={{ false: '#ccc', true: home.scarlet }} />
            </View>
            <TouchableOpacity
              style={[styles.submitMeeting, createBusy && styles.btnDisabled]}
              onPress={() => void submitCreateMeeting()}
              disabled={createBusy}
            >
              {createBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitMeetingText}>Create</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: home.creamBg,
  },
  outer: {
    flex: 1,
    backgroundColor: home.creamBg,
  },
  backBar: {
    backgroundColor: home.creamBg,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    minHeight: 44,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBlock: {
    backgroundColor: home.creamBg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  emojiCircle: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  clubName: {
    fontSize: 22,
    fontWeight: '700',
    color: home.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: spacing.xs,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  memberCount: {
    fontSize: 14,
    color: '#666666',
    marginBottom: spacing.sm,
  },
  joinFull: {
    width: '100%',
    backgroundColor: home.scarlet,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinFullText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  leaveBtn: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#C4C4C4',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: home.cardBg,
  },
  leaveBtnText: {
    color: home.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  tabBody: {
    flex: 1,
    minHeight: 0,
  },
  tabFlex: {
    flex: 1,
    minHeight: 0,
  },
  scrollMeetings: {
    flex: 1,
  },
  scrollMeetingsContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  upcomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  upcomingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: home.scarlet,
  },
  upcomingLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: home.textPrimary,
  },
  emptyMeetings: {
    textAlign: 'center',
    color: home.textSecondary,
    marginTop: spacing.lg,
  },
  meetingCard: {
    backgroundColor: home.cardBg,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  meetingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: home.textPrimary,
  },
  meetingWhen: {
    fontSize: 15,
    fontWeight: '600',
    color: home.scarlet,
    marginTop: 4,
  },
  meetingLoc: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  rsvpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm,
  },
  rsvpPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.creamBorder,
    backgroundColor: home.cardBg,
  },
  rsvpPillActive: {
    borderColor: home.scarlet,
    backgroundColor: '#FEE2E2',
  },
  rsvpPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: home.textSecondary,
  },
  rsvpPillTextActive: {
    color: home.scarlet,
  },
  attendeeLine: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: home.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: home.scarlet,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  chatWrap: {
    flex: 1,
    minHeight: 0,
  },
  chatListWrap: {
    flex: 1,
    minHeight: 0,
  },
  chatFlatList: {
    flex: 1,
  },
  chatList: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  chatGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  chatGateText: {
    fontSize: 16,
    color: home.textSecondary,
    textAlign: 'center',
  },
  membersList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: home.cardBg,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  memberMain: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: home.textPrimary,
  },
  memberMeta: {
    fontSize: 13,
    color: home.textSecondary,
    marginTop: 2,
  },
  roleBadgeAdmin: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeAdminText: {
    fontSize: 11,
    fontWeight: '700',
    color: home.scarlet,
  },
  roleBadgeOfficer: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeOfficerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
  promoteLink: {
    fontSize: 14,
    fontWeight: '600',
    color: home.scarlet,
  },
  modalInner: {
    flex: 1,
    backgroundColor: home.cardBg,
    paddingTop: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: home.textPrimary,
  },
  modalScroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: home.textSecondary,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.creamBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: home.textPrimary,
    backgroundColor: '#FAFAFA',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.creamBorder,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  dateBtnText: {
    fontSize: 15,
    color: home.textPrimary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  submitMeeting: {
    marginTop: spacing.lg,
    backgroundColor: home.scarlet,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitMeetingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
