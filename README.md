# ONDC UCP Buyer Portal

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/openclaw-gurusharan/ondc-buyer)

Buyer web application for ONDC UCP integration.

## Prerequisites

- Node.js 18+
- npm 10+

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file:

```env
VITE_AADHAAR_API_URL=http://127.0.0.1:43101
VITE_BUYER_COMMERCE_URL=http://127.0.0.1:43102
VITE_AGENT_CONTROL_PLANE_URL=http://127.0.0.1:8100
VITE_AGENT_RUNTIME_ENABLED=false
```

## Development

```bash
# Start dev server (port 43102)
npm run dev

# Type check
npm run typecheck

# Test
npm test

# Build for production
npm run build
```

## Features

- Product search with local mock fallbacks when no commerce backend is available
- Local cart and order state for portfolio acceptance flows
- Trust-aware checkout gated by AadhaarChain `verified` trust state
- Order tracking and support-case surfaces
- AI buyer agent chat through the shared agent control plane when enabled

## Architecture

- **Framework**: Vite + React + TypeScript
- **Routing**: React Router v6
- **Design System**: local Tailwind/shadcn-style primitives
- **State Management**: React hooks (local)
- **Trust Producer**: AadhaarChain gateway at `VITE_AADHAAR_API_URL`
- **Commerce Backend**: optional `VITE_BUYER_COMMERCE_URL`; local mock responses remain the current deterministic fallback
- **Agent Runtime**: optional shared control plane at `VITE_AGENT_CONTROL_PLANE_URL`
