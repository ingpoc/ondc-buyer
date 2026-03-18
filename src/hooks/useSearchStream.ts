/**
 * useSearchStream Hook (SDK-BUYER-SEARCH-001)
 * Hook for Server-Sent Events streaming search results with progressive disclosure
 */

import { useState, useCallback, useRef } from 'react';
import { buildCommerceUrl, COMMERCE_DEMO_MODE } from '../lib/commerceConfig';
import { resolveMockBuyerEndpoint } from '../lib/mockSearch';
import type { BecknItem } from '../types';

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

const STREAM_TIMEOUT = 3000;

/**
 * Hook for SSE-based progressive disclosure search
 * Streams results as they arrive with immediate status feedback
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

    const url = buildCommerceUrl(`/api/search/stream?${queryParams.toString()}`);
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    timeoutRef.current = setTimeout(() => {
      if (stateRef.current.isStreaming) {
        stopStream();
      }
    }, STREAM_TIMEOUT);

    eventSource.onmessage = (event) => {
      try {
        const streamEvent = JSON.parse(event.data) as StreamEvent;

        switch (streamEvent.type) {
          case 'status':
            setState({ status: 'streaming', error: null });
            break;

          case 'results': {
            const resultsData = streamEvent.data as ResultsEventData;
            setState({
              items: resultsData.items,
              hasMore: resultsData.hasMore,
              status: 'streaming',
            });
            break;
          }

          case 'error': {
            const errorData = streamEvent.data as ErrorEventData;
            setState({
              status: 'error',
              error: errorData.error,
              isStreaming: false,
            });
            stopStream();
            break;
          }

          case 'complete':
            setState({ status: 'complete', isStreaming: false });
            stopStream();
            break;
        }
      } catch (err) {
        setState({
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to parse stream event',
          isStreaming: false,
        });
        stopStream();
      }
    };

    eventSource.onerror = () => {
      setState({
        status: 'error',
        error: 'Stream connection error',
        isStreaming: false,
      });
      stopStream();
    };
  }, [stopStream]);

  return {
    ...stateRef.current,
    startStream,
    stopStream,
    reset,
  };
}
