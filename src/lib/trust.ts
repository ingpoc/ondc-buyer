import {
  createTrustClient,
  type PortfolioTrustState,
  type TrustSnapshot,
  type TrustSurface,
  type TrustVerificationSummary,
} from '@portfolio/trust-client';
import { TRUST_API_URL } from './identityUrls';

export type {
  PortfolioTrustState,
  TrustSnapshot,
  TrustSurface,
  TrustVerificationSummary,
};

const trustClient = createTrustClient({ trustApiUrl: TRUST_API_URL });

export async function fetchTrustSnapshot(walletAddress: string): Promise<TrustSnapshot> {
  return trustClient.fetchTrustSnapshot(walletAddress);
}
