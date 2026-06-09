import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  acceptCurrentTerms,
  setToken as setApiToken,
  setOnUnauthorized,
} from '../api';
import { User } from '../types';
import { CURRENT_TERMS_VERSION } from '../constants/legal';

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
  clearSession: () => Promise<void>;
  updateUser: (partial: Partial<User>) => Promise<void>;
  isLoading: boolean;
  hasAcceptedGuidelines: boolean;
  acceptGuidelines: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setStoredToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function deleteStoredToken(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
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
async function migrateLegacyTokenStorage(): Promise<string | null> {
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacy) {
      try {
        await setStoredToken(legacy);
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
      deleteStoredToken(),
      AsyncStorage.removeItem(LEGACY_TOKEN_KEY),
      AsyncStorage.removeItem('user'),
    ]);
    setApiToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  const clearSession = signOut;

  useEffect(() => {
    // Fast Refresh / JS bundle reloads can reset api.ts module state while
    // React preserves AuthContext state. Keep the request layer in sync.
    setApiToken(token);
  }, [token]);

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
      const migratedToken = await migrateLegacyTokenStorage();

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
            getStoredToken(),
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
            setApiToken(storedToken);
            setUser(parsed);
            if (
              parsed.termsVersion === CURRENT_TERMS_VERSION &&
              typeof parsed.ageAttestedAt === 'string'
            ) {
              setHasAcceptedGuidelines(true);
            }
          }
        } catch {
          // Corrupted user data — clear and require re-login
          await Promise.all([
            deleteStoredToken(),
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
        setStoredToken(newToken),
        AsyncStorage.setItem('user', JSON.stringify(newUser)),
      ]);
    } catch (err) {
      // Storage write failed — do not set in-memory state so the caller's
      // error boundary can surface the failure rather than leaving the user
      // appearing logged-in with a token that won't survive the next launch.
      throw err;
    }
    setApiToken(newToken);
    setTokenState(newToken);
    setUser(newUser);
  };

  const acceptGuidelines = async () => {
    if (token && user) {
      const response = await acceptCurrentTerms();
      await AsyncStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
    }
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
      value={{ user, token, signIn, signOut, clearSession, updateUser, isLoading, hasAcceptedGuidelines, acceptGuidelines }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
