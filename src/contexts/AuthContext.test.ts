import { describe, expect, it } from 'vitest';
import type { SSOUser } from '@/lib/api';
import { matchesAudience } from './AuthContext';

describe('matchesAudience', () => {
  it('keeps a shared Auth0 session usable after Seller', () => {
    expect(matchesAudience({ audience: 'ondcseller', identity_provider: 'auth0' } as SSOUser)).toBe(
      true
    );
    expect(matchesAudience({ audience: 'ondcseller', identity_provider: 'demo' } as SSOUser)).toBe(
      false
    );
    expect(matchesAudience({ audience: 'aadharchain', identity_provider: 'auth0' } as SSOUser)).toBe(
      false
    );
  });
});
