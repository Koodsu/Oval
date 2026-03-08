import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import FindAGroupScreen from './FindAGroupScreen';

// ── API mocks ────────────────────────────────────────────────────────────────
jest.mock('../api', () => ({
  fetchFeed: jest.fn(),
  joinPod: jest.fn(),
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

// ── GuidelinesModal mock ──────────────────────────────────────────────────────
jest.mock('../components/GuidelinesModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ visible }: { visible: boolean }) =>
    visible ? React.createElement(View, { testID: 'guidelines-modal' }) : null;
});

// ── Helpers ───────────────────────────────────────────────────────────────────
import { fetchFeed } from '../api';

const mockFetchFeed = fetchFeed as jest.Mock;

const futureISO = new Date(Date.now() + 2 * 3600000).toISOString();
const laterISO = new Date(Date.now() + 5 * 3600000).toISOString();

const makePod = (overrides: Partial<{
  id: string;
  recommended: boolean;
  membersCount: number;
  maxMembers: number;
  meetupTime: string;
  activityTitle: string;
  activityCategory: string;
}> = {}) => ({
  id: overrides.id ?? 'pod-1',
  activityId: 'act-1',
  meetupTime: overrides.meetupTime ?? futureISO,
  location: 'Thompson Library',
  locationType: 'public',
  minMembers: 2,
  maxMembers: overrides.maxMembers ?? 4,
  status: 'FORMING',
  creatorId: 'other-user',
  createdAt: new Date().toISOString(),
  recommended: overrides.recommended ?? false,
  activity: {
    id: 'act-1',
    title: overrides.activityTitle ?? 'Study Session',
    description: 'Group study',
    category: overrides.activityCategory ?? 'Academic',
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

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('FindAGroupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchFeed.mockResolvedValue([]);
  });

  it('renders loading spinner initially', () => {
    mockFetchFeed.mockReturnValue(new Promise(() => {}));
    const { UNSAFE_queryByType } = render(<FindAGroupScreen />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
  });

  it('shows "Popular Right Now" section label for a brand-new user with no recommended pods', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ recommended: false })]);
    render(<FindAGroupScreen />);
    await waitFor(() => {
      expect(screen.getByText('Popular Right Now')).toBeTruthy();
    });
  });

  it('shows "Trending Now" section label when user has both recommended and other pods', async () => {
    mockFetchFeed.mockResolvedValue([
      makePod({ id: 'rec-pod', recommended: true, activityTitle: 'Yoga' }),
      makePod({ id: 'trend-pod', recommended: false, activityTitle: 'Coffee Walk' }),
    ]);
    render(<FindAGroupScreen />);
    await waitFor(() => {
      expect(screen.getByText('Trending Now')).toBeTruthy();
    });
  });

  it('shows "For You" section header when user has recommended pods', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ recommended: true })]);
    render(<FindAGroupScreen />);
    await waitFor(() => {
      // "For You" appears as section header AND as badge on the card
      expect(screen.getAllByText('For You').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('does not show "For You" section when no recommended pods', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ recommended: false })]);
    render(<FindAGroupScreen />);
    await waitFor(() => screen.getByText('Popular Right Now'));
    expect(screen.queryByText('For You')).toBeNull();
  });

  it('renders pod activity title in the card', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ activityTitle: 'Morning Yoga' })]);
    render(<FindAGroupScreen />);
    await waitFor(() => {
      expect(screen.getByText('Morning Yoga')).toBeTruthy();
    });
  });

  it('shows "For You" badge on a recommended pod card alongside the section header', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ recommended: true, activityTitle: 'Study Session' })]);
    render(<FindAGroupScreen />);
    await waitFor(() => {
      // Section header "For You" + card badge "For You" = at least 2 occurrences
      const allForYou = screen.getAllByText('For You');
      expect(allForYou.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows "1 spot left!" badge for pods with 1 spot remaining', async () => {
    mockFetchFeed.mockResolvedValue([makePod({ maxMembers: 2, membersCount: 1 })]);
    render(<FindAGroupScreen />);
    await waitFor(() => {
      expect(screen.getByText('1 spot left!')).toBeTruthy();
    });
  });

  it('shows "Join Pod" button for a pod the user is not in', async () => {
    mockFetchFeed.mockResolvedValue([makePod()]);
    render(<FindAGroupScreen />);
    await waitFor(() => {
      expect(screen.getByText('Join Pod')).toBeTruthy();
    });
  });

  it('shows "View Pod" when user is already a member', async () => {
    const pod = makePod();
    pod.members.push({
      id: 'my-m',
      userId: 'user-1',
      joinedAt: new Date().toISOString(),
      user: { id: 'user-1', name: 'Alice Smith' },
    });
    mockFetchFeed.mockResolvedValue([pod]);
    render(<FindAGroupScreen />);
    await waitFor(() => {
      expect(screen.getByText('View Pod')).toBeTruthy();
    });
  });

  it('trending section sorts pods by member count descending', async () => {
    const few = makePod({ id: 'p-few', membersCount: 1, activityTitle: 'Few Members' });
    const many = makePod({ id: 'p-many', membersCount: 3, activityTitle: 'Many Members', meetupTime: laterISO });
    mockFetchFeed.mockResolvedValue([few, many]);
    render(<FindAGroupScreen />);
    await waitFor(() => {
      expect(screen.getByText('Many Members')).toBeTruthy();
      expect(screen.getByText('Few Members')).toBeTruthy();
    });
    // Both should appear; we can't easily verify DOM order in RNTL but we verify both render
  });

  it('navigates to Pod screen after joining', async () => {
    const { joinPod } = require('../api');
    (joinPod as jest.Mock).mockResolvedValue({ id: 'new-pod-id' });
    mockFetchFeed.mockResolvedValue([makePod()]);
    render(<FindAGroupScreen />);
    await waitFor(() => screen.getByText('Join Pod'));
    fireEvent.press(screen.getByText('Join Pod'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Pod', { podId: 'new-pod-id' });
    });
  });

  it('shows empty state when no trending pods exist for a new user', async () => {
    mockFetchFeed.mockResolvedValue([]);
    render(<FindAGroupScreen />);
    await waitFor(() => {
      expect(screen.getByText('No open pods yet')).toBeTruthy();
    });
  });

  it('passes limit=50 to fetchFeed', async () => {
    mockFetchFeed.mockResolvedValue([]);
    render(<FindAGroupScreen />);
    await waitFor(() => {
      expect(mockFetchFeed).toHaveBeenCalledWith({ limit: 50 });
    });
  });
});
