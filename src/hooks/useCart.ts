import { useState, useCallback, useEffect } from 'react';
import type { UCPSession, UCPSessionItem, BecknItem } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const STORAGE_KEY = 'ondc-session-id';

export interface UseCartResult {
  session: UCPSession | null;
  loading: boolean;
  error: string | null;
  addToCart: (item: BecknItem, quantity?: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  refreshCart: () => Promise<void>;
  clearError: () => void;
  itemCount: number;
  subtotal: number;
}

function getSessionId(): string {
  let sessionId = localStorage.getItem(STORAGE_KEY);

  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(STORAGE_KEY, sessionId);
  }

  return sessionId;
}

function calculateSubtotal(items: UCPSessionItem[]): number {
  return items.reduce((total, item) => {
    const priceValue = typeof item.item.price?.value === 'string'
      ? parseFloat(item.item.price.value)
      : (item.item.price?.value ?? 0);
    return total + (priceValue * item.quantity);
  }, 0);
}

async function cartRequest(
  url: string,
  options: RequestInit = {}
): Promise<{ session: UCPSession }> {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

export function useCart(): UseCartResult {
  const [session, setSession] = useState<UCPSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionId = getSessionId();

  const refreshCart = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await cartRequest(`${API_BASE}/api/cart?sessionId=${sessionId}`);
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = useCallback(async (item: BecknItem, quantity = 1) => {
    setLoading(true);
    setError(null);

    try {
      const data = await cartRequest(`${API_BASE}/api/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, item, quantity }),
      });
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item to cart');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const removeFromCart = useCallback(async (itemId: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await cartRequest(
        `${API_BASE}/api/cart/${itemId}?sessionId=${sessionId}`,
        { method: 'DELETE' }
      );
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item from cart');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    setLoading(true);
    setError(null);

    try {
      const data = await cartRequest(`${API_BASE}/api/cart/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, quantity }),
      });
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update quantity');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const itemCount = session?.items.length ?? 0;
  const subtotal = session ? calculateSubtotal(session.items) : 0;

  return {
    session,
    loading,
    error,
    addToCart,
    removeFromCart,
    updateQuantity,
    refreshCart,
    clearError,
    itemCount,
    subtotal,
  };
}
