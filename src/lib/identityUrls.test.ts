import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveIdentityApiUrl, resolveTrustApiUrl } from './identityUrls';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('identity URL resolution', () => {
  it('uses VITE_AADHAAR_API_URL for both identity and trust endpoints by default', () => {
    vi.stubEnv('VITE_AADHAAR_API_URL', 'http://localhost:43101/');

    expect(resolveIdentityApiUrl()).toBe('http://127.0.0.1:43101');
    expect(resolveTrustApiUrl()).toBe('http://127.0.0.1:43101');
  });

  it('allows a dedicated trust URL override when needed', () => {
    vi.stubEnv('VITE_AADHAAR_API_URL', 'http://localhost:43101');
    vi.stubEnv('VITE_TRUST_API_URL', 'http://localhost:43109');

    expect(resolveIdentityApiUrl()).toBe('http://127.0.0.1:43101');
    expect(resolveTrustApiUrl()).toBe('http://127.0.0.1:43109');
  });
});
