export function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function isLoopbackUrl(url: string): boolean {
  try {
    return isLoopbackHostname(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function isLocalBrowserHost(): boolean {
  if (typeof window === 'undefined') {
    return Boolean(import.meta.env.DEV);
  }
  return isLoopbackHostname(window.location.hostname);
}

/** Never call loopback APIs from a deployed FQDN host (guards against baked .env.local). */
export function rejectLoopbackOnDeployedHost(url: string, fallback: string): string {
  const trimmed = url.trim();
  if (!trimmed) return fallback;
  if (!isLocalBrowserHost() && isLoopbackUrl(trimmed)) {
    return fallback;
  }
  return trimmed;
}

export function normalizeLoopbackUrl(url: string): string {
  if (!import.meta.env.DEV) {
    return url;
  }

  return url.replace('://localhost:', '://127.0.0.1:');
}

/**
 * Auth0 session cookie is host-only on gateway `127.0.0.1:43101`.
 * `localhost` and `127.0.0.1` are different sites — Lax cookies will not
 * attach on cross-site `/api/auth/me`. Canonicalize the SPA host in DEV.
 * Returns true when a redirect was started (caller must not render).
 */
export function ensureCanonicalLoopbackHost(): boolean {
  if (typeof window === 'undefined' || !import.meta.env.DEV) {
    return false;
  }
  const { hostname, protocol, port, pathname, search, hash } = window.location;
  if (hostname !== 'localhost' && hostname !== '[::1]') {
    return false;
  }
  const portSuffix = port ? `:${port}` : '';
  window.location.replace(
    `${protocol}//127.0.0.1${portSuffix}${pathname}${search}${hash}`,
  );
  return true;
}
