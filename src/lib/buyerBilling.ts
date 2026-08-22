import { TRUST_API_URL } from './identityUrls';
import { updateLocalBuyer } from './localCart';

/**
 * Single Buyer persist contract for CommerceV1.
 *
 * Live 2026-08-22: `PATCH {VITE_API_BASE_URL}/api/cart/buyer/{sessionId}` 404s
 * (`https://gateway.aadharcha.in/api/cart/buyer/:id`). Gateway OpenAPI has carts,
 * lines, checkout-preview, and Razorpay — no buyer profile route yet.
 *
 * Buyer therefore always writes the local cart buyer first, then PUTs this path.
 * Missing/unimplemented gateway statuses are non-fatal.
 */
export const COMMERCE_V1_BUYER_PATH = '/api/commerce/v1/buyer';

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

export function commerceV1BuyerUrl(): string {
  return `${TRUST_API_URL}${COMMERCE_V1_BUYER_PATH}`;
}

export function buyerPersistBody(buyer: BuyerBilling): Record<string, string> {
  const body: Record<string, string> = {
    name: buyer.name.trim(),
    email: buyer.email.trim(),
    phone: buyer.phone.trim(),
  };
  const taxId = buyer.taxId?.trim();
  if (taxId) body.tax_id = taxId;
  return body;
}

export function formatBuyerPersistWarning(status: number): string {
  return `Billing saved on this device. Gateway ${COMMERCE_V1_BUYER_PATH} returned ${status}.`;
}

async function putCommerceV1Buyer(buyer: BuyerBilling): Promise<{ ok: boolean; status: number }> {
  const response = await fetch(commerceV1BuyerUrl(), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buyerPersistBody(buyer)),
  });
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
    const first = await putCommerceV1Buyer(buyer);
    if (first.ok) return { ok: true, persisted: 'remote' };
    if (isNonFatalBuyerPersistStatus(first.status)) {
      return { ok: true, persisted: 'local', warning: formatBuyerPersistWarning(first.status) };
    }
    if (first.status >= 500) {
      const retry = await putCommerceV1Buyer(buyer);
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
