import { describe, expect, it } from 'vitest';
import {
  BUYER_JOURNEY_STEPS,
  getBuyerJourneyStep,
  type BuyerJourneyStepId,
} from './buyerJourneyContract';

describe('buyer journey contract', () => {
  it('covers every named ondc-buyer goal journey step', () => {
    const requiredSteps: BuyerJourneyStepId[] = [
      'search',
      'results',
      'product_detail',
      'cart',
      'checkout',
      'payment_selection',
      'order_confirmation',
      'order_tracking',
      'support',
      'agent_chat',
    ];

    expect(BUYER_JOURNEY_STEPS.map((step) => step.id)).toEqual(requiredSteps);
  });

  it('keeps all sensitive write steps trust-gated', () => {
    expect(getBuyerJourneyStep('checkout').requiresTrust).toBe(true);
    expect(getBuyerJourneyStep('payment_selection').requiresTrust).toBe(true);
    expect(getBuyerJourneyStep('order_confirmation').requiresTrust).toBe(true);
    expect(getBuyerJourneyStep('support').requiresTrust).toBe(true);
    expect(getBuyerJourneyStep('agent_chat').requiresTrust).toBe(true);
  });

  it('requires refresh recovery and error states after cart creation', () => {
    const recoverableSteps = BUYER_JOURNEY_STEPS.filter((step) => step.recoverableAfterRefresh);
    expect(recoverableSteps.map((step) => step.id)).toEqual([
      'cart',
      'checkout',
      'payment_selection',
      'order_confirmation',
      'order_tracking',
      'support',
      'agent_chat',
    ]);
    expect(BUYER_JOURNEY_STEPS.every((step) => step.errorState)).toBe(true);
  });

  it('maps goal steps to implemented routes', () => {
    expect(Object.fromEntries(BUYER_JOURNEY_STEPS.map((step) => [step.id, step.route]))).toEqual({
      search: '/search',
      results: '/results',
      product_detail: '/product/:id',
      cart: '/cart',
      checkout: '/checkout',
      payment_selection: '/checkout',
      order_confirmation: '/orders/:id',
      order_tracking: '/orders/:id',
      support: '/orders/:id',
      agent_chat: '/agent',
    });
  });
});
