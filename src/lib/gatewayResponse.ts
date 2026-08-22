/** True when a same-origin /api call fell through to the Vite SPA shell. */
export function isSpaHtmlResponse(response: { headers?: { get?: (name: string) => string | null } }): boolean {
  const type = response.headers?.get?.('content-type') || '';
  return /text\/html/i.test(type);
}

export function throwIfSpaHtml(response: Response, fallback: string): void {
  if (!isSpaHtmlResponse(response)) return;
  throw new Error(
    `${fallback}: ${response.url || 'this API'} returned HTML instead of JSON. /api must be rewritten to the gateway.`,
  );
}
