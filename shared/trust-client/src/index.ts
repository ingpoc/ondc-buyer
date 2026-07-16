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
  high_trust_eligible: boolean;
  reason: string;
  verified_at: string;
}

export interface SSOUser {
  principal_id?: string;
  identity_provider?: string;
  assurance_level?: string;
  audience?: string;
  display_name?: string;
  email?: string;
  /** Legacy wallet SSO only — absent for Google/demo principals. */
  wallet_address?: string;
  did?: string;
}

export interface LoginResult {
  success?: boolean;
  user?: SSOUser;
  message?: string;
}

export interface SessionValidationResult {
  valid: boolean;
  user?: SSOUser;
}

export const TRUST_STATE_META: Record<
  PortfolioTrustState,
  { buyerActionMessage: string; sellerActionMessage: string }
> = {
  no_identity: {
    buyerActionMessage:
      'Sign in before elevated buyer actions.',
    sellerActionMessage:
      'Sign in before elevated seller actions.',
  },
  identity_present_unverified: {
    buyerActionMessage:
      'Identity is unverified. Sign in so AgentGuard can authorize elevated actions.',
    sellerActionMessage:
      'Identity is unverified. Sign in so AgentGuard can authorize elevated actions.',
  },
  verified: {
    buyerActionMessage: 'Trust is verified.',
    sellerActionMessage:
      'Trust is verified. Catalog publishing and other elevated seller actions remain available.',
  },
  manual_review: {
    buyerActionMessage:
      'Elevated commerce actions stay paused while verification is under manual review.',
    sellerActionMessage:
      'Verification is under manual review. Elevated seller actions stay paused until review completes.',
  },
  revoked_or_blocked: {
    buyerActionMessage:
      'Your trust state is blocked or revoked. Sign in again or review your identity before elevated buyer actions.',
    sellerActionMessage:
      'Your trust state is blocked or revoked. Sign in again or review your identity before elevated seller actions.',
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

  const size = ((bytes.length - zeros) * 138) / 100 + 1;
  const buffer = new Uint8Array(size);
  let length = 0;

  for (let index = zeros; index < bytes.length; index += 1) {
    let carry = bytes[index];
    let bufferIndex = 0;

    for (let reverseIndex = size - 1; reverseIndex >= size - length; reverseIndex -= 1) {
      carry += buffer[reverseIndex] * 256;
      buffer[reverseIndex] = carry % 58;
      carry = Math.floor(carry / 58);
    }

    while (carry > 0) {
      buffer[size - length - 1] = carry % 58;
      carry = Math.floor(carry / 58);
      length += 1;
    }
  }

  let encoded = '';
  for (let index = 0; index < zeros; index += 1) {
    encoded += BASE58_ALPHABET[0];
  }

  for (let index = size - length; index < size; index += 1) {
    encoded += BASE58_ALPHABET[buffer[index]];
  }

  return encoded;
}

interface TrustClientOptions {
  trustApiUrl: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Trust API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function createTrustClient({ trustApiUrl }: TrustClientOptions) {
  const normalizedBase = trustApiUrl.replace(/\/$/, '');

  return {
    async fetchTrustSnapshot(walletAddress: string): Promise<TrustSnapshot> {
      const identityResponse = await fetchJson<{ data: unknown | null }>(
        `${normalizedBase}/api/identity/${walletAddress}`,
      );

      if (!identityResponse.data) {
        return {
          state: 'no_identity',
          eligible: false,
          reason: TRUST_STATE_META.no_identity.buyerActionMessage,
          trust: null,
        };
      }

      const trustResponse = await fetchJson<{ data: TrustSurface }>(
        `${normalizedBase}/api/identity/${walletAddress}/trust`,
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
        `${normalizedBase}/api/identity/${walletAddress}/proof-token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        `${normalizedBase}/api/identity/proof-token/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
