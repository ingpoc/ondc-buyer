# AgentGuard Contract

Shared TypeScript contract for the local AgentGuard demo. It owns the action taxonomy, decision reason codes, identity-neutral principal shapes, and canonical JSON hashing helpers used by Buyer, Seller, and the gateway.

The gateway mirrors these constants in `aadharchain/gateway/app/agentguard_contract.py`. Keep `fixtures/golden-action-request.json` stable when checking cross-language canonicalization.

## Decision compatibility policy

Decision schema `2` is the only live authorization contract. Buyer, Seller, and
gateway responses must reject any live decision that omits the V2 policy,
reason, required-action, risk, version, expiry, or decision identifiers.

Decision V1 is stored-data compatibility only. It may be parsed for display or
migration through `parseStoredDecisionV1` / `normalizeStoredDecisionV1`, whose
output is explicitly non-authoritative. It must never authorize execution.
Delete V1 parsing only after a migration proves zero persisted V1 decisions and
two consecutive release checkpoints pass with V2-only fixtures and consumers.
