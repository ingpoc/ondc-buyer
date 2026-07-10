/**
 * Portfolio trust-client — reconstructed from AadhaarChain gateway contracts
 * and buyer/seller/FlatWatch consumers. Missing from this workspace clone;
 * vendored so local Vite aliases resolve.
 */

export type PortfolioTrustState =
  | 'no_identity'
  | 'identity_present_unverified'
  | 'verified'
  | 'manual_review'
  | 'revoked_or_blocked';

export type IdentityProofAudience = 'buyer' | 'seller' | 'flatwatch';

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
  trust_state: PortfolioTrustState;
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

export interface IdentityProofToken {
  token_id: string;
  wallet_address: string;
  audience: IdentityProofAudience;
  purpose: string;
  trust_state: PortfolioTrustState;
  high_trust_eligible: boolean;
  issued_at: string;
  expires_at: string;
  message: string;
}

export interface SignedIdentityProofResult {
  valid: boolean;
  wallet_address: string;
  audience: IdentityProofAudience;
  trust_state?: PortfolioTrustState | null;
  high_trust_eligible?: boolean;
  reason: string;
  verified_at: string;
}

export interface SSOUser {
  wallet_address: string;
  did?: string | null;
  email?: string | null;
  [key: string]: unknown;
}

export interface LoginResult {
  success?: boolean;
  user?: SSOUser;
  message?: string;
  [key: string]: unknown;
}

export interface SessionValidationResult {
  valid: boolean;
  user?: SSOUser;
}

export const TRUST_STATE_META: Record<
  PortfolioTrustState,
  {
    label: string;
    buyerActionMessage: string;
    sellerActionMessage: string;
  }
> = {
  no_identity: {
    label: 'No identity',
    buyerActionMessage:
      'Create an identity anchor in AadhaarChain before elevated buyer actions.',
    sellerActionMessage:
      'Create an identity anchor in AadhaarChain before acting as a verified seller.',
  },
  identity_present_unverified: {
    label: 'Unverified',
    buyerActionMessage:
      'Complete AadhaarChain verification before checkout and other elevated buyer actions.',
    sellerActionMessage:
      'Complete AadhaarChain verification before publishing or managing high-trust seller actions.',
  },
  verified: {
    label: 'Verified',
    buyerActionMessage: 'Trust is verified. Elevated buyer actions are available.',
    sellerActionMessage:
      'Trust is verified. Catalog publishing and other elevated seller actions remain available.',
  },
  manual_review: {
    label: 'Manual review',
    buyerActionMessage:
      'Elevated commerce actions stay paused until AadhaarChain review completes.',
    sellerActionMessage:
      'Verification is under manual review. Elevated seller actions stay paused until review completes.',
  },
  revoked_or_blocked: {
    label: 'Blocked',
    buyerActionMessage:
      'Your trust state is blocked or revoked. Review AadhaarChain before elevated buyer actions.',
    sellerActionMessage:
      'Your trust state is blocked or revoked. Review AadhaarChain before attempting elevated seller actions.',
  },
};

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return '';
  }

  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) {
    zeros += 1;
  }

  const digits = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  let result = '';
  for (let i = 0; i < zeros; i += 1) {
    result += '1';
  }
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Trust API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function createTrustClient({ trustApiUrl }: { trustApiUrl: string }) {
  const base = trustApiUrl.replace(/\/+$/, '');

  return {
    async fetchTrustSnapshot(walletAddress: string): Promise<TrustSnapshot> {
      if (!walletAddress) {
        return {
          state: 'no_identity',
          eligible: false,
          reason:
            'Authenticate with AadhaarChain before using trust-gated actions.',
          trust: null,
        };
      }

      const identityResponse = await fetchJson<{ data: unknown | null }>(
        `${base}/api/identity/${walletAddress}`,
      );

      if (!identityResponse.data) {
        return {
          state: 'no_identity',
          eligible: false,
          reason:
            'Create an identity anchor in AadhaarChain before elevated portfolio actions.',
          trust: null,
        };
      }

      const trustResponse = await fetchJson<{ data: TrustSurface }>(
        `${base}/api/identity/${walletAddress}/trust`,
      );
      const trust = trustResponse.data;

      return {
        state: trust.trust_state,
        eligible: trust.high_trust_eligible,
        reason: trust.state_reason ?? null,
        trust,
      };
    },

    async issueIdentityProofToken(
      walletAddress: string,
      audience: IdentityProofAudience,
      purpose: string,
    ): Promise<IdentityProofToken> {
      const response = await fetchJson<{ data: IdentityProofToken }>(
        `${base}/api/identity/${walletAddress}/proof-token`,
        {
          method: 'POST',
          body: JSON.stringify({ audience, purpose }),
        },
      );
      return response.data;
    },

    async verifySignedIdentityProof(input: {
      tokenId: string;
      walletAddress: string;
      audience: IdentityProofAudience;
      message: string;
      signature: string;
    }): Promise<SignedIdentityProofResult> {
      const response = await fetchJson<{ data: SignedIdentityProofResult }>(
        `${base}/api/identity/proof-token/verify`,
        {
          method: 'POST',
          body: JSON.stringify({
            token_id: input.tokenId,
            wallet_address: input.walletAddress,
            audience: input.audience,
            message: input.message,
            signature: input.signature,
          }),
        },
      );
      return response.data;
    },
  };
}
