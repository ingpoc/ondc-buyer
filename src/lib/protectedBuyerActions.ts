import { sessionSkipsLegacyTrust, type PortfolioTrustState } from './trust';
import { assertCanExecuteProtectedBuyerAction } from './buyerActionPolicy';

export type ProtectedBuyerAction =
  | 'high_value_checkout'
  | 'restricted_category_checkout'
  | 'refund_request'
  | 'dispute_creation'
  | 'payment_method_change'
  | 'account_recovery'
  | 'agent_write';

export interface ProtectedBuyerActionContext {
  action: ProtectedBuyerAction;
  walletAddress: string | null;
  trustState: PortfolioTrustState;
  subjectId?: string | null;
  auditSubjectId: string;
  auditReferenceId?: string | null;
}

export interface ProtectedBuyerActionPolicy {
  action: ProtectedBuyerAction;
  required_trust_state: 'verified';
  wallet_address: string;
  subject_id: string | null;
  audit_subject_id: string;
  audit_reference_id: string | null;
  client_observed_trust_state: PortfolioTrustState;
  enforcement: 'backend_must_revalidate_trust';
}

export const PROTECTED_BUYER_ACTIONS: readonly ProtectedBuyerAction[] = [
  'high_value_checkout',
  'restricted_category_checkout',
  'refund_request',
  'dispute_creation',
  'payment_method_change',
  'account_recovery',
  'agent_write',
];

export function buildProtectedBuyerActionPolicy(
  context: ProtectedBuyerActionContext,
): ProtectedBuyerActionPolicy {
  assertCanExecuteProtectedBuyerAction(context.trustState);

  const sessionPrincipal = sessionSkipsLegacyTrust(context.subjectId);
  if (!context.walletAddress && !sessionPrincipal) {
    throw new Error('Sign in is required before protected buyer actions can be sent.');
  }

  const walletOrSubject = context.walletAddress ?? context.subjectId ?? '';

  return {
    action: context.action,
    required_trust_state: 'verified',
    wallet_address: walletOrSubject,
    subject_id: context.subjectId ?? null,
    audit_subject_id: context.auditSubjectId,
    audit_reference_id: context.auditReferenceId ?? null,
    client_observed_trust_state: context.trustState,
    enforcement: 'backend_must_revalidate_trust',
  };
}

export function buildProtectedBuyerActionHeaders(
  policy: ProtectedBuyerActionPolicy,
): Record<string, string> {
  return {
    'X-Buyer-Protected-Action': policy.action,
    'X-Buyer-Required-Trust-State': policy.required_trust_state,
    'X-Wallet-Address': policy.wallet_address,
    'X-Buyer-Audit-Subject': policy.audit_subject_id,
    'X-Buyer-Trust-Enforcement': policy.enforcement,
  };
}
