import { TRUST_API_URL } from './identityUrls';
import type { UCPSessionItem } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  detail?: string;
  message?: string;
}

interface DurableCart {
  cart_id: string;
  seller_id: string;
  version: number;
}

export interface DurableQuote {
  quote_id: string;
  cart_id: string;
  cart_version: number;
  subtotal_paise: number;
  landed_total_paise: number;
  expires_at: string;
}

async function commerceRequest<T>(
  path: string,
  init: RequestInit,
  idempotencyKey: string,
  correlationId: string,
): Promise<T> {
  const response = await fetch(`${TRUST_API_URL}/api/commerce/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      'X-Correlation-ID': correlationId,
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
  if (!response.ok || body.success === false || !body.data) {
    throw new Error(body.detail || body.message || `Checkout preparation failed (${response.status})`);
  }
  return body.data;
}

function sellerId(item: UCPSessionItem): string {
  const enriched = item.item as typeof item.item & {
    provider?: { id?: string };
    _provider?: string;
  };
  return String(enriched.provider?.id || enriched._provider || '').trim();
}

export async function prepareDurableCheckout(params: {
  items: UCPSessionItem[];
  attemptId: string;
}): Promise<{ cart: DurableCart; quote: DurableQuote; correlationId: string }> {
  if (params.items.length === 0) throw new Error('Cart is empty.');
  const sellers = new Set(params.items.map(sellerId).filter(Boolean));
  if (sellers.size !== 1) {
    throw new Error('Checkout currently supports items from one seller at a time.');
  }
  const seller = [...sellers][0];
  const correlationId = `buyer-checkout:${params.attemptId}`;
  const created = await commerceRequest<{ cart: DurableCart }>(
    '/carts',
    { method: 'POST', body: JSON.stringify({ seller_id: seller }) },
    `${params.attemptId}:cart`,
    correlationId,
  );
  let cart = created.cart;
  for (const [index, entry] of params.items.entries()) {
    const updated = await commerceRequest<{ cart: DurableCart }>(
      `/carts/${encodeURIComponent(cart.cart_id)}/lines/${encodeURIComponent(entry.item.id)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ quantity: entry.quantity, expected_version: cart.version }),
      },
      `${params.attemptId}:line:${index}`,
      correlationId,
    );
    cart = updated.cart;
  }
  const preview = await commerceRequest<{ quote: DurableQuote }>(
    `/carts/${encodeURIComponent(cart.cart_id)}/checkout-preview`,
    {
      method: 'POST',
      body: JSON.stringify({ expected_version: cart.version }),
    },
    `${params.attemptId}:preview`,
    correlationId,
  );
  return { cart, quote: preview.quote, correlationId };
}
