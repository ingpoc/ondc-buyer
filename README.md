# ONDC UCP Buyer Portal

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/openclaw-gurusharan/ondc-buyer)

Buyer web application for ONDC UCP integration.

## Prerequisites

- Node.js 18+
- pnpm 8+

## Installation

```bash
pnpm install
```

## Environment Variables

Create a `.env` file:

```env
VITE_API_BASE_URL=http://localhost:3001
```

## Development

```bash
# Start dev server (port 43102)
pnpm dev

# Type check
pnpm typecheck

# Build for production
pnpm build
```

## Features

- Product search with streaming results
- Shopping cart management
- Checkout with payment selection
- Order tracking
- AI agent chat interface

## Architecture

- **Framework**: Vite + React + TypeScript
- **Routing**: React Router v6
- **Design System**: @ondc-sdk/shared/design-system
- **State Management**: React hooks (local)
- **API**: RESTful endpoints via @ondc-sdk/api-server
