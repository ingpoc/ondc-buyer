/**
 * AUTH-COMPOSITION: deployed_public_mode=compatibility_probe_only
 *
 * React hook for the identity-session compatibility surface:
 * - restore user state when a compatible identity session exists
 * - local and explicitly configured dev flows may validate or create sessions
 * - deployed public behavior must not be described as cross-app session sharing
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
  /** Logout from the identity-session provider and clear user state */
  logout: () => void;
  /** Refresh user state from the identity-session provider */
  refresh: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  return useAuthContext();
}
