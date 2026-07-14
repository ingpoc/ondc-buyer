import type { UCPAddress, UCPOrder, UCPQuote, UCPSession } from '../types';
import type { PortfolioTrustState } from './trust';
import { assertCanExecuteProtectedBuyerAction } from './buyerActionPolicy';
import { clearLocalSession, createLocalQuote, getLocalSession } from './localCart';
import { principalStorageKey } from './principalStorage';

const LOCAL_ORDER_STORAGE_KEY = 'ondc-local-demo-orders';
const PORTFOLIO_ORDER_BRIDGE_KEY = 'ondc-portfolio-demo-orders';
const DEMO_PROVIDER_NAME = 'Local catalog seller';
const DEMO_FULFILLMENT_PROVIDER = 'Local logistics';
type BuyerPaymentMethod = NonNullable<UCPOrder['payment']>['type'];

function readOrderStore(subjectId: string | null | undefined): UCPOrder[] {
  const key = principalStorageKey(LOCAL_ORDER_STORAGE_KEY, subjectId);
  if (!key) return [];
  const raw = localStorage.getItem(key);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as UCPOrder[];
  } catch {
    return [];
  }
}

function writeOrderStore(subjectId: string, orders: UCPOrder[]) {
  const key = principalStorageKey(LOCAL_ORDER_STORAGE_KEY, subjectId);
  if (!key) throw new Error('Sign in before saving buyer orders.');
  localStorage.setItem(key, JSON.stringify(orders));
}

function publishToSellerBridge(order: UCPOrder) {
  // Same-origin portfolio demos share one browser profile; bridge buyer checkout into seller queue.
  try {
    const raw = localStorage.getItem(PORTFOLIO_ORDER_BRIDGE_KEY);
    const existing = raw ? (JSON.parse(raw) as UCPOrder[]) : [];
    const next = [order, ...existing.filter((entry) => entry.id !== order.id)];
    localStorage.setItem(PORTFOLIO_ORDER_BRIDGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore bridge failures in non-browser contexts.
  }
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

export function listDemoOrders(subjectId: string | null | undefined): UCPOrder[] {
  return readOrderStore(subjectId)
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getDemoOrder(orderId: string, subjectId: string | null | undefined): UCPOrder | null {
  return readOrderStore(subjectId).find((order) => order.id === orderId) ?? null;
}

export function upsertDemoOrder(order: UCPOrder, subjectId: string): UCPOrder {
  const orders = readOrderStore(subjectId);
  const index = orders.findIndex((entry) => entry.id === order.id);

  if (index >= 0) {
    orders[index] = order;
  } else {
    orders.unshift(order);
  }

  writeOrderStore(subjectId, orders);
  return order;
}

export function createDemoOrder(
  sessionId: string,
  session: UCPSession,
  quote: UCPQuote,
  deliveryAddress: UCPAddress,
  subjectId: string,
  paymentMethod: BuyerPaymentMethod = 'upi',
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
        statusMessage: 'Waiting for the seller to confirm the local order.',
      },
    },
    payment: {
      type: paymentMethod,
      status: 'NOT-PAID',
      amount: {
        currency: quote.total.currency,
        value: quote.total.value ?? '0.00',
      },
    },
  };

  writeOrderStore(subjectId, [order, ...readOrderStore(subjectId)]);
  publishToSellerBridge(order);
  clearLocalSession(sessionId);
  return order;
}

export function createVerifiedDemoOrder(
  sessionId: string,
  session: UCPSession,
  quote: UCPQuote,
  deliveryAddress: UCPAddress,
  trustState: PortfolioTrustState,
  subjectId: string,
  paymentMethod?: BuyerPaymentMethod,
): UCPOrder {
  assertCanExecuteProtectedBuyerAction(trustState);
  return createDemoOrder(sessionId, session, quote, deliveryAddress, subjectId, paymentMethod);
}

/**
 * After AgentGuard allow + receipt: persist a paid local order and clear the cart
 * so checkout UI can leave the unpaid form and show an ordered/paid surface.
 */
export function createPaidOrderFromAgentGuard(params: {
  sessionId: string;
  amountInr: number;
  receiptId: string;
  subjectId: string;
}): UCPOrder | null {
  const session = getLocalSession(params.sessionId);
  if (!session.items?.length) {
    return null;
  }
  const deliveryAddress: UCPAddress = {
    line1: 'Local delivery',
    city: 'Bangalore',
    state: 'KA',
    postalCode: '560001',
    country: 'IND',
  };
  const quote = createLocalQuote(session, deliveryAddress);
  const amount = Math.max(0, Math.round(params.amountInr));
  quote.total = { currency: 'INR', value: amount.toFixed(2) };
  quote.price = { currency: 'INR', value: amount.toFixed(2) };
  const order = createDemoOrder(
    params.sessionId,
    session,
    quote,
    deliveryAddress,
    params.subjectId,
    'upi',
  );
  const paid: UCPOrder = {
    ...order,
    status: 'accepted',
    payment: {
      type: 'upi',
      status: 'PAID',
      amount: { currency: 'INR', value: amount.toFixed(2) },
      transactionId: params.receiptId,
      completedAt: new Date().toISOString(),
    },
  };
  return upsertDemoOrder(paid, params.subjectId);
}

export function cancelDemoOrder(orderId: string, subjectId: string): UCPOrder | null {
  const orders = readOrderStore(subjectId);
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
            statusMessage: 'The buyer cancelled this local order.',
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
  writeOrderStore(subjectId, orders);
  return updatedOrder;
}

export function cancelVerifiedDemoOrder(
  orderId: string,
  trustState: PortfolioTrustState,
  subjectId: string,
): UCPOrder | null {
  assertCanExecuteProtectedBuyerAction(trustState);
  return cancelDemoOrder(orderId, subjectId);
}
