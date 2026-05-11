import { beforeEach, describe, expect, it } from 'vitest';
import type { PortfolioTrustState } from './trust';
import { canExecuteProtectedBuyerAction } from './buyerActionPolicy';
import { createVerifiedDemoOrder, cancelVerifiedDemoOrder } from './localOrders';
import { createVerifiedLocalSupportCase, listSupportCases } from './localSupportCases';
import type { UCPAddress, UCPQuote, UCPSession } from '../types';

const trustStates: PortfolioTrustState[] = [
  'no_identity',
  'identity_present_unverified',
  'verified',
  'manual_review',
  'revoked_or_blocked',
];

const session: UCPSession = {
  id: 'session-1',
  items: [
    {
      id: 'line-1',
      quantity: 1,
      item: {
        id: 'demo-item',
        name: 'Demo item',
        descriptor: { name: 'Demo item' },
        price: { currency: 'INR', value: '100.00' },
      },
    },
  ],
  buyer: {
    name: 'Buyer',
    email: 'buyer@example.test',
    contact: { email: 'buyer@example.test' },
  },
} as UCPSession;

const quote: UCPQuote = {
  price: { currency: 'INR', value: '100.00' },
  total: { currency: 'INR', value: '100.00' },
  subtotal: { currency: 'INR', value: '100.00' },
  breakup: [],
};

const deliveryAddress: UCPAddress = {
  line1: '1 Test Street',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
  country: 'IND',
};

describe('buyer protected action policy', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('ondc-session-id', 'session-1');
  });

  it('allows protected buyer actions only for verified trust', () => {
    expect(Object.fromEntries(trustStates.map((state) => [state, canExecuteProtectedBuyerAction(state)]))).toEqual({
      no_identity: false,
      identity_present_unverified: false,
      verified: true,
      manual_review: false,
      revoked_or_blocked: false,
    });
  });

  it('blocks local checkout order creation unless buyer trust is verified', () => {
    expect(() =>
      createVerifiedDemoOrder('session-1', session, quote, deliveryAddress, 'manual_review'),
    ).toThrow('Verified buyer trust is required before checkout');

    const order = createVerifiedDemoOrder('session-1', session, quote, deliveryAddress, 'verified');
    expect(order.status).toBe('created');
  });

  it('blocks local cancellation and support case writes unless buyer trust is verified', () => {
    const order = createVerifiedDemoOrder('session-1', session, quote, deliveryAddress, 'verified');

    expect(() => cancelVerifiedDemoOrder(order.id, 'revoked_or_blocked')).toThrow(
      'Verified buyer trust is required before checkout',
    );
    expect(() =>
      createVerifiedLocalSupportCase(
        {
          order_id: order.id,
          issue_type: 'payment',
          description: 'Payment refund dispute',
          evidence_links: [],
        },
        'no_identity',
      ),
    ).toThrow('Verified buyer trust is required before checkout');

    const supportCase = createVerifiedLocalSupportCase(
      {
        order_id: order.id,
        issue_type: 'payment',
        description: 'Payment refund dispute',
        evidence_links: [],
      },
      'verified',
    );

    expect(cancelVerifiedDemoOrder(order.id, 'verified')?.status).toBe('cancelled');
    expect(listSupportCases(order.id)[0]?.case_id).toBe(supportCase.case_id);
  });
});
