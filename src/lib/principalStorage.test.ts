import { beforeEach, describe, expect, it } from 'vitest';
import {
  principalStorageKey,
  shouldClearUnscopedBuyerData,
  syncBuyerPrincipalSession,
} from './principalStorage';

describe('buyer principal storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('builds distinct keys and refuses a guest namespace', () => {
    expect(principalStorageKey('orders', null)).toBeNull();
    expect(principalStorageKey('orders', 'principal:auth0:a')).not.toBe(
      principalStorageKey('orders', 'principal:auth0:b'),
    );
  });

  it('clears unscoped private state on principal change and logout', () => {
    syncBuyerPrincipalSession('principal:auth0:a');
    localStorage.setItem('ondc-session-id', 'session-a');
    localStorage.setItem('ondc-local-cart-session', '{"private":true}');
    localStorage.setItem('ondc-buyer-agent-ui-state', '{"messages":[]}');
    localStorage.setItem('portfolio-agent-session-id:https://gateway/agent', 'agent-a');
    sessionStorage.setItem('ondc-checkout-outcome', '{"orderId":"a"}');

    syncBuyerPrincipalSession('principal:auth0:b');

    expect(localStorage.getItem('ondc-session-id')).toBeNull();
    expect(localStorage.getItem('ondc-local-cart-session')).toBeNull();
    expect(localStorage.getItem('ondc-buyer-agent-ui-state')).toBeNull();
    expect(localStorage.getItem('portfolio-agent-session-id:https://gateway/agent')).toBeNull();
    expect(sessionStorage.getItem('ondc-checkout-outcome')).toBeNull();

    localStorage.setItem('ondc-session-id', 'session-b');
    syncBuyerPrincipalSession(null);
    expect(localStorage.getItem('ondc-session-id')).toBeNull();
    expect(localStorage.getItem('ondc-active-principal')).toBeNull();
  });

  it('does not treat guest or other-app revalidation as a principal change', () => {
    expect(shouldClearUnscopedBuyerData('', '')).toBe(false);
    expect(shouldClearUnscopedBuyerData('', 'principal:auth0:buyer')).toBe(false);
    expect(shouldClearUnscopedBuyerData('principal:auth0:a', '')).toBe(true);
    expect(shouldClearUnscopedBuyerData('principal:auth0:a', 'principal:auth0:b')).toBe(true);
  });

  it('keeps a guest cart across signed-out and other-app auth rechecks', () => {
    localStorage.setItem('ondc-session-id', 'session-guest');
    localStorage.setItem(
      'ondc-local-cart-session',
      JSON.stringify({
        'session-guest': { items: [{ item: { id: 'atta-1', name: 'CF2 Browser Lifecycle Atta' } }] },
      }),
    );
    localStorage.setItem('ondc-local-cart-active', '1');

    syncBuyerPrincipalSession(null);
    syncBuyerPrincipalSession(null);

    expect(localStorage.getItem('ondc-session-id')).toBe('session-guest');
    expect(localStorage.getItem('ondc-local-cart-session')).toContain('atta-1');
    expect(localStorage.getItem('ondc-local-cart-active')).toBe('1');
  });

  it('merges the guest cart onto the first Buyer sign-in instead of wiping it', () => {
    localStorage.setItem('ondc-session-id', 'session-guest');
    localStorage.setItem(
      'ondc-local-cart-session',
      JSON.stringify({
        'session-guest': { items: [{ item: { id: 'atta-1' } }] },
      }),
    );

    syncBuyerPrincipalSession(null);
    syncBuyerPrincipalSession('principal:auth0:buyer');

    expect(localStorage.getItem('ondc-session-id')).toBe('session-guest');
    expect(localStorage.getItem('ondc-local-cart-session')).toContain('atta-1');
    expect(localStorage.getItem('ondc-active-principal')).toBe('principal:auth0:buyer');
  });
});
