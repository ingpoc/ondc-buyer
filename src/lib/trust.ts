export type PortfolioTrustState =
  | 'no_identity'
  | 'identity_present_unverified'
  | 'verified'
  | 'manual_review'
  | 'revoked_or_blocked';

export interface TrustVerificationSummary {
  document_type: 'aadhaar' | 'pan';
  verification_id: string;
  workflow_status: 'pending' | 'processing' | 'verified' | 'failed' | 'manual_review';
  decision?: 'approve' | 'reject' | 'manual_review' | null;
  reason?: string | null;
}

export interface TrustSurface {
  trust_version: 'v1';
  wallet_address: string;
  did: string;
  verification_bitmap: number;
  updated_at: string;
  trust_state: Exclude<PortfolioTrustState, 'no_identity'>;
  high_trust_eligible: boolean;
  state_reason?: string | null;
  verifications: TrustVerificationSummary[];
}

export interface TrustSnapshot {
  state: PortfolioTrustState;
  eligible: boolean;
  reason: string | null;
  trust: TrustSurface | null;
}

const TRUST_API_URL = import.meta.env.VITE_TRUST_API_URL || 'http://127.0.0.1:43101';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Trust API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchTrustSnapshot(walletAddress: string): Promise<TrustSnapshot> {
  if (!walletAddress) {
    return {
      state: 'no_identity',
      eligible: false,
      reason: 'Connect a wallet-backed AadhaarChain identity before using trust-gated flows.',
      trust: null,
    };
  }

  const identityResponse = await fetchJson<{ data: unknown | null }>(
    `${TRUST_API_URL}/api/identity/${walletAddress}`
  );

  if (!identityResponse.data) {
    return {
      state: 'no_identity',
      eligible: false,
      reason: 'Create an identity anchor in AadhaarChain before continuing.',
      trust: null,
    };
  }

  const trustResponse = await fetchJson<{ data: TrustSurface }>(
    `${TRUST_API_URL}/api/identity/${walletAddress}/trust`
  );
  const trust = trustResponse.data;

  return {
    state: trust.trust_state,
    eligible: trust.high_trust_eligible,
    reason: trust.state_reason ?? null,
    trust,
  };
}
