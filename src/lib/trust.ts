import {
  createTrustClient,
  encodeBase58,
  type IdentityProofAudience,
  type SignedIdentityProofResult,
  type PortfolioTrustState,
  type TrustSnapshot,
  type TrustSurface,
  type TrustVerificationSummary,
} from '@portfolio/trust-client';
import { TRUST_API_URL } from './identityUrls';

export type {
  PortfolioTrustState,
  IdentityProofAudience,
  SignedIdentityProofResult,
  TrustSnapshot,
  TrustSurface,
  TrustVerificationSummary,
};

const trustClient = createTrustClient({ trustApiUrl: TRUST_API_URL });

/** Google/demo session principals authorize via AgentGuard; wallet KYC is hangar-only. */
export function sessionSkipsLegacyTrust(principalId?: string | null): boolean {
  return Boolean(principalId && principalId.startsWith('principal:'));
}

/** True when elevated UI may proceed (session principal or verified wallet trust). */
export function elevatedTrustSatisfied(
  trustState: PortfolioTrustState,
  principalId?: string | null,
): boolean {
  return sessionSkipsLegacyTrust(principalId) || trustState === 'verified';
}

/** Coerce session principals to verified for local demo policy helpers. */
export function effectiveElevatedTrustState(
  trustState: PortfolioTrustState,
  principalId?: string | null,
): PortfolioTrustState {
  return elevatedTrustSatisfied(trustState, principalId) ? 'verified' : trustState;
}

export async function fetchTrustSnapshot(walletAddress: string): Promise<TrustSnapshot> {
  return trustClient.fetchTrustSnapshot(walletAddress);
}

export async function createSignedIdentityProof({
  walletAddress,
  audience,
  purpose,
  signMessage,
}: {
  walletAddress: string;
  audience: IdentityProofAudience;
  purpose: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}): Promise<SignedIdentityProofResult> {
  const token = await trustClient.issueIdentityProofToken(walletAddress, audience, purpose);
  const signature = await signMessage(new TextEncoder().encode(token.message));
  return trustClient.verifySignedIdentityProof({
    tokenId: token.token_id,
    walletAddress,
    audience,
    message: token.message,
    signature: encodeBase58(signature),
  });
}
