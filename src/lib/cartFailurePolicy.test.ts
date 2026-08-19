import { describe, expect, it } from 'vitest';
import {
  formatCartApiError,
  cartAddNotice,
  shouldFallbackLocalOnCartError,
  shouldUseLocalCartFallback,
} from './cartFailurePolicy';

describe('cart failure policy', () => {
  it('uses local cart in demo mode or when no remote commerce API base is configured', () => {
    expect(shouldUseLocalCartFallback(true)).toBe(true);
    expect(shouldUseLocalCartFallback(false)).toBe(true);
    expect(shouldUseLocalCartFallback(false, '')).toBe(true);
    expect(shouldUseLocalCartFallback(false, 'https://gateway.aadharcha.in')).toBe(false);
  });

  it('treats legacy :3001 and local Vite buyer/seller origins as non-cart hosts', () => {
    expect(shouldUseLocalCartFallback(false, 'http://localhost:3001')).toBe(true);
    expect(shouldUseLocalCartFallback(false, 'http://127.0.0.1:3001')).toBe(true);
    expect(shouldUseLocalCartFallback(false, 'http://127.0.0.1:43102')).toBe(true);
    expect(shouldUseLocalCartFallback(false, 'http://127.0.0.1:43103')).toBe(true);
  });

  it('falls back to local cart on missing remote cart host errors', () => {
    expect(shouldFallbackLocalOnCartError(new Error('Request failed: 404'))).toBe(true);
    expect(shouldFallbackLocalOnCartError(new Error('Request failed: 401'))).toBe(true);
    expect(shouldFallbackLocalOnCartError(new Error('Request failed: 403'))).toBe(true);
    expect(shouldFallbackLocalOnCartError(new Error('Failed to fetch'))).toBe(true);
    expect(shouldFallbackLocalOnCartError(new Error('Request failed: 503'))).toBe(false);
  });

  it('tells guests that checkout needs sign-in after a successful add', () => {
    expect(cartAddNotice({ title: 'Atta 1kg', authenticated: true })).toBe('Atta 1kg added to cart.');
    expect(cartAddNotice({ title: 'Atta 1kg', authenticated: false })).toBe(
      'Atta 1kg added to cart. Sign in to check out.',
    );
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
