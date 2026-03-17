# Security -- Fenrir Ledger

Owned by **Heimdall** (`.claude/agents/heimdall.md`).

This directory contains all security documentation for the Fenrir Ledger project: audit reports, architecture diagrams, checklists, and advisories.

## Current State (as of 2026-03-17)

- **Infrastructure**: GKE Autopilot (not Vercel). See `infrastructure/k8s/app/` for deployment manifests.
- **Subscription platform**: Stripe Direct only. Patreon has been fully removed.
- **Prompt injection**: Fixed in PR #171 — CSV wrapped in XML-style system/user role separation with explicit RAW DATA instruction.
- **Stripe webhook**: SHA-256 HMAC via `stripe.webhooks.constructEvent()`.
- **CSP**: Includes all required Google and Stripe domains.
- **KV store**: Upstash Redis, configured via `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
- **Firestore sync (issue #1126)**: ~~2 CRITICAL IDOR vulnerabilities~~ → **RESOLVED**. IDOR in `/api/sync/pull` (PR #1203) and `/api/sync/push` (PR #1207) fixed — both routes now derive `householdId` from the server-side user record, not the client. See report below.
- **Open findings (Firestore audit)**: 1 HIGH (invite validate PII leakage), 3 MEDIUM (no rate limiting on invite/sync routes, Admin SDK bypasses rules), 3 LOW (error handling, entropy docs, tier disclosure), 3 INFO (emulator-only rules, soft-delete, no collection group).
- **Open findings (older reports)**: 3 LOW (distributed rate limiting, webhook deduplication, email validation), 3 INFO (trust chain comment, KV delete race, publishable key monitoring), plus external pentest CRITICAL (Next.js CVEs #475) and HIGH (SheetJS #476).

---

## Reports

| Date | Scope | Risk Summary | Status | Path |
|------|-------|-------------|--------|------|
| 2026-03-17 | **Firestore Sync & Household Data Access** (issue #1126) | **2C / 1H / 3M / 3L / 3I** | **[Active] CRITICAL IDOR fixed in PRs #1203 + #1207; HIGH + MEDIUM findings open** | [reports/2026-03-17-firestore-sync-audit.md](reports/2026-03-17-firestore-sync-audit.md) |
| 2026-03-10 | **Comprehensive External Pen Test** — Consolidated from 4 parallel audits (#470–473) | **1C / 1H / 3M / 3L / 5I** | **[Active] CRITICAL Next.js CVEs require immediate patching; HIGH SheetJS unpatched — see issues** | [reports/2026-03-09-external-pentest.md](reports/2026-03-09-external-pentest.md) |
| 2026-03-02 | Google API Integration | 0C / 3H / 3M / 3L / 3I | Active — findings partially open | [reports/2026-03-02-google-api-integration.md](reports/2026-03-02-google-api-integration.md) |
| 2026-03-04 | Stripe Direct Integration | 0C / 0H / 0M / 3L / 3I | Active — CRITICAL/MEDIUM resolved | [reports/2026-03-04-stripe-direct-integration.md](reports/2026-03-04-stripe-direct-integration.md) |
| 2026-03-05 | LLM Prompt Injection Remediation (#157) | 0C / 0H / 0M / 0L / 2I | Active | [reports/2026-03-05-llm-prompt-injection-remediation.md](reports/2026-03-05-llm-prompt-injection-remediation.md) |
| 2026-03-07 | Gmail MCP Deep Audit | N/A (advisory) | Active | [reports/2026-03-07-gmail-mcp-deep-audit.md](reports/2026-03-07-gmail-mcp-deep-audit.md) |
| 2026-03-07 | Gmail MCP PR #324 Review | 0C / 0H / 0M / 2 new findings | Resolved | [reports/2026-03-07-gmail-mcp-pr324-review.md](reports/2026-03-07-gmail-mcp-pr324-review.md) |
| 2026-03-08 | Gmail MCP PR #324 Remediation | All findings resolved | Closed | [reports/2026-03-08-gmail-mcp-pr324-remediation.md](reports/2026-03-08-gmail-mcp-pr324-remediation.md) |

### Penetration Test Sub-Reports (consolidated into 2026-03-09 External Pentest)

| Date | Scope | Path |
|------|-------|------|
| 2026-03-09 | Client-Side Security & Payment Flow | [reports/2026-03-09-pentest-clientside-payment.md](reports/2026-03-09-pentest-clientside-payment.md) |
| 2026-03-10 | Authentication & API Authorization | [reports/2026-03-10-pentest-auth.md](reports/2026-03-10-pentest-auth.md) |
| 2026-03-10 | Reconnaissance & Surface Enumeration | [reports/2026-03-10-pentest-recon.md](reports/2026-03-10-pentest-recon.md) |
| 2026-03-10 | Injection & SSRF Testing | [reports/2026-03-10-pentest-injection.md](reports/2026-03-10-pentest-injection.md) |

### Archived Reports

| Date | Scope | Notes | Path |
|------|-------|-------|------|
| 2026-03-02 | Patreon Integration | Historical — Patreon fully removed | [reports/2026-03-02-patreon-integration.md](reports/2026-03-02-patreon-integration.md) |

### Risk Summary Notes

**Google API report (2026-03-02)**:
- SEV-005 (LLM prompt injection / MEDIUM) — **RESOLVED** in PR #171
- SEV-002 (missing security headers) — **RESOLVED** (headers added in next.config.ts)
- SEV-001 (open redirect), SEV-003 (no rate limit on /api/auth/token), SEV-004 (Picker API key), SEV-006 (Drive token in localStorage), SEV-007 (error leakage) — open

**Stripe Direct report (2026-03-04)**:
- SEV-001 (secrets in worktree) — **RESOLVED** (worktree deleted, never committed)
- SEV-002 (Origin header open redirect) — **RESOLVED** (APP_BASE_URL used exclusively)
- SEV-003 (CSP missing Stripe domains) — **RESOLVED** (Stripe domains in next.config.ts)
- SEV-004 (distributed rate limiting), SEV-005 (webhook deduplication), SEV-006 (email validation), SEV-007/008/009 — open

---

## Architecture

| Document | Description | Last Reviewed |
|----------|-------------|---------------|
| [architecture/auth-architecture.md](architecture/auth-architecture.md) | Full OAuth 2.0 PKCE flow, session storage model, token expiration, incremental Drive consent, trust boundaries, JWKS verification, Stripe subscription auth model, and Firestore sync authorization model | 2026-03-17 |
| [architecture/data-flow-diagrams.md](architecture/data-flow-diagrams.md) | Security-focused data flow diagrams for OAuth PKCE, URL import (Path A), CSV upload (Path C), Google Picker (Path B), Stripe checkout, and Firestore sync pull/push; marks trust boundaries, SSRF surfaces, and injection points | 2026-03-17 |
| [architecture/trust-boundaries.md](architecture/trust-boundaries.md) | Six trust zones (browser, GKE server, Google infra, Stripe infra, Upstash Redis, Firestore); secret locations; what data crosses each boundary; localStorage XSS implications and Firestore householdId constraints | 2026-03-17 |
| [architecture/threat-model.md](architecture/threat-model.md) | Assets, threat actors, attack surfaces, mitigations in place, and residual risks; includes Firestore sync attack surfaces and IDOR mitigations | 2026-03-17 |

---

## Checklists

| Document | Description | Last Reviewed |
|----------|-------------|---------------|
| [checklists/api-route-checklist.md](checklists/api-route-checklist.md) | Pre-merge checklist for adding or modifying API routes: requireAuth pattern, Firestore householdId validation, input validation, error handling, secret hygiene, SSRF prevention; includes Stripe webhook exemption | 2026-03-17 |
| [checklists/deployment-security.md](checklists/deployment-security.md) | Pre-deployment checklist for GKE Autopilot: secret hygiene (including Firestore env vars), CSP verification, OAuth config, Stripe config, dependency audit, build verification, post-deployment checks | 2026-03-17 |

---

## Advisories

None to date.

---

## Open Findings Tracker

The following findings from active reports remain open. Assign to FiremanDecko for remediation.

### Firestore Sync (2026-03-17 Audit)

| ID | Report | Severity | Title | Status | Issue |
|----|--------|----------|-------|--------|-------|
| ~~SEV-001~~ | ~~2026-03-17-firestore-sync-audit~~ | ~~CRITICAL~~ | ~~IDOR: `/api/sync/pull` reads any household's cards~~ | **RESOLVED — PR #1203** | #1192 |
| ~~SEV-002~~ | ~~2026-03-17-firestore-sync-audit~~ | ~~CRITICAL~~ | ~~IDOR: `/api/sync/push` reads/overwrites any household's cards~~ | **RESOLVED — PR #1207** | #1193 |
| SEV-003 | 2026-03-17-firestore-sync-audit | HIGH | PII leakage: member emails in invite validate response | Open | — |
| SEV-004 | 2026-03-17-firestore-sync-audit | MEDIUM | No rate limiting on invite validate/join endpoints | Open | — |
| SEV-005 | 2026-03-17-firestore-sync-audit | MEDIUM | No rate limiting on sync push/pull endpoints | Open | — |
| SEV-006 | 2026-03-17-firestore-sync-audit | MEDIUM | Admin SDK bypasses Firestore security rules (defense-in-depth gap) | Open | — |

### External Pen Test (2026-03-10)

| ID | Report | Severity | Title | Status | Issue |
|----|--------|----------|-------|--------|-------|
| **CRITICAL-001** | **2026-03-09-external-pentest** | **CRITICAL** | **Next.js Multiple Critical CVEs (GHSA-3h52, GHSA-g5qg, GHSA-xv57, GHSA-4342, GHSA-9g9p, GHSA-f82v)** | **Open** | #475 |
| **HIGH-001** | **2026-03-09-external-pentest** | **HIGH** | **SheetJS Unpatched Prototype Pollution & ReDoS (GHSA-4r6h, GHSA-5pgg)** | Open | #476 |
| MEDIUM-001 | 2026-03-09-external-pentest | MEDIUM | CSP allows unsafe-inline scripts/styles | Open | #477 |
| MEDIUM-002 | 2026-03-09-external-pentest | MEDIUM | CSV fetch follows redirects without validation (SSRF) | Open | #478 |
| MEDIUM-003 | 2026-03-09-external-pentest | MEDIUM | CSV sanitization regex bypass via Unicode | Open | #479 |
| LOW-001 | 2026-03-09-external-pentest | LOW | Minimatch ReDoS in ESLint deps | Open | #480 |
| LOW-002 | 2026-03-09-external-pentest | LOW | Stripe event deduplication missing | Open | #481 |
| LOW-003 | 2026-03-09-external-pentest | LOW | CSV truncation size disclosure | Open | #482 |

### Previous Findings (Older Reports)

| ID | Report | Severity | Title | Status |
|----|--------|----------|-------|--------|
| SEV-001 | 2026-03-02-google-api-integration | HIGH | Open redirect in OAuth callback via unvalidated callbackUrl | Open |
| SEV-003 | 2026-03-02-google-api-integration | HIGH | No rate limiting on /api/auth/token | Open |
| SEV-004 | 2026-03-02-google-api-integration | MEDIUM | Google Picker API key transmitted plaintext to browser | Open |
| SEV-006 | 2026-03-02-google-api-integration | MEDIUM | Drive access token stored in localStorage | Open |
| SEV-007 | 2026-03-02-google-api-integration | MEDIUM | Google token error body forwarded to client | Open |
| SEV-008 | 2026-03-02-google-api-integration | LOW | LLM provider singleton caches stale API key | Open |
| SEV-009 | 2026-03-02-google-api-integration | LOW | FENRIR_OPENAI_API_KEY absent from .env.example | Open |
| SEV-010 | 2026-03-02-google-api-integration | LOW | Middleware is a no-op | Open |
| SEV-013 | 2026-03-02-google-api-integration | INFO | mergeAnonymousCards without schema validation | Open |
| SEV-004 | 2026-03-04-stripe-direct-integration | LOW | In-memory rate limiter not distributed | Open |
| SEV-005 | 2026-03-04-stripe-direct-integration | LOW | Stripe webhook no event deduplication | Open |
| SEV-006 | 2026-03-04-stripe-direct-integration | LOW | Checkout email validation (anonymous path removed — verify) | Open |
| SEV-007 | 2026-03-04-stripe-direct-integration | INFO | googleSub trust chain comment missing | Open |
| SEV-008 | 2026-03-04-stripe-direct-integration | INFO | deleteStripeEntitlement partial KV delete risk | Open |
| SEV-009 | 2026-03-04-stripe-direct-integration | INFO | Stripe publishable key in .env.example without client usage | Monitoring |
