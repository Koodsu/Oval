import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from './AuthContext';

jest.mock('../api', () => ({
  setToken: jest.fn(),
  setOnUnauthorized: jest.fn(),
  registerPushToken: jest.fn().mockResolvedValue({ success: true }),
}));

function TestConsumer() {
  const { hasAcceptedGuidelines, acceptGuidelines, isLoading } = useAuth();
  if (isLoading) return <Text>loading</Text>;
  return (
    <>
      <Text testID="status">{hasAcceptedGuidelines ? 'accepted' : 'not-accepted'}</Text>
      <TouchableOpacity testID="accept-btn" onPress={acceptGuidelines} />
    </>
  );
}

describe('AuthContext — guidelines', () => {
  beforeEach(() => {
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
      ['token', null],
      ['user', null],
      ['guidelinesAccepted', null],
    ]);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('hasAcceptedGuidelines is false when storage has no value', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('not-accepted'));
  });

  it('hasAcceptedGuidelines is true when storage has "true"', async () => {
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
      ['token', null],
      ['user', null],
      ['guidelinesAccepted', 'true'],
    ]);
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('accepted'));
  });

  it('acceptGuidelines persists to storage and updates state', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => screen.getByTestId('accept-btn'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('accept-btn'));
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('guidelinesAccepted', 'true');
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('accepted'));
  });
});
