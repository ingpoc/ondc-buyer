import { describe, expect, it, vi } from 'vitest';
import {
  normalizeTargetPath,
  validateProtectedBuyerHeaders,
  verifyWalletTrust,
} from './protected-buyer-action.mjs';

function protectedHeaders(overrides = {}) {
  return new Headers({
    'x-buyer-protected-action': 'high_value_checkout',
    'x-wallet-address': 'wallet-1',
    'x-buyer-required-trust-state': 'verified',
    'x-buyer-trust-enforcement': 'backend_must_revalidate_trust',
    'x-buyer-audit-subject': 'session-1',
    ...overrides,
  });
}

describe('protected buyer action function', () => {
  it('accepts complete protected buyer action headers', () => {
    expect(validateProtectedBuyerHeaders(protectedHeaders())).toEqual({
      ok: true,
      action: 'high_value_checkout',
      walletAddress: 'wallet-1',
      auditSubject: 'session-1',
    });
  });

  it('rejects missing wallet and unsupported actions before proxying', () => {
    expect(validateProtectedBuyerHeaders(protectedHeaders({ 'x-wallet-address': '' }))).toEqual({
      ok: false,
      status: 401,
      body: { error: 'Wallet address is required for protected buyer actions.' },
    });

    expect(validateProtectedBuyerHeaders(protectedHeaders({ 'x-buyer-protected-action': 'read_only' }))).toEqual({
      ok: false,
      status: 400,
      body: { error: 'Protected buyer action header is missing or unsupported.' },
    });
  });

  it('allows only local API target paths', () => {
    expect(normalizeTargetPath('/api/checkout')).toBe('/api/checkout');
    expect(normalizeTargetPath('api/orders/order-1/cancel')).toBe('/api/orders/order-1/cancel');
    expect(normalizeTargetPath('https://example.test/api/checkout')).toBeNull();
    expect(normalizeTargetPath('//example.test/api/checkout')).toBeNull();
    expect(normalizeTargetPath('/checkout')).toBeNull();
  });

  it('requires verified AadhaarChain trust before allowing proxy execution', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            trust_state: 'verified',
            high_trust_eligible: true,
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      verifyWalletTrust({
        walletAddress: 'wallet-1',
        trustApiBase: 'https://identity.example.test/',
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: true,
      trust: {
        trust_state: 'verified',
        high_trust_eligible: true,
      },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://identity.example.test/api/identity/wallet-1/trust',
      { headers: { Accept: 'application/json' } },
    );
  });

  it('blocks unverified trust states server-side', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            trust_state: 'manual_review',
            high_trust_eligible: false,
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      verifyWalletTrust({
        walletAddress: 'wallet-1',
        trustApiBase: 'https://identity.example.test',
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: false,
      status: 403,
      body: { error: 'Verified AadhaarChain trust is required for this buyer action.' },
    });
  });
});
