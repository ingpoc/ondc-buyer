import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPurchasedCart,
  evaluateBuyerCheckout,
  executeBuyerCheckout,
  executeBuyerProtectedAction,
  fetchBuyerAgentGuardStatus,
  setBuyerAgentPaused,
  syncBuyerAgentGuardStatus,
  verifyBuyerReceipt,
} from './agentGuardCheckout';
import { getBuyerAgentAuthority, resetBuyerAgentAuthority } from './buyerAgentAuthority';

function apiResponse(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Buyer AgentGuard controls', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    resetBuyerAgentAuthority();
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
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/agents/ensure'),
      expect.anything(),
    );
  });

  it('does not ensure or resume a paused agent when reading status for a legacy wallet', async () => {
    const fetchMock = vi.fn(async () =>
      apiResponse({
        agent: { agent_id: 'agent-buyer-1', status: 'paused' },
        mandate: { mandate_id: 'mandate-1', status: 'active' },
        receipts: [],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const status = await fetchBuyerAgentGuardStatus('0xabc');
    expect(status.agent?.status).toBe('paused');
    const urls = fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(urls.some((url) => url.includes('/ensure') || url.includes('/resume'))).toBe(false);
    expect(urls.some((url) => url.includes('/wallets/0xabc'))).toBe(true);
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
    const urls = fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(urls.some((url) => url.includes('/pause') || url.includes('/resume') || url.includes('/ensure'))).toBe(false);
  });

  it('does not unpause when a status poll after pause reports active', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.includes('/pause') && method === 'POST') {
          return apiResponse({ agent: { agent_id: 'agent-buyer-1', status: 'paused', role: 'buyer' } });
        }
        return apiResponse({
          agent: { agent_id: 'agent-buyer-1', status: 'active', role: 'buyer' },
          mandate: { mandate_id: 'mandate-1', status: 'active' },
          receipts: [],
        });
      }),
    );

    await setBuyerAgentPaused({ agentId: 'agent-buyer-1', paused: true });
    const { snapshot } = await syncBuyerAgentGuardStatus();
    expect(snapshot.agent?.status).toBe('paused');
    expect(getBuyerAgentAuthority().explicitPaused).toBe(true);
  });

  it('one Resume stays on when the control response and later polls still say paused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.includes('/pause') && method === 'POST') {
          return apiResponse({
            agent: { agent_id: 'agent-buyer-1', status: 'paused', role: 'buyer', principal_id: 'principal:demo:buyer' },
          });
        }
        if (url.includes('/resume') && method === 'POST') {
          return apiResponse({
            agent: { agent_id: 'agent-buyer-1', status: 'paused', role: 'buyer', principal_id: 'principal:demo:buyer' },
          });
        }
        return apiResponse({
          agent: { agent_id: 'agent-buyer-1', status: 'paused', role: 'buyer', principal_id: 'principal:demo:buyer' },
          mandate: { mandate_id: 'mandate-1', status: 'active' },
          receipts: [],
        });
      }),
    );

    await setBuyerAgentPaused({ agentId: 'agent-buyer-1', paused: true });
    const resumed = await setBuyerAgentPaused({ agentId: 'agent-buyer-1', paused: false });
    expect(resumed.agent.status).toBe('active');
    expect(getBuyerAgentAuthority().explicitPaused).toBe(false);

    const { snapshot } = await syncBuyerAgentGuardStatus();
    expect(snapshot.agent?.status).toBe('active');
    expect(getBuyerAgentAuthority().explicitPaused).toBe(false);
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
          decision_id: 'decision-1',
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
      amountInr: 20000,
      quoteId: 'quote-1',
      correlationId: 'checkout-correlation-1',
    };
    const decision = await evaluateBuyerCheckout(params);
    await executeBuyerCheckout({
      walletAddress: params.walletAddress,
      quoteId: params.quoteId,
      decisionId: decision.decision_id,
      correlationId: params.correlationId,
      approvalId: decision.approval?.approval_id,
    });

    const evaluateBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const executeBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(evaluateBody.actor).toBe('agent');
    expect(executeBody.actor).toBe('agent');
    expect(evaluateBody.payload).toEqual({ quote_id: 'quote-1' });
    expect(executeBody.payload).toEqual({
      quote_id: 'quote-1',
      payment_outcome: 'succeeded',
    });
    expect(executeBody.decision_id).toBe('decision-1');
  });

  it('surfaces AWAITING_RAZORPAY_TEST_PAYMENT from a 202 execute without treating it as failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              message: 'Order is ready to pay via Razorpay Test Mode.',
              data: {
                reason_code: 'AWAITING_RAZORPAY_TEST_PAYMENT',
                required_action: 'pay',
                receipt: { receipt_id: 'receipt-pending-1', outcome: 'awaiting_payment' },
                result: {
                  order: { order_id: 'commerce-order-1', status: 'payment_pending', landed_total_paise: 17800 },
                  payment_rail: { rail: 'razorpay_test', key_id: 'rzp_test_x', simulated: false },
                },
              },
            }),
            { status: 202, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const executed = await executeBuyerCheckout({
      quoteId: 'quote-1',
      decisionId: 'decision-1',
      correlationId: 'checkout-correlation-1',
    });

    expect(executed.reason_code).toBe('AWAITING_RAZORPAY_TEST_PAYMENT');
    expect(executed.required_action).toBe('pay');
    expect(executed.receipt?.outcome).toBe('awaiting_payment');
    expect(executed.execution).toMatchObject({
      order: { order_id: 'commerce-order-1', status: 'payment_pending' },
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
        quoteId: 'quote-sold-out',
        decisionId: 'decision-sold-out',
        correlationId: 'checkout-sold-out',
      }),
    ).rejects.toThrow('Insufficient inventory.');
  });
});
