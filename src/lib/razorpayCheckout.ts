import { TRUST_API_URL } from './identityUrls';

export const RAZORPAY_CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
export const RAZORPAY_TEST_KEY_PREFIX = 'rzp_test_';
export const RAZORPAY_LIVE_KEY_PREFIX = 'rzp_live_';
export const AWAITING_RAZORPAY_TEST_PAYMENT = 'AWAITING_RAZORPAY_TEST_PAYMENT';

const PAYMENTS_CONFIG_PATH = '/api/commerce/v1/payments/config';

export interface RazorpayCheckoutSignature {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayCheckoutOptionsPayload {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name?: string;
  description?: string;
}

export type PaymentRail = {
  rail: string;
  simulated: boolean;
  mode: string | null;
  key_id: string | null;
  currency: string;
  message: string;
};

export type RazorpaySandboxStatus =
  | { configured: false }
  | { configured: true; keyId: string };

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

export class RazorpayLiveKeyError extends Error {
  constructor(message = 'Razorpay live keys are not allowed. Checkout Test Mode only accepts rzp_test_.') {
    super(message);
    this.name = 'RazorpayLiveKeyError';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readString(data: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function readAmountPaise(data: Record<string, unknown>): number | undefined {
  const parsed = typeof data.amount === 'number' ? data.amount : typeof data.amount === 'string' ? Number(data.amount) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  return undefined;
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

export function paymentRailFromConfig(payload: unknown): PaymentRail | null {
  const root = asRecord(payload);
  const data = asRecord(root.data ?? root);
  const rail = asRecord(data.payment_rail);
  if (typeof rail.rail !== 'string' || !rail.rail.trim()) return null;
  return {
    rail: rail.rail,
    simulated: rail.simulated === true,
    mode: typeof rail.mode === 'string' ? rail.mode : null,
    key_id: typeof rail.key_id === 'string' && rail.key_id.trim() ? rail.key_id.trim() : null,
    currency: typeof rail.currency === 'string' && rail.currency.trim() ? rail.currency : 'INR',
    message: typeof rail.message === 'string' ? rail.message : '',
  };
}

export function razorpaySandboxConfigured(payload: unknown): RazorpaySandboxStatus {
  const rail = paymentRailFromConfig(payload);
  if (!rail || rail.rail === 'simulated' || rail.simulated) return { configured: false };
  if (isRazorpayLiveKey(rail.key_id)) return { configured: false };
  if (rail.rail === 'razorpay_test' && isRazorpayTestKey(rail.key_id)) {
    return { configured: true, keyId: rail.key_id as string };
  }
  return { configured: false };
}

export function shouldCollectRazorpayTestPayment(reasonCode?: string | null): boolean {
  return reasonCode === AWAITING_RAZORPAY_TEST_PAYMENT;
}

function razorpayOrderPath(commerceOrderId: string): string {
  return `/api/commerce/v1/orders/${encodeURIComponent(commerceOrderId)}/razorpay/orders`;
}

function razorpayConfirmPath(commerceOrderId: string): string {
  return `/api/commerce/v1/orders/${encodeURIComponent(commerceOrderId)}/razorpay/confirm`;
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
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
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
    const { ok, status, payload } = await gatewayJson(PAYMENTS_CONFIG_PATH);
    if (status === 401 || status === 403 || status === 404 || status === 501 || status === 503) {
      return { configured: false };
    }
    if (!ok) return { configured: false };
    return razorpaySandboxConfigured(payload);
  } catch {
    return { configured: false };
  }
}

export function razorpayCheckoutOptionsFromOrder(payload: unknown): RazorpayCheckoutOptionsPayload {
  const root = asRecord(payload);
  const data = asRecord(root.data ?? root);
  const options = asRecord(data.razorpay);
  const rail = asRecord(data.payment_rail);
  const key = assertRazorpayTestKey(
    readString(options, 'key') || readString(rail, 'key_id') || '',
  );
  const orderId = readString(options, 'order_id');
  const amount = readAmountPaise(options);
  if (!orderId) {
    throw new Error('Gateway Razorpay order response did not include Checkout order_id.');
  }
  if (!amount) {
    throw new Error('Gateway Razorpay order response did not include Checkout amount.');
  }
  return {
    key,
    amount,
    currency: readString(options, 'currency') || 'INR',
    order_id: orderId,
    name: readString(options, 'name'),
    description: readString(options, 'description'),
  };
}

export async function createRazorpayTestOrder(params: {
  commerceOrderId: string;
  correlationId?: string;
}): Promise<RazorpayCheckoutOptionsPayload> {
  const { ok, status, payload } = await gatewayJson(razorpayOrderPath(params.commerceOrderId), {
    method: 'POST',
    headers: {
      ...(params.correlationId ? { 'X-Correlation-ID': params.correlationId } : {}),
    },
  });
  const envelope = asRecord(payload);
  if (!ok || envelope.success === false) {
    throw gatewayError(payload, status, 'Razorpay Test Mode order was not created');
  }
  return razorpayCheckoutOptionsFromOrder(payload);
}

export async function confirmRazorpayTestPayment(
  commerceOrderId: string,
  signature: RazorpayCheckoutSignature,
  params?: { correlationId?: string },
): Promise<RazorpayCheckoutSignature> {
  const { ok, status, payload } = await gatewayJson(razorpayConfirmPath(commerceOrderId), {
    method: 'POST',
    headers: {
      ...(params?.correlationId ? { 'X-Correlation-ID': params.correlationId } : {}),
    },
    body: JSON.stringify({
      razorpay_order_id: signature.razorpay_order_id,
      razorpay_payment_id: signature.razorpay_payment_id,
      razorpay_signature: signature.razorpay_signature,
    }),
  });
  const envelope = asRecord(payload);
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

export async function openRazorpayTestCheckout(
  options: RazorpayCheckoutOptionsPayload,
  prefill?: RazorpayCheckoutPrefill,
): Promise<RazorpayCheckoutSignature> {
  const keyId = assertRazorpayTestKey(options.key);
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
      amount: options.amount,
      currency: options.currency || 'INR',
      name: options.name || 'ONDC Buyer',
      description:
        options.description ||
        'Razorpay Checkout Test Mode. Mock UPI and cards only — no real money.',
      order_id: options.order_id,
      prefill,
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
  commerceOrderId: string;
  correlationId?: string;
  prefill?: RazorpayCheckoutPrefill;
}): Promise<RazorpayCheckoutSignature> {
  const created = await createRazorpayTestOrder({
    commerceOrderId: params.commerceOrderId,
    correlationId: params.correlationId,
  });
  const signature = await openRazorpayTestCheckout(created, params.prefill);
  await confirmRazorpayTestPayment(params.commerceOrderId, signature, {
    correlationId: params.correlationId,
  });
  return signature;
}
