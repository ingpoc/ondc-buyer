import { useState, useCallback, useRef } from 'react';
import { buildCommerceUrl, COMMERCE_DEMO_MODE } from '../lib/commerceConfig';
import { rememberBuyerCatalogItems, rememberOndcCatalogItems } from '../lib/buyerCatalogCache';
import { resolveMockBuyerEndpoint } from '../lib/mockSearch';
import { getCommerceItem, searchCommerceItems } from '../lib/commerceClient';
import {
  dispatchBuyerSearch,
  isOndcNetworkSearchReady,
  ondcCollectFromTxn,
  peekRecentSearchTxn,
  type OndcCatalogItem,
} from '../lib/ondc/protocolClient';

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: () => Promise<void>;
}

export function useApi<T>(
  endpoint: string,
  options?: RequestInit
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef(0);

  const execute = useCallback(async () => {
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);

    try {
      if (COMMERCE_DEMO_MODE) {
        try {
          if (endpoint.startsWith('/api/search?')) {
            const [, query = ''] = endpoint.split('?');
            const params = new URLSearchParams(query);
            const demo = await searchCommerceItems(params.get('q') || undefined);
            // Demo-commerce SKUs omit grocery fixtures (e.g. apples); match UI to mock catalog.
            if ((demo.items?.length ?? 0) > 0) {
              if (runId !== runIdRef.current) return;
              setData(demo as T);
              return;
            }
          } else if (endpoint.startsWith('/api/catalog/products/')) {
            const id = endpoint.split('/').pop();
            if (id) {
              if (runId !== runIdRef.current) return;
              setData((await getCommerceItem(id)) as T);
              return;
            }
          }
        } catch {
          // Fall through to local mock data below.
        }
        const mockData = resolveMockBuyerEndpoint(endpoint);
        if (mockData !== null) {
          if (runId !== runIdRef.current) return;
          setData(mockData as T);
          return;
        }
      } else if (endpoint.startsWith('/api/search?')) {
        // No-demo: ONDC network catalogs only (no mock grocery invent).
        const [, query = ''] = endpoint.split('?');
        const params = new URLSearchParams(query);
        const q = params.get('q') || params.get('query') || 'grocery';
        let sharedTxn = (params.get('ondc_txn') || '').trim();
        if (await isOndcNetworkSearchReady()) {
          if (runId !== runIdRef.current) return;
          // Early orb nav lands without ondc_txn; tool refines URL after shared dispatch.
          if (!sharedTxn && typeof window !== 'undefined') {
            for (let i = 0; i < 10; i += 1) {
              await new Promise((r) => setTimeout(r, 200));
              if (runId !== runIdRef.current) return;
              const fromUrl = new URLSearchParams(window.location.search).get('ondc_txn');
              if (fromUrl) {
                sharedTxn = fromUrl.trim();
                break;
              }
              const peeked = peekRecentSearchTxn(q);
              if (peeked) {
                sharedTxn = peeked;
                break;
              }
            }
          }
          if (!sharedTxn) {
            sharedTxn = peekRecentSearchTxn(q) || '';
          }
          const applyItems = (items: OndcCatalogItem[], transactionId: string) => {
            if (runId !== runIdRef.current) return;
            const mapped = rememberOndcCatalogItems(items);
            setData({
              items: mapped,
              totalCount: mapped.length,
              __source: 'ondc-network',
              transaction_id: transactionId,
            } as T);
            setLoading(false);
          };
          // One intent → one txn. Prefer shared tool dispatch; only dispatch here if none.
          if (!sharedTxn) {
            const dispatched = await dispatchBuyerSearch(q, { city: 'std:080' });
            sharedTxn = String(dispatched.transaction_id || '');
          }
          if (!sharedTxn) {
            throw new Error('ONDC search returned no transaction_id');
          }
          const collected = await ondcCollectFromTxn(sharedTxn, {
            // First paint on any offers — prefer-BPP is Seller-proof only, not UX gate.
            attempts: 8,
            pollMs: 1000,
            onPartial: (items) => applyItems(items, sharedTxn),
          });
          if (runId !== runIdRef.current) return;
          applyItems(collected.items, collected.transaction_id);
          return;
        }
        const demo = await searchCommerceItems(q);
        if (runId !== runIdRef.current) return;
        rememberBuyerCatalogItems(demo.items ?? []);
        setData({ ...demo, __source: 'demo-commerce' } as T);
        return;
      }

      const response = await fetch(buildCommerceUrl(endpoint), {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const json = await response.json();
      if (runId !== runIdRef.current) return;
      setData(json);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      if (COMMERCE_DEMO_MODE) {
        const mockData = resolveMockBuyerEndpoint(endpoint);
        if (mockData !== null) {
          setData(mockData as T);
          setError(null);
          return;
        }
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(
        /Failed to fetch/i.test(msg)
          ? 'Gateway waking or network blip — tap Retry in a moment.'
          : msg,
      );
    } finally {
      if (runId === runIdRef.current) {
        setLoading(false);
      }
    }
  }, [endpoint, options]);

  return { data, loading, error, execute };
}

export function useSearch(
  category: string,
  params?: { query?: string; preferences?: unknown; location?: unknown; ondcTxn?: string },
) {
  const queryParams = new URLSearchParams({ category });

  if (params?.query) {
    queryParams.append('q', params.query);
  }
  if (params?.ondcTxn) {
    queryParams.append('ondc_txn', params.ondcTxn);
  }
  if (params?.location) {
    queryParams.append('location', JSON.stringify(params.location));
  }
  if (params?.preferences) {
    queryParams.append('preferences', JSON.stringify(params.preferences));
  }

  return useApi(`/api/search?${queryParams.toString()}`);
}
