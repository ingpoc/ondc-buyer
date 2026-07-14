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
} from './buyerCatalogCache';
import { getCommerceItem, searchCommerceItems } from './commerceClient';
import { executeBuyerCheckout } from './agentGuardCheckout';
import { writeCheckoutOutcome } from './checkoutOutcome';
import { createPaidOrderFromAgentGuard } from './localOrders';
import {
  dispatchBuyerSearch,
  isOndcNetworkSearchReady,
} from './ondc/protocolClient';
import { rememberSamanthaFact } from './samanthaMemory';
import { startBuyerRuntimeBackground } from './samanthaRuntimeHandoff';
import type { UCPItem } from '../types';

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
  ]);
  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stop.has(t) && !/^\d+$/.test(t));
  // Product asks commonly lead with a brand/qualifier ("AgentGuard PreProd
  // Atta", "organic toned milk"). The final meaningful token is the stable
  // catalog noun and avoids dispatching the brand alone.
  return (tokens.at(-1) || raw.trim() || 'grocery').slice(0, 48);
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
  '/agent',
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
    agentguard: '/config',
    agent: '/agent',
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
    return null;
  }
  // Bare add_to_cart after a settled results page — use newest cached offer.
  const recent = listBuyerCatalogItems();
  return recent[0] ?? null;
}

const READ_TOOLS: BuyerToolName[] = [
  'search_catalog',
  'navigate_to',
  'add_to_cart',
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
      'Short tool: navigate the Buyer UI so the user sees that page (/search, /cart, /checkout, /orders, /config, /agent, /results?q=…). ' +
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
    const q = encodeURIComponent(catalogQ);
    // Always open results first so the user watches offers load (not a silent background search).
    const resultsPath = `/results?category=grocery&q=${q}`;

    // PreProd network lane: dispatch once + early return.
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
        return {
          ok: true,
          tool: name,
          message: cached.length
            ? `Opened results for “${catalogQ}” — ${cached.length} cached offer(s) ready to add; page still refreshing.`
            : txn
              ? `Opened results for “${catalogQ}” — watching offers load on the page. When adding, use add_to_cart with the product name (ids fill as offers paint).`
              : `Opened results for “${catalogQ}”.`,
          data: {
            items: cached,
            count: cached.length,
            source: 'ondc-network',
            transaction_id: txn || undefined,
            ack: typeof dispatched.ack === 'string' ? dispatched.ack : undefined,
            loading: true,
          },
          navigateTo: txn
            ? `${resultsPath}&ondc_txn=${encodeURIComponent(txn)}`
            : resultsPath,
        };
      } catch (err) {
        return {
          ok: false,
          tool: name,
          message: err instanceof Error ? err.message : 'ONDC network search failed',
          data: { items: [], count: 0, source: 'ondc-network' },
          navigateTo: resultsPath,
        };
      }
    }

    // Demo-commerce only while network adapter off — never invent mock grocery rows.
    let items: UCPItem[] = [];
    try {
      const result = await searchCommerceItems(catalogQ);
      items = result.items ?? [];
    } catch {
      items = [];
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
          : `Opened results for “${catalogQ}” — demo-commerce empty and ONDC network not enabled.`,
      data: { items: compact, count: items.length, source: 'demo-commerce' },
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
        message: 'Unknown Buyer path. Use /search, /cart, /checkout, /orders, /config, /agent, or /results?q=…',
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
      const order = createPaidOrderFromAgentGuard({
        sessionId,
        amountInr,
        receiptId,
        subjectId: subject,
      });
      if (order) {
        orderId = order.id;
        navigateTo = `/orders/${order.id}`;
      }
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
