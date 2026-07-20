/**
 * Host-agnostic Buyer tool runner. Cursor / Realtime hosts call these tools;
 * protected writes go through AgentGuard execute.
 *
 * Split: Samantha Realtime = short chainable tools (navigate/search/cart/one checkout/memory).
 * Long / multi-step plans → delegate_to_runtime_agent (background; Samantha notifies when done).
 */
import { buildAgentControlPlaneUrl } from './agentControlPlane';
import {
  listBuyerCatalogItems,
  lookupBuyerCatalogByQuery,
  lookupBuyerCatalogItem,
  rememberBuyerCatalogItems,
  waitForBuyerCatalogItems,
} from './buyerCatalogCache';
import { getCommerceItem, orderFromCommerceExecution, searchCommerceItems } from './commerceClient';
import { executeBuyerCheckout } from './agentGuardCheckout';
import { writeCheckoutOutcome } from './checkoutOutcome';
import { buildCommerceUrl, COMMERCE_API_BASE, COMMERCE_DEMO_MODE } from './commerceConfig';
import { shouldUseLocalCartFallback } from './cartFailurePolicy';
import { dispatchCheckoutPrefill } from './checkoutPrefill';
import {
  clearLocalSession,
  getLocalSession,
  updateLocalBuyer,
  updateLocalDeliveryAddress,
} from './localCart';
import {
  dispatchBuyerSearch,
  isOndcNetworkSearchReady,
} from './ondc/protocolClient';
import {
  loadSamanthaMemory,
  relevantSearchPreferences,
  rememberSamanthaFact,
} from './samanthaMemory';
import { startBuyerRuntimeBackground } from './samanthaRuntimeHandoff';
import type { UCPAddress, UCPItem } from '../types';

/** Product nouns preferred over trailing purpose/time words in NL asks. */
const CATALOG_PRODUCT_NOUNS = [
  'atta',
  'flour',
  'milk',
  'banana',
  'bananas',
  'apple',
  'apples',
  'rice',
  'dal',
  'oil',
  'ghee',
  'sugar',
  'salt',
  'bread',
  'eggs',
  'tea',
  'coffee',
  'wheat',
  'poha',
  'tv',
  'television',
] as const;

/** NL agent asks → short keyword for demo-commerce / results URL (not the full sentence). */
export function catalogSearchQuery(raw: string): string {
  const stop = new Set([
    'find',
    'search',
    'show',
    'get',
    'add',
    'one',
    'to',
    'my',
    'the',
    'a',
    'an',
    'and',
    'or',
    'for',
    'under',
    'below',
    'rupees',
    'rupee',
    'inr',
    'rs',
    'cart',
    'please',
    'want',
    'need',
    'buy',
    'some',
    'price',
    'priced',
    'cost',
    // Purpose / time fillers that must not become the search keyword
    'tonight',
    'today',
    'tomorrow',
    'evening',
    'morning',
    'afternoon',
    'breakfast',
    'lunch',
    'dinner',
    'recipe',
    'options',
    'option',
    'looking',
    'actually',
    'again',
    'can',
    'you',
    'me',
    'that',
    'this',
    'what',
    'was',
    'were',
    'showed',
    'somebody',
    'someone',
    'something',
    'anything',
  ]);
  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !stop.has(t) && !/^\d+$/.test(t));
  const last = tokens.at(-1);
  const previous = tokens.at(-2);
  // Compound grocery nouns before bare noun preference.
  if (last === 'dal' && previous && ['toor', 'chana', 'moong', 'urad', 'masoor'].includes(previous)) {
    return `${previous} ${last}`;
  }
  if (last === 'rice' && previous && ['basmati', 'white', 'brown', 'sona', 'masoori'].includes(previous)) {
    return `${previous} ${last}`;
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    if (
      tokens[i + 1] === 'dal' &&
      ['toor', 'chana', 'moong', 'urad', 'masoor'].includes(tokens[i])
    ) {
      return `${tokens[i]} dal`;
    }
    if (
      tokens[i + 1] === 'rice' &&
      ['basmati', 'white', 'brown', 'sona', 'masoori'].includes(tokens[i])
    ) {
      return `${tokens[i]} rice`;
    }
  }
  // Prefer a known product noun when present ("atta for roti tonight" → atta;
  // "find a TV" → tv — short tokens must survive the length filter).
  for (const noun of CATALOG_PRODUCT_NOUNS) {
    if (tokens.includes(noun) || raw.toLowerCase().split(/\W+/).includes(noun)) {
      if (noun === 'television') return 'tv';
      return (noun === 'bananas' ? 'banana' : noun === 'apples' ? 'apple' : noun).slice(0, 48);
    }
  }
  // Product asks commonly lead with a brand/qualifier ("AgentGuard
  // Atta", "organic toned milk"). The final meaningful token is the stable
  // catalog noun and avoids dispatching the brand alone.
  return (last || raw.trim() || 'grocery').slice(0, 48);
}

