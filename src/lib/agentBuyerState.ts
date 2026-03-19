import type { BecknItem, UCPItem, UCPOrder, UCPSession } from '../types';
import type {
  BuyerAgentAction,
  BuyerAgentPatchResult,
  BuyerAgentResponseEnvelope,
  BuyerAgentSnapshot,
} from '../types/agent';
import type { PortfolioTrustState } from './trust';

function safeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function formatAmount(currency: string | undefined, value: string | undefined) {
  const normalizedCurrency = currency || 'INR';
  const amount = Number.parseFloat(value ?? '0');
  return `${normalizedCurrency} ${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
}

function normalizeEnvelope(payload: unknown): BuyerAgentResponseEnvelope | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.summary !== 'string' || !Array.isArray(candidate.actions)) {
    return null;
  }

  const actions = candidate.actions
    .map((entry) => normalizeBuyerAction(entry))
    .filter((entry): entry is BuyerAgentAction => entry !== null);

  return {
    summary: candidate.summary,
    actions,
  };
}

function normalizeRecommendItemAction(candidate: Record<string, unknown>) {
  const itemId = safeString(candidate.item_id ?? candidate.target_item_id);
  if (!itemId) {
    return null;
  }

  return {
    type: 'recommend_item' as const,
    item_id: itemId,
    reason: safeString(candidate.reason ?? candidate.detail, 'Recommended based on current buyer request.'),
  };
}

function normalizeCartAddAction(candidate: Record<string, unknown>) {
  const itemId = safeString(candidate.item_id ?? candidate.target_item_id);
  if (!itemId) {
    return null;
  }

  return {
    type: 'cart_add' as const,
    item_id: itemId,
    quantity: Math.max(1, safeNumber(candidate.quantity, 1)),
    reason: safeString(candidate.reason ?? candidate.detail, 'Added to cart for checkout readiness.'),
  };
}

function normalizeNavigateAction(candidate: Record<string, unknown>) {
  const path = safeString(candidate.path);
  if (!path) {
    return null;
  }

  return {
    type: 'navigate' as const,
    path,
    reason: safeString(candidate.reason ?? candidate.detail, 'Move to the next buyer step.'),
  };
}

function normalizeTrustRequiredAction(candidate: Record<string, unknown>) {
  return {
    type: 'trust_required' as const,
    operation: safeString(candidate.operation ?? candidate.blocker ?? candidate.reason, 'buyer_checkout'),
    reason: safeString(
      candidate.reason ?? candidate.detail ?? candidate.impact,
      'Trust verification is required before checkout can continue.',
    ),
    suggested_path: safeString(candidate.suggested_path),
  };
}

function normalizeUnsupportedAction(candidate: Record<string, unknown>) {
  return {
    type: 'unsupported' as const,
    reason: safeString(candidate.reason ?? candidate.detail, 'The buyer agent could not apply this request safely.'),
  };
}

function normalizeBuyerAction(entry: unknown): BuyerAgentAction | null {
  const candidate = safeRecord(entry);
  if (!candidate) {
    return null;
  }

  const type = safeString(candidate.type);
  if (type === 'recommend_item') return normalizeRecommendItemAction(candidate);
  if (type === 'cart_add') return normalizeCartAddAction(candidate);
  if (type === 'navigate') return normalizeNavigateAction(candidate);
  if (type === 'trust_required') return normalizeTrustRequiredAction(candidate);
  if (type === 'unsupported') return normalizeUnsupportedAction(candidate);
  return null;
}

export function extractBuyerAgentEnvelope(rawContent: string): BuyerAgentResponseEnvelope | null {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    return null;
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return normalizeEnvelope(JSON.parse(candidate.slice(start, end + 1)));
  } catch {
    return null;
  }
}

function buildCatalogIndex(items: BuyerAgentSnapshot['catalog']['items']) {
  return new Map(items.map((item) => [item.id, item]));
}

function buildOrderSummary(orders: UCPOrder[]) {
  return {
    total: orders.length,
    recent: orders.slice(0, 5).map((order) => ({
      id: order.id,
      status: order.status,
      total: formatAmount(order.quote?.total?.currency, order.quote?.total?.value),
      provider_name: order.provider?.name ?? 'Unknown seller',
      created_at: order.createdAt,
    })),
  };
}

export function buildBuyerAgentSnapshot(
  location: { path: string; search: string },
  trustState: PortfolioTrustState,
  cartSession: UCPSession | null,
  catalogItems: UCPItem[],
  orders: UCPOrder[],
): BuyerAgentSnapshot {
  const subtotalValue = cartSession?.items?.reduce((total, entry) => {
    const amount = Number.parseFloat(entry.item.price?.value ?? '0');
    return total + (Number.isFinite(amount) ? amount : 0) * entry.quantity;
  }, 0) ?? 0;

  return {
    route: {
      path: location.path,
      search: location.search,
    },
    trust: {
      state: trustState,
      write_enabled: trustState === 'verified',
    },
    catalog: {
      total_items: catalogItems.length,
      items: catalogItems.map((item) => ({
        id: item.id,
        name: item.descriptor?.name ?? item.name ?? item.id,
        description: item.descriptor?.short_desc ?? item.description ?? '',
        category: String((item as { category?: unknown }).category ?? ''),
        price: formatAmount(item.price?.currency, item.price?.value),
        provider: String((item as { _provider?: unknown })._provider ?? 'Unknown seller'),
      })),
    },
    cart: {
      session_id: cartSession?.id ?? '',
      item_count: cartSession?.items.length ?? 0,
      subtotal: formatAmount(cartSession?.items[0]?.item.price?.currency ?? 'INR', String(subtotalValue)),
      items: (cartSession?.items ?? []).map((entry) => ({
        item_id: entry.item.id,
        name: entry.item.descriptor?.name ?? entry.item.name ?? entry.item.id,
        quantity: entry.quantity,
        price: formatAmount(entry.item.price?.currency, entry.item.price?.value),
      })),
      buyer_profile_ready: Boolean(cartSession?.buyer?.name && (cartSession?.buyer?.contact?.email ?? cartSession?.buyer?.email)),
    },
    orders: buildOrderSummary(orders),
  };
}

export function applyBuyerAgentEnvelope(
  envelope: BuyerAgentResponseEnvelope,
  snapshot: BuyerAgentSnapshot,
  trustState: PortfolioTrustState,
): BuyerAgentPatchResult {
  const catalogIndex = buildCatalogIndex(snapshot.catalog.items);
  const itemsToAdd: Array<{ item: BecknItem; quantity: number }> = [];
  let navigateTo: string | null = null;
  let trustBlockReason: string | null = null;

  for (const action of envelope.actions) {
    if (action.type === 'cart_add') {
      const match = catalogIndex.get(action.item_id);
      if (!match) {
        continue;
      }
      itemsToAdd.push({
        item: {
          id: match.id,
          name: match.name,
          description: match.description,
          descriptor: {
            name: match.name,
            short_desc: match.description,
          },
          price: {
            currency: match.price.split(' ')[0] || 'INR',
            value: match.price.split(' ')[1] || '0.00',
          },
          category: match.category
            ? {
                descriptor: {
                  name: match.category,
                },
              }
            : undefined,
          category_id: match.category || undefined,
          _provider: match.provider,
          images: [],
        } as BecknItem,
        quantity: action.quantity,
      });
    }

    if (action.type === 'navigate') {
      if (action.path === '/checkout' && trustState !== 'verified') {
        trustBlockReason = 'Buyer checkout requires a verified AadhaarChain trust state before the agent can route into high-trust execution.';
        continue;
      }
      navigateTo = action.path;
    }

    if (action.type === 'trust_required') {
      trustBlockReason = action.reason;
      if (!navigateTo && action.suggested_path) {
        navigateTo = action.suggested_path;
      }
    }
  }

  return {
    summary: envelope.summary,
    actions: envelope.actions,
    itemsToAdd,
    navigateTo,
    trustBlockReason,
  };
}
