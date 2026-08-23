import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCommerceBuyerIssue,
  getCommerceOrderTrack,
  listCommerceBuyerIssues,
  listCommerceBuyerOrders,
  listCommerceBuyerReturns,
  mapDemoItemToBuyerItem,
  mapDemoOrderToBuyerOrder,
  orderFromCommerceExecution,
  type DemoCommerceOrder,
} from './commerceClient';

afterEach(() => vi.unstubAllGlobals());

describe('mapDemoItemToBuyerItem', () => {
  it('preserves customer-facing seller, delivery, and return terms', () => {
    const mapped = mapDemoItemToBuyerItem({
      item_id: 'item-1',
      version: 2,
      status: 'published',
      seller_id: 'principal:demo:hidden',
      seller_name: 'Fresh Farm Foods',
      title: 'Toor Dal 1kg',
      description: 'Unpolished dal',
      price_inr: 149,
      inventory: 7,
      category_id: 'Grocery',
      delivery_estimate: '2-4 business days',
      return_policy: 'Sealed packs may be returned within 7 days.',
      image_url: '/products/toor-dal-lentils.jpg',
      image_caption: 'Ingredient photo; packaging may vary',
      delivery_areas: ['Pune', '411001'],
      created_at: '2026-07-17T00:00:00Z',
      updated_at: '2026-07-17T00:00:00Z',
    });

    expect(mapped.provider?.name).toBe('Fresh Farm Foods');
    expect(mapped.deliveryEstimate).toBe('2-4 business days');
    expect(mapped.returnPolicy).toContain('7 days');
    expect(mapped.images).toEqual([{ url: '/products/toor-dal-lentils.jpg' }]);
    expect(mapped.imageCaption).toBe('Ingredient photo; packaging may vary');
    expect(mapped.deliveryAreas).toEqual(['Pune', '411001']);
  });
});

describe('mapDemoOrderToBuyerOrder', () => {
  it('preserves customer-facing item and delivery details with a unit price', () => {
    const mapped = mapDemoOrderToBuyerOrder({
      order_id: 'order-1',
      transaction_id: 'txn-1',
      message_id: 'msg-1',
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      seller_name: 'Fresh Farm Foods',
      item_id: 'item-1',
      item_title: 'Whole Wheat Atta 1kg',
      item_version: 1,
      quantity: 2,
      amount_inr: 178,
      status: 'paid',
      payment: { status: 'succeeded', amount_inr: 178, reference_id: 'sandbox:pay-1' },
      authorization: {
        decision: 'allow',
        reason_code: 'exact_approval',
        receipt_id: 'rcpt-1',
        approval_id: 'approval-1',
        amount_inr: 178,
        recorded_at: '2026-07-16T12:01:00Z',
      },
      delivery_address: {
        line1: '12 Market Road',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        country: 'IND',
      },
      created_at: '2026-07-16T12:00:00Z',
      updated_at: '2026-07-16T12:00:00Z',
    } satisfies DemoCommerceOrder);

    expect(mapped.items[0]).toMatchObject({
      name: 'Whole Wheat Atta 1kg',
      quantity: 2,
      price: { currency: 'INR', value: '89.00' },
    });
    expect(mapped.deliveryAddress).toMatchObject({
      line1: '12 Market Road',
      city: 'Pune',
      postalCode: '411001',
    });
    expect(mapped.fulfillment?.providerName).toBeUndefined();
    expect(mapped.payment).toMatchObject({
      status: 'completed',
      amount: { currency: 'INR', value: '178.00' },
      transactionId: 'sandbox:pay-1',
    });
    expect(mapped.provider).toMatchObject({ name: 'Fresh Farm Foods', verified: true });
    expect(mapped.authorization).toMatchObject({
      decision: 'allow',
      receiptReference: 'rcpt-1',
      approvalReference: 'approval-1',
      amountInr: 178,
    });
    expect(mapped.authorization?.reason).toContain('Exact one-time approval');
  });

  it.each([
    ['failed', 'failed'],
    ['unknown', 'unknown'],
    ['pending', 'pending'],
    ['reconciled', 'reconciled'],
  ] as const)('preserves a %s payment as %s', (source, expected) => {
    const mapped = mapDemoOrderToBuyerOrder({
      order_id: `order-${source}`,
      transaction_id: `txn-${source}`,
      message_id: `msg-${source}`,
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      item_id: 'item-1',
      item_version: 1,
      quantity: 1,
      amount_inr: 178,
      status: 'created',
      payment: { status: source, amount_inr: 178 },
      created_at: '2026-07-16T12:00:00Z',
      updated_at: '2026-07-16T12:00:00Z',
    });
    expect(mapped.payment?.status).toBe(expected);
  });

  it('projects committed dispatch and delivery evidence for Buyer tracking', () => {
    const mapped = mapDemoOrderToBuyerOrder({
      order_id: 'order-delivered',
      transaction_id: 'txn-delivered',
      message_id: 'msg-delivered',
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      seller_name: 'Fresh Farm Foods',
      item_id: 'item-1',
      item_title: 'Whole Wheat Atta 1kg',
      item_version: 1,
      quantity: 1,
      amount_inr: 149,
      status: 'delivered',
      fulfilment: {
        status: 'delivered',
        tracking_id: 'CF23-TRACK-1',
        tracking_url: 'https://logistics.example/track/CF23-TRACK-1',
        provider_name: 'Lifecycle Logistics',
        status_message: 'Delivered to the customer',
        history: [
          {
            status: 'shipped',
            recorded_at: '2026-07-23T00:30:00Z',
            tracking_id: 'CF23-TRACK-1',
            status_message: 'Collected from seller',
          },
          {
            status: 'delivered',
            recorded_at: '2026-07-23T01:00:00Z',
            status_message: 'Delivered to the customer',
          },
        ],
      },
      created_at: '2026-07-23T00:00:00Z',
      updated_at: '2026-07-23T01:00:00Z',
    } satisfies DemoCommerceOrder);

    expect(mapped.status).toBe('delivered');
    expect(mapped.fulfillment).toMatchObject({
      providerName: 'Lifecycle Logistics',
      status: 'delivered',
      tracking: {
        id: 'CF23-TRACK-1',
        url: 'https://logistics.example/track/CF23-TRACK-1',
        status: 'delivered',
        statusMessage: 'Delivered to the customer',
      },
      history: [
        {
          status: 'shipped',
          recordedAt: '2026-07-23T00:30:00Z',
          trackingId: 'CF23-TRACK-1',
          statusMessage: 'Collected from seller',
        },
        {
          status: 'delivered',
          recordedAt: '2026-07-23T01:00:00Z',
          statusMessage: 'Delivered to the customer',
        },
      ],
    });
  });
});

