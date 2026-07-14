import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTrustSnapshot, type PortfolioTrustState, type TrustSurface } from './trust';

const WALLET_ADDRESS = 'wallet-fixture';

type IdentityPresentTrustState = Exclude<PortfolioTrustState, 'no_identity'>;

const TRUST_STATES: IdentityPresentTrustState[] = [
  'identity_present_unverified',
  'verified',
  'manual_review',
  'revoked_or_blocked',
];

function trustSurface(state: IdentityPresentTrustState): TrustSurface {
  return {
    trust_version: 'v1',
    wallet_address: WALLET_ADDRESS,
    did: `did:solana:${WALLET_ADDRESS}`,
    verification_bitmap: state === 'verified' ? 1 : 0,
    updated_at: '2026-05-12T00:00:00Z',
    trust_state: state,
    high_trust_eligible: state === 'verified',
    state_reason: `fixture reason for ${state}`,
    verifications:
      state === 'identity_present_unverified'
        ? []
        : [
            {
              document_type: 'aadhaar',
              verification_id: `aadhaar_${WALLET_ADDRESS}_fixture`,
              workflow_status: state === 'revoked_or_blocked' ? 'failed' : state,
              decision:
                state === 'verified'
                  ? 'approve'
                  : state === 'manual_review'
                    ? 'manual_review'
                    : 'reject',
              reason: `fixture verification reason for ${state}`,
            },
          ],
  };
}

function jsonResponse(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchTrustSnapshot', () => {
  it('returns no_identity without calling the trust endpoint when identity is missing', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ data: null }));

    const snapshot = await fetchTrustSnapshot(WALLET_ADDRESS);

    expect(snapshot).toMatchObject({
      state: 'no_identity',
      eligible: false,
      trust: null,
    });
    expect(snapshot.reason).toContain('Sign in');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(TRUST_STATES)('maps trust fixture state %s', async (state) => {
    const trust = trustSurface(state);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ data: { owner: WALLET_ADDRESS } }))
      .mockResolvedValueOnce(jsonResponse({ data: trust }));

    const snapshot = await fetchTrustSnapshot(WALLET_ADDRESS);

    expect(snapshot.state).toBe(state);
    expect(snapshot.eligible).toBe(state === 'verified');
    expect(snapshot.reason).toBe(`fixture reason for ${state}`);
    expect(snapshot.trust).toEqual(trust);
  });
});
