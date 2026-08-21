import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AWAITING_RAZORPAY_TEST_PAYMENT,
  assertRazorpayTestKey,
  collectRazorpayTestPayment,
  confirmRazorpayTestPayment,
  fetchRazorpaySandboxStatus,
  openRazorpayTestCheckout,
  razorpaySandboxConfigured,
  RazorpayLiveKeyError,
  shouldCollectRazorpayTestPayment,
  type RazorpayCheckoutSignature,
} from './razorpayCheckout';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });
}

function installRazorpay(handlerResponse?: RazorpayCheckoutSignature) {
  const open = vi.fn();
  const ctor = vi.fn().mockImplementation((options: { handler?: (payload: RazorpayCheckoutSignature) => void }) => {
    if (handlerResponse && options.handler) {
      queueMicrotask(() => options.handler?.(handlerResponse));
    }
    return { open, on: vi.fn() };
  });
  Object.defineProperty(window, 'Razorpay', {
    configurable: true,
    writable: true,
    value: ctor,
  });
  return { ctor, open };
}

const signature: RazorpayCheckoutSignature = {
  razorpay_order_id: 'order_test_1',
  razorpay_payment_id: 'pay_test_1',
  razorpay_signature: 'sig_test_1',
};

const simulatedRail = {
  rail: 'simulated',
  simulated: true,
  mode: null,
  key_id: null,
  currency: 'INR',
  message: 'Razorpay Test Mode keys are not configured; payment is simulated.',
};

const testRail = {
  rail: 'razorpay_test',
  simulated: false,
  mode: 'test',
  key_id: 'rzp_test_x',
  currency: 'INR',
  message: 'Razorpay Test Mode. Mock UPI/cards only. No live customer money.',
};

