/** Last AgentGuard checkout outcome for page UI (not orb-only). */

export type CheckoutOutcome = {
  at: number;
  decision: 'allow' | 'need_approval' | 'deny' | string;
  message: string;
  receiptId?: string | null;
  amountInr?: number | null;
  orderId?: string | null;
  approvalId?: string | null;
};

const KEY = 'ondc-checkout-outcome';

export function writeCheckoutOutcome(outcome: CheckoutOutcome): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(outcome));
  } catch {
    /* ignore */
  }
}

export function readCheckoutOutcome(): CheckoutOutcome | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CheckoutOutcome;
  } catch {
    return null;
  }
}

export function clearCheckoutOutcome(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
