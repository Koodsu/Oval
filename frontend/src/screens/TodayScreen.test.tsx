import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import TodayScreen, { getTimeOfDayGreeting } from './TodayScreen';

// ── API mocks ────────────────────────────────────────────────────────────────
jest.mock('../api', () => ({
  fetchFeed: jest.fn(),
  getActivities: jest.fn(),
  getMyPods: jest.fn(),
  joinPod: jest.fn(),
  joinWaitlist: jest.fn(),
  resolveAvatarUrl: (url: string | null | undefined) => url ?? undefined,
}));

// ── Navigation mocks ─────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(cb, []);
  },
}));

// ── Safe area mock ───────────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// ── AuthContext mock (mutable user for clubs tests) ──────────────────────────
const mockAuthState = {
  user: {
    id: 'user-1',
    name: 'Alice Smith',
    email: 'alice@test.com',
    verifiedUniversity: true,
    joinedAt: new Date().toISOString(),
  },
  hasAcceptedGuidelines: true,
  acceptGuidelines: jest.fn(),
};

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// ── Silence GuidelinesModal dep ───────────────────────────────────────────────
jest.mock('../components/GuidelinesModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ visible }: { visible: boolean }) =>
    visible ? React.createElement(View, { testID: 'guidelines-modal' }) : null;
});

// ── Helpers ───────────────────────────────────────────────────────────────────
import { fetchFeed, getActivities, getMyPods } from '../api';

const mockFetchFeed = fetchFeed as jest.Mock;
const mockGetActivities = getActivities as jest.Mock;
const mockGetMyPods = getMyPods as jest.Mock;

const todayISO = new Date(Date.now() + 2 * 3600000).toISOString(); // 2 hrs from now
const weekISO = new Date(Date.now() + 3 * 86_400_000).toISOString(); // 3 days from now

const makePod = (
  overrides: Partial<{
    id: string;
    meetupTime: string;
    maxMembers: number;
    membersCount: number;
    status: 'FORMING' | 'LOCKED' | 'COMPLETED';
  }> = {}
) => ({
  id: overrides.id ?? 'pod-1',
  activityId: 'act-1',
  meetupTime: overrides.meetupTime ?? todayISO,
  location: 'Thompson Library',
  locationType: 'public' as const,
  minMembers: 2,
  maxMembers: overrides.maxMembers ?? 4,
  status: overrides.status ?? 'FORMING',
  creatorId: 'user-1',
  createdAt: new Date().toISOString(),
  activity: {
    id: 'act-1',
    title: 'Study Session',
    description: 'Group study',
    category: 'Academic',
    defaultLocation: 'Thompson Library',
    createdAt: new Date().toISOString(),
  },
  members: Array.from({ length: overrides.membersCount ?? 1 }, (_, i) => ({
    id: `m${i}`,
    userId: `other-${i}`,
    joinedAt: new Date().toISOString(),
    user: { id: `other-${i}`, name: `Member ${i}` },
  })),
});

/** Pod the current user belongs to (for GET /pods/mine) */
function makeMyPodToday(overrides: Partial<{ id: string; meetupTime: string }> = {}) {
  const base = makePod({ meetupTime: overrides.meetupTime ?? todayISO, id: overrides.id ?? 'my-pod-1' });
  return {
    ...base,
    members: [
      {
        id: 'mine',
        userId: 'user-1',
        joinedAt: new Date().toISOString(),
        user: { id: 'user-1', name: 'Alice Smith' },
      },
    ],
  };
}

