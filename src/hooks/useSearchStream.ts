/**
 * useSearchStream Hook (SDK-BUYER-SEARCH-001)
 * Hook for Server-Sent Events streaming search results with progressive disclosure
 */

import { useState, useCallback, useRef } from 'react';
import { COMMERCE_DEMO_MODE } from '../lib/commerceConfig';
import { searchCommerceItems } from '../lib/commerceClient';
import { resolveMockBuyerEndpoint } from '../lib/mockSearch';
import {
  isOndcNetworkSearchReady,
  ondcSearchAndCollect,
  OUR_BPP_ID,
  type OndcCatalogItem,
} from '../lib/ondc/protocolClient';
import type { BecknItem } from '../types';

function mapOndcCatalogToBeckn(items: OndcCatalogItem[]): BecknItem[] {
  return items.map((item) => {
    const name = String(item.name || item.id || 'ONDC item');
    const priceValue = String(item.price_inr ?? '0');
    return {
      id: String(item.id || `${item.bpp_id || 'bpp'}-${name}`),
      name,
      description: typeof item.description === 'string' ? item.description : undefined,
      price: { currency: 'INR', value: priceValue },
      images: [],
      descriptor: { name, short_desc: String(item.provider_name || item.bpp_id || '') },
      category_id: 'grocery',
    };
  });
}

/** Stream event types */
export type StreamEventType =
  | 'status'
  | 'results'
  | 'error'
  | 'complete';

/** Base stream event */
export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: string;
}

/** Status event data */
export interface StatusEventData {
  status: 'searching' | 'receiving' | 'complete' | 'error';
  message: string;
}

/** Results event data */
export interface ResultsEventData {
  items: BecknItem[];
  count: number;
  hasMore: boolean;
}

/** Error event data */
export interface ErrorEventData {
  error: string;
  code?: string;
}

/** Hook state */
export interface SearchStreamState {
  status: 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';
  items: BecknItem[];
  error: string | null;
  hasMore: boolean;
  isStreaming: boolean;
}

/** Hook result */
export interface SearchStreamResult extends SearchStreamState {
  startStream: (params: SearchStreamParams) => void;
  stopStream: () => void;
  reset: () => void;
}

/** Search stream parameters */
export interface SearchStreamParams {
  query?: string;
  category: string;
  location?: string;
  preferences?: string;
}

/**
 * Search results hook — demo mock when VITE_COMMERCE_DEMO_MODE=true;
 * otherwise ONDC network (or published demo-commerce), never mock bananas.
 */
export function useSearchStream(): SearchStreamResult {
  const stateRef = useRef<SearchStreamState>({
    status: 'idle',
    items: [],
    error: null,
    hasMore: false,
    isStreaming: false,
  });

  const [, forceUpdate] = useState({});
  const eventSourceRef = useRef<EventSource | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setState = (update: Partial<SearchStreamState>) => {
    stateRef.current = { ...stateRef.current, ...update };
    forceUpdate({});
  };

  const stopStream = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (stateRef.current.status === 'streaming') {
      setState({ isStreaming: false, status: 'complete' });
    }
  }, []);

  const reset = useCallback(() => {
    stopStream();
    stateRef.current = {
      status: 'idle',
      items: [],
      error: null,
      hasMore: false,
      isStreaming: false,
    };
    forceUpdate({});
  }, [stopStream]);

  const startStream = useCallback((params: SearchStreamParams) => {
    stopStream();

    setState({
      status: 'connecting',
      items: [],
      error: null,
      hasMore: false,
      isStreaming: true,
    });

    const queryParams = new URLSearchParams();
    if (params.query) queryParams.set('query', params.query);
    if (params.category) queryParams.set('category', params.category);
    if (params.location) queryParams.set('location', params.location);
    if (params.preferences) queryParams.set('preferences', params.preferences);

    if (COMMERCE_DEMO_MODE) {
      const mockResult = resolveMockBuyerEndpoint(`/api/search?${queryParams.toString()}`) as ResultsEventData | null;
      setState({
        status: 'complete',
        items: mockResult?.items ?? [],
        hasMore: false,
        error: null,
        isStreaming: false,
      });
      return;
    }

    // No-demo path: ONDC network catalogs first; published demo-commerce only as empty-network fallback.
    // Never invent mock grocery (bananas) when VITE_COMMERCE_DEMO_MODE=false.
    void (async () => {
      try {
        setState({ status: 'streaming', error: null, isStreaming: true });
        if (await isOndcNetworkSearchReady()) {
          const collected = await ondcSearchAndCollect(
            params.query?.trim() || params.category || 'grocery',
            { city: 'std:080', pollMs: 2000, attempts: 10, preferBppId: OUR_BPP_ID },
          );
          setState({
            status: 'complete',
            items: mapOndcCatalogToBeckn(collected.items),
            hasMore: false,
            error: null,
            isStreaming: false,
          });
          return;
        }
        const demo = await searchCommerceItems(params.query || undefined);
        setState({
          status: 'complete',
          items: (demo.items ?? []) as BecknItem[],
          hasMore: false,
          error: null,
          isStreaming: false,
        });
      } catch (err) {
        setState({
          status: 'error',
          items: [],
          error: err instanceof Error ? err.message : 'ONDC search failed',
          hasMore: false,
          isStreaming: false,
        });
      }
    })();
  }, [stopStream]);

  return {
    ...stateRef.current,
    startStream,
    stopStream,
    reset,
  };
}
