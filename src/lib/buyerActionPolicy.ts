import type { PortfolioTrustState } from './trust';

export const BUYER_VERIFIED_ACTION_MESSAGE =
  'Sign in or verified trust is required before checkout, cancellation, refund, dispute, or payment-change actions.';

export function canExecuteProtectedBuyerAction(trustState: PortfolioTrustState): boolean {
  return trustState === 'verified';
}

export function assertCanExecuteProtectedBuyerAction(trustState: PortfolioTrustState): void {
  if (!canExecuteProtectedBuyerAction(trustState)) {
    throw new Error(BUYER_VERIFIED_ACTION_MESSAGE);
  }
}
