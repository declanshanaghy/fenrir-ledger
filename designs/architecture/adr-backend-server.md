# ADR: Introduce a Dedicated Node/TS Backend Server

## Addendum (2026-03-01): Backend Removed -- Serverless-Only

The dedicated backend server has been removed. The import pipeline now runs
exclusively as a Vercel serverless function via the Next.js API route
`/api/sheets/import`. The WebSocket streaming feature has been removed in
favor of the simpler HTTP request/response pattern.

**Reason:** Simplify operations. The serverless pipeline handles all import
functionality without requiring a separate server. This eliminates Fly.io
hosting costs and operational overhead.

**Status:** Superseded (backend removed)

---

**Original Status:** Accepted
**Date:** 2026-03-01
**Author:** FiremanDecko (Principal Engineer)
**Related:** ADR-005 (auth/PKCE), ADR-006 (anonymous-first)

---

## Context

### Current Architecture

Fenrir Ledger's backend surface today consists of exactly two Next.js API routes:

| Route | Purpose | Execution Profile |
|-------|---------|-------------------|
| `POST /api/auth/token` | Google OAuth2 PKCE token exchange proxy — keeps `GOOGLE_CLIENT_SECRET` server-side while the browser owns the PKCE flow | Fast (~200ms round-trip to Google token endpoint) |
| `POST /api/sheets/import` | Fetches a public Google Sheet as CSV, calls the Anthropic API (Claude Haiku) to extract card data, validates with Zod, and returns card objects | Long-running (5–30s+ depending on CSV size and model response time); `maxDuration = 60` set |

Both routes are hosted on Vercel serverless functions. This works for the current MVP, but creates structural problems as features scale:

### Structural Problems

**1. Timeout ceiling on Vercel Hobby tier (10 seconds)**
`/api/sheets/import` sets `maxDuration = 60`, which requires at minimum Vercel Pro. A user on a slow connection importing a 200-row sheet (CSV fetch + Anthropic API call + Zod validation) may exceed 60 seconds on large inputs.

**2. No duplex communication**
Serverless functions are strictly request-response. The client sends a request, blocks for up to 60 seconds, then receives a success or error response. The user sees no progress during this window. There is no mechanism to stream row-by-row progress back to the client.

**3. No error recovery visibility**
If the Anthropic call succeeds but Zod validation fails, the client has no way to know how many rows were successfully parsed before the error. The entire operation is atomic from the client's perspective.

**4. Future requirements blocked**
Product direction (see `product-brief.md`) calls for:
- Multi-device sync at GA (requires a persistent backend process)
- Household sharing with real-time updates
- Bulk card operations with progress feedback

None of these can be delivered via stateless serverless functions.

---

## Options Considered

### Option A: Keep Next.js API Routes + Client Polling

**Description:** Add a progress-tracking mechanism to the import route by splitting work into a job queue backed by in-memory state. Client polls a `/api/sheets/import/status?jobId=xxx` endpoint.

**Pros:**
- No new infrastructure
- Stays entirely within Vercel
- Lowest immediate implementation cost

**Cons:**
- In-memory job state is lost on cold starts (serverless functions do not share memory between invocations)
- Polling adds latency and unnecessary network traffic
- Still bounded by 10/60s execution limits
- Does not address the future need for WebSocket connections at all
- Import state is unreliable — a cold start between enqueue and poll loses the job

**Verdict:** Rejected. In-memory state across serverless invocations is inherently unreliable. This approach has a fundamental architectural ceiling.

---

### Option B: Next.js API Routes + Server-Sent Events (SSE)

**Description:** Keep all logic in Next.js API routes but stream progress updates from server to client using the `ReadableStream` API (supported by Next.js App Router). The import route emits SSE events as each phase completes (CSV fetch done, Anthropic call done, N rows validated, etc.).

**Pros:**
- Works without a separate process
- Compatible with Vercel (streaming responses are supported)
- Unidirectional streaming covers most of the current import progress use case
- Simple to implement: `TransformStream` + `ReadableStream` in the existing route handler

**Cons:**
- Strictly unidirectional (server to client only) — client cannot send mid-stream commands (e.g., "cancel this import", "skip this row")
- Still bound by Vercel serverless execution limits
- State sharing between request handlers is still unreliable for job coordination
- Does not address future WebSocket requirements (multi-device sync, household sharing)

