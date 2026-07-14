export const AGENTGUARD_ACTIONS = [
  "buyer.checkout.commit",
  "buyer.order.cancel",
  "buyer.return.submit",
  "buyer.remedy.accept",
  "seller.catalog.publish",
  "seller.price.change",
  "seller.inventory.commit",
  "seller.order.accept",
  "seller.order.reject",
  "seller.fulfilment.commit",
  "seller.remedy.promise",
  "seller.refund.issue",
] as const;

export type AgentGuardAction = (typeof AGENTGUARD_ACTIONS)[number];

/** Compatibility aliases — callers: Hermes evaluate bodies + older clients.
 * Delete after 2026-08-01 once all callers send canonical AGENTGUARD_ACTIONS names.
 */
export const LEGACY_ACTION_ALIASES = {
  refund: "seller.refund.issue",
  checkout: "buyer.checkout.commit",
} as const satisfies Record<string, AgentGuardAction>;

export function normalizeAction(action: string): AgentGuardAction | null {
  if (action in LEGACY_ACTION_ALIASES) {
    return LEGACY_ACTION_ALIASES[action as keyof typeof LEGACY_ACTION_ALIASES];
  }
  return AGENTGUARD_ACTIONS.includes(action as AgentGuardAction)
    ? (action as AgentGuardAction)
    : null;
}
