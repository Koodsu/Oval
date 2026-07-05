import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from './AuthContext';

jest.mock('../api', () => ({
  setToken: jest.fn(),
  setOnUnauthorized: jest.fn(),
  trackEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
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
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'hasAcceptedPodTerms') return Promise.resolve(null);
      if (key === 'guidelinesAccepted') return Promise.resolve(null);
      if (key === 'user') return Promise.resolve(null);
      if (key === 'token') return Promise.resolve(null);
      return Promise.resolve(null);
    });
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

  it('hasAcceptedGuidelines is true when hasAcceptedPodTerms is "true"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'hasAcceptedPodTerms') return Promise.resolve('true');
      if (key === 'guidelinesAccepted') return Promise.resolve(null);
      if (key === 'user') return Promise.resolve(null);
      if (key === 'token') return Promise.resolve(null);
      return Promise.resolve(null);
    });
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('accepted'));
  });

  it('migrates legacy guidelinesAccepted to hasAcceptedPodTerms', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'hasAcceptedPodTerms') return Promise.resolve(null);
      if (key === 'guidelinesAccepted') return Promise.resolve('true');
      if (key === 'user') return Promise.resolve(null);
      if (key === 'token') return Promise.resolve(null);
      return Promise.resolve(null);
    });
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('accepted'));
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('hasAcceptedPodTerms', 'true')
    );
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

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('hasAcceptedPodTerms', 'true');
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('accepted'));
  });
});