**Verdict:** Viable as a near-term patch but insufficient for GA requirements. Appropriate as **Phase 1 of a progressive migration** (see Implementation Plan).

---

### Option C: Dedicated Node/TS Backend Server (WebSocket-capable)

**Description:** Introduce a standalone `development/backend/` Node.js + TypeScript server alongside the existing Next.js frontend (`development/frontend/`). The backend:
- Uses Fastify or Hono as the HTTP framework (lightweight, TypeScript-native)
- Adds `ws` or `Socket.io` for WebSocket support
- Runs on port 9753 (frontend stays on 9653, per existing port scheme)
- Is optional: the frontend continues to work standalone for anonymous users; the backend unlocks streaming import and future sync features
- Hosts the long-running import logic, emitting progress events over WebSocket
- Keeps the PKCE token proxy in Next.js (fast, stateless — appropriate fit)

**Pros:**
- True duplex communication: client can send "cancel", server can stream row-by-row progress
- No execution time limits imposed by Vercel
- Works locally with `npx tsx watch` (the existing `backend-server.sh` expects this)
- Clean separation: Next.js handles UI + fast API routes; backend handles long-running + real-time ops
- Positions the project correctly for GA (sync, household sharing, multi-device)
- The backend-server.sh script at `.claude/scripts/backend-server.sh` already exists and expects `development/backend/src/index.ts`

**Cons:**
- Additional hosting cost and complexity (needs a persistent process, not serverless)
- Local dev requires two processes (frontend + backend), mitigated by the existing `backend-server.sh`
- Deployment pipeline becomes more complex (two services to deploy and keep in sync)
- Secrets management spans two runtimes

**Verdict:** Recommended. This is the correct long-term architecture. The implementation plan phases in gradually to avoid disruption.

---

### Option D: Next.js + Vercel Edge Runtime + WebSocket

**Description:** Use Vercel's Edge Runtime (based on Web APIs) with WebSocket support, which has been in experimental preview.

**Pros:**
- Stays on Vercel
- No separate hosting

**Cons:**
- WebSocket support in Vercel Edge is not GA-stable as of 2026-03 (experimental/limited)
- Edge Runtime excludes Node.js APIs — Anthropic's SDK requires Node.js; rewriting the import to work with the Edge-compatible HTTP API is non-trivial
- Cold start behaviour in Edge functions still limits persistent connection viability
- Vendor lock-in to Vercel's evolving edge API surface

**Verdict:** Rejected. The Anthropic SDK dependency and the instability of Vercel Edge WebSocket support make this incompatible with our current toolchain.

---

### Option E: tRPC Subscriptions

**Description:** Adopt tRPC across the stack with its subscription primitive (backed by WebSockets via `@trpc/server/adapters/ws`).

**Pros:**
- End-to-end type safety (procedure signatures shared between client and server)
- Familiar DX for TypeScript teams
- Subscriptions provide the streaming semantics needed

**Cons:**
- Adds significant dependency surface: `@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`
- Requires a standalone Node.js process for the WebSocket adapter anyway (same hosting consequence as Option C)
- Replaces the existing clean Next.js fetch-based API client pattern with tRPC's query model
- Overkill for the current scale: 2 API routes do not justify adopting a full RPC framework

**Verdict:** Rejected for now. If the backend grows to 10+ endpoints across multiple domains, tRPC becomes worth revisiting.

---

## Decision

**Adopt Option C: Dedicated Node/TS Backend Server with WebSocket support.**

Implement it in phases (see Implementation Plan):
- **Phase 1:** Scaffold the backend (`development/backend/`) with health endpoint. Confirm the `backend-server.sh` script works end-to-end. No migration of existing routes yet.
- **Phase 2:** Migrate the Sheets import route to the backend with WebSocket progress streaming. Next.js proxy endpoint delegates to the backend.
- **Phase 3:** Keep fast/stateless routes (auth token proxy) in Next.js. Backend owns only long-running and real-time operations.
- **Phase 4:** At GA planning — expand backend for multi-device sync and household sharing over WebSocket.

The frontend remains functional without the backend for anonymous users (localStorage-only mode). The backend is an optional enhancement layer.

---

## Consequences

### Positive
- Long-running imports can stream progress row-by-row to the client with no timeout risk
- Full duplex: client can cancel an in-progress import
- Architecture is ready for GA sync and household sharing features without a further structural change
- Clear separation of concerns: Next.js = UI + stateless API, backend = stateful + real-time

