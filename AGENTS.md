# AGENTS.md

## Inheritance Contract

- Global baseline: `Organization` published baseline from `/Users/gurusharan/Documents/Organization/reports/publish/publish-manifest.json`
- Workspace parent: `../AGENTS.md`
- Read `../AGENTS.md` first for portfolio-wide governance.
- This file adds only `ondc-buyer`-specific execution guidance.
- Organization routing: `inherits_by_default`
- Local policy authority: `AGENTS.md`
- Local CLAUDE policy: `defer_to_agents`
- If this file conflicts with the root workspace `AGENTS.md`, the root file wins unless it explicitly allows a repo-local exception.

## Browser Testing

- BEFORE browser testing ONDC Buyer -> read `../docs/workflow/browser-testing-control-plane.md`
- BEFORE validating the same-user portfolio journey -> read `../docs/workflow/portfolio-browser-acceptance-loop.md`
- Browser testing for this repo should happen after AadhaarChain trust state is confirmed, because buyer trust notices and checkout expectations depend on it.
- Critical browser routes for this repo: `/search`, `/results`, `/product/:id`, `/cart`, `/checkout`, `/orders`, `/orders/:id`, `/agent`
- Distinguish trust-state failures from missing commerce backend failures; do not collapse both into a generic buyer-app failure.

ONDC UCP Buyer Portal - Private buyer webapp

---

## Repository Type

**Private webapp** - Vite + React + TypeScript

---

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start dev server (port 3000) |
| `pnpm build` | Production build |
| `pnpm preview` | Preview production build |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Tests in watch mode |
| `pnpm test:coverage` | Tests with coverage |
| `pnpm typecheck` | TypeScript check |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format with Prettier |

---

## Development

1. `pnpm install` → `pnpm dev`
2. Open `http://localhost:3000`
3. Hot reload enabled
4. Source maps for debugging

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + Vite |
| Language | TypeScript |
| Routing | React Router v6 |
| SDK | `@ondc-sdk/shared` |
| Testing | Vitest + jsdom |

---

## Testing

- Framework: Vitest + @testing-library/react
- Test files: `src/**/*.test.ts`, `src/**/*.test.tsx`
- Setup: `src/__tests__/setup.ts`
- Run: `pnpm test` or `pnpm test:watch`

---

## Structure

```
src/
├── components/      # React components
├── pages/           # Page components
├── hooks/           # Custom hooks
├── services/        # API calls
├── types/           # TypeScript types
├── __tests__/       # Test setup
└── main.tsx         # Entry point
```

---

## Key Dependencies

- `@ondc-sdk/shared` - ONDC SDK utilities
- `react-router-dom` - Routing
- `@drams-design/components` - UI components (optional)

---

## Before Changing

1. Check `src/pages/` for route definitions
2. Read `src/services/` for API patterns
3. Run `pnpm typecheck` before committing
4. Test user flows, not just components

---

## CI/CD

- CI runs on all PRs and main branch
- Checks: typecheck, build, test
- No publishing (private repo)

---

## GitHub Actions (Agents: Create if Missing)

### Existing Workflows

- `.github/workflows/ci.yml` - CI testing

### Additional Workflows to Create

#### 1. Lint Workflow (`.github/workflows/lint.yml`)

```yaml
name: Lint

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check
```

#### 2. Deploy Preview Workflow (`.github/workflows/preview.yml`)

```yaml
name: Deploy Preview

on:
  pull_request:
    branches: [main]

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Upload preview
        uses: actions/upload-artifact@v4
        with:
          name: preview-build
          path: dist/
```
