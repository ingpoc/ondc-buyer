import { isLoopbackUrl, isLocalBrowserHost, rejectLoopbackOnDeployedHost } from './loopback';

interface CommerceEnv {
  DEV?: boolean;
  VITE_API_BASE_URL?: string;
  VITE_BUYER_COMMERCE_URL?: string;
  VITE_COMMERCE_DEMO_MODE?: string;
}

const LOCAL_COMMERCE_BACKEND_RE = /^https?:\/\/(localhost|127\.0\.0\.1):3001$/i;

export function resolveCommerceConfig(env: CommerceEnv) {
  let rawCommerceApiBase = (
    env.VITE_BUYER_COMMERCE_URL?.trim()
    || env.VITE_API_BASE_URL?.trim()
    || ''
  );
  // Deployed FQDN must never keep a baked loopback commerce base from .env.local.
  if (rawCommerceApiBase && !isLocalBrowserHost() && isLoopbackUrl(rawCommerceApiBase)) {
    rawCommerceApiBase = '';
  } else if (rawCommerceApiBase) {
    rawCommerceApiBase = rejectLoopbackOnDeployedHost(rawCommerceApiBase, '');
  }

  const demoModeOverride = env.VITE_COMMERCE_DEMO_MODE;
  const demoMode = demoModeOverride === 'true' || (
    Boolean(env.DEV)
    && demoModeOverride !== 'false'
    && LOCAL_COMMERCE_BACKEND_RE.test(rawCommerceApiBase)
  );

  return {
    apiBase: demoMode ? '' : rawCommerceApiBase,
    demoMode,
  };
}

const commerceConfig = resolveCommerceConfig(import.meta.env);

export const COMMERCE_DEMO_MODE = commerceConfig.demoMode;
export const COMMERCE_API_BASE = commerceConfig.apiBase;

export const COMMERCE_EXCHANGE_LABEL = COMMERCE_DEMO_MODE
  ? 'Local exchange'
  : 'ONDC network';

export function buildCommerceUrl(endpoint: string): string {
  return COMMERCE_API_BASE ? `${COMMERCE_API_BASE}${endpoint}` : endpoint;
}
