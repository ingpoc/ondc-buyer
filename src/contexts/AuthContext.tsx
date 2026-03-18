import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { SSOUser } from '@/lib/api';
import { normalizeLoopbackUrl } from '@/lib/loopback';

const IDENTITY_URL = normalizeLoopbackUrl(import.meta.env.VITE_IDENTITY_URL || 'http://127.0.0.1:8000');
const IDENTITY_WEB_URL = normalizeLoopbackUrl(import.meta.env.VITE_IDENTITY_WEB_URL || 'http://127.0.0.1:3000');
const LOCAL_IDENTITY_AUTH_ENABLED = import.meta.env.VITE_IDENTITY_AUTH_ENABLED === 'true';

export type { SSOUser };

export interface AuthContextValue {
  user: SSOUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (returnUrl?: string) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SSOUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV && !LOCAL_IDENTITY_AUTH_ENABLED) {
      setUser(null);
      setLoading(false);
      setError(null);
      return;
    }
    void validateSession();
  }, []);

  const validateSession = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${IDENTITY_URL}/api/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth check failed');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (returnUrl = '/') => {
    const encodedReturn = encodeURIComponent(window.location.origin + returnUrl);
    window.location.href = `${IDENTITY_WEB_URL}/login?return=${encodedReturn}`;
  };

  const logout = async () => {
    try {
      await fetch(`${IDENTITY_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (logoutError) {
      console.error('Logout error:', logoutError);
    } finally {
      setUser(null);
      window.location.href = '/';
    }
  };

  const refresh = () => validateSession();

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        loading,
        error,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within AuthProvider');
  return context;
}
