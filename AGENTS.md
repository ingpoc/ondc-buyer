# AGENTS.md

## Scope

Repo-local guidance for `ondc-buyer` only.

**Portfolio QA / browser / same-wallet control owner:** `../aadhaar-chain/qa/docs/workflow/`  
Entry: `../aadhaar-chain/qa/docs/workflow/README.md`

There is no parent `../AGENTS.md` in this multi-repo checkout. Do not invent one. Do not fork the ledger or graders under this repo.

`CLAUDE.md` defers to this file (`defer_to_agents`).

## Browser / portfolio testing (pointer only)

- BEFORE browser testing → `../aadhaar-chain/qa/docs/workflow/browser-testing-control-plane.md`
- BEFORE same-wallet journey → `../aadhaar-chain/qa/docs/workflow/portfolio-browser-acceptance-loop.md`
- Session friction → `../aadhaar-chain/qa/docs/workflow/session-friction-log.md`
- Confirm AadhaarChain trust before buyer trust-notice / checkout conclusions
- Distinguish trust-state failures from missing commerce backend failures
- Critical routes: `/search`, `/results`, `/product/:id`, `/cart`, `/checkout`, `/orders`, `/orders/:id`, `/agent`
- Run graders only from `aadhaar-chain/qa`

## Repository Type

Private webapp — Vite + React + TypeScript. Dev port **43102**.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start dev server (port 43102) |
| `pnpm build` | Production build |
| `pnpm preview` | Preview production build |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Tests in watch mode |
| `pnpm test:coverage` | Tests with coverage |
| `pnpm typecheck` | TypeScript check |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format with Prettier |

## Development

1. `pnpm install` → `pnpm dev`
2. Open `http://127.0.0.1:43102`
3. Trust client: vendored at `./shared/trust-client` (Vite/Vitest/tsconfig aliases must point here, not missing `../shared/...`)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + Vite |
| Language | TypeScript |
| Routing | React Router v6 |
| Testing | Vitest + jsdom |

## Before Changing

1. Check `src/pages/` for route definitions
2. Read `src/services/` for API patterns
3. Run `pnpm typecheck` before committing
4. Test user flows, not just components

## CI/CD

CI on PRs/main: typecheck, build, test. No publishing.
