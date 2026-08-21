import { TRUST_API_URL } from './identityUrls';

export const RAZORPAY_CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
export const RAZORPAY_TEST_KEY_PREFIX = 'rzp_test_';
export const RAZORPAY_LIVE_KEY_PREFIX = 'rzp_live_';

const RAZORPAY_STATUS_PATH = '/api/commerce/v1/payments/razorpay';
const RAZORPAY_ORDER_PATH = '/api/commerce/v1/payments/razorpay/orders';
const RAZORPAY_CONFIRM_PATH = '/api/commerce/v1/payments/razorpay/confirm';

export interface RazorpayCheckoutSignature {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayTestOrder {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
}

export type RazorpaySandboxStatus =
  | { configured: false }
  | { configured: true; keyId?: string };

export interface RazorpayCheckoutPrefill {
  name?: string;
  email?: string;
  contact?: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayCheckoutSignature) => void;
  prefill?: RazorpayCheckoutPrefill;
  modal?: { ondismiss?: () => void };
  notes?: Record<string, string>;
  theme?: { color?: string };
}

interface RazorpayCheckoutInstance {
  open: () => void;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
}

type RazorpayConstructor = new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

interface ApiEnvelope {
  success?: boolean;
  data?: unknown;
  detail?: string;
  message?: string;
}

