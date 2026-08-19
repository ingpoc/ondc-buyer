import { beforeEach, describe, expect, it } from 'vitest';
import type { AgentRef, IntentReceipt, Mandate } from '@aadharchain/agentguard-contract';
import {
  applyBuyerAgentControl,
  applyBuyerAgentPoll,
  buyerShoppingAgentLabel,
  currentBuyerAgentPollEpoch,
  getBuyerAgentAuthority,
  invalidateBuyerAgentPolls,
  resetBuyerAgentAuthority,
} from './buyerAgentAuthority';

function agent(status: AgentRef['status']): AgentRef {
  return { agent_id: 'agent-buyer-1', principal_id: 'principal:demo:buyer', role: 'buyer', status };
}

function mandate(status: Mandate['status'] = 'active'): Mandate {
  return {
    mandate_id: 'mandate-1',
    principal_id: 'principal:demo:buyer',
    agent_id: 'agent-buyer-1',
    role: 'buyer',
    template: 'buyer_shop_v1',
    status,
    version: 1,
    allowed_actions: ['buyer.checkout.commit'],
    limits: { auto_approve_max_inr: { 'buyer.checkout.commit': 10000 } },
    created_at: '2026-08-19T10:00:00Z',
  };
}

const receipts: IntentReceipt[] = [];

describe('Buyer agent pause authority store', () => {
  beforeEach(() => {
    resetBuyerAgentAuthority();
  });

  it('keeps pause sticky when a later status poll reports active', () => {
    applyBuyerAgentPoll({ agent: agent('active'), mandate: mandate(), receipts });
    applyBuyerAgentControl(agent('paused'), true);

    const afterPoll = applyBuyerAgentPoll({
      agent: agent('active'),
      mandate: mandate(),
      receipts,
    });

    expect(afterPoll.explicitPaused).toBe(true);
    expect(afterPoll.agent?.status).toBe('paused');
    expect(getBuyerAgentAuthority().agent?.status).toBe('paused');
  });

  it('drops a status poll that started before pause', () => {
    applyBuyerAgentPoll({ agent: agent('active'), mandate: mandate(), receipts });
    const staleEpoch = currentBuyerAgentPollEpoch();
    invalidateBuyerAgentPolls();
    applyBuyerAgentControl(agent('paused'), true);

    applyBuyerAgentPoll({ agent: agent('active'), mandate: mandate(), receipts }, staleEpoch);

    expect(getBuyerAgentAuthority().agent?.status).toBe('paused');
    expect(getBuyerAgentAuthority().explicitPaused).toBe(true);
  });

  it('clears sticky pause only on explicit resume', () => {
    applyBuyerAgentControl(agent('paused'), true);
    applyBuyerAgentPoll({ agent: agent('active'), mandate: mandate(), receipts });
    expect(getBuyerAgentAuthority().agent?.status).toBe('paused');

    applyBuyerAgentControl(agent('active'), false);
    expect(getBuyerAgentAuthority().explicitPaused).toBe(false);
    expect(getBuyerAgentAuthority().agent?.status).toBe('active');
  });

  it('stores Pause as paused even if the control response still says active', () => {
    applyBuyerAgentControl(agent('active'), true);
    expect(getBuyerAgentAuthority().explicitPaused).toBe(true);
    expect(getBuyerAgentAuthority().agent?.status).toBe('paused');
  });

  it('uses the same paused wording family on Preferences and Checkout', () => {
    expect(buyerShoppingAgentLabel('paused', 'preferences')).toContain('paused');
    expect(buyerShoppingAgentLabel('paused', 'checkout')).toContain('paused');
    expect(buyerShoppingAgentLabel('active', 'preferences')).toContain('on');
    expect(buyerShoppingAgentLabel('active', 'checkout')).toContain('on');
  });
});
