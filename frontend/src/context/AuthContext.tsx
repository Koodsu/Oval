import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setToken, setOnUnauthorized } from '../api';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    AsyncStorage.multiGet(['token', 'user']).then(([tokenEntry, userEntry]) => {
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
      setIsLoading(false);
    });
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

  return (
    <AuthContext.Provider value={{ user, token, signIn, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
