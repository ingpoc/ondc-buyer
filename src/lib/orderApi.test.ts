import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UCPOrder } from '../types';
import { fetchBuyerOrders, normalizeOrderListResponse, normalizeOrderResponse } from './orderApi';

const order = {
  id: 'order-1',
  status: 'created',
  createdAt: '2026-05-12T00:00:00.000Z',
  items: [],
} as UCPOrder;

describe('order API response normalization', () => {
  it('accepts common live order list response envelopes', () => {
    expect(normalizeOrderListResponse({ orders: [order] })).toEqual([order]);
    expect(normalizeOrderListResponse({ data: [order] })).toEqual([order]);
    expect(normalizeOrderListResponse({ data: { orders: [order] } })).toEqual([order]);
  });

  it('returns an empty list for malformed order list responses', () => {
    expect(normalizeOrderListResponse(null)).toEqual([]);
    expect(normalizeOrderListResponse({ data: { order } })).toEqual([]);
  });

  it('accepts common live order detail response envelopes', () => {
    expect(normalizeOrderResponse({ order })).toEqual(order);
    expect(normalizeOrderResponse({ data: { order } })).toEqual(order);
    expect(normalizeOrderResponse({ data: order })).toEqual(order);
  });

  it('returns null for malformed order detail responses', () => {
    expect(normalizeOrderResponse(null)).toBeNull();
    expect(normalizeOrderResponse({ data: [] })).toBeNull();
  });
});

describe('fetchBuyerOrders', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('routes the list through demo-commerce instead of dead /api/orders', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: { orders: [], count: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBuyerOrders('session-1')).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toMatch(/\/api\/demo-commerce\/buyer\/orders$/);
    expect(url).not.toMatch(/\/api\/orders(\?|$)/);
  });
});
