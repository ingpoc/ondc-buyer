import { buildCommerceUrl } from './commerceConfig';
import type { UCPOrder } from '../types';

export function normalizeOrderListResponse(payload: unknown): UCPOrder[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const candidate = payload as {
    orders?: unknown;
    data?: unknown;
  };

  if (Array.isArray(candidate.orders)) {
    return candidate.orders as UCPOrder[];
  }

  if (Array.isArray(candidate.data)) {
    return candidate.data as UCPOrder[];
  }

  if (candidate.data && typeof candidate.data === 'object') {
    const nested = candidate.data as { orders?: unknown };
    if (Array.isArray(nested.orders)) {
      return nested.orders as UCPOrder[];
    }
  }

  return [];
}

export function normalizeOrderResponse(payload: unknown): UCPOrder | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as {
    order?: unknown;
    data?: unknown;
  };

  if (candidate.order && typeof candidate.order === 'object') {
    return candidate.order as UCPOrder;
  }

  if (candidate.data && typeof candidate.data === 'object') {
    const nested = candidate.data as { order?: unknown; id?: unknown };
    if (nested.order && typeof nested.order === 'object') {
      return nested.order as UCPOrder;
    }
    if (typeof nested.id === 'string') {
      return nested as UCPOrder;
    }
  }

  return null;
}

async function parseErrorResponse(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => null);
  const error = payload && typeof payload === 'object' ? (payload as { error?: unknown }).error : null;
  return new Error(typeof error === 'string' ? error : fallback);
}

export async function fetchBuyerOrders(sessionId: string): Promise<UCPOrder[]> {
  const response = await fetch(buildCommerceUrl(`/api/orders?sessionId=${encodeURIComponent(sessionId)}`), {
    credentials: 'include',
  });

  if (!response.ok) {
    throw await parseErrorResponse(response, `Load orders failed: ${response.status}`);
  }

  return normalizeOrderListResponse(await response.json());
}

export async function fetchBuyerOrder(orderId: string): Promise<UCPOrder | null> {
  const response = await fetch(buildCommerceUrl(`/api/orders/${encodeURIComponent(orderId)}`), {
    credentials: 'include',
  });

  const raw = await response.text();
  if (raw.trimStart().startsWith('<')) {
    throw new Error('Order API returned HTML (no commerce order host on this deploy)');
  }

  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error('Order API returned non-JSON');
  }

  if (!response.ok) {
    const error =
      payload && typeof payload === 'object' ? (payload as { error?: unknown }).error : null;
    throw new Error(typeof error === 'string' ? error : `Load order failed: ${response.status}`);
  }

  return normalizeOrderResponse(payload);
}
