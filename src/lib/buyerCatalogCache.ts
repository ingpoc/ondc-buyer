/**
 * In-session Buyer catalog memory so Samantha can add network/demo items
 * that are not in demo-commerce GET-by-id.
 */
import type { UCPItem } from '../types';
import type { OndcCatalogItem } from './ondc/protocolClient';

const byId = new Map<string, UCPItem>();
const CACHE_CHANGED_EVENT = 'buyer-catalog-cache-changed';

const BROWSE_QUERIES = new Set(['all', 'food', 'foods', 'groceries', 'grocery', 'products']);
const SEARCH_STOP = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'pack',
  'packet',
  'kg',
  'gms',
  'gram',
  'grams',
  'litre',
  'liter',
  'ml',
]);

/** Tokenize for strict relevance — keep short product tokens like "tv". */
export function searchQueryTokens(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => !SEARCH_STOP.has(token) && token.length >= 2) ?? [];
}

function haystackForItem(item: UCPItem): string {
  return [
    item.name,
    item.descriptor?.name,
    item.description,
    item.descriptor?.short_desc,
    item.category,
    item._provider,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function titleForItem(item: UCPItem): string {
  return [item.name, item.descriptor?.name].filter(Boolean).join(' ').toLowerCase();
}

function itemMatchesSearchTokens(item: UCPItem, query: string, tokens: string[]): boolean {
  const title = titleForItem(item);
  const haystack = haystackForItem(item);
  const normalized = query.trim().toLowerCase();
  // Title-first: "rice" must not hit Poha via "flattened rice" in description.
  if (normalized && title.includes(normalized)) return true;
  if (!tokens.length) return false;
  if (tokens.every((token) => title.includes(token))) return true;
  if (tokens.length >= 2 && tokens.every((token) => haystack.includes(token))) return true;
  return false;
}

function itemsMatchingQuery(query: string): UCPItem[] {
  const items = listBuyerCatalogItems();
  const normalized = query.trim().toLowerCase();
  if (!normalized || BROWSE_QUERIES.has(normalized)) return items;
  const tokens = searchQueryTokens(query);
  return items.filter((item) => itemMatchesSearchTokens(item, query, tokens));
}

export function filterBuyerItemsForQuery(items: UCPItem[], query: string): UCPItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized || BROWSE_QUERIES.has(normalized)) return items;

  const tokens = searchQueryTokens(query);
  if (!tokens.length) return [];

  return items.filter((item) => itemMatchesSearchTokens(item, query, tokens));
}

/** Buyer SearchBar lanes → accepted item.category / demo category_id values. */
const CATEGORY_ALIASES: Record<string, readonly string[]> = {
  grocery: ['grocery', 'foodgrains', 'food', 'f&b', 'staples'],
  electronics: ['electronics', 'appliance', 'appliances', 'consumer electronics'],
  fashion: ['fashion', 'apparel', 'clothing'],
  restaurant: ['restaurant', 'f&b', 'food service'],
};

/**
 * Enforce the selected results category. Grocery must not surface a TV that was
 * mis-tagged or left on the default Grocery category_id.
 */
const ELECTRONICS_TITLE = /\b(tv|television|laptop|phone|mobile|headphone|earbud|camera)\b/i;
const FASHION_TITLE = /\b(shirt|saree|jeans|kurta|dress|apparel)\b/i;

export function filterBuyerItemsForCategory(items: UCPItem[], category: string): UCPItem[] {
  const wanted = category.trim().toLowerCase();
  // Category lanes are exclusive — do not treat "grocery" as a browse-all query.
  if (!wanted || wanted === 'all') return items;
  const aliases = CATEGORY_ALIASES[wanted] ?? [wanted];
  return items.filter((item) => {
    const title = titleForItem(item);
    // Defense for mis-tagged Seller SKUs (TV published under Grocery).
    if (wanted === 'grocery' && (ELECTRONICS_TITLE.test(title) || FASHION_TITLE.test(title))) {
      return false;
    }
    if (wanted === 'electronics' && ELECTRONICS_TITLE.test(title)) return true;
    if (wanted === 'fashion' && FASHION_TITLE.test(title)) return true;
    const itemCat = String(item.category || '').trim().toLowerCase();
    // Legacy fixtures with no category stay grocery-only.
    if (!itemCat) return wanted === 'grocery';
    return aliases.some((alias) => itemCat === alias || itemCat.includes(alias));
  });
}

