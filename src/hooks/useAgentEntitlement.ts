import { useEffect, useMemo, useState } from 'react';
import type { AgentRuntimeSnapshot } from '@/types/agent';

const DEFAULT_RUNTIME: AgentRuntimeSnapshot = {
  app_id: 'ondc-buyer',
  auth_mode: 'unavailable',
  model: 'claude-haiku-4-5-20251001',
  runtime_available: false,
  agent_access: false,
  trust_state: 'no_identity',
  trust_required_for_write: true,
  mode: 'blocked',
  usage: {
    requests_used: 0,
    requests_limit: 0,
    period_start: '',
    period_end: '',
    estimated_cost_usd: 0,
  },
  allowed_capabilities: [],
  blocked_reason: 'Authentication required.',
};

export function useAgentRuntime(subjectId?: string | null, walletAddress?: string | null) {
  const [snapshot, setSnapshot] = useState<AgentRuntimeSnapshot>(DEFAULT_RUNTIME);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subjectId) {
      setSnapshot(DEFAULT_RUNTIME);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/agent/runtime?app=ondc-buyer', {
          headers: {
            'X-User-Id': subjectId,
            ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
          },
        });
        if (!response.ok) {
          throw new Error(`Runtime request failed: ${response.status}`);
        }
        const next = (await response.json()) as AgentRuntimeSnapshot;
        if (!cancelled) {
          setSnapshot(next);
        }
      } catch (err) {
        if (!cancelled) {
          setSnapshot(DEFAULT_RUNTIME);
          setError(err instanceof Error ? err.message : 'Failed to load runtime.');
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
  }, [subjectId, walletAddress]);

  return useMemo(
    () => ({
      ...snapshot,
      loading,
      error,
    }),
    [snapshot, loading, error],
  );
}

export const useAgentEntitlement = useAgentRuntime;
