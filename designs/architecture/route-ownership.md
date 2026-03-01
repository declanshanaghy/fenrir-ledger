# Route Ownership — Fenrir Ledger

**Date:** 2026-03-01
**Author:** FiremanDecko (Principal Engineer)
**Related:** ADR: `adr-backend-server.md`

## Route Placement

| Route | Host | Method | Purpose | Rationale |
|-------|------|--------|---------|-----------|
| `/` (app routes) | Next.js (Vercel) | GET | All UI pages (dashboard, cards, valhalla, auth) | App Router serves the React SPA |
| `POST /api/auth/token` | Next.js (Vercel) | POST | Google OAuth2 PKCE token exchange proxy | Fast (~200ms), stateless, keeps GOOGLE_CLIENT_SECRET server-side |
| `POST /api/sheets/import` | Next.js → Backend proxy | POST | Thin HTTP proxy to backend /import | Fallback for non-WebSocket clients; delegates long-running work to backend |
| `GET /health` | Backend (Fly.io) | GET | Liveness probe | Backend health check for monitoring and frontend availability detection |
| `POST /import` | Backend (Fly.io) | POST | Full import pipeline (CSV fetch + Anthropic + Zod) | Long-running operation (~5-30s); freed from Vercel timeout limits |
| `ws://` (WebSocket) | Backend (Fly.io) | WS | Real-time import progress streaming | Duplex: server streams phase events, client can cancel mid-import |

## Environment Variables

| Variable | Runtime | Scope | Description |
|----------|---------|-------|-------------|
| `BACKEND_URL` | Next.js (server) | Server-side only | HTTP URL of backend for proxy use (e.g., `http://localhost:9753`) |
| `NEXT_PUBLIC_BACKEND_WS_URL` | Next.js (client) | Browser-exposed | WebSocket URL for client-side connection (e.g., `ws://localhost:9753`) |
| `GOOGLE_CLIENT_SECRET` | Next.js (server) | Server-side only | Stays in Next.js — used by auth token proxy |
| `ANTHROPIC_API_KEY` | Backend | Server-side only | Moved to backend — used by import pipeline |

## Design Principles

1. **Fast + stateless -> Next.js**: Routes that complete in <1s with no persistent state belong in Next.js/Vercel.
2. **Long-running + stateful -> Backend**: Operations exceeding Vercel's timeout ceiling or requiring WebSocket belong on the backend.
3. **Graceful degradation**: The frontend works without the backend for anonymous users (localStorage-only mode). The backend is an optional enhancement.
4. **Single secret per runtime**: Each secret lives in exactly one runtime. No secret is shared across both.
