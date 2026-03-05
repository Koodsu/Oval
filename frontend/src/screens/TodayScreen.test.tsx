import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import TodayScreen from './TodayScreen';

// ── API mocks ────────────────────────────────────────────────────────────────
jest.mock('../api', () => ({
  fetchFeed: jest.fn(),
  getActivities: jest.fn(),
  joinPod: jest.fn(),
}));

// ── Navigation mocks ─────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (cb: () => void) => {
    // Call the callback immediately during test renders
    const React = require('react');
    React.useEffect(cb, []);
  },
}));

// ── Safe area mock ────────────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// ── AuthContext mock ──────────────────────────────────────────────────────────
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Alice Smith', email: 'alice@test.com' },
    hasAcceptedGuidelines: true,
    acceptGuidelines: jest.fn(),
  }),
}));

// ── Silence GuidelinesModal dep ───────────────────────────────────────────────
jest.mock('../components/GuidelinesModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ visible }: { visible: boolean }) =>
    visible ? React.createElement(View, { testID: 'guidelines-modal' }) : null;
});

// ── Helpers ───────────────────────────────────────────────────────────────────
import { fetchFeed, getActivities } from '../api';

const mockFetchFeed = fetchFeed as jest.Mock;
const mockGetActivities = getActivities as jest.Mock;

const todayISO = new Date(Date.now() + 2 * 3600000).toISOString(); // 2 hrs from now
const weekISO = new Date(Date.now() + 3 * 86_400_000).toISOString(); // 3 days from now

const makePod = (overrides: Partial<{
  id: string;
  meetupTime: string;
  maxMembers: number;
  membersCount: number;
}> = {}) => ({
  id: overrides.id ?? 'pod-1',
  activityId: 'act-1',
  meetupTime: overrides.meetupTime ?? todayISO,
  location: 'Thompson Library',
  locationType: 'public',
  minMembers: 2,
  maxMembers: overrides.maxMembers ?? 4,
  status: 'FORMING',
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
  });

  it('renders section labels', async () => {
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Happening Today')).toBeTruthy();
      expect(screen.getByText('Starting This Week')).toBeTruthy();
      expect(screen.getByText('Browse Activities')).toBeTruthy();
    });
  });

  it('shows greeting with first name', async () => {
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Hey, Alice')).toBeTruthy();
    });
  });

  it('shows empty state for Today when no pods', async () => {
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Nothing today yet')).toBeTruthy();
    });
  });

  it('shows empty state for This Week when no pods', async () => {
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Nothing scheduled yet')).toBeTruthy();
    });
  });

  it('renders a pod card in Happening Today section when a today pod exists', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ meetupTime: todayISO })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Study Session')).toBeTruthy();
      expect(screen.getByText('Join Pod')).toBeTruthy();
    });
  });

  it('renders a pod card in Starting This Week when a week pod exists', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ id: 'pod-week', meetupTime: weekISO })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Study Session')).toBeTruthy();
    });
  });

  it('shows "1 spot left!" badge when only 1 spot remains', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ maxMembers: 2, membersCount: 1 })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('1 spot left!')).toBeTruthy();
    });
  });

  it('shows "3 spots left" badge for a pod with 3 open spots', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ maxMembers: 4, membersCount: 1 })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('3 spots left')).toBeTruthy();
    });
  });

  it('shows "View Pod" when current user is already a member', async () => {
    const pod = makePod();
    pod.members.push({
      id: 'my-membership',
      userId: 'user-1',
      joinedAt: new Date().toISOString(),
      user: { id: 'user-1', name: 'Alice Smith' },
    });
    mockFetchFeed.mockResolvedValue([pod]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('View Pod')).toBeTruthy();
    });
  });

  it('renders activity cards in Browse Activities section', async () => {
    mockGetActivities.mockResolvedValue([makeActivity({ title: 'Coffee Walk', podCount: 2 })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Coffee Walk')).toBeTruthy();
    });
  });

  it('shows pod count on activity when pods are forming', async () => {
    mockGetActivities.mockResolvedValue([makeActivity({ title: 'Hike', podCount: 3 })]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('3 pods forming')).toBeTruthy();
    });
  });

  it('navigates to Pod screen after joining', async () => {
    const { joinPod } = require('../api');
    (joinPod as jest.Mock).mockResolvedValue({ id: 'pod-joined' });
    mockFetchFeed.mockResolvedValue([makePod()]);
    render(<TodayScreen />);
    await waitFor(() => screen.getByText('Join Pod'));
    fireEvent.press(screen.getByText('Join Pod'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Pod', { podId: 'pod-joined' });
    });
  });

  it('navigates to PodList when an activity card is pressed', async () => {
    mockGetActivities.mockResolvedValue([makeActivity({ id: 'act-99', title: 'Yoga' })]);
    render(<TodayScreen />);
    await waitFor(() => screen.getByText('Yoga'));
    fireEvent.press(screen.getByText('Yoga'));
    expect(mockNavigate).toHaveBeenCalledWith('PodList', expect.objectContaining({ activityId: 'act-99' }));
  });

  it('renders the "Find a Group" button', async () => {
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('Find a Group')).toBeTruthy();
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
    await waitFor(() => screen.getByText('Find a Group'));
    fireEvent.press(screen.getByText('Find a Group'));
    expect(mockNavigate).toHaveBeenCalledWith('FindAGroup');
  });

  it('shows "For You" badge on a recommended pod', async () => {
    mockFetchFeed.mockResolvedValue([{ ...makePod(), recommended: true }]);
    render(<TodayScreen />);
    await waitFor(() => {
      expect(screen.getByText('For You')).toBeTruthy();
    });
  });

  it('does not show "For You" badge when pod is not recommended', async () => {
    mockFetchFeed.mockResolvedValue([{ ...makePod(), recommended: false }]);
    render(<TodayScreen />);
    await waitFor(() => screen.getByText('Study Session'));
    expect(screen.queryByText('For You')).toBeNull();
  });
});
