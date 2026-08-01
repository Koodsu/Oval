import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ClubsHomeScreen, { getClubsSupplyState, type ClubsPreviewData } from './ClubsHomeScreen';
import type { ClubDirectoryEntry, ClubMeetingToday, MyClubMembershipRow } from '../../types';

const mockNavigate = jest.fn();
const mockJoinClub = jest.fn().mockResolvedValue({ ok: true });

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (callback: () => void) => {
    const ReactModule = require('react');
    ReactModule.useEffect(callback, [callback]);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../api', () => ({
  getClubs: jest.fn().mockResolvedValue([]),
  getClubsToday: jest.fn().mockResolvedValue([]),
  getMyClubs: jest.fn().mockResolvedValue([]),
  joinClub: (...args: unknown[]) => mockJoinClub(...args),
  getApiErrorMessage: jest.fn(() => 'Something went wrong'),
  resolveAvatarUrl: jest.fn((value?: string | null) => value ?? undefined),
  PUBLIC_SITE_URL: 'https://www.theovalapp.com',
}));

function club(id: string, overrides: Partial<ClubDirectoryEntry> = {}): ClubDirectoryEntry {
  return {
    id,
    name: `Club ${id}`,
    description: 'A welcoming campus community.',
    category: 'Social',
    emoji: '✨',
    avatarUrl: null,
    isVerified: true,
    isPublic: true,
    university: 'Ohio State University',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    memberCount: 12,
    upcomingMeetingCount: 0,
    isMember: false,
    ...overrides,
  };
}

function meeting(
  clubId: string,
  overrides: Partial<ClubMeetingToday> = {},
): ClubMeetingToday {
  return {
    id: 'meeting-1',
    title: 'Open Mic Night',
    location: 'The Daily Grind',
    meetingTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    isPublic: true,
    visibility: 'PUBLIC',
    clubId,
    clubName: 'Music Collective',
    clubEmoji: '🎤',
    attendeeCount: 8,
    ...overrides,
  };
}

function membership(entry: ClubDirectoryEntry): MyClubMembershipRow {
  return {
    membershipId: 'membership-1',
    role: 'MEMBER',
    joinedAt: new Date().toISOString(),
    unreadCount: 2,
    club: {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      category: entry.category,
      emoji: entry.emoji,
      avatarUrl: entry.avatarUrl,
      isVerified: entry.isVerified,
      isPublic: entry.isPublic,
      university: entry.university,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      memberCount: entry.memberCount,
    },
    nextMeeting: null,
  };
}

function renderPreview(previewData: ClubsPreviewData) {
  return render(<ClubsHomeScreen previewData={previewData} />);
}

function textOrder(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(textOrder);
  if (!node || typeof node !== 'object' || !('children' in node)) return [];
  return textOrder((node as { children?: unknown[] }).children ?? []);
}

describe('ClubsHomeScreen supply states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('classifies zero, sparse, and active club supply independently from personal membership', () => {
    expect(getClubsSupplyState([], [])).toBe('empty');
    expect(getClubsSupplyState([club('one')], [])).toBe('sparse');
    expect(getClubsSupplyState([club('one')], [meeting('one')])).toBe('active');
    expect(getClubsSupplyState([club('1'), club('2'), club('3'), club('4')], [])).toBe('active');
  });

  it('renders the global cold-start experience and expands its explainer', async () => {
    renderPreview({ clubs: [], myClubs: [], meetings: [] });

    expect(screen.getByText('Bring campus groups to Oval')).toBeTruthy();
    expect(screen.getByText('Popular interests on campus')).toBeTruthy();

    fireEvent.press(screen.getAllByLabelText('Create a club')[1]!);
    expect(mockNavigate).toHaveBeenCalledWith('CreateClub');

    fireEvent.press(screen.getByText('How clubs work on Oval'));
    expect(
      screen.getByText(/Clubs bring members, announcements, chat, and campus events/),
    ).toBeTruthy();
  });

  it('keeps a one-club campus lively with a founding-club spotlight', () => {
    renderPreview({
      clubs: [club('photo', { name: 'Photography Club', memberCount: 1 })],
      myClubs: [],
      meetings: [],
    });

    expect(screen.getByText('FOUNDING CLUB SPOTLIGHT')).toBeTruthy();
    expect(screen.getByText('Find your corner of campus')).toBeTruthy();
    expect(screen.getByLabelText('Browse clubs')).toBeTruthy();
    expect(screen.getAllByText('Photography Club').length).toBeGreaterThan(0);
    expect(screen.getByText('Tonight on campus')).toBeTruthy();
    expect(screen.getByText('No meetings posted for tonight')).toBeTruthy();
    expect(screen.getByText('Missing your organization?')).toBeTruthy();
    expect(screen.queryByText('📷')).toBeNull();
    expect(screen.queryByText('Bring campus groups to Oval')).toBeNull();

    fireEvent.press(screen.getByLabelText('Bring your club'));
    expect(mockNavigate).toHaveBeenCalledWith('CreateClub');
  });

  it('renders the event, membership rail, discovery rows, and joins inline', async () => {
    const mine = club('music', {
      name: 'Music Collective',
      isMember: true,
      upcomingMeetingCount: 1,
    });
    const directory = [
      mine,
      club('photo', { name: 'Photography Club' }),
      club('business', { name: 'Business Society' }),
      club('volleyball', { name: 'Volleyball Club' }),
    ];
    const view = renderPreview({
      clubs: directory,
      myClubs: [membership(mine)],
      meetings: [
        meeting(mine.id),
        meeting('photo', {
          id: 'meeting-2',
          title: 'Photo Walk',
          clubName: 'Photography Club',
          clubEmoji: '📷',
          location: 'The Oval',
          meetingTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        }),
      ],
    });

    expect(screen.getByText('Tonight on campus')).toBeTruthy();
    expect(screen.getByText('2 clubs meeting tonight')).toBeTruthy();
    expect(screen.getByText('Open Mic Night')).toBeTruthy();
    expect(screen.getByText('Photo Walk')).toBeTruthy();
    expect(screen.getByText('My clubs')).toBeTruthy();
    expect(screen.getByText('Discover clubs')).toBeTruthy();
    expect(screen.queryByText('Find your corner of campus')).toBeNull();
    expect(screen.queryByText('✏️')).toBeNull();

    const renderedText = textOrder(view.toJSON());
    expect(renderedText.indexOf('My clubs')).toBeLessThan(
      renderedText.indexOf('Tonight on campus'),
    );

    fireEvent.press(screen.getByLabelText('Join Photography Club'), {
      stopPropagation: jest.fn(),
    });
    await waitFor(() => expect(mockJoinClub).toHaveBeenCalledWith('photo'));
  });
});
