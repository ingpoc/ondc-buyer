import { beforeEach, describe, expect, it } from 'vitest';
import {
  principalStorageKey,
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
});
