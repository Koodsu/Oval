import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from './ProfileScreen';

// ── Navigation ──────────────────────────────────────────────────────────────
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useFocusEffect: (cb: () => void) => cb(),
}));

// ── Safe Area ────────────────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0 }),
}));

// ── API ──────────────────────────────────────────────────────────────────────
jest.mock('../api', () => ({
  getMyPods: jest.fn().mockResolvedValue([]),
  getMyClubs: jest.fn().mockResolvedValue([]),
  getFriends: jest.fn().mockResolvedValue([]),
  resolveAvatarUrl: jest.fn((value?: string | null) => value ?? undefined),
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

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes Settings from the profile', async () => {
    render(<ProfileScreen />);
    const settingsButton = await screen.findByText('Settings');
    fireEvent.press(settingsButton);
    expect(mockNavigate).toHaveBeenCalledWith('Settings');
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
