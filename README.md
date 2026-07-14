# ONDC UCP Buyer Portal

`ondc-buyer` is the portfolio **ONDC Buyer** app under **AgentGuard**. Authorization is session principal (Google / demo) via the gateway; legacy wallet KYC hangar is optional.

It does not verify identity documents and must not receive raw Aadhaar, PAN, OCR, or verifier evidence.

## Local Service

| Service | URL |
| --- | --- |
| Buyer frontend | `http://127.0.0.1:43102` |
| Gateway + AgentGuard | `http://127.0.0.1:43101` |
| Agent control plane (FlatWatch) | `http://127.0.0.1:43104` |

## Environment

```env
VITE_IDENTITY_URL=http://127.0.0.1:43101
# Leave unset — do NOT set to :43102 (self). Gateway has no /api/cart; local cart is the default.
# VITE_BUYER_COMMERCE_URL=
# VITE_API_BASE_URL=
VITE_COMMERCE_DEMO_MODE=false
VITE_IDENTITY_AUTH_ENABLED=true
# Leave empty locally so /api/agent/* uses Vite proxy → gateway
VITE_AGENT_CONTROL_PLANE_URL=
VITE_AGENT_RUNTIME_ENABLED=true
```

`VITE_COMMERCE_DEMO_MODE=false` keeps “ONDC network” labels; cart stays local unless a real remote cart host is configured. Setting `VITE_BUYER_COMMERCE_URL` to the Buyer origin causes Cart 404.

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

## Auth And AgentGuard

Booth path: **Continue with Google** or **Continue as demo user** → session cookie principal → AgentGuard evaluate/consume on checkout.

Legacy wallet trust (`GET /api/identity/{wallet}/trust`) remains for hangar fixtures only. Session principals skip the legacy trust wall for elevated demo UI.

## Agent Page

Route: `/agent`

Uses the shared agent control plane. Prefer Samantha orb for user journeys (see `.cursor/skills/ondc-testing`).

## Production Boundary

Frontend trust badges and disabled controls are guidance only. Protected checkout, refund, dispute, payment, recovery, and agent write actions require server-side commerce policy before production reliance.
