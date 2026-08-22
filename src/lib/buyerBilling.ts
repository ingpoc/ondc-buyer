import { buildCommerceUrl } from './commerceConfig';
import { throwIfSpaHtml } from './gatewayResponse';
import { updateLocalBuyer } from './localCart';

/**
 * Live Buyer persist contract from aadhaar-chain#15.
 *
 * GET/PUT/PATCH `/api/cart/buyer/{sessionId}` → 200 draft/upsert, never 404
 * GET/PUT/PATCH `/api/cart/buyer` → 401 JSON if session id is missing
 *
 * Do not call `/api/commerce/v1/buyer` — CommerceV1 has no buyer profile.
 * Same-origin FQDN `/api/*` is rewritten to gateway.aadharcha.in (vercel.json).
 */
export const CART_BUYER_PATH = '/api/cart/buyer';

export interface BuyerBilling {
  name: string;
  email: string;
  phone: string;
  taxId?: string;
}

export interface PersistBuyerBillingResult {
  ok: true;
  persisted: 'local' | 'remote';
  warning?: string;
}

const NON_FATAL_STATUS = new Set([401, 403, 404, 405, 501]);

export function isNonFatalBuyerPersistStatus(status: number): boolean {
  return NON_FATAL_STATUS.has(status);
}

export function cartBuyerUrl(sessionId: string): string {
  const id = sessionId.trim();
  if (!id) {
    throw new Error('No session found');
  }
  return buildCommerceUrl(`${CART_BUYER_PATH}/${encodeURIComponent(id)}`);
}

export function buyerPersistBody(buyer: BuyerBilling): Record<string, string> {
  const body: Record<string, string> = {
    name: buyer.name.trim(),
    email: buyer.email.trim(),
    phone: buyer.phone.trim(),
  };
  const taxId = buyer.taxId?.trim();
  if (taxId) body.taxId = taxId;
  return body;
}

export function formatBuyerPersistWarning(status: number): string {
  return `Billing saved on this device. Gateway ${CART_BUYER_PATH}/{sessionId} returned ${status}.`;
}

async function patchCartBuyer(
  sessionId: string,
  buyer: BuyerBilling,
): Promise<{ ok: boolean; status: number }> {
  const response = await fetch(cartBuyerUrl(sessionId), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buyerPersistBody(buyer)),
  });
  throwIfSpaHtml(response, 'Billing persist');
  return { ok: response.ok, status: response.status };
}

export async function persistBuyerBilling(
  sessionId: string,
  buyer: BuyerBilling,
): Promise<PersistBuyerBillingResult> {
  if (!sessionId.trim()) {
    throw new Error('No session found');
  }

  updateLocalBuyer(sessionId, buyer);

  try {
    const first = await patchCartBuyer(sessionId, buyer);
    if (first.ok) return { ok: true, persisted: 'remote' };
    if (isNonFatalBuyerPersistStatus(first.status)) {
      return { ok: true, persisted: 'local', warning: formatBuyerPersistWarning(first.status) };
    }
    if (first.status >= 500) {
      const retry = await patchCartBuyer(sessionId, buyer);
      if (retry.ok) return { ok: true, persisted: 'remote' };
      return {
        ok: true,
        persisted: 'local',
        warning: formatBuyerPersistWarning(retry.status),
      };
    }
    return { ok: true, persisted: 'local', warning: formatBuyerPersistWarning(first.status) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Billing save failed.';
    return { ok: true, persisted: 'local', warning: `Billing saved on this device. ${detail}` };
  }
}
