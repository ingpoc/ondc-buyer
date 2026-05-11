export type BuyerJourneyStepId =
  | 'search'
  | 'results'
  | 'product_detail'
  | 'cart'
  | 'checkout'
  | 'payment_selection'
  | 'order_confirmation'
  | 'order_tracking'
  | 'support'
  | 'agent_chat';

export interface BuyerJourneyStep {
  id: BuyerJourneyStepId;
  route: string;
  requiresTrust: boolean;
  recoverableAfterRefresh: boolean;
  errorState: boolean;
}

export const BUYER_JOURNEY_STEPS: readonly BuyerJourneyStep[] = [
  {
    id: 'search',
    route: '/search',
    requiresTrust: false,
    recoverableAfterRefresh: false,
    errorState: true,
  },
  {
    id: 'results',
    route: '/results',
    requiresTrust: false,
    recoverableAfterRefresh: false,
    errorState: true,
  },
  {
    id: 'product_detail',
    route: '/product/:id',
    requiresTrust: false,
    recoverableAfterRefresh: false,
    errorState: true,
  },
  {
    id: 'cart',
    route: '/cart',
    requiresTrust: false,
    recoverableAfterRefresh: true,
    errorState: true,
  },
  {
    id: 'checkout',
    route: '/checkout',
    requiresTrust: true,
    recoverableAfterRefresh: true,
    errorState: true,
  },
  {
    id: 'payment_selection',
    route: '/checkout',
    requiresTrust: true,
    recoverableAfterRefresh: true,
    errorState: true,
  },
  {
    id: 'order_confirmation',
    route: '/orders/:id',
    requiresTrust: true,
    recoverableAfterRefresh: true,
    errorState: true,
  },
  {
    id: 'order_tracking',
    route: '/orders/:id',
    requiresTrust: false,
    recoverableAfterRefresh: true,
    errorState: true,
  },
  {
    id: 'support',
    route: '/orders/:id',
    requiresTrust: true,
    recoverableAfterRefresh: true,
    errorState: true,
  },
  {
    id: 'agent_chat',
    route: '/agent',
    requiresTrust: true,
    recoverableAfterRefresh: true,
    errorState: true,
  },
];

export function getBuyerJourneyStep(id: BuyerJourneyStepId): BuyerJourneyStep {
  const step = BUYER_JOURNEY_STEPS.find((entry) => entry.id === id);
  if (!step) {
    throw new Error(`Unknown buyer journey step: ${id}`);
  }
  return step;
}
