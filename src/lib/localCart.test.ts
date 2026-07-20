import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addLocalItem,
  getLocalSession,
  LOCAL_CART_CHANGED_EVENT,
  removeLocalItem,
  updateLocalBuyer,
  updateLocalDeliveryAddress,
} from './localCart';

describe('local cart synchronization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('broadcasts the session id after each cart mutation', () => {
    const listener = vi.fn();
    window.addEventListener(LOCAL_CART_CHANGED_EVENT, listener);
    const sessionId = 'shared-cart';
    expect(getLocalSession(sessionId).items).toEqual([]);
    addLocalItem(
      sessionId,
      {
        id: 'atta-1',
        name: 'Whole Wheat Atta 1kg',
        price: { currency: 'INR', value: '89.00' },
        images: [],
      },
      1,
    );
    removeLocalItem(sessionId, 'atta-1');

    expect(listener).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(listener).mock.calls.map(([event]) =>
        (event as CustomEvent<{ sessionId: string }>).detail.sessionId
      ),
    ).toEqual([sessionId, sessionId]);
    expect(getLocalSession(sessionId).items).toEqual([]);
    window.removeEventListener(LOCAL_CART_CHANGED_EVENT, listener);
  });

  it('preserves an in-progress delivery PIN across billing refreshes', () => {
    const sessionId = 'checkout-address';
    getLocalSession(sessionId);
    updateLocalDeliveryAddress(sessionId, {
      line1: '12 Market Road',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      country: 'IND',
    });
    updateLocalBuyer(sessionId, {
      name: 'Asha Rao',
      email: 'asha@example.com',
      phone: '+919876543210',
      taxId: '29ABCDE1234F1Z5',
    });

    expect(getLocalSession(sessionId).buyer).toMatchObject({
      street: '12 Market Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      country: 'IND',
      name: 'Asha Rao',
      taxId: '29ABCDE1234F1Z5',
    });
  });
});
