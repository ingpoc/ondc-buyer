import {
  LEGACY_ACTION_ALIASES,
  type AgentRef,
  type AgentGuardAction,
  type IntentReceipt,
  type Mandate,
} from '@aadharchain/agentguard-contract';
import {
  applyBuyerAgentControl,
  applyBuyerAgentPoll,
  currentBuyerAgentPollEpoch,
  getBuyerAgentAuthority,
  invalidateBuyerAgentPolls,
} from './buyerAgentAuthority';
import { TRUST_API_URL } from './identityUrls';

export interface BuyerCheckoutDecision {
  decision: 'allow' | 'need_approval' | 'deny';
  decision_id: string;
  reason: string;
  approval?: { approval_id: string; amount_inr: number } | null;
  receipt?: { receipt_id: string; outcome: string } | null;
}

export async function clearPurchasedCart(params: {
  orderId?: string | null;
  receiptId?: string | null;
  clearCart: () => Promise<void>;
}): Promise<void> {
  if (!params.orderId || !params.receiptId) {
    throw new Error('Cannot clear the cart before the authorized order is recorded.');
  }
  await params.clearCart();
}

async function parseData<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(body.detail || body.message || 'AgentGuard request failed');
  }
  return body.data as T;
}

/** Legacy wallet body only — social/demo sessions rely on cookie principal. */
function walletField(walletAddress?: string | null): Record<string, string> {
  if (!walletAddress || walletAddress.startsWith('principal:')) return {};
  return { wallet_address: walletAddress };
}

/** Evaluate elevated checkout; consume approval if already issued. */
export async function evaluateBuyerCheckout(params: {
  walletAddress?: string | null;
  actor?: 'agent' | 'user';
  amountInr: number;
  quoteId: string;
  correlationId: string;
  deliveryContext?: Record<string, string>;
}): Promise<BuyerCheckoutDecision> {
  const response = await fetch(`${TRUST_API_URL}/api/agentguard/actions/evaluate`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-ID': params.correlationId,
    },
    body: JSON.stringify({
      ...walletField(params.walletAddress),
      actor: params.actor ?? 'agent',
      action: LEGACY_ACTION_ALIASES.checkout,
      amount_inr: params.amountInr,
      resource_id: params.quoteId,
      payload: {
        quote_id: params.quoteId,
        delivery_context: params.deliveryContext,
      },
    }),
  });
  const data = await parseData<{
    decision: BuyerCheckoutDecision['decision'];
    decision_id: string;
    reason: string;
    approval: { approval_id: string; amount_inr: number } | null;
    receipt: { receipt_id: string; outcome: string } | null;
  }>(response);
  return {
    decision: data.decision,
    decision_id: data.decision_id,
    reason: data.reason,
    approval: data.approval,
    receipt: data.receipt,
  };
}

export async function consumeBuyerCheckoutApproval(params: {
  walletAddress?: string | null;
  approvalId: string;
}) {
  const response = await fetch(`${TRUST_API_URL}/api/agentguard/approvals/consume`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...walletField(params.walletAddress),
      approval_id: params.approvalId,
    }),
  });
  if (response.status === 409) {
    throw new Error('Checkout approval already consumed (replay rejected).');
  }
  return parseData<{ receipt: { receipt_id: string; outcome: string } }>(response);
}

/** Preferred mutation boundary for checkout commit. */
export async function executeBuyerCheckout(params: {
  walletAddress?: string | null;
  actor?: 'agent' | 'user';
  quoteId: string;
  decisionId: string;
  correlationId: string;
  approvalId?: string;
  idempotencyKey?: string;
  paymentOutcome?: 'succeeded' | 'failed' | 'unknown';
  deliveryContext?: Record<string, string>;
}) {
  const response = await fetch(`${TRUST_API_URL}/api/agentguard/actions/execute`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': params.idempotencyKey ?? `buyer-checkout:${params.quoteId}`,
      'X-Correlation-ID': params.correlationId,
    },
    body: JSON.stringify({
      ...walletField(params.walletAddress),
      actor: params.actor ?? 'agent',
      action: LEGACY_ACTION_ALIASES.checkout,
      amount_inr: 0,
      resource_id: params.quoteId,
      decision_id: params.decisionId,
      approval_id: params.approvalId,
      idempotency_key: params.idempotencyKey ?? `buyer-checkout:${params.quoteId}`,
      payload: {
        quote_id: params.quoteId,
        payment_outcome: params.paymentOutcome ?? 'succeeded',
        delivery_context: params.deliveryContext,
      },
    }),
  });
  if (response.status === 409) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string; message?: string };
    throw new Error(body.detail || body.message || 'Checkout is no longer available. Refresh and try again.');
  }
  const data = await parseData<{
    decision?: string;
    receipt?: { receipt_id: string; outcome: string };
    result?: Record<string, unknown>;
    execution?: Record<string, unknown>;
  }>(response);
  const execution = data.execution ?? data.result;
  return execution ? { ...data, execution } : data;
}

