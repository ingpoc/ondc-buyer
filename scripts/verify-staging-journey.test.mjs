import { describe, expect, it, vi } from 'vitest';
import {
  isJsonContentType,
  probeJourneyEndpoint,
  resolveCommerceApiBase,
  verifyStagingJourney,
} from './verify-staging-journey.mjs';

describe('verify-staging-journey', () => {
  it('resolves the commerce API base from the deployment env contract', () => {
    expect(resolveCommerceApiBase({ BUYER_COMMERCE_API_URL: 'https://commerce.example.test/' })).toBe(
      'https://commerce.example.test',
    );
    expect(resolveCommerceApiBase({ VITE_BUYER_COMMERCE_URL: 'https://vite-commerce.example.test/' })).toBe(
      'https://vite-commerce.example.test',
    );
    expect(resolveCommerceApiBase({ VITE_API_BASE_URL: 'https://legacy-commerce.example.test/' })).toBe(
      'https://legacy-commerce.example.test',
    );
  });

  it('accepts JSON content types only', () => {
    expect(isJsonContentType('application/json')).toBe(true);
    expect(isJsonContentType('application/json; charset=utf-8')).toBe(true);
    expect(isJsonContentType('text/html')).toBe(false);
  });

  it('marks static HTML responses as staging blockers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('<html></html>', {
        status: 200,
        headers: {
          'content-type': 'text/html',
        },
      }),
    );

    await expect(
      probeJourneyEndpoint({
        baseUrl: 'https://commerce.example.test',
        endpoint: {
          id: 'search',
          method: 'GET',
          path: '/api/search?q=rice',
        },
        fetchImpl,
      }),
    ).resolves.toEqual({
      id: 'search',
      path: '/api/search?q=rice',
      status: 200,
      contentType: 'text/html',
      ok: false,
      reason:
        'Expected a 2xx JSON commerce API response for search; received 200 text/html.',
    });
  });

  it('passes only when every core read endpoint returns JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    );

    const result = await verifyStagingJourney({
      env: {
        BUYER_COMMERCE_API_URL: 'https://commerce.example.test',
      },
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.checks).toHaveLength(3);
  });

  it('reports network failures as staging blockers', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND commerce.example.test'));

    await expect(
      probeJourneyEndpoint({
        baseUrl: 'https://commerce.example.test',
        endpoint: {
          id: 'orders',
          method: 'GET',
          path: '/api/orders',
        },
        fetchImpl,
      }),
    ).resolves.toEqual({
      id: 'orders',
      path: '/api/orders',
      status: 0,
      contentType: '',
      ok: false,
      reason:
        'Unable to reach staging commerce API for orders: getaddrinfo ENOTFOUND commerce.example.test.',
    });
  });
});
