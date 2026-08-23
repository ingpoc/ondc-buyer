/**
 * Portfolio auth via gateway principal session (Auth0, Google, or local test sign-in).
 * Local: VITE_IDENTITY_AUTH_ENABLED=true in .env.local.
 * Production IdP: Auth0 Authorization Code Flow → aadharcha_session cookie.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { SSOUser } from '@/lib/api';
import { authFetchBase } from '@/lib/identityUrls';
import { syncBuyerPrincipalSession } from '@/lib/principalStorage';

const LOCAL_IDENTITY_AUTH_ENABLED = import.meta.env.VITE_IDENTITY_AUTH_ENABLED === 'true';
const AUDIENCE = 'ondcbuyer';

export function matchesAudience(user: SSOUser): boolean {
  const sharedPortfolioSession =
    (user.identity_provider === 'auth0' || user.identity_provider === 'google') &&
    (user.audience === 'ondcbuyer' || user.audience === 'ondcseller');
  return user.audience === AUDIENCE || user.audience === 'buyer' || sharedPortfolioSession;
}

export type { SSOUser };

export interface AuthContextValue {
  user: SSOUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  /** Prefer loginAuth0 in production. */
  login: (returnUrl?: string) => void;
  loginAuth0: (returnUrl?: string) => void;
  loginDemo: (returnUrl?: string) => void;
  loginGoogle: (returnUrl?: string) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function returnAbsolute(returnUrl = '/'): string {
  if (returnUrl.startsWith('http')) return returnUrl;
  return `${window.location.origin}${returnUrl.startsWith('/') ? returnUrl : `/${returnUrl}`}`;
}

function authUrl(path: string): string {
  const base = authFetchBase();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SSOUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const validateSession = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(authUrl('/api/auth/me'), {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const nextUser = data.data as SSOUser | null;
        if (!nextUser) {
          syncBuyerPrincipalSession(null);
          setUser(null);
          return;
        }
        if (!matchesAudience(nextUser)) {
          // Other-app cookie is not a Buyer session. Treat as signed-out for cart.
          // Guest cart wipe policy is in syncBuyerPrincipalSession, not here.
          syncBuyerPrincipalSession(null);
          setUser(null);
          setError('Signed in for a different app. Sign in again for Buyer.');
          return;
        }
        const nextPrincipal = nextUser.principal_id || nextUser.wallet_address || null;
        syncBuyerPrincipalSession(nextPrincipal);
        setUser(nextUser);
      } else {
        syncBuyerPrincipalSession(null);
        setUser(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth check failed');
      syncBuyerPrincipalSession(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (import.meta.env.DEV && !LOCAL_IDENTITY_AUTH_ENABLED) {
      setUser(null);
      setLoading(false);
      setError(null);
      return;
    }
    void validateSession();

    // Re-check after Auth0 return (including bfcache restore).
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) void validateSession();
      else void validateSession();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  const loginAuth0 = (returnUrl = '/') => {
    const encoded = encodeURIComponent(returnAbsolute(returnUrl));
    window.location.href = authUrl(`/api/auth/auth0/start?aud=${AUDIENCE}&return=${encoded}`);
  };

  const loginDemo = (returnUrl = '/') => {
    const encoded = encodeURIComponent(returnAbsolute(returnUrl));
    window.location.href = authUrl(`/api/auth/demo-continue?aud=${AUDIENCE}&return=${encoded}`);
  };

  const loginGoogle = (returnUrl = '/') => {
    const encoded = encodeURIComponent(returnAbsolute(returnUrl));
    window.location.href = authUrl(`/api/auth/google/start?aud=${AUDIENCE}&return=${encoded}`);
  };

  const login = (returnUrl = '/') => {
    loginAuth0(returnUrl);
  };

  const logout = async () => {
    try {
      await fetch(authUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      });
    } catch (logoutError) {
      console.error('Logout error:', logoutError);
    } finally {
      syncBuyerPrincipalSession(null);
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
        loginAuth0,
        loginDemo,
        loginGoogle,
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
