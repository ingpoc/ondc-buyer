import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UCPItem } from '../types';
import { rememberBuyerCatalogItems } from '../lib/buyerCatalogCache';
import * as commerceClient from '../lib/commerceClient';
import * as protocolClient from '../lib/ondc/protocolClient';
import { useApi } from './useApi';

afterEach(() => vi.restoreAllMocks());

describe('useApi product detail', () => {
  it('resolves a product from the search-result cache without a second gateway route', async () => {
    const item: UCPItem = {
      id: 'cached-atta-item',
      name: 'Cached Atta',
      descriptor: { name: 'Cached Atta' },
      price: { currency: 'INR', value: '89.00' },
      images: [],
    };
    rememberBuyerCatalogItems([item]);

    const { result } = renderHook(() => useApi<UCPItem>('/api/catalog/products/cached-atta-item'));
    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(item);
  });
});

describe('useApi local search dependency boundary', () => {
  it('preserves an empty query so browse-all returns categorized catalog items', async () => {
    const item: UCPItem = {
      id: 'published-atta-item',
      name: 'PreProd Test Atta 1 kg',
      descriptor: { name: 'PreProd Test Atta 1 kg' },
      category: 'Grocery',
      price: { currency: 'INR', value: '89.00' },
      images: [],
    };
    const networkReady = vi.spyOn(protocolClient, 'isOndcNetworkSearchReady').mockResolvedValue(true);
    const localSearch = vi.spyOn(commerceClient, 'searchCommerceItems').mockResolvedValue({
      items: [item],
      totalCount: 1,
      __source: 'api',
    });

    const { result } = renderHook(() => useApi<{ items: UCPItem[]; totalCount: number }>('/api/search?category=grocery&q='));
    await act(async () => {
      await result.current.execute();
    });

    expect(networkReady).not.toHaveBeenCalled();
    expect(localSearch).toHaveBeenCalledWith('');
    expect(result.current.error).toBeNull();
    expect(result.current.data?.items).toEqual([item]);
  });

  it('returns the local shared catalog without waiting for external network search', async () => {
    const networkReady = vi.spyOn(protocolClient, 'isOndcNetworkSearchReady').mockResolvedValue(true);
    const atta: UCPItem = {
      id: 'sampoorna-atta',
      name: 'Sampoorna Whole Wheat Atta 1kg',
      category: 'Grocery',
      price: { currency: 'INR', value: '89.00' },
      images: [],
    };
    const localSearch = vi.spyOn(commerceClient, 'searchCommerceItems').mockImplementation(async (query?: string) => {
      if (query) return { items: [], totalCount: 0, __source: 'api' };
      return { items: [atta], totalCount: 1, __source: 'api' };
    });

    const { result } = renderHook(() =>
      useApi<{ items: UCPItem[]; totalCount: number; matchKind?: string }>(
        '/api/search?category=grocery&q=rice',
      ),
    );
    await act(async () => {
      await result.current.execute();
    });

    expect(networkReady).not.toHaveBeenCalled();
    expect(localSearch).toHaveBeenCalledWith('rice');
    expect(localSearch).toHaveBeenCalledWith(undefined);
    expect(result.current.error).toBeNull();
    expect(result.current.data?.matchKind).toBe('similar');
    expect(result.current.data?.items).toEqual([atta]);
  });
});
