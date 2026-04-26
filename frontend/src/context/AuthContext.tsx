import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { setToken, setOnUnauthorized, registerPushToken } from '../api';
import { User } from '../types';

const TOKEN_KEY = 'auth_token';
const LEGACY_TOKEN_KEY = 'token'; // old AsyncStorage key — migrated on first launch
const HAS_ACCEPTED_POD_TERMS_KEY = 'hasAcceptedPodTerms';
/** Legacy key — migrated to HAS_ACCEPTED_POD_TERMS_KEY on read */
const LEGACY_GUIDELINES_ACCEPTED_KEY = 'guidelinesAccepted';

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
/**
 * One-time migration: move JWT token from plaintext AsyncStorage (old) to
 * SecureStore (iOS Keychain / Android Keystore). Returns the token that should
 * be used this session — either the freshly migrated one or whatever was
 * already in SecureStore.
 *
 * If the SecureStore write fails (e.g. Keychain locked on Android), the legacy
 * token stays in AsyncStorage and we return it directly so the user stays
 * logged in. The migration retries on the next launch.
 */
async function migrateTokenToSecureStore(): Promise<string | null> {
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacy) {
      try {
        await SecureStore.setItemAsync(TOKEN_KEY, legacy);
        await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
        return legacy;
      } catch {
        // SecureStore write failed — keep legacy key intact and return the
        // token so this session works; migration retries next launch.
        return legacy;
      }
    }
  } catch {
    // AsyncStorage read failed — nothing to migrate.
  }
  return null;
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
      // Migrate token from old plaintext AsyncStorage to SecureStore.
      // migratedToken is non-null when the legacy key existed but SecureStore
      // write failed — use it as a fallback so the user stays logged in.
      const migratedToken = await migrateTokenToSecureStore();

      const STORAGE_TIMEOUT_MS = 5000;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('storage_timeout')), STORAGE_TIMEOUT_MS);
      });

      let secureToken: string | null = null;
      let userEntry: string | null = null;
      let podTermsEntry: string | null = null;
      let legacyGuidelinesEntry: string | null = null;
      try {
        [secureToken, userEntry, podTermsEntry, legacyGuidelinesEntry] = await Promise.race([
          Promise.all([
            SecureStore.getItemAsync(TOKEN_KEY),
            AsyncStorage.getItem('user'),
            AsyncStorage.getItem(HAS_ACCEPTED_POD_TERMS_KEY),
            AsyncStorage.getItem(LEGACY_GUIDELINES_ACCEPTED_KEY),
          ]),
          timeout,
        ]);
      } catch {
        // Storage read timed out or failed — treat as logged-out and let the
        // user sign in again rather than blocking on the splash screen forever.
        if (timeoutId) clearTimeout(timeoutId);
        setIsLoading(false);
        return;
      }
      if (timeoutId) clearTimeout(timeoutId);

      const storedToken = secureToken ?? migratedToken;

      if (storedToken && userEntry) {
        try {
          const parsed = JSON.parse(userEntry);
          if (
            parsed?.id &&
            parsed?.name &&
            parsed?.email &&
            typeof parsed.verifiedUniversity === 'boolean' &&
            parsed?.joinedAt
          ) {
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

      const accepted =
        podTermsEntry === 'true' || legacyGuidelinesEntry === 'true';
      if (legacyGuidelinesEntry === 'true' && podTermsEntry !== 'true') {
        try {
          await AsyncStorage.setItem(HAS_ACCEPTED_POD_TERMS_KEY, 'true');
        } catch {
          // non-fatal
        }
      }
      setHasAcceptedGuidelines(accepted);
      setIsLoading(false);
    }

    restoreSession();
  }, []);

  const signIn = async (newToken: string, newUser: User) => {
    try {
      await Promise.all([
        SecureStore.setItemAsync(TOKEN_KEY, newToken),
        AsyncStorage.setItem('user', JSON.stringify(newUser)),
      ]);
    } catch (err) {
      // Storage write failed — do not set in-memory state so the caller's
      // error boundary can surface the failure rather than leaving the user
      // appearing logged-in with a token that won't survive the next launch.
      throw err;
    }
    setToken(newToken);
    setTokenState(newToken);
    setUser(newUser);
    // Register for push notifications after token is set (best-effort)
    registerForPushNotifications();
  };

  const acceptGuidelines = async () => {
    await AsyncStorage.setItem(HAS_ACCEPTED_POD_TERMS_KEY, 'true');
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
