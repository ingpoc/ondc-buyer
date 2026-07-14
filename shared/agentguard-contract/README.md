# AgentGuard Contract

Shared TypeScript contract for the local AgentGuard demo. It owns the action taxonomy, decision reason codes, identity-neutral principal shapes, and canonical JSON hashing helpers used by Buyer, Seller, and the gateway.

The gateway mirrors these constants in `aadharchain/gateway/app/agentguard_contract.py`. Keep `fixtures/golden-action-request.json` stable when checking cross-language canonicalization.
