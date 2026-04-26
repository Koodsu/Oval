import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
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
  Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
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
  getClubAnnouncements,
  postClubAnnouncement,
  patchClubMemberRole,
  removeClubMember,
  rsvpClubMeeting,
  createClubMeeting,
  uploadClubAvatar,
  API_USER_MESSAGE,
  resolveAvatarUrl,
} from '../api';
import type {
  ClubAnnouncementRow,
  ClubDetail,
  ClubMeetingWithMeta,
  ClubMemberWithUser,
  ClubMessage,
} from '../types';
import ExplorePillRow from '../components/ExplorePillRow';
import Avatar from '../components/Avatar';
import { MessageBubble, ChatInput, DateSeparator, EmptyChatState, TypingIndicator } from '../components/chat';
import { getSupabase } from '../lib/supabase';
import { buildClubChatList } from '../utils/clubChatList';
import { clubCircleBg } from '../utils/clubCircleBg';
import { getCategoryPillStyle } from '../utils/activityCategoryPill';
import { parseTypingUsersFromPresenceState, type PresenceStateRow } from '../utils/podPresenceTyping';
import { colors, spacing, home, cardShadowHome } from '../theme';
import {
  OSU_CAMPUS_CENTER,
  OSU_CAMPUS_DELTA,
  OSU_CAMPUS_POLYGON,
  SCARLET,
} from '../constants/campusMap';

type Props = NativeStackScreenProps<RootStackParamList, 'ClubDetail'>;

type DetailTab = 'meetings' | 'chat' | 'announcements' | 'members';

type ClubMyRole = 'ADMIN' | 'OFFICER' | 'MEMBER' | null;

const MEETING_TIME_MAX = new Date('2027-06-01T00:00:00.000Z');

const TAB_ITEMS = [
  { key: 'meetings' as const, label: 'Meetings' },
  { key: 'chat' as const, label: 'Chat' },
  { key: 'announcements' as const, label: 'Announcements' },
  { key: 'members' as const, label: 'Members' },
];

function parseClubMyRole(members: ClubMemberWithUser[], userId: string | undefined): ClubMyRole {
  if (!userId) return null;
  const r = members.find((m) => m.userId === userId)?.role;
  if (r === 'ADMIN' || r === 'OFFICER' || r === 'MEMBER') return r;
  return null;
}

