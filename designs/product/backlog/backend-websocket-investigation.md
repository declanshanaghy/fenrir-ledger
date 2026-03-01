# Backlog: Investigate Backend Architecture & WebSocket Server

**Priority**: Medium
**Category**: Infrastructure / Architecture
**Sprint**: Resolved in Sprint 5
**Status**: Done

> **Resolution (2026-03-01):** The backend investigation concluded with ADR acceptance of Option C (Dedicated Node/TS Backend Server). A Hono v4 + ws v8 backend was implemented at `development/backend/`, with WebSocket streaming for Google Sheets import progress. See `designs/architecture/adr-backend-server.md` for the decision record and `designs/architecture/backend-implementation-plan.md` for the implementation plan. PRs #41 (backend pipeline), #42 (route ownership), #43 (frontend WS integration) shipped the full solution.

## Problem

The current architecture relies on Next.js API routes for backend operations (e.g., Google Sheets import). These are stateless, request-response HTTP endpoints with limitations:

- **No duplex communication** — Client cannot receive real-time progress updates during long-running operations (e.g., Sheets import with dedup, validation, row-by-row processing)
- **Timeout constraints** — Vercel serverless functions have execution time limits (10s on Hobby, 60s on Pro) that may not accommodate large imports
- **No connection persistence** — Each API call is independent; no ability to stream incremental results
- **Poor error recovery** — If a long import fails midway, the client has no visibility into what succeeded

## Scope of Investigation

### 1. Audit Current Backend Surface

- Inventory all existing API routes and their responsibilities
- Identify which operations are genuinely long-running vs. quick request/response
- Map data flow for Google Sheets import end-to-end
- Document current timeout/failure behavior

### 2. Evaluate WebSocket Server for Duplex Communication

Use cases that benefit from real-time duplex comms:

| Use Case | Why WebSocket Helps |
|---|---|
| **Sheets import** | Stream row-by-row progress, dedup decisions, validation errors back to client in real time |
| **Bulk operations** | Multi-card edits, batch status updates with progress indicators |
| **Future: multi-device sync** | Real-time sync between devices (GA feature) |
| **Future: household sharing** | Live collaboration on shared card portfolio |

### 3. Architecture Options to Evaluate

| Option | Description | Trade-offs |
|---|---|---|
| **A. Keep Next.js API routes** | Status quo + polling for progress | Simple but limited; no real-time feedback |
| **B. Next.js + Server-Sent Events (SSE)** | Unidirectional server→client streaming via API routes | Easy to add, works on Vercel, but one-way only |
| **C. Dedicated WebSocket server (e.g., Socket.io, ws)** | Full duplex communication alongside Next.js | Best UX but requires separate process/hosting (not native to Vercel serverless) |
| **D. Next.js + Vercel Edge Runtime + WebSocket** | WebSocket support via Edge functions | Emerging support; check Vercel's current capabilities |
| **E. tRPC subscriptions** | Type-safe WebSocket subscriptions with tRPC | Good DX if already using tRPC; adds dependency |

### 4. Hosting Implications

If a standalone WebSocket server is needed:
- **Fly.io** — Persistent processes, WebSocket-friendly, affordable
- **Railway** — Easy deploy, supports long-running processes
- **Self-hosted on VPS** — Maximum control, more ops burden
- **Vercel + separate WS service** — Keep Next.js on Vercel, WS server elsewhere

## Acceptance Criteria

- [ ] Document all current API routes and their execution profiles
- [ ] Prototype SSE-based progress streaming for Sheets import (lowest-effort option)
- [ ] Prototype WebSocket-based progress streaming for comparison
- [ ] Benchmark: import 100+ rows from Sheets with both approaches, measure UX difference
- [ ] Recommend architecture with hosting plan and cost estimate
- [ ] ADR (Architecture Decision Record) capturing the decision and rationale

## Dependencies

- Should be investigated before GA planning, as the chosen backend architecture affects auth, sync, and data storage decisions
- Does not violate current constraints (no remote DB required for the investigation itself)

## Notes

- Start with the cheapest experiment: SSE over existing API routes may solve 80% of the problem
- WebSocket server is the more future-proof path if multi-device sync and household sharing are confirmed for GA
