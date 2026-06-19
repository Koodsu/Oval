import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getClub, getClubAnnouncements, getClubChannels, getClubMeetings } from '../api';
import type {
  ClubAnnouncementRow,
  ClubChannelRow,
  ClubDetail,
  ClubMeetingWithMeta,
} from '../types';

export const CLUB_PERMISSION_OPTIONS = [
  { value: 'MANAGE_MEMBERS', title: 'Manage members', body: 'Remove members and update roster access.' },
  { value: 'MANAGE_ROLES', title: 'Manage member tags', body: 'Create, delete, and assign member tags.' },
  { value: 'CREATE_MEETINGS', title: 'Create meetings', body: 'Schedule meetings and manage attendance.' },
  { value: 'POST_ANNOUNCEMENTS', title: 'Post announcements', body: 'Publish official club updates.' },
  { value: 'DELETE_MESSAGES', title: 'Moderate messages', body: 'Delete club chat messages.' },
  { value: 'MANAGE_CLUB', title: 'Manage club settings', body: 'Update club assets and delete the club.' },
] as const;

export const DEFAULT_OFFICER_PERMISSIONS = ['POST_ANNOUNCEMENTS', 'DELETE_MESSAGES'];

type CacheEntry = {
  club: ClubDetail;
  meetings: ClubMeetingWithMeta[];
  announcements: ClubAnnouncementRow[];
  channels: ClubChannelRow[];
  loadedAt: number;
};

const cache = new Map<string, CacheEntry>();
const CACHE_MS = 15_000;

export function roleRank(role: string | null | undefined) {
  if (role === 'OWNER') return 4;
  if (role === 'ADMIN') return 3;
  if (role === 'OFFICER') return 2;
  if (role === 'MEMBER') return 1;
  return 0;
}

export function useClub(clubId: string) {
  const cached = cache.get(clubId);
  const [club, setClubState] = useState<ClubDetail | null>(cached?.club ?? null);
  const [meetings, setMeetingsState] = useState<ClubMeetingWithMeta[]>(cached?.meetings ?? []);
  const [announcements, setAnnouncementsState] = useState<ClubAnnouncementRow[]>(
    cached?.announcements ?? [],
  );
  const [channels, setChannelsState] = useState<ClubChannelRow[]>(cached?.channels ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const writeCache = useCallback(
    (
      nextClub: ClubDetail | null,
      nextMeetings: ClubMeetingWithMeta[],
      nextAnnouncements: ClubAnnouncementRow[],
      nextChannels: ClubChannelRow[],
    ) => {
      if (!nextClub) return;
      cache.set(clubId, {
        club: nextClub,
        meetings: nextMeetings,
        announcements: nextAnnouncements,
        channels: nextChannels,
        loadedAt: Date.now(),
      });
    },
    [clubId],
  );

  const load = useCallback(
    async (force = false) => {
      const current = cache.get(clubId);
      if (!force && current && Date.now() - current.loadedAt < CACHE_MS) {
        setClubState(current.club);
        setMeetingsState(current.meetings);
        setAnnouncementsState(current.announcements);
        setChannelsState(current.channels);
        setLoading(false);
        return;
      }
      setLoading((value) => value || !current);
      try {
        const [clubResponse, meetingResponse, announcementResponse, channelResponse] = await Promise.all([
          getClub(clubId),
          getClubMeetings(clubId),
          getClubAnnouncements(clubId, { page: 1, limit: 20 }),
          getClubChannels(clubId).catch(() => ({ channels: [] as ClubChannelRow[] })),
        ]);
        const sortedMeetings = [...meetingResponse].sort(
          (a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime(),
        );
        setClubState(clubResponse);
        setMeetingsState(sortedMeetings);
        setAnnouncementsState(announcementResponse.items);
        setChannelsState(channelResponse.channels);
        cache.set(clubId, {
          club: clubResponse,
          meetings: sortedMeetings,
          announcements: announcementResponse.items,
          channels: channelResponse.channels,
          loadedAt: Date.now(),
        });
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load club');
      } finally {
        setLoading(false);
      }
    },
    [clubId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const setClub = useCallback(
    (updater: ClubDetail | ((current: ClubDetail | null) => ClubDetail | null)) => {
      setClubState((current) => {
        const next = typeof updater === 'function' ? updater(current) : updater;
        writeCache(next, meetings, announcements, channels);
        return next;
      });
    },
    [announcements, meetings, channels, writeCache],
  );

  const setMeetings = useCallback(
    (
      updater:
        | ClubMeetingWithMeta[]
        | ((current: ClubMeetingWithMeta[]) => ClubMeetingWithMeta[]),
    ) => {
      setMeetingsState((current) => {
        const next = typeof updater === 'function' ? updater(current) : updater;
        writeCache(club, next, announcements, channels);
        return next;
      });
    },
    [announcements, club, channels, writeCache],
  );

  const setAnnouncements = useCallback(
    (
      updater:
        | ClubAnnouncementRow[]
        | ((current: ClubAnnouncementRow[]) => ClubAnnouncementRow[]),
    ) => {
      setAnnouncementsState((current) => {
        const next = typeof updater === 'function' ? updater(current) : updater;
        writeCache(club, meetings, next, channels);
        return next;
      });
    },
    [club, meetings, channels, writeCache],
  );

  const permissions = useMemo(() => {
    if (club?.myRole === 'OWNER' || club?.myRole === 'ADMIN') {
      return new Set(CLUB_PERMISSION_OPTIONS.map((permission) => permission.value));
    }
    if (club?.myRole === 'OFFICER') {
      return new Set([...DEFAULT_OFFICER_PERMISSIONS, ...(club.officerPermissions ?? [])]);
    }
    return new Set<string>();
  }, [club?.myRole, club?.officerPermissions]);

  const can = useCallback((permission: string) => permissions.has(permission), [permissions]);
  const isLeader = roleRank(club?.myRole) >= roleRank('OFFICER');

  const setChannels = useCallback(
    (updater: ClubChannelRow[] | ((current: ClubChannelRow[]) => ClubChannelRow[])) => {
      setChannelsState((current) => {
        const next = typeof updater === 'function' ? updater(current) : updater;
        writeCache(club, meetings, announcements, next);
        return next;
      });
    },
    [announcements, club, meetings, writeCache],
  );

  return {
    club,
    meetings,
    announcements,
    channels,
    setChannels,
    loading,
    error,
    isLeader,
    can,
    refresh: () => load(true),
    setClub,
    setMeetings,
    setAnnouncements,
  };
}
