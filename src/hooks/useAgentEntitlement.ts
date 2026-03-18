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
const LOCAL_AGENT_RUNTIME_ENABLED = import.meta.env.VITE_AGENT_RUNTIME_ENABLED !== 'false';

function isUsageSnapshot(value: unknown): value is AgentRuntimeSnapshot['usage'] {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const usage = value as Record<string, unknown>;
  return (
    typeof usage.requests_used === 'number' &&
    typeof usage.requests_limit === 'number' &&
    typeof usage.period_start === 'string' &&
    typeof usage.period_end === 'string' &&
    typeof usage.estimated_cost_usd === 'number'
  );
}

function isAgentRuntimeSnapshot(value: unknown): value is AgentRuntimeSnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const snapshot = value as Record<string, unknown>;
  return (
    snapshot.app_id === 'ondc-buyer' &&
    typeof snapshot.auth_mode === 'string' &&
    typeof snapshot.model === 'string' &&
    typeof snapshot.runtime_available === 'boolean' &&
    typeof snapshot.agent_access === 'boolean' &&
    typeof snapshot.trust_state === 'string' &&
    typeof snapshot.trust_required_for_write === 'boolean' &&
    typeof snapshot.mode === 'string' &&
    Array.isArray(snapshot.allowed_capabilities) &&
    (typeof snapshot.blocked_reason === 'string' || snapshot.blocked_reason === null || snapshot.blocked_reason === undefined) &&
    isUsageSnapshot(snapshot.usage)
  );
}

export function useAgentRuntime(subjectId?: string | null, walletAddress?: string | null) {
  const [snapshot, setSnapshot] = useState<AgentRuntimeSnapshot>(DEFAULT_RUNTIME);
  const [loading, setLoading] = useState(Boolean(subjectId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subjectId) {
      setSnapshot(DEFAULT_RUNTIME);
      setLoading(false);
      setError(null);
      return;
    }

    if (import.meta.env.DEV && !LOCAL_AGENT_RUNTIME_ENABLED) {
      setSnapshot({
        ...DEFAULT_RUNTIME,
        blocked_reason: 'Local agent runtime backend is not configured for browser validation.',
      });
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
        const payload = await response.json();
        if (!isAgentRuntimeSnapshot(payload)) {
          throw new Error('Runtime response shape is invalid.');
        }
        const next = payload;
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
