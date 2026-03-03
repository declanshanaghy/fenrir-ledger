# Backlog: Separate OIDC Clients for Preview & Production

## Problem Statement

Fenrir Ledger currently uses a single Google OAuth 2.0 client for all Vercel environments (production, preview, development). This creates several issues:

1. **Redirect URI sprawl**: Every preview branch URL must be registered in the same OAuth client's authorized redirect URIs, or sign-in fails on previews.
2. **Blast radius**: A compromised or misconfigured client secret affects all environments simultaneously.
3. **Credential confusion**: Env vars set once across all Vercel environments can drift or be corrupted (see incident: trailing `\n` in `GOOGLE_CLIENT_SECRET` caused `invalid_client` errors on production — 2026-03-03).
4. **Audit ambiguity**: GCP audit logs cannot distinguish production OAuth traffic from preview/dev traffic.

## Proposed Solution

Create separate GCP OAuth 2.0 clients per environment tier:

| Environment | GCP OAuth Client | Redirect URIs |
|-------------|-----------------|---------------|
| Production  | `fenrir-ledger-prod` | `https://fenrir-ledger.vercel.app/auth/callback` |
| Preview     | `fenrir-ledger-preview` | `https://*.vercel.app/auth/callback` (wildcard not supported — use Vercel's `VERCEL_URL` dynamic registration or a proxy) |
| Development | `fenrir-ledger-dev` | `http://localhost:9653/auth/callback` |

### Vercel Env Var Setup

Each environment gets its own credentials:

```
# Production
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<prod-client-id>
GOOGLE_CLIENT_SECRET=<prod-client-secret>

# Preview
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<preview-client-id>
GOOGLE_CLIENT_SECRET=<preview-client-secret>

# Development
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<dev-client-id>
GOOGLE_CLIENT_SECRET=<dev-client-secret>
```

Vercel natively supports per-environment env vars — set each pair scoped to its respective environment.

### Other Providers

Apply the same separation to all provider secrets:

| Secret | Separate per environment? |
|--------|--------------------------|
| `GOOGLE_CLIENT_SECRET` | Yes — different OAuth clients |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes — matches the client above |
| `GOOGLE_PICKER_API_KEY` | Yes — different API key restrictions per domain |
| `FENRIR_ANTHROPIC_API_KEY` | Optional — same key works across envs, but separate keys enable per-env rate limits and cost tracking |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Yes — preview-only, never set on production |

## Code Changes Required

1. **No code changes needed** — the app already reads `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from env vars. Vercel's per-environment scoping handles the rest.
2. **Update `.env.example`** — document the per-environment convention.
3. **Update `ALLOWED_ORIGINS`** in `/api/auth/token/route.ts` — already supports `VERCEL_URL` for dynamic preview origins. Verify this covers preview OAuth clients.

## Acceptance Criteria

- [ ] Separate GCP OAuth clients created for production, preview, and development
- [ ] Each GCP client has only the redirect URIs for its environment tier
- [ ] Vercel env vars scoped per environment (not shared across all)
- [ ] Production OAuth sign-in works with the prod client
- [ ] Preview OAuth sign-in works with the preview client
- [ ] Local dev OAuth sign-in works with the dev client
- [ ] Picker API key separated with per-domain HTTP referrer restrictions
- [ ] `.env.example` updated with per-environment documentation

## Priority

Medium — the current single-client setup works but is a security and operational hygiene concern. Triggered by the `invalid_client` production incident (2026-03-03).

## Related

- Incident: `invalid_client` on production token exchange (2026-03-03) — root cause was trailing `\n` in Vercel env vars
- SEV-004: Google Picker API Key handling
- ADR-005: Auth architecture
