import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Share } from 'react-native';
import PodScreen from './PodScreen';

// ── API mocks ────────────────────────────────────────────────────────────────
jest.mock('../api', () => ({
  getPod: jest.fn(),
  getMessages: jest.fn(),
  sendMessage: jest.fn(),
  lockPod: jest.fn(),
  unlockPod: jest.fn(),
  leavePod: jest.fn(),
  getFriends: jest.fn().mockResolvedValue([]),
  sendPodInvite: jest.fn().mockResolvedValue({}),
  resolveAvatarUrl: (url: string | null | undefined) => url ?? undefined,
}));

// ── Navigation mocks ─────────────────────────────────────────────────────────
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

// ── ReportModal mock ──────────────────────────────────────────────────────────
jest.mock('../components/ReportModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ visible }: { visible: boolean }) =>
    visible ? React.createElement(View, { testID: 'report-modal' }) : null;
});

// ── StatusBadge mock ──────────────────────────────────────────────────────────
jest.mock('../components/StatusBadge', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ status }: { status: string }) =>
    React.createElement(Text, { testID: 'status-badge' }, status);
});

// ── Avatar mock ───────────────────────────────────────────────────────────────
jest.mock('../components/Avatar', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Avatar = () => React.createElement(View, { testID: 'avatar' });
  const AvatarStack = () => React.createElement(View, { testID: 'avatar-stack' });
  Avatar.displayName = 'Avatar';
  AvatarStack.displayName = 'AvatarStack';
  return { default: Avatar, AvatarStack };
});

// ── AuthContext mock ──────────────────────────────────────────────────────────
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Alice Smith', email: 'alice@test.com' },
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
import { getPod, getMessages } from '../api';

const mockGetPod = getPod as jest.Mock;
const mockGetMessages = getMessages as jest.Mock;

const POD_ID = 'pod-abc123';

const makePod = (overrides = {}) => ({
  id: POD_ID,
  activityId: 'activity-1',
  activity: { id: 'activity-1', title: 'Morning Coffee Walk', category: 'Social' },
  meetupTime: new Date(Date.now() + 2 * 3600000).toISOString(),
  location: 'Thompson Library',
  locationType: 'public',
  minMembers: 2,
  maxMembers: 4,
  status: 'FORMING',
  creatorId: 'user-1',
  createdAt: new Date().toISOString(),
  members: [
    { id: 'pm-1', userId: 'user-1', joinedAt: new Date().toISOString(), user: { id: 'user-1', name: 'Alice Smith' } },
  ],
  ...overrides,
});

function buildProps() {
  return {
    route: { key: 'Pod', name: 'Pod' as const, params: { podId: POD_ID } },
    navigation: {
      goBack: mockGoBack,
      navigate: mockNavigate,
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    } as unknown as Parameters<typeof PodScreen>[0]['navigation'],
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockGetPod.mockResolvedValue(makePod());
  mockGetMessages.mockResolvedValue([]);
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

async function renderAndLoad() {
  const utils = render(<PodScreen {...buildProps()} />);
  await waitFor(() => expect(screen.queryByTestId('status-badge')).not.toBeNull());
  return utils;
}

describe('PodScreen — share / invite button', () => {
  it('renders a Share button after the pod loads', async () => {
    await renderAndLoad();
    expect(screen.getByText('Share')).toBeTruthy();
  });

  it('calls Share.share with the correct URL when Share is tapped', async () => {
    await renderAndLoad();

    fireEvent.press(screen.getByText('Share'));

    await waitFor(() => {
      expect(Share.share).toHaveBeenCalledTimes(1);
    });

    const call = (Share.share as jest.Mock).mock.calls[0][0];
    expect(call.url).toBe(`https://bridge.app/pod/${POD_ID}`);
    expect(call.message).toContain(`https://bridge.app/pod/${POD_ID}`);
  });

  it('share message mentions Bridge', async () => {
    await renderAndLoad();
    fireEvent.press(screen.getByText('Share'));

    await waitFor(() => expect(Share.share).toHaveBeenCalled());

    const call = (Share.share as jest.Mock).mock.calls[0][0];
    expect(call.message).toMatch(/bridge/i);
  });

  it('does not throw if the user cancels the share sheet', async () => {
    (Share.share as jest.Mock).mockResolvedValueOnce({ action: Share.dismissedAction });

    await renderAndLoad();

    await act(async () => {
      fireEvent.press(screen.getByText('Share'));
    });

    // Should still be on screen — no error thrown
    expect(screen.getByText('Share')).toBeTruthy();
  });

  it('does not throw if Share.share rejects', async () => {
    (Share.share as jest.Mock).mockRejectedValueOnce(new Error('Share unavailable'));

    await renderAndLoad();

    await act(async () => {
      fireEvent.press(screen.getByText('Share'));
    });

    expect(screen.getByText('Share')).toBeTruthy();
  });

  it('invite button has an accessibility label', async () => {
    await renderAndLoad();
    expect(
      screen.getByLabelText('Share pod invite link')
    ).toBeTruthy();
  });
});

describe('PodScreen — loading state', () => {
  it('shows a loading spinner before the pod data arrives', () => {
    // getPod never resolves during this test
    mockGetPod.mockReturnValue(new Promise(() => {}));
    mockGetMessages.mockReturnValue(new Promise(() => {}));

    const { UNSAFE_getByType } = render(<PodScreen {...buildProps()} />);
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });
});