function isInsideCampus(coord: { latitude: number; longitude: number }): boolean {
  let inside = false;
  const n = OSU_CAMPUS_POLYGON.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = OSU_CAMPUS_POLYGON[i].longitude;
    const yi = OSU_CAMPUS_POLYGON[i].latitude;
    const xj = OSU_CAMPUS_POLYGON[j].longitude;
    const yj = OSU_CAMPUS_POLYGON[j].latitude;
    const intersect =
      yi > coord.latitude !== yj > coord.latitude &&
      coord.longitude < ((xj - xi) * (coord.latitude - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function MemberRoleBadge({ role }: { role: string }) {
  if (role === 'ADMIN') {
    return (
      <View style={styles.roleBadgeAdmin}>
        <Text style={styles.roleBadgeAdminText}>Admin</Text>
      </View>
    );
  }
  if (role === 'OFFICER') {
    return (
      <View style={styles.roleBadgeOfficer}>
        <Text style={styles.roleBadgeOfficerText}>Officer</Text>
      </View>
    );
  }
  return (
    <View style={styles.roleBadgeMember}>
      <Text style={styles.roleBadgeMemberText}>Member</Text>
    </View>
  );
}

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

function buildCalendarGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(year, month, 1 - startOffset + i));
  }
  return cells;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  const [mtTitleError, setMtTitleError] = useState('');
  const [mtLocationError, setMtLocationError] = useState('');
  const [mtDateError, setMtDateError] = useState('');
  const [mtFormError, setMtFormError] = useState('');
  const [mtPickedCoords, setMtPickedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mtMapError, setMtMapError] = useState('');

  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ userId: string }[]>([]);

  const [announcements, setAnnouncements] = useState<ClubAnnouncementRow[]>([]);
  const [announcementText, setAnnouncementText] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [avatarUploadBusy, setAvatarUploadBusy] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clubRef = useRef<ClubDetail | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentUserIdRef = useRef<string | undefined>(undefined);
  const apiTypingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceIdleUntrackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calendar view state
  const [meetingViewMode, setMeetingViewMode] = useState<'list' | 'calendar'>('list');
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calSelectedDay, setCalSelectedDay] = useState<Date | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

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

  const loadAnnouncements = useCallback(async () => {
    try {
      const res = await getClubAnnouncements(clubId, { page: 1, limit: 50 });
      setAnnouncements(res.items);
    } catch {
      setAnnouncements([]);
    }
  }, [clubId]);

  const handlePickClubAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAvatarUploadBusy(true);
    try {
      const { avatarUrl } = await uploadClubAvatar(club!.id, asset.uri);
      setClub((prev) => prev && { ...prev, avatarUrl });
    } catch {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setAvatarUploadBusy(false);
    }
  };

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

  useEffect(() => {
    if (tab !== 'announcements') return;
    void loadAnnouncements();
  }, [tab, loadAnnouncements]);

  const myRole = useMemo(
    () => parseClubMyRole(club?.members ?? [], user?.id),
    [club?.members, user?.id]
  );

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

  const openDaySheet = useCallback((day: Date) => {
    setCalSelectedDay(day);
    sheetAnim.setValue(0);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [sheetAnim]);

  const closeDaySheet = useCallback(() => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setCalSelectedDay(null));
  }, [sheetAnim]);

  const patchMemberRoleAndReload = useCallback(
    async (targetUserId: string, role: 'OFFICER' | 'MEMBER') => {
      try {
        await patchClubMemberRole(clubId, targetUserId, { role });
        await loadClub();
      } catch {
        Alert.alert('Error', API_USER_MESSAGE);
      }
    },
    [clubId, loadClub]
  );

  const kickMemberAndReload = useCallback(
    async (targetUserId: string) => {
      try {
        await removeClubMember(clubId, targetUserId);
        await loadClub();
      } catch {
        Alert.alert('Error', API_USER_MESSAGE);
      }
    },
    [clubId, loadClub]
  );

  const showMemberAdminMenu = useCallback(
    (item: ClubMemberWithUser) => {
      if (myRole !== 'ADMIN' || item.userId === user?.id || item.role === 'ADMIN') return;
      const name = item.user.name;
      if (item.role === 'MEMBER') {
        Alert.alert(name, undefined, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Promote to Officer',
            onPress: () => void patchMemberRoleAndReload(item.userId, 'OFFICER'),
          },
          {
            text: 'Remove from Club',
            style: 'destructive',
            onPress: () => {
              Alert.alert('Remove from club', `Remove ${name} from this club?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => void kickMemberAndReload(item.userId),
                },
              ]);
            },
          },
        ]);
      } else if (item.role === 'OFFICER') {
        Alert.alert(name, undefined, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Demote to Member',
            onPress: () => void patchMemberRoleAndReload(item.userId, 'MEMBER'),
          },
          {
            text: 'Remove from Club',
            style: 'destructive',
            onPress: () => {
              Alert.alert('Remove from club', `Remove ${name} from this club?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => void kickMemberAndReload(item.userId),
                },
              ]);
            },
          },
        ]);
      }
    },
    [myRole, user?.id, patchMemberRoleAndReload, kickMemberAndReload]
  );

  const submitAnnouncement = async () => {
    const text = announcementText.trim();
    if (!text) return;
    setPostingAnnouncement(true);
    try {
      await postClubAnnouncement(clubId, text);
      setAnnouncementText('');
      await loadAnnouncements();
    } catch {
      Alert.alert('Error', API_USER_MESSAGE);
    } finally {
      setPostingAnnouncement(false);
    }
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
    setMtPickedCoords(null);
    setMtMapError('');
    setCreateOpen(true);
  };

  const handleMtMapPress = async (coord: { latitude: number; longitude: number }) => {
    if (!isInsideCampus(coord)) {
      setMtMapError('Please select a location on OSU campus');
      return;
    }
    setMtMapError('');
    setMtPickedCoords(coord);
    try {
      const results = await Location.reverseGeocodeAsync(coord);
      if (results[0]) {
        const r = results[0];
        setMtLocation(r.name || r.street || r.district || 'OSU Campus');
        setMtLocationError('');
      }
    } catch {
      // user can edit manually
    }
  };

  const submitCreateMeeting = async () => {
    const title = mtTitle.trim();
    const location = mtLocation.trim();
    setMtFormError('');
    let hasError = false;
    if (!mtPickedCoords) {
      setMtMapError('Please drop a pin on the map to set your location');
      hasError = true;
    } else {
      setMtMapError('');
    }
    if (!title) {
      setMtTitleError('Title is required');
      hasError = true;
    } else {
      setMtTitleError('');
    }
    if (!location) {
      setMtLocationError('Location is required');
      hasError = true;
    } else {
      setMtLocationError('');
    }
    if (mtWhen >= MEETING_TIME_MAX) {
      setMtDateError('Meeting must be before June 1, 2027');
      hasError = true;
    } else if (mtWhen <= new Date()) {
      setMtDateError('Meeting time must be in the future');
      hasError = true;
    } else {
      setMtDateError('');
    }
    if (hasError) return;
    setCreateBusy(true);
    try {
      await createClubMeeting(clubId, {
        title,
        location,
        meetingTime: mtWhen.toISOString(),
        description: mtDesc.trim() || undefined,
        isPublic: mtPublic,
        latitude: mtPickedCoords.latitude,
        longitude: mtPickedCoords.longitude,
      });
      setCreateOpen(false);
      await loadMeetings();
    } catch {
      setMtFormError('Something went wrong. Please try again.');
    } finally {
      setCreateBusy(false);
    }
  };

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, ClubMeetingWithMeta[]>();
    for (const m of meetings) {
      const d = new Date(m.meetingTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [meetings]);

  const calendarCells = useMemo(() => buildCalendarGrid(calYear, calMonth), [calYear, calMonth]);

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
  const canCreateMeeting = myRole === 'ADMIN' || myRole === 'OFFICER';
  const canPostAnnouncement = myRole === 'ADMIN' || myRole === 'OFFICER';
  const sortedMembers = sortClubMembers(club.members);
  const emojiSize = 64;

  const renderRsvpPills = (m: ClubMeetingWithMeta) =>
    (['GOING', 'MAYBE', 'NOT_GOING'] as const).map((st) => {
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
    });

  const meetingsBody = (
    <View style={styles.tabFlex}>
      {/* ── View toggle header ── */}
      <View style={styles.meetingsViewToggleRow}>
        <View style={styles.upcomingHeader}>
          <View style={styles.upcomingDot} />
          <Text style={styles.upcomingLabel}>
            {meetingViewMode === 'list' ? 'UPCOMING' : `${MONTH_NAMES[calMonth]} ${calYear}`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setMeetingViewMode((prev) => (prev === 'list' ? 'calendar' : 'list'))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={meetingViewMode === 'list' ? 'calendar-outline' : 'list-outline'}
            size={22}
            color={home.scarlet}
          />
        </TouchableOpacity>
      </View>

      {meetingViewMode === 'list' ? (
        /* ── LIST VIEW ── */
        <ScrollView
          style={styles.scrollMeetings}
          contentContainerStyle={styles.scrollMeetingsContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
                <View style={styles.rsvpRow}>{renderRsvpPills(m)}</View>
                <Text style={styles.attendeeLine}>
                  {m.attendeeCount} {m.attendeeCount === 1 ? 'person' : 'people'} going
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        /* ── CALENDAR VIEW ── */
        <ScrollView
          contentContainerStyle={styles.calendarScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Month navigation */}
          <View style={styles.calMonthNav}>
            <TouchableOpacity
              onPress={() => {
                if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
                else setCalMonth((m) => m - 1);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color={home.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.calMonthTitle}>{MONTH_NAMES[calMonth]} {calYear}</Text>
            <TouchableOpacity
              onPress={() => {
                if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
                else setCalMonth((m) => m + 1);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-forward" size={22} color={home.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Calendar grid card */}
          <View style={[styles.calGrid, cardShadowHome]}>
            {/* Day-of-week labels */}
            <View style={styles.calDayLabelsRow}>
              {DAY_LABELS.map((label) => (
                <View key={label} style={styles.calDayLabelCell}>
                  <Text style={styles.calDayLabelText}>{label}</Text>
                </View>
              ))}
            </View>

            {/* 6 rows × 7 cells */}
            {Array.from({ length: 6 }).map((_, rowIdx) => {
              const rowCells = calendarCells.slice(rowIdx * 7, rowIdx * 7 + 7);
              return (
                <View key={rowIdx} style={styles.calRow}>
                  {rowCells.map((cellDate, colIdx) => {
                    const isCurrentMonth = cellDate.getMonth() === calMonth;
                    const today = new Date();
                    const isToday =
                      cellDate.getFullYear() === today.getFullYear() &&
                      cellDate.getMonth() === today.getMonth() &&
                      cellDate.getDate() === today.getDate();
                    const dayKey = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
                    const hasMeetings = isCurrentMonth && meetingsByDay.has(dayKey);
                    const isSelected =
                      calSelectedDay !== null &&
                      calSelectedDay.getFullYear() === cellDate.getFullYear() &&
                      calSelectedDay.getMonth() === cellDate.getMonth() &&
                      calSelectedDay.getDate() === cellDate.getDate();

                    return (
                      <TouchableOpacity
                        key={colIdx}
                        style={[styles.calCell, isSelected && styles.calCellSelected]}
                        onPress={() => { if (hasMeetings) openDaySheet(cellDate); }}
                        activeOpacity={hasMeetings ? 0.7 : 1}
                      >
                        <View style={[styles.calDateCircle, isToday && styles.calDateCircleToday]}>
                          <Text
                            style={[
                              styles.calDateNum,
                              !isCurrentMonth && styles.calDateNumOutside,
                              isToday && styles.calDateNumToday,
                            ]}
                          >
                            {cellDate.getDate()}
                          </Text>
                        </View>
                        {hasMeetings && <View style={styles.calMeetingDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* FAB */}
      {canCreateMeeting && (
        <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 16 }]} onPress={openCreateMeeting}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ── Day bottom sheet ── */}
      {calSelectedDay !== null && (() => {
        const dayKey = `${calSelectedDay.getFullYear()}-${String(calSelectedDay.getMonth() + 1).padStart(2, '0')}-${String(calSelectedDay.getDate()).padStart(2, '0')}`;
        const dayMeetings = meetingsByDay.get(dayKey) ?? [];
        const sheetTranslate = sheetAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [400, 0],
        });
        return (
          <Modal transparent visible animationType="none" onRequestClose={closeDaySheet}>
            <Pressable style={styles.sheetOverlay} onPress={closeDaySheet} />
            <Animated.View
              style={[styles.sheetContainer, { transform: [{ translateY: sheetTranslate }] }]}
            >
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetDayTitle}>
                {calSelectedDay.toLocaleDateString(undefined, {
                  weekday: 'long', month: 'long', day: 'numeric',
                })}
              </Text>
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {dayMeetings.map((m) => (
                  <View key={m.id} style={[styles.sheetMeetingCard, cardShadowHome]}>
                    <Text style={styles.sheetMeetingTitle}>{m.title}</Text>
                    <Text style={styles.sheetMeetingTime}>
                      {new Date(m.meetingTime).toLocaleString(undefined, {
                        hour: 'numeric', minute: '2-digit',
                      })}
                    </Text>
                    <Text style={styles.sheetMeetingLoc}>{m.location}</Text>
                    <View style={styles.rsvpRow}>{renderRsvpPills(m)}</View>
                    <Text style={styles.attendeeLine}>
                      {m.attendeeCount} {m.attendeeCount === 1 ? 'person' : 'people'} going
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          </Modal>
        );
      })()}
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

  const announcementsBody = (
    <KeyboardAvoidingView
      style={styles.announcementsWrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom + 8 : 0}
    >
      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        style={styles.announcementsFlatList}
        contentContainerStyle={styles.announcementsList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyAnnouncementsState}>
            <Ionicons name="megaphone-outline" size={40} color={home.textSecondary} />
            <Text style={styles.emptyMeetings}>No announcements yet</Text>
            <Text style={styles.emptyAnnouncementsBody}>Club officers can post announcements here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.announcementCard, cardShadowHome]}>
            <View style={styles.announcementTop}>
              <View style={styles.announcementAuthor}>
                <Avatar name={item.user.name} size={36} uri={resolveAvatarUrl(item.user.avatarUrl)} />
                <Text style={styles.announcementName} numberOfLines={1}>
                  {item.user.name}
                </Text>
              </View>
              <Text style={styles.announcementTime}>
                {new Date(item.createdAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <Text style={styles.announcementContent}>{item.content}</Text>
          </View>
        )}
      />
      {canPostAnnouncement && (
        <View style={[styles.announcementComposer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={styles.announcementInput}
            value={announcementText}
            onChangeText={setAnnouncementText}
            placeholder="Post an announcement..."
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.announcementSend, postingAnnouncement && styles.btnDisabled]}
            onPress={() => void submitAnnouncement()}
            disabled={postingAnnouncement}
          >
            {postingAnnouncement ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.announcementSendText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );

  const membersBody = (
    <FlatList
      data={sortedMembers}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.membersList}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const adminLongPress =
          myRole === 'ADMIN' && item.userId !== user?.id && item.role !== 'ADMIN';
        return (
          <Pressable
            onLongPress={adminLongPress ? () => showMemberAdminMenu(item) : undefined}
            delayLongPress={400}
          >
            <View style={[styles.memberRow, cardShadowHome]}>
              <Avatar name={item.user.name} size={44} uri={resolveAvatarUrl(item.user.avatarUrl)} />
              <View style={styles.memberMain}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {item.user.name}
                  </Text>
                  <MemberRoleBadge role={item.role} />
                </View>
                {item.user.classYear ? (
                  <Text style={styles.memberMeta}>{item.user.classYear}</Text>
                ) : null}
              </View>
            </View>
          </Pressable>
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
        {myRole === 'ADMIN' ? (
          <TouchableOpacity
            onPress={() => void handlePickClubAvatar()}
            disabled={avatarUploadBusy}
            activeOpacity={0.8}
          >
            <View style={[styles.emojiCircle, styles.emojiCircleRelative, { width: emojiSize + 24, height: emojiSize + 24, backgroundColor: clubCircleBg(club.name) }]}>
              {avatarUploadBusy ? (
                <ActivityIndicator color="#fff" />
              ) : club.avatarUrl ? (
                <Image
                  source={{ uri: resolveAvatarUrl(club.avatarUrl) }}
                  style={{ width: emojiSize + 24, height: emojiSize + 24, borderRadius: (emojiSize + 24) / 2 }}
                  onError={() => setClub((prev) => prev && { ...prev, avatarUrl: null })}
                />
              ) : (
                <Text style={{ fontSize: emojiSize * 0.55 }}>{club.emoji}</Text>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#CC0000" />
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.emojiCircle, { width: emojiSize + 24, height: emojiSize + 24, backgroundColor: clubCircleBg(club.name) }]}>
            {club.avatarUrl ? (
              <Image
                source={{ uri: resolveAvatarUrl(club.avatarUrl) }}
                style={{ width: emojiSize + 24, height: emojiSize + 24, borderRadius: (emojiSize + 24) / 2 }}
                onError={() => setClub((prev) => prev && { ...prev, avatarUrl: null })}
              />
            ) : (
              <Text style={{ fontSize: emojiSize * 0.55 }}>{club.emoji}</Text>
            )}
          </View>
        )}
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
        {tab === 'announcements' && announcementsBody}
        {tab === 'members' && membersBody}
      </View>

      <Modal
        visible={createOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setCreateOpen(false);
          setMtTitleError('');
          setMtLocationError('');
          setMtDateError('');
          setMtFormError('');
          setMtMapError('');
          setMtPickedCoords(null);
        }}
      >
        <View style={styles.modalInner}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New meeting</Text>
            <TouchableOpacity onPress={() => {
              setCreateOpen(false);
              setMtTitleError('');
              setMtLocationError('');
              setMtDateError('');
              setMtFormError('');
              setMtMapError('');
              setMtPickedCoords(null);
            }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
            <Text style={styles.inputLabel}>Location (tap to pin)</Text>
            <View style={styles.mtMapContainer}>
              <MapView
                provider={PROVIDER_DEFAULT}
                style={styles.mtMap}
                initialRegion={{ ...OSU_CAMPUS_CENTER, ...OSU_CAMPUS_DELTA }}
                onPress={(e) => void handleMtMapPress(e.nativeEvent.coordinate)}
              >
                <Polygon
                  coordinates={OSU_CAMPUS_POLYGON}
                  strokeColor={SCARLET}
                  strokeWidth={2}
                  fillColor="rgba(204,0,0,0.06)"
                />
                {mtPickedCoords && <Marker coordinate={mtPickedCoords} pinColor={SCARLET} />}
              </MapView>
            </View>
            {mtMapError ? <Text style={styles.mtMapError}>{mtMapError}</Text> : null}
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={[styles.input, mtTitleError ? styles.inputError : null]}
              value={mtTitle}
              onChangeText={(v) => { setMtTitle(v); if (mtTitleError) setMtTitleError(''); }}
              placeholder="Title"
            />
            {mtTitleError ? <Text style={styles.mtErrorText}>{mtTitleError}</Text> : null}
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={mtDesc}
              onChangeText={setMtDesc}
              placeholder="Optional"
              multiline
            />
            <Text style={styles.inputLabel}>Location</Text>
            <TextInput
              style={[styles.input, mtLocationError ? styles.inputError : null]}
              value={mtLocation}
              onChangeText={(v) => { setMtLocation(v); if (mtLocationError) setMtLocationError(''); }}
              placeholder="Location"
            />
            {mtLocationError ? <Text style={styles.mtErrorText}>{mtLocationError}</Text> : null}
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
            {mtDateError ? <Text style={styles.mtErrorText}>{mtDateError}</Text> : null}
            {showDatePicker && (
              <DateTimePicker
                value={mtWhen}
                mode="datetime"
                minimumDate={new Date()}
                maximumDate={new Date(MEETING_TIME_MAX.getTime() - 60_000)}
                onChange={(_, d) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (d) { setMtWhen(d); setMtDateError(''); }
                }}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              />
            )}
            <View style={styles.switchRow}>
              <Text style={styles.inputLabel}>Public meeting</Text>
              <Switch value={mtPublic} onValueChange={setMtPublic} trackColor={{ false: '#ccc', true: home.scarlet }} />
            </View>
            {mtFormError ? <Text style={styles.mtFormErrorText}>{mtFormError}</Text> : null}
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
  emojiCircleRelative: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
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
    marginTop: spacing.sm,
    fontWeight: '600',
    fontSize: 15,
  },
  emptyAnnouncementsState: {
    alignItems: 'center',
    paddingTop: spacing.xxl + spacing.lg,
    gap: 2,
  },
  emptyAnnouncementsBody: {
    textAlign: 'center',
    color: home.textSecondary,
    fontSize: 13,
    marginTop: spacing.xs,
    opacity: 0.7,
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
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: home.textPrimary,
    flexShrink: 1,
  },
  memberMeta: {
    fontSize: 13,
    color: home.textSecondary,
    marginTop: 2,
  },
  roleBadgeAdmin: {
    backgroundColor: '#CC0000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeAdminText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  roleBadgeOfficer: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeOfficerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  roleBadgeMember: {
    backgroundColor: '#F0EBE3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeMemberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666666',
  },
  announcementsWrap: {
    flex: 1,
    minHeight: 0,
  },
  announcementsFlatList: {
    flex: 1,
  },
  announcementsList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  announcementCard: {
    backgroundColor: home.cardBg,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  announcementTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  announcementAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  announcementName: {
    fontSize: 15,
    fontWeight: '700',
    color: home.textPrimary,
    flex: 1,
  },
  announcementTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  announcementContent: {
    marginTop: spacing.sm,
    fontSize: 15,
    color: home.textPrimary,
    lineHeight: 22,
  },
  announcementComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.creamBorder,
    backgroundColor: home.creamBg,
  },
  announcementInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.creamBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: home.textPrimary,
    backgroundColor: '#FAFAFA',
  },
  announcementSend: {
    backgroundColor: home.scarlet,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 44,
  },
  announcementSendText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
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
  inputError: {
    borderColor: '#CC0000',
    borderWidth: 1,
  },
  mtErrorText: {
    fontSize: 12,
    color: '#CC0000',
    marginTop: -4,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  mtFormErrorText: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 8,
  },
  mtMapContainer: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  mtMap: { flex: 1 },
  mtMapError: {
    fontSize: 12,
    color: SCARLET,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  // ── Meetings view toggle ──────────────────────────────────────────
  meetingsViewToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },

  // ── Calendar grid ─────────────────────────────────────────────────
  calendarScrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  calMonthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  calMonthTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: home.textPrimary,
  },
  calGrid: {
    backgroundColor: home.cardBg,
    borderRadius: 14,
    overflow: 'hidden',
    paddingBottom: 4,
  },
  calDayLabelsRow: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 4,
  },
  calDayLabelCell: {
    flex: 1,
    alignItems: 'center',
  },
  calDayLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999999',
    textTransform: 'uppercase',
  },
  calRow: {
    flexDirection: 'row',
  },
  calCell: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    paddingTop: 6,
  },
  calCellSelected: {
    backgroundColor: '#FEE2F2',
  },
  calDateCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDateCircleToday: {
    backgroundColor: home.scarlet,
  },
  calDateNum: {
    fontSize: 13,
    fontWeight: '500',
    color: home.textPrimary,
  },
  calDateNumOutside: {
    color: '#CCCCCC',
  },
  calDateNumToday: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calMeetingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: home.scarlet,
    marginTop: 2,
  },

  // ── Day bottom sheet ──────────────────────────────────────────────
  sheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: home.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingTop: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDDDDD',
    marginBottom: 12,
  },
  sheetDayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: home.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetScrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  sheetMeetingCard: {
    backgroundColor: home.creamBg,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sheetMeetingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: home.textPrimary,
  },
  sheetMeetingTime: {
    fontSize: 14,
    fontWeight: '600',
    color: home.scarlet,
    marginTop: 2,
  },
  sheetMeetingLoc: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
});
