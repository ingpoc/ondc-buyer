// Legacy Netlify-only compatibility adapter. Current Render/Vercel product paths
// execute mutations through gateway AgentGuard. Owner: ondcbuyer/netlify.toml.
// Delete after 2026-08-01 with the remaining Netlify protected redirects.
const PROTECTED_ACTIONS = new Set([
  'high_value_checkout',
  'restricted_category_checkout',
  'refund_request',
  'dispute_creation',
  'payment_method_change',
  'account_recovery',
  'agent_write',
]);

const DEFAULT_TRUST_API_URL = 'https://identity-aadhar-gateway.onrender.com';
const DEFAULT_COMMERCE_API_URL = 'https://buyer-app-preprod-v2.ondc.org';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function trimHeader(headers, name) {
  return headers.get(name)?.trim() || '';
}

export function validateProtectedBuyerHeaders(headers) {
  const action = trimHeader(headers, 'x-buyer-protected-action');
  const walletAddress = trimHeader(headers, 'x-wallet-address');
  const requiredTrustState = trimHeader(headers, 'x-buyer-required-trust-state');
  const enforcement = trimHeader(headers, 'x-buyer-trust-enforcement');
  const auditSubject = trimHeader(headers, 'x-buyer-audit-subject');

  if (!PROTECTED_ACTIONS.has(action)) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Protected buyer action header is missing or unsupported.' },
    };
  }

  if (!walletAddress) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Wallet address is required for protected buyer actions.' },
    };
  }

  if (requiredTrustState !== 'verified' || enforcement !== 'backend_must_revalidate_trust') {
    return {
      ok: false,
      status: 403,
      body: { error: 'Protected buyer action must require backend trust revalidation.' },
    };
  }

  if (!auditSubject) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Audit subject is required for protected buyer actions.' },
    };
  }

  return {
    ok: true,
    action,
    walletAddress,
    auditSubject,
  };
}

export function normalizeTargetPath(rawTarget) {
  if (!rawTarget || rawTarget.includes('://') || rawTarget.startsWith('//')) {
    return null;
  }

  const normalized = rawTarget.startsWith('/') ? rawTarget : `/${rawTarget}`;
  if (!normalized.startsWith('/api/')) {
    return null;
  }

  return normalized;
}

export async function verifyWalletTrust({ walletAddress, trustApiBase, fetchImpl = fetch }) {
  const base = trustApiBase.replace(/\/+$/, '');
  const response = await fetchImpl(`${base}/api/identity/${encodeURIComponent(walletAddress)}/trust`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status === 404 ? 403 : 502,
      body: { error: 'Unable to verify buyer trust state.' },
    };
  }

  const payload = await response.json().catch(() => null);
  const trust = payload?.data;
  if (trust?.trust_state !== 'verified' || trust?.high_trust_eligible !== true) {
    return {
      ok: false,
      status: 403,
      body: { error: 'Verified AadhaarChain trust is required for this buyer action.' },
    };
  }

  return {
    ok: true,
    trust,
  };
}

function buildProxyHeaders(request) {
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  return headers;
}

export async function proxyProtectedBuyerAction({
  request,
  targetPath,
  commerceApiBase,
  fetchImpl = fetch,
}) {
  const targetUrl = `${commerceApiBase.replace(/\/+$/, '')}${targetPath}`;
  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  return fetchImpl(targetUrl, {
    method,
    headers: buildProxyHeaders(request),
    body,
  });
}

export default async function protectedBuyerAction(request) {
  const targetPath = normalizeTargetPath(new URL(request.url).searchParams.get('target'));
  if (!targetPath) {
    return jsonResponse(400, { error: 'Protected buyer target API path is required.' });
  }

  const policy = validateProtectedBuyerHeaders(request.headers);
  if (!policy.ok) {
    return jsonResponse(policy.status, policy.body);
  }

  const trustResult = await verifyWalletTrust({
    walletAddress: policy.walletAddress,
    trustApiBase: process.env.TRUST_API_URL || process.env.VITE_TRUST_API_URL || DEFAULT_TRUST_API_URL,
  });
  if (!trustResult.ok) {
    return jsonResponse(trustResult.status, trustResult.body);
  }

  return proxyProtectedBuyerAction({
    request,
    targetPath,
    commerceApiBase: process.env.BUYER_COMMERCE_API_URL || DEFAULT_COMMERCE_API_URL,
  });
}
