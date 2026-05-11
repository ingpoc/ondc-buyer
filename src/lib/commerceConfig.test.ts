import { describe, expect, it } from 'vitest';
import { resolveCommerceConfig } from './commerceConfig';

describe('commerce config', () => {
  it('prefers the documented buyer commerce URL over the legacy API base URL', () => {
    expect(resolveCommerceConfig({
      DEV: false,
      VITE_BUYER_COMMERCE_URL: 'https://buyer.example.com ',
      VITE_API_BASE_URL: 'https://legacy.example.com',
    })).toEqual({
      apiBase: 'https://buyer.example.com',
      demoMode: false,
    });
  });

  it('keeps legacy VITE_API_BASE_URL as a fallback', () => {
    expect(resolveCommerceConfig({
      DEV: false,
      VITE_API_BASE_URL: 'https://legacy.example.com',
    })).toEqual({
      apiBase: 'https://legacy.example.com',
      demoMode: false,
    });
  });

  it('requires explicit demo mode outside the local dev backend pattern', () => {
    expect(resolveCommerceConfig({
      DEV: false,
      VITE_BUYER_COMMERCE_URL: '',
    })).toEqual({
      apiBase: '',
      demoMode: false,
    });

    expect(resolveCommerceConfig({
      DEV: false,
      VITE_COMMERCE_DEMO_MODE: 'true',
    })).toEqual({
      apiBase: '',
      demoMode: true,
    });
  });

  it('treats the known local commerce backend as demo mode during dev only', () => {
    expect(resolveCommerceConfig({
      DEV: true,
      VITE_API_BASE_URL: 'http://localhost:3001',
    })).toEqual({
      apiBase: '',
      demoMode: true,
    });

    expect(resolveCommerceConfig({
      DEV: true,
      VITE_API_BASE_URL: 'http://localhost:3001',
      VITE_COMMERCE_DEMO_MODE: 'false',
    })).toEqual({
      apiBase: 'http://localhost:3001',
      demoMode: false,
    });
  });
});
