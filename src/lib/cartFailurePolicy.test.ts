import { describe, expect, it } from 'vitest';
import { formatCartApiError, shouldUseLocalCartFallback } from './cartFailurePolicy';

describe('cart failure policy', () => {
  it('allows local cart fallback only in explicit commerce demo mode', () => {
    expect(shouldUseLocalCartFallback(true)).toBe(true);
    expect(shouldUseLocalCartFallback(false)).toBe(false);
  });

  it('formats live commerce API errors for user-facing cart flows', () => {
    expect(formatCartApiError(new Error('Request failed: 503'), 'Refresh cart')).toBe(
      'Refresh cart failed against the commerce API: Request failed: 503',
    );
    expect(formatCartApiError('bad response', 'Update cart')).toBe(
      'Update cart failed against the commerce API: Unknown error',
    );
  });
});