### Negative / Trade-offs
- **Two processes in local dev.** Developers must run both the frontend and backend servers. The `services.sh` script (`.claude/scripts/services.sh`) orchestrates both processes together; individual control is available via `backend-server.sh` and `frontend-server.sh`.
- **Additional hosting.** The backend needs a persistent process. Vercel Serverless is not appropriate. Options: Fly.io, Railway, or a VPS. (See Implementation Plan for hosting recommendation.)
- **Secrets management spans two runtimes.** `ANTHROPIC_API_KEY` moves from Vercel env vars to the backend's `.env`. The PKCE token proxy keeps `GOOGLE_CLIENT_SECRET` in Next.js/Vercel. This split is intentional and matches where each secret is consumed.
- **Deployment pipeline complexity increases.** Sprint stories must include deployment scripts for both services.
- **Phase 2 introduces a proxy hop.** During migration, Next.js `/api/sheets/import` becomes a thin HTTP proxy to the backend. This adds one network round-trip on the server side, but eliminates the Vercel timeout concern entirely.

### Non-Consequences (Constraints Preserved)
- localStorage remains the primary data store. The backend is stateless with respect to card data — it does not read or write localStorage; it only processes and streams results to the client.
- Anonymous users are unaffected. All frontend-only flows (add/edit/delete cards) continue to work without the backend running.
- The product-brief constraint "no remote DB until GA" is not violated. The backend holds no persistent state.

---

## Architecture Diagram

```mermaid
graph TD
    classDef primary fill:#03A9F4,stroke:#0288D1,color:#FFF
    classDef healthy fill:#4CAF50,stroke:#388E3C,color:#FFF
    classDef warning fill:#FF9800,stroke:#F57C00,color:#FFF
    classDef neutral fill:#F5F5F5,stroke:#E0E0E0,color:#212121
    classDef background fill:#2C2C2C,stroke:#444,color:#FFF

    browser([User Browser])

    %% Frontend tier
    browser -->|HTTP GET /| nextjs[Next.js App\nport 9653\ndevelopment/frontend/]
    browser -->|WebSocket ws://localhost:9753| backend[Node/TS Backend\nport 9753\ndevelopment/backend/]

    %% Next.js routes
    nextjs -->|fast stateless| tokenproxy[POST /api/auth/token\nPKCE proxy]
    nextjs -->|proxy long-running| importproxy[POST /api/sheets/import\nthin HTTP proxy]

    %% Backend routes
    importproxy -->|HTTP POST| importhandler[/import\nFetch CSV + Anthropic call]
    backend -->|WebSocket| wschannel{{WebSocket Channel\nprogress events}}
    wschannel -.->|progress stream| browser

    %% External
    tokenproxy -->|HTTPS| google{{Google OAuth2\nToken Endpoint}}
    importhandler -->|HTTPS| sheets{{Google Sheets\nCSV Export URL}}
    importhandler -->|HTTPS| anthropic{{Anthropic API\nClaude Haiku}}

    %% Data layer (client-only)
    nextjs -->|reads/writes| localstorage[(localStorage\nbrowser only)]

    class browser primary
    class nextjs primary
    class backend primary
    class tokenproxy healthy
    class importproxy warning
    class importhandler warning
    class wschannel healthy
    class localstorage background
    class google neutral
    class sheets neutral
    class anthropic neutral
```

---

## Hosting Recommendation

For the backend server:

| Platform | Fit | Notes |
|----------|-----|-------|
| **Fly.io** | Recommended | Persistent VM processes, WebSocket-native, affordable ($1.94/mo for a shared-cpu-1x 256MB instance), CLI-based deploys fit the existing script pattern, `fly.toml` is a clean config artifact |
| Railway | Good alternative | Similar capabilities, slightly simpler DX for small teams, but less control over health checks and port binding |
| VPS (DigitalOcean, Hetzner) | Maximum control | More ops burden; appropriate if Fly.io costs become a concern at scale |
| Vercel Serverless | Not compatible | No persistent processes; WebSocket connections will be terminated by the serverless model |

**Recommendation: Fly.io for initial backend hosting.** The `fly.toml` config file is checked into `development/backend/` and is treated as the idempotent deployment artifact for the backend, analogous to how `vercel.json` is treated for the frontend.
