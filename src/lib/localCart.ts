import type { BecknItem, UCPAddress, UCPQuote, UCPSession } from '../types';

const LOCAL_CART_STORAGE_KEY = 'ondc-local-cart-session';
export const LOCAL_CART_CHANGED_EVENT = 'ondc-local-cart-changed';
const LOCAL_CART_ACTIVE_KEY = 'ondc-local-cart-active';

/** True when this browser session is using the local cart because remote cart no-op'd or rejected. */
export function isLocalCartOverrideActive(): boolean {
  return localStorage.getItem(LOCAL_CART_ACTIVE_KEY) === '1';
}

export function setLocalCartOverrideActive(active: boolean): void {
  if (active) localStorage.setItem(LOCAL_CART_ACTIVE_KEY, '1');
  else localStorage.removeItem(LOCAL_CART_ACTIVE_KEY);
}

interface StoredSessionMap {
  [sessionId: string]: UCPSession;
}

function buildEmptySession(sessionId: string): UCPSession {
  const now = new Date().toISOString();
  return {
    id: sessionId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    items: [],
    buyer: {
      name: '',
      email: '',
      phone: '',
      contact: {},
      country: 'IND',
    },
  };
}

function readStore(): StoredSessionMap {
  const raw = localStorage.getItem(LOCAL_CART_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as StoredSessionMap;
  } catch {
    return {};
  }
}

function writeStore(store: StoredSessionMap) {
  localStorage.setItem(LOCAL_CART_STORAGE_KEY, JSON.stringify(store));
}

export function getLocalSession(sessionId: string): UCPSession {
  const store = readStore();
  const existing = store[sessionId];

  if (existing) {
    return existing;
  }

  const session = buildEmptySession(sessionId);
  store[sessionId] = session;
  writeStore(store);
  return session;
}

export function saveLocalSession(session: UCPSession): UCPSession {
  const store = readStore();
  store[session.id] = {
    ...session,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(LOCAL_CART_CHANGED_EVENT, { detail: { sessionId: session.id } })
    );
  }
  return store[session.id];
}

export function updateLocalBuyer(
  sessionId: string,
  buyer: {
    name: string;
    email: string;
    phone: string;
    taxId?: string;
  }
): UCPSession {
  const session = getLocalSession(sessionId);
  return saveLocalSession({
    ...session,
    buyer: {
      ...session.buyer,
      name: buyer.name,
      email: buyer.email,
      phone: buyer.phone,
      taxId: buyer.taxId?.trim() || undefined,
      contact: {
        email: buyer.email,
        phone: buyer.phone,
      },
    },
  });
}

export function updateLocalDeliveryAddress(sessionId: string, address: UCPAddress): UCPSession {
  const session = getLocalSession(sessionId);
  return saveLocalSession({
    ...session,
    buyer: {
      ...session.buyer,
      name: session.buyer?.name ?? '',
      email: session.buyer?.email ?? '',
      phone: session.buyer?.phone ?? '',
      street: address.line1 || address.street || '',
      city: address.city || '',
      state: address.state || '',
      country: address.country || 'IND',
      pincode: address.postalCode || address.pincode || '',
    },
  });
}

export function addLocalItem(sessionId: string, item: BecknItem, quantity: number): UCPSession {
  const session = getLocalSession(sessionId);
  const existing = session.items.find((entry) => entry.item.id === item.id);

  if (existing) {
    existing.quantity += quantity;
  } else {
    session.items.push({
      id: `line-${item.id}`,
      item,
      quantity,
      addedAt: new Date().toISOString(),
    });
  }

  return saveLocalSession({
    ...session,
    status: 'active',
  });
}

export function removeLocalItem(sessionId: string, itemId: string): UCPSession {
  const session = getLocalSession(sessionId);
  return saveLocalSession({
    ...session,
    items: session.items.filter((entry) => entry.item.id !== itemId),
  });
}

export function updateLocalQuantity(sessionId: string, itemId: string, quantity: number): UCPSession {
  const session = getLocalSession(sessionId);
  return saveLocalSession({
    ...session,
    status: 'active',
    items: session.items
      .map((entry) => (
        entry.item.id === itemId
          ? { ...entry, quantity }
          : entry
      ))
      .filter((entry) => entry.quantity > 0),
  });
}

const DELIVERY_COST_WITH_ADDRESS = 49;
const DELIVERY_COST_WITHOUT_ADDRESS = 79;
const LOCAL_TAX_RATE = 0.05;

export function createLocalQuote(session: UCPSession, deliveryAddress: UCPAddress): UCPQuote {
  const hasAddress = Boolean(
    deliveryAddress.line1 && deliveryAddress.city && deliveryAddress.state && deliveryAddress.postalCode
  );
  const subtotalValue = session.items.reduce((total, entry) => {
    const next = Number(entry.item.price?.value ?? 0);
    return total + (next * entry.quantity);
  }, 0);
  const deliveryValue = subtotalValue > 0
    ? (hasAddress ? DELIVERY_COST_WITH_ADDRESS : DELIVERY_COST_WITHOUT_ADDRESS)
    : 0;
  const taxValue = Number((subtotalValue * LOCAL_TAX_RATE).toFixed(2));
  const totalValue = subtotalValue + deliveryValue + taxValue;

  return {
    price: {
      currency: 'INR',
      value: totalValue.toFixed(2),
    },
    total: {
      currency: 'INR',
      value: totalValue.toFixed(2),
    },
    subtotal: {
      currency: 'INR',
      value: subtotalValue.toFixed(2),
    },
    deliveryCost: {
      currency: 'INR',
      value: deliveryValue.toFixed(2),
    },
    tax: {
      currency: 'INR',
      value: taxValue.toFixed(2),
    },
    breakup: [
      {
        title: 'Items',
        type: 'item',
        price: {
          currency: 'INR',
          value: subtotalValue.toFixed(2),
        },
      },
      {
        title: 'Delivery',
        type: 'delivery',
        price: {
          currency: 'INR',
          value: deliveryValue.toFixed(2),
        },
      },
      {
        title: 'Tax',
        type: 'tax',
        price: {
          currency: 'INR',
          value: taxValue.toFixed(2),
        },
      },
    ],
    ttl: 'PT15M',
  };
}

export function clearLocalSession(sessionId: string): UCPSession {
  const session = getLocalSession(sessionId);
  return saveLocalSession({
    ...session,
    status: 'active',
    items: [],
  });
}
