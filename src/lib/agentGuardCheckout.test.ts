import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPurchasedCart,
  evaluateBuyerCheckout,
  executeBuyerCheckout,
  executeBuyerProtectedAction,
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

  it('clears the purchased cart only after both order and authorization references exist', async () => {
    const clearCart = vi.fn().mockResolvedValue(undefined);

    await expect(
      clearPurchasedCart({ orderId: 'order-1', receiptId: null, clearCart }),
    ).rejects.toThrow('before the authorized order is recorded');
    expect(clearCart).not.toHaveBeenCalled();

    await clearPurchasedCart({ orderId: 'order-1', receiptId: 'receipt-1', clearCart });
    expect(clearCart).toHaveBeenCalledTimes(1);
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

  it('executes non-checkout mutations only through AgentGuard', async () => {
    const fetchMock = vi.fn(async () =>
      apiResponse({
        decision: 'allow',
        receipt: { receipt_id: 'receipt-cancel', outcome: 'executed' },
        execution: { order: { order_id: 'order-1', status: 'cancelled' } },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'nonce-1' });

    await executeBuyerProtectedAction({
      action: 'buyer.order.cancel',
      resourceId: 'order-1',
      payload: { order_id: 'order-1' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/agentguard/actions/execute'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: expect.stringContaining('"action":"buyer.order.cancel"'),
      }),
    );
  });

  it('binds approval evaluation and execution to the same checkout payload', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        apiResponse({
          decision: 'need_approval',
          reason: 'Approval required',
          approval: { approval_id: 'approval-1', amount_inr: 20000 },
          receipt: null,
        }),
      )
      .mockResolvedValueOnce(
        apiResponse({
          decision: 'allow',
          receipt: { receipt_id: 'receipt-1', outcome: 'executed' },
          result: { order: { order_id: 'order-1' } },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const params = {
      walletAddress: 'principal:demo:buyer',
      subjectId: 'principal:demo:buyer',
      amountInr: 20000,
      sessionId: 'checkout-1',
      itemId: 'item-1',
      itemName: 'Whole Wheat Atta 1kg',
      quantity: 2,
      deliveryAddress: {
        line1: '12 Market Road',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        country: 'IND',
      },
    };
    const decision = await evaluateBuyerCheckout(params);
    await executeBuyerCheckout({ ...params, approvalId: decision.approval?.approval_id });

    const evaluateBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const executeBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(evaluateBody.payload).toEqual(executeBody.payload);
    expect(executeBody.payload).toEqual({
      item_id: 'item-1',
      item_title: 'Whole Wheat Atta 1kg',
      quantity: 2,
      buyer_id: 'principal:demo:buyer',
      amount_inr: 20000,
      delivery_address: {
        line1: '12 Market Road',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        country: 'IND',
      },
    });
  });

  it('preserves a safe inventory conflict message from checkout execution', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: 'Insufficient inventory.' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(
      executeBuyerCheckout({
        subjectId: 'principal:demo:buyer',
        amountInr: 89,
        sessionId: 'checkout-sold-out',
        itemId: 'item-sold-out',
        quantity: 1,
      }),
    ).rejects.toThrow('Insufficient inventory.');
  });
});