describe('Razorpay Checkout Test Mode', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    delete window.Razorpay;
  });

  afterEach(() => {
    delete window.Razorpay;
  });

  it('does not treat a missing or invented configured flag as Razorpay Test Mode', () => {
    expect(razorpaySandboxConfigured({ detail: 'Not Found' })).toEqual({ configured: false });
    expect(
      razorpaySandboxConfigured({ success: true, data: { configured: true, key_id: 'rzp_test_x' } }),
    ).toEqual({ configured: false });
    expect(
      razorpaySandboxConfigured({ success: true, data: { payment_rail: simulatedRail } }),
    ).toEqual({ configured: false });
  });

  it('enables Test Mode only for payment_rail.rail=razorpay_test and never for rzp_live_', () => {
    expect(
      razorpaySandboxConfigured({
        success: true,
        data: { payment_rail: testRail },
      }),
    ).toEqual({ configured: true, keyId: 'rzp_test_x' });
    expect(
      razorpaySandboxConfigured({
        success: true,
        data: {
          payment_rail: { ...testRail, key_id: 'rzp_live_x' },
        },
      }),
    ).toEqual({ configured: false });
    expect(() => assertRazorpayTestKey('rzp_live_x')).toThrow(RazorpayLiveKeyError);
  });

  it('keeps the simulated path when GET /payments/config says keys are missing', async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({ success: true, message: simulatedRail.message, data: { payment_rail: simulatedRail } }),
    );

    await expect(fetchRazorpaySandboxStatus()).resolves.toEqual({ configured: false });
    expect(shouldCollectRazorpayTestPayment('EXECUTED_AND_VERIFIED')).toBe(false);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/payments/config');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/razorpay/orders');
  });

  it('treats a missing config route as simulated, not configured', async () => {
    fetchMock.mockImplementation(() => jsonResponse({ detail: 'Not Found' }, 404));
    await expect(fetchRazorpaySandboxStatus()).resolves.toEqual({ configured: false });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/payments/config');
  });

  it('collects Checkout only after AgentGuard returns AWAITING_RAZORPAY_TEST_PAYMENT', () => {
    expect(shouldCollectRazorpayTestPayment(AWAITING_RAZORPAY_TEST_PAYMENT)).toBe(true);
    expect(shouldCollectRazorpayTestPayment(undefined)).toBe(false);
    expect(shouldCollectRazorpayTestPayment('PAYMENT_STATUS_UNKNOWN')).toBe(false);
  });

  it('refuses to open the Checkout overlay when a live key appears', async () => {
    const { ctor, open } = installRazorpay(signature);

    await expect(
      openRazorpayTestCheckout({
        key: 'rzp_live_x',
        order_id: 'order_live_1',
        amount: 17800,
        currency: 'INR',
      }),
    ).rejects.toThrow(/live keys are not allowed/i);

    expect(ctor).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('creates a Razorpay order on the commerce order path then POSTs only the signature fields', async () => {
    const { ctor, open } = installRazorpay(signature);
    fetchMock
      .mockImplementationOnce(() =>
        jsonResponse({
          success: true,
          data: {
            order: { order_id: 'commerce-order-1' },
            payment_attempt: { status: 'pending' },
            payment_rail: testRail,
            razorpay: {
              key: 'rzp_test_x',
              amount: 17800,
              currency: 'INR',
              order_id: 'order_test_1',
              name: 'AgentGuard',
              description: 'ONDC Buyer checkout (Razorpay Test Mode)',
            },
          },
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          success: true,
          data: { order: { status: 'paid' }, payment_attempt: { status: 'succeeded' } },
        }),
      );

    await expect(
      collectRazorpayTestPayment({
        commerceOrderId: 'commerce-order-1',
        correlationId: 'buyer-checkout:attempt-1',
      }),
    ).resolves.toEqual(signature);

    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor.mock.calls[0][0]).toMatchObject({
      key: 'rzp_test_x',
      order_id: 'order_test_1',
      amount: 17800,
      currency: 'INR',
    });
    expect(open).toHaveBeenCalledTimes(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/orders/commerce-order-1/razorpay/orders',
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/payments/razorpay/orders');
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    expect(JSON.stringify(fetchMock.mock.calls[0][1])).not.toMatch(/quote_id/);

    expect(String(fetchMock.mock.calls[1][0])).toContain(
      '/orders/commerce-order-1/razorpay/confirm',
    );
    expect(String(fetchMock.mock.calls[1][0])).not.toContain('/payments/razorpay/confirm');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      razorpay_order_id: 'order_test_1',
      razorpay_payment_id: 'pay_test_1',
      razorpay_signature: 'sig_test_1',
    });
  });

  it('refuses a live key returned by create-order before Checkout opens', async () => {
    const { ctor } = installRazorpay(signature);
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        success: true,
        data: {
          payment_rail: { ...testRail, key_id: 'rzp_live_x' },
          razorpay: { key: 'rzp_live_x', amount: 17800, currency: 'INR', order_id: 'order_live_1' },
        },
      }),
    );

    await expect(
      collectRazorpayTestPayment({ commerceOrderId: 'commerce-order-1' }),
    ).rejects.toThrow(/live keys are not allowed/i);
    expect(ctor).not.toHaveBeenCalled();
  });

  it('does not put a key secret or quote_id on the confirm payload', async () => {
    fetchMock.mockImplementationOnce(() => jsonResponse({ success: true, data: { verified: true } }));

    await confirmRazorpayTestPayment('commerce-order-1', signature);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body).toEqual({
      razorpay_order_id: 'order_test_1',
      razorpay_payment_id: 'pay_test_1',
      razorpay_signature: 'sig_test_1',
    });
    expect(body).not.toHaveProperty('key_secret');
    expect(body).not.toHaveProperty('secret');
    expect(body).not.toHaveProperty('quote_id');
    expect(JSON.stringify(body)).not.toMatch(/rzp_live_/);
  });

  it('keeps the key secret, demo-mode switch, and retired payment paths out of the SPA client', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/razorpayCheckout.ts'), 'utf8');
    expect(source).not.toMatch(/key_secret|KEY_SECRET|VITE_RAZORPAY|VITE_COMMERCE_DEMO_MODE/);
    expect(source).not.toMatch(/\/payments\/razorpay\/orders/);
    expect(source).not.toMatch(/\/payments\/razorpay\/confirm/);
    expect(source).not.toMatch(/\/payments\/razorpay\/webhook/);
    expect(source).toContain('/api/commerce/v1/payments/config');
    expect(source).toContain('/razorpay/orders');
    expect(source).toContain('/razorpay/confirm');
  });
});
