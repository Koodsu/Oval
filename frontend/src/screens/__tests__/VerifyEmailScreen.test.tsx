import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import VerifyEmailScreen from '../VerifyEmailScreen';

// Mock api functions
jest.mock('../../api', () => ({
  ...jest.requireActual('../../api'),
  verifyEmail: jest.fn(),
  resendVerification: jest.fn(),
}));

// Mock GradientButton with a plain Pressable so we can test it
jest.mock('../../components/GradientButton', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return function GradientButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} testID="gradient-button">
        <Text>{title}</Text>
      </TouchableOpacity>
    );
  };
});

const mockUpdateUser = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Alice', email: 'alice@osu.edu', verifiedUniversity: false, joinedAt: new Date().toISOString() },
    updateUser: mockUpdateUser,
    signOut: mockSignOut,
  }),
}));

import * as api from '../../api';
import { API_USER_MESSAGE } from '../../api';

describe('VerifyEmailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the code input and email address', () => {
    render(<VerifyEmailScreen />);
    expect(screen.getByTestId('code-input')).toBeTruthy();
    expect(screen.getByText(/alice@osu\.edu/)).toBeTruthy();
  });

  it('shows error when submitting an incomplete code', async () => {
    render(<VerifyEmailScreen />);
    fireEvent.press(screen.getByTestId('gradient-button'));
    await waitFor(() => {
      expect(screen.getByText(/6-digit/i)).toBeTruthy();
    });
  });

  it('calls verifyEmail and updateUser on valid code submission', async () => {
    const mockUser = {
      id: '1',
      name: 'Alice',
      email: 'alice@osu.edu',
      verifiedUniversity: true,
      joinedAt: new Date().toISOString(),
    };
    (api.verifyEmail as jest.Mock).mockResolvedValueOnce({ user: mockUser });

    render(<VerifyEmailScreen />);
    fireEvent.changeText(screen.getByTestId('code-input'), '123456');
    fireEvent.press(screen.getByTestId('gradient-button'));

    await waitFor(() => {
      expect(api.verifyEmail).toHaveBeenCalledWith('123456');
      expect(mockUpdateUser).toHaveBeenCalledWith(mockUser);
    });
  });

  it('shows error message when verifyEmail fails', async () => {
    (api.verifyEmail as jest.Mock).mockRejectedValueOnce(new Error('Invalid verification code'));

    render(<VerifyEmailScreen />);
    fireEvent.changeText(screen.getByTestId('code-input'), '000000');
    fireEvent.press(screen.getByTestId('gradient-button'));

    await waitFor(() => {
      expect(screen.getByText(API_USER_MESSAGE)).toBeTruthy();
    });
  });

  it('calls resendVerification when resend is pressed', async () => {
    (api.resendVerification as jest.Mock).mockResolvedValueOnce({ message: 'Code sent' });

    render(<VerifyEmailScreen />);
    fireEvent.press(screen.getByText(/Resend code/i));

    await waitFor(() => {
      expect(api.resendVerification).toHaveBeenCalled();
    });
  });

  it('calls signOut when sign out is pressed', () => {
    render(<VerifyEmailScreen />);
    fireEvent.press(screen.getByText('Sign out'));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
