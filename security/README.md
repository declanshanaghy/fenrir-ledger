# Security -- Fenrir Ledger

Owned by **Heimdall** (`.claude/agents/heimdall.md`).

This directory contains all security documentation for the Fenrir Ledger project: audit reports, architecture diagrams, checklists, and advisories.

## Current State (as of 2026-03-05)

- **Subscription platform**: Stripe Direct only. Patreon has been fully removed.
- **Prompt injection**: Fixed in PR #171 — CSV wrapped in XML-style system/user role separation with explicit RAW DATA instruction.
- **Stripe webhook**: SHA-256 HMAC via `stripe.webhooks.constructEvent()`.
- **CSP**: Includes all required Google, Stripe, and Vercel domains.
- **Open findings**: 3 LOW (distributed rate limiting, webhook deduplication, email validation), 3 INFO (trust chain comment, KV delete race, publishable key monitoring).

---

## Reports

| Date | Scope | Risk Summary | Status | Path |
|------|-------|-------------|--------|------|
| 2026-03-02 | Google API Integration | 0C / 3H / 3M / 3L / 3I | Active — findings partially open | [reports/2026-03-02-google-api-integration.md](reports/2026-03-02-google-api-integration.md) |
| 2026-03-02 | Patreon Integration | 0C / 2H / 3M / 3L / 3I | **SUPERSEDED** — Patreon removed | [reports/2026-03-02-patreon-integration.md](reports/2026-03-02-patreon-integration.md) |
| 2026-03-04 | Stripe Direct Integration | 0C / 0H / 0M / 3L / 3I | Active — CRITICAL/MEDIUM resolved | [reports/2026-03-04-stripe-direct-integration.md](reports/2026-03-04-stripe-direct-integration.md) |
| 2026-03-05 | LLM Prompt Injection Remediation (#157) | 0C / 0H / 0M / 0L / 2I | Active | [reports/2026-03-05-llm-prompt-injection-remediation.md](reports/2026-03-05-llm-prompt-injection-remediation.md) |

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
| [architecture/auth-architecture.md](architecture/auth-architecture.md) | Full OAuth 2.0 PKCE flow, session storage model, token expiration, incremental Drive consent, trust boundaries, JWKS verification, and Stripe subscription auth model | 2026-03-05 |
| [architecture/data-flow-diagrams.md](architecture/data-flow-diagrams.md) | Security-focused data flow diagrams for OAuth PKCE, URL import (Path A), CSV upload (Path C), Google Picker (Path B), and Stripe checkout; marks trust boundaries, SSRF surfaces, and injection points | 2026-03-05 |
| [architecture/trust-boundaries.md](architecture/trust-boundaries.md) | Five trust zones (browser, server, Google infra, Stripe infra, Vercel KV); secret locations; what data crosses each boundary; localStorage XSS implications and mitigations | 2026-03-05 |
| [architecture/threat-model.md](architecture/threat-model.md) | Assets, threat actors, attack surfaces, mitigations in place, and residual risks; updated for Stripe Direct | 2026-03-05 |

---

## Checklists

| Document | Description | Last Reviewed |
|----------|-------------|---------------|
| [checklists/api-route-checklist.md](checklists/api-route-checklist.md) | Pre-merge checklist for adding or modifying API routes: requireAuth pattern, input validation, error handling, secret hygiene, SSRF prevention; includes Stripe webhook exemption | 2026-03-05 |
| [checklists/deployment-security.md](checklists/deployment-security.md) | Pre-deployment checklist: secret hygiene, CSP verification, OAuth config, Stripe config, dependency audit, build verification, post-deployment checks | 2026-03-05 |

---

## Advisories

None to date.

---

## Open Findings Tracker

The following findings from active reports remain open. Assign to FiremanDecko for remediation.

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
