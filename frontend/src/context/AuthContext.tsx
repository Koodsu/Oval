import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setToken, setOnUnauthorized } from '../api';
import { User } from '../types';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAcceptedGuidelines, setHasAcceptedGuidelines] = useState(false);

  const signOut = useCallback(async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
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
    AsyncStorage.multiGet(['token', 'user', 'guidelinesAccepted']).then(
      ([tokenEntry, userEntry, guidelinesEntry]) => {
        const storedToken = tokenEntry[1];
        const storedUser = userEntry[1];
        if (storedToken && storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            if (parsed?.id && parsed?.name && parsed?.email) {
              setTokenState(storedToken);
              setToken(storedToken);
              setUser(parsed);
            }
          } catch {
            // Corrupted user data - clear and require re-login
            AsyncStorage.multiRemove(['token', 'user']);
          }
        }
        setHasAcceptedGuidelines(guidelinesEntry[1] === 'true');
        setIsLoading(false);
      },
    );
  }, []);

  const signIn = async (newToken: string, newUser: User) => {
    await AsyncStorage.multiSet([
      ['token', newToken],
      ['user', JSON.stringify(newUser)],
    ]);
    setToken(newToken);
    setTokenState(newToken);
    setUser(newUser);
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
