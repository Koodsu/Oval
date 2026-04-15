import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ClubDetailScreen from './ClubDetailScreen';
import type { ClubDetail } from '../types';

const initialSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderWithSafeArea(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={initialSafeAreaMetrics}>{ui}</SafeAreaProvider>
  );
}

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Test User', email: 't@example.com', verifiedUniversity: true, joinedAt: '' },
  }),
}));

const mockClub: ClubDetail = {
  id: 'c1',
  name: 'Chess Club',
  description: 'Play chess',
  category: 'Gaming',
  emoji: '♟️',
  isVerified: false,
  isPublic: true,
  university: 'OSU',
  createdById: 'u1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isMember: true,
  myRole: 'MEMBER',
  members: [
    {
      id: 'm1',
      clubId: 'c1',
      userId: 'u1',
      role: 'MEMBER',
      joinedAt: new Date().toISOString(),
      user: { id: 'u1', name: 'Test User', classYear: '2026' },
    },
  ],
  meetings: [],
  announcements: [],
};

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('../api', () => ({
  getClub: jest.fn(() => Promise.resolve(mockClub)),
  getClubMeetings: jest.fn(() => Promise.resolve([])),
  getClubMessages: jest.fn(() => Promise.resolve({ messages: [], typingUserIds: [] })),
  joinClub: jest.fn(),
  leaveClub: jest.fn(),
  sendClubMessage: jest.fn(),
  sendClubTyping: jest.fn(),
  promoteClubMember: jest.fn(),
  rsvpClubMeeting: jest.fn(),
  createClubMeeting: jest.fn(),
  API_USER_MESSAGE: 'Something went wrong',
  resolveAvatarUrl: (u: string | null | undefined) => u ?? undefined,
}));

jest.mock('../lib/supabase', () => ({
  getSupabase: () => null,
}));

describe('ClubDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders club name and tab pills after load', async () => {
    renderWithSafeArea(
      <ClubDetailScreen
        navigation={{ navigate: mockNavigate, goBack: mockGoBack, setOptions: jest.fn() } as never}
        route={{ key: 'k', name: 'ClubDetail', params: { clubId: 'c1' } } as never}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Chess Club')).toBeTruthy();
    });

    expect(screen.getByText('Meetings')).toBeTruthy();
    expect(screen.getByText('Chat')).toBeTruthy();
    expect(screen.getByText('Members')).toBeTruthy();
  });

  it('switches to Members tab', async () => {
    renderWithSafeArea(
      <ClubDetailScreen
        navigation={{ navigate: mockNavigate, goBack: mockGoBack, setOptions: jest.fn() } as never}
        route={{ key: 'k', name: 'ClubDetail', params: { clubId: 'c1' } } as never}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Chess Club')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Members'));
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeTruthy();
    });
  });
});
