# ONDC Buyer Goal

## Product

ONDC Buyer is a trusted, AI-assisted buying application that helps people find,
compare, purchase, and resolve issues across an open commerce network without
surrendering unnecessary identity data or uncontrolled authority to an agent.

## Product promise

> Buy with confidence. Let AI help. Stay in control of every consequential
> action.

## Primary customer

A buyer who wants the reach of open-network commerce with understandable
recommendations, safe checkout, reliable order visibility, and accountable AI
assistance.

## Customer jobs

1. Discover relevant products across participating sellers.
2. Understand price, seller, delivery, return, and trust differences.
3. Use AI to compare options without hidden purchases or manipulated ranking.
4. Approve the exact cart, amount, seller, address, and payment consequence.
5. Track fulfillment and obtain help with cancellation, return, refund, or
   dispute.
6. Share identity or eligibility claims only when the action genuinely needs
   them.
7. Inspect and revoke any authority delegated to a buyer agent.

## Owned capabilities

- product discovery, comparison, cart, checkout, order, refund, and dispute UX;
- explainable recommendations with source and uncertainty visibility;
- buyer-agent planning and bounded action delegation;
- server-side enforcement for protected buyer actions;
- payment and order reconciliation;
- accessible multilingual explanations and approvals;
- consumer support, correction, and dispute flows.

## Relationship to AadhaarChain

ONDC Buyer is a relying application, not an identity verifier.

- AadhaarChain establishes minimal assurance and agent authorization.
- Buyer requests only the claims required for a specific action.
- Buyer verifies one-time, action-bound proofs and current revocation.
- Raw Aadhaar, PAN, OCR, biometrics, and verification evidence never enter this
  product.
- Ordinary discovery and low-risk purchases must not be unnecessarily KYC
  gated.

## Hard rules

- Recommendations must distinguish facts, estimates, sponsored placement, and
  model judgment.
- AI cannot purchase, change payment details, or disclose protected data outside
  an explicit delegation policy.
- Checkout approval binds the exact cart, seller, amount, address, payment
  method, policy, nonce, and expiry.
- Protected actions are enforced by the server, not only disabled in the UI.
- A failed, stale, or revoked trust check blocks only the action requiring it and
  explains how to recover.
- Users can pause the buyer agent and review its complete action history.
- Commerce state remains in the commerce system; it is not copied on-chain
  merely for audit theatre.

## Phase-one outcome

Deliver one complete buyer journey using a real or contract-faithful commerce
backend:

1. Search and compare products.
2. Add a selected product to a persistent cart.
3. Explain why checkout does or does not require step-up assurance.
4. Present an exact, plain-language checkout approval.
5. Verify and consume a one-time proof server-side.
6. Create and display the order.
7. Track fulfillment and exercise a refund or dispute flow.
8. Show the buyer-agent activity and revocation controls.

## Success measures

- Users correctly identify total amount, seller, delivery, and return terms.
- No protected action succeeds from UI-only trust state.
- No successful proof replay or post-revocation action.
- Recommendation explanations are traceable to catalog and policy inputs.
- Checkout and recovery completion outperform the wallet-first baseline.
- Refund and dispute status remains reconciled with the source system.

## Non-goals

- Becoming an identity custodian.
- Requiring Aadhaar verification for ordinary browsing or every purchase.
- Hiding sponsored ranking or AI uncertainty.
- Autonomous purchasing without explicit bounded delegation.
- Treating demo commerce as production ONDC protocol compliance.
- Putting carts, addresses, orders, or customer PII on Solana.

## Source of truth

This file owns the ONDC Buyer product goal. `README.md` owns development and
runtime instructions. Workspace integration status remains in the root
`AGENTS.md` and `PRODUCTION-READINESS.md`.
