/**
 * ONDC / Beckn client — talks to gateway server-side adapter only.
 *
 * Signing keys never ship in Vite. Search/catalogs work when gateway ONDC_ENABLED.
 * Do not flip VITE_COMMERCE_DEMO_MODE without commerce_demo_mode_gate evidence.
 */
import { TRUST_API_URL } from '../identityUrls';

export interface OndcProtocolEnv {
  VITE_ONDC_SUBSCRIBER_ID?: string;
  VITE_ONDC_BAP_URI?: string;
  VITE_ONDC_GATEWAY_URL?: string;
  VITE_ONDC_REGISTRY_URL?: string;
  VITE_ONDC_CONTROL_PLANE_URL?: string;
}

export function resolveOndcProtocolConfig(env: OndcProtocolEnv) {
  const subscriberId = env.VITE_ONDC_SUBSCRIBER_ID?.trim() || '';
  const bapUri = env.VITE_ONDC_BAP_URI?.trim() || '';
  const gatewayUrl = env.VITE_ONDC_GATEWAY_URL?.trim() || '';
  const registryUrl = env.VITE_ONDC_REGISTRY_URL?.trim() || '';
  const configured = Boolean(subscriberId && bapUri && gatewayUrl);

  return {
    subscriberId,
    bapUri,
    gatewayUrl,
    registryUrl,
    configured,
  };
}

const config = resolveOndcProtocolConfig(import.meta.env);
const ONDC_CONTROL_PLANE_URL = (
  import.meta.env.VITE_ONDC_CONTROL_PLANE_URL?.trim() || TRUST_API_URL
).replace(/\/+$/, '');

export const ONDC_PROTOCOL_CONFIGURED = config.configured;

