/**
 * SSO-001: Auth Hook with Wallet-Based Session Sharing
 *
 * React hook for wallet-based SSO with session sharing across apps:
 * - Check existing session on mount and restore user state
 * - When wallet connects → validate/create session via gateway
 * - User stays logged in via session even when wallet disconnects
 * - Only logout clears the session
 *
 * Usage:
 * ```tsx
 * const { user, isAuthenticated, loading, logout, refresh } = useAuth();
 * ```
 */

import { useAuthContext } from '@/contexts/AuthContext';
import type { SSOUser } from '@/contexts/AuthContext';

export interface UseAuthResult {
  /** Current authenticated user (null if not logged in) */
  user: SSOUser | null;
  /** Is authentication state loading */
  loading: boolean;
  /** Is user currently authenticated */
  isAuthenticated: boolean;
  /** Logout from SSO and clear user state */
  logout: () => void;
  /** Refresh user session from SSO */
  refresh: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  return useAuthContext();
}
