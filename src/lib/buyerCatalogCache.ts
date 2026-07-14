/**
 * In-session Buyer catalog memory so Samantha can add network/demo items
 * that are not in demo-commerce GET-by-id.
 */
import type { UCPItem } from '../types';
import type { OndcCatalogItem } from './ondc/protocolClient';

const byId = new Map<string, UCPItem>();

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
      if (/agentguard|preprod|ondcseller|aadharcha/i.test(name + provider)) score += 2;
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.item ?? null;
}

export function clearBuyerCatalogCache(): void {
  byId.clear();
}
