import { useMemo, type ComponentType, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { clusterApiUrl } from '@solana/web3.js';

/** Hangar Solana adapters removed from product UI — empty provider for legacy hooks only. */
const SafeConnectionProvider = ConnectionProvider as unknown as ComponentType<{
  endpoint: string;
  children: ReactNode;
}>;
const SafeSolanaWalletProvider = SolanaWalletProvider as unknown as ComponentType<{
  wallets: unknown[];
  autoConnect?: boolean;
  children: ReactNode;
}>;

export function WalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl('devnet'), []);
  const wallets = useMemo(() => [], []);

  return (
    <SafeConnectionProvider endpoint={endpoint}>
      <SafeSolanaWalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </SafeSolanaWalletProvider>
    </SafeConnectionProvider>
  );
}
