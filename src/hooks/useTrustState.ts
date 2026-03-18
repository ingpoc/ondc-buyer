import { useEffect, useState } from 'react';
import { fetchTrustSnapshot, type TrustSnapshot } from '@/lib/trust';

const DEFAULT_SNAPSHOT: TrustSnapshot = {
  state: 'no_identity',
  eligible: false,
  reason: null,
  trust: null,
};

export function useTrustState(walletAddress?: string | null) {
  const [snapshot, setSnapshot] = useState<TrustSnapshot>(DEFAULT_SNAPSHOT);
  const [loading, setLoading] = useState(Boolean(walletAddress));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setSnapshot(DEFAULT_SNAPSHOT);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchTrustSnapshot(walletAddress);
        if (!cancelled) {
          setSnapshot(next);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load trust state.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  return {
    ...snapshot,
    loading,
    error,
  };
}
