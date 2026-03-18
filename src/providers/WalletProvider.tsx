import { useMemo, type ComponentType, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

// These adapters expose children types that do not line up cleanly with this
// React 18 app, so we narrow them to the props we actually use here.
const SafeConnectionProvider = ConnectionProvider as unknown as ComponentType<{
  endpoint: string;
  children: ReactNode;
}>;
const SafeSolanaWalletProvider = SolanaWalletProvider as unknown as ComponentType<{
  wallets: Array<PhantomWalletAdapter | SolflareWalletAdapter>;
  autoConnect?: boolean;
  children: ReactNode;
}>;
const SafeWalletModalProvider = WalletModalProvider as unknown as ComponentType<{
  children: ReactNode;
}>;

export function WalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl('devnet'), []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <SafeConnectionProvider endpoint={endpoint}>
      <SafeSolanaWalletProvider wallets={wallets} autoConnect>
        <SafeWalletModalProvider>
          {children}
        </SafeWalletModalProvider>
      </SafeSolanaWalletProvider>
    </SafeConnectionProvider>
  );
}