/**
 * Keep the customer's current product request authoritative when the model
 * supplies only a saved qualifier (for example, `unpolished`) as its tool
 * query. Memory-only turns do not override a later explicit tool query.
 */
export function resolveCustomerSearchQuery(toolQuery: string, latestUserText?: string | null): string {
  const tool = toolQuery.trim();
  const customer = String(latestUserText ?? '').trim();
  const hasCurrentSearchIntent =
    /\b(?:find|search|show|buy|get|need|want|looking\s+for)\b/i.test(customer);
  return hasCurrentSearchIntent ? customer : tool || customer;
}

/** Preferences safe to recover locally when Realtime text transport is unavailable. */
export function localSearchPreferenceFacts(raw: string): string[] {
  const lower = raw.toLowerCase();
  const facts: string[] = [];
  for (const term of ['organic', 'unpolished', 'whole wheat', 'gluten free', 'sugar free']) {
    if (lower.includes(term)) facts.push(`Prefer ${term} groceries`);
  }
  const explicitArea = raw.match(/deliver(?:y)?\s+(?:to|in)\s+([a-z][a-z -]{1,30})/i)?.[1];
  const areaBeforeDelivery = raw.match(/\b([A-Z][a-z-]{1,30})\s+delivery\b/)?.[1];
  const area = (explicitArea || areaBeforeDelivery || '').trim();
  if (area) facts.push(`Deliver to ${area}`);
  return facts;
}

/** Map a product ask onto the Buyer SearchBar category lane. */
export function inferBuyerSearchCategory(rawQuery: string): string {
  const blob = `${catalogSearchQuery(rawQuery)} ${rawQuery}`.toLowerCase();
  if (/\b(tv|television|laptop|phone|mobile|headphone|earbud|earbuds|camera)\b/.test(blob)) {
    return 'electronics';
  }
  if (/\b(shirt|saree|jeans|kurta|dress|fashion|apparel)\b/.test(blob)) {
    return 'fashion';
  }
  if (/\b(restaurant|biryani|pizza|burger|meal|thali)\b/.test(blob)) {
    return 'restaurant';
  }
  return 'grocery';
}

export function buildPersonalizedBuyerSearchPath(
  rawQuery: string,
  principalId?: string | null,
): { path: string; appliedLabels: string[] } {
  const query = catalogSearchQuery(rawQuery);
  const category = inferBuyerSearchCategory(rawQuery);
  const relevant = relevantSearchPreferences(loadSamanthaMemory(principalId), rawQuery);
  const params = new URLSearchParams({ category, q: query });
  if (relevant.maxPrice !== undefined) params.set('max_price', String(relevant.maxPrice));
  if (relevant.minRating !== undefined) params.set('min_rating', String(relevant.minRating));
  if (relevant.deliveryArea) params.set('delivery_area', relevant.deliveryArea);
  if (relevant.preferenceTerms.length) {
    params.set('preference', relevant.preferenceTerms.join(','));
  }
  return { path: `/results?${params.toString()}`, appliedLabels: relevant.appliedLabels };
}

function compactCachedForQuery(query: string): Array<{
  id: string;
  name: string;
  price_inr: string | number | undefined;
  provider: string | undefined;
}> {
  const q = catalogSearchQuery(query).toLowerCase();
  const matched = q
    ? listBuyerCatalogItems().filter((item) => {
        const name = String(item.name || item.descriptor?.name || '').toLowerCase();
        return name.includes(q) || q.split(/\s+/).some((t) => t.length > 2 && name.includes(t));
      })
    : listBuyerCatalogItems();
  const pick = matched.length ? matched : listBuyerCatalogItems();
  return pick.slice(0, 8).map((item) => ({
    id: item.id,
    name: item.name || item.descriptor?.name || item.id,
    price_inr: item.price?.value,
    provider: item._provider,
  }));
}

export type BuyerToolName =
  | 'search_catalog'
  | 'navigate_to'
  | 'add_to_cart'
  | 'clear_cart'
  | 'remove_from_cart'
  | 'set_cart_quantity'
  | 'fill_checkout'
  | 'checkout_commit'
  | 'remember_preference'
  | 'delegate_to_runtime_agent';

export type BuyerToolResult = {
  ok: boolean;
  tool: BuyerToolName;
  message: string;
  data?: Record<string, unknown>;
  navigateTo?: string;
  cartAdds?: Array<{ itemId: string; quantity: number; item: UCPItem }>;
  cartChanges?: Array<{
    action: 'clear' | 'remove' | 'set_quantity';
    itemId?: string;
    quantity?: number;
  }>;
  decision?: string;
  receiptId?: string;
};

/** Known Buyer app routes Samantha may open (tool-arg coerce only). */
export const BUYER_NAV_ALLOWLIST = [
  '/search',
  '/results',
  '/cart',
  '/checkout',
  '/orders',
  '/config',
] as const;

