import { useAuthContext } from '@/contexts/AuthContext';

/** Subject for AgentGuard / memory — opaque principal, not a wallet. */
export function useSubject() {
  const { user, loading: authLoading } = useAuthContext();
  const principalId: string | null =
    typeof user?.principal_id === 'string' && user.principal_id ? user.principal_id : null;
  const walletAddress: string | null =
    typeof user?.wallet_address === 'string' && user.wallet_address
      ? user.wallet_address
      : null;
  const subjectId: string | null = principalId ?? walletAddress;

  return {
    authLoading,
    subjectId,
    principalId,
    /** Present only for legacy wallet sessions. Prefer principalId. */
    walletAddress,
  };
}
