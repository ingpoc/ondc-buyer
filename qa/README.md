# ONDC Buyer QA

Pointer only. **Do not** keep a ledger or grader copy here.

Portfolio control owner: [`../aadhaar-chain/qa/docs/workflow/README.md`](../../aadhaar-chain/qa/docs/workflow/README.md)

Run from `aadhaar-chain/qa`:

```bash
cd ../aadhaar-chain/qa
npm run grade:deterministic && npm run grade:browser && npm run grade:wallet
```

Repo-local notes (not portfolio ownership):
- Vendored `@portfolio/trust-client` at `./shared/trust-client`
- Demo order bridge publishes to `ondc-portfolio-demo-orders`
