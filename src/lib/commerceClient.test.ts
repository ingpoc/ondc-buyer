import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  listCommerceBuyerOrders,
  mapDemoItemToBuyerItem,
  mapDemoOrderToBuyerOrder,
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
      payment: { status: 'succeeded' },
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
    expect(mapped.payment).toBeUndefined();
    expect(mapped.provider).toMatchObject({ name: 'Fresh Farm Foods', verified: true });
    expect(mapped.authorization).toMatchObject({
      decision: 'allow',
      receiptReference: 'rcpt-1',
      approvalReference: 'approval-1',
      amountInr: 178,
    });
    expect(mapped.authorization?.reason).toContain('Exact one-time approval');
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
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});
