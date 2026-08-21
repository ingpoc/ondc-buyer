import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertRazorpayTestKey,
  collectRazorpayTestPayment,
  confirmRazorpayTestPayment,
  fetchRazorpaySandboxStatus,
  maybeCollectRazorpayTestPayment,
  openRazorpayTestCheckout,
  razorpaySandboxConfigured,
  RazorpayLiveKeyError,
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

describe('Razorpay Checkout Test Mode', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    delete window.Razorpay;
  });

  afterEach(() => {
    delete window.Razorpay;
  });

  it('does not treat a missing gateway route as Razorpay configured', () => {
    expect(razorpaySandboxConfigured({ detail: 'Not Found' })).toEqual({ configured: false });
    expect(
      razorpaySandboxConfigured({ success: true, data: { configured: false } }),
    ).toEqual({ configured: false });
  });

  it('enables Test Mode only for sandbox hints and never for rzp_live_ keys', () => {
    expect(
      razorpaySandboxConfigured({
        success: true,
        data: { configured: true, mode: 'test', key_id: 'rzp_test_x' },
      }),
    ).toEqual({ configured: true, keyId: 'rzp_test_x' });
    expect(
      razorpaySandboxConfigured({
        success: true,
        data: { configured: true, key_id: 'rzp_live_x' },
      }),
    ).toEqual({ configured: false });
    expect(() => assertRazorpayTestKey('rzp_live_x')).toThrow(RazorpayLiveKeyError);
  });

  it('keeps the simulated path when the gateway says Razorpay is off', async () => {
    fetchMock.mockImplementation(() => jsonResponse({ detail: 'Not Found' }, 404));

    await expect(fetchRazorpaySandboxStatus()).resolves.toEqual({ configured: false });
    await expect(
      maybeCollectRazorpayTestPayment(false, {
        quoteId: 'quote-1',
        amountPaise: 17800,
        correlationId: 'corr-1',
        idempotencyKey: 'attempt-1:execute',
      }),
    ).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/payments/razorpay');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/orders');
  });

  it('refuses to open the Checkout overlay when a live key appears', async () => {
    const { ctor, open } = installRazorpay(signature);

    await expect(
      openRazorpayTestCheckout({
        keyId: 'rzp_live_x',
        orderId: 'order_live_1',
        amount: 17800,
      }),
    ).rejects.toThrow(/live keys are not allowed/i);

    expect(ctor).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('opens Checkout with the public test key and POSTs the signature to confirm', async () => {
    const { ctor, open } = installRazorpay(signature);
    fetchMock
      .mockImplementationOnce(() =>
        jsonResponse({
          success: true,
          data: {
            key_id: 'rzp_test_x',
            order_id: 'order_test_1',
            amount: 17800,
            currency: 'INR',
          },
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          success: true,
          data: { verified: true, payment_id: 'pay_test_1' },
        }),
      );

    await expect(
      collectRazorpayTestPayment({
        quoteId: 'quote-1',
        amountPaise: 17800,
        correlationId: 'buyer-checkout:attempt-1',
        idempotencyKey: 'attempt-1:execute',
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
    expect(String(fetchMock.mock.calls[0][0])).toContain('/payments/razorpay/orders');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      quote_id: 'quote-1',
      amount_paise: 17800,
      currency: 'INR',
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain('/payments/razorpay/confirm');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      razorpay_order_id: 'order_test_1',
      razorpay_payment_id: 'pay_test_1',
      razorpay_signature: 'sig_test_1',
      quote_id: 'quote-1',
    });
  });

  it('refuses a live key returned by create-order before Checkout opens', async () => {
    const { ctor } = installRazorpay(signature);
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({
        success: true,
        data: { key_id: 'rzp_live_x', order_id: 'order_live_1', amount: 17800 },
      }),
    );

    await expect(
      collectRazorpayTestPayment({
        quoteId: 'quote-1',
        amountPaise: 17800,
        correlationId: 'corr-1',
        idempotencyKey: 'attempt-1:execute',
      }),
    ).rejects.toThrow(/live keys are not allowed/i);
    expect(ctor).not.toHaveBeenCalled();
  });

  it('does not put a key secret on the confirm payload', async () => {
    fetchMock.mockImplementationOnce(() => jsonResponse({ success: true, data: { verified: true } }));

    await confirmRazorpayTestPayment(signature, { quoteId: 'quote-1' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty('key_secret');
    expect(body).not.toHaveProperty('secret');
    expect(JSON.stringify(body)).not.toMatch(/rzp_live_/);
  });

  it('keeps the key secret and demo-mode switch out of the SPA client', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/razorpayCheckout.ts'), 'utf8');
    expect(source).not.toMatch(/key_secret|KEY_SECRET|VITE_RAZORPAY|VITE_COMMERCE_DEMO_MODE/);
  });
});
