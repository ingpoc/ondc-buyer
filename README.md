# ONDC UCP Buyer Portal

`ondc-buyer` is the portfolio buyer application. It consumes AadhaarChain trust state for discovery, cart, checkout readiness, buyer agent workflows, and purpose-bound identity proof signing.

It does not verify identity documents and it must not receive raw Aadhaar, PAN, OCR, or verifier evidence.

## Local Service

| Service | URL |
| --- | --- |
| Buyer frontend | `http://127.0.0.1:43102` |
| AadhaarChain gateway | `http://127.0.0.1:43101` |
| Agent control plane | `http://127.0.0.1:8100` |

## Environment

```env
VITE_AADHAAR_API_URL=http://127.0.0.1:43101
VITE_BUYER_COMMERCE_URL=http://127.0.0.1:43102
VITE_COMMERCE_DEMO_MODE=true
VITE_AGENT_CONTROL_PLANE_URL=http://127.0.0.1:8100
VITE_AGENT_RUNTIME_ENABLED=false
```

`VITE_COMMERCE_DEMO_MODE=true` is a local fallback for portfolio acceptance. It is not production commerce enforcement.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run lint
npm run build
```

Staging commerce verification:

```bash
npm run verify:staging-journey
```

That verifier expects JSON commerce API responses for search, cart, and orders. A `200 text/html` response is not a valid commerce API pass.

## Trust And Identity Flow

The buyer app reads AadhaarChain trust from:

- `GET /api/identity/{wallet_address}/trust`

Verified trust enables high-trust buyer UI states such as checkout readiness. The app also exposes a wallet-signing control for `buyer_checkout_identity_proof`:

1. request a short-lived AadhaarChain proof challenge
2. ask the connected wallet to sign the challenge
3. submit the signed proof back to AadhaarChain for verification
4. display `Identity signed` only after the gateway verifies the wallet signature

Chrome validation in the signed wallet profile has produced `Identity signed` for buyer proof with wallet `C5svcE...g92YFF`.

## Agent Page

Route: `/agent`

The buyer agent page uses the shared agent control plane. In signed Chrome it renders with:

- wallet `C5svcE...g92YFF`
- runtime `local_cli`
- high-trust write access enabled
- prior buyer agent messages and structured recommendations visible

## Production Boundary

Frontend trust badges and disabled controls are guidance only. Protected checkout, refund, dispute, payment, recovery, and agent write actions require server-side commerce policy before production reliance.

Open risk: server-side protected buyer action enforcement is still a P0/P1 portfolio item.
