import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UCPSessionItem } from '../types';
import { prepareDurableCheckout } from './commerceV1Client';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function response(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data }),
  });
}

function item(id: string, sellerId: string, quantity: number): UCPSessionItem {
  return {
    id: `line-${id}`,
    quantity,
    addedAt: '2026-07-22T00:00:00Z',
    item: {
      id,
      descriptor: { name: id },
      price: { currency: 'INR', value: '100.00' },
      images: [],
      provider: { id: sellerId, name: sellerId },
    } as UCPSessionItem['item'] & { provider: { id: string; name: string } },
  };
}

describe('CommerceV1 durable checkout preparation', () => {
  beforeEach(() => fetchMock.mockReset());

  it('creates one versioned cart and derives the exact landed total server-side', async () => {
    fetchMock
      .mockImplementationOnce(() => response({ cart: { cart_id: 'cart-1', seller_id: 'seller-1', version: 1 } }))
      .mockImplementationOnce(() => response({ cart: { cart_id: 'cart-1', seller_id: 'seller-1', version: 2 } }))
      .mockImplementationOnce(() => response({ cart: { cart_id: 'cart-1', seller_id: 'seller-1', version: 3 } }))
      .mockImplementationOnce(() => response({
        quote: {
          quote_id: 'quote-1',
          cart_id: 'cart-1',
          cart_version: 3,
          subtotal_paise: 40000,
          landed_total_paise: 42500,
          expires_at: '2026-07-22T00:15:00Z',
        },
      }));

    const prepared = await prepareDurableCheckout({
      items: [item('atta', 'seller-1', 2), item('dal', 'seller-1', 2)],
      attemptId: 'attempt-1',
    });

    expect(prepared.quote.landed_total_paise).toBe(42500);
    expect(prepared.correlationId).toBe('buyer-checkout:attempt-1');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ quantity: 2, expected_version: 1 });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ quantity: 2, expected_version: 2 });
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ expected_version: 3 });
    expect(fetchMock.mock.calls[3][1].headers).toMatchObject({
      'Idempotency-Key': 'attempt-1:preview',
      'X-Correlation-ID': 'buyer-checkout:attempt-1',
    });
  });

  it('rejects multi-seller carts before creating durable state', async () => {
    await expect(prepareDurableCheckout({
      items: [item('atta', 'seller-1', 1), item('dal', 'seller-2', 1)],
      attemptId: 'attempt-2',
    })).rejects.toThrow('one seller');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
