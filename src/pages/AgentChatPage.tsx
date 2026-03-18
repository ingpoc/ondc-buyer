import { AgentChat, Alert, Badge, PageLayout, PageHeader } from '@portfolio-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAgentRuntime } from '@/hooks/useAgentEntitlement';
import { useTrustState } from '@/hooks/useTrustState';
import { TrustNotice } from '@/components/TrustStatus';

export function AgentChatPage(): JSX.Element {
  const { publicKey } = useWallet();
  const { user, loading: authLoading } = useAuthContext();
  const walletAddress = publicKey?.toBase58() ?? null;
  const subjectId = user?.wallet_address ?? walletAddress;
  const trust = useTrustState(walletAddress);
  const runtime = useAgentRuntime(subjectId, walletAddress);
  const showAgent = Boolean(subjectId) && runtime.agent_access;
  const usageLabel =
    runtime.usage.requests_limit > 0
      ? `Usage ${runtime.usage.requests_used}/${runtime.usage.requests_limit}`
      : `${runtime.usage.requests_used} requests this period`;

  return (
    <PageLayout>
      <PageHeader
        title="Buyer Agent Assistant"
        subtitle="Chat with the AI agent to search products, compare options, and get personalized recommendations."
      />
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone={runtime.runtime_available ? 'success' : 'warning'}>
            Runtime {runtime.auth_mode}
          </Badge>
          <Badge tone={trust.state === 'verified' ? 'success' : 'warning'}>
            {trust.state === 'verified' ? 'High-trust write access enabled' : 'Read-only agent mode'}
          </Badge>
          <Badge tone="info">{runtime.model}</Badge>
          <Badge tone="info">{usageLabel}</Badge>
        </div>

        {!subjectId && !authLoading ? (
          <Alert
            tone="warning"
            title="Authentication required"
            description="Sign in to AadhaarChain or connect a wallet-backed identity before starting a buyer agent session."
          />
        ) : null}

        {subjectId && !runtime.runtime_available ? (
          <Alert
            tone="warning"
            title="Claude runtime unavailable"
            description={runtime.blocked_reason ?? 'Configure supported Claude Agent SDK auth or use the local Claude CLI dev adapter on localhost.'}
          />
        ) : null}

        {subjectId && runtime.agent_access && trust.state !== 'verified' ? (
          <TrustNotice
            state={trust.state}
            loading={trust.loading}
            error={trust.error}
            reason={trust.reason}
            actionLabel="Verify in AadhaarChain"
          />
        ) : null}

        {showAgent ? (
          <AgentChat
            endpoint="/api/agent/buyer"
            title="Buyer Agent"
            placeholder="e.g., Find organic mangoes under ₹500"
            requestHeaders={() =>
              subjectId
                ? {
                    'X-User-Id': subjectId,
                    ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
                  }
                : {}
            }
          />
        ) : null}
      </div>
    </PageLayout>
  );
}
