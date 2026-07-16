import { useState, useCallback, useEffect } from 'react';
import { buildCommerceUrl, COMMERCE_API_BASE, COMMERCE_DEMO_MODE } from '../lib/commerceConfig';
import type { UCPSession, UCPSessionItem, BecknItem } from '../types';
import {
  addLocalItem,
  clearLocalSession,
  getLocalSession,
  LOCAL_CART_CHANGED_EVENT,
  removeLocalItem,
  updateLocalQuantity,
} from '../lib/localCart';
import { formatCartApiError, shouldFallbackLocalOnCartError, shouldUseLocalCartFallback } from '../lib/cartFailurePolicy';

const USE_LOCAL_CART = shouldUseLocalCartFallback(COMMERCE_DEMO_MODE, COMMERCE_API_BASE);

const STORAGE_KEY = 'ondc-session-id';

export interface UseCartResult {
  session: UCPSession | null;
  loading: boolean;
  error: string | null;
  addToCart: (item: BecknItem, quantity?: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
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
      if (USE_LOCAL_CART) {
        setSession(getLocalSession(sessionId));
        return;
      }
      const data = await cartRequest(buildCommerceUrl(`/api/cart?sessionId=${sessionId}`));
      setSession(data.session);
    } catch (err) {
      if (
        shouldUseLocalCartFallback(COMMERCE_DEMO_MODE, COMMERCE_API_BASE) ||
        shouldFallbackLocalOnCartError(err)
      ) {
        setSession(getLocalSession(sessionId));
        setError(null);
      } else {
        setError(formatCartApiError(err, 'Refresh cart'));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  useEffect(() => {
    const syncLocalCart = (event: Event) => {
      const changedSessionId = (event as CustomEvent<{ sessionId?: string }>).detail?.sessionId;
      if (changedSessionId === sessionId) {
        setSession(getLocalSession(sessionId));
      }
    };
    window.addEventListener(LOCAL_CART_CHANGED_EVENT, syncLocalCart);
    return () => window.removeEventListener(LOCAL_CART_CHANGED_EVENT, syncLocalCart);
  }, [sessionId]);

  const addToCart = useCallback(async (item: BecknItem, quantity = 1) => {
    setLoading(true);
    setError(null);

    try {
      if (USE_LOCAL_CART) {
        setSession(addLocalItem(sessionId, item, quantity));
        return;
      }
      const data = await cartRequest(buildCommerceUrl('/api/cart'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, item, quantity }),
      });
      setSession(data.session);
    } catch (err) {
      if (
        shouldUseLocalCartFallback(COMMERCE_DEMO_MODE, COMMERCE_API_BASE) ||
        shouldFallbackLocalOnCartError(err)
      ) {
        setSession(addLocalItem(sessionId, item, quantity));
        setError(null);
      } else {
        setError(formatCartApiError(err, 'Add item to cart'));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const removeFromCart = useCallback(async (itemId: string) => {
    setLoading(true);
    setError(null);

    try {
      if (USE_LOCAL_CART) {
        setSession(removeLocalItem(sessionId, itemId));
        return;
      }
      const data = await cartRequest(
        buildCommerceUrl(`/api/cart/${itemId}?sessionId=${sessionId}`),
        { method: 'DELETE' }
      );
      setSession(data.session);
    } catch (err) {
      if (
        shouldUseLocalCartFallback(COMMERCE_DEMO_MODE, COMMERCE_API_BASE) ||
        shouldFallbackLocalOnCartError(err)
      ) {
        setSession(removeLocalItem(sessionId, itemId));
        setError(null);
      } else {
        setError(formatCartApiError(err, 'Remove item from cart'));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    setLoading(true);
    setError(null);

    try {
      if (USE_LOCAL_CART) {
        setSession(updateLocalQuantity(sessionId, itemId, quantity));
        return;
      }
      const data = await cartRequest(buildCommerceUrl(`/api/cart/${itemId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, quantity }),
      });
      setSession(data.session);
    } catch (err) {
      if (
        shouldUseLocalCartFallback(COMMERCE_DEMO_MODE, COMMERCE_API_BASE) ||
        shouldFallbackLocalOnCartError(err)
      ) {
        setSession(updateLocalQuantity(sessionId, itemId, quantity));
        setError(null);
      } else {
        setError(formatCartApiError(err, 'Update cart quantity'));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const clearCart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (USE_LOCAL_CART) {
        setSession(clearLocalSession(sessionId));
        return;
      }
      const current = session ?? (await cartRequest(buildCommerceUrl(`/api/cart?sessionId=${sessionId}`))).session;
      await Promise.all(
        current.items.map((entry) =>
          cartRequest(buildCommerceUrl(`/api/cart/${entry.item.id}?sessionId=${sessionId}`), {
            method: 'DELETE',
          })
        )
      );
      const refreshed = await cartRequest(buildCommerceUrl(`/api/cart?sessionId=${sessionId}`));
      setSession(refreshed.session);
    } catch (err) {
      if (
        shouldUseLocalCartFallback(COMMERCE_DEMO_MODE, COMMERCE_API_BASE) ||
        shouldFallbackLocalOnCartError(err)
      ) {
        setSession(clearLocalSession(sessionId));
        setError(null);
      } else {
        setError(formatCartApiError(err, 'Clear cart'));
        throw err;
      }
    } finally {
      setLoading(false);
    }
  }, [session, sessionId]);

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
    clearCart,
    refreshCart,
    clearError,
    itemCount,
    subtotal,
  };
}
