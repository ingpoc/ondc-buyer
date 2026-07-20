import { describe, expect, it } from 'vitest';

import {
  getHeaderTrustMeta,
  getTrustMeta,
  headerRuntimeIsHealthy,
  headerTrustIsHealthy,
} from './App';

describe('Buyer header disclosure helpers', () => {
  it.each([
    ['no_identity', 'Sign in required', false],
    ['identity_present_unverified', 'Trust unverified', false],
    ['verified', 'Trust verified', true],
    ['manual_review', 'Trust review', false],
    ['revoked_or_blocked', 'Trust blocked', false],
  ] as const)('maps %s to label and healthy=%s', (state, label, healthy) => {
    const meta = getTrustMeta(state);
    expect(meta.label).toBe(label);
    expect(headerTrustIsHealthy(meta.label)).toBe(healthy);
  });

  it('treats session principals as verified even when wallet trust is no_identity', () => {
    const meta = getHeaderTrustMeta('no_identity', false, 'principal:auth0:google-oauth2:fixture');
    expect(meta.label).toBe('Trust verified');
    expect(headerTrustIsHealthy(meta.label)).toBe(true);
  });

  it('treats Ready as healthy assistant status', () => {
    expect(headerRuntimeIsHealthy('Ready')).toBe(true);
    expect(headerRuntimeIsHealthy('Unavailable')).toBe(false);
    expect(headerRuntimeIsHealthy('Checking')).toBe(false);
  });

  it('exposes loading trust copy without marking it healthy', () => {
    const meta = getTrustMeta('verified', true);
    expect(meta.label).toBe('Trust loading');
    expect(headerTrustIsHealthy(meta.label)).toBe(false);
  });
});
