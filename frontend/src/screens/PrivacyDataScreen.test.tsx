import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import PrivacyDataScreen from './PrivacyDataScreen';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => callback(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../api', () => ({
  getNotificationPreferences: jest.fn().mockResolvedValue({
    preferences: {
      podJoin: true,
      podInvite: true,
      friendRequest: true,
      newMessage: true,
      meetupReminder: true,
      recapPrompt: true,
      waitlistSpot: true,
      clubMeetingCreated: true,
      clubAnnouncementCreated: true,
      clubKick: true,
      clubRoleChange: true,
      clubAttendanceOpen: true,
      clubRsvpReminder: true,
      clubOutreach: true,
      clubRolePing: true,
      weeklyRecap: true,
      demandAlerts: true,
    },
  }),
  updateNotificationPreferences: jest.fn(),
  updateProfile: jest.fn(),
  downloadMyData: jest.fn(),
  deleteMyAccount: jest.fn(),
  getApiErrorMessage: jest.fn(() => 'Request failed'),
  resolveAvatarUrl: jest.fn((value?: string | null) => value ?? undefined),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Oval User',
      email: 'bridge@osu.edu',
      instagramHandle: 'bridgeuser',
    },
    updateUser: jest.fn(),
    clearSession: jest.fn(),
  }),
}));

jest.mock('../utils/fileExport', () => ({
  exportTextFile: jest.fn(),
}));

describe('PrivacyDataScreen', () => {
  it('renders data, notification, connected account, and deletion controls', async () => {
    render(
      <PrivacyDataScreen
        navigation={{ goBack: jest.fn() } as never}
        route={{ key: 'privacy', name: 'PrivacyData' } as never}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByRole('switch')).toHaveLength(2);
    });
    expect(screen.getByText('Who can see and connect')).toBeTruthy();
    expect(screen.getByText('Notification controls')).toBeTruthy();
    expect(screen.getByText('Download my data')).toBeTruthy();
    expect(screen.getByText('Connected accounts')).toBeTruthy();
    expect(screen.getByText('Delete account')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Notification controls'));
    expect(screen.getAllByRole('switch')).toHaveLength(19);
    expect(screen.getByText('Weekly planning')).toBeTruthy();
    expect(screen.getByText('Demand alerts')).toBeTruthy();

    fireEvent.press(screen.getAllByLabelText('Close')[0]);
    fireEvent.press(screen.getByLabelText('Instagram'));
    expect(screen.getByText('Update Instagram')).toBeTruthy();
    expect(screen.getByText('Unlink Instagram')).toBeTruthy();
  });
});
