import { useWallet } from '@solana/wallet-adapter-react';
import { useAuthContext } from '@/contexts/AuthContext';

export function useSubject() {
  const { publicKey } = useWallet();
  const { user, loading: authLoading } = useAuthContext();
  const walletAddress = publicKey?.toBase58() ?? null;
  const subjectId = user?.wallet_address ?? walletAddress;

  return {
    authLoading,
    subjectId,
    walletAddress,
  };
}
