/** Checkout form prefill from Samantha tools (does not commit payment). */
export const CHECKOUT_PREFILL_EVENT = 'ondc-buyer-checkout-prefill';

export type CheckoutPrefillDetail = {
  sessionId: string;
  name?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export function dispatchCheckoutPrefill(detail: CheckoutPrefillDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHECKOUT_PREFILL_EVENT, { detail }));
}
