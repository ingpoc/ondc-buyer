import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchBuyerAgentGuardStatus,
  setBuyerAgentPaused,
  verifyBuyerReceipt,
} from './agentGuardCheckout';

function apiResponse(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Buyer AgentGuard controls', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the cookie-bound Buyer agent and receipt activity', async () => {
    const fetchMock = vi.fn(async () =>
      apiResponse({
        agent: { agent_id: 'agent-buyer-1', status: 'active' },
        mandate: { mandate_id: 'mandate-1', status: 'active' },
        receipts: [
          {
            receipt_id: 'receipt-1',
            agent_id: 'agent-buyer-1',
            action: 'buyer.checkout.commit',
            amount_inr: 89,
            resource_id: 'order-1',
            outcome: 'executed',
            created_at: '2026-07-14T10:00:00Z',
          },
          {
            receipt_id: 'receipt-seller-1',
            agent_id: 'agent-seller-1',
            action: 'seller.refund.issue',
            amount_inr: 50,
            resource_id: 'order-2',
            outcome: 'executed',
            created_at: '2026-07-14T10:01:00Z',
          },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const status = await fetchBuyerAgentGuardStatus();

    expect(status.agent?.status).toBe('active');
    expect(status.receipts.map((receipt) => receipt.receipt_id)).toEqual(['receipt-1']);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/agentguard/agents/current?role=buyer'),
      { credentials: 'include' }
    );
  });

  it.each([
    [true, 'pause', 'paused'],
    [false, 'resume', 'active'],
  ] as const)('uses the principal-bound %s endpoint', async (paused, path, status) => {
    const fetchMock = vi.fn(async () =>
      apiResponse({
        agent: { agent_id: 'agent-buyer-1', status },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await setBuyerAgentPaused({ agentId: 'agent-buyer-1', paused });

    expect(result.agent.status).toBe(status);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/agents/agent-buyer-1/${path}`),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: '{}',
      })
    );
  });

  it('verifies a receipt by id', async () => {
    const fetchMock = vi.fn(async () => apiResponse({ valid: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(verifyBuyerReceipt({ receiptId: 'receipt-1' })).resolves.toEqual({ valid: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/agentguard/receipts/verify'),
      expect.objectContaining({ body: JSON.stringify({ receipt_id: 'receipt-1' }) })
    );
  });
});
