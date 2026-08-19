import type { AgentRef, IntentReceipt, Mandate } from '@aadharchain/agentguard-contract';

export const BUYER_AGENT_AUTHORITY_EVENT = 'buyer-agent-authority-changed';

export type BuyerAgentAuthoritySnapshot = {
  agent: AgentRef | null;
  mandateStatus: string | null;
  receipts: IntentReceipt[];
  checkoutAutoMax: number | null;
  /** True after an explicit Pause (or a server poll that reported paused). Cleared only by Resume. */
  explicitPaused: boolean;
};

type AgentGuardStatusPayload = {
  agent: AgentRef | null;
  mandate?: Mandate | null;
  receipts: IntentReceipt[];
};

const EMPTY: BuyerAgentAuthoritySnapshot = {
  agent: null,
  mandateStatus: null,
  receipts: [],
  checkoutAutoMax: null,
  explicitPaused: false,
};

let snapshot: BuyerAgentAuthoritySnapshot = { ...EMPTY };
/** Bumped on pause/resume so in-flight status GETs cannot overwrite the control. */
let pollEpoch = 0;
/**
 * Last Pause/Resume click. Resume must not be undone by a later GET that still
 * says paused (or by rewriting active→paused). Initial polls may still adopt
 * server paused when this is null.
 */
let lastExplicitControl: 'pause' | 'resume' | null = null;

function emit(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(BUYER_AGENT_AUTHORITY_EVENT));
}

export function getBuyerAgentAuthority(): BuyerAgentAuthoritySnapshot {
  return snapshot;
}

export function currentBuyerAgentPollEpoch(): number {
  return pollEpoch;
}

export function invalidateBuyerAgentPolls(): void {
  pollEpoch += 1;
}

export function subscribeBuyerAgentAuthority(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(BUYER_AGENT_AUTHORITY_EVENT, listener);
  return () => window.removeEventListener(BUYER_AGENT_AUTHORITY_EVENT, listener);
}

export function checkoutAutoMaxFromMandate(mandate?: Mandate | null): number | null {
  const auto = mandate?.limits?.auto_approve_max_inr as Record<string, number> | undefined;
  if (auto?.['buyer.checkout.commit'] == null) return null;
  const value = Number(auto['buyer.checkout.commit']);
  return Number.isFinite(value) ? value : null;
}

export function resetBuyerAgentAuthority(): void {
  snapshot = { ...EMPTY };
  lastExplicitControl = null;
  pollEpoch += 1;
  emit();
}

function withPausedAgent(agent: AgentRef | null): AgentRef | null {
  if (!agent) return agent;
  if (agent.status === 'paused') return agent;
  return { ...agent, status: 'paused' };
}

function withActiveAgent(agent: AgentRef | null): AgentRef | null {
  if (!agent) return agent;
  if (agent.status === 'active' || agent.status === 'revoked') return agent;
  return { ...agent, status: 'active' };
}

/**
 * Apply a status GET. Must not unpause: Pause is sticky until Resume.
 * After Resume, polls must not re-pause (stale paused) or revive sticky rewrite
 * (active→paused). Stale polls (epoch mismatch) are ignored.
 */
export function applyBuyerAgentPoll(
  status: AgentGuardStatusPayload,
  epoch = pollEpoch,
): BuyerAgentAuthoritySnapshot {
  if (epoch !== pollEpoch) return snapshot;

  const incoming = status.agent;
  let explicitPaused = snapshot.explicitPaused;
  let agent = incoming;

  if (lastExplicitControl === 'resume') {
    explicitPaused = false;
    if (incoming?.status === 'paused') {
      agent = withActiveAgent(incoming);
    }
  } else if (incoming?.status === 'paused') {
    explicitPaused = true;
  } else if (explicitPaused && incoming?.status === 'active') {
    agent = withPausedAgent(incoming);
  }

  const checkoutAutoMax = checkoutAutoMaxFromMandate(status.mandate);
  snapshot = {
    agent,
    mandateStatus: status.mandate?.status ?? snapshot.mandateStatus,
    receipts: status.receipts,
    checkoutAutoMax: checkoutAutoMax ?? snapshot.checkoutAutoMax,
    explicitPaused,
  };
  emit();
  return snapshot;
}

/** Apply Pause/Resume. Only Resume clears the sticky paused flag. */
export function applyBuyerAgentControl(agent: AgentRef, paused: boolean): BuyerAgentAuthoritySnapshot {
  pollEpoch += 1;
  lastExplicitControl = paused ? 'pause' : 'resume';
  snapshot = {
    ...snapshot,
    agent: paused ? withPausedAgent(agent) : withActiveAgent(agent),
    explicitPaused: paused,
  };
  emit();
  return snapshot;
}

export function buyerShoppingAgentLabel(
  status: AgentRef['status'] | null | undefined,
  surface: 'preferences' | 'checkout',
): string {
  if (status === 'paused') {
    return surface === 'checkout'
      ? 'Shopping agent paused; manual checkout remains available'
      : 'Shopping agent paused';
  }
  if (status === 'active') {
    return surface === 'checkout'
      ? 'Shopping agent on; protected actions follow the mandate'
      : 'Shopping agent on';
  }
  return 'Shopping agent off';
}
