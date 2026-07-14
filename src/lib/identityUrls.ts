import {
  isLocalBrowserHost,
  normalizeLoopbackUrl,
  rejectLoopbackOnDeployedHost,
} from './loopback';

const LOCAL_IDENTITY_API_URL = 'http://127.0.0.1:43101';
const LOCAL_IDENTITY_WEB_URL = 'http://127.0.0.1:43100';
const DEPLOYED_IDENTITY_API_URL = 'https://gateway.aadharcha.in';
const DEPLOYED_IDENTITY_WEB_URL = 'https://gateway.aadharcha.in';

function resolveConfiguredUrl(configured: string | undefined, fallback: string) {
  const raw = rejectLoopbackOnDeployedHost(configured?.trim() || '', fallback);
  return normalizeLoopbackUrl(raw || fallback).replace(/\/+$/, '');
}

function configuredAadhaarApiUrl() {
  return import.meta.env.VITE_AADHAAR_API_URL || import.meta.env.VITE_IDENTITY_URL;
}

export function resolveIdentityApiUrl() {
  return resolveConfiguredUrl(
    configuredAadhaarApiUrl(),
    isLocalBrowserHost() ? LOCAL_IDENTITY_API_URL : DEPLOYED_IDENTITY_API_URL,
  );
}

export function resolveIdentityWebUrl() {
  return resolveConfiguredUrl(
    import.meta.env.VITE_IDENTITY_WEB_URL,
    isLocalBrowserHost() ? LOCAL_IDENTITY_WEB_URL : DEPLOYED_IDENTITY_WEB_URL,
  );
}

export function resolveTrustApiUrl() {
  return resolveConfiguredUrl(
    import.meta.env.VITE_TRUST_API_URL || configuredAadhaarApiUrl(),
    isLocalBrowserHost() ? LOCAL_IDENTITY_API_URL : DEPLOYED_IDENTITY_API_URL,
  );
}

export const IDENTITY_URL = resolveIdentityApiUrl();
export const IDENTITY_WEB_URL = resolveIdentityWebUrl();
export const TRUST_API_URL = resolveTrustApiUrl();
