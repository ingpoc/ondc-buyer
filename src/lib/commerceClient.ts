import type { UCPItem, UCPOrder, UCPSession } from '../types';
import { clearLocalSession } from './localCart';
import { TRUST_API_URL } from './identityUrls';
import { isLocalBrowserHost } from './loopback';

export interface DemoCommerceItem {
  item_id: string;
  version: number;
  status: string;
  seller_id: string;
  title: string;
  description: string;
  price_inr: number;
  created_at: string;
  updated_at: string;
}

export interface DemoCommerceOrder {
  order_id: string;
  transaction_id: string;
  message_id: string;
  buyer_id: string;
  seller_id: string;
  item_id: string;
  item_version: number;
  quantity: number;
  amount_inr: number;
  status: string;
  payment?: {
    status?: string;
    amount_inr?: number;
    reference_id?: string;
  };
  created_at: string;
  updated_at: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  detail?: string;
  message?: string;
}

async function demoFetch<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const base = isLocalBrowserHost() ? TRUST_API_URL : '';
  const response = await fetch(`${base}${endpoint}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as Partial<ApiEnvelope<T>>;
  if (!response.ok || body.success === false) {
    throw new Error(body.detail || body.message || `Commerce request failed (${response.status})`);
  }
  return body.data as T;
}

function makeIdempotencyKey(scope: string, id: string) {
  return `${scope}:${id}:${Date.now()}`;
}

export function mapDemoItemToBuyerItem(item: DemoCommerceItem): UCPItem {
  return {
    id: item.item_id,
    name: item.title,
    description: item.description,
    descriptor: {
      name: item.title,
      short_desc: item.description,
    },
    price: {
      currency: 'INR',
      value: item.price_inr.toFixed(2),
    },
    images: [],
    category: 'Grocery',
    _provider: item.seller_id || 'ONDC seller',
    provider: {
      id: item.seller_id || 'ondc-seller',
      name: item.seller_id || 'ONDC seller',
    },
  };
}

export function mapDemoOrderToBuyerOrder(order: DemoCommerceOrder): UCPOrder {
  const total = order.amount_inr;
  const status = order.status === 'accepted'
    ? 'accepted'
    : order.status === 'fulfilled' || order.status === 'closed'
      ? 'delivered'
      : order.status === 'rejected' || order.status === 'cancelled'
        ? 'cancelled'
        : 'created';
  return {
    id: order.order_id,
    status,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    provider: {
      id: order.seller_id,
      name: order.seller_id,
      verified: true,
    },
    items: [
      {
        id: order.item_id,
        name: order.item_id,
        quantity: order.quantity,
        price: { currency: 'INR', value: total.toFixed(2) },
      },
    ],
    quote: {
      total: { currency: 'INR', value: total.toFixed(2) },
      breakup: [],
    },
    fulfillment: {
      type: 'delivery',
      status: status === 'delivered' ? 'delivered' : status === 'cancelled' ? 'cancelled' : 'pending',
      providerName: 'Simulated ONDC logistics',
      tracking: {
        status,
        statusMessage: `Commerce transaction ${order.transaction_id}`,
      },
    },
    payment: {
      type: 'upi',
      status: order.payment?.status === 'succeeded' || order.status === 'paid' ? 'PAID' : 'NOT-PAID',
      amount: { currency: 'INR', value: total.toFixed(2) },
      transactionId: order.transaction_id,
    },
  };
}

export async function searchCommerceItems(query?: string) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const data = await demoFetch<{ items: DemoCommerceItem[]; count: number }>(`/api/demo-commerce/buyer/search${suffix}`);
  const items = data.items.map(mapDemoItemToBuyerItem);
  return {
    items,
    totalCount: items.length,
    __source: 'api',
  } as const;
}

export async function getCommerceItem(itemId: string) {
  const data = await demoFetch<{ item: DemoCommerceItem; inventory: number }>(`/api/demo-commerce/buyer/items/${itemId}`);
  return mapDemoItemToBuyerItem(data.item);
}

export async function createCommerceOrder(input: {
  sessionId: string;
  session: UCPSession;
  buyerId?: string | null;
}) {
  const firstLine = input.session.items[0];
  if (!firstLine) {
    throw new Error('Cart is empty.');
  }
  const idempotencyKey = makeIdempotencyKey('buyer-order', input.sessionId);
  const data = await demoFetch<{ order: DemoCommerceOrder; transaction_id: string }>(
    '/api/demo-commerce/buyer/orders',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        item_id: firstLine.item.id,
        quantity: firstLine.quantity,
        buyer_id: input.buyerId || 'demo-buyer',
        payment_mode: 'success',
      }),
    },
  );
  clearLocalSession(input.sessionId);
  return mapDemoOrderToBuyerOrder(data.order);
}