/** Coerce model tool args (e.g. path="cart") into an app route — not user-utterance parsing. */
export function coerceBuyerNavPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const [pathPart, query = ''] = trimmed.split('?');
  let base = (pathPart.startsWith('/') ? pathPart : `/${pathPart}`).split('#')[0];
  if (base.length > 1) base = base.replace(/\/+$/, '');
  const withQuery = query ? `${base}?${query}` : base;
  if (base === '/results' || base.startsWith('/product/') || base.startsWith('/orders/')) {
    return withQuery.startsWith('/') ? withQuery : `/${withQuery}`;
  }
  if ((BUYER_NAV_ALLOWLIST as readonly string[]).includes(base)) {
    return withQuery;
  }

  const label = trimmed.toLowerCase().replace(/^the\s+/, '').replace(/\s+page$/, '').split('?')[0];
  const soft: Record<string, string> = {
    cart: '/cart',
    checkout: '/checkout',
    search: '/search',
    home: '/search',
    results: '/results',
    orders: '/orders',
    order: '/orders',
    config: '/config',
    settings: '/config',
    preferences: '/config',
    agentguard: '/config?tab=agent-guard',
    'agent guard': '/config?tab=agent-guard',
    samantha: '/config?tab=samantha',
    activity: '/config?tab=activity',
    profile: '/config?tab=profile',
  };
  return soft[label] ?? null;
}

/** Resolve cart line from last Samantha/results search cache, then demo-commerce. */
export async function resolveBuyerCartItem(itemId: string): Promise<UCPItem | null> {
  const id = itemId.trim();
  if (!id) return null;
  const cachedExact = lookupBuyerCatalogItem(id);
  if (cachedExact) return cachedExact;
  // Model often passes a display name ("atta", "Robusta Bananas") after early search
  // returns empty ids — resolve against ResultsPage cache, never invent SKUs.
  if (/\s/.test(id) || id.length > 80 || !/^[\w.:@/-]+$/.test(id)) {
    return lookupBuyerCatalogByQuery(id);
  }
  const byName = lookupBuyerCatalogByQuery(id);
  if (byName) return byName;
  try {
    return await getCommerceItem(id);
  } catch {
    return null;
  }
}

/** Resolve add_to_cart args: exact id, query/name, or newest cached result. */
export async function resolveBuyerAddTarget(args: {
  item_id?: unknown;
  itemId?: unknown;
  query?: unknown;
  name?: unknown;
  product?: unknown;
}): Promise<UCPItem | null> {
  const itemId = String(args.item_id ?? args.itemId ?? '').trim();
  const query = String(args.query ?? args.name ?? args.product ?? '').trim();
  if (itemId) {
    const resolved = await resolveBuyerCartItem(itemId);
    if (resolved) return resolved;
    // Explicit id/name that missed — do not silently pick an unrelated cache row.
    if (!query) return null;
  }
  if (query) {
    const byQuery = lookupBuyerCatalogByQuery(query);
    if (byQuery) return byQuery;
    const [settled] = await waitForBuyerCatalogItems(catalogSearchQuery(query), 8_000);
    return settled ?? null;
  }
  // Bare add_to_cart after a settled results page — use newest cached offer.
  const recent = listBuyerCatalogItems();
  return recent[0] ?? null;
}

const READ_TOOLS: BuyerToolName[] = [
  'search_catalog',
  'navigate_to',
  'add_to_cart',
  'clear_cart',
  'remove_from_cart',
  'set_cart_quantity',
  'fill_checkout',
  'remember_preference',
  'delegate_to_runtime_agent',
];

/** Filter tools offered to the model by confirmed mandate allowed_actions. */
export function buyerToolsForMandate(allowedActions: string[] | null | undefined): BuyerToolName[] {
  const tools: BuyerToolName[] = [...READ_TOOLS];
  if (!allowedActions || allowedActions.includes('buyer.checkout.commit')) {
    tools.push('checkout_commit');
  }
  return tools;
}

const BUYER_SESSION_STORAGE_KEY = `portfolio-agent-session-id:${buildAgentControlPlaneUrl('/api/agent/buyer')}`;

function buyerRuntimeSessionId(): string {
  if (typeof window === 'undefined') {
    return `session-${Date.now()}`;
  }
  const existing = window.localStorage.getItem(BUYER_SESSION_STORAGE_KEY);
  if (existing) return existing;
  const created = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  window.localStorage.setItem(BUYER_SESSION_STORAGE_KEY, created);
  return created;
}

