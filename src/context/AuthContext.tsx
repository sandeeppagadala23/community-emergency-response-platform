import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types/auth';
import { apiClient } from '../services/apiClient';

type BackendUser = Omit<UserProfile, 'role'> & { role: string };

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole | null;
  isLoading: boolean;
  authError: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (details: {
    username: string;
    email: string;
    phone_number: string;
    password: string;
    confirm_password: string;
  }) => Promise<void>;
  logout: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const userRoles: UserRole[] = ['RESIDENT', 'GUARDIAN', 'VOLUNTEER', 'SECURITY', 'ADMIN'];

function normalizeUser(user: BackendUser): UserProfile {
  if (!userRoles.includes(user.role as UserRole)) {
    throw new Error(`Unsupported user role returned by backend: ${user.role}`);
  }

  return { ...user, role: user.role as UserRole };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const existing = apiClient.getCurrentUser();
    const token = apiClient.getToken();
    if (token?.startsWith('demo_')) {
      apiClient.clearAuth();
      apiClient.resetBaseUrl();
      return null;
    }
    if (existing && token && !token.startsWith('demo_')) {
      return existing;
    }
    apiClient.clearAuth();
    return null;
  });

  const [isLoading, setIsLoading] = useState(() =>
    Boolean(
      apiClient.getToken()
      && !apiClient.getToken()?.startsWith('demo_')
      && apiClient.getCurrentUser(),
    ),
  );
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const token = apiClient.getToken();
    const cachedUser = apiClient.getCurrentUser();
    if (token?.startsWith('demo_')) {
      apiClient.setBaseUrl('mock');
      return;
    }
    if (!cachedUser || !token || token.startsWith('demo_')) return;

    let active = true;
    apiClient
      .request('/api/auth/csrf/')
      .then(() => apiClient.request<BackendUser>('/api/auth/me/'))
      .then((backendUser) => {
        if (!active) return;
        const authenticatedUser = normalizeUser(backendUser);
        apiClient.setAuth(apiClient.getToken(), authenticatedUser);
        setUser(authenticatedUser);
        setAuthError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        apiClient.clearAuth();
        setUser(null);
        setAuthError(apiClient.normalizeError(error).message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      apiClient.clearAuth();
      setUser(null);
      setAuthError('Your session has expired. Please sign in again.');
      setIsLoading(false);
    };
    window.addEventListener('cerp:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('cerp:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (identifier: string, password: string) => {
    await apiClient.request('/api/auth/csrf/');
    const response = await apiClient.request<{ token: string; user: BackendUser }>(
      '/api/auth/login/',
      {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      },
    );
    const authenticatedUser = normalizeUser(response.user);
    apiClient.setAuth(response.token, authenticatedUser);
    setAuthError(null);
    setUser(authenticatedUser);
    setIsLoading(false);
  };

  const register = async (details: {
    username: string;
    email: string;
    phone_number: string;
    password: string;
    confirm_password: string;
  }) => {
    await apiClient.request('/api/auth/csrf/');
    const response = await apiClient.request<{ token: string; user: BackendUser }>(
      '/api/auth/register/',
      {
        method: 'POST',
        body: JSON.stringify(details),
      },
    );
    const authenticatedUser = normalizeUser(response.user);
    apiClient.setAuth(response.token, authenticatedUser);
    setAuthError(null);
    setUser(authenticatedUser);
    setIsLoading(false);
  };

  const logout = async () => {
    const isMockSession = apiClient.isMockMode();
    let logoutError: unknown;
    if (!isMockSession) {
      try {
        await apiClient.request('/api/auth/logout/', { method: 'POST' });
      } catch (error) {
        logoutError = error;
      }
    }
    apiClient.clearAuth();
    if (isMockSession) apiClient.resetBaseUrl();
    setUser(null);
    setAuthError(
      logoutError
        ? `Signed out on this device, but the backend session could not be confirmed as ended: ${apiClient.normalizeError(logoutError).message}`
        : null,
    );
    setIsLoading(false);
    return !logoutError;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        isLoading,
        authError,
        login,
        register,
        logout,
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
