import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import UserSearchScreen from './UserSearchScreen';

const mockDiscoverUsers = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    const ReactModule = require('react');
    ReactModule.useEffect(callback, [callback]);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../api', () => ({
  acceptFriendRequest: jest.fn(),
  cancelFriendRequest: jest.fn(),
  declineFriendRequest: jest.fn(),
  discoverUsers: (...args: unknown[]) => mockDiscoverUsers(...args),
  getApiErrorMessage: (error: { userMessage?: string }) =>
    error?.userMessage ?? 'Something went wrong',
  getFriendRequests: jest.fn().mockResolvedValue({ incoming: [], outgoing: [] }),
  getFriends: jest.fn().mockResolvedValue([]),
  searchUsers: jest.fn().mockResolvedValue([]),
  sendFriendRequest: jest.fn(),
  resolveAvatarUrl: jest.fn((value?: string | null) => value ?? undefined),
}));

jest.mock('../lib/toast', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

describe('UserSearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('treats a suggestion-endpoint failure as an empty state, not a page error', async () => {
    mockDiscoverUsers.mockRejectedValue({ userMessage: 'User not found' });
    const navigation = {
      goBack: jest.fn(),
      navigate: jest.fn(),
    };

    render(
      <UserSearchScreen
        navigation={navigation as never}
        route={{ key: 'people', name: 'UserSearch' } as never}
      />,
    );

    await waitFor(() => expect(screen.getByText('No suggestions right now')).toBeTruthy());
    expect(screen.queryByText('User not found')).toBeNull();
  });
});
