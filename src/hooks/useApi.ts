import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

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

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
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
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [endpoint, options]);

  return { data, loading, error, execute };
}

export function useSearch(category: string, params?: { query?: string; preferences?: unknown; location?: unknown }) {
  const queryParams = new URLSearchParams({ category });

  if (params?.query) {
    queryParams.append('q', params.query);
  }
  if (params?.location) {
    queryParams.append('location', JSON.stringify(params.location));
  }
  if (params?.preferences) {
    queryParams.append('preferences', JSON.stringify(params.preferences));
  }

  return useApi(`/api/search?${queryParams.toString()}`);
}