const makeActivity = (overrides: Partial<{ id: string; title: string; podCount: number }> = {}) => ({
  id: overrides.id ?? 'act-2',
  title: overrides.title ?? 'Coffee Walk',
  description: 'Morning coffee',
  category: 'Food & Drink',
  defaultLocation: 'Thompson Library',
  createdAt: new Date().toISOString(),
  _count: { pods: overrides.podCount ?? 0 },
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('TodayScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchFeed.mockResolvedValue([]);
    mockGetActivities.mockResolvedValue([]);
    mockGetMyPods.mockResolvedValue([]);
    mockAuthState.user = {
      id: 'user-1',
      name: 'Alice Smith',
      email: 'alice@test.com',
      verifiedUniversity: true,
      joinedAt: new Date().toISOString(),
    };
  });

  it('shows greeting with first name and wave emoji', async () => {
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Hey, Alice 👋')).toBeTruthy();
    });
  });

  it('shows a time-of-day greeting', async () => {
    render(<TodayScreen />);
    await waitFor(() => {
      const ok =
        screen.queryByText('Good morning') ||
        screen.queryByText('Good afternoon') ||
        screen.queryByText('Good evening');
      expect(ok).toBeTruthy();
    });
  });

  describe('getTimeOfDayGreeting', () => {
    it('uses evening for hours before 5am', () => {
      expect(getTimeOfDayGreeting(new Date(2026, 3, 14, 1, 0, 0))).toBe('Good evening');
      expect(getTimeOfDayGreeting(new Date(2026, 3, 14, 4, 59, 0))).toBe('Good evening');
    });

    it('uses morning from 5am to before noon', () => {
      expect(getTimeOfDayGreeting(new Date(2026, 3, 14, 5, 0, 0))).toBe('Good morning');
      expect(getTimeOfDayGreeting(new Date(2026, 3, 14, 11, 30, 0))).toBe('Good morning');
    });

    it('uses afternoon from noon to before 5pm', () => {
      expect(getTimeOfDayGreeting(new Date(2026, 3, 14, 12, 0, 0))).toBe('Good afternoon');
      expect(getTimeOfDayGreeting(new Date(2026, 3, 14, 16, 59, 0))).toBe('Good afternoon');
    });

    it('uses evening from 5pm onward', () => {
      expect(getTimeOfDayGreeting(new Date(2026, 3, 14, 17, 0, 0))).toBe('Good evening');
      expect(getTimeOfDayGreeting(new Date(2026, 3, 14, 23, 0, 0))).toBe('Good evening');
    });
  });

  it('shows YOUR DAY empty copy when nothing scheduled today', async () => {
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('YOUR DAY')).toBeTruthy();
      expect(screen.getByText('Find something below')).toBeTruthy();
    });
  });

  it('shows all redesigned section headers', async () => {
    mockGetActivities.mockResolvedValue([makeActivity()]);
    render(<TodayScreen />);
    await waitFor(() => screen.getByText('Hey, Alice 👋'));
    expect(screen.getByText('YOUR DAY')).toBeTruthy();
    expect(screen.getByText('PICKED FOR YOU')).toBeTruthy();
    expect(screen.getByText('YOUR CLUBS')).toBeTruthy();
    expect(screen.getByText('HAPPENING NOW')).toBeTruthy();
  });

  it('does NOT show old empty state text', async () => {
    render(<TodayScreen />);
    await waitFor(() => screen.getByText('Hey, Alice 👋'));
    expect(screen.queryByText('Nothing today yet')).toBeNull();
    expect(screen.queryByText('Nothing scheduled yet')).toBeNull();
  });

  it('shows PICKED FOR YOU empty when no activities exist', async () => {
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('PICKED FOR YOU')).toBeTruthy();
      expect(screen.getByText('Check back for new activities')).toBeTruthy();
    });
  });

  it('shows schedule card when getMyPods returns a pod meeting today', async () => {
    const meetToday = new Date();
    meetToday.setHours(14, 0, 0, 0); // same local calendar day even near midnight in CI
    mockFetchFeed.mockResolvedValue([]);
    mockGetMyPods.mockResolvedValue([makeMyPodToday({ meetupTime: meetToday.toISOString() })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('YOUR DAY')).toBeTruthy();
      expect(screen.getByText('Study Session')).toBeTruthy();
    });
  });

  it('shows HAPPENING NOW and merged pods when feed has pods', async () => {
    mockFetchFeed.mockResolvedValue([
      makePod({ id: 'pod-week', meetupTime: weekISO }),
      makePod({ id: 'pod-today', meetupTime: todayISO }),
    ]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('HAPPENING NOW')).toBeTruthy();
      expect(screen.getAllByText('Study Session').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText('Happening Today')).toBeNull();
    expect(screen.queryByText('Starting This Week')).toBeNull();
  });

  it('shows OPEN pill when pod has spots', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ maxMembers: 4, membersCount: 1 })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('OPEN')).toBeTruthy();
    });
  });

  it('shows FULL pill when pod is full', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ maxMembers: 2, membersCount: 2 })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('FULL')).toBeTruthy();
    });
  });

  it('shows FORMING pill when pod is locked', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ status: 'LOCKED', maxMembers: 4, membersCount: 2 })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('FORMING')).toBeTruthy();
    });
  });

  it('shows joining count on pod cards', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ maxMembers: 4, membersCount: 1 })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('1 joining')).toBeTruthy();
    });
  });

  it('shows 0 joining when pod has no members', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ maxMembers: 4, membersCount: 0 })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('0 joining')).toBeTruthy();
    });
  });

  it('shows PICKED FOR YOU with activity when activities exist', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ meetupTime: todayISO })]);
    mockGetActivities.mockResolvedValue([makeActivity({ title: 'Coffee Walk' })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('PICKED FOR YOU')).toBeTruthy();
      expect(screen.getByText('Coffee Walk')).toBeTruthy();
    });
  });

  it('shows "pods forming" footer on picked activity cards', async () => {
    mockGetActivities.mockResolvedValue([makeActivity({ title: 'Yoga', podCount: 2 })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('2 pods forming')).toBeTruthy();
    });
  });

  it('shows "No pods yet" when activity has zero pods', async () => {
    mockGetActivities.mockResolvedValue([makeActivity({ title: 'Solo', podCount: 0 })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('No pods yet')).toBeTruthy();
    });
  });

  it('PICKED FOR YOU shows at most three activities', async () => {
    mockGetActivities.mockResolvedValue([
      makeActivity({ id: 'a1', title: 'Alpha', podCount: 10 }),
      makeActivity({ id: 'a2', title: 'Beta', podCount: 9 }),
      makeActivity({ id: 'a3', title: 'Gamma', podCount: 8 }),
      makeActivity({ id: 'a4', title: 'Delta', podCount: 7 }),
    ]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeTruthy();
      expect(screen.getByText('Beta')).toBeTruthy();
      expect(screen.getByText('Gamma')).toBeTruthy();
    });
    expect(screen.queryByText('Delta')).toBeNull();
  });

  it('shows club name in YOUR CLUBS when user has clubs', async () => {
    mockAuthState.user = {
      ...mockAuthState.user,
      clubs: ['Robotics Club'],
    };
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('YOUR CLUBS')).toBeTruthy();
      expect(screen.getByText('Robotics Club')).toBeTruthy();
    });
  });

  it('navigates to Pod when member taps feed card', async () => {
    const pod = makePod();
    pod.members.push({
      id: 'my-membership',
      userId: 'user-1',
      joinedAt: new Date().toISOString(),
      user: { id: 'user-1', name: 'Alice Smith' },
    });
    mockFetchFeed.mockResolvedValue([pod]);
    render(<TodayScreen />);
    await waitFor(() => screen.getAllByTestId('feed-pod-card'));
    fireEvent.press(screen.getAllByTestId('feed-pod-card')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('Pod', { podId: 'pod-1' });
  });

  it('navigates to Pod screen after joining via feed card', async () => {
    const { joinPod } = require('../api');
    (joinPod as jest.Mock).mockResolvedValue({ id: 'pod-joined' });
    mockFetchFeed.mockResolvedValue([makePod()]);
    render(<TodayScreen />);
    await waitFor(() => screen.getAllByTestId('feed-pod-card'));
    fireEvent.press(screen.getAllByTestId('feed-pod-card')[0]);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Pod', { podId: 'pod-joined' });
    });
  });

  it('navigates to PodList when an activity card is pressed', async () => {
    mockGetActivities.mockResolvedValue([makeActivity({ id: 'act-99', title: 'Yoga' })]);
    render(<TodayScreen />);
    await waitFor(() => screen.getByText('Yoga'));
    fireEvent.press(screen.getByText('Yoga'));
    expect(mockNavigate).toHaveBeenCalledWith(
      'PodList',
      expect.objectContaining({ activityId: 'act-99' })
    );
  });

  it('renders the Find a Group CTA label', async () => {
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('⚡ Find a Group')).toBeTruthy();
    });
  });

  it('shows helper subtext below the Find a Group button', async () => {
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('See open pods you can join right now')).toBeTruthy();
    });
  });

  it('navigates to FindAGroup when Find a Group button is pressed', async () => {
    mockFetchFeed.mockResolvedValue([]);
    render(<TodayScreen />);
    await waitFor(() => screen.getByText('⚡ Find a Group'));
    fireEvent.press(screen.getByText('⚡ Find a Group'));
    expect(mockNavigate).toHaveBeenCalledWith('FindAGroup');
  });

  it('navigates to PodInvites when bell is pressed', async () => {
    render(<TodayScreen />);
    await waitFor(() => screen.getByLabelText('Notifications'));
    fireEvent.press(screen.getByLabelText('Notifications'));
    expect(mockNavigate).toHaveBeenCalledWith('PodInvites');
  });
});