/** Verify FlatWatch control-plane, then start /api/agent/buyer in the background (no /agent navigation). */
export async function delegateBuyerToRuntimeAgent(
  task: string,
  ctx: {
    subjectId?: string | null;
    walletAddress?: string | null;
    context?: Record<string, unknown>;
  },
): Promise<BuyerToolResult> {
  const tool: BuyerToolName = 'delegate_to_runtime_agent';
  const brief = task.trim();
  if (!brief) {
    return { ok: false, tool, message: 'I need a bit more detail before I can start that.' };
  }
  if (import.meta.env.VITE_AGENT_RUNTIME_ENABLED === 'false') {
    return {
      ok: false,
      tool,
      message: "I can't take on longer work right now — background help is turned off.",
    };
  }
  const subject = (ctx.subjectId || ctx.walletAddress || '').trim();
  if (!subject) {
    return { ok: false, tool, message: "Sign in first and I'll take care of that for you." };
  }

  let runtime: { agent_access?: boolean; runtime_available?: boolean; blocked_reason?: string | null };
    try {
      const response = await fetch(buildAgentControlPlaneUrl('/api/agent/runtime?app=ondc-buyer'), {
        headers: {
          'X-User-Id': subject,
          ...(ctx.walletAddress && !String(ctx.walletAddress).startsWith('principal:')
            ? { 'X-Wallet-Address': String(ctx.walletAddress) }
            : {}),
        },
      });
      const raw = await response.text();
      if (!response.ok) {
        return {
          ok: false,
          tool,
          message: `I couldn't start that right now (service HTTP ${response.status}). Try again in a moment.`,
        };
      }
      if (raw.trimStart().startsWith('<')) {
        return {
          ok: false,
          tool,
          message:
            "Background help isn't reachable from this host yet — I'll stay here for shorter asks.",
        };
      }
      runtime = JSON.parse(raw) as typeof runtime;
    } catch (err) {
      return {
        ok: false,
        tool,
        message: err instanceof Error ? err.message : "I couldn't start that right now.",
      };
    }

  if (!runtime.runtime_available || !runtime.agent_access) {
    const raw = (runtime.blocked_reason || '').trim();
    const leaks =
      /cursor|api[_ ]?key|dashboard\/integrations/i.test(raw) || !raw;
    return {
      ok: false,
      tool,
      message: leaks
        ? "I couldn't start longer background work right now — I'll stay here and we can try a shorter ask, or try again later."
        : raw,
    };
  }

  const sessionId = buyerRuntimeSessionId();
  const started = startBuyerRuntimeBackground({
    task: brief,
    sessionId,
    subjectId: subject,
    walletAddress: ctx.walletAddress,
    context: {
      response_contract: 'buyer_agent_v1',
      agentguard_tools: BUYER_TOOL_DEFINITIONS,
      tool_runner: 'ondcbuyer/agentTools',
      ...(ctx.context ?? {}),
    },
  });

  return {
    ok: started.ok,
    tool,
    message: started.message,
    data: {
      sessionId: started.sessionId ?? sessionId,
      started: started.started,
      finished: false,
      busy: started.busy ?? false,
      guidance:
        'Acknowledge briefly. Do not claim completion yet. Do not mention another agent or /agent. The UI will notify when done.',
    },
  };
}

