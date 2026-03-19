import { describe, expect, it } from 'vitest';
import {
  applyBuyerAgentEnvelope,
  buildBuyerAgentSnapshot,
  extractBuyerAgentEnvelope,
} from './agentBuyerState';
import type { UCPItem, UCPSession } from '../types';

const MUSTARD_OIL: UCPItem = {
  id: 'mustard-oil-1l',
  name: 'Cold Pressed Mustard Oil 1L',
  description: 'Kitchen staple used for buyer validation.',
  descriptor: {
    name: 'Cold Pressed Mustard Oil 1L',
    short_desc: 'Quick-add pantry item.',
  },
  price: {
    currency: 'INR',
    value: '285.00',
  },
  category: 'grocery',
  _provider: 'Verified Pantry Co.',
  images: [],
};

const CART_SESSION: UCPSession = {
  id: 'session-test',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  items: [],
  buyer: {
    name: 'Test Buyer',
    email: 'buyer@example.com',
    phone: '+91-9876543210',
    contact: {
      email: 'buyer@example.com',
      phone: '+91-9876543210',
    },
    country: 'IND',
  },
};

describe('agentBuyerState', () => {
  it('extracts a buyer envelope from json content', () => {
    const envelope = extractBuyerAgentEnvelope(
      JSON.stringify({
        summary: 'Recommended Cold Pressed Mustard Oil 1L and queued cart/checkout actions.',
        actions: [
          { type: 'recommend_item', item_id: 'mustard-oil-1l', reason: 'Best pantry match.' },
          { type: 'cart_add', item_id: 'mustard-oil-1l', quantity: 1, reason: 'Ready for checkout.' },
          { type: 'navigate', path: '/checkout', reason: 'Trust verified, proceed to checkout.' },
        ],
      }),
    );

    expect(envelope?.actions).toHaveLength(3);
    expect(envelope?.actions[1]).toMatchObject({ type: 'cart_add', item_id: 'mustard-oil-1l' });
  });

  it('blocks checkout navigation when trust is not verified', () => {
    const snapshot = buildBuyerAgentSnapshot(
      { path: '/agent', search: '' },
      'identity_present_unverified',
      CART_SESSION,
      [MUSTARD_OIL],
      [],
    );

    const result = applyBuyerAgentEnvelope(
      {
        summary: 'I can recommend the item but checkout remains trust-gated.',
        actions: [
          { type: 'cart_add', item_id: 'mustard-oil-1l', quantity: 1, reason: 'Save it for later.' },
          { type: 'navigate', path: '/checkout', reason: 'Try checkout.' },
        ],
      },
      snapshot,
      'identity_present_unverified',
    );

    expect(result.itemsToAdd).toHaveLength(1);
    expect(result.navigateTo).toBeNull();
    expect(result.trustBlockReason).toContain('verified');
  });

  it('allows checkout navigation when trust is verified', () => {
    const snapshot = buildBuyerAgentSnapshot(
      { path: '/agent', search: '' },
      'verified',
      CART_SESSION,
      [MUSTARD_OIL],
      [],
    );

    const result = applyBuyerAgentEnvelope(
      {
        summary: 'Item added and checkout unlocked.',
        actions: [
          { type: 'cart_add', item_id: 'mustard-oil-1l', quantity: 1, reason: 'Ready for checkout.' },
          { type: 'navigate', path: '/checkout', reason: 'Proceed to checkout.' },
        ],
      },
      snapshot,
      'verified',
    );

    expect(result.itemsToAdd).toHaveLength(1);
    expect(result.navigateTo).toBe('/checkout');
    expect(result.trustBlockReason).toBeNull();
  });
});
