const ACTIVE_PRINCIPAL_KEY = 'ondc-active-principal';

const UNSCOPED_LOCAL_KEYS = [
  'ondc-session-id',
  'ondc-local-cart-session',
  'ondc-local-demo-orders',
  'ondc-local-support-cases',
  'ondc-buyer-agent-ui-state',
];

const UNSCOPED_SESSION_KEYS = [
  'ondc-checkout-outcome',
  'samantha-runtime-handoff:ondc-buyer',
];

export function principalStorageKey(base: string, subjectId: string | null | undefined): string | null {
  const subject = subjectId?.trim();
  if (!subject) return null;
  return `${base}:${encodeURIComponent(subject.slice(0, 160))}`;
}

function clearMatchingLocalPrefixes(prefixes: string[]) {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
      localStorage.removeItem(key);
    }
  }
}

/** Remove data that predates principal namespaces or belongs only to the active browser session. */
export function clearUnscopedBuyerSessionData() {
  if (typeof window === 'undefined') return;
  for (const key of UNSCOPED_LOCAL_KEYS) localStorage.removeItem(key);
  clearMatchingLocalPrefixes(['portfolio-agent-session-id:']);
  for (const key of UNSCOPED_SESSION_KEYS) sessionStorage.removeItem(key);
}

/** Clear unscoped state whenever the authenticated principal changes, including logout. */
export function syncBuyerPrincipalSession(subjectId: string | null | undefined) {
  if (typeof window === 'undefined') return;
  const next = subjectId?.trim() || '';
  const previous = localStorage.getItem(ACTIVE_PRINCIPAL_KEY) || '';
  if (previous !== next || !next) {
    clearUnscopedBuyerSessionData();
  }
  if (next) {
    localStorage.setItem(ACTIVE_PRINCIPAL_KEY, next);
  } else {
    localStorage.removeItem(ACTIVE_PRINCIPAL_KEY);
  }
}
