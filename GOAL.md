# ONDC Buyer Goal

## Status

**Active Token Nxt demonstration application.** It must complete the buyer half
of one Buyer-to-Seller commerce journey under the shared AgentGuard contract.
Milestones 10–12 add mandate editing, tool-runner execution, and Realtime voice.

## Product outcome

A person can delegate product discovery and purchase to an AI shopping agent
that **operates the Buyer app** (search, navigate, cart, checkout) while
AgentGuard retains final control over spending, order changes, and remedies.

## Required journey

1. Edit and confirm a Buyer Shopping Agent mandate (allowed actions + checkout
   auto-approve limit).
2. Talk to the agent in text (Cursor) or voice (Realtime `gpt-realtime-2.1`);
   the agent uses tools to search, navigate, and add items to the cart.
3. Discover an item published by the Seller demo and inspect price/availability.
4. Compare and add the item to a cart without unnecessary approval prompts.
5. Let the agent drive checkout via guarded tools with merchant, items, total,
   and expected fulfilment visible.
6. Allow an in-policy checkout and issue an Intent Receipt.
7. Escalate an out-of-policy checkout for one exact human approval; consume it
   once and reject replay.
8. Complete simulated payment, create an order, and expose it to Seller.
9. Track the order and raise a cancellation, return, or issue request.
10. Pause the agent and reject its next protected action.

## Protected actions

Checkout, cancellation after commitment, return submission, and acceptance of a
financial remedy require current AgentGuard authority. Search, comparison,
recommendations, cart preparation, navigation, and issue drafting do not.

Authorization is enforced server-side and binds principal, agent, action,
merchant/resource, amount, policy version, nonce, and expiry. Raw identity,
address, cart, order, and payment evidence remains with the Buyer application;
receipts contain hashes and minimum necessary metadata.

## Acceptance criteria

- The Buyer discovers the exact item published in Seller without manual data
  repair.
- An in-limit checkout succeeds; an over-limit checkout requires approval.
- Replay and post-pause protected actions fail.
- The resulting order appears in Seller with the same transaction identity.
- The buyer can inspect and edit authority and receipts in plain language.
- Agent tools execute under the confirmed mandate (not chat-only proposals).
- Demo commerce and payment are clearly labelled simulated.
- No UI-only control is treated as authorization.

## Non-goals

- Autonomous purchasing without a confirmed mandate.
- Storing or exposing PINs, OTPs, full payment credentials, or raw identity data
  to the model.
- Production ONDC, logistics, payment, or NPCI claims before integration and
  conformance are complete.
- Buyer-specific authorization semantics that diverge from Seller.
- Magically wrapping arbitrary third-party browser agents.

## Source of truth

This file owns the Buyer outcome. `../PRODUCTIDEA.md` owns product scope,
`../ARCHITECTURE.md` owns shared contracts and protocol requirements,
`../IMPLEMENTATIONPLAN.md` owns build milestones, `../TESTINGPLAN.md` owns
verification gates, and `../README.md` / `../AGENTS.md` own runtime routing.
