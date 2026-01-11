import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import type { AuthTokens } from '../api/types';
import { clearSecurityPassword } from '../utils/crypto';

interface User {
  username: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: (clearLocalData?: boolean) => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'hrt-access-token';
const REFRESH_TOKEN_STORAGE_KEY = 'hrt-refresh-token';
const USERNAME_STORAGE_KEY = 'hrt-username';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshPromiseRef = React.useRef<Promise<boolean> | null>(null);

  const logout = useCallback(async (clearLocalData: boolean = false) => {
    setAccessToken(null);
    setUser(null);
    apiClient.setAccessToken(null);

    // Always clear auth tokens
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(USERNAME_STORAGE_KEY);

    // Always clear security password cookie
    try {
      await clearSecurityPassword();
    } catch (error) {
      console.error('Failed to clear security password during logout:', error);
    }

    // Optionally clear local user data
    if (clearLocalData) {
      localStorage.removeItem('hrt-events');
      localStorage.removeItem('hrt-weight');
      localStorage.removeItem('hrt-lab-results');
      localStorage.removeItem('hrt-lang');
      localStorage.removeItem('hrt-last-modified');
      localStorage.removeItem('hrt-last-sync-time');
    }
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    // Prevent multiple simultaneous refresh attempts
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      try {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
        if (!refreshToken) return false;

        const response = await apiClient.refreshToken({ refresh_token: refreshToken });

        if (response.success && response.data) {
          const { access_token, refresh_token } = response.data;
          setAccessToken(access_token);
          apiClient.setAccessToken(access_token);
          localStorage.setItem(TOKEN_STORAGE_KEY, access_token);
          localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refresh_token);
          return true;
        }

        // If refresh fails, logout
        logout();
        return false;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [logout]);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedAccessToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const storedUsername = localStorage.getItem(USERNAME_STORAGE_KEY);

    if (storedAccessToken && storedUsername) {
      setAccessToken(storedAccessToken);
      setUser({ username: storedUsername });
      apiClient.setAccessToken(storedAccessToken);
    }

    setIsLoading(false);
  }, []);

  // Set refresh token callback
  useEffect(() => {
    apiClient.setRefreshTokenCallback(refreshAccessToken);
  }, [refreshAccessToken]);

  // Set up token refresh interval
  useEffect(() => {
    if (!accessToken) return;

    // Refresh token every 50 minutes (tokens expire in 1 hour)
    const refreshInterval = setInterval(() => {
      refreshAccessToken();
    }, 50 * 60 * 1000);

    return () => clearInterval(refreshInterval);
    // Only re-run when accessToken changes, not when refreshAccessToken changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const login = async (username: string, password: string) => {
    const response = await apiClient.login({ username, password });

    if (response.success && response.data) {
      const { access_token, refresh_token } = response.data;

      setAccessToken(access_token);
      setUser({ username });
      apiClient.setAccessToken(access_token);

      localStorage.setItem(TOKEN_STORAGE_KEY, access_token);
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refresh_token);
      localStorage.setItem(USERNAME_STORAGE_KEY, username);

      return { success: true };
    }

    return { success: false, error: response.error || 'Login failed' };
  };

  const register = async (username: string, password: string) => {
    const response = await apiClient.register({ username, password });

    if (response.success && response.data) {
      const { access_token, refresh_token } = response.data;

      setAccessToken(access_token);
      setUser({ username });
      apiClient.setAccessToken(access_token);

      localStorage.setItem(TOKEN_STORAGE_KEY, access_token);
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refresh_token);
      localStorage.setItem(USERNAME_STORAGE_KEY, username);

      return { success: true };
    }

    return { success: false, error: response.error || 'Registration failed' };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        login,
        register,
        logout,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