export class RazorpayLiveKeyError extends Error {
  constructor(message = 'Razorpay live keys are not allowed. Checkout Test Mode only accepts rzp_test_.') {
    super(message);
    this.name = 'RazorpayLiveKeyError';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function unwrapGatewayData(payload: unknown): Record<string, unknown> {
  const root = asRecord(payload);
  const data = asRecord(root.data ?? root);
  const nested = asRecord(data.razorpay);
  return Object.keys(nested).length > 0 ? { ...data, ...nested } : data;
}

export function isRazorpayLiveKey(keyId: string | null | undefined): boolean {
  return Boolean(keyId?.trim().toLowerCase().startsWith(RAZORPAY_LIVE_KEY_PREFIX));
}

export function isRazorpayTestKey(keyId: string | null | undefined): boolean {
  return Boolean(keyId?.trim().startsWith(RAZORPAY_TEST_KEY_PREFIX));
}

export function assertRazorpayTestKey(keyId: string): string {
  const trimmed = keyId.trim();
  if (isRazorpayLiveKey(trimmed)) {
    throw new RazorpayLiveKeyError();
  }
  if (!isRazorpayTestKey(trimmed)) {
    throw new Error('Razorpay Checkout Test Mode requires a public rzp_test_ key id from the gateway.');
  }
  return trimmed;
}

function readString(data: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function readAmountPaise(data: Record<string, unknown>, fallback: number): number {
  const paiseCandidates = [data.amount_paise, data.amountPaise, data.amount];
  for (const value of paiseCandidates) {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  const rupees = data.amount_inr ?? data.amountInr;
  const parsedRupees = typeof rupees === 'number' ? rupees : typeof rupees === 'string' ? Number(rupees) : NaN;
  if (Number.isFinite(parsedRupees) && parsedRupees > 0) return Math.round(parsedRupees * 100);
  return fallback;
}

export function razorpaySandboxConfigured(payload: unknown): RazorpaySandboxStatus {
  const data = unwrapGatewayData(payload);
  const keyId = readString(data, 'key_id', 'keyId', 'key');
  if (keyId && isRazorpayLiveKey(keyId)) return { configured: false };
  if (data.mode === 'live' || data.live === true) return { configured: false };
  if (data.configured === false || data.enabled === false || data.available === false) {
    return { configured: false };
  }
  const testHint =
    data.configured === true ||
    data.enabled === true ||
    data.available === true ||
    data.sandbox === true ||
    data.mode === 'test' ||
    data.provider === 'razorpay';
  if (testHint || isRazorpayTestKey(keyId)) {
    return keyId ? { configured: true, keyId } : { configured: true };
  }
  return { configured: false };
}

async function gatewayJson(path: string, init: RequestInit = {}): Promise<{
  ok: boolean;
  status: number;
  payload: unknown;
}> {
  const response = await fetch(`${TRUST_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

function gatewayError(payload: unknown, status: number, fallback: string): Error {
  const body = asRecord(payload);
  const detail = body.detail || body.message;
  return new Error(typeof detail === 'string' && detail.trim() ? detail : `${fallback} (${status})`);
}

export async function fetchRazorpaySandboxStatus(): Promise<RazorpaySandboxStatus> {
  try {
    const { ok, status, payload } = await gatewayJson(RAZORPAY_STATUS_PATH);
    if (status === 401 || status === 403 || status === 404 || status === 501 || status === 503) {
      return { configured: false };
    }
    if (!ok) return { configured: false };
    return razorpaySandboxConfigured(payload);
  } catch {
    return { configured: false };
  }
}

export async function createRazorpayTestOrder(params: {
  quoteId: string;
  amountPaise: number;
  correlationId: string;
  idempotencyKey: string;
}): Promise<RazorpayTestOrder> {
  const { ok, status, payload } = await gatewayJson(RAZORPAY_ORDER_PATH, {
    method: 'POST',
    headers: {
      'Idempotency-Key': params.idempotencyKey,
      'X-Correlation-ID': params.correlationId,
    },
    body: JSON.stringify({
      quote_id: params.quoteId,
      amount_paise: params.amountPaise,
      currency: 'INR',
    }),
  });
  const envelope = payload as ApiEnvelope;
  if (!ok || envelope.success === false) {
    throw gatewayError(payload, status, 'Razorpay Test Mode order was not created');
  }
  const data = unwrapGatewayData(payload);
  const keyId = assertRazorpayTestKey(
    readString(data, 'key_id', 'keyId', 'key') || '',
  );
  const orderId = readString(data, 'order_id', 'orderId', 'id', 'razorpay_order_id');
  if (!orderId) {
    throw new Error('Gateway Razorpay order response did not include order_id.');
  }
  return {
    keyId,
    orderId,
    amount: readAmountPaise(data, params.amountPaise),
    currency: readString(data, 'currency') || 'INR',
  };
}

export async function confirmRazorpayTestPayment(
  signature: RazorpayCheckoutSignature,
  params?: { quoteId?: string; correlationId?: string; idempotencyKey?: string },
): Promise<RazorpayCheckoutSignature> {
  const { ok, status, payload } = await gatewayJson(RAZORPAY_CONFIRM_PATH, {
    method: 'POST',
    headers: {
      ...(params?.idempotencyKey ? { 'Idempotency-Key': params.idempotencyKey } : {}),
      ...(params?.correlationId ? { 'X-Correlation-ID': params.correlationId } : {}),
    },
    body: JSON.stringify({
      razorpay_order_id: signature.razorpay_order_id,
      razorpay_payment_id: signature.razorpay_payment_id,
      razorpay_signature: signature.razorpay_signature,
      ...(params?.quoteId ? { quote_id: params.quoteId } : {}),
    }),
  });
  const envelope = payload as ApiEnvelope;
  if (!ok || envelope.success === false) {
    throw gatewayError(payload, status, 'Razorpay Test Mode signature was not verified');
  }
  return signature;
}

export async function loadRazorpayCheckoutScript(): Promise<RazorpayConstructor> {
  if (typeof window === 'undefined') {
    throw new Error('Razorpay Checkout requires a browser.');
  }
  if (window.Razorpay) return window.Razorpay;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_CHECKOUT_SCRIPT_URL}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load Razorpay Checkout.')),
        { once: true },
      );
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay Checkout.'));
    document.head.appendChild(script);
  });

  if (!window.Razorpay) {
    throw new Error('Razorpay Checkout did not initialize.');
  }
  return window.Razorpay;
}

export async function openRazorpayTestCheckout(params: {
  keyId: string;
  orderId: string;
  amount: number;
  currency?: string;
  prefill?: RazorpayCheckoutPrefill;
}): Promise<RazorpayCheckoutSignature> {
  const keyId = assertRazorpayTestKey(params.keyId);
  const Razorpay = await loadRazorpayCheckoutScript();
  if (isRazorpayLiveKey(keyId)) {
    throw new RazorpayLiveKeyError();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      action();
    };
    const checkout = new Razorpay({
      key: keyId,
      amount: params.amount,
      currency: params.currency || 'INR',
      name: 'ONDC Buyer',
      description: 'Razorpay Checkout Test Mode. Mock UPI and cards only — no real money.',
      order_id: params.orderId,
      prefill: params.prefill,
      handler: (response) => finish(() => resolve(response)),
      modal: {
        ondismiss: () =>
          finish(() =>
            reject(new Error('Razorpay Test Mode checkout was closed before payment.')),
          ),
      },
    });
    checkout.open();
  });
}

export async function collectRazorpayTestPayment(params: {
  quoteId: string;
  amountPaise: number;
  correlationId: string;
  idempotencyKey: string;
  prefill?: RazorpayCheckoutPrefill;
}): Promise<RazorpayCheckoutSignature> {
  const created = await createRazorpayTestOrder({
    quoteId: params.quoteId,
    amountPaise: params.amountPaise,
    correlationId: params.correlationId,
    idempotencyKey: `${params.idempotencyKey}:razorpay-order`,
  });
  const signature = await openRazorpayTestCheckout({
    keyId: created.keyId,
    orderId: created.orderId,
    amount: created.amount,
    currency: created.currency,
    prefill: params.prefill,
  });
  await confirmRazorpayTestPayment(signature, {
    quoteId: params.quoteId,
    correlationId: params.correlationId,
    idempotencyKey: `${params.idempotencyKey}:razorpay-confirm`,
  });
  return signature;
}

export async function maybeCollectRazorpayTestPayment(
  sandboxConfigured: boolean,
  params: Parameters<typeof collectRazorpayTestPayment>[0],
): Promise<RazorpayCheckoutSignature | null> {
  if (!sandboxConfigured) return null;
  return collectRazorpayTestPayment(params);
}
