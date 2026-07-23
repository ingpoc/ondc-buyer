import { describe, expect, it } from 'vitest';

import {
  normalizeStoredDecisionV1,
  parseDecisionV2,
  type Decision,
} from '@aadharchain/agentguard-contract';

const liveDecision: Decision = {
  schema_version: '2',
  decision_id: 'decision-buyer-contract',
  policy_id: 'policy-buyer-checkout',
  decision: 'need_approval',
  reason_code: 'approval_required_amount',
  human_reason: 'The checkout amount requires review.',
  required_action: 'review',
  risk_level: 'high',
  policy_version: 1,
  expires_at: '2026-07-23T12:00:00.000Z',
};

describe('AgentGuard Decision Contract v2', () => {
  it('accepts the live V2 envelope and rejects it as legacy V1', () => {
    expect(parseDecisionV2(liveDecision)).toEqual(liveDecision);
    expect(normalizeStoredDecisionV1(liveDecision)).toBeNull();
  });

  it('keeps legacy V1 data non-authoritative', () => {
    expect(normalizeStoredDecisionV1({
      decision: 'deny',
      reason_code: 'action_not_allowed',
    })).toMatchObject({
      authorization_usable: false,
      source_schema_version: '1',
    });
  });
});
