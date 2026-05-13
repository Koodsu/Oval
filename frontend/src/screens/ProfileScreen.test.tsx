import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import ProfileScreen from './ProfileScreen';

// ── Navigation ──────────────────────────────────────────────────────────────
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: (cb: () => void) => cb(),
}));

// ── Safe Area ────────────────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0 }),
}));

// ── API ──────────────────────────────────────────────────────────────────────
const mockUpdateNotificationPreferences = jest.fn();

jest.mock('../api', () => ({
  getMyPods: jest.fn().mockResolvedValue([]),
  getMyClubs: jest.fn().mockResolvedValue([]),
  getFriends: jest.fn().mockResolvedValue([]),
  getNotificationPreferences: jest.fn().mockResolvedValue({
    preferences: {
      podJoin: true,
      newMessage: true,
      meetupReminder: true,
      recapPrompt: true,
      waitlistSpot: true,
    },
  }),
  resolveAvatarUrl: jest.fn((value?: string | null) => value ?? undefined),
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
}, { virtual: true });

// ── GradientButton (simplified) ──────────────────────────────────────────────
jest.mock('../components/GradientButton', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return ({ title, onPress }: { title: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress}>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
}, { virtual: true });

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
      expect(screen.getByText('Pod joins')).toBeTruthy();
      expect(screen.getByText('New messages')).toBeTruthy();
      expect(screen.getByText('Meetup reminders')).toBeTruthy();
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
    await waitFor(() => screen.getByText('Pod joins'));

    const switches = screen.getAllByRole('switch');
    // First switch is podJoin
    await act(async () => {
      fireEvent(switches[0], 'valueChange', false);
    });

    expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith({ podJoin: false });
  });

  it('keeps preference updates scoped to notification settings', async () => {
    render(<ProfileScreen />);
    await waitFor(() => screen.getByText('Pod joins'));

    const switches = screen.getAllByRole('switch');
    await act(async () => {
      fireEvent(switches[0], 'valueChange', false);
    });

    await waitFor(() => {
      expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith({ podJoin: false });
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('shows user name and email', async () => {
    render(<ProfileScreen />);
    await waitFor(() => {
      // Multiple 'Brady' elements may exist (Avatar + name text) so use getAllByText
      expect(screen.getAllByText('Brady').length).toBeGreaterThan(0);
      expect(screen.getByText(/brady@test.com/)).toBeTruthy();
    });
  });
});