export const BUYER_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    name: 'search_catalog',
    description:
      'Short tool: open the Buyer results page for a query so the user sees offers load, then return matching item ids. ' +
      'Always use for find/search/show product asks. Chain with add_to_cart only after the user sees results (or in the same turn after search returns ids).',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    type: 'function' as const,
    name: 'navigate_to',
    description:
      'Short tool: navigate the Buyer UI so the user sees that page (/search, /cart, /checkout, /orders, /config, /results?q=…). ' +
      'Use when they ask to open/go to a page. Prefer search_catalog for product find (it opens /results).',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  {
    type: 'function' as const,
    name: 'add_to_cart',
    description:
      'Short tool: add one catalog item to the cart and take the user to /cart so they see the line. ' +
      'Prefer item_id from prior search when known. If results already show offers (or search returned loading/empty ids), ' +
      'pass query/name of the product the user named (e.g. “atta”) — host resolves from the visible results cache. ' +
      'Do NOT call search_catalog again just to add.',
    parameters: {
      type: 'object',
      properties: {
        item_id: { type: 'string' },
        query: { type: 'string' },
        quantity: { type: 'number' },
      },
      required: [],
    },
  },
  {
    type: 'function' as const,
    name: 'clear_cart',
    description:
      'Empty the current Buyer cart completely and open /cart so the user sees it is empty. Use for “clear”, “empty”, or “remove everything from my cart”.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function' as const,
    name: 'remove_from_cart',
    description:
      'Remove one line from the live Buyer cart and open /cart. Use item_id from Host cart context; if the cart has one line, item_id may be omitted.',
    parameters: {
      type: 'object',
      properties: {
        item_id: { type: 'string' },
        query: { type: 'string', description: 'Product name when item_id is not known.' },
      },
      required: [],
    },
  },
  {
    type: 'function' as const,
    name: 'set_cart_quantity',
    description:
      'Change the quantity of one live Buyer cart line and open /cart. Use item_id from Host cart context; if the cart has one line, item_id may be omitted.',
    parameters: {
      type: 'object',
      properties: {
        item_id: { type: 'string' },
        query: { type: 'string', description: 'Product name when item_id is not known.' },
        quantity: { type: 'number', description: 'Desired final quantity. Zero removes the line.' },
      },
      required: ['quantity'],
    },
  },
  {
    type: 'function' as const,
    name: 'fill_checkout',
    description:
      'Prefill Buyer checkout form fields (billing + delivery) and open /checkout. ' +
      'Use when the user asks to fill/enter/prefill name, phone, email, or address. ' +
      'Does NOT place the order — never call checkout_commit from this tool. ' +
      'Omit session_id (host fills). Pass any subset of fields the user provided.',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Optional; host fills from cart session.' },
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        tax_id: { type: 'string', description: 'Optional GSTIN' },
        line1: { type: 'string', description: 'Street address' },
        city: { type: 'string' },
        state: { type: 'string' },
        postal_code: { type: 'string', description: '6-digit PIN' },
        country: { type: 'string' },
      },
      required: [],
    },
  },
  {
    type: 'function' as const,
    name: 'checkout_commit',
    description:
      'Short guarded tool: commit checkout under AgentGuard for the current cart. ' +
      'Omit amount_inr and session_id — the host fills them from the live cart. ' +
      'Only pass amount_inr when the user explicitly names a different checkout amount.',
    parameters: {
      type: 'object',
      properties: {
        amount_inr: { type: 'number', description: 'Optional override; host uses cart subtotal when omitted.' },
        session_id: { type: 'string', description: 'Optional; host fills from cart session.' },
        item_id: { type: 'string' },
        quantity: { type: 'number' },
      },
      required: [],
    },
  },
  {
    type: 'function' as const,
    name: 'remember_preference',
    description:
      'Short tool: store a compact user preference for Samantha memory (like, dislike, preference, or note).',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['like', 'dislike', 'preference', 'note'] },
        value: { type: 'string' },
      },
      required: ['kind', 'value'],
    },
  },
  {
    type: 'function' as const,
    name: 'delegate_to_runtime_agent',
    description:
      'Start longer / multi-step / planning work in the background while staying as Samantha. Use for weekly grocery plans, budgets, bulk research, mandate setup explanations, or anything needing an extended loop. Do not use for simple navigate/search/add/checkout. Never send the user to /agent. Never claim the work finished until a later UI/tool update says so.',
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Clear brief for the background work.',
        },
        context: {
          type: 'object',
          description: 'Optional context (cart summary, current path, constraints).',
          additionalProperties: true,
        },
      },
      required: ['task'],
    },
  },
];

