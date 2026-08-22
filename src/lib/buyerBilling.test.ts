import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalSession } from './localCart';
import {
  CART_BUYER_PATH,
  buyerPersistBody,
  cartBuyerUrl,
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
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => ({ success: true, session: { id: 'session-1', buyer: {} } }),
  });
}

const buyer = {
  name: 'Gurusharan Gupta',
  email: 'buyer@example.test',
  phone: '+919876543210',
  taxId: '29ABCDE1234F1Z5',
};

describe('cart-session buyer persist', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it('never builds the collection URL that the gateway 401s', () => {
    expect(cartBuyerUrl('session-1')).toMatch(/\/api\/cart\/buyer\/session-1$/);
    expect(cartBuyerUrl('session-1')).not.toMatch(/\/api\/cart\/buyer$/);
    expect(() => cartBuyerUrl('')).toThrow('No session found');
    expect(cartBuyerUrl('session-1')).not.toContain('/api/commerce/v1/buyer');
  });

  it('treats unexpected persist failures as non-fatal so the form is not wiped', () => {
    expect(isNonFatalBuyerPersistStatus(404)).toBe(true);
    expect(isNonFatalBuyerPersistStatus(401)).toBe(true);
    expect(isNonFatalBuyerPersistStatus(500)).toBe(false);
    expect(formatBuyerPersistWarning(404)).toContain(CART_BUYER_PATH);
  });

  it('PATCHes /api/cart/buyer/{sessionId} with taxId, not CommerceV1 buyer', async () => {
    fetchMock.mockImplementationOnce(() => response(200));
    const result = await persistBuyerBilling('session-1', buyer);
    expect(result).toEqual({ ok: true, persisted: 'remote' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(cartBuyerUrl('session-1'));
    expect(String(url)).toContain('/api/cart/buyer/session-1');
    expect(String(url)).not.toContain('/api/commerce/v1/buyer');
    expect(String(url)).not.toMatch(/\/api\/cart\/buyer$/);
    expect(init.method).toBe('PATCH');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual(buyerPersistBody(buyer));
    expect(JSON.parse(init.body).taxId).toBe(buyer.taxId);
    expect(getLocalSession('session-1').buyer?.email).toBe(buyer.email);
  });

  it('does not fetch the collection URL when session id is missing', async () => {
    await expect(persistBuyerBilling('   ', buyer)).rejects.toThrow('No session found');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps local billing when persist fails and does not wipe values', async () => {
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
