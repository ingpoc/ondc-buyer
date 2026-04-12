import type { BecknItem, UCPOrder, UCPSession } from '@/types';
import type { BuyerBrowserState, BuyerCartSessionSnapshot, BuyerClientPatch, BuyerOrderRecord } from '@/types/agent';
import { getLocalSession, saveLocalSession } from './localCart';
import { listDemoOrders, upsertDemoOrder } from './localOrders';
import { listSupportCases, upsertSupportCase } from './localSupportCases';

const BUYER_SESSION_STORAGE_KEY = 'ondc-session-id';

function getBuyerSessionId() {
  let sessionId = localStorage.getItem(BUYER_SESSION_STORAGE_KEY);

  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(BUYER_SESSION_STORAGE_KEY, sessionId);
  }

  return sessionId;
}

function toBuyerOrderRecord(order: UCPOrder): BuyerOrderRecord {
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt ?? order.createdAt,
    provider: {
      id: order.provider?.id ?? 'demo-seller',
      name: order.provider?.name ?? 'Local Demo Seller',
      verified: Boolean(order.provider?.verified),
    },
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: {
        currency: item.price.currency,
        value: item.price.value ?? String(item.price.amount ?? '0.00'),
      },
    })),
    quote: {
      total: {
        currency: order.quote?.total?.currency ?? 'INR',
        value: order.quote?.total?.value ?? String(order.quote?.total?.amount ?? '0.00'),
      },
      breakup: (order.quote?.breakup ?? []).map((entry) => ({
        title: entry.title,
        type: (entry.type as 'item' | 'delivery' | 'tax' | undefined) ?? 'item',
        price: {
          currency: entry.price.currency,
          value: entry.price.value ?? String(entry.price.amount ?? '0.00'),
        },
      })),
    },
    fulfillment: {
      type: 'delivery',
      status: (order.fulfillment?.status as BuyerOrderRecord['fulfillment']['status']) ?? 'pending',
      providerName: order.fulfillment?.providerName ?? 'Local Demo Logistics',
      estimatedTime: {
        start: order.fulfillment?.estimatedTime?.start ?? order.createdAt,
        end: order.fulfillment?.estimatedTime?.end ?? order.createdAt,
      },
      tracking: {
        status: order.fulfillment?.tracking?.status ?? 'pending',
        statusMessage: order.fulfillment?.tracking?.statusMessage ?? 'Awaiting fulfillment update.',
      },
    },
    payment: {
      type: 'upi',
      status: (order.payment?.status as BuyerOrderRecord['payment']['status']) ?? 'NOT-PAID',
      amount: {
        currency: order.payment?.amount?.currency ?? order.quote?.total?.currency ?? 'INR',
        value: order.payment?.amount?.value ?? order.quote?.total?.value ?? '0.00',
      },
    },
    cancellation: order.cancellation
      ? {
          cancelledBy: order.cancellation.cancelledBy,
          reason: order.cancellation.reason,
          cancelledAt: order.cancellation.cancelledAt,
          refund: order.cancellation.refund
            ? {
                amount: order.cancellation.refund.amount,
                status: order.cancellation.refund.status,
              }
            : undefined,
        }
      : undefined,
  };
}

function toUcPSession(snapshot: BuyerCartSessionSnapshot): UCPSession {
  const existing = getLocalSession(snapshot.session_id);
  const items = snapshot.items.map((entry) => {
    const item: BecknItem = {
      id: entry.item_id,
      name: entry.title,
      description: `${entry.title} routed from the buyer agent orchestrator.`,
      descriptor: {
        name: entry.title,
        short_desc: `${entry.provider_name} demo catalog item`,
      },
      price: {
        currency: entry.unit_price.currency,
        value: entry.unit_price.value,
      },
      images: [],
    };

    return {
      id: `line-${entry.item_id}`,
      item,
      quantity: entry.quantity,
      addedAt: new Date().toISOString(),
    };
  });

  return {
    ...existing,
    id: snapshot.session_id,
    updatedAt: new Date().toISOString(),
    items,
    buyer: {
      ...existing.buyer,
      name: snapshot.buyer?.name ?? existing.buyer?.name ?? '',
      email: snapshot.buyer?.email ?? existing.buyer?.email ?? '',
      phone: snapshot.buyer?.phone ?? existing.buyer?.phone ?? '',
      contact: {
        email: snapshot.buyer?.email ?? existing.buyer?.contact?.email ?? existing.buyer?.email,
        phone: snapshot.buyer?.phone ?? existing.buyer?.contact?.phone ?? existing.buyer?.phone,
      },
    },
  };
}

function toUcpOrder(order: BuyerOrderRecord): UCPOrder {
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    provider: {
      id: order.provider.id,
      name: order.provider.name,
      verified: order.provider.verified,
    },
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    quote: {
      total: order.quote.total,
      breakup: order.quote.breakup.map((entry) => ({
        title: entry.title,
        type: entry.type,
        price: entry.price,
      })),
    },
    fulfillment: {
      type: order.fulfillment.type,
      status:
        order.fulfillment.status === 'processing' || order.fulfillment.status === 'packed'
          ? 'in_transit'
          : order.fulfillment.status,
      providerName: order.fulfillment.providerName,
      estimatedTime: order.fulfillment.estimatedTime,
      tracking: order.fulfillment.tracking,
    },
    payment: {
      type: order.payment.type,
      status: order.payment.status,
      amount: order.payment.amount,
    },
    cancellation: order.cancellation
      ? {
          cancelledBy: order.cancellation.cancelledBy,
          reason: order.cancellation.reason,
          cancelledAt: order.cancellation.cancelledAt,
          refund: order.cancellation.refund,
        }
      : undefined,
  };
}

export function buildBuyerBrowserStateSnapshot(activeRoute?: string): BuyerBrowserState {
  const sessionId = getBuyerSessionId();
  const cartSession = getLocalSession(sessionId);

  return {
    cart_session: {
      session_id: cartSession.id,
      items: cartSession.items.map((entry) => ({
        item_id: entry.item.id,
        title: entry.item.descriptor?.name ?? entry.item.name ?? entry.item.id,
        quantity: entry.quantity,
        unit_price: {
          currency: entry.item.price.currency,
          value: entry.item.price.value ?? '0.00',
        },
        provider_name: 'Local Demo Seller',
      })),
      buyer: {
        name: cartSession.buyer?.name,
        email: cartSession.buyer?.contact?.email ?? cartSession.buyer?.email,
        phone: cartSession.buyer?.contact?.phone ?? cartSession.buyer?.phone,
      },
    },
    recent_orders: listDemoOrders().map(toBuyerOrderRecord),
    support_cases: listSupportCases(),
    active_route: activeRoute ?? window.location.pathname,
  };
}

export function applyBuyerClientPatch(patch: BuyerClientPatch) {
  if (patch.patch_type === 'replace_cart') {
    saveLocalSession(toUcPSession(patch.cart_session));
    return;
  }

  if (patch.patch_type === 'upsert_order') {
    upsertDemoOrder(toUcpOrder(patch.order));
    return;
  }

  upsertSupportCase(patch.support_case);
}
