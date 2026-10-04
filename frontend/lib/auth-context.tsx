'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, UserRole, AuthResponseData } from '@/types';
import * as api from './api';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  hasDashboardAccess: boolean;
  login: (email: string, password: string) => Promise<AuthResponseData>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Synchronous initialization from cached storage prevents route guard redirect flicker
  const [user, setUser] = useState<User | null>(() => {
    return api.getCachedUser();
  });
  
  // If we have token and cached user, loading is false immediately
  const [loading, setLoading] = useState<boolean>(() => {
    const token = api.getAccessToken();
    const cached = api.getCachedUser();
    return Boolean(token && !cached);
  });

  const router = useRouter();
  const initStarted = useRef<boolean>(false);

  // Subscribe to auth state updates (e.g. token cleared on failed refresh or user profile updated)
  useEffect(() => {
    const unsubscribe = api.subscribeAuthChange((newUser) => {
      setUser(newUser);
      if (!newUser) {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Multi-tab storage event synchronization
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'visa_access_token' || e.key === 'visa_user') {
        const token = api.getAccessToken();
        const cached = api.getCachedUser();
        if (!token) {
          setUser(null);
          setLoading(false);
        } else if (cached) {
          setUser(cached);
          setLoading(false);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Initial authentication bootstrap - runs once on startup
  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    const token = api.getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Token exists: verify/refresh profile non-blockingly
    api.getCurrentUser(8000)
      .then((freshUser) => {
        if (freshUser) {
          setUser(freshUser);
        } else {
          // Token expired or invalid and refresh failed
          setUser(null);
        }
      })
      .catch(() => {
        // Keep cached user if offline or temporary network delay
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const currentUser = await api.getCurrentUser(5000);
      if (currentUser) {
        setUser(currentUser);
      }
    } catch {
      // Keep existing state
    }
  }, []);

  const login = async (email: string, password: string): Promise<AuthResponseData> => {
    setLoading(true);
    try {
      const data = await api.loginWithEmailPassword(email, password);
      setUser(data.user);
      setLoading(false);
      return data;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.logout();
    } finally {
      setUser(null);
      setLoading(false);
      router.push('/login');
    }
  };

  const role = user?.role || null;
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdmin = role === 'ADMIN';
  const isManager = role === 'MANAGER';
  const hasDashboardAccess = isSuperAdmin || isAdmin || isManager;

  const value = {
    user,
    role,
    loading,
    isAuthenticated: !!user,
    isSuperAdmin,
    isAdmin,
    isManager,
    hasDashboardAccess,
    login,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
