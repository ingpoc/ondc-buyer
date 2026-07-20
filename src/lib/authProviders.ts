/**
 * Gateway /api/auth/providers — Auth0 (preferred), Google, booth demo.
 */
import { useEffect, useState } from 'react';
import { authFetchBase } from './identityUrls';

export type AuthProviders = {
  auth0: boolean;
  google: boolean;
  demo_continue: boolean;
  runtime_mode?: string;
};

const DEFAULT: AuthProviders = { auth0: false, google: false, demo_continue: false };

export function useAuthProviders(): AuthProviders & { loading: boolean } {
  const [providers, setProviders] = useState<AuthProviders>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${authFetchBase()}/api/auth/providers`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('providers');
        const body = await res.json();
        const data = body?.data ?? {};
        if (!cancelled) {
          setProviders({
            auth0: Boolean(data.auth0),
            google: Boolean(data.google),
            demo_continue: Boolean(data.demo_continue),
            runtime_mode: typeof data.runtime_mode === 'string' ? data.runtime_mode : undefined,
          });
        }
      } catch {
        if (!cancelled) setProviders(DEFAULT);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...providers, loading };
}
