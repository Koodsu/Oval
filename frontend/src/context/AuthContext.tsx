import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setToken } from '../api';
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

  useEffect(() => {
    // Restore session from storage on startup
    AsyncStorage.multiGet(['token', 'user']).then(([tokenEntry, userEntry]) => {
      const storedToken = tokenEntry[1];
      const storedUser = userEntry[1];
      if (storedToken && storedUser) {
        setTokenState(storedToken);
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
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

  const signOut = async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
    setToken(null);
    setTokenState(null);
    setUser(null);
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
