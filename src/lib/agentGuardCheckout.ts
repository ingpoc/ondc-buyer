import { TRUST_API_URL } from './identityUrls';

export interface BuyerCheckoutDecision {
  decision: 'allow' | 'need_approval' | 'deny';
  reason: string;
  approval?: { approval_id: string; amount_inr: number } | null;
  receipt?: { receipt_id: string; outcome: string } | null;
}

async function parseData<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(body.detail || body.message || 'AgentGuard request failed');
  }
  return body.data as T;
}

/** Evaluate elevated checkout; consume approval if already issued. */
export async function evaluateBuyerCheckout(params: {
  walletAddress: string;
  amountInr: number;
  sessionId: string;
}): Promise<BuyerCheckoutDecision> {
  const response = await fetch(`${TRUST_API_URL}/api/agentguard/actions/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet_address: params.walletAddress,
      action: 'checkout',
      amount_inr: params.amountInr,
      resource_id: params.sessionId,
    }),
  });
  const data = await parseData<{
    decision: BuyerCheckoutDecision['decision'];
    reason: string;
    approval: { approval_id: string; amount_inr: number } | null;
    receipt: { receipt_id: string; outcome: string } | null;
  }>(response);
  return {
    decision: data.decision,
    reason: data.reason,
    approval: data.approval,
    receipt: data.receipt,
  };
}

export async function consumeBuyerCheckoutApproval(params: {
  walletAddress: string;
  approvalId: string;
}) {
  const response = await fetch(`${TRUST_API_URL}/api/agentguard/approvals/consume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet_address: params.walletAddress,
      approval_id: params.approvalId,
    }),
  });
  if (response.status === 409) {
    throw new Error('Checkout approval already consumed (replay rejected).');
  }
  return parseData<{ receipt: { receipt_id: string; outcome: string } }>(response);
}
