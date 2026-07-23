import type { AgentGuardAction } from "./actions";
import type { DecisionReason } from "./reasons";

export const SCHEMA_VERSION = "1";
export const DECISION_SCHEMA_VERSION = "2";

export type PrincipalRef = {
  schema_version: typeof SCHEMA_VERSION;
  principal_id: string;
  role?: "buyer" | "seller";
  wallet_address?: string;
};

export type AgentRef = {
  agent_id: string;
  principal_id: string;
  role: "buyer" | "seller";
  status: "active" | "paused" | "revoked";
  wallet_address?: string;
};

export type Mandate = {
  mandate_id: string;
  principal_id: string;
  agent_id: string;
  role: "buyer" | "seller";
  template: "buyer_shop_v1" | "seller_ops_v1";
  status: "draft" | "active" | "revoked" | "expired";
  version: number;
  allowed_actions: AgentGuardAction[];
  limits: Record<string, unknown>;
  created_at: string;
  confirmed_at?: string;
  expires_at?: string;
};

export type ActionRequest = {
  schema_version: typeof SCHEMA_VERSION;
  principal: PrincipalRef;
  agent_id: string;
  action: AgentGuardAction;
  resource_id: string;
  amount_inr?: number;
  quantity?: number;
  counterparty_id?: string;
  nonce?: string;
  expires_at?: string;
  payload?: Record<string, unknown>;
};

export const DECISION_VALUES = ["allow", "need_approval", "deny"] as const;

export type DecisionValue = (typeof DECISION_VALUES)[number];

/** Legacy persisted decision. New authorization responses must use DecisionV2. */
export type DecisionV1 = {
  decision: DecisionValue;
  reason_code: DecisionReason;
  request_hash?: string;
  approval?: Approval | null;
  receipt?: IntentReceipt | null;
};

export const REQUIRED_ACTIONS = [
  "none",
  "review",
  "strong_authentication",
  "contact_support",
] as const;

export type RequiredAction = (typeof REQUIRED_ACTIONS)[number];

export const RISK_LEVELS = [
  "read_only",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

export type DecisionV2 = {
  schema_version: typeof DECISION_SCHEMA_VERSION;
  decision_id: string;
  policy_id: string;
  decision: DecisionValue;
  reason_code: DecisionReason;
  human_reason: string;
  required_action: RequiredAction;
  risk_level: RiskLevel;
  policy_version: number;
  expires_at: string;
  request_hash?: string;
  approval?: Approval | null;
  receipt?: IntentReceipt | null;
};

/** The live contract is V2. DecisionV1 exists only for stored-data compatibility. */
export type Decision = DecisionV2;

export type Approval = {
  approval_id: string;
  request_hash: string;
  principal_id: string;
  agent_id: string;
  action: AgentGuardAction;
  resource_id: string;
  amount_inr: number;
  mandate_id: string;
  mandate_version: number;
  policy_version: number;
  nonce: string;
  status: "issued" | "consumed" | "expired" | "revoked";
  expires_at: string;
  created_at: string;
  consumed_at?: string;
};

export type IntentReceipt = {
  receipt_id: string;
  schema_version: typeof SCHEMA_VERSION;
  principal_id: string;
  agent_id: string;
  action: AgentGuardAction;
  resource_id: string;
  amount_inr: number;
  outcome: "allowed" | "approved" | "denied" | "paused" | "executed";
  reason_code?: DecisionReason;
  approval_id?: string;
  request_hash?: string;
  mandate_id?: string;
  mandate_version?: number;
  result?: Record<string, unknown>;
  created_at: string;
  issuer_key_id?: string;
  signature?: string;
};
