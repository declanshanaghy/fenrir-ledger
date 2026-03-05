# Security -- Fenrir Ledger

Owned by **Heimdall** (`.claude/agents/heimdall.md`).

This directory contains all security documentation for the Fenrir Ledger project: audit reports, architecture diagrams, checklists, and advisories.

## Reports

| Date | Scope | Findings | Path |
|------|-------|----------|------|
| 2026-03-02 | Google API Integration | 0C / 3H / 4M / 3L / 3I | [reports/2026-03-02-google-api-integration.md](reports/2026-03-02-google-api-integration.md) |
| 2026-03-02 | Patreon Integration | 0C / 2H / 3M / 3L / 3I | [reports/2026-03-02-patreon-integration.md](reports/2026-03-02-patreon-integration.md) |
| 2026-03-04 | Stripe Direct Integration | 1C / 0H / 2M / 3L / 3I | [reports/2026-03-04-stripe-direct-integration.md](reports/2026-03-04-stripe-direct-integration.md) |

## Architecture

| Document | Description |
|----------|-------------|
| [architecture/auth-architecture.md](architecture/auth-architecture.md) | Full OAuth 2.0 PKCE flow, session storage model, token expiration, incremental Drive consent, trust boundaries, JWKS verification, and Patreon two-token model (updated 2026-03-02) |
| [architecture/data-flow-diagrams.md](architecture/data-flow-diagrams.md) | Security-focused data flow diagrams for OAuth PKCE, URL import (Path A), CSV upload (Path C), and Google Picker (Path B); marks trust boundaries, SSRF surfaces, and injection points |
| [architecture/trust-boundaries.md](architecture/trust-boundaries.md) | Client vs server trust zones, secret locations, what data crosses each boundary, localStorage XSS implications and mitigations |
| [architecture/threat-model.md](architecture/threat-model.md) | Assets, threat actors, attack surfaces, mitigations in place, and residual risks |

## Checklists

| Document | Description |
|----------|-------------|
| [checklists/api-route-checklist.md](checklists/api-route-checklist.md) | Pre-merge checklist for adding or modifying API routes: requireAuth pattern, input validation, error handling, secret hygiene, SSRF prevention |
| [checklists/deployment-security.md](checklists/deployment-security.md) | Pre-deployment checklist: secret hygiene, CSP verification, OAuth config, dependency audit, build verification, post-deployment checks |

## Advisories

None to date.
