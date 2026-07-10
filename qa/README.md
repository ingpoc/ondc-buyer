# ONDC Buyer QA notes

Ledger: `test-ledger.json`. Full browser harness: `aadhaar-chain/qa`.

Root-cause fixes:
- Vendored `@portfolio/trust-client` (missing shared package in workspace)
- Demo order bridge publishes to `ondc-portfolio-demo-orders` for seller queue
