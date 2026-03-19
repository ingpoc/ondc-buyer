import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgentChat, Alert, Badge, Button, Card, PageLayout, PageHeader } from '@portfolio-ui';
import { useAgentRuntime, useSubject, useTrustState } from '@/hooks';
import { TrustNotice } from '@/components/TrustStatus';
import { applyBuyerClientPatch, buildBuyerBrowserStateSnapshot } from '@/lib/agentCommerceState';
import type { AgentChatMessage } from '@portfolio-ui';
import type { AgentSessionSummary, BuyerAgentTaskState, BuyerClientPatch } from '@/types/agent';

const BUYER_AGENT_ENDPOINT = '/api/agent/buyer';
const BUYER_AGENT_SESSION_STORAGE_KEY = `portfolio-agent-session-id:${BUYER_AGENT_ENDPOINT}`;

function isBuyerAgentTaskState(value: unknown): value is BuyerAgentTaskState {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as BuyerAgentTaskState).candidate_results));
}

function isBuyerClientPatch(value: unknown): value is BuyerClientPatch {
  return Boolean(value && typeof value === 'object' && typeof (value as BuyerClientPatch).patch_type === 'string');
}

export function AgentChatPage(): JSX.Element {
  const navigate = useNavigate();
  const { walletAddress, subjectId, authLoading } = useSubject();
  const trust = useTrustState(walletAddress);
  const runtime = useAgentRuntime(subjectId, walletAddress);
  const [agentState, setAgentState] = useState<BuyerAgentTaskState | null>(null);
  const showAgent = Boolean(subjectId) && runtime.agent_access;
  const usageLabel =
    runtime.usage.requests_limit > 0
      ? `Usage ${runtime.usage.requests_used}/${runtime.usage.requests_limit}`
      : `${runtime.usage.requests_used} requests this period`;
  const buildRequestContext = useMemo(
    () => () => ({
      browser_state: buildBuyerBrowserStateSnapshot('/agent'),
    }),
    [],
  );

  useEffect(() => {
    if (!subjectId) {
      return;
    }

    const sessionId = window.localStorage.getItem(BUYER_AGENT_SESSION_STORAGE_KEY);
    if (!sessionId) {
      return;
    }

    let cancelled = false;

    const hydrateSession = async () => {
      try {
        const response = await fetch(`/api/agent/ondc-buyer/sessions/${sessionId}`, {
          headers: {
            'X-User-Id': subjectId,
            ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
          },
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as AgentSessionSummary;
        const taskState = payload.context?.buyer_task_state;
        if (!cancelled && isBuyerAgentTaskState(taskState)) {
          setAgentState(taskState);
        }
      } catch {
        // Session hydration is best-effort; the next prompt still syncs browser state.
      }
    };

    void hydrateSession();

    return () => {
      cancelled = true;
    };
  }, [subjectId, walletAddress]);

  const handleAgentMessage = (message: AgentChatMessage) => {
    const rawMessage = message as unknown as { type: string; state?: unknown; patch?: unknown };

    if (message.type === 'session_state' && isBuyerAgentTaskState(rawMessage.state)) {
      setAgentState(rawMessage.state);
      return;
    }

    if (message.type === 'client_patch' && isBuyerClientPatch(rawMessage.patch)) {
      applyBuyerClientPatch(rawMessage.patch);
    }
  };

  const draft = agentState?.draft_checkout;
  const activeOrder = agentState?.active_order;
  const supportCases = agentState?.support_cases ?? [];

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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <AgentChat
              endpoint={BUYER_AGENT_ENDPOINT}
              title="Buyer Agent"
              placeholder="e.g., Buy 5 apples under ₹500"
              buildRequestContext={buildRequestContext}
              onMessage={handleAgentMessage}
              requestHeaders={() => ({
                'X-User-Id': subjectId!,
                ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
              })}
            />

            <div className="space-y-4">
              <Card className="rounded-[var(--ui-radius-lg)] p-5">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">
                  Orchestration State
                </div>
                <div className="mt-3 text-lg font-bold tracking-[-0.03em] text-[var(--ui-text)]">
                  {agentState?.execution_state ?? 'idle'}
                </div>
                {agentState?.intent?.product_query ? (
                  <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">
                    Current intent: {agentState.intent.product_query}
                    {agentState.intent.quantity ? ` x${agentState.intent.quantity}` : ''}
                  </p>
                ) : null}
                {agentState?.clarifying_questions?.length ? (
                  <div className="mt-4 space-y-2 text-sm text-[var(--ui-text-secondary)]">
                    {agentState.clarifying_questions.map((question) => (
                      <p key={question}>{question}</p>
                    ))}
                  </div>
                ) : null}
              </Card>

              {draft ? (
                <Card className="rounded-[var(--ui-radius-lg)] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">Draft Checkout</div>
                      <div className="mt-2 text-lg font-bold tracking-[-0.03em] text-[var(--ui-text)]">
                        {draft.item_title}
                      </div>
                    </div>
                    <Badge tone={draft.ready_for_confirmation ? 'success' : 'warning'}>
                      {draft.ready_for_confirmation ? 'Ready to confirm' : 'Needs buyer details'}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-[var(--ui-text-secondary)]">
                    Seller: {draft.provider_name}. Total: {draft.total.currency} {draft.total.value}. ETA: {draft.delivery_estimate}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => navigate('/checkout')}>
                      Open Checkout
                    </Button>
                    <Button type="button" onClick={() => navigate('/cart')}>
                      Review Cart
                    </Button>
                  </div>
                </Card>
              ) : null}

              {activeOrder ? (
                <Card className="rounded-[var(--ui-radius-lg)] p-5">
                  <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">Active Order</div>
                  <div className="mt-2 text-lg font-bold tracking-[-0.03em] text-[var(--ui-text)]">
                    {activeOrder.id}
                  </div>
                  <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">
                    {activeOrder.provider.name} · {activeOrder.status} · {activeOrder.quote.total.currency} {activeOrder.quote.total.value}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => navigate(`/orders/${activeOrder.id}`)}>
                      View Order
                    </Button>
                    <Button type="button" onClick={() => navigate('/orders')}>
                      Open Orders
                    </Button>
                  </div>
                </Card>
              ) : null}

              {supportCases.length > 0 ? (
                <Card className="rounded-[var(--ui-radius-lg)] p-5">
                  <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ui-text-muted)]">Support Cases</div>
                  <div className="mt-4 space-y-3">
                    {supportCases.slice(0, 3).map((supportCase) => (
                      <div key={supportCase.case_id} className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-[var(--ui-text)]">{supportCase.network_case_id}</div>
                          <Badge tone={supportCase.status === 'resolved' ? 'success' : 'warning'}>{supportCase.status}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">{supportCase.description}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </PageLayout>
  );
}
