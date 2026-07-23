import { DECISION_REASONS, type DecisionReason } from "./reasons.ts";
import {
  DECISION_SCHEMA_VERSION,
  DECISION_VALUES,
  REQUIRED_ACTIONS,
  RISK_LEVELS,
  type DecisionV1,
  type DecisionV2,
} from "./types.ts";

type JsonObject = Record<string, unknown>;

export type NormalizedStoredDecisionV1 = DecisionV1 & {
  /** Prevents compatibility output from being mistaken for a live authorization. */
  authorization_usable: false;
  source_schema_version: "1";
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDecision(value: unknown): value is DecisionV1["decision"] {
  return DECISION_VALUES.includes(value as DecisionV1["decision"]);
}

function isDecisionReason(value: unknown): value is DecisionReason {
  return typeof value === "string" && DECISION_REASONS.includes(value as DecisionReason);
}

function isOptionalRecordOrNull(value: unknown): boolean {
  return value === undefined || value === null || isObject(value);
}

/**
 * Reads legacy stored data only. This performs shape validation, not authorization.
 * In particular, its output intentionally cannot satisfy DecisionV2.
 */
export function parseStoredDecisionV1(value: unknown): DecisionV1 | null {
  if (!isObject(value) || (value.schema_version !== undefined && value.schema_version !== "1")) {
    return null;
  }
  if (!isDecision(value.decision) || !isDecisionReason(value.reason_code)) {
    return null;
  }
  if (value.request_hash !== undefined && typeof value.request_hash !== "string") {
    return null;
  }
  if (!isOptionalRecordOrNull(value.approval) || !isOptionalRecordOrNull(value.receipt)) {
    return null;
  }

  return {
    decision: value.decision,
    reason_code: value.reason_code,
    ...(value.request_hash === undefined ? {} : { request_hash: value.request_hash }),
    ...(value.approval === undefined ? {} : { approval: value.approval as DecisionV1["approval"] }),
    ...(value.receipt === undefined ? {} : { receipt: value.receipt as DecisionV1["receipt"] }),
  };
}

/** Normalizes a legacy record for display/migration while keeping it non-authoritative. */
export function normalizeStoredDecisionV1(value: unknown): NormalizedStoredDecisionV1 | null {
  const parsed = parseStoredDecisionV1(value);
  return parsed === null
    ? null
    : { ...parsed, authorization_usable: false, source_schema_version: "1" };
}

/** Strict parser for live V2 decision envelopes. */
export function parseDecisionV2(value: unknown): DecisionV2 | null {
  if (!isObject(value) || value.schema_version !== DECISION_SCHEMA_VERSION) {
    return null;
  }
  if (!isDecision(value.decision) || !isDecisionReason(value.reason_code)) {
    return null;
  }
  if (
    typeof value.decision_id !== "string" || value.decision_id.length === 0 ||
    typeof value.policy_id !== "string" || value.policy_id.length === 0 ||
    typeof value.human_reason !== "string" || value.human_reason.length === 0 ||
    !REQUIRED_ACTIONS.includes(value.required_action as (typeof REQUIRED_ACTIONS)[number]) ||
    !RISK_LEVELS.includes(value.risk_level as (typeof RISK_LEVELS)[number]) ||
    typeof value.policy_version !== "number" ||
    !Number.isSafeInteger(value.policy_version) || value.policy_version < 0 ||
    typeof value.expires_at !== "string" ||
    value.expires_at.length === 0 ||
    Number.isNaN(Date.parse(value.expires_at))
  ) {
    return null;
  }
  if (value.request_hash !== undefined && typeof value.request_hash !== "string") {
    return null;
  }
  if (!isOptionalRecordOrNull(value.approval) || !isOptionalRecordOrNull(value.receipt)) {
    return null;
  }

  return value as DecisionV2;
}
