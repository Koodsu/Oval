import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import ProfileScreen from './ProfileScreen';

// ── Navigation ──────────────────────────────────────────────────────────────
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

// ── Safe Area ────────────────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0 }),
}));

// ── API ──────────────────────────────────────────────────────────────────────
const mockUpdateNotificationPreferences = jest.fn();

jest.mock('../api', () => ({
  getMyPods: jest.fn().mockResolvedValue([]),
  updateNotificationPreferences: (...args: unknown[]) =>
    mockUpdateNotificationPreferences(...args),
}));

// ── Auth ─────────────────────────────────────────────────────────────────────
const mockUpdateUser = jest.fn();

const defaultUser = {
  id: 'user1',
  name: 'Brady',
  email: 'brady@test.com',
  notificationPreferences: { podJoin: true, newMessage: true, meetupReminder: true },
};

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: defaultUser,
    signOut: jest.fn(),
    updateUser: mockUpdateUser,
  }),
}));

// ── Avatar (simplified) ───────────────────────────────────────────────────────
jest.mock('../components/Avatar', () => {
  const { Text } = require('react-native');
  return ({ name }: { name: string }) => <Text>{name}</Text>;
});

// ── GradientButton (simplified) ──────────────────────────────────────────────
jest.mock('../components/GradientButton', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return ({ title, onPress }: { title: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress}>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
});

describe('ProfileScreen — notification preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateNotificationPreferences.mockResolvedValue({
      id: 'user1',
      name: 'Brady',
      email: 'brady@test.com',
      notificationPreferences: { podJoin: false, newMessage: true, meetupReminder: true },
    });
  });

  it('renders all three notification toggle rows', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      expect(screen.getByText('Pod join alerts')).toBeTruthy();
      expect(screen.getByText('New message alerts')).toBeTruthy();
      expect(screen.getByText('Meetup reminder')).toBeTruthy();
    });
  });

  it('renders the Notifications section title', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      // typography.label applies CSS textTransform; the underlying content is unchanged
      expect(screen.getByText('Notifications')).toBeTruthy();
    });
  });

  it('calls updateNotificationPreferences with the right key when a toggle is pressed', async () => {
    render(<ProfileScreen />);
    await waitFor(() => screen.getByText('Pod join alerts'));

    const switches = screen.getAllByRole('switch');
    // First switch is podJoin
    await act(async () => {
      fireEvent(switches[0], 'valueChange', false);
    });

    expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith({ podJoin: false });
  });

  it('calls updateUser after a successful preference update', async () => {
    render(<ProfileScreen />);
    await waitFor(() => screen.getByText('Pod join alerts'));

    const switches = screen.getAllByRole('switch');
    await act(async () => {
      fireEvent(switches[0], 'valueChange', false);
    });

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalled();
    });
  });

  it('shows user name and email', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      // Multiple 'Brady' elements may exist (Avatar + name text) so use getAllByText
      expect(screen.getAllByText('Brady').length).toBeGreaterThan(0);
      expect(screen.getByText('brady@test.com')).toBeTruthy();
    });
  });
});