export type OndcAdapterStatus = {
  enabled?: boolean;
  configured?: boolean;
  subscriber_id?: string | null;
  note?: string;
  [key: string]: unknown;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientGatewayFailure(err: unknown, status?: number): boolean {
  if (status === 502 || status === 503 || status === 504) return true;
  const msg = err instanceof Error ? err.message : String(err || '');
  // Intentional AbortSignal timeouts must not be retried as "transient".
  if (/aborted|AbortError/i.test(msg)) return false;
  return /Failed to fetch|NetworkError|Load failed|fetch failed|hibernate|ECONNRESET|timed out/i.test(
    msg,
  );
}

/**
 * Free Render cold-start safe fetch: retry on 503 / Failed to fetch / empty hibernate wake.
 * Prefer durable UX over a permanent ResultsPage error card.
 */
export async function fetchGateway(
  path: string,
  init?: RequestInit,
  opts?: { retries?: number; retryMs?: number },
): Promise<Response> {
  const retries = opts?.retries ?? 5;
  const retryMs = opts?.retryMs ?? 1500;
  const url = path.startsWith('http') ? path : `${ONDC_CONTROL_PLANE_URL}${path}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, { credentials: 'include', ...init });
      // Render Free hibernate wake often returns 503 with empty body.
      if (!res.ok && isTransientGatewayFailure(null, res.status) && attempt < retries) {
        await sleep(retryMs * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isTransientGatewayFailure(err)) {
        await sleep(retryMs * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Gateway unreachable');
}

/** Ping gateway until healthy (or attempts exhaust). Safe no-op if already warm. */
export async function wakeGateway(opts?: { attempts?: number; retryMs?: number }): Promise<boolean> {
  const attempts = opts?.attempts ?? 6;
  const retryMs = opts?.retryMs ?? 1200;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetchGateway('/api/health', { method: 'GET' }, { retries: 0 });
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await sleep(retryMs * (i + 1));
  }
  return false;
}

export async function fetchOndcAdapterStatus(): Promise<OndcAdapterStatus> {
  const res = await fetchGateway('/api/ondc/status', { method: 'GET' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.detail || `ONDC adapter status failed (${res.status})`);
  }
  return (body?.data ?? body) as OndcAdapterStatus;
}

/** True when gateway can dispatch signed PreProd search. */
let readyCache: { at: number; value: boolean } | null = null;

export async function isOndcNetworkSearchReady(): Promise<boolean> {
  if (readyCache && Date.now() - readyCache.at < 30_000) {
    return readyCache.value;
  }
  try {
    await wakeGateway({ attempts: 2, retryMs: 800 });
    const status = await fetchOndcAdapterStatus();
    const value = Boolean(status.enabled && status.configured);
    readyCache = { at: Date.now(), value };
    return value;
  } catch {
    readyCache = { at: Date.now(), value: false };
    return false;
  }
}

export type OndcSearchResult = {
  transaction_id: string;
  message_id: string;
  outbox_id?: string;
  ack?: string;
  http_status?: number;
  success?: boolean;
  gateway_response?: unknown;
  [key: string]: unknown;
};

/** Beckn search via gateway — requires ONDC_ENABLED + configured keys. */
export async function ondcSearch(input: {
  query?: string;
  intent?: Record<string, unknown>;
  city?: string;
  domain?: string;
}): Promise<OndcSearchResult> {
  // Ready-cache / prior wake already warmed the Free instance when possible.
  const res = await fetchGateway('/api/ondc/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: input.query,
      intent: input.intent ?? {},
      city: input.city,
      domain: input.domain,
      // Preserve network fanout and prove the configured portfolio Seller BPP
      // with the same signed Beckn transaction.
      include_configured_bpp: true,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      typeof body?.detail === 'string'
        ? body.detail
        : typeof body?.error === 'string'
          ? body.error
          : '';
    throw new Error(
      detail
        ? `ONDC gateway dispatch failed: ${detail}`
        : `ONDC search unavailable (${res.status}) — gateway may be waking; retry.`,
    );
  }
  return (body?.data ?? body) as OndcSearchResult;
}

/** One user ask → one PreProd fanout. Share dispatch across tool + ResultsPage. */
type RecentDispatch = {
  at: number;
  transactionId: string;
  promise: Promise<OndcSearchResult>;
};
const recentDispatchByQuery = new Map<string, RecentDispatch>();
const collectInflight = new Map<
  string,
  Promise<{
    transaction_id: string;
    items: OndcCatalogItem[];
    count: number;
    preferred_bpp_found?: boolean;
  }>
>();

function normQuery(query: string): string {
  return query.trim().toLowerCase() || 'grocery';
}

/**
 * Dispatch Beckn search once per query (5s coalescing window).
 * Control plane (Samantha) and data plane (ResultsPage) must share this.
 */
export async function dispatchBuyerSearch(
  query: string,
  opts?: { city?: string },
): Promise<OndcSearchResult> {
  const key = normQuery(query);
  const hit = recentDispatchByQuery.get(key);
  if (hit && Date.now() - hit.at < 5_000) {
    return hit.promise;
  }
  const promise = ondcSearch({ query, city: opts?.city ?? 'std:080' }).then((dispatched) => {
    const cur = recentDispatchByQuery.get(key);
    if (cur && cur.promise === promise) {
      cur.transactionId = String(dispatched.transaction_id || '');
      cur.at = Date.now();
    }
    return dispatched;
  });
  recentDispatchByQuery.set(key, { at: Date.now(), transactionId: '', promise });
  return promise;
}

/** Txn from a recent shared dispatch for this query (if any). */
export function peekRecentSearchTxn(query: string): string | null {
  const hit = recentDispatchByQuery.get(normQuery(query));
  if (!hit || Date.now() - hit.at > 15_000) return null;
  return hit.transactionId || null;
}

export type OndcCatalogItem = {
  id?: string;
  name?: string;
  description?: string;
  price_inr?: string | number;
  provider_name?: string;
  bpp_id?: string;
  transaction_id?: string;
  [key: string]: unknown;
};

export async function fetchOndcCatalogs(transactionId: string): Promise<{
  items: OndcCatalogItem[];
  count: number;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetchGateway(
      `/api/ondc/catalogs?transaction_id=${encodeURIComponent(transactionId)}`,
      { method: 'GET', signal: controller.signal },
      { retries: 1, retryMs: 600 },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof body?.detail === 'string'
          ? body.detail
          : `ONDC catalogs failed (${res.status})`,
      );
    }
    const data = (body?.data ?? body) as { items?: OndcCatalogItem[]; count?: number };
    return { items: data.items ?? [], count: data.count ?? 0 };
  } finally {
    clearTimeout(timer);
  }
}

/** Poll an existing search txn for catalogs (ResultsPage path — no re-dispatch). */
export async function ondcCollectFromTxn(
  transactionId: string,
  opts?: {
    pollMs?: number;
    attempts?: number;
    /** Only when proving our Seller — do not block first paint on prefer. */
    preferBppId?: string;
    /** Called when the first non-empty batch arrives (progressive paint). */
    onPartial?: (items: OndcCatalogItem[]) => void;
  },
): Promise<{
  transaction_id: string;
  items: OndcCatalogItem[];
  count: number;
  preferred_bpp_found?: boolean;
}> {
  const key = `txn:${transactionId}`;
  const existing = collectInflight.get(key);
  if (existing) {
    const shared = await existing;
    if (opts?.onPartial && shared.items.length > 0) {
      opts.onPartial(shared.items);
    }
    return shared;
  }

  const work = (async () => {
    const pollMs = opts?.pollMs ?? 1000;
    const attempts = opts?.attempts ?? 8;
    const preferBppId = opts?.preferBppId?.trim() || '';
    let items: OndcCatalogItem[] = [];
    let preferredFound = false;
    let partialEmitted = false;
    for (let i = 0; i < attempts; i += 1) {
      if (i > 0) {
        await sleep(pollMs);
      }
      try {
        const page = await fetchOndcCatalogs(transactionId);
        items = page.items;
      } catch (err) {
        if (i >= attempts - 1) throw err;
        continue;
      }
      if (items.length > 0 && !partialEmitted && opts?.onPartial) {
        partialEmitted = true;
        opts.onPartial(items);
      }
      // First non-empty batch wins for UX. Prefer-BPP is optional enrichment only.
      if (items.length > 0 && !preferBppId) break;
      if (preferBppId) {
        preferredFound = items.some((item) => String(item.bpp_id || '') === preferBppId);
        if (preferredFound) break;
        if (items.length > 0 && i >= 2) break;
        continue;
      }
    }
    return {
      transaction_id: transactionId,
      items,
      count: items.length,
      preferred_bpp_found: preferBppId ? preferredFound : undefined,
    };
  })();

  collectInflight.set(key, work);
  try {
    return await work;
  } finally {
    if (collectInflight.get(key) === work) {
      collectInflight.delete(key);
    }
  }
}

/** Dispatch search then poll inbox for on_search catalogs.
 *
 * When `preferBppId` is set, keep polling until that BPP appears or attempts
 * exhaust (PreProd fanout variance — other BPPs alone are not a stop signal).
 * Prefer `ondcSearch` (tool) + `ondcCollectFromTxn` (ResultsPage) to avoid double poll.
 */
export async function ondcSearchAndCollect(
  query: string,
  opts?: {
    city?: string;
    pollMs?: number;
    attempts?: number;
    preferBppId?: string;
    onPartial?: (items: OndcCatalogItem[]) => void;
  },
): Promise<{
  transaction_id: string;
  items: OndcCatalogItem[];
  count: number;
  ack?: string;
  preferred_bpp_found?: boolean;
}> {
  const dispatched = await dispatchBuyerSearch(query, { city: opts?.city });
  const transactionId = String(dispatched.transaction_id || '');
  const collected = await ondcCollectFromTxn(transactionId, opts);
  return {
    ...collected,
    ack: typeof dispatched.ack === 'string' ? dispatched.ack : undefined,
  };
}

/** Our Seller BPP id on PreProd — prefer in discovery polls (fanout may omit). */
export const OUR_BPP_ID = 'ondcseller.aadharcha.in';

export type OndcOrderActionInput = {
  order: Record<string, unknown>;
  transaction_id?: string;
  bpp_id?: string;
  bpp_uri?: string;
  message_id?: string;
  city?: string;
  domain?: string;
};

async function ondcOrderAction(
  action: 'select' | 'init' | 'confirm',
  input: OndcOrderActionInput,
): Promise<Record<string, unknown>> {
  const res = await fetchGateway(`/api/ondc/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body?.detail === 'string' ? body.detail : `ONDC ${action} failed`,
    );
  }
  return (body?.data ?? body) as Record<string, unknown>;
}

