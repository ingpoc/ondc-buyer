/**
 * Local cart is the browser session store when:
 * - commerce demo mode is on, or
 * - there is no usable remote cart host (gateway and Vite apps do not expose /api/cart).
 * Do not invent mock grocery catalog items — only hold items the user/network search added.
 */

const NON_CART_HOST_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:(3001|43102|43103))?\/?$/i;

/** True when apiBase is empty or points at a host that is not a cart backend. */
export function isNonCartCommerceHost(commerceApiBase = ''): boolean {
  const base = commerceApiBase.trim();
  if (!base) return true;
  return NON_CART_HOST_RE.test(base);
}

export function shouldUseLocalCartFallback(
  commerceDemoMode: boolean,
  commerceApiBase = '',
): boolean {
  return commerceDemoMode || isNonCartCommerceHost(commerceApiBase);
}

export function formatCartApiError(error: unknown, action: string): string {
  const detail = error instanceof Error ? error.message : 'Unknown error';
  return `${action} failed against the commerce API: ${detail}`;
}

/** Remote cart missing (404) or unauthorized → use local session store; other errors stay hard failures. */
export function shouldFallbackLocalOnCartError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /Request failed: (401|403|404)\b|Failed to fetch|NetworkError/i.test(message);
}

export function remoteCartContainsItem(
  session: { items?: Array<{ item?: { id?: string } }> } | null | undefined,
  itemId: string,
): boolean {
  return Boolean(session?.items?.some((entry) => entry.item?.id === itemId));
}

export function cartAddNotice(params: { title: string; authenticated: boolean }): string {
  const added = `${params.title} added to cart.`;
  return params.authenticated ? added : `${added} Sign in to check out.`;
}

export function cartAddBlockedNotice(): string {
  return 'Sign in to add items and check out.';
}

/** Success copy is allowed only when the cart store that /cart reads actually holds the item. */
export function cartAddOutcomeNotice(params: {
  title: string;
  authenticated: boolean;
  persisted: boolean;
}): string {
  if (!params.persisted) {
    return params.authenticated
      ? 'Unable to add this item. Please try again.'
      : cartAddBlockedNotice();
  }
  return cartAddNotice({ title: params.title, authenticated: params.authenticated });
}
