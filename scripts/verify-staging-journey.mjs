#!/usr/bin/env node

const DEFAULT_COMMERCE_API_BASE = 'https://buyer-app-preprod-v2.ondc.org';

export const STAGING_JOURNEY_ENDPOINTS = [
  {
    id: 'search',
    method: 'GET',
    path: '/api/search?category=grocery&q=rice',
  },
  {
    id: 'cart',
    method: 'GET',
    path: '/api/cart?sessionId=staging-verifier',
  },
  {
    id: 'orders',
    method: 'GET',
    path: '/api/orders?sessionId=staging-verifier',
  },
];

export function resolveCommerceApiBase(env = process.env) {
  return (
    env.BUYER_COMMERCE_API_URL ||
    env.VITE_BUYER_COMMERCE_URL ||
    env.VITE_API_BASE_URL ||
    DEFAULT_COMMERCE_API_BASE
  ).replace(/\/+$/, '');
}

export function isJsonContentType(contentType) {
  return typeof contentType === 'string' && /\bapplication\/json\b/i.test(contentType);
}

export async function probeJourneyEndpoint({ baseUrl, endpoint, fetchImpl = fetch }) {
  let response;
  try {
    response = await fetchImpl(`${baseUrl}${endpoint.path}`, {
      method: endpoint.method,
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown network error';
    return {
      id: endpoint.id,
      path: endpoint.path,
      status: 0,
      contentType: '',
      ok: false,
      reason: `Unable to reach staging commerce API for ${endpoint.id}: ${message}.`,
    };
  }

  const contentType = response.headers.get('content-type') || '';
  const ok = response.ok && isJsonContentType(contentType);

  return {
    id: endpoint.id,
    path: endpoint.path,
    status: response.status,
    contentType,
    ok,
    reason: ok
      ? null
      : `Expected a 2xx JSON commerce API response for ${endpoint.id}; received ${response.status} ${contentType || 'unknown content-type'}.`,
  };
}

export async function verifyStagingJourney({ env = process.env, fetchImpl = fetch } = {}) {
  const baseUrl = resolveCommerceApiBase(env);
  const checks = await Promise.all(
    STAGING_JOURNEY_ENDPOINTS.map((endpoint) =>
      probeJourneyEndpoint({
        baseUrl,
        endpoint,
        fetchImpl,
      }),
    ),
  );

  return {
    baseUrl,
    ok: checks.every((check) => check.ok),
    checks,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await verifyStagingJourney();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}
