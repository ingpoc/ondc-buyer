import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalSession } from '../lib/localCart';
import { useCart } from './useCart';

vi.mock('../lib/commerceConfig', () => ({
  COMMERCE_DEMO_MODE: false,
  COMMERCE_API_BASE: 'https://gateway.aadharcha.in',
  buildCommerceUrl: (path: string) => `https://gateway.aadharcha.in${path}`,
}));

const atta = {
  id: 'atta-1',
  name: 'Whole Wheat Atta 1kg',
  price: { currency: 'INR', value: '89.00' },
  images: [],
};

describe('useCart guest add', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('does not silently drop a guest add when the remote cart returns an empty session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            session: {
              id: 'session-remote',
              status: 'active',
              createdAt: '2026-08-19T10:00:00Z',
              updatedAt: '2026-08-19T10:00:00Z',
              items: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const { result } = renderHook(() => useCart());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addToCart(atta as never, 1);
    });

    expect(result.current.itemCount).toBe(1);
    expect(result.current.session?.items[0]?.item.id).toBe('atta-1');
    const sessionId = localStorage.getItem('ondc-session-id');
    expect(sessionId).toBeTruthy();
    expect(getLocalSession(sessionId as string).items[0]?.item.id).toBe('atta-1');
  });

  it('falls back to a local cart and surfaces the item after a 401 remote add', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('unauthorized', { status: 401 })),
    );

    const { result } = renderHook(() => useCart());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addToCart(atta as never, 1);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.itemCount).toBe(1);
    expect(result.current.session?.items[0]?.item.name).toBe('Whole Wheat Atta 1kg');
  });
});
