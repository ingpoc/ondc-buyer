import { useWallet } from '@solana/wallet-adapter-react';
import { useAuthContext } from '@/contexts/AuthContext';

export function useSubject() {
  const { publicKey } = useWallet();
  const { user, loading: authLoading } = useAuthContext();
  const adapterWallet = publicKey?.toBase58() ?? null;
  const walletAddress = user?.wallet_address ?? adapterWallet;
  const subjectId = walletAddress;

  return {
    authLoading,
    subjectId,
    walletAddress,
  };
}