export async function ondcSelect(input: OndcOrderActionInput): Promise<Record<string, unknown>> {
  return ondcOrderAction('select', input);
}

export async function ondcInit(input: OndcOrderActionInput): Promise<Record<string, unknown>> {
  return ondcOrderAction('init', input);
}

export async function ondcConfirm(input: OndcOrderActionInput | Record<string, unknown>): Promise<Record<string, unknown>> {
  if (input && typeof input === 'object' && 'order' in input) {
    return ondcOrderAction('confirm', input as OndcOrderActionInput);
  }
  return ondcOrderAction('confirm', { order: input as Record<string, unknown> });
}

/** Minimal select → init → confirm ACK path against our Seller BPP (API proof). */
export async function ondcSelectInitConfirm(input: OndcOrderActionInput): Promise<{
  select: Record<string, unknown>;
  init: Record<string, unknown>;
  confirm: Record<string, unknown>;
}> {
  const select = await ondcSelect(input);
  const txn = String(input.transaction_id || select.transaction_id || '');
  const shared = {
    ...input,
    transaction_id: txn || undefined,
    bpp_id: input.bpp_id || (select.bpp_id as string | undefined),
    bpp_uri: input.bpp_uri || (select.bpp_uri as string | undefined),
  };
  const init = await ondcInit(shared);
  const confirm = await ondcConfirm(shared);
  return { select, init, confirm };
}

export function requireOndcProtocol() {
  if (!config.configured) {
    throw new Error(
      'ONDC public discovery env not set. Set VITE_ONDC_* after P5; secrets stay on gateway.',
    );
  }
  return config;
}
