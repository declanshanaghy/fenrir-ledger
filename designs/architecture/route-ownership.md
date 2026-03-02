# Route Ownership — Fenrir Ledger

**Date:** 2026-03-01 (updated: backend removed)
**Author:** FiremanDecko (Principal Engineer)
**Related:** ADR: `adr-backend-server.md` (superseded — serverless-only)

## Route Placement

| Route | Host | Method | Purpose | Rationale |
|-------|------|--------|---------|-----------|
| `/` (app routes) | Next.js (Vercel) | GET | All UI pages (dashboard, cards, valhalla, auth) | App Router serves the React SPA |
| `POST /api/auth/token` | Next.js (Vercel) | POST | Google OAuth2 PKCE token exchange proxy | Fast (~200ms), stateless, keeps GOOGLE_CLIENT_SECRET server-side |
| `POST /api/sheets/import` | Next.js (Vercel) | POST | Import pipeline: fetch CSV + Anthropic call + Zod validation | Runs as a Vercel serverless function (`maxDuration = 60`) |

## Environment Variables

| Variable | Runtime | Scope | Description |
|----------|---------|-------|-------------|
| `GOOGLE_CLIENT_SECRET` | Next.js (server) | Server-side only | Used by auth token proxy |
| `ANTHROPIC_API_KEY` | Next.js (server) | Server-side only | Used by import pipeline |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Next.js (client) | Browser-exposed | Used for the auth redirect |

## Design Principles

1. **All routes live in Next.js**: With the backend removed, all API routes are Vercel serverless functions.
2. **Server-side secrets stay server-side**: No `NEXT_PUBLIC_` prefix on secret values.
3. **Graceful degradation**: The app works without auth for anonymous users (localStorage-only mode).
4. **Single secret per route**: Each secret is consumed by exactly one route handler.
