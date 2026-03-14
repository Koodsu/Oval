import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { setToken, setOnUnauthorized, registerPushToken } from '../api';
import { User } from '../types';

const TOKEN_KEY = 'auth_token';
const LEGACY_TOKEN_KEY = 'token'; // old AsyncStorage key — migrated on first launch

interface AuthContextValue {
  user: User | null;
  token: string | null;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (partial: Partial<User>) => Promise<void>;
  isLoading: boolean;
  hasAcceptedGuidelines: boolean;
  acceptGuidelines: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

/** Request permission and send the Expo push token to the backend. Best-effort: never throws. */
async function registerForPushNotifications(): Promise<void> {
  try {
    if (Platform.OS === 'web') return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    await registerPushToken(tokenData.data);
  } catch {
    // Best-effort — never block sign-in on notification errors
  }
}

/**
 * One-time migration: move JWT token from plaintext AsyncStorage (old) to
 * SecureStore (iOS Keychain / Android Keystore). Runs on every startup but
 * is a no-op once the legacy key is gone.
 */
async function migrateTokenToSecureStore(): Promise<void> {
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacy) {
      await SecureStore.setItemAsync(TOKEN_KEY, legacy);
      await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
    }
  } catch {
    // Migration failure is non-fatal — user will be asked to log in again
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAcceptedGuidelines, setHasAcceptedGuidelines] = useState(false);

  const signOut = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      AsyncStorage.removeItem('user'),
    ]);
    setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  useEffect(() => {
    // Wire up the 401 callback so expired tokens trigger automatic sign-out
    setOnUnauthorized(signOut);
    return () => setOnUnauthorized(null);
  }, [signOut]);

  useEffect(() => {
    // Restore session from storage on startup
    async function restoreSession() {
      // Migrate token from old plaintext AsyncStorage to SecureStore
      await migrateTokenToSecureStore();

      const [storedToken, userEntry, guidelinesEntry] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('guidelinesAccepted'),
      ]);

      if (storedToken && userEntry) {
        try {
          const parsed = JSON.parse(userEntry);
          if (parsed?.id && parsed?.name && parsed?.email) {
            setTokenState(storedToken);
            setToken(storedToken);
            setUser(parsed);
          }
        } catch {
          // Corrupted user data — clear and require re-login
          await Promise.all([
            SecureStore.deleteItemAsync(TOKEN_KEY),
            AsyncStorage.removeItem('user'),
          ]);
        }
      }

      setHasAcceptedGuidelines(guidelinesEntry === 'true');
      setIsLoading(false);
    }

    restoreSession();
  }, []);

  const signIn = async (newToken: string, newUser: User) => {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, newToken),
      AsyncStorage.setItem('user', JSON.stringify(newUser)),
    ]);
    setToken(newToken);
    setTokenState(newToken);
    setUser(newUser);
    // Register for push notifications after token is set (best-effort)
    registerForPushNotifications();
  };

  const acceptGuidelines = async () => {
    await AsyncStorage.setItem('guidelinesAccepted', 'true');
    setHasAcceptedGuidelines(true);
  };

  const updateUser = async (partial: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...partial };
    await AsyncStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, signIn, signOut, updateUser, isLoading, hasAcceptedGuidelines, acceptGuidelines }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