export async function runBuyerTool(
  name: BuyerToolName,
  args: Record<string, unknown>,
  ctx: {
    walletAddress?: string | null;
    /** Opaque principal for memory (preferred over wallet). */
    subjectId?: string | null;
    allowedActions?: string[] | null;
    cartItems?: Array<{ itemId: string; name: string; quantity: number }>;
  },
): Promise<BuyerToolResult> {
  const subject = (ctx.subjectId || ctx.walletAddress || '').trim();
  const wallet = (ctx.walletAddress || '').trim();
  const offered = buyerToolsForMandate(ctx.allowedActions);
  if (!offered.includes(name)) {
    return { ok: false, tool: name, message: 'Tool not permitted by confirmed mandate.' };
  }

  if (name === 'search_catalog') {
    const query = String(args.query ?? '');
    const catalogQ = catalogSearchQuery(query);
    const personalized = buildPersonalizedBuyerSearchPath(query, subject || null);
    // Always open results first so the user watches offers load (not a silent background search).
    const resultsPath = personalized.path;
    // Warm the visible/add cache before any remote readiness call. The signed
    // network dispatch still runs below, but a slow status probe must
    // not prevent Samantha from selecting a configured Seller offer.
    let configuredSellerItems: UCPItem[] = [];
    try {
      const configuredSeller = await searchCommerceItems(catalogQ);
      configuredSellerItems = configuredSeller.items ?? [];
      rememberBuyerCatalogItems(configuredSellerItems);
    } catch {
      // Network search can still proceed without the configured Seller cache.
    }

    // Seller-published hits already warm: paint once and stop. Dispatching ONDC
    // after early orb nav was causing TV to flash → loading → reload.
    if (configuredSellerItems.length > 0) {
      const compact = configuredSellerItems.slice(0, 8).map((item) => ({
        id: item.id,
        name: item.name,
        price_inr: item.price?.value,
        provider: item._provider,
      }));
      return {
        ok: true,
        tool: name,
        message: `Showing ${configuredSellerItems.length} item(s) for “${catalogQ}” on the results page.`,
        data: {
          items: compact,
          count: configuredSellerItems.length,
          demo_count: configuredSellerItems.length,
          source: 'demo-commerce',
          loading: false,
          can_assert_empty: false,
          applied_preferences: personalized.appliedLabels,
        },
        navigateTo: resultsPath,
      };
    }

    // Network lane: dispatch once + early return.
    // ResultsPage owns the visible catalog poll (shared via ondc_txn) — do NOT
    // run a second ondcSearchAndCollect here (double poll = laggy orb + GW load).
    if (await isOndcNetworkSearchReady()) {
      try {
        const dispatched = await dispatchBuyerSearch(catalogQ || query, { city: 'std:080' });
        const txn = String(dispatched.transaction_id || '');
        // ACK-first: catalogs paint on ResultsPage. If this session already cached
        // matching offers (prior search / progressive paint), hand ids to the model
        // so add_to_cart can run without a useless empty-id loop.
        const cached = compactCachedForQuery(catalogQ || query);
        const emptyDemo = cached.length === 0;
        return {
          ok: true,
          tool: name,
          message: cached.length
            ? `Opened results for “${catalogQ}” — ${cached.length} cached offer(s) ready to add; page still refreshing.`
            : emptyDemo
              ? `Opened results for “${catalogQ}”. Seller catalog has 0 matches so far — watch the page; if it stays at 0 matches, tell the user honestly none were found (do not invent products).`
              : txn
                ? `Opened results for “${catalogQ}” — watching offers load on the page. When adding, use add_to_cart with the product name (ids fill as offers paint).`
                : `Opened results for “${catalogQ}”.`,
          data: {
            items: cached,
            count: cached.length,
            demo_count: 0,
            source: 'ondc-network',
            transaction_id: txn || undefined,
            ack: typeof dispatched.ack === 'string' ? dispatched.ack : undefined,
            // Keep loading true so ResultsPage can paint network catalogs; the
            // orb host flips can_assert_empty after waitForBuyerCatalogItems.
            loading: true,
            applied_preferences: personalized.appliedLabels,
          },
          navigateTo: txn
            ? `${resultsPath}&ondc_txn=${encodeURIComponent(txn)}`
            : resultsPath,
        };
      } catch (err) {
        return {
          ok: false,
          tool: name,
          message: err instanceof Error ? err.message : 'ONDC search failed',
          data: { items: [], count: 0, source: 'ondc-network' },
          navigateTo: resultsPath,
        };
      }
    }

    // Demo-commerce only while network adapter off — never invent mock grocery rows.
    let items = configuredSellerItems;
    if (!items.length) {
      try {
        const result = await searchCommerceItems(catalogQ);
        items = result.items ?? [];
      } catch {
        items = [];
      }
    }
    rememberBuyerCatalogItems(items);
    const compact = items.slice(0, 8).map((item) => ({
      id: item.id,
      name: item.name,
      price_inr: item.price?.value,
      provider: item._provider,
    }));
    return {
      ok: true,
      tool: name,
      message:
        items.length > 0
          ? `Showing ${items.length} item(s) for “${catalogQ}” on the results page.`
          : `No offers found for “${catalogQ}”. Tell the user honestly none matched — do not invent products.`,
      data: {
        items: compact,
        count: items.length,
        source: 'demo-commerce',
        can_assert_empty: items.length === 0,
        applied_preferences: personalized.appliedLabels,
      },
      navigateTo: resultsPath,
    };
  }

  if (name === 'navigate_to') {
    const raw = String(args.path ?? args.page ?? args.destination ?? '').trim();
    const path = coerceBuyerNavPath(raw);
    if (!path) {
      return {
        ok: false,
        tool: name,
        message: 'Unknown Buyer path. Use /search, /cart, /checkout, /orders, /config, or /results?q=…',
      };
    }
    return { ok: true, tool: name, message: `Navigating to ${path}.`, navigateTo: path };
  }

  if (name === 'delegate_to_runtime_agent') {
    return delegateBuyerToRuntimeAgent(String(args.task ?? args.brief ?? ''), {
      subjectId: ctx.subjectId,
      walletAddress: ctx.walletAddress,
      context:
        args.context && typeof args.context === 'object'
          ? (args.context as Record<string, unknown>)
          : undefined,
    });
  }

  if (name === 'add_to_cart') {
    const quantity = Math.max(1, Number(args.quantity) || 1);
    const item = await resolveBuyerAddTarget(args);
    if (!item) {
      const hint = String(args.item_id ?? args.itemId ?? args.query ?? args.name ?? '').trim();
      return {
        ok: false,
        tool: name,
        message: hint
          ? `No cached result for “${hint}”. Wait until offers appear on /results, then add again (do not re-search unless the user asks).`
          : 'Nothing in the results cache yet. Wait for offers on /results, then call add_to_cart with the product name.',
      };
    }
    // Ensure cart UI title path (descriptor.name || name) always has a label.
    const labeled: UCPItem = {
      ...item,
      name: item.name || item.descriptor?.name || item.id,
      descriptor: {
        ...(item.descriptor ?? {}),
        name: item.descriptor?.name || item.name || item.id,
      },
    };
    return {
      ok: true,
      tool: name,
      message: `Added ${labeled.name} × ${quantity} to cart.`,
      cartAdds: [{ itemId: labeled.id, quantity, item: labeled }],
      // Make the cart change visible immediately (badge alone is easy to miss).
      navigateTo: '/cart',
    };
  }

  if (name === 'clear_cart') {
    const count = ctx.cartItems?.length ?? 0;
    return {
      ok: true,
      tool: name,
      message: count ? `Cleared ${count} item${count === 1 ? '' : 's'} from your cart.` : 'Your cart is already empty.',
      cartChanges: count ? [{ action: 'clear' }] : [],
      navigateTo: '/cart',
    };
  }

  if (name === 'remove_from_cart' || name === 'set_cart_quantity') {
    const cartItems = ctx.cartItems ?? [];
    const requested = String(args.item_id ?? args.itemId ?? args.query ?? args.name ?? '')
      .trim()
      .toLowerCase();
    const match = requested
      ? cartItems.find(
          (item) => item.itemId.toLowerCase() === requested || item.name.toLowerCase().includes(requested),
        )
      : cartItems.length === 1
        ? cartItems[0]
        : undefined;
    if (!match) {
      return {
        ok: false,
        tool: name,
        message: cartItems.length
          ? 'Tell me which cart item you want to change.'
          : 'Your cart is empty.',
        navigateTo: '/cart',
      };
    }
    if (name === 'remove_from_cart') {
      return {
        ok: true,
        tool: name,
        message: `Removed ${match.name} from your cart.`,
        cartChanges: [{ action: 'remove', itemId: match.itemId }],
        navigateTo: '/cart',
      };
    }
    const quantity = Math.max(0, Math.round(Number(args.quantity)));
    if (!Number.isFinite(Number(args.quantity))) {
      return { ok: false, tool: name, message: 'Tell me the quantity you want.' };
    }
    return {
      ok: true,
      tool: name,
      message: quantity
        ? `Set ${match.name} to ${quantity} in your cart.`
        : `Removed ${match.name} from your cart.`,
      cartChanges: [
        quantity
          ? { action: 'set_quantity', itemId: match.itemId, quantity }
          : { action: 'remove', itemId: match.itemId },
      ],
      navigateTo: '/cart',
    };
  }

  if (name === 'remember_preference') {
    const kind = String(args.kind ?? 'note') as 'like' | 'dislike' | 'preference' | 'note';
    const value = String(args.value ?? '');
    if (!value) {
      return { ok: false, tool: name, message: 'value required.' };
    }
    const safeKind = ['like', 'dislike', 'preference', 'note'].includes(kind) ? kind : 'note';
    rememberSamanthaFact(subject || null, safeKind, value);
    return {
      ok: true,
      tool: name,
      message: `Remembered ${safeKind}: ${value}`,
      data: { kind: safeKind, value },
    };
  }

  if (name === 'fill_checkout') {
    const sessionId = String(args.session_id ?? '').trim();
    if (!sessionId) {
      return { ok: false, tool: name, message: 'session_id required to fill checkout.' };
    }
    const nameVal = String(args.name ?? args.full_name ?? '').trim();
    const emailVal = String(args.email ?? '').trim();
    const phoneVal = String(args.phone ?? args.mobile ?? '').trim();
    const taxId = String(args.tax_id ?? args.gstin ?? '').trim();
    const line1 = String(args.line1 ?? args.street ?? args.address ?? '').trim();
    const city = String(args.city ?? '').trim();
    const state = String(args.state ?? '').trim();
    const postalCode = String(args.postal_code ?? args.pincode ?? args.pin ?? '').trim();
    const country = String(args.country ?? 'IND').trim() || 'IND';
    const hasBilling = Boolean(nameVal || emailVal || phoneVal || taxId);
    const hasDelivery = Boolean(line1 || city || state || postalCode);
    if (!hasBilling && !hasDelivery) {
      return {
        ok: false,
        tool: name,
        message: 'Tell me the name, phone, email, and/or delivery address to fill.',
        navigateTo: '/checkout',
      };
    }
    try {
      let existingBuyer: { name?: string; email?: string; phone?: string } = {};
      try {
        existingBuyer = getLocalSession(sessionId).buyer ?? {};
      } catch {
        /* new / missing session — require full billing if any billing field set */
      }
      if (hasBilling) {
        const merged = {
          name: nameVal || existingBuyer.name || '',
          email: emailVal || existingBuyer.email || '',
          phone: phoneVal || existingBuyer.phone || '',
          taxId: taxId || undefined,
        };
        if (!merged.name.trim() || !merged.email.trim() || !merged.phone.trim()) {
          return {
            ok: false,
            tool: name,
            message: 'Billing needs full name, email, and phone (or fill all three together).',
            navigateTo: '/checkout',
          };
        }
        updateLocalBuyer(sessionId, merged);
        if (!shouldUseLocalCartFallback(COMMERCE_DEMO_MODE, COMMERCE_API_BASE)) {
          const response = await fetch(buildCommerceUrl(`/api/cart/buyer/${sessionId}`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged),
          });
          if (!response.ok) {
            return {
              ok: false,
              tool: name,
              message: `Could not save billing (HTTP ${response.status}).`,
              navigateTo: '/checkout',
            };
          }
        }
      }
      if (hasDelivery) {
        const address: UCPAddress = {
          line1: line1 || '',
          city,
          state,
          postalCode,
          country,
        };
        // Merge street from session when only city/pin provided
        try {
          const session = getLocalSession(sessionId);
          if (!address.line1) address.line1 = session.buyer?.street || '';
          if (!address.city) address.city = session.buyer?.city || '';
          if (!address.state) address.state = session.buyer?.state || '';
          if (!address.postalCode) address.postalCode = session.buyer?.pincode || '';
        } catch {
          /* ignore */
        }
        if (!address.line1 || !address.city || !address.state || !address.postalCode) {
          return {
            ok: false,
            tool: name,
            message: 'Delivery needs street, city, state, and 6-digit PIN (or fill all four together).',
            navigateTo: '/checkout',
          };
        }
        updateLocalDeliveryAddress(sessionId, address);
      }
      dispatchCheckoutPrefill({
        sessionId,
        name: nameVal || undefined,
        email: emailVal || undefined,
        phone: phoneVal || undefined,
        taxId: taxId || undefined,
        line1: line1 || undefined,
        city: city || undefined,
        state: state || undefined,
        postalCode: postalCode || undefined,
        country,
      });
      const parts: string[] = [];
      if (hasBilling) parts.push('billing');
      if (hasDelivery) parts.push('delivery');
      return {
        ok: true,
        tool: name,
        message: `Filled ${parts.join(' + ')} on checkout. Review the form, then ask me to place the order when ready.`,
        navigateTo: '/checkout',
        data: {
          filled: { billing: hasBilling, delivery: hasDelivery },
          name: nameVal || undefined,
          email: emailVal || undefined,
          phone: phoneVal || undefined,
          city: city || undefined,
          postal_code: postalCode || undefined,
        },
      };
    } catch (err) {
      return {
        ok: false,
        tool: name,
        message: err instanceof Error ? err.message : 'Could not fill checkout.',
        navigateTo: '/checkout',
      };
    }
  }

  if (name !== 'checkout_commit') {
    return { ok: false, tool: name, message: `Unknown tool: ${name}` };
  }

  // checkout_commit — session cookie principal; wallet body only for legacy
  const amountInr = Math.round(Number(args.amount_inr) || 0);
  const sessionId = String(args.session_id ?? '');
  if (!sessionId) {
    return { ok: false, tool: name, message: 'session_id required for checkout.' };
  }
  if (amountInr <= 0) {
    return {
      ok: false,
      tool: name,
      message: 'Cart total is empty. Add items before checkout.',
      navigateTo: '/cart',
    };
  }
  try {
    const executed = await executeBuyerCheckout({
      walletAddress: wallet || null,
      subjectId: subject || null,
      amountInr,
      sessionId,
      approvalId: args.approval_id ? String(args.approval_id) : undefined,
      itemId: args.item_id ? String(args.item_id) : undefined,
      quantity: args.quantity != null ? Number(args.quantity) : 1,
    });
    const decision = (executed.decision ?? 'allow') as BuyerToolResult['decision'];
    const receiptId = executed.receipt?.receipt_id;
    const approvalId =
      'approval' in executed &&
      executed.approval &&
      typeof executed.approval === 'object' &&
      'approval_id' in (executed.approval as object)
        ? String((executed.approval as { approval_id?: string }).approval_id ?? '')
        : '';
    const message =
      decision === 'need_approval'
        ? 'Checkout requires exact one-time approval.'
        : decision === 'deny'
          ? 'Checkout denied by AgentGuard.'
          : `Checkout committed${receiptId ? `; receipt ${receiptId}` : ''}.`;

    let orderId: string | null = null;
    let navigateTo = '/checkout';
    if ((decision === 'allow' || !decision) && receiptId) {
      const order = orderFromCommerceExecution(executed.execution);
      if (order) {
        clearLocalSession(sessionId);
        orderId = order.id;
        navigateTo = `/orders/${order.id}`;
      }
    }
    if ((decision === 'allow' || !decision) && receiptId && !orderId) {
      return {
        ok: false,
        tool: name,
        message: 'Checkout was authorized but the shared exchange did not return an order.',
        decision,
        receiptId,
      };
    }

    writeCheckoutOutcome({
      at: Date.now(),
      decision: decision || 'unknown',
      message,
      receiptId: receiptId ?? null,
      amountInr,
      orderId,
      approvalId: approvalId || null,
    });

    return {
      ok: decision === 'allow' || Boolean(receiptId) || decision === 'need_approval',
      tool: name,
      message,
      decision,
      receiptId,
      navigateTo,
      data: { ...(executed as Record<string, unknown>), orderId },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed.';
    writeCheckoutOutcome({
      at: Date.now(),
      decision: 'deny',
      message,
      amountInr,
    });
    return {
      ok: false,
      tool: name,
      message,
      navigateTo: '/checkout',
    };
  }
}
