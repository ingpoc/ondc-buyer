import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalSession } from './localCart';
import {
  COMMERCE_V1_BUYER_PATH,
  buyerPersistBody,
  formatBuyerPersistWarning,
  isNonFatalBuyerPersistStatus,
  persistBuyerBilling,
} from './buyerBilling';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function response(status: number) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({}),
  });
}

const buyer = {
  name: 'Gurusharan Gupta',
  email: 'buyer@example.test',
  phone: '+919876543210',
  taxId: '29ABCDE1234F1Z5',
};

describe('CommerceV1 buyer persist', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it('treats the live cart-buyer 404 class as non-fatal', () => {
    expect(isNonFatalBuyerPersistStatus(404)).toBe(true);
    expect(isNonFatalBuyerPersistStatus(405)).toBe(true);
    expect(isNonFatalBuyerPersistStatus(501)).toBe(true);
    expect(isNonFatalBuyerPersistStatus(500)).toBe(false);
    expect(formatBuyerPersistWarning(404)).toContain(COMMERCE_V1_BUYER_PATH);
    expect(formatBuyerPersistWarning(404)).toContain('404');
  });

  it('PUTs snake_case tax_id on the CommerceV1 buyer path, not /api/cart/buyer', async () => {
    fetchMock.mockImplementationOnce(() => response(200));
    const result = await persistBuyerBilling('session-1', buyer);
    expect(result).toEqual({ ok: true, persisted: 'remote' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/commerce\/v1\/buyer$/);
    expect(String(url)).not.toContain('/api/cart/buyer');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual(buyerPersistBody(buyer));
    expect(getLocalSession('session-1').buyer?.email).toBe(buyer.email);
  });

  it('keeps local billing when the gateway route 404s and does not wipe values', async () => {
    fetchMock.mockImplementationOnce(() => response(404));
    const result = await persistBuyerBilling('session-404', buyer);
    expect(result.ok).toBe(true);
    expect(result.persisted).toBe('local');
    expect(result.warning).toMatch(/404/);
    expect(getLocalSession('session-404').buyer).toMatchObject({
      name: buyer.name,
      email: buyer.email,
      phone: buyer.phone,
    });
  });

  it('retries a 5xx once and still keeps the local form values', async () => {
    fetchMock
      .mockImplementationOnce(() => response(503))
      .mockImplementationOnce(() => response(503));
    const result = await persistBuyerBilling('session-503', buyer);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.persisted).toBe('local');
    expect(getLocalSession('session-503').buyer?.name).toBe(buyer.name);
  });
});
