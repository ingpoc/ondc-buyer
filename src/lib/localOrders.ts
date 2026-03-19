import type { UCPAddress, UCPOrder, UCPQuote, UCPSession } from '../types';
import { clearLocalSession } from './localCart';

const LOCAL_ORDER_STORAGE_KEY = 'ondc-local-demo-orders';
const DEMO_PROVIDER_NAME = 'Local Demo Seller';
const DEMO_FULFILLMENT_PROVIDER = 'Local Demo Logistics';

function readOrderStore(): UCPOrder[] {
  const raw = localStorage.getItem(LOCAL_ORDER_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as UCPOrder[];
  } catch {
    return [];
  }
}

function writeOrderStore(orders: UCPOrder[]) {
  localStorage.setItem(LOCAL_ORDER_STORAGE_KEY, JSON.stringify(orders));
}

function buildDemoOrderId(): string {
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildBillingAddress(session: UCPSession): UCPAddress {
  const buyer = session.buyer;
  return {
    name: buyer?.name,
    phone: buyer?.phone,
    email: buyer?.contact?.email ?? buyer?.email,
    line1: buyer?.street,
    city: buyer?.city,
    state: buyer?.state,
    postalCode: buyer?.pincode,
    country: buyer?.country ?? 'IND',
  };
}

export function listDemoOrders(): UCPOrder[] {
  return readOrderStore()
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getDemoOrder(orderId: string): UCPOrder | null {
  return readOrderStore().find((order) => order.id === orderId) ?? null;
}

export function upsertDemoOrder(order: UCPOrder): UCPOrder {
  const orders = readOrderStore();
  const index = orders.findIndex((entry) => entry.id === order.id);

  if (index >= 0) {
    orders[index] = order;
  } else {
    orders.unshift(order);
  }

  writeOrderStore(orders);
  return order;
}

export function createDemoOrder(
  sessionId: string,
  session: UCPSession,
  quote: UCPQuote,
  deliveryAddress: UCPAddress
): UCPOrder {
  const now = new Date().toISOString();
  const order: UCPOrder = {
    id: buildDemoOrderId(),
    status: 'created',
    createdAt: now,
    updatedAt: now,
    provider: {
      id: 'demo-seller',
      name: DEMO_PROVIDER_NAME,
      verified: true,
    },
    items: session.items.map((entry) => ({
      id: entry.id,
      name: entry.item.descriptor?.name ?? entry.item.name ?? entry.item.id,
      quantity: entry.quantity,
      price: {
        currency: entry.item.price.currency,
        value: entry.item.price.value ?? '0.00',
      },
    })),
    quote: {
      total: quote.total,
      breakup: quote.breakup,
    },
    billing: buildBillingAddress(session),
    deliveryAddress: {
      ...deliveryAddress,
      country: deliveryAddress.country || 'IND',
    },
    fulfillment: {
      type: 'delivery',
      status: 'pending',
      providerName: DEMO_FULFILLMENT_PROVIDER,
      estimatedTime: {
        start: now,
        end: new Date(Date.now() + (48 * 60 * 60 * 1000)).toISOString(),
      },
      tracking: {
        status: 'pending',
        statusMessage: 'Waiting for the seller to confirm the local demo order.',
      },
    },
    payment: {
      type: 'upi',
      status: 'NOT-PAID',
      amount: {
        currency: quote.total.currency,
        value: quote.total.value ?? '0.00',
      },
    },
  };

  writeOrderStore([order, ...readOrderStore()]);
  clearLocalSession(sessionId);
  return order;
}

export function cancelDemoOrder(orderId: string): UCPOrder | null {
  const orders = readOrderStore();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) {
    return null;
  }

  const updatedOrder: UCPOrder = {
    ...orders[index],
    status: 'cancelled',
    updatedAt: new Date().toISOString(),
    cancellation: {
      cancelledBy: 'buyer',
      reason: 'Buyer requested cancellation',
      cancelledAt: new Date().toISOString(),
      refund: {
        amount: orders[index].payment?.amount ?? {
          currency: orders[index].quote?.total?.currency ?? 'INR',
          value: orders[index].quote?.total?.value ?? '0.00',
        },
        status: 'pending',
      },
    },
    fulfillment: orders[index].fulfillment
      ? {
          ...orders[index].fulfillment,
          status: 'cancelled',
          tracking: {
            ...orders[index].fulfillment?.tracking,
            status: 'cancelled',
            statusMessage: 'The buyer cancelled this local demo order.',
          },
        }
      : undefined,
    payment: orders[index].payment
      ? {
          ...orders[index].payment,
          status: 'failed',
        }
      : undefined,
  };

  orders[index] = updatedOrder;
  writeOrderStore(orders);
  return updatedOrder;
}