/** Sole mutation boundary for non-checkout Buyer actions. */
export async function executeBuyerProtectedAction(params: {
  walletAddress?: string | null;
  action: AgentGuardAction;
  resourceId: string;
  amountInr?: number;
  approvalId?: string;
  idempotencyKey?: string;
  correlationId?: string;
  payload?: Record<string, unknown>;
}) {
  const idempotencyKey =
    params.idempotencyKey ?? `${params.action}:${params.resourceId}:${crypto.randomUUID()}`;
  const correlationId = params.correlationId ?? `buyer-protected:${idempotencyKey}`;
  const response = await fetch(`${TRUST_API_URL}/api/agentguard/actions/execute`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      'X-Correlation-ID': correlationId,
    },
    body: JSON.stringify({
      ...walletField(params.walletAddress),
      action: params.action,
      amount_inr: params.amountInr ?? 0,
      resource_id: params.resourceId,
      approval_id: params.approvalId,
      idempotency_key: idempotencyKey,
      payload: params.payload ?? {},
    }),
  });
  if (response.status === 409) {
    throw new Error('Buyer protected action conflict (replay or state).');
  }
  const data = await parseData<{
    decision?: string;
    receipt?: { receipt_id: string; outcome: string };
    result?: Record<string, unknown>;
    execution?: Record<string, unknown>;
    approval?: { approval_id: string } | null;
  }>(response);
  const execution = data.execution ?? data.result;
  return execution ? { ...data, execution } : data;
}

/** Verify an Intent Receipt. Must not pause/resume agent authority. */
export async function verifyBuyerReceipt(params: { receiptId: string }) {
  const response = await fetch(`${TRUST_API_URL}/api/agentguard/receipts/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receipt_id: params.receiptId }),
  });
  return parseData<{ valid: boolean; reason?: string }>(response);
}

export async function compileBuyerMandate(params: {
  walletAddress?: string | null;
  checkoutAutoMaxInr?: number;
  allowedActions?: AgentGuardAction[];
}) {
  const checkoutMax = params.checkoutAutoMaxInr ?? 10000;
  const response = await fetch(`${TRUST_API_URL}/api/agentguard/mandates/compile`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...walletField(params.walletAddress),
      role: 'buyer',
      template: 'buyer_shop_v1',
      allowed_actions: params.allowedActions,
      limits: {
        auto_approve_max_inr: {
          'buyer.checkout.commit': checkoutMax,
        },
      },
    }),
  });
  return parseData<{
    mandate: Mandate;
  }>(response);
}

export async function confirmBuyerMandate(params: {
  walletAddress?: string | null;
  mandateId: string;
}) {
  const response = await fetch(
    `${TRUST_API_URL}/api/agentguard/mandates/${params.mandateId}/confirm`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...walletField(params.walletAddress),
      }),
    }
  );
  return parseData<{ mandate: Mandate }>(response);
}

/** Read-only AgentGuard status. Must not ensure/resume — pause is exclusive to the Resume control. */
export async function fetchBuyerAgentGuardStatus(walletAddress?: string | null) {
  const isLegacyWallet = Boolean(walletAddress && !walletAddress.startsWith('principal:'));
  const path = isLegacyWallet
    ? `/api/agentguard/wallets/${encodeURIComponent(walletAddress as string)}`
    : '/api/agentguard/agents/current?role=buyer';
  const response = await fetch(`${TRUST_API_URL}${path}`, { credentials: 'include' });
  const data = await parseData<{
    agent: AgentRef | null;
    mandate?: Mandate | null;
    receipts: IntentReceipt[];
  }>(response);
  return {
    ...data,
    receipts: data.agent
      ? (data.receipts ?? []).filter((receipt) => receipt.agent_id === data.agent?.agent_id)
      : [],
  };
}

/** Fetch status and apply it through the sticky pause store. */
export async function syncBuyerAgentGuardStatus(walletAddress?: string | null) {
  const epoch = currentBuyerAgentPollEpoch();
  const status = await fetchBuyerAgentGuardStatus(walletAddress);
  return { status, snapshot: applyBuyerAgentPoll(status, epoch) };
}

export async function setBuyerAgentPaused(params: { agentId: string; paused: boolean }) {
  const previous = getBuyerAgentAuthority();
  if (previous.agent?.agent_id === params.agentId) {
    applyBuyerAgentControl(previous.agent, params.paused);
  } else {
    invalidateBuyerAgentPolls();
  }
  try {
    const operation = params.paused ? 'pause' : 'resume';
    const response = await fetch(
      `${TRUST_API_URL}/api/agentguard/agents/${params.agentId}/${operation}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    const result = await parseData<{ agent: AgentRef }>(response);
    const snapshot = applyBuyerAgentControl(result.agent, params.paused);
    return { agent: snapshot.agent ?? result.agent };
  } catch (error) {
    if (previous.agent) {
      applyBuyerAgentControl(previous.agent, previous.explicitPaused);
    }
    throw error;
  }
}