export function filterBuyerSearchResults(
  items: UCPItem[],
  query: string,
  category: string,
): UCPItem[] {
  return filterBuyerItemsForCategory(filterBuyerItemsForQuery(items, query), category);
}

export function mapOndcCatalogItemToBuyerItem(item: OndcCatalogItem): UCPItem {
  const name = String(item.name || item.id || 'ONDC item');
  const id = String(item.id || `${item.bpp_id || 'bpp'}-${name}`);
  const priceValue = String(item.price_inr ?? '0');
  return {
    id,
    name,
    description: typeof item.description === 'string' ? item.description : undefined,
    price: { currency: 'INR', value: priceValue },
    images: [],
    descriptor: {
      name,
      short_desc: String(item.provider_name || item.bpp_id || ''),
    },
    _provider: item.provider_name || item.bpp_id,
    provider: item.provider_name
      ? { id: String(item.bpp_id || item.provider_name), name: item.provider_name }
      : undefined,
    deliveryEstimate:
      typeof item.delivery_estimate === 'string' ? item.delivery_estimate : undefined,
    returnPolicy: typeof item.return_policy === 'string' ? item.return_policy : undefined,
    deliveryAreas: Array.isArray(item.delivery_areas)
      ? item.delivery_areas.map(String).filter(Boolean)
      : undefined,
  };
}

export function rememberBuyerCatalogItems(items: UCPItem[]): void {
  for (const item of items) {
    const id = String(item.id || '').trim();
    if (!id) continue;
    byId.set(id, item);
  }
  try {
    if (typeof window !== 'undefined') {
      (window as Window & { __buyerCatalogCacheIds?: string[] }).__buyerCatalogCacheIds =
        Array.from(byId.keys()).slice(-24);
      window.dispatchEvent(new CustomEvent(CACHE_CHANGED_EVENT));
    }
  } catch {
    /* ignore */
  }
}

export function rememberOndcCatalogItems(items: OndcCatalogItem[]): UCPItem[] {
  const mapped = items.map(mapOndcCatalogItemToBuyerItem);
  rememberBuyerCatalogItems(mapped);
  return mapped;
}

export function lookupBuyerCatalogItem(itemId: string): UCPItem | null {
  const id = itemId.trim();
  if (!id) return null;
  return byId.get(id) ?? null;
}

/** Newest-first snapshot of in-session results cache (for add-by-name). */
export function listBuyerCatalogItems(): UCPItem[] {
  return Array.from(byId.values()).reverse();
}

/**
 * Resolve a product name / fragment against results the user already saw.
 * Prefer exact (case-insensitive) name, then substring; prefer AgentGuard / our BPP markers.
 */
export function lookupBuyerCatalogByQuery(query: string): UCPItem | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const items = listBuyerCatalogItems();
  if (!items.length) return null;

  const exact = items.find((item) => {
    const name = String(item.name || item.descriptor?.name || '').toLowerCase();
    return name === q || item.id.toLowerCase() === q;
  });
  if (exact) return exact;

  const scored = items
    .map((item) => {
      const name = String(item.name || item.descriptor?.name || '').toLowerCase();
      const provider = String(item._provider || item.descriptor?.short_desc || '').toLowerCase();
      let score = 0;
      if (name.includes(q) || q.includes(name)) score += 10;
      for (const token of q.split(/\s+/).filter((t) => t.length > 2)) {
        if (name.includes(token)) score += 3;
      }
      if (/agentguard|ondcseller|aadharcha/i.test(name + provider)) score += 2;
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.item ?? null;
}

export function clearBuyerCatalogCache(): void {
  byId.clear();
}

/** Wait briefly for ResultsPage to paint/cache offers after an ACK-first search. */
export function waitForBuyerCatalogItems(query: string, timeoutMs = 4000): Promise<UCPItem[]> {
  const current = itemsMatchingQuery(query);
  if (current.length || typeof window === 'undefined') return Promise.resolve(current);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (items: UCPItem[]) => {
      if (settled) return;
      settled = true;
      window.removeEventListener(CACHE_CHANGED_EVENT, onChanged);
      window.clearTimeout(timer);
      resolve(items);
    };
    const onChanged = () => {
      const items = itemsMatchingQuery(query);
      if (items.length) finish(items);
    };
    const timer = window.setTimeout(() => finish(itemsMatchingQuery(query)), timeoutMs);
    window.addEventListener(CACHE_CHANGED_EVENT, onChanged);
  });
}