describe('Buyer fulfilment and remedy read/write boundary', () => {
  it('uses authenticated issue and return routes and preserves verified outcome data', async () => {
    const issue = {
      issue_id: 'issue-1',
      order_id: 'order-1',
      status: 'resolution_proposed',
      reason: 'post_delivery',
      description: 'Package was damaged',
      response: 'Replacement approved',
      remedy: { type: 'replacement', message: 'Replacement will be sent' },
      outcome_receipt: { receipt_id: 'receipt-outcome-1', outcome: 'closed' },
      created_at: '2026-07-23T00:00:00Z',
      updated_at: '2026-07-23T01:00:00Z',
    };
    const returnRequest = {
      return_id: 'return-1',
      order_id: 'order-1',
      status: 'requested',
      version: 1,
      reason: 'Damaged package',
      created_at: '2026-07-23T01:00:00Z',
      updated_at: '2026-07-23T01:00:00Z',
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { issue } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { issues: [issue], count: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { returns: [returnRequest], count: 1 },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const created = await createCommerceBuyerIssue({
      orderId: 'order-1',
      reason: 'post_delivery',
      description: 'Package was damaged',
    });
    const issues = await listCommerceBuyerIssues('order-1');
    const returns = await listCommerceBuyerReturns('order-1');

    expect(fetchMock.mock.calls[0]?.[0]).toMatch(
      /\/api\/demo-commerce\/buyer\/orders\/order-1\/issues$/,
    );
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(fetchMock.mock.calls[1]?.[0]).toMatch(
      /\/api\/demo-commerce\/buyer\/issues\?order_id=order-1$/,
    );
    expect(fetchMock.mock.calls[2]?.[0]).toMatch(
      /\/api\/demo-commerce\/buyer\/returns\?order_id=order-1$/,
    );
    expect(created.remedy).toMatchObject({ type: 'replacement' });
    expect(issues[0].outcome_receipt_id).toBe('receipt-outcome-1');
    expect(returns[0]).toMatchObject({ return_id: 'return-1', status: 'requested' });
  });
});

describe('Buyer commerce read boundary', () => {
  it('uses the session-scoped orders route without a caller-selected principal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { orders: [], count: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await listCommerceBuyerOrders();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/demo-commerce\/buyer\/orders$/),
      expect.objectContaining({ credentials: 'include' })
    );
  });
});

describe('Buyer live tracking read boundary', () => {
  it('uses the gateway track route with the order id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          order_id: '5A807CE9',
          status: 'shipped',
          tracking: { id: 'SHIP-TEST-5A807CE9', status: 'active' },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCommerceOrderTrack('5A807CE9')).resolves.toMatchObject({
      status: 'shipped',
      tracking: { id: 'SHIP-TEST-5A807CE9' },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/ondc\/track\?order_id=5A807CE9$/),
      expect.objectContaining({ credentials: 'include' })
    );
  });
});

describe('CommerceV1 execution adapter', () => {
  it('accepts the durable paise order shape returned by AgentGuard', () => {
    const mapped = orderFromCommerceExecution({
      order: {
        order_id: 'order-v1',
        seller_id: 'seller-1',
        landed_total_paise: 8_900,
        status: 'paid',
        created_at: '2026-07-22T00:00:00Z',
      },
      payment_attempt: {
        payment_attempt_id: 'payment-v1',
        amount_paise: 8_900,
        status: 'succeeded',
      },
    });

    expect(mapped).toMatchObject({
      id: 'order-v1',
      quote: { total: { currency: 'INR', value: '89.00' } },
      payment: { status: 'completed', transactionId: 'payment-v1' },
    });
  });
});
