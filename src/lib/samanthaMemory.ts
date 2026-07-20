/**
 * Compact Samantha preference memory (per authenticated principal).
 * Updated from purchases and Realtime conversation tool calls.
 */

export type SamanthaMemory = {
  likes: string[];
  dislikes: string[];
  preferences: string[];
  notes: string[];
  updatedAt: string;
};

export interface RelevantSearchPreferences {
  maxPrice?: number;
  minRating?: number;
  deliveryArea?: string;
  preferenceTerms: string[];
  appliedLabels: string[];
}

const MAX_ITEMS = 8;

function storageKey(principalId: string | null | undefined): string {
  const id = encodeURIComponent((principalId || '').slice(0, 160));
  return `samantha-memory:${id}`;
}

export function emptySamanthaMemory(): SamanthaMemory {
  return {
    likes: [],
    dislikes: [],
    preferences: [],
    notes: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadSamanthaMemory(walletAddress?: string | null): SamanthaMemory {
  if (!walletAddress?.trim()) return emptySamanthaMemory();
  try {
    const raw = localStorage.getItem(storageKey(walletAddress));
    if (!raw) return emptySamanthaMemory();
    const parsed = JSON.parse(raw) as Partial<SamanthaMemory>;
    return {
      likes: Array.isArray(parsed.likes) ? parsed.likes.slice(0, MAX_ITEMS) : [],
      dislikes: Array.isArray(parsed.dislikes) ? parsed.dislikes.slice(0, MAX_ITEMS) : [],
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences.slice(0, MAX_ITEMS) : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, MAX_ITEMS) : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return emptySamanthaMemory();
  }
}

/** Compatibility name retained; cross-principal merging is forbidden. */
export function loadSamanthaMemoryMerged(principalId?: string | null): SamanthaMemory {
  return loadSamanthaMemory(principalId);
}

export function saveSamanthaMemory(
  walletAddress: string | null | undefined,
  memory: SamanthaMemory,
): SamanthaMemory {
  const next: SamanthaMemory = {
    likes: memory.likes.slice(0, MAX_ITEMS),
    dislikes: memory.dislikes.slice(0, MAX_ITEMS),
    preferences: memory.preferences.slice(0, MAX_ITEMS),
    notes: memory.notes.slice(0, MAX_ITEMS),
    updatedAt: new Date().toISOString(),
  };
  if (walletAddress?.trim()) {
    localStorage.setItem(storageKey(walletAddress), JSON.stringify(next));
  }
  return next;
}

function pushUnique(list: string[], value: string): string[] {
  const v = value.trim();
  if (!v) return list;
  const lower = v.toLowerCase();
  const without = list.filter((x) => x.toLowerCase() !== lower);
  return [v, ...without].slice(0, MAX_ITEMS);
}

export function rememberSamanthaFact(
  walletAddress: string | null | undefined,
  kind: 'like' | 'dislike' | 'preference' | 'note',
  value: string,
): SamanthaMemory {
  const mem = loadSamanthaMemory(walletAddress);
  if (kind === 'like') mem.likes = pushUnique(mem.likes, value);
  if (kind === 'dislike') mem.dislikes = pushUnique(mem.dislikes, value);
  if (kind === 'preference') mem.preferences = pushUnique(mem.preferences, value);
  if (kind === 'note') mem.notes = pushUnique(mem.notes, value);
  return saveSamanthaMemory(walletAddress, mem);
}

export function recordPurchasePreference(
  walletAddress: string | null | undefined,
  itemTitle: string,
): SamanthaMemory {
  return rememberSamanthaFact(walletAddress, 'preference', `Bought: ${itemTitle}`);
}

export function formatMemoryForPrompt(memory: SamanthaMemory): string {
  const lines: string[] = [];
  if (memory.likes.length) lines.push(`Likes: ${memory.likes.join('; ')}`);
  if (memory.dislikes.length) lines.push(`Dislikes: ${memory.dislikes.join('; ')}`);
  if (memory.preferences.length) lines.push(`Preferences: ${memory.preferences.join('; ')}`);
  if (memory.notes.length) lines.push(`Notes: ${memory.notes.join('; ')}`);
  if (!lines.length) return 'No stored preferences yet.';
  return lines.join('\n');
}

export function memoryIsEmpty(memory: SamanthaMemory): boolean {
  return (
    memory.likes.length === 0 &&
    memory.dislikes.length === 0 &&
    memory.preferences.length === 0 &&
    memory.notes.length === 0
  );
}

const SEARCH_PREFERENCE_TERMS = [
  'organic',
  'unpolished',
  'whole wheat',
  'gluten free',
  'gluten-free',
  'sugar free',
  'sugar-free',
  'low sugar',
  'low sodium',
  'vegan',
  'local',
  'fresh',
] as const;

function productTokens(query: string): string[] {
  const stop = new Set(['find', 'search', 'show', 'buy', 'some', 'please', 'under', 'below']);
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stop.has(token));
}

export function relevantSearchPreferences(
  memory: SamanthaMemory,
  query: string,
): RelevantSearchPreferences {
  const tokens = productTokens(query);
  const facts = [...memory.likes, ...memory.preferences].map((fact) => fact.trim()).filter(Boolean);
  const result: RelevantSearchPreferences = { preferenceTerms: [], appliedLabels: [] };

  for (const fact of facts) {
    const lower = fact.toLowerCase();
    const globalFilter = /(?:under|below|up to|max(?:imum)?|rating|deliver(?:y)?\s+(?:to|in))/.test(lower);
    const productRelevant = tokens.some((token) => lower.includes(token));
    const hasPreferenceTerm = SEARCH_PREFERENCE_TERMS.some((term) => lower.includes(term));
    const categoryRelevant =
      hasPreferenceTerm && /\b(?:grocer(?:y|ies)|food|products?|items?)\b/.test(lower);
    const preferenceRelevant = productRelevant || categoryRelevant;
    if (!globalFilter && !preferenceRelevant) continue;

    const priceMatch = lower.match(
      /(?:under|below|up to|max(?:imum)?(?:\s+price)?)\s*(?:inr|rs\.?|₹)?\s*(\d+(?:\.\d+)?)/,
    );
    if (priceMatch) {
      const value = Number(priceMatch[1]);
      if (Number.isFinite(value) && value >= 0) {
        result.maxPrice = result.maxPrice === undefined ? value : Math.min(result.maxPrice, value);
      }
    }

    const ratingMatch = lower.match(
      /(?:rating(?:\s+of)?\s*)?(\d(?:\.\d)?)\s*(?:\+|or\s+(?:better|higher)|and\s+above)?\s*(?:star|rating)/,
    );
    if (ratingMatch) {
      const value = Number(ratingMatch[1]);
      if (value >= 0 && value <= 5) {
        result.minRating = result.minRating === undefined ? value : Math.max(result.minRating, value);
      }
    }

    const deliveryMatch = fact.match(/deliver(?:y)?\s+(?:to|in)\s+(.+?)(?:\s+for\s+|[.;]|$)/i);
    if (deliveryMatch?.[1]?.trim()) result.deliveryArea = deliveryMatch[1].trim();

    if (preferenceRelevant) {
      for (const term of SEARCH_PREFERENCE_TERMS) {
        if (lower.includes(term) && !result.preferenceTerms.includes(term)) {
          result.preferenceTerms.push(term);
        }
      }
    }
  }

  if (result.maxPrice !== undefined) result.appliedLabels.push(`Under INR ${result.maxPrice}`);
  if (result.minRating !== undefined) result.appliedLabels.push(`${result.minRating}+ rating`);
  if (result.deliveryArea) result.appliedLabels.push(`Deliver to ${result.deliveryArea}`);
  result.appliedLabels.push(...result.preferenceTerms.map((term) => `Prefer ${term}`));
  return result;
}
